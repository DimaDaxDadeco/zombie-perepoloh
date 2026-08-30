// Балансная сетка: сколько раундов бот выигрывает каждым оружием.
//
// Это ОТЧЁТ, а не гейт. Баланс детской игры — предмет вкуса, и заказчик
// двигает его сознательно («Хэнки должен быть посильнее»). Тест, валящий
// сборку из-за такого решения, превратился бы в помеху, и его начали бы
// обходить. Поэтому здесь только числа и разница с эталоном; решение, хорошо
// это или плохо, принимает человек.
//
// Главное отличие от прежнего браузерного замера — детерминизм. Сиды
// фиксированы, поэтому два запуска дают побитово одинаковый результат, и
// эффект правки конфига виден точно. Раньше у сетки был шум ±7 побед, и в
// balance.md записано вынужденное следствие: героя и эталон приходилось
// мерить в одном прогоне, иначе сравнение обманывало. Больше не приходится.
//
// Запуск:  npm run balance
// Принять новые числа за эталон:  npm run balance:accept

import { readFileSync, writeFileSync } from 'node:fs';
import { seedRandom, unseedRandom } from './seed.mjs';

const { playRound, selectableWeaponIds } = await import('./harness.mjs');

const BASELINE_PATH = new URL('./baseline.json', import.meta.url);
const HERO = 'superS';        // эталонный герой: перк — скорость, без подарков
const ROUNDS = [1, 3, 5, 7, 9];
const REPEATS = 3;
// Сиды идут подряд от этого числа. Менять его — значит получить другую сетку,
// то есть обнулить сравнимость со всеми прежними замерами.
const FIRST_SEED = 1000;

const accept = process.argv.includes('--accept');

const weapons = selectableWeaponIds();
const results = {};
let seed = FIRST_SEED;
let wins = 0;
let total = 0;

const started = Date.now();

for (const weaponId of weapons) {
  let weaponWins = 0;
  for (const round of ROUNDS) {
    for (let i = 0; i < REPEATS; i++) {
      seedRandom(seed++);
      try {
        if (playRound({ round, heroId: HERO, weaponId }).won) weaponWins++;
      } finally {
        unseedRandom();
      }
      total++;
    }
  }
  results[weaponId] = weaponWins;
  wins += weaponWins;
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
const runsPerWeapon = ROUNDS.length * REPEATS;

const baseline = readBaseline();

console.log(`Сетка: ${weapons.length} оружий × раунды ${ROUNDS.join(',')} × ${REPEATS} = ${total} прогонов, ${seconds} с`);
console.log(`Герой ${HERO}, магазин пустой, сложность «Легко».\n`);

const rows = weapons.map((id) => {
  const now = results[id];
  const was = baseline?.weapons?.[id];
  return `  ${id.padEnd(11)} ${String(now).padStart(2)}/${runsPerWeapon}${diff(now, was)}`;
});
console.log(rows.join('\n'));
console.log(`\n  ${'ВСЕГО'.padEnd(11)} ${wins}/${total}${diff(wins, baseline?.total)}`);

if (!baseline) {
  console.log('\nЭталона ещё нет. Принять текущие числа: npm run balance:accept');
} else if (baseline.total !== wins) {
  console.log(`\nЭталон снят на «${baseline.label}». Если сдвиг ожидаемый — npm run balance:accept`);
}

if (accept) {
  const next = {
    label: new Date().toISOString().slice(0, 10),
    hero: HERO,
    rounds: ROUNDS,
    repeats: REPEATS,
    firstSeed: FIRST_SEED,
    total: wins,
    runs: total,
    weapons: results,
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`\nЭталон записан: ${wins}/${total}`);
}

function readBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    return null;   // первого запуска эталона ещё нет — это не ошибка
  }
}

function diff(now, was) {
  if (was === undefined || was === null) return '';
  const delta = now - was;
  if (delta === 0) return '   =';
  return delta > 0 ? `   +${delta}` : `   ${delta}`;
}
