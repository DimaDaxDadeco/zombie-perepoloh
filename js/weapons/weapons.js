// Одиннадцать видов оружия. Как добавить своё — см. docs/weapons.md.

import { CONFIG } from '../config.js';
import { Weapon } from './weapon.js';
import {
  Bullet, Lob, Rocket, FlameBolt, IceShard, PiercingBullet, Boomerang, Bee,
} from '../entities/projectile.js';
import { circle } from '../render/sprites.js';

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
  constructor() { super('lightning'); }

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
  constructor() {
    super('spinner');
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
    const orbit = this.stat('orbit');
    const positions = [];
    for (let i = 0; i < blades; i++) {
      const a = this.angle + (i * Math.PI * 2) / blades;
      positions.push({ x: player.x + Math.cos(a) * orbit, y: player.y + Math.sin(a) * orbit });
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
  constructor() { super('rocket'); }

  fire(world, target, owner) {
    const player = owner;
    const angle = Math.atan2(target.y - player.y, target.x - player.x);
    world.addProjectile(new Rocket(
      player.x, player.y, angle,
      this.spec.speed, this.spec.turnSpeed,
      this.stat('damage'), this.stat('radius'),
    ));
  }
}

// 🔥 Огнемёт — короткая струя пламени, поджигает всех, кого задела.
class Flamethrower extends Weapon {
  constructor() { super('fire'); }

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
  constructor() { super('ice'); }

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
  constructor() {
    super('laser');
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
    const ex = owner.x + Math.cos(this.aimAngle) * this.beamLen;
    const ey = owner.y + Math.sin(this.aimAngle) * this.beamLen;

    // Сортируем по удалению от героя: иначе maxTargets отрежет случайных,
    // а не первых на линии.
    const onBeam = world.enemies
      .filter((e) => e.alive && !e.isHidden
        && distanceToSegment(e.x, e.y, owner.x, owner.y, ex, ey) < half + e.radius)
      .sort((a, b) => Math.hypot(a.x - owner.x, a.y - owner.y)
        - Math.hypot(b.x - owner.x, b.y - owner.y))
      .slice(0, this.stat('maxTargets'));

    for (const enemy of onBeam) {
      world.damageEnemy(enemy, damage);
      world.particles.addBurst(enemy.x, enemy.y, 4, 0.5);
    }
  }

  draw(ctx, player) {
    if (!this.beamOn) return;
    const x = player.x;
    const y = player.y - player.radius * 0.55;    // из глаз, а не из живота
    const ex = x + Math.cos(this.aimAngle) * this.beamLen;
    const ey = y + Math.sin(this.aimAngle) * this.beamLen;

    ctx.save();
    ctx.lineCap = 'round';
    [[this.spec.beamWidth, 'rgba(255,80,80,0.35)'], [4, '#ff4d6d'], [1.6, '#ffffff']]
      .forEach(([width, color]) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      });
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    circle(ctx, ex, ey, 4);
    // Светящиеся глаза — это и есть «оружие в руке» для лазера.
    ctx.fillStyle = '#ff4d6d';
    circle(ctx, x - player.radius * 0.18, y, 3);
    circle(ctx, x + player.radius * 0.18, y, 3);
    ctx.restore();
  }
}

// 🪃 Бумеранг — улетает и возвращается, задевая всех дважды.
class BoomerangThrower extends Weapon {
  constructor() { super('boomerang'); }

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

const WEAPON_CLASSES = {
  water: WaterGun,
  tomato: TomatoLauncher,
  // Эволюции, у которых меняется только арифметика, переиспользуют класс
  // родителя: id приходит параметром, а не зашит в super().
  watercannon: WaterCannon,
  tomatocannon: TomatoLauncher,
  dualsaber: LightSaber,
  lightning: Lightning,
  spinner: Spinner,
  rocket: CarrotRocket,
  fire: Flamethrower,
  ice: IceCannon,
  saber: LightSaber,
  laser: LaserEyes,
  boomerang: BoomerangThrower,
  bees: BeeSwarm,
};

export function createWeapon(id) {
  const WeaponClass = WEAPON_CLASSES[id];
  if (!WeaponClass) throw new Error(`Неизвестное оружие: ${id}`);
  return new WeaponClass(id);   // эволюции переиспользуют класс родителя
}

// Эволюции существуют только как награда за пятую звезду: ни в выборе
// стартового оружия, ни в карточках «новое оружие» им не место.
export const ALL_WEAPON_IDS = Object.keys(CONFIG.weapons)
  .filter((id) => !CONFIG.weapons[id].evolved);

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
