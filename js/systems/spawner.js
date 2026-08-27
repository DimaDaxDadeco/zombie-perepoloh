// Спавнер зомби: волны заходят с краёв арены, темп растёт к концу раунда.
// Кривая сложности по раундам описана в docs/balance.md.

import { CONFIG } from '../config.js';
import { Zombie } from '../entities/zombie.js';
import { Boss } from '../entities/boss.js';

const SPAWN_MARGIN = 50; // насколько за краем экрана появляется зомби

export class Spawner {
  // spec — уровень сложности из CONFIG.difficulties. По умолчанию «Легко»:
  // спавнер должен собираться и без него (автотест, превью-стенды).
  constructor(round, spec = CONFIG.difficulties[0], coop = null) {
    this.round = round;
    this.spec = spec;
    // Множители игры вдвоём. Единицы при одном игроке.
    this.coop = coop || { spawnFactor: 1, maxAliveFactor: 1 };
    this.difficulty = Math.min(
      CONFIG.round.difficultyCap,
      1 + (round - 1) * CONFIG.round.difficultyPerRound,
    );
    this.timer = CONFIG.spawner.warmupDelay;
    // Множители особого раунда. Единицы в обычном — то есть арифметически
    // тождественно прежнему поведению.
    this.intervalFactor = 1;
    this.batchBonus = 0;
    this.hordeMaxAlive = 1;

    // Базовые характеристики зомби этого раунда. HP растёт ступенькой раз в
    // несколько раундов, а не пропорционально сложности — иначе оружие резко
    // «слабеет». Множители вида зомби накладываются поверх этих значений.
    // Сложность двигает саму ступеньку, а не умножает здоровье: множитель
    // подкидывал бы зомби с 2 HP до 3 уже на первом раунде (см. balance.md).
    this.baseHp = CONFIG.zombie.baseHp
      + Math.floor((round - 1 + spec.hpRoundOffset) / spec.hpEveryRounds);
    this.baseSpeed = CONFIG.zombie.baseSpeed * this.difficulty * spec.zombieSpeed;

    // Какие виды зомби уже «открылись» к этому раунду.
    this.availableTypes = CONFIG.zombieTypes.filter((t) => round >= t.fromRound);
  }

  // Случайный вид зомби с учётом весов: обычные встречаются чаще редких.
  pickType() {
    const total = this.availableTypes.reduce((sum, t) => sum + t.weight, 0);
    let roll = Math.random() * total;
    for (const type of this.availableTypes) {
      roll -= type.weight;
      if (roll <= 0) return type;
    }
    return this.availableTypes[0];
  }

  // progress — доля пройденного раунда (0..1): чем ближе к боссу, тем чаще волны.
  update(dt, world, progress) {
    const maxAlive = CONFIG.spawner.maxAlive * this.spec.maxAlive
      * this.coop.maxAliveFactor * this.hordeMaxAlive;
    if (world.enemies.length >= Math.round(maxAlive)) return;

    this.timer -= dt;
    if (this.timer > 0) return;

    const { startInterval, endInterval } = CONFIG.spawner;
    // Корень от сложности: волны учащаются заметно медленнее, чем растёт
    // огневая мощь героя — ощущение «я стал сильнее» должно побеждать.
    const interval = (startInterval + (endInterval - startInterval) * progress)
      / (Math.sqrt(this.difficulty) * this.spec.spawnRate * this.coop.spawnFactor);
    this.timer = interval * this.intervalFactor;

    const batch = CONFIG.spawner.batchMin + this.batchBonus
      + Math.floor(Math.random() * (CONFIG.spawner.batchMax - CONFIG.spawner.batchMin + 1));
    for (let i = 0; i < batch; i++) {
      const type = this.pickType();
      // Собаки приходят стайкой — по одной они не бегают
      const count = type.behavior === 'pack'
        ? type.packMin + Math.floor(Math.random() * (type.packMax - type.packMin + 1))
        : 1;
      const { x, y } = spawnPoint(world.arena, world.players);
      for (let k = 0; k < count; k++) {
        // Стая появляется кучкой вокруг одной точки, а не строем
        const spread = count > 1 ? 60 : 0;
        world.addEnemy(this.makeZombie(
          x + (Math.random() - 0.5) * spread,
          y + (Math.random() - 0.5) * spread,
          type,
        ));
      }
    }
  }

  // Одиночный зомби нужного вида в заданной точке.
  makeZombie(x, y, type) {
    return new Zombie(x, y, {
      hp: Math.max(1, Math.round(this.baseHp * type.hp)),
      speed: this.baseSpeed * type.speed,
      radius: CONFIG.zombie.radius * type.radius,
      look: type.look,
      type,
    });
  }

  // Используется мамой-боссом: обычный зомби случайного вида у края арены.
  createZombie(arena, players) {
    const { x, y } = spawnPoint(arena, players);
    return this.makeZombie(x, y, this.pickType());
  }

  createBoss(arena, players, at = null) {
    const point = at || bossSpawnPoint(arena, players);
    return new Boss(point.x, point.y, this.round, {
      hpFactor: this.spec.bossHp * this.coop.bossHpFactor,
    });
  }
}

// Точка появления босса — внутри экрана, в отличие от обычных зомби.
// Выход босса это главное событие раунда, и ребёнок должен его увидеть,
// а не обнаружить готового босса уже вползающим из-за края.
export function bossSpawnPoint(arena, players) {
  const ATTEMPTS = 12;
  const margin = CONFIG.boss.spawnMargin;
  const randomInside = () => ({
    x: margin + Math.random() * Math.max(1, arena.width - margin * 2),
    y: margin + Math.random() * Math.max(1, arena.height - margin * 2),
  });

  let best = randomInside();
  let bestDist = -1;
  for (let i = 0; i < ATTEMPTS; i++) {
    const point = randomInside();
    const dist = minDistance(point, players);
    if (dist >= CONFIG.boss.spawnDistance) return point;
    // Если идеальной точки не нашлось (маленький экран) — берём самую дальнюю.
    if (dist > bestDist) {
      best = point;
      bestDist = dist;
    }
  }
  return best;
}

// Точка чуть за краем арены, но не вплотную к герою: у ребёнка всегда
// должно оставаться время увидеть зомби и убежать.
// Дистанция считается до БЛИЖАЙШЕГО игрока: правило «зомби не появляется
// у героя за спиной» должно выполняться для каждого, а не в среднем.
function spawnPoint(arena, players) {
  const ATTEMPTS = 8;
  let fallback = randomEdgePoint(arena);
  for (let i = 0; i < ATTEMPTS; i++) {
    const point = randomEdgePoint(arena);
    if (minDistance(point, players) >= CONFIG.spawner.minDistanceFromPlayer) return point;
    fallback = point;
  }
  return fallback;
}

function minDistance(point, players) {
  let best = Infinity;
  for (const p of players) best = Math.min(best, Math.hypot(point.x - p.x, point.y - p.y));
  return best;
}

function randomEdgePoint({ width, height }) {
  const side = Math.floor(Math.random() * 4);
  switch (side) {
    case 0: return { x: Math.random() * width, y: -SPAWN_MARGIN };
    case 1: return { x: width + SPAWN_MARGIN, y: Math.random() * height };
    case 2: return { x: Math.random() * width, y: height + SPAWN_MARGIN };
    default: return { x: -SPAWN_MARGIN, y: Math.random() * height };
  }
}
