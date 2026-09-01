// Одиннадцать видов оружия. Как добавить своё — см. docs/weapons.md.

import { CONFIG } from '../config.js';
import { Weapon } from './weapon.js';
import {
  Bullet, Lob, Rocket, FlameBolt, IceShard, PiercingBullet, Boomerang, Bee, WebGlob, Bubble,
} from '../entities/projectile.js';
import {
  circle, heroEyePoints, drawWeb, drawFirePatch, drawCatchBubble, drawTornado,
} from '../render/sprites.js';

// 💧 Водяной пистолет — базовое оружие, стреляет каплями в ближайшего зомби.
class WaterGun extends Weapon {
  constructor() { super('water'); }

  fire(world, target, owner) {
    const player = owner;
    const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
    const count = this.stat('count');
    const damage = this.stat('damage');
    const spread = 0.18; // расхождение веером при нескольких струях

    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spread;
      world.addProjectile(
        new Bullet(player.x, player.y, baseAngle + offset, this.spec.speed, damage)
      );
    }
    world.audio.shoot();
  }
}

// 🌊 Водомёт — эволюция водяного пистолета: струя пробивает нескольких насквозь.
class WaterCannon extends Weapon {
  constructor() { super('watercannon'); }

  fire(world, target, owner) {
    const angle = Math.atan2(target.y - owner.y, target.x - owner.x);
    world.addProjectile(new PiercingBullet(
      owner.x, owner.y, angle, this.spec.speed, this.stat('damage'), this.spec.pierce,
    ));
    world.audio.shoot();
  }
}

// 🍅 Помидорометалка — навесом в толпу, взрывается по площади.
class TomatoLauncher extends Weapon {
  constructor(id = 'tomato') { super(id); }

  fire(world, target, owner) {
    const player = owner;
    // Эволюция кладёт три помидора веером. Сначала пробуем выразить
    // превращение числом в конфиге и только потом заводим новый класс —
    // здесь хватило поля count.
    const count = this.stat('count') ?? 1;
    const spread = this.spec.spread ?? 0;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spread;
      world.addProjectile(new Lob(
        player.x, player.y,
        target.x + offset, target.y + offset * 0.4,
        this.spec.flightTime,
        this.stat('damage'),
        this.stat('radius'),
      ));
    }
  }
}

// ⚡ Молния — мгновенный удар с перескоком на соседних зомби.
class Lightning extends Weapon {
  constructor(id = 'lightning') { super(id); }

  fire(world, target, owner) {
    const damage = this.stat('damage');
    const maxJumps = this.stat('chain');
    const hit = new Set();
    const points = [{ x: owner.x, y: owner.y }];

    let current = target;
    for (let i = 0; i < maxJumps && current; i++) {
      points.push({ x: current.x, y: current.y });
      hit.add(current);
      world.damageEnemy(current, damage);
      current = world.findNearestEnemy(current.x, current.y, {
        exclude: hit,
        maxDistance: this.spec.chainRadius,
      });
    }

    world.particles.addLightning(points);
    world.audio.zap();
  }
}

// 🌀 Вертушка — лопасти крутятся вокруг героя и бьют всех, кого задевают.
class Spinner extends Weapon {
  constructor(id = 'spinner') {
    super(id);
    this.angle = 0;
    this.hitCooldowns = new Map(); // зомби -> сколько секунд до следующего удара
  }

  update(dt, world, owner) {
    this.angle += this.spec.spinSpeed * dt;

    for (const [enemy, timer] of this.hitCooldowns) {
      const left = timer - dt;
      if (left <= 0 || !enemy.alive) this.hitCooldowns.delete(enemy);
      else this.hitCooldowns.set(enemy, left);
    }

    const damage = this.stat('damage');
    const bladeRadius = 16;
    for (const blade of this.getBladePositions(owner)) {
      for (const enemy of world.enemies) {
        if (!enemy.alive || this.hitCooldowns.has(enemy)) continue;
        const dist = Math.hypot(enemy.x - blade.x, enemy.y - blade.y);
        if (dist < enemy.radius + bladeRadius) {
          world.damageEnemy(enemy, damage);
          this.hitCooldowns.set(enemy, this.spec.hitCooldown);
        }
      }
    }
  }

