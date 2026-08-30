// Снаряды. Три вида поведения:
//   Bullet — летит прямо и бьёт первого встречного (водяной пистолет)
//   Lob    — летит по дуге в точку и взрывается по площади (помидор)
//   Rocket — доворачивает к цели, взрывается при попадании (ракета-морковка)
// Урон по контакту считает systems/collisions.js (у кого damagesOnContact = true).

import { circle, roundRect } from '../render/sprites.js';

const OFFSCREEN_MARGIN = 60;

class Projectile {
  constructor(x, y, damage) {
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.alive = true;
    this.damagesOnContact = false;
    this.radius = 6;
  }

  // Стихийные снаряды вешают эффект на зомби; обычные ничего не делают.
  onHit() {}

  isOffscreen({ width, height }) {
    return this.x < -OFFSCREEN_MARGIN || this.x > width + OFFSCREEN_MARGIN
      || this.y < -OFFSCREEN_MARGIN || this.y > height + OFFSCREEN_MARGIN;
  }
}

// --- Водяная капля: летит прямо, исчезает при попадании ---
export class Bullet extends Projectile {
  constructor(x, y, angle, speed, damage) {
    super(x, y, damage);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = 7;
    this.damagesOnContact = true;
    this.trail = [];
  }

  update(dt, world) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.isOffscreen(world.arena)) this.alive = false;
  }

  draw(ctx) {
    ctx.save();
    // Хвостик из капель — видно, куда полетело
    this.trail.forEach((p, i) => {
      ctx.fillStyle = `rgba(90, 180, 255, ${0.12 * (i + 1)})`;
      circle(ctx, p.x, p.y, this.radius * (0.4 + i * 0.12));
    });
    ctx.fillStyle = '#4fb3ff';
    circle(ctx, this.x, this.y, this.radius);
    ctx.fillStyle = '#bfe6ff';
    circle(ctx, this.x - 2, this.y - 2, this.radius * 0.4);
    ctx.restore();
  }
}

// --- Язык пламени: бьёт и поджигает, живёт недолго ---
export class FlameBolt extends Bullet {
  constructor(x, y, angle, speed, damage, { burnDps, burnTime, range }) {
    super(x, y, angle, speed, damage);
    this.burnDps = burnDps;
    this.burnTime = burnTime;
    this.distanceLeft = range;
    this.radius = 9;
    this.flicker = Math.random() * Math.PI * 2;
  }

  update(dt, world) {
    super.update(dt, world);
    this.flicker += dt * 18;
    // Пламя гаснет на лету — огнемёт бьёт только вблизи.
    this.distanceLeft -= Math.hypot(this.vx, this.vy) * dt;
    if (this.distanceLeft <= 0) this.alive = false;
  }

  onHit(enemy) {
    enemy.ignite(this.burnDps, this.burnTime);
  }

  draw(ctx) {
    const wobble = 1 + Math.sin(this.flicker) * 0.22;
    ctx.save();
    this.trail.forEach((p, i) => {
      ctx.fillStyle = `rgba(255, 140, 40, ${0.1 * (i + 1)})`;
      circle(ctx, p.x, p.y, this.radius * (0.5 + i * 0.1));
    });
    ctx.fillStyle = '#ff8a2b';
    circle(ctx, this.x, this.y, this.radius * wobble);
    ctx.fillStyle = '#ffd93d';
    circle(ctx, this.x, this.y, this.radius * 0.55 * wobble);
    ctx.restore();
  }
}

// --- Ледяной осколок: бьёт и замораживает ---
export class IceShard extends Bullet {
  constructor(x, y, angle, speed, damage, { freezeFactor, freezeTime }) {
    super(x, y, angle, speed, damage);
    this.freezeFactor = freezeFactor;
    this.freezeTime = freezeTime;
    this.radius = 8;
    this.spin = Math.random() * Math.PI;
  }

  update(dt, world) {
    super.update(dt, world);
    this.spin += dt * 6;
  }

  onHit(enemy, world) {
    enemy.freeze(this.freezeFactor, this.freezeTime);
    world.particles.addBurst(enemy.x, enemy.y, 5, 0.5);
  }

  draw(ctx) {
    ctx.save();
    this.trail.forEach((p, i) => {
      ctx.fillStyle = `rgba(150, 225, 255, ${0.1 * (i + 1)})`;
      circle(ctx, p.x, p.y, this.radius * (0.4 + i * 0.1));
    });
    ctx.translate(this.x, this.y);
    ctx.rotate(this.spin);
    // Шестилучевая снежинка
    ctx.strokeStyle = '#eafaff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(-this.radius, 0);
      ctx.lineTo(this.radius, 0);
      ctx.stroke();
    }
    ctx.fillStyle = '#7fd8ff';
    circle(ctx, 0, 0, this.radius * 0.45);
    ctx.restore();
  }
}

