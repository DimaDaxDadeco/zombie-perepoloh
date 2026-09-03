// Воришка: зомби, который УБЕГАЕТ с добычей, а не идёт навстречу.
//
// Зомби, а не проп, намеренно: оружие целится в enemies, и будь воришка
// пропом, ребёнок стрелял бы в пустоту и решил, что игра сломалась.
//
// Три предохранителя, без которых глава непроходима мечом и огнемётом — а
// правило «ни один выбор не должен быть проигрышным» распространяется на все
// четырнадцать стволов:
//
//   1. он МЕДЛЕННЕЕ любого героя, и скорость считается от реальных игроков
//      раунда, а не от базовой константы: иначе Халк со своим минусом к
//      скорости не догнал бы его никогда;
//   2. он ВЫДЫХАЕТСЯ: побегал — стоит и пыхтит. Это и делает поимку
//      гарантированной при любом оружии, и читается смешно, а не страшно;
//   3. ПОВОДОК: дальше него он не убегает. Без поводка он уходит в угол и
//      живёт там до конца раунда.
//
// И четвёртое, самое важное: убить его НЕЛЬЗЯ. takeDamage всегда возвращает
// false, а попадание вместо урона спотыкает его и вытряхивает монетку. Так
// все четырнадцать оружий делают ровно одно и то же, и ни одно не даёт
// преимущества. Если бы воришка умел умирать, взрыв ракеты или ярость Халка
// делали бы главу непроходимой — молча.

import { CONFIG } from '../config.js';
import { Zombie } from './zombie.js';
import { Pickup, PickupType } from './pickup.js';
import { drawLoot } from '../render/sprites.js';

// Сколько направлений перебирать. Шестнадцати хватает: шаг в 22 градуса
// глазом уже не отличить от плавного поворота.
const TURNS = 16;

export class Thief extends Zombie {
  constructor(x, y, spec, world, onCatch) {
    const base = CONFIG.zombieTypes[0];
    super(x, y, {
      hp: 999,                       // не для живучести: он просто не умирает
      speed: Math.min(...world.players.map((p) => p.speed)) * spec.speedFactor,
      radius: CONFIG.zombie.radius,
      look: { ...base.look, clothes: '#6d4c41', skin: '#9ccc65' },
      type: base,
    });
    this.spec = spec;
    this.onCatch = onCatch;
    // Столкновение с ним НЕ кусает: его ловят, а не он ест.
    this.harmless = true;
    this.runTimer = spec.runTime;
    this.resting = false;
    this.lootPhase = 0;
    this.lootTimer = spec.dropEvery;
  }

  // Цель — точка ПРОЧЬ от ближайшего игрока, а не сам игрок.
  //
  // У стены он СВОРАЧИВАЕТ, а не отталкивается. Две версии до этой не
  // работали: без стен он убегал по прямой, упирался в край и покорно ждал
  // (поимка за полторы секунды), а с отталкиванием сила от стены гасила само
  // бегство и разворачивала его герою навстречу.
  //
  // Здесь он пробует бежать прямо прочь, а если впереди край — поворачивает
  // всё круче, пока не найдёт свободное направление. У стены это даёт бег
  // вдоль неё, в углу — проскок мимо героя, и это самый смешной момент задачи.
  retarget(dt, world) {
    const player = world.nearestPlayer(this.x, this.y);
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Уперевшись в поводок, он перестаёт убегать и начинает дразниться:
    // топчется на месте, пока герой не подойдёт.
    if (dist > this.spec.leash) {
      this.target = { x: this.x, y: this.y };
      return this.target;
    }

    // Из всех направлений берём то, после которого он окажется ДАЛЬШЕ всего
    // от героя, не выйдя за край. Две версии до этой не работали: первая
    // бежала строго прочь, упиралась в стену и покорно ждала, вторая брала
    // первое свободное направление — и у стены это оказывался бег строго
    // вбок, то есть с нулевым отрывом.
    //
    // Здесь у стены сам собой получается бег вдоль неё, а в углу — проскок
    // мимо героя, и это самый смешной момент задачи.
    const { width, height } = world.arena;
    const margin = this.spec.wallMargin;
    const look = this.spec.lookAhead;
    const base = Math.atan2(dy, dx);
    let bestAngle = base;
    let bestScore = -Infinity;
    for (let i = 0; i < TURNS; i++) {
      const angle = base + (i * Math.PI * 2) / TURNS;
      const nx = this.x + Math.cos(angle) * look;
      const ny = this.y + Math.sin(angle) * look;
      if (nx < margin || nx > width - margin || ny < margin || ny > height - margin) continue;
      // Не только «дальше от героя», но и «ближе к простору». Без тяги к
      // центру воришка жался к стене: там любое направление либо в стену,
      // либо строго вбок, а вбок — это нулевой отрыв, и его догоняли за
      // секунду. С тягой он вынужден проскакивать мимо героя в середину, и
      // это единственное, что делает погоню погоней.
      const fromPlayer = Math.hypot(nx - player.x, ny - player.y);
      const fromCenter = Math.hypot(nx - width / 2, ny - height / 2);
      const score = fromPlayer - fromCenter * this.spec.centerPull;
      if (score > bestScore) {
        bestScore = score;
        bestAngle = angle;
      }
    }
    this.target = {
      x: this.x + Math.cos(bestAngle) * look,
      y: this.y + Math.sin(bestAngle) * look,
    };
    return this.target;
  }