  getBladePositions(player) {
    const blades = this.stat('blades');
    // innerOrbit есть только у циклона: внешнее кольцо ловит подбегающих,
    // внутреннее — тех, кто уже прорвался. Обычная вертушка поля не имеет,
    // и колец остаётся одно.
    const orbits = [this.stat('orbit')];
    if (this.spec.innerOrbit) orbits.push(this.spec.innerOrbit);

    const positions = [];
    for (const [ring, orbit] of orbits.entries()) {
      // Внутреннее кольцо смещено на полшага — иначе лопасти выстраиваются
      // в спицы и между ними остаются широкие дыры.
      const shift = (ring * Math.PI) / blades;
      for (let i = 0; i < blades; i++) {
        const a = this.angle + (i * Math.PI * 2) / blades + shift;
        positions.push({ x: player.x + Math.cos(a) * orbit, y: player.y + Math.sin(a) * orbit });
      }
    }
    return positions;
  }

  draw(ctx, player) {
    ctx.save();
    for (const blade of this.getBladePositions(player)) {
      ctx.translate(blade.x, blade.y);
      ctx.rotate(this.angle * 3);
      ctx.fillStyle = '#7fd8ff';
      ctx.strokeStyle = '#2196f3';
      ctx.lineWidth = 2;
      // Четырёхлопастная «вертушка»
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.ellipse(8, 0, 9, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.restore();
  }
}

// 🥕 Ракета-морковка — редко, но очень громко.
class CarrotRocket extends Weapon {
  constructor(id = 'rocket') { super(id); }

  fire(world, target, owner) {
    const player = owner;
    const base = Math.atan2(target.y - player.y, target.x - player.x);
    // count есть только у эволюции: у обычной ракеты поля нет, stat() вернёт
    // undefined, и залп схлопывается в один выстрел — как было.
    const count = this.stat('count') ?? 1;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * (this.spec.spread ?? 0);
      world.addProjectile(new Rocket(
        player.x, player.y, base + offset,
        this.spec.speed, this.spec.turnSpeed,
        this.stat('damage'), this.stat('radius'),
      ));
    }
  }
}

// 🔥 Огнемёт — короткая струя пламени, поджигает всех, кого задела.
class Flamethrower extends Weapon {
  constructor(id = 'fire') { super(id); }

  fire(world, target, owner) {
    const player = owner;
    const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
    const count = this.stat('count');
    const damage = this.stat('damage');
    const effect = {
      burnDps: this.stat('burnDps'),
      burnTime: this.stat('burnTime'),
      range: this.spec.range,
    };

    for (let i = 0; i < count; i++) {
      // Язычки расходятся конусом и летят вразнобой — так струя живее
      const offset = (Math.random() - 0.5) * this.spec.spread * 2;
      const speed = this.spec.speed * (0.8 + Math.random() * 0.4);
      world.addProjectile(
        new FlameBolt(player.x, player.y, baseAngle + offset, speed, damage, effect)
      );
    }
    world.audio.flame();
  }
}

// ❄️ Ледяная пушка — бьёт снежинками и замораживает зомби на месте.
class IceCannon extends Weapon {
  constructor(id = 'ice') { super(id); }

  fire(world, target, owner) {
    const player = owner;
    const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
    const count = this.stat('count');
    const damage = this.stat('damage');
    const effect = {
      freezeFactor: this.stat('freezeFactor'),
      freezeTime: this.stat('freezeTime'),
    };

    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * this.spec.spread;
      world.addProjectile(
        new IceShard(player.x, player.y, baseAngle + offset, this.spec.speed, damage, effect)
      );
    }
    world.audio.freeze();
  }
}

// ⚔️ Световой меч — взмах дугой в сторону ближайшего зомби.
// Единственное оружие без снарядов: бьёт сразу всех, кто попал в сектор.
class LightSaber extends Weapon {
  constructor(id = 'saber') { super(id); }

