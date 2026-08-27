// Суперспособности героев.
//
// Устроено как оружие (weapons/weapons.js): базовый класс, по классу на вид,
// реестр внизу файла. Характеристики лежат в CONFIG.abilities[id].
//
// Способность — единственное, что ребёнок нажимает сам (пробел), поэтому она
// обязана быть щедрой: не готова — просто ничего не происходит, заряд не
// теряется, ошибиться нельзя.

import { CONFIG } from '../config.js';

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
  // owner — герой, чья это способность: волна бьёт вокруг него, а рывок
  // разгоняет именно его.
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

  update(dt) {
    this.timer = Math.max(0, this.timer - dt);
  }

  activate(world, owner) {}   // переопределяют наследники
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
// расталкивание зомби — в collisions.js.
class SuperSpeed extends Ability {
  constructor() { super('dash'); }

  activate(world, owner) {
    owner.boost(this.spec.speedFactor, this.spec.duration);
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
  dash: SuperSpeed,
  turbo: Turbo,
  meow: Meow,
};

// Герой без способности возможен: старое сохранение или автотест. Поэтому
// null, а не исключение, — игра должна запуститься в любом случае.
export function createAbility(id) {
  const Klass = ABILITY_CLASSES[id];
  return Klass ? new Klass() : null;
}