  update(dt, world) {
    this.lootPhase += dt;

    // Попали — из мешка сыплется монетка, но не чаще, чем раз в dropEvery.
    this.lootTimer -= dt;
    if (this.lootTimer <= 0) {
      this.lootTimer = this.spec.dropEvery;
      world.pickups.push(new Pickup(this.x, this.y, PickupType.MONEY));
    }

    // Передышка. Телеграф — само пыхтение: секунда, в которую его и ловят.
    this.runTimer -= dt;
    if (this.runTimer <= 0) {
      this.resting = !this.resting;
      this.runTimer = this.resting ? this.spec.restTime : this.spec.runTime;

    }

    const wasSpeed = this.speed;
    if (this.resting) this.speed = 0;
    super.update(dt, world);
    this.speed = wasSpeed;

    this.clampToArena(world.arena);

    // Ловля — касание, и проверяет её сам воришка. Через resolvePlayerHits
    // это невозможно: там isInvulnerable проверяется ДО цикла, то есть две
    // секунды после укуса герой физически не смог бы его поймать, а
    // катящийся Соник и Халк в ярости уходят в ветку контакта выше.
    for (const player of world.players) {
      if (player.downed) continue;
      if (Math.hypot(player.x - this.x, player.y - this.y) > player.radius + this.radius) continue;
      this.catchBy(world);
      return;
    }
  }

  clampToArena(arena) {
    const m = this.radius;
    this.x = Math.max(m, Math.min(arena.width - m, this.x));
    this.y = Math.max(m, Math.min(arena.height - m, this.y));
  }

  // Попадание не ранит и НЕ ЗАМЕДЛЯЕТ — только вытряхивает монетку.
  //
  // Замедление тут было и оказалось грубой ошибкой: оружие в этой игре
  // стреляет само, попадания идут непрерывно, и воришка жил на сорока пяти
  // процентах скорости постоянно. Он не убегал вовсе, и вся задача сводилась
  // к «подойди». Ни на одном стенде это не увидеть — только замером.
  //
  // Монетка с откатом, иначе автоматическая стрельба осыпает деньгами.
  takeDamage() {
    this.lootTimer = Math.min(this.lootTimer, 0);
    return false;
  }

  catchBy(world) {
    this.alive = false;
    world.audio.medal();
    world.particles.addBurst(this.x, this.y, 22, 1.3);
    // Награда, а не смерть: через damageEnemy не идём, убитым он не считается
    // и заряд способности за него не капает.
    for (let i = 0; i < this.spec.reward; i++) {
      world.pickups.push(new Pickup(this.x, this.y, PickupType.MEDAL));
    }
    this.onCatch(this, world);
  }

  draw(ctx) {
    super.draw(ctx);
    ctx.save();
    ctx.translate(this.x, this.y - this.radius * 0.9);
    drawLoot(ctx, { radius: this.radius * 0.55, phase: this.lootPhase });
    ctx.restore();
  }
}
