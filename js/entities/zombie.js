// Обычный зомби: медленно бредёт к герою и лопается от попаданий.

import { CONFIG } from '../config.js';
import { drawZombie, drawShadow, drawMoleMound } from '../render/sprites.js';

const HURT_FLASH_TIME = 0.09;

export class Zombie {
  // stats задаёт Spawner: { hp, speed, radius, look } — уже с учётом
  // сложности раунда и выбранного вида зомби.
  constructor(x, y, stats) {
    this.x = x;
    this.y = y;
    this.radius = stats.radius ?? CONFIG.zombie.radius;
    this.look = stats.look ?? CONFIG.zombieTypes[0].look;
    this.type = stats.type ?? null;   // весь тип: нужен для особого поведения
    this.maxHp = stats.hp;
    this.hp = this.maxHp;
    this.speed = stats.speed + (Math.random() - 0.5) * CONFIG.zombie.speedJitter;

    this.alive = true;
    this.walkPhase = Math.random() * Math.PI * 2; // чтобы толпа не шагала синхронно
    this.facing = 1;
    this.hurtTimer = 0;
    this.knockback = { x: 0, y: 0 };

    // Стихийные статусы: горение (урон со временем) и заморозка (замедление).
    this.burnTimer = 0;
    this.burnDps = 0;
    this.burnTick = 0;
    this.freezeTimer = 0;
    this.freezeFactor = 1;
    this.freezeDuration = 1;    // сколько длилась заморозка — нужно для трещин
    this.freezeSeed = Math.random() * 1000; // форма льдины, чтобы не дёргалась

    // Цель пересматривается не каждый кадр (см. retarget).
    this.target = null;
    this.targetTimer = 0;

    // Особое поведение зомби-животных (см. updateBehavior).
    this.behaviorTimer = 0;
    this.underground = false;
  }

  // Пока крот под землёй, его нельзя ни подстрелить, ни получить от него урон.
  get isHidden() {
    return this.underground;
  }

  update(dt, world) {
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.updateStatuses(dt, world);
    if (!this.alive) return; // догорел

    // Отскок после удара по герою затухает.
    if (this.knockback.x !== 0 || this.knockback.y !== 0) {
      this.x += this.knockback.x * dt;
      this.y += this.knockback.y * dt;
      const decay = Math.pow(0.02, dt);
      this.knockback.x *= decay;
      this.knockback.y *= decay;
      if (Math.hypot(this.knockback.x, this.knockback.y) < 5) {
        this.knockback.x = 0;
        this.knockback.y = 0;
      }
    }

    if (this.updateBehavior(dt, world)) return;  // крот под землёй не идёт

    const target = this.retarget(dt, world);
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = this.speed * this.speedFactor;

    // Кот виляет: к направлению на героя добавляется поперечное колебание
    let vx = dx / dist;
    let vy = dy / dist;
    if (this.type?.behavior === 'zigzag') {
      const wobble = Math.sin(this.behaviorTimer * this.type.zigzagSpeed) * this.type.zigzagAmount;
      const nx = -vy, ny = vx;                   // перпендикуляр к направлению
      vx += nx * wobble;
      vy += ny * wobble;
      const len = Math.hypot(vx, vy) || 1;
      vx /= len; vy /= len;
    }

    this.x += vx * speed * dt;
    this.y += vy * speed * dt;
    this.facing = dx > 0 ? 1 : -1;
    this.walkPhase += dt * 6 * this.speedFactor;
  }

  // Кого догоняем. Цель держим CONFIG.coop.retargetTime секунд, а не
  // пересматриваем каждый кадр: ровно между двумя игроками ближайший
  // меняется по тридцать раз в секунду, и зомби вместо ходьбы вибрирует.
  retarget(dt, world) {
    this.targetTimer -= dt;
    if (this.target && this.targetTimer > 0) return this.target;
    this.targetTimer = CONFIG.coop.retargetTime;
    this.target = world.nearestPlayer(this.x, this.y);
    return this.target;
  }

