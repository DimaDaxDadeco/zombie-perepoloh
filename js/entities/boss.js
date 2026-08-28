// Зомби-босс. Вид и способность задаются типом из CONFIG.bossTypes:
// каждый раунд выходит следующий по списку, поэтому пять раундов подряд
// ребёнок встречает пятерых разных боссов.
//
// Наследует поведение обычного зомби, отличается размером, здоровьем,
// полоской HP и способностью (updateAbility).

import { CONFIG } from '../config.js';
import { Zombie } from './zombie.js';
import {
  drawBoss, drawBossRage, drawShadow, drawBossBones, drawWeb, circle,
} from '../render/sprites.js';
import { CakeLob } from './projectile.js';

// Босс раунда: список типов проходится по кругу.
export function bossTypeForRound(round) {
  const types = CONFIG.bossTypes;
  return types[(round - 1) % types.length];
}

export class Boss extends Zombie {
  // hpFactor приходит от уровня сложности; type задаётся только в превью.
  constructor(x, y, round, { type = bossTypeForRound(round), hpFactor = 1 } = {}) {
    // Здоровье растёт мягко, чтобы бой не превращался в долгое избиение.
    const baseHp = CONFIG.boss.baseHp
      * (1 + (round - 1) * CONFIG.boss.hpGrowthPerRound) * hpFactor;
    super(x, y, {
      hp: Math.ceil(baseHp * type.hp),
      speed: CONFIG.boss.speed * type.speed,
    });

    this.isBoss = true;
    this.type = type;
    this.radius = CONFIG.boss.radius * type.radius;
    this.abilityTimer = 0;
    this.dashTimer = 0;   // сколько ещё секунд длится рывок
    this.flames = [];     // огоньки за спиной огненного босса
    this.webs = [];       // липкие зоны паука
    this.cakeTimer = 0;
    this.commandTimer = 0;   // командир замер с поднятой рукой
    this.bolt = null;        // круг-телеграф электрического
    this.reviveUsed = false; // костяной воскресает ровно один раз
    this.downTimer = 0;
    this.downAnnounced = false;
  }

  // Костяной не умирает с первого раза: рассыпается и собирается с половиной
  // здоровья. Возвращаем false — для Round это «удар не добил», поэтому не
  // сработают ни победа (она проверяется по !boss.alive), ни наклейка, ни
  // добыча, ни счётчик зомби: всё это живёт в onEnemyDefeated, а его зовут
  // по возвращаемому значению takeDamage.
  takeDamage(amount) {
    if (this.isDown) return false;              // кости неуязвимы
    const spec = this.type.revive;
    if (!spec || this.reviveUsed || this.hp - amount > 0) return super.takeDamage(amount);

    this.reviveUsed = true;
    this.hp = 0;
    this.downTimer = spec.downTime;
    this.burnTimer = 0;    // огонь не догорает по костям
    this.freezeTimer = 0;
    return false;
  }

  get isDown() {
    return this.downTimer > 0;
  }

  // Кости — не цель для оружия и не кусаются. Тот же флаг, что у крота под
  // землёй, и он закрывает разом четыре места: столкновения с героем,
  // попадания снарядов, авто-прицел и собственное движение.
  get isHidden() {
    return this.isDown;
  }

  updateDown(dt, world) {
    if (!this.downAnnounced) {
      this.downAnnounced = true;
      world.onBossDown(this);
    }
    this.downTimer -= dt;
    if (this.downTimer > 0) return;
    this.hp = Math.ceil(this.maxHp * this.type.revive.hpFactor);
    world.onBossRevived(this);
  }

  get name() { return this.type.name; }

  // Вторая фаза: на половине здоровья босс звереет — двигается быстрее и
  // применяет способность чаще. Перелом в середине боя интереснее, чем
  // просто большой запас здоровья.
  get isEnraged() {
    return this.hp <= this.maxHp * CONFIG.boss.enrageAt;
  }

  get speedFactor() {
    if (this.commandTimer > 0) return 0;   // командует — стоит, подняв руку
    let factor = super.speedFactor;
    if (this.dashTimer > 0) factor *= this.type.dashSpeed;
    if (this.isEnraged) factor *= CONFIG.boss.enrageSpeed;
    return factor;
  }

  // Интервал способности с поправкой на ярость.
  abilityInterval(base) {
    return this.isEnraged ? base * CONFIG.boss.enrageRate : base;
  }

  update(dt, world) {
    if (this.isDown) return this.updateDown(dt, world);
    super.update(dt, world);
    if (this.alive) this.updateAbility(dt, world);
  }