  fire(world, target, owner) {
    const player = owner;
    const angle = Math.atan2(target.y - player.y, target.x - player.x);
    const reach = this.stat('reach');
    const arc = this.stat('arc');
    const damage = this.stat('damage');

    for (const enemy of [...world.enemies]) {
      if (!enemy.alive) continue;
      const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (dist > reach + enemy.radius) continue;

      const toEnemy = Math.atan2(enemy.y - player.y, enemy.x - player.x);
      if (Math.abs(angleDifference(toEnemy, angle)) > arc / 2) continue;

      world.damageEnemy(enemy, damage);
      enemy.applyKnockback(player.x, player.y, 240);
    }

    world.particles.addSlash(player.x, player.y, angle, reach, arc);
    world.audio.slash();
  }
}

// Разница между углами в диапазоне -PI..PI — нужна, чтобы понять,
// попал ли зомби в сектор взмаха.
function angleDifference(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

// 👁 Лазерные глаза — луч в ближайшего зомби, прожигает всех на линии.
//
// Снарядов не создаёт: это тот же приём, что у меча, только сектор заменён
// отрезком, а разовый взмах — таймером прожига. Своя сущность-луч
// потребовала бы второй ветки в collisions.js (там только круг с кругом)
// ради одного оружия, а частые снаряды отдали бы урон на откуп частоте
// кадров: одна и та же капля била бы одного зомби каждый кадр полёта.
class LaserEyes extends Weapon {
  constructor(id = 'laser') {
    super(id);
    this.burnTimer = 0;
    this.beamOn = false;
    this.beamLen = 0;
  }

  update(dt, world, owner) {
    const target = world.findNearestEnemy(owner.x, owner.y);
    const wasOn = this.beamOn;
    this.beamOn = Boolean(target);
    if (!target) return;

    this.aimAt(owner, target);
    // Луч всегда во всю дальность, а не до первой цели: он затем и нужен,
    // чтобы прожигать очередь насквозь. Обрезание по ближайшему зомби
    // превращало его в обычный выстрел.
    this.beamLen = this.stat('range');
    // Звук — только на включении луча: тик раз в 0.22 сек превратил бы его
    // в пулемёт.
    if (!wasOn) world.audio.beam();

    this.burnTimer -= dt;      // dt уже умножен на fireRateFactor (турбо)
    if (this.burnTimer > 0) return;
    this.burnTimer = this.stat('cooldown');
    this.burn(world, owner);

    // setActiveWeapon намеренно не зовём: ствола в руке у лазера нет, и
    // перехват руки на 0.35 сек показал бы ребёнку пустые ладони вместо
    // его пистолета. Вертушка молчит по той же причине.
  }

  burn(world, owner) {
    const damage = this.stat('damage');
    const half = this.spec.beamWidth / 2;
    // Урон считаем по одной линии из середины между глазами, хотя рисуем два
    // луча: они сходятся в одной точке, и на дистанции различить их нельзя.
    // Две линии удвоили бы код и тюнинг ради невидимой разницы.
    //
    // Раньше линия начиналась на 0.55r — то есть на подбородке. Подъём до
    // уровня глаз двигает начало на 6 px вверх: это меньше полуширины луча
    // (4.5 px) и много меньше радиуса зомби, баланс не трогает. Записано,
    // чтобы никто не искал в этом причину при следующем прогоне сетки.
    const eye = this.eyeCenter(owner);
    const ex = eye.x + Math.cos(this.aimAngle) * this.beamLen;
    const ey = eye.y + Math.sin(this.aimAngle) * this.beamLen;

    // Сортируем по удалению от героя: иначе maxTargets отрежет случайных,
    // а не первых на линии.
    const onBeam = world.enemies
      .filter((e) => e.alive && !e.isHidden
        && distanceToSegment(e.x, e.y, eye.x, eye.y, ex, ey) < half + e.radius)
      .sort((a, b) => Math.hypot(a.x - owner.x, a.y - owner.y)
        - Math.hypot(b.x - owner.x, b.y - owner.y))
      .slice(0, this.stat('maxTargets'));

    for (const enemy of onBeam) {
      world.damageEnemy(enemy, damage);
      world.particles.addBurst(enemy.x, enemy.y, 4, 0.5);
    }
  }

  // Целимся от глаз, а не от центра героя: глаза на 17 px выше, и по зомби
  // вплотную луч уходил бы заметно мимо.
  aimAt(owner, target) {
    const eye = this.eyeCenter(owner);
    this.aimAngle = Math.atan2(target.y - eye.y, target.x - eye.x);
  }

  // Глаза героя в мировых координатах. Player.draw рисует оружие ПОСЛЕ
  // restore(), то есть вне translate/scale героя, поэтому зеркало и
  // покачивание считает за нас heroEyePoints.
  eyes(player) {
    return heroEyePoints(player).map((p) => ({ x: player.x + p.x, y: player.y + p.y }));
  }

  eyeCenter(player) {
    const [left, right] = this.eyes(player);
    return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  }

  draw(ctx, player) {
    // Упавший герой не обновляет оружие вовсе (Player.update выходит раньше),
    // поэтому beamOn застывает в последнем значении — без этой проверки над
    // призраком висел бы примёрзший луч.
    if (!this.beamOn || player.downed) return;
    const eye = this.eyeCenter(player);
    const ex = eye.x + Math.cos(this.aimAngle) * this.beamLen;
    const ey = eye.y + Math.sin(this.aimAngle) * this.beamLen;

    // Цвет берётся по звёздам: на пятой луч фиолетовый. Прокачка должна быть
    // ВИДНА — числа ребёнок не читает.
    const core = this.stat('beamColor');
    ctx.save();
    ctx.lineCap = 'round';
    // По лучу из каждого глаза — иначе это «лазер», а не «лазерные глаза».
    // Оба сходятся в одной точке, так что вдали пара читается как один луч.
    // Слои тоньше прежних: две линии рядом и так дают нужную толщину.
    for (const from of this.eyes(player)) {
      [[this.spec.beamWidth * 0.6, this.stat('beamGlow')], [2.6, core], [1.2, '#ffffff']]
        .forEach(([width, color]) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        });
      // Светящийся зрачок — это и есть «оружие в руке» для лазера.
      ctx.fillStyle = core;
      circle(ctx, from.x, from.y, 3);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    circle(ctx, ex, ey, 4);
    ctx.restore();
  }
}

// 🪃 Бумеранг — улетает и возвращается, задевая всех дважды.
class BoomerangThrower extends Weapon {
  constructor(id = 'boomerang') { super(id); }

  fire(world, target, owner) {
    const base = Math.atan2(target.y - owner.y, target.x - owner.x);
    const count = this.stat('count');
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * this.spec.spread;
      world.addProjectile(new Boomerang(owner, base + offset, {
        speed: this.spec.speed,
        returnSpeed: this.spec.returnSpeed,
        range: this.stat('range'),
        damage: this.stat('damage'),
        life: this.spec.life,
      }));
    }
    world.audio.slash();
  }
}