// --- Помидор: летит по дуге в заранее выбранную точку и взрывается ---
export class Lob extends Projectile {
  constructor(x, y, targetX, targetY, flightTime, damage, blastRadius) {
    super(x, y, damage);
    this.startX = x;
    this.startY = y;
    this.targetX = targetX;
    this.targetY = targetY;
    this.flightTime = flightTime;
    this.elapsed = 0;
    this.blastRadius = blastRadius;
    this.radius = 12;
  }

  update(dt, world) {
    this.elapsed += dt;
    const t = Math.min(1, this.elapsed / this.flightTime);
    this.x = this.startX + (this.targetX - this.startX) * t;
    this.y = this.startY + (this.targetY - this.startY) * t;
    // Подскок по параболе — визуальная «высота» полёта
    this.hopHeight = Math.sin(t * Math.PI) * 60;

    if (t >= 1) {
      this.alive = false;
      world.explode(this.x, this.y, this.blastRadius, this.damage, 'tomato');
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y - (this.hopHeight || 0));
    ctx.rotate(this.elapsed * 8);
    ctx.fillStyle = '#e34b3a';
    circle(ctx, 0, 0, this.radius);
    ctx.fillStyle = '#4caf50';
    circle(ctx, 0, -this.radius * 0.9, this.radius * 0.35);
    ctx.restore();
  }
}

// --- Пробивающая струя водомёта: не умирает на первом попадании ---
export class PiercingBullet extends Bullet {
  constructor(x, y, angle, speed, damage, pierce) {
    super(x, y, angle, speed, damage);
    this.pierce = pierce;
    // Кого уже задели — иначе струя била бы одного и того же зомби каждый
    // кадр, пока пролетает сквозь него. Тот же приём, что у молнии.
    this.hitEnemies = new Set();
  }

  // Столкновения гасят обычный снаряд после попадания; струя гасит себя сама,
  // когда пробила достаточно.
  onHit(enemy) {
    this.hitEnemies.add(enemy);
    this.pierce -= 1;
    if (this.pierce <= 0) this.alive = false;
  }

  get piercing() {
    return true;
  }

  alreadyHit(enemy) {
    return this.hitEnemies.has(enemy);
  }
}

// --- Ракета-морковка: самонаводится и взрывается на цели ---
export class Rocket extends Projectile {
  constructor(x, y, angle, speed, turnSpeed, damage, blastRadius) {
    super(x, y, damage);
    this.angle = angle;
    this.speed = speed;
    this.turnSpeed = turnSpeed;
    this.blastRadius = blastRadius;
    this.radius = 11;
    this.life = 4; // секунд, чтобы ракета не летала вечно
  }

  update(dt, world) {
    this.life -= dt;
    if (this.life <= 0) {
      this.alive = false;
      world.explode(this.x, this.y, this.blastRadius, this.damage, 'rocket');
      return;
    }

    // Плавный доворот к ближайшему зомби
    const target = world.findNearestEnemy(this.x, this.y);
    if (target) this.angle = steerToward(this.angle, this, target, this.turnSpeed, dt);

    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;

    if (target && Math.hypot(target.x - this.x, target.y - this.y) < target.radius + this.radius) {
      this.alive = false;
      world.explode(this.x, this.y, this.blastRadius, this.damage, 'rocket');
      return;
    }
    if (this.isOffscreen(world.arena)) this.alive = false;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    // Огонёк позади
    ctx.fillStyle = '#ffb703';
    circle(ctx, -this.radius, 0, this.radius * 0.5);
    // Тело-морковка
    ctx.fillStyle = '#ff8c1a';
    ctx.beginPath();
    ctx.moveTo(this.radius * 1.4, 0);
    ctx.lineTo(-this.radius * 0.6, -this.radius * 0.6);
    ctx.lineTo(-this.radius * 0.6, this.radius * 0.6);
    ctx.closePath();
    ctx.fill();
    // Ботва
    ctx.fillStyle = '#4caf50';
    circle(ctx, -this.radius * 0.7, 0, this.radius * 0.4);
    ctx.restore();
  }
}

// Плавный доворот к цели — общий для ракеты и пчелы.
export function steerToward(angle, from, to, turnSpeed, dt) {
  const desired = Math.atan2(to.y - from.y, to.x - from.x);
  let diff = desired - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const maxTurn = turnSpeed * dt;
  return angle + Math.max(-maxTurn, Math.min(maxTurn, diff));
}

