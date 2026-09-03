// Прогон раунда без браузера.
//
// Игровая логика не трогает DOM ни в одном месте: Round, сущности, системы и
// оружие берут ctx параметром и рисуют только по требованию. Поэтому раунд
// поднимается в Node напрямую, минуя Game, canvas, экраны и сохранение — и
// вся балансная сетка укладывается в секунды вместо ручного сеанса в консоли
// браузера.
//
// Правило, ради которого харнесс вообще так устроен: он НЕ считает ничего сам.
// Бонусы берутся из buildUpgrades, карточки — из generateCards и applyCard,
// то есть ровно из того кода, который крутится у ребёнка. Своя копия формулы
// означала бы, что тест меряет игру, которой нет, и заметить это было бы
// нечем: Player молча роняет незнакомые поля, и герой просто встанет с нулём
// убитых, без единого сообщения.

import { CONFIG } from '../js/config.js';
import { Round } from '../js/core/round.js';
import { buildUpgrades } from '../js/core/upgrades.js';
import { generateCards, applyCard } from '../js/systems/levelup.js';
import { createSilentAudio } from './silent-audio.mjs';

const ARENA = { width: 900, height: 600 };
const FRAME = 1 / 60;
// Предохранитель: раунд длится 120 секунд плюс босс. Пять минут — заведомо
// больше любого честного исхода, и если счётчик упёрся в потолок, это само по
// себе поломка, а не долгий бой.
const FRAME_LIMIT = 300 * 60;
// Радиус, в котором бот замечает зомби. Не трогать: бот повторяет браузерный
// автотест из docs/balance.md, и с другим поведением новые числа станут
// несравнимы со всеми прежними замерами.
const BOT_SIGHT = 300;

// Сохранение, какое было бы у ребёнка с такими настройками. Собирается из
// DEFAULT_SAVE по форме, чтобы buildUpgrades получил ровно те поля, что и в
// игре.
function makeSave({ heroId, weaponId, difficultyId, shop }) {
  return {
    character: heroId,
    weapon: weaponId,
    difficulty: difficultyId,
    shop: { speed: 0, heart: 0, star: 0, magnet: 0, dog: 0, drone: 0, ...shop },
  };
}

// Куда бежать. Инверсно-квадратичное отталкивание от каждого зомби в поле
// зрения: чем ближе, тем сильнее тянет прочь. Так бот огибает толпу, а не
// упирается в стену, — и так же он вёл себя в браузерном автотесте.
function fleeDirection(player, enemies) {
  let x = 0;
  let y = 0;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distSq = dx * dx + dy * dy;
    if (distSq === 0 || distSq > BOT_SIGHT * BOT_SIGHT) continue;
    x += (dx / distSq) * 1e4;
    y += (dy / distSq) * 1e4;
  }
  const length = Math.hypot(x, y);
  if (length === 0) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}

