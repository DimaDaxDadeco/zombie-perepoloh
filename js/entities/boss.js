// Зомби-босс. Вид и способность задаются типом из CONFIG.bossTypes:
// каждый раунд выходит следующий по списку, поэтому пять раундов подряд
// ребёнок встречает пятерых разных боссов.
//
// Наследует поведение обычного зомби, отличается размером, здоровьем,
// полоской HP и способностью (updateAbility).

import { CONFIG } from '../config.js';
import { Zombie } from './zombie.js';
import { drawBoss, drawBossRage, drawShadow, circle } from '../render/sprites.js';

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
  }

  get name() { return this.type.name; }

  // Вторая фаза: на половине здоровья босс звереет — двигается быстрее и
  // применяет способность чаще. Перелом в середине боя интереснее, чем
  // просто большой запас здоровья.
  get isEnraged() {
    return this.hp <= this.maxHp * CONFIG.boss.enrageAt;
  }

  get speedFactor() {
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
    const ratio = Math.max(0, this.hp / this.maxHp);

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
