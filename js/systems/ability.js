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
import { SpiderMinion, GiftLob, Batmobile } from '../entities/projectile.js';
import { Pickup, PickupType } from '../entities/pickup.js';

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
      world.damageEnemy(enemy, damage, 'ability');
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
        world.damageEnemy(enemy, damage, 'ability');
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

// 💨 Спин-дэш: Соник сворачивается в шар и катится, сшибая всё на пути.
//
// Урон и отброс раздаются по контакту в collisions.js — там же, где это уже
// делает ярость Халка. Сюда попадает только запуск: длящийся эффект на самом
// герое обязан жить таймером на герое, а не внутри способности.
class SpinDash extends Ability {
  constructor() { super('spindash'); }

  activate(world, owner) {
    // Катится туда, куда бежал: moveAngle хранит последнее направление
    // целиком, а не только «влево/вправо». Стоящий на месте покатится туда,
    // куда бежал в прошлый раз, — рывок «в никуда» невозможен.
    owner.roll(owner.moveAngle, this.spec.speed, this.spec.duration);
    world.particles.addRing(owner.x, owner.y, owner.radius * 2, this.spec.color);
  }
}

// 🕷 Полчище паучков: разбегаются веером и кусают сами.
class Swarm extends Ability {
  constructor() { super('swarm'); }

  activate(world, owner) {
    const { count, speed, turnSpeed, damage, life, chillFactor, chillTime } = this.spec;
    for (let i = 0; i < count; i++) {
      // Веером во все стороны, а не в сторону цели: полчище должно именно
      // РАЗБЕГАТЬСЯ, иначе на глаз это залп, а не орава.
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const minion = new SpiderMinion(owner.x, owner.y, angle, {
        speed, turnSpeed, damage, life, retarget: 0.4, chillFactor, chillTime,
      });
      // Паучок бьёт контактом, то есть через resolveProjectileHits, — тег
      // источника ему приходится нести на себе. Подаркам он не нужен: у них
      // урон нулевой, а хлопок считается прямо в pop().
      minion.source = 'ability';
      world.addProjectile(minion);
    }
    world.audio.buzz();
  }
}

// 👊 Ярость: Халк раздувается, становится неуязвим и сносит всё контактом.
class Rage extends Ability {
  constructor() { super('rage'); }

  activate(world, owner) {
    owner.rage(this.spec.size, this.spec.duration);
    world.shake(10, 0.3);
    world.audio.boom();
    world.particles.addRing(owner.x, owner.y, owner.radius * 3, this.spec.color);
  }
}

// ⛈ Разряд: молнии бьют по нескольким зомби на экране разом.
//
// От оружия «Молния» отличается тем, что не тянет цепочку от соседа к соседу,
// а лупит по площади: цели выбираются случайно среди видимых.
class Zap extends Ability {
  constructor() { super('zap'); }

  activate(world, owner) {
    const { bolts, damage, radius, stunTime, stunFactor, color } = this.spec;
    const visible = world.enemies.filter((e) => e.alive && !e.isHidden && world.isOnScreen(e));
    world.audio.zap();

    // Тасуем и берём с начала: выбирать случайный индекс в цикле значило бы
    // бить по одному и тому же дважды, а молний и так немного.
    for (let i = visible.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [visible[i], visible[j]] = [visible[j], visible[i]];
    }
    for (const enemy of visible.slice(0, bolts)) {
      world.particles.addLightning([{ x: owner.x, y: owner.y - owner.radius }, enemy]);
      world.particles.addRing(enemy.x, enemy.y, radius, color);
      // Без льда: это оглушение током, а не заморозка.
      enemy.freeze(stunFactor, stunTime, false);
      world.damageEnemy(enemy, damage, 'ability');
    }
  }
}

// 🚗 Бэтмобиль: машина проносится через всю арену и раскидывает всех по дороге.
//
// Единственная способность, которая гоняет по миру крупный объект. Сама она
// почти ничего не делает — только решает, ГДЕ проехать, а урон, пробитие и
// отброс уносит с собой снаряд.
//
// Целиться ребёнку не надо: машина сама едет туда, где зомби гуще. Это то же
// решение, что у разряда, который сам выбирает цели, — кнопка одна, и
// требовать от пятилетнего прицела было бы нечестно.
class BatmobileRun extends Ability {
  constructor() { super('batmobile'); }

  activate(world, owner) {
    const { speed, damage, force, life, color, shake } = this.spec;
    const y = crowdLine(world, owner);
    // Въезжаем с того края, который дальше от героя: так машина едет НА толпу
    // мимо него, а не выныривает у него из-за спины.
    const dir = owner.x > world.arena.width / 2 ? -1 : 1;
    const x = dir > 0 ? -MARGIN : world.arena.width + MARGIN;

    const car = new Batmobile(x, y, dir, { speed, damage, force, life });
    // Тег источника: без него не засчитается медаль «добил босса способностью».
    car.source = 'ability';
    world.addProjectile(car);

    world.particles.addRing(owner.x, owner.y, owner.radius * 2, color);
    world.shake(shake.strength, shake.time);
    world.audio.boom();
  }
}