// Куда бот хочет попасть в этой главе. Задачи вроде «освободи друзей» или
// «догони воришку» требуют бежать К чему-то, а бот умеет только убегать — он
// не завершил бы такую главу никогда, и гейт показал бы поломку там, где её
// нет.
//
// Точку называет сама цель (Goal.botHint). Копия игровых правил здесь была бы
// хуже: харнесс принципиально ничего не считает сам. У всех старых целей
// botHint возвращает null, поэтому смоук и балансная сетка идут прежним кодом.
function goalDirection(world, player) {
  const point = world.goal.botHint?.(world, player);
  if (!point) return null;
  const dx = point.x - player.x;
  const dy = point.y - player.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

// Смесь «беги к задаче» и «уворачивайся». Перевес у задачи: иначе бот кружит
// вокруг клетки, не решаясь подойти, и глава не заканчивается.
const GOAL_PULL = 0.7;

function steer(world, player) {
  const flee = fleeDirection(player, world.enemies);
  const goal = goalDirection(world, player);
  if (!goal) return flee;
  const x = goal.x * GOAL_PULL + flee.x * (1 - GOAL_PULL);
  const y = goal.y * GOAL_PULL + flee.y * (1 - GOAL_PULL);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

// Один раунд от начала до исхода.
//
// Сид не задаётся здесь: подмена Math.random должна произойти ДО импорта
// игровых модулей, поэтому ею управляет вызывающий (см. test/seed.mjs).
export function playRound({
  round = 1,
  heroId = CONFIG.defaultCharacter,
  weaponId = CONFIG.startingWeapon,
  difficultyId = CONFIG.defaultDifficulty,
  shop = {},
  // Сквозные поля сюжетной главы. Не переданы — раунд обычный, то есть все
  // прежние прогоны и эталон остаются валидными.
  goal, theme, bossType, modifier, duration,
} = {}) {
  const save = makeSave({ heroId, weaponId, difficultyId, shop });
  const upgrades = buildUpgrades(save, 0);

  let world = null;
  // Исход приходит колбэком, а не полем: getSummary() его не содержит, и
  // угадывать по остаткам здоровья нельзя — раунд можно проиграть с полными
  // сердечками, не успев добить босса.
  let outcome = null;
  world = new Round({
    round,
    arena: ARENA,
    audio: createSilentAudio(),
    upgrades,
    difficulty: CONFIG.difficulties.find((d) => d.id === difficultyId),
    ...(goal !== undefined ? { goal } : {}),
    ...(theme !== undefined ? { theme } : {}),
    ...(bossType !== undefined ? { bossType } : {}),
    ...(modifier !== undefined ? { modifier } : {}),
    ...(duration !== undefined ? { duration } : {}),
    callbacks: {
      // Карточку берём первую из трёх — ровно как браузерный автотест. Выбор
      // «самой сильной» сделал бы замер оптимистичнее, чем игра ребёнка.
      onLevelUp: () => {
        const player = world.player;
        applyCard(player, generateCards(player)[0]);
      },
      onVictory: () => { outcome = 'victory'; },
      onDefeat: () => { outcome = 'defeat'; },
    },
  });

  let frames = 0;
  while (!world.finished && frames < FRAME_LIMIT) {
    const player = world.player;
    if (player.ability?.isReady) world.useAbility(0);
    world.update(FRAME, world.players.map((p) => steer(world, p)));
    frames++;
  }

  return {
    won: outcome === 'victory',
    outcome,
    finished: world.finished,
    frames,
    zombiesDefeated: world.zombiesDefeated,
    level: world.level,
    hp: world.player.hp,
    weapons: world.player.weapons.map((w) => `${w.emoji}${w.stars}`).join(' '),
    goalId: world.goal.id,
    // Фаза босса нужна, чтобы отличить «победил босса» от «дожил до конца»:
    // исход у них один и тот же.
    bossPhase: world.bossPhase,
    medalsCollected: world.medalsCollected,
    // Доллары нужны, чтобы симулировать настоящую игру: ребёнок копит их и
    // тратит в магазине, и без этого замер меряет вечно голого героя.
    coinsEarned: world.getSummary().coinsEarned,
  };
}

// Глава кампании — тот же прогон, только все поля названы явно. Отдельная
// функция, чтобы тест кампании не повторял разбор спеки главы: он должен
// брать её ровно так же, как Game.startChapter.
export function playChapter(chapter, options = {}) {
  return playRound({
    ...options,
    round: chapter.level,
    theme: CONFIG.themes.find((t) => t.id === chapter.theme) || null,
    bossType: chapter.boss,
    goal: chapter.goal,
    modifier: chapter.modifier,
    duration: chapter.duration ?? CONFIG.round.duration,
  });
}

// Все оружия, которые ребёнок может выбрать: без эволюций (они не выдаются на
// старте) и без сигнатурных вроде паутины Паука.
export function selectableWeaponIds() {
  return Object.entries(CONFIG.weapons)
    .filter(([, spec]) => !spec.evolved && !spec.signature)
    .map(([id]) => id);
}

export function heroIds() {
  return CONFIG.characters.map((c) => c.id);
}