// 🐝 Рой пчёл — вылетают широко и сами разбирают цели.
class BeeSwarm extends Weapon {
  constructor(id = 'bees') { super(id); }

  fire(world, target, owner) {
    const base = Math.atan2(target.y - owner.y, target.x - owner.x);
    const count = this.stat('count');
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * this.spec.spread / Math.max(1, count - 1);
      world.addProjectile(new Bee(owner.x, owner.y, base + offset, {
        speed: this.spec.speed,
        turnSpeed: this.spec.turnSpeed,
        damage: this.stat('damage'),
        life: this.spec.life,
        retarget: this.spec.retarget,
      }));
    }
    world.audio.buzz();
  }
}

// 🕸 Паутина — оружие Человека-паука. Стреляет комками, комок падает и
// оставляет липкое пятно.
//
// Замедление не заводит у зомби нового состояния: Zombie.freeze(factor,
// duration) уже делает ровно «медленнее во столько на столько секунд», и мы
// зовём её коротким импульсом каждый кадр, пока зомби в пятне. Вышел —
// импульс не продлевается, и он разгоняется сам.
// 🔥 Огненный след: горит там, где герой пробежал.
//
// Единственное оружие, которое вообще не целится — ни цели, ни выстрела у него
// нет. Поэтому у него свой update(): базовый ничего бы не делал, пока на
// экране нет зомби, а след обязан тянуться всегда.
//
// setActiveWeapon не зовём намеренно: ствола в руке нет, и перехват руки
// показал бы ребёнку пустые ладони вместо его пистолета. Тем же живут лазер и
// вертушка.
class FireTrail extends Weapon {
  constructor(id = 'firetrail') {
    super(id);
    this.patches = [];   // пятна живут в оружии, как у паутины
  }