// Откуда машина въезжает — за краем арены, чтобы было видно, как она
// подъезжает, а не появляется из воздуха.
const MARGIN = 90;
// Насколько далеко от героя машине разрешено проехать. Без ограничения она в
// редкий момент уедет к дальней кучке, и связь «я нажал → вот что случилось»
// для ребёнка порвётся.
const MAX_OFFSET = 150;

// На какой высоте ехать.
//
// Берём медиану, а не среднее: среднее уводит машину в пустоту между двумя
// кучками, а медиана всегда попадает в одну из них. Считаем только видимых:
// спавнер сыплет зомби за краем, и «самое плотное скопление» иначе окажется
// там, где ребёнок ничего не увидит.
//
// Зомби нет вовсе (первые секунды раунда, все под землёй, все за экраном) —
// едем на высоте героя. Пустой список тут обязателен к обработке: Math.max по
// нему даёт -Infinity, а дальше NaN в координатах и зависший раунд.
function crowdLine(world, owner) {
  const ys = world.enemies
    .filter((e) => e.alive && !e.isHidden && world.isOnScreen(e))
    .map((e) => e.y);
  if (!ys.length) return owner.y;
  ys.sort((a, b) => a - b);
  const median = ys[Math.floor(ys.length / 2)];
  return Math.min(Math.max(median, owner.y - MAX_OFFSET), owner.y + MAX_OFFSET);
}

// 🎁 Подарки-хлопушки: вокруг героя падают подарки, хлопают и оставляют
// медальки.
//
// Делает две вещи разом — бьёт и даёт. Урон и отброс здесь главное, медальки
// приятная добавка: способность, которая только дарит, оказалась слишком
// пассивной для ребёнка, который жмёт кнопку, чтобы что-то произошло.
class Gifts extends Ability {
  constructor() { super('gifts'); }

  activate(world, owner) {
    const { gifts, radius, speed, color } = this.spec;
    for (let i = 0; i < gifts; i++) {
      // Кольцом вокруг героя, а не в точке: кучей подарки слиплись бы в один
      // хлопок, и вся щедрость перестала бы читаться.
      const angle = (i / gifts) * Math.PI * 2 + Math.random() * 0.4;
      const dist = radius * (0.35 + Math.random() * 0.65);
      const x = clamp(owner.x + Math.cos(angle) * dist, 20, world.arena.width - 20);
      const y = clamp(owner.y + Math.sin(angle) * dist, 20, world.arena.height - 20);
      // Подарки ВЫЛЕТАЮТ и хлопают в точке падения. Раньше все шесть хлопали
      // мгновенно, и понять, что это подарки, было нельзя — просто вспышки.
      world.addProjectile(new GiftLob(owner.x, owner.y, x, y, {
        speed, damage: 0, color, onLand: (lx, ly) => this.pop(world, lx, ly),
      }));
    }
    world.particles.addFirework(owner.x, owner.y - 40);
  }

  // Один подарок долетел: хлопок с уроном и медалька после него.
  pop(world, x, y) {
    const { blastRadius, damage, force, color } = this.spec;
    world.particles.addRing(x, y, blastRadius, color);
    world.particles.addBurst(x, y, 8, 0.8);
    // Звук на каждый хлопок теперь уместен: они разнесены по времени полёта,
    // и шести «бабахов» в один кадр, из-за которых world.explode() не подошёл,
    // больше не случается.
    world.audio.boom();
    for (const enemy of [...world.enemies]) {
      if (!enemy.alive || enemy.isHidden) continue;
      if (Math.hypot(enemy.x - x, enemy.y - y) > blastRadius + enemy.radius) continue;
      enemy.applyKnockback(x, y, force);
      world.damageEnemy(enemy, damage, 'ability');
    }
    // Медалька остаётся ПОСЛЕ хлопка — подарок, а не приманка.
    world.pickups.push(new Pickup(x, y, PickupType.MEDAL));
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export const ABILITY_CLASSES = {
  shockwave: Shockwave,
  portal: Portal,
  turbo: Turbo,
  meow: Meow,
  spindash: SpinDash,
  swarm: Swarm,
  rage: Rage,
  zap: Zap,
  gifts: Gifts,
  batmobile: BatmobileRun,
};

// Герой без способности возможен: старое сохранение или автотест. Поэтому
// null, а не исключение, — игра должна запуститься в любом случае.
export function createAbility(id) {
  const Klass = ABILITY_CLASSES[id];
  return Klass ? new Klass() : null;
}
