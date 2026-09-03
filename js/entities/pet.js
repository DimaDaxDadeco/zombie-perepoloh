// Питомцы: бегают за героем и кусают зомби сами.
//
// Устроено как способности: базовый класс, класс на вид, реестр и фабрика,
// характеристики в CONFIG.pets.
//
// Обновляет и рисует питомца Round, а не Player. Причины:
//   - у питомца своя позиция в мире, а Player — это герой, а не контейнер;
//   - порядок кадра: он обязан двигаться ПОСЛЕ героя (идёт в его новую
//     позицию) и ДО проверки попаданий (укус должен успеть убить зомби
//     вместе со всеми);
//   - Round.draw сортирует персонажей по Y, и питомец должен попасть в эту
//     сортировку, иначе висит поверх зомби, стоящих ниже.
//
// В world.enemies питомец не попадает никогда: иначе по нему начнут стрелять
// снаряды, а оружие героя выберет его целью.

import { CONFIG } from '../config.js';
import { drawShadow, drawBeast, drawDrone, drawHero } from '../render/sprites.js';
import { Bullet } from './projectile.js';

export class Pet {
  constructor(id, x, y, owner) {
    this.id = id;
    this.spec = CONFIG.pets[id];
    this.owner = owner;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.walkPhase = 0;
    this.attackTimer = 0;
    this.attackAnim = 0;
    this.wanderPhase = Math.random() * Math.PI * 2;
  }

  get radius() {
    return this.spec.radius;
  }

  update(dt, world) {
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.attackAnim = Math.max(0, this.attackAnim - dt);
    this.wanderPhase += dt * this.spec.wanderSpeed;

    const target = this.findTarget(world);
    this.updateFollow(dt, target);
    this.attack(dt, world, target);
  }

  // Цель — только близкая: питомец помогает, а не улетает через всю арену.
  findTarget(world) {
    return world.findNearestEnemy(this.x, this.y, { maxDistance: this.spec.chaseRadius });
  }

  // Куда бежать: к цели, если она рядом с хозяином, иначе — за хозяином.
  homePoint(target) {
    const owner = this.owner;
    if (target && Math.hypot(target.x - owner.x, target.y - owner.y) < this.spec.leash) {
      return { x: target.x, y: target.y };
    }
    // Точка ПОЗАДИ героя, а не сам герой: иначе питомец лезет ему в ноги.
    // Направление берём из движения, а стоящий герой сохраняет последнее —
    // иначе при остановке цель схлопывается на самом герое.
    const dir = owner.facing;
    return { x: owner.x - dir * this.spec.followDistance, y: owner.y + this.spec.followOffset };
  }

  updateFollow(dt, target) {
    const { maxSpeed, accel, friction, personalSpace, wanderAmount, leash } = this.spec;
    const home = this.homePoint(target);

    // Рысканье: строго по прямой за героем питомец выглядит привязанным.
    const wobble = Math.sin(this.wanderPhase) * wanderAmount;
    const dx = home.x - this.x;
    const dy = home.y - this.y + wobble;
    const dist = Math.hypot(dx, dy) || 1;

    // Отстал безнадёжно — догоняет прыжком. Пятилетний не должен обнаружить
    // собачку на другом конце арены; телепорт с облачком честнее, чем
    // внезапно разгоняющийся до неприличия питомец.
    if (dist > leash * 1.6) {
      this.x = home.x;
      this.y = home.y;
      this.vx = 0;
      this.vy = 0;
      return;
    }

    // Зона покоя: внутри неё только тормозим. Без неё питомец подрабатывает
    // лапами на месте и дрожит рядом с героем.
    if (dist > personalSpace) {
      this.vx += (dx / dist) * accel * dt;
      this.vy += (dy / dist) * accel * dt;
    }
    const decay = Math.pow(friction, dt);
    this.vx *= decay;
    this.vy *= decay;

    const speed = Math.hypot(this.vx, this.vy);
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Math.abs(this.vx) > 5) this.facing = this.vx > 0 ? 1 : -1;
    this.walkPhase += dt * 9 * Math.min(1, speed / maxSpeed);
  }

  attack(dt, world, target) {}   // переопределяют наследники

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    drawShadow(ctx, this.radius);
    this.drawBody(ctx);
    ctx.restore();
  }

  drawBody(ctx) {}
}

