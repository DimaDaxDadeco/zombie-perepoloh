// Снаряды. Три вида поведения:
//   Bullet — летит прямо и бьёт первого встречного (водяной пистолет)
//   Lob    — летит по дуге в точку и взрывается по площади (помидор)
//   Rocket — доворачивает к цели, взрывается при попадании (ракета-морковка)
// Урон по контакту считает systems/collisions.js (у кого damagesOnContact = true).

import { circle } from '../render/sprites.js';

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
    if (target) {
      const desired = Math.atan2(target.y - this.y, target.x - this.x);
      let diff = desired - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = this.turnSpeed * dt;
      this.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
    }

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