  // Возвращает true, если зомби в этом кадре не должен двигаться обычным
  // способом. Стая собак — целиком забота спавнера, здесь её нет.
  updateBehavior(dt, world) {
    this.behaviorTimer += dt;
    if (this.type?.behavior !== 'burrow') return false;

    if (this.underground) {
      if (this.behaviorTimer < this.type.burrowTime) return true;
      this.surface(world);
      return false;
    }

    if (this.behaviorTimer >= this.type.burrowInterval) {
      this.underground = true;
      this.behaviorTimer = 0;
    }
    return false;
  }

  // Выныривает ближе к герою, но не вплотную: правило «у ребёнка всегда есть
  // время увидеть и убежать» действует и здесь.
  surface(world) {
    this.underground = false;
    this.behaviorTimer = 0;

    const target = this.target || world.nearestPlayer(this.x, this.y);
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const jump = Math.min(this.type.burrowJump, Math.max(0, dist - CONFIG.spawner.minDistanceFromPlayer));
    this.x += (dx / dist) * jump;
    this.y += (dy / dist) * jump;
    world.particles.addBurst(this.x, this.y, 10, 0.7);
  }

  // Замороженный зомби ползёт медленнее — это видно по походке.
  get speedFactor() {
    return this.freezeTimer > 0 ? this.freezeFactor : 1;
  }

  get isBurning() { return this.burnTimer > 0; }
  get isFrozen() { return this.freezeTimer > 0; }

  // 0 — только что заморозили, 1 — лёд вот-вот сойдёт. По этому значению
  // рисуются трещины, так что ребёнок видит, что зомби сейчас освободится.
  get freezeProgress() {
    if (this.freezeTimer <= 0) return 0;
    return 1 - this.freezeTimer / this.freezeDuration;
  }

  updateStatuses(dt, world) {
    this.freezeTimer = Math.max(0, this.freezeTimer - dt);

    if (this.burnTimer <= 0) return;
    this.burnTimer -= dt;
    this.burnTick -= dt;
    if (this.burnTick <= 0) {
      this.burnTick = 1; // урон от огня капает раз в секунду
      world.damageEnemy(this, this.burnDps);
    }
  }

  // Поджечь: урон капает раз в секунду. Повторное попадание продлевает горение
  // и берёт больший урон, а не складывает эффекты — иначе огонь ломает баланс.
  ignite(dps, duration) {
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnTimer = Math.max(this.burnTimer, duration);
    if (this.burnTick <= 0) this.burnTick = 1;
  }

  // Заморозить: factor 0.5 — вдвое медленнее.
  freeze(factor, duration) {
    this.freezeFactor = Math.min(this.freezeFactor === 1 ? factor : this.freezeFactor, factor);
    this.freezeTimer = Math.max(this.freezeTimer, duration);
    // Длительность берём по остатку, а не по duration: иначе повторное
    // попадание оставило бы треснувший лёд на свежей заморозке.
    this.freezeDuration = Math.max(this.freezeTimer, duration);
  }

  // Возвращает true, если этот удар добил зомби.
  takeDamage(amount) {
    this.hp -= amount;
    this.hurtTimer = HURT_FLASH_TIME;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  applyKnockback(fromX, fromY, force) {
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    this.knockback.x = (dx / dist) * force;
    this.knockback.y = (dy / dist) * force;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.underground) {            // виден только холмик земли
      drawMoleMound(ctx, {
        radius: this.radius,
        progress: this.behaviorTimer / (this.type?.burrowTime || 1),
      });
      ctx.restore();
      return;
    }

    drawShadow(ctx, this.radius);
    drawZombie(ctx, {
      radius: this.radius,
      walkPhase: this.walkPhase,
      facing: this.facing,
      hurtFlash: this.hurtTimer > 0,
      look: this.look,
      burning: this.isBurning,
      frozen: this.isFrozen,
      freezeProgress: this.freezeProgress,
      freezeSeed: this.freezeSeed,
    });
    ctx.restore();
  }
}