  update(dt, world, owner) {
    this.cooldownTimer -= dt;
    // Пятна тикают всегда, даже когда герой упал: физичнее, чем гасить их
    // разом, и заодно снимает грабли «упавший герой не гасит свой эффект».
    this.updatePatches(dt, world);
    if (this.cooldownTimer > 0 || owner.downed) return;
    this.drop(owner);
    this.cooldownTimer = this.stat('cooldown');
  }

  drop(owner) {
    // Куда смотрит след. Берём направление от прошлого отпечатка к этому:
    // герой мог прийти откуда угодно, а owner.facing знает только «влево или
    // вправо» и для наклона следа не годится. Стоит на месте или это первый
    // отпечаток — оставляем прежний угол, иначе след крутнётся сам собой.
    const last = this.patches[this.patches.length - 1];
    const dx = last ? owner.x - last.x : 0;
    const dy = last ? owner.y - last.y : 0;
    const moved = Math.hypot(dx, dy) > 2;
    this.angle = moved ? Math.atan2(dy, dx) : (this.angle || 0);
    // Ноги чередуются — без этого выходит не пара следов, а дорожка из
    // одинаковых пятен.
    this.foot = -(this.foot || 1);

    this.patches.push({
      x: owner.x,
      y: owner.y,
      radius: this.stat('radius'),
      life: this.spec.patchLife,
      angle: this.angle,
      foot: this.foot,
    });
  }

  updatePatches(dt, world) {
    const dps = this.stat('burnDps');
    const burnTime = this.spec.burnTime;
    for (const patch of this.patches) patch.life -= dt;
    this.patches = this.patches.filter((patch) => patch.life > 0);

    for (const patch of this.patches) {
      for (const enemy of world.enemies) {
        if (!enemy.alive || enemy.isHidden) continue;
        // Эллипс, а не круг: пятно лежит на земле и нарисовано приплюснутым,
        // и зона обязана совпадать с картинкой.
        const dx = (enemy.x - patch.x) / patch.radius;
        const dy = (enemy.y - patch.y) / (patch.radius * this.spec.squash);
        if (dx * dx + dy * dy > 1) continue;
        // Поджигаем коротким импульсом, а не бьём напрямую: горение — уже
        // готовый статус, оно само тикает уроном через damageEnemy и само
        // рисует пламя на зомби. Прямой урон каждый кадр был бы и вдесятеро
        // сильнее, и невидим.
        enemy.ignite(dps, burnTime);
      }
    }
  }

  // drawGround, а не draw: след лежит на земле и обязан рисоваться ПОД
  // персонажами. Обычный draw вызывается после героя, и пламя накрывало бы
  // его самого — а он по своему следу бежит не переставая.
  drawGround(ctx) {
    for (const patch of this.patches) {
      drawFirePatch(ctx, patch, patch.radius, this.spec.patchLife, this.spec.squash);
    }
  }
}

// 🫧 Мыльные пузыри: ловят зомби и уносят вверх, пока тот не лопнет.
//
// Зомби выбывает не от урона, а от того, что его поймали, — но добивает его
// всё равно world.damageEnemy, иначе не засчитаются ни счётчик убитых, ни
// наклейка, ни заряд способности, ни медальки.
//
// Пойманный держится замораживанием с фактором 0 — тем же, чем «Мяу!» Котика
// останавливает толпу. Заводить зомби новое состояние ради этого не нужно.
class BubbleGun extends Weapon {
  constructor(id = 'bubbles') {
    super(id);
    this.caught = [];
  }

  update(dt, world, owner) {
    this.updateCaught(dt, world);
    super.update(dt, world, owner);
  }