// --- Бумеранг: улетает вперёд, разворачивается и возвращается к хозяину ---
export class Boomerang extends Projectile {
  // owner — конкретный герой, а не world.player: вдвоём бумеранг второго
  // обязан вернуться ко второму.
  constructor(owner, angle, { speed, returnSpeed, range, damage, life }) {
    super(owner.x, owner.y, damage);
    this.owner = owner;
    this.angle = angle;
    this.speed = speed;
    this.returnSpeed = returnSpeed;
    this.range = range;
    this.life = life;
    this.radius = 12;
    this.spin = 0;
    this.travelled = 0;
    this.phase = 'out';
    this.damagesOnContact = true;
    // Кого уже задели на этом отрезке пути. На развороте множество
    // очищается — это и есть «задевает дважды».
    this.hitEnemies = new Set();
  }

  get piercing() { return true; }
  alreadyHit(enemy) { return this.hitEnemies.has(enemy); }
  onHit(enemy) { this.hitEnemies.add(enemy); }

  update(dt, world) {
    this.life -= dt;
    this.spin += dt * 14;
    // Три предохранителя от «улетел и не вернулся»: таймаут, скорость
    // возврата выше бега героя и мгновенный таймаут, если хозяин упал.
    if (this.life <= 0 || (this.phase === 'back' && this.owner.downed)) {
      this.alive = false;
      world.particles.addBurst(this.x, this.y, 5, 0.6);
      return;
    }

    if (this.phase === 'out') {
      const step = this.speed * dt;
      this.travelled += step;
      this.x += Math.cos(this.angle) * step;
      this.y += Math.sin(this.angle) * step;
      if (this.travelled >= this.range) {
        this.phase = 'back';
        this.hitEnemies.clear();   // обратный путь считается заново
      }
      return;
    }

    this.angle = steerToward(this.angle, this, this.owner, 9, dt);
    const step = this.returnSpeed * dt;
    this.x += Math.cos(this.angle) * step;
    this.y += Math.sin(this.angle) * step;
    // Долетел до хозяина — поймал.
    if (Math.hypot(this.owner.x - this.x, this.owner.y - this.y) < this.owner.radius + 6) {
      this.alive = false;
    }
    // isOffscreen намеренно не проверяем: она убила бы бумеранг, который уже
    // развернулся и летит назад из-за края. От вечного полёта страхует life.
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.spin);
    ctx.strokeStyle = '#c98b3a';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-9, 5);
    ctx.quadraticCurveTo(0, -8, 9, 5);
    ctx.stroke();
    ctx.strokeStyle = '#f0c079';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

// --- Пчела: маленькая и вертлявая, живёт недолго, жалит один раз ---
//
// Отдельный класс, а не ракета с другими числами: Rocket на любой смерти
// зовёт world.explode() — кольцо, урон по площади и грохот. Пчела должна
// тихо истаять от старости, а это уже другая механика, не другие числа.
export class Bee extends Projectile {
  constructor(x, y, angle, { speed, turnSpeed, damage, life, retarget }) {
    super(x, y, damage);
    this.angle = angle;
    this.speed = speed;
    this.turnSpeed = turnSpeed;
    this.life = life;
    this.retarget = retarget;
    this.retargetTimer = 0;
    this.target = null;
    this.wobble = Math.random() * Math.PI * 2;
    this.radius = 7;
    this.damagesOnContact = true;
  }

  update(dt, world) {
    this.life -= dt;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }

    // Цель пересматриваем раз в retarget секунд, а не каждый кадр: иначе
    // шесть пчёл летят идеально синхронно одной точкой и рой не читается.
    this.retargetTimer -= dt;
    if (!this.target?.alive || this.retargetTimer <= 0) {
      this.retargetTimer = this.retarget;
      this.target = world.findNearestEnemy(this.x, this.y);
    }
    if (this.target) this.angle = steerToward(this.angle, this, this.target, this.turnSpeed, dt);

