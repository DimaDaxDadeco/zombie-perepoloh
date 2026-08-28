// Суперспособности героев.
//
// Устроено как оружие (weapons/weapons.js): базовый класс, по классу на вид,
// реестр внизу файла. Характеристики лежат в CONFIG.abilities[id].
//
// Способность — единственное, что ребёнок нажимает сам (пробел), поэтому она
// обязана быть щедрой: не готова — просто ничего не происходит, заряд не
// теряется, ошибиться нельзя.

import { CONFIG } from '../config.js';
import { drawPortal } from '../render/sprites.js';

export class Ability {
  constructor(id) {
    this.id = id;
    this.spec = CONFIG.abilities[id];
    this.charge = 0;     // убитых зомби с прошлого применения
    this.timer = 0;      // сколько ещё длится эффект (у мгновенных — 0)
  }

  get name() { return this.spec.name; }
  get emoji() { return this.spec.emoji; }
  get color() { return this.spec.color; }
  get isReady() { return this.charge >= CONFIG.abilities.chargeNeeded; }
  get isActive() { return this.timer > 0; }

  // Доля заполнения шкалы, 0..1 — это и рисует HUD.
  get ratio() {
    return Math.min(1, this.charge / CONFIG.abilities.chargeNeeded);
  }

  // Возвращает true, если шкала наполнилась именно этим убийством —
  // по этому признаку Round звенит звоночком ровно один раз.
  addCharge(amount) {
    if (this.isReady) return false;
    this.charge += amount;
    return this.isReady;
  }

  // Пробел. Не готова — молча ничего, заряд остаётся.
  // owner — герой, чья это способность: волна бьёт вокруг него, а портал
  // открывается под ним.
  tryActivate(world, owner) {
    if (!this.isReady) return false;
    // Заряд обнуляем ДО эффекта: волна убивает зомби, те снова заряжают шкалу,
    // и это правильно — иначе убийства от собственной способности пропадали бы.
    this.charge = 0;
    this.timer = this.spec.duration ?? 0;
    world.audio.abilityUse();
    this.activate(world, owner);
    return true;
  }

  // world и owner нужны только длящимся способностям — тем, что работают
  // каждый кадр, а не разово в момент нажатия (портал). Разовым они не мешают:
  // те просто игнорируют лишние аргументы.
  update(dt, world, owner) {
    this.timer = Math.max(0, this.timer - dt);
    if (this.timer > 0) this.tick(dt, world, owner);
  }

  activate(world, owner) {}   // разовый эффект, в момент нажатия
  tick(dt, world, owner) {}   // каждый кадр, пока способность работает
  // Способности, живущие в мире, а не на герое, рисуют себя сами — в слое
  // земли, до персонажей. Зовёт Round.draw.
  drawWorld(ctx) {}
}

// 💥 Супер-удар: круговая волна с уроном и отбросом.
class Shockwave extends Ability {
  constructor() { super('shockwave'); }

  activate(world, owner) {
    const p = owner;
    const { radius, damage, force, shake, color } = this.spec;

    world.particles.addRing(p.x, p.y, radius, color);
    world.particles.addBurst(p.x, p.y, 30, 1.4);
    world.shake(shake.strength, shake.time);
    world.audio.boom();

    // Копия списка: damageEnemy может уронить зомби и запустить лут.
    for (const enemy of [...world.enemies]) {
      if (!enemy.alive) continue;
      if (Math.hypot(enemy.x - p.x, enemy.y - p.y) > radius + enemy.radius) continue;
      enemy.applyKnockback(p.x, p.y, force);
      world.damageEnemy(enemy, damage);
    }
  }
}

// 🏃 Супер-скорость: рывок сквозь толпу. Сам эффект живёт таймером на герое,
// 🌀 Портал: на землю ставится воронка и утаскивает зомби в иной мир.
//
// Портал остаётся ТАМ, ГДЕ ЕГО ОТКРЫЛИ, и не ездит за героем. Это принципиально:
// он тянет зомби к себе, и привязанный к герою он подтаскивал бы толпу прямо
// на него — способность работала бы против своего хозяина. Стоящий на месте
// портал даёт правильную игру: вбежал в толпу, оставил дыру, убежал.
//
// Плата — свой путь отрисовки: эффект живёт в мировых координатах, а не вокруг
// героя, поэтому рисует его drawWorld() в слое земли, а не drawAbilityEffect().
class Portal extends Ability {
  constructor() {
    super('portal');
    this.x = 0;
    this.y = 0;
  }

  activate(world, owner) {
    this.x = owner.x;
    this.y = owner.y;
    world.particles.addRing(this.x, this.y, this.spec.grip, this.spec.color);
  }

  tick(dt, world) {
    const { radius, pull, damage, grip } = this.spec;
    // Копия списка: damageEnemy может убить зомби прямо в цикле.
    for (const enemy of [...world.enemies]) {
      if (!enemy.alive || enemy.isHidden) continue;
      const dx = this.x - enemy.x;
      const dy = this.y - enemy.y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) continue;

      if (dist <= grip) {
        // Урон идёт через damageEnemy — тем же путём, что и любой выстрел.
        // Поэтому заряд, медальки, счётчик убитых и наклейка отрабатывают
        // сами, и отдельной ветки в onEnemyDefeated не появляется.
        world.damageEnemy(enemy, damage);
        world.particles.addBurst(enemy.x, enemy.y, 10, 0.9);
        continue;
      }
      const step = Math.min(dist - grip, pull * dt);
      enemy.x += (dx / dist) * step;
      enemy.y += (dy / dist) * step;
    }
  }

  drawWorld(ctx) {
    if (!this.isActive) return;
    // Затухание в конце: воронка закрывается, а не пропадает щелчком.
    const fade = Math.min(1, this.timer / 0.6);
    drawPortal(ctx, {
      x: this.x, y: this.y,
      grip: this.spec.grip, reach: this.spec.radius,
      color: this.spec.color,
      phase: (this.spec.duration - this.timer) * 2.2,
      fade,
    });
  }
}

// ⚡ Турбо: всё оружие стреляет вдвое чаще. Player.update просто ускоряет
// время для оружия — ни один из восьми классов про способность не знает.
class Turbo extends Ability {
  constructor() { super('turbo'); }

  activate(world, owner) {
    owner.turbo(this.spec.duration);
  }
}

// 🐾 Мяу: все зомби на экране замирают. Множитель скорости 0 — полная
// остановка, и ребёнок видит знакомые льдины от ледяной пушки.
class Meow extends Ability {
  constructor() { super('meow'); }

  activate(world) {
    world.audio.freeze();
    for (const enemy of world.enemies) {
      if (!enemy.alive) continue;
      enemy.freeze(0, this.spec.duration);
      world.particles.addRing(enemy.x, enemy.y, enemy.radius * 1.6, this.spec.color);
    }
  }
}

export const ABILITY_CLASSES = {
  shockwave: Shockwave,
  portal: Portal,
  turbo: Turbo,
  meow: Meow,
};

// Герой без способности возможен: старое сохранение или автотест. Поэтому
// null, а не исключение, — игра должна запуститься в любом случае.
export function createAbility(id) {
  const Klass = ABILITY_CLASSES[id];
  return Klass ? new Klass() : null;
}