  updateCaught(dt, world) {
    for (const held of this.caught) {
      held.life -= dt;
      if (!held.enemy.alive) { held.life = 0; continue; }
      // Пока держим — зомби стоит. Импульсом каждый кадр, как липкие пятна:
      // отпустили, и он поехал сам, продлевать нечего.
      held.enemy.freeze(0, 0.15, false);
    }
    for (const held of this.caught) {
      if (held.life > 0 || !held.enemy.alive) continue;
      world.particles.addBurst(held.enemy.x, held.enemy.y, 12, 1);
      world.damageEnemy(held.enemy, held.damage);
    }
    this.caught = this.caught.filter((held) => held.life > 0 && held.enemy.alive);
  }

  fire(world, target, owner) {
    const count = this.stat('count');
    const damage = this.stat('damage');
    const holdTime = this.stat('holdTime');
    const base = Math.atan2(target.y - owner.y, target.x - owner.x);
    for (let i = 0; i < count; i++) {
      const angle = base + (i - (count - 1) / 2) * 0.26;
      const bubble = new Bubble(owner.x, owner.y, angle, {
        speed: this.spec.speed,
        radius: this.spec.radius,
        onCatch: (enemy) => this.catchEnemy(enemy, damage, holdTime),
      });
      world.addProjectile(bubble);
    }
    world.audio.shoot();
  }

  catchEnemy(enemy, damage, holdTime) {
    // Уже в пузыре — второй на него не тратим: иначе залп из пяти уходит в
    // одного и того же, а толпа стоит нетронутой.
    if (this.caught.some((held) => held.enemy === enemy)) return false;
    this.caught.push({ enemy, damage, life: holdTime });
    return true;
  }

  draw(ctx, player) {
    for (const held of this.caught) {
      if (!held.enemy.alive) continue;
      // Пузырь обнимает зомби НА МЕСТЕ, а не всплывает над ним: поднимать
      // картинку, не поднимая самого зомби, выглядело как пустой пузырь рядом
      // с ним. Поднимать же зомби по-настоящему значит трогать столкновения и
      // порядок отрисовки ради одной анимации.
      drawCatchBubble(ctx, held.enemy.x, held.enemy.y - held.enemy.radius * 0.4,
        this.spec.radius, held.life);
    }
    super.draw(ctx, player);
  }
}

// 🌪 Торнадо: вихрь бродит по арене сам и тащит за собой зомби.
//
// От Портала Супер-Егора отличается тем, что ХОДИТ. Портал — точка на земле,
// от которой можно отойти; торнадо идёт за толпой, и отстать от него нельзя.
class TornadoGun extends Weapon {
  constructor(id = 'tornado') {
    super(id);
    this.vortex = null;
  }

  update(dt, world, owner) {
    this.updateVortex(dt, world);
    super.update(dt, world, owner);
  }

  updateVortex(dt, world) {
    const v = this.vortex;
    if (!v) return;
    v.life -= dt;
    if (v.life <= 0) { this.vortex = null; return; }
    v.spin += dt * 7;

    // Вихрь идёт к самой гуще. Цель пересматриваем не каждый кадр, а раз в
    // полсекунды: иначе он дёргается между двумя соседними зомби на месте.
    v.retarget -= dt;
    if (v.retarget <= 0) {
      v.retarget = 0.5;
      v.goal = crowdCenter(world) || { x: v.x, y: v.y };
    }
    const dx = v.goal.x - v.x;
    const dy = v.goal.y - v.y;
    const dist = Math.hypot(dx, dy) || 1;
    v.x += (dx / dist) * this.spec.speed * dt;
    v.y += (dy / dist) * this.spec.speed * dt;

    v.tick -= dt;
    const hits = v.tick <= 0;
    if (hits) v.tick = this.spec.tickTime;

    for (const enemy of [...world.enemies]) {
      if (!enemy.alive || enemy.isHidden) continue;
      const ex = v.x - enemy.x;
      const ey = v.y - enemy.y;
      const d = Math.hypot(ex, ey);
      if (d > v.radius) continue;
      // Тянем к центру. Босса не тянем — то же правило, что у Бэтмобиля и
      // расталкивания: он тяжёлый и важный.
      if (!enemy.isBoss) {
        enemy.x += (ex / (d || 1)) * this.spec.pull * dt;
        enemy.y += (ey / (d || 1)) * this.spec.pull * dt;
      }
      if (hits) world.damageEnemy(enemy, v.damage);
    }
  }