  updateAbility(dt, world) {
    // Замороженный босс не колдует: иначе ледяная пушка и «Мяу!» тормозили
    // бы его ноги, а способности продолжали бы сыпаться как ни в чём не бывало.
    if (this.isFrozen) return;
    this.abilityTimer -= dt;

    switch (this.type.ability) {
      case 'spawn': return this.updateSpawn(world);
      case 'dash': return this.updateDash(dt);
      case 'chill': return; // работает при касании, см. onTouchPlayer
      case 'flames': return this.updateFlames(dt, world);
      case 'cake': return this.updateCakes(dt, world);
      case 'rally': return this.updateRally(dt, world);
      case 'web': return this.updateWebs(dt, world);
      case 'bolt': return this.updateBolts(dt, world);
      default: return;
    }
  }

  // Мама-зомби выпускает малышей — обычных зомби этого раунда.
  updateSpawn(world) {
    if (this.abilityTimer > 0) return;
    this.abilityTimer = this.abilityInterval(this.type.spawnInterval);

    for (let i = 0; i < this.type.spawnCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = this.radius + 30;
      const baby = world.spawner.createZombie(world.arena, world.players);
      baby.x = this.x + Math.cos(angle) * dist;
      baby.y = this.y + Math.sin(angle) * dist;
      world.addEnemy(baby);
    }
    world.particles.addBurst(this.x, this.y, 10, 0.8);
  }

  // Клоун кидает торт в точку, где стоит герой. Тень-мишень видна всю
  // секунду полёта — это и есть телеграф.
  updateCakes(dt, world) {
    if (this.abilityTimer > 0) return;
    const target = world.nearestPlayer(this.x, this.y);
    // Вплотную не кидает: тогда у ребёнка не было бы времени убежать, а босс
    // и так уже рядом.
    if (Math.hypot(target.x - this.x, target.y - this.y) < this.type.cakeMinDist) return;

    this.abilityTimer = this.abilityInterval(this.type.cakeInterval);
    // Мишень — частицей, а не внутри снаряда: ночной тинт кладётся между
    // персонажами и частицами, и нарисованный в снаряде круг ночью притух
    // бы. Телеграф обязан быть виден всегда — это то же правило, что у
    // молнии электрического.
    world.particles.addTelegraph(target.x, target.y, this.type.cakeRadius, this.type.cakeFlight);
    world.addProjectile(new CakeLob(
      this.x, this.y - this.radius * 0.6,
      target.x, target.y,
      this.type.cakeFlight, this.type.cakeRadius,
    ));
  }

  // Охранник командует, и зомби ускоряются. Сам множитель живёт в Round:
  // третий источник правды в Zombie.speedFactor (заморозка × ярость × приказ)
  // обязательно разъехался бы.
  updateRally(dt, world) {
    if (this.commandTimer > 0) {
      this.commandTimer -= dt;
      if (this.commandTimer <= 0) world.rallyZombies(this.type.rallyFactor, this.type.rallyTime);
      return;
    }
    if (this.abilityTimer > 0) return;
    this.abilityTimer = this.abilityInterval(this.type.rallyInterval);
    this.commandTimer = this.type.rallyWindup;   // замах: рука вверх, свисток
  }

  // Паук оставляет липкие зоны. Живут списком в боссе — как огоньки: ради
  // пяти кружков заводить сущность не окупается, а исчезают они вместе с ним.
  updateWebs(dt, world) {
    if (this.abilityTimer <= 0) {
      this.abilityTimer = this.abilityInterval(this.type.webInterval);
      this.webs.push({ x: this.x, y: this.y, life: this.type.webLife, seed: Math.random() * 9 });
      // Потолок зон — то же правило, что у огоньков: арена не должна зарасти.
      if (this.webs.length > this.type.maxWebs) this.webs.shift();
    }
    for (const web of this.webs) web.life -= dt;
    this.webs = this.webs.filter((w) => w.life > 0);

    for (const web of this.webs) {
      for (const player of world.players) {
        const dist = Math.hypot(player.x - web.x, player.y - web.y);
        if (dist > this.type.webRadius + player.radius) continue;
        // Короткая подпитка каждый кадр: вышел из паутины — отпустило само
        // через четверть секунды. chill() продлевает, а не складывает.
        player.chill(this.type.webSlow, 0.25);
      }
    }
  }

  // Электрический рисует круг под ногами героя и бьёт туда через секунду.
  updateBolts(dt, world) {
    if (this.bolt) {
      this.bolt.timer -= dt;
      if (this.bolt.timer > 0) return;
      const { x, y } = this.bolt;
      this.bolt = null;
      world.strike(x, y, this.type.boltRadius, { x: this.x, y: this.y - this.radius });
      return;
    }
    if (this.abilityTimer > 0) return;

    this.abilityTimer = this.abilityInterval(this.type.boltInterval);
    const target = world.nearestPlayer(this.x, this.y);
    // Круг ставится по позиции героя в момент замаха и больше не двигается:
    // за секунду он пробегает 230 пикселей при радиусе поражения 72.
    this.bolt = { x: target.x, y: target.y, timer: this.type.boltWarn };
    world.particles.addTelegraph(target.x, target.y, this.type.boltRadius, this.type.boltWarn);
  }