// 🐕 Собачка: догоняет зомби и кусает.
class DogPet extends Pet {
  constructor(x, y, owner) { super('dog', x, y, owner); }

  attack(dt, world, target) {
    if (!target || this.attackTimer > 0) return;
    const reach = target.radius + this.radius + this.spec.biteRange;
    if (Math.hypot(target.x - this.x, target.y - this.y) > reach) return;

    world.damageEnemy(target, this.spec.damage);
    target.applyKnockback(this.x, this.y, this.spec.force);
    world.particles.addBurst(target.x, target.y, 6, 0.6);
    world.audio.bite();
    this.attackTimer = this.spec.cooldown;
    this.attackAnim = 0.18;
  }

  drawBody(ctx) {
    drawBeast(ctx, {
      radius: this.radius,
      walkPhase: this.walkPhase,
      facing: this.facing,
      look: this.spec.look,
      mood: 'friendly',
      biteAnim: this.attackAnim / 0.18,
    });
  }
}

// 🤖 Робот-помощник: висит у плеча и стреляет.
class DronePet extends Pet {
  constructor(x, y, owner) { super('drone', x, y, owner); }

  attack(dt, world, target) {
    if (!target || this.attackTimer > 0) return;
    const angle = Math.atan2(target.y - this.y, target.x - this.x);
    world.addProjectile(new Bullet(this.x, this.y, angle, this.spec.speed, this.spec.damage));
    world.audio.shoot();
    this.attackTimer = this.spec.cooldown;
    this.attackAnim = 0.15;
  }

  drawBody(ctx) {
    drawDrone(ctx, {
      radius: this.radius,
      phase: this.wanderPhase,
      facing: this.facing,
      look: this.spec.look,
      fireAnim: this.attackAnim / 0.15,
    });
  }
}

// Спасённый из клетки. Не кусает — отпихивает: «друг дерётся» и «друг
// помогает» для пятилетнего разные вещи, и вторая правильнее.
//
// Питомцем, а не сущностью, он сделан намеренно: питомцы уже обновляются
// раундом, участвуют в сортировке по Y, никогда не попадают в world.enemies —
// и НЕ МОГУТ ПОГИБНУТЬ. Гибель друга — ровно та эмоция, которой игра избегает.
class FriendPet extends Pet {
  constructor(x, y, owner) { super('friend', x, y, owner); }

  attack(dt, world, target) {
    if (!target || this.attackTimer > 0) return;
    const reach = target.radius + this.radius + this.spec.biteRange;
    if (Math.hypot(target.x - this.x, target.y - this.y) > reach) return;

    world.damageEnemy(target, this.spec.damage);
    target.applyKnockback(this.x, this.y, this.spec.force);
    world.particles.addBurst(target.x, target.y, 5, 0.5);
    this.attackTimer = this.spec.cooldown;
    this.attackAnim = 0.18;
  }

  drawBody(ctx) {
    drawHero(ctx, {
      radius: this.radius,
      walkPhase: this.walkPhase,
      facing: this.facing,
      blinking: false,
      look: this.spec.look,
    });
  }
}

export const PET_CLASSES = { dog: DogPet, drone: DronePet, friend: FriendPet };

// Неизвестный id — null, а не исключение: игра должна запускаться в любом
// случае, как и со способностями.
export function createPet(id, x, y, owner) {
  const Klass = PET_CLASSES[id];
  return Klass ? new Klass(x, y, owner) : null;
}