  fire(world, target, owner) {
    this.vortex = {
      x: owner.x, y: owner.y,
      radius: this.stat('radius'),
      damage: this.stat('damage'),
      life: this.spec.life,
      spin: 0, tick: 0, retarget: 0,
      goal: { x: target.x, y: target.y },
    };
    world.audio.whistle();
  }

  draw(ctx, player) {
    if (this.vortex) drawTornado(ctx, this.vortex, this.vortex.spin);
    super.draw(ctx, player);
  }
}

// Центр толпы. Медиана, а не среднее: среднее уводит вихрь в пустоту между
// двумя кучками. Пусто — null, и вихрь просто идёт дальше своим курсом.
function crowdCenter(world) {
  const xs = [];
  const ys = [];
  for (const enemy of world.enemies) {
    if (!enemy.alive || enemy.isHidden) continue;
    xs.push(enemy.x);
    ys.push(enemy.y);
  }
  if (!xs.length) return null;
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  const mid = Math.floor(xs.length / 2);
  return { x: xs[mid], y: ys[mid] };
}

class WebShooter extends Weapon {
  constructor(id = 'web') {
    super(id);
    this.patches = [];   // пятна живут в оружии, как кулдауны у вертушки
  }

  update(dt, world, owner) {
    this.updatePatches(dt, world);
    super.update(dt, world, owner);
  }

  updatePatches(dt, world) {
    const factor = this.spec.chillFactor;
    for (const patch of this.patches) patch.life -= dt;
    this.patches = this.patches.filter((patch) => patch.life > 0);

    for (const patch of this.patches) {
      for (const enemy of world.enemies) {
        if (!enemy.alive || enemy.isHidden) continue;
        // Эллипс, а не круг: пятно лежит на земле и нарисовано приплюснутым,
        // и зона должна совпадать с картинкой.
        const dx = (enemy.x - patch.x) / patch.radius;
        const dy = (enemy.y - patch.y) / (patch.radius * 0.55);
        if (dx * dx + dy * dy > 1) continue;
        // Без льда: паутина липкая, а не морозная.
        enemy.freeze(factor, 0.15, false);
      }
    }
  }

  fire(world, target) {
    const at = leadPoint(this.aimFrom, target, this.spec.speed);
    world.addProjectile(new WebGlob(this.aimFrom.x, this.aimFrom.y, at.x, at.y, {
      speed: this.spec.speed,
      damage: this.stat('damage'),
      onLand: (x, y) => this.land(world, x, y),
    }));
    world.audio.shoot();
  }

  // Запоминаем, откуда стрелять: fire получает мир и цель, а владельца — нет.
  aimAt(owner, target) {
    super.aimAt(owner, target);
    this.aimFrom = { x: owner.x, y: owner.y };
  }

  land(world, x, y) {
    const radius = this.stat('radius');
    this.patches.push({ x, y, radius, life: this.spec.patchLife, seed: this.patches.length });
    const damage = this.stat('damage');
    for (const enemy of [...world.enemies]) {
      if (!enemy.alive || enemy.isHidden) continue;
      if (Math.hypot(enemy.x - x, enemy.y - y) > radius) continue;
      world.damageEnemy(enemy, damage);
    }
  }

  draw(ctx, player) {
    for (const patch of this.patches) {
      drawWeb(ctx, patch, patch.radius, this.spec.patchLife);
    }
    super.draw(ctx, player);   // ствол в руке рисует базовый класс
  }
}