    this.wobble += dt * 12;
    const angle = this.angle + Math.sin(this.wobble) * 0.5;   // рой обязан вилять
    this.x += Math.cos(angle) * this.speed * dt;
    this.y += Math.sin(angle) * this.speed * dt;
    if (this.isOffscreen(world.arena)) this.alive = false;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = '#ffd93d';
    circle(ctx, 0, 0, 5);
    ctx.fillStyle = '#3b3b46';
    roundRect(ctx, -1.5, -5, 3, 10, 1.2);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    const flap = Math.sin(this.wobble * 3) * 2;
    ctx.beginPath();
    ctx.ellipse(-5, -2 + flap, 4, 2.2, -0.5, 0, Math.PI * 2);
    ctx.ellipse(5, -2 - flap, 4, 2.2, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// --- Торт клоуна: летит навесом в точку, где стоял герой, и шлёпается ---
//
// Отдельный класс, а не Lob: тот на приземлении зовёт world.explode(),
// который бьёт врагов. Здесь всё наоборот — достаётся героям.
// 🕷 Паучок из полчища Человека-паука.
//
// Наследник пчелы — самонаведение, ограниченная жизнь и тихое угасание у него
// те же. Отличий два, и оба нужны, чтобы полчище не читалось вторым роем:
// укус ещё и замедляет (тот же freeze, что у паутины), и бежит он по земле,
// а не порхает.
export class SpiderMinion extends Bee {
  constructor(x, y, angle, opts) {
    super(x, y, angle, opts);
    this.chillFactor = opts.chillFactor;
    this.chillTime = opts.chillTime;
    this.radius = 6;
  }

  onHit(enemy) {
    // Без льда: паучок кусает и опутывает, а не морозит.
    enemy.freeze(this.chillFactor, this.chillTime, false);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    // Лапки перебирают — по той же фазе, что у пчелы махали крылья.
    ctx.strokeStyle = '#2a2438';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    [-1, 1].forEach((side) => {
      [-3, 0, 3].forEach((dy, i) => {
        const step = Math.sin(this.wobble * 3 + i) * 1.6;
        ctx.beginPath();
        ctx.moveTo(side * 2, dy);
        ctx.lineTo(side * 7, dy + step);
        ctx.stroke();
      });
    });
    ctx.fillStyle = '#3b3350';
    circle(ctx, 0, -2, 2.6);
    circle(ctx, 0, 2, 3.6);
    ctx.fillStyle = '#c8b6ff';
    circle(ctx, -1.2, -2.6, 0.9);
    circle(ctx, 1.2, -2.6, 0.9);
    ctx.restore();
  }
}

// 🕸 Комок паутины: летит по дуге в точку и оставляет там пятно.
//
// Про само пятно снаряд ничего не знает — он только зовёт onLand. Список
// пятен держит оружие (см. WebShooter), как вертушка держит свои кулдауны:
// заводить ради них сущность в мире было бы лишним.
export class WebGlob extends Projectile {
  constructor(x, y, targetX, targetY, { speed, damage, onLand }) {
    super(x, y, damage);
    this.startX = x;
    this.startY = y;
    this.targetX = targetX;
    this.targetY = targetY;
    this.flightTime = Math.max(0.12, Math.hypot(targetX - x, targetY - y) / speed);
    this.elapsed = 0;
    this.onLand = onLand;
    this.radius = 9;
  }

  update(dt) {
    this.elapsed += dt;
    const t = Math.min(1, this.elapsed / this.flightTime);
    this.x = this.startX + (this.targetX - this.startX) * t;
    this.y = this.startY + (this.targetY - this.startY) * t;
    this.hopHeight = Math.sin(t * Math.PI) * 44;
    if (t < 1) return;
    this.alive = false;
    this.onLand(this.x, this.y);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y - (this.hopHeight || 0));
    ctx.rotate(this.elapsed * 9);
    ctx.fillStyle = '#e8e8f5';
    circle(ctx, 0, 0, this.radius);
    ctx.strokeStyle = 'rgba(140,140,170,0.8)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(a) * this.radius, -Math.sin(a) * this.radius);
      ctx.lineTo(Math.cos(a) * this.radius, Math.sin(a) * this.radius);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export class CakeLob extends Projectile {
  constructor(x, y, targetX, targetY, flightTime, blastRadius) {
    super(x, y, 0);
    this.startX = x;
    this.startY = y;
    this.targetX = targetX;
    this.targetY = targetY;
    this.flightTime = flightTime;
    this.blastRadius = blastRadius;
    this.elapsed = 0;
    this.hop = 0;
    this.spin = 0;
    this.radius = 14;
  }

  update(dt, world) {
    this.elapsed += dt;
    this.spin += dt * 6;
    const t = Math.min(1, this.elapsed / this.flightTime);
    this.x = this.startX + (this.targetX - this.startX) * t;
    this.y = this.startY + (this.targetY - this.startY) * t;
    this.hop = Math.sin(t * Math.PI) * 90;
    if (t < 1) return;
    this.alive = false;
    world.splat(this.targetX, this.targetY, this.blastRadius);
  }

  draw(ctx) {
    // Мишень в точке падения рисует не снаряд, а частица-телеграф — см.
    // Boss.updateCakes. Здесь только сам летящий торт.
    ctx.save();
    ctx.translate(this.x, this.y - this.hop);
    ctx.rotate(this.spin);
    ctx.fillStyle = '#ffd7e6';
    circle(ctx, 0, 0, 11);
    ctx.fillStyle = '#e34b3a';
    circle(ctx, 0, -5, 4);
    ctx.restore();
  }
}