  // Спортсмен разгоняется рывками — между ними успевает передохнуть.
  updateDash(dt) {
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      return;
    }
    if (this.abilityTimer <= 0) {
      this.abilityTimer = this.abilityInterval(this.type.dashInterval);
      this.dashTimer = this.type.dashTime;
    }
  }

  // Огненный роняет за собой гаснущие огоньки.
  updateFlames(dt, world) {
    if (this.abilityTimer <= 0) {
      this.abilityTimer = this.abilityInterval(this.type.flameInterval);
      this.flames.push({ x: this.x, y: this.y, life: this.type.flameLife });
    }

    for (const flame of this.flames) flame.life -= dt;
    this.flames = this.flames.filter((f) => f.life > 0);

    // Огонёк жжёт при касании — но не больнее обычного зомби. Каждый игрок
    // обжигается независимо, поэтому break тут был бы неправильным.
    for (const flame of this.flames) {
      for (const player of world.players) {
        const dist = Math.hypot(player.x - flame.x, player.y - flame.y);
        if (dist < this.type.flameRadius + player.radius) player.takeHit(world);
      }
    }
  }

  // Ледяной босс примораживает героя, когда до него дотронулся.
  onTouchPlayer(player) {
    if (this.type.ability === 'chill') {
      player.chill(this.type.chillFactor, this.type.chillTime);
    }
  }

  draw(ctx) {
    this.drawFlames(ctx);
    this.drawWebs(ctx);

    if (this.isDown) {
      ctx.save();
      ctx.translate(this.x, this.y);
      drawBossBones(ctx, {
        radius: this.radius,
        progress: 1 - this.downTimer / this.type.revive.downTime,
      });
      ctx.restore();
      this.drawHealthBar(ctx);
      return;
    }


    ctx.save();
    ctx.translate(this.x, this.y);
    drawShadow(ctx, this.radius);

    const enraged = this.isEnraged;
    const rage = {
      radius: this.radius,
      walkPhase: this.walkPhase,
      look: this.type.look,
      style: this.type.rage,
    };

    // Эффект ярости идёт двумя слоями — под боссом и поверх него, чтобы
    // обнимал персонажа, а не лежал на нём плашкой.
    if (enraged) drawBossRage(ctx, { ...rage, layer: 'back' });

    ctx.save();
    drawBoss(ctx, {
      radius: this.radius,
      walkPhase: this.walkPhase,
      facing: this.facing,
      hurtFlash: this.hurtTimer > 0,
      look: this.type.look,
      armUp: this.commandTimer > 0,
      burning: this.isBurning,
      frozen: this.isFrozen,
      freezeProgress: this.freezeProgress,
      freezeSeed: this.freezeSeed,
    });
    ctx.restore();

    if (enraged) drawBossRage(ctx, { ...rage, layer: 'front' });

    ctx.restore();
    this.drawHealthBar(ctx);
  }

  // Паутина рисуется в мировых координатах, под персонажами — как огоньки.
  drawWebs(ctx) {
    for (const web of this.webs) {
      drawWeb(ctx, web, this.type.webRadius, this.type.webLife);
    }
  }

  drawFlames(ctx) {
    for (const flame of this.flames) {
      const t = flame.life / this.type.flameLife;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.4);
      ctx.fillStyle = '#ff8a2b';
      circle(ctx, flame.x, flame.y, this.type.flameRadius * (0.6 + t * 0.4));
      ctx.fillStyle = '#ffd93d';
      circle(ctx, flame.x, flame.y, this.type.flameRadius * 0.45 * t);
      ctx.restore();
    }
  }

  drawHealthBar(ctx) {
    const width = this.radius * 2.4;
    const height = 14;
    const x = this.x - width / 2;
    const y = this.y - this.radius * 2.1;
    // Пока лежит костями, полоска в последние 0.6 секунды наполняется до
    // половины — видно, что набирается сил, ещё до того как он встал.
    const ratio = this.isDown
      ? this.type.revive.hpFactor * Math.max(0, 1 - this.downTimer / 0.6)
      : Math.max(0, this.hp / this.maxHp);

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.roundRect(x - 2, y - 2, width + 4, height + 4, 8);
    ctx.fill();
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.roundRect(x, y, width * ratio, height, 6);
    ctx.fill();
    ctx.restore();
  }
}