const WEAPON_CLASSES = {
  water: WaterGun,
  firetrail: FireTrail,
  lavatrail: FireTrail,
  bubbles: BubbleGun,
  bubblestorm: BubbleGun,
  tornado: TornadoGun,
  hurricane: TornadoGun,
  tomato: TomatoLauncher,
  // Эволюции, у которых меняется только арифметика, переиспользуют класс
  // родителя: id приходит параметром, а не зашит в super().
  //
  // ВАЖНО: класс-родитель обязан принимать id аргументом — `constructor(id =
  // 'water') { super(id) }`. Если он зашивает своё имя в super(), эволюция
  // молча создаётся с характеристиками РОДИТЕЛЯ: ничего не падает, игрок
  // просто не получает награду. Проверять надо выдачей, а не глазами.
  watercannon: WaterCannon,
  tomatocannon: TomatoLauncher,
  dualsaber: LightSaber,
  stormbolt: Lightning,
  cyclone: Spinner,
  carrotswarm: CarrotRocket,
  firestorm: Flamethrower,
  blizzard: IceCannon,
  wideray: LaserEyes,
  doubleboomerang: BoomerangThrower,
  hive: BeeSwarm,
  lightning: Lightning,
  spinner: Spinner,
  rocket: CarrotRocket,
  fire: Flamethrower,
  ice: IceCannon,
  saber: LightSaber,
  laser: LaserEyes,
  boomerang: BoomerangThrower,
  bees: BeeSwarm,
  web: WebShooter,
};

export function createWeapon(id) {
  const WeaponClass = WEAPON_CLASSES[id];
  if (!WeaponClass) throw new Error(`Неизвестное оружие: ${id}`);
  return new WeaponClass(id);   // эволюции переиспользуют класс родителя
}

// Что вообще можно выбрать и получить карточкой. Прячем два вида оружия:
// эволюции (они награда за пятую звезду) и именное — паутину, которая есть
// только у Человека-паука и другим героям не предлагается.
export const ALL_WEAPON_IDS = Object.keys(CONFIG.weapons)
  .filter((id) => !CONFIG.weapons[id].evolved && !CONFIG.weapons[id].signature);

// Обратная карта к CONFIG.weapons[*].evolution: «водомёт» → «водяной пистолет».
// Считаем из уже существующего поля, а не пишем руками: второй список тех же
// пар неизбежно разъедется с первым.
const EVOLUTION_PARENT = Object.fromEntries(
  Object.entries(CONFIG.weapons)
    .filter(([, spec]) => spec.evolution)
    .map(([id, spec]) => [spec.evolution, id]),
);

// Каким оружием эволюция была до превращения. Нужна везде, где спрашивают
// «а это у героя уже есть?»: после эволюции id меняется, и без приведения к
// родителю игра снова предлагала бы исходное оружие первого уровня.
export function baseWeaponId(id) {
  return EVOLUTION_PARENT[id] ?? id;
}

// Пятая звезда превращает оружие в улучшенное. Заменяем экземпляр, а не
// поднимаем флаг: флаг превратил бы восемь классов в шестнадцать веток
// `if (evolved)`, а «другое ощущение» требует другого кода стрельбы.
export function evolveWeapon(weapon) {
  const nextId = CONFIG.weapons[weapon.id]?.evolution;
  if (!nextId) return weapon;          // эволюции нет — оружие просто максится
  const evolved = createWeapon(nextId);
  evolved.stars = CONFIG.maxStars;     // звёзды ей уже ничего не значат
  return evolved;
}

// Куда стрелять с упреждением: точка, где цель окажется, когда снаряд долетит.
//
// Нужно только навесным снарядам — тем, что летят в ТОЧКУ, а не в цель. Пуля
// быстрая, а ракета и пчела доворачивают на лету и промахнуться не могут;
// комок паутины же летит в заранее выбранное место, и без упреждения он всегда
// падает туда, где зомби только что был.
//
// Считаем итерацией: время полёта зависит от точки, а точка — от времени
// полёта. Двух проходов хватает с запасом — цель за это время не разгоняется.
export function leadPoint(from, target, speed) {
  let x = target.x;
  let y = target.y;
  for (let i = 0; i < 2; i++) {
    const flight = Math.hypot(x - from.x, y - from.y) / speed;
    x = target.x + (target.vx || 0) * flight;
    y = target.y + (target.vy || 0) * flight;
  }
  return { x, y };
}

// Расстояние от точки до отрезка — «попал ли зомби на луч».
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
