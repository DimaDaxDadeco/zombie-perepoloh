// Смоук: каждый герой каждым оружием проходит раунд, и ничего не ломается.
//
// Это жёсткий гейт — падение здесь означает поломку, а не спорный баланс.
// Ловит ровно то, что раньше находилось только глазами и случайно: исключение
// в способности восьмого героя, NaN в координатах, зависший раунд, оружие,
// которое перестало наносить урон.
//
// Числа побед смоук не проверяет намеренно: проиграть раунд — законный исход,
// и требовать победы значило бы превратить гейт в замер баланса. Замер живёт
// отдельно, в balance.mjs, и гейтом не является.
//
// Запуск: npm test

import { seedRandom, unseedRandom } from './seed.mjs';

// Игру импортируем ПОСЛЕ того, как подмена Math.random стала возможна, —
// динамическим import(), чтобы порядок был виден в коде, а не подразумевался.
const { playRound, selectableWeaponIds, heroIds } = await import('./harness.mjs');
const { CONFIG } = await import('../js/config.js');

const ROUND = 5;         // не первый: к пятому уже есть и толпа, и модификаторы
const FIRST_SEED = 1;

const problems = [];
let runs = 0;
let seed = FIRST_SEED;

const started = Date.now();

for (const heroId of heroIds()) {
  for (const weaponId of selectableWeaponIds()) {
    const where = `${heroId} / ${weaponId}`;
    runs++;
    seedRandom(seed++);
    try {
      const result = playRound({ round: ROUND, heroId, weaponId });
      // Герой со своим оружием (Паук) выбор игнорирует — у него всегда паутина.
      // Прогон всё равно делаем: способность и перк у него свои.
      if (!result.finished) problems.push(`${where}: раунд не завершился за ${result.frames} кадров`);
      if (result.zombiesDefeated === 0) problems.push(`${where}: ноль убитых зомби`);
      if (!Number.isFinite(result.hp)) problems.push(`${where}: hp = ${result.hp}`);
      if (!result.weapons) problems.push(`${where}: герой остался без оружия`);
    } catch (error) {
      problems.push(`${where}: ${error.message.split('\n')[0]}`);
    } finally {
      unseedRandom();
    }
  }
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
const heroes = heroIds().length;
const weapons = selectableWeaponIds().length;

console.log(`Смоук: ${heroes} героев × ${weapons} оружий = ${runs} прогонов на раунде ${ROUND}, ${seconds} с`);

if (problems.length === 0) {
  console.log(`Всё в порядке. Зомби-типов ${CONFIG.zombieTypes.length}, боссов ${CONFIG.bossTypes.length}.`);
  process.exit(0);
}

console.error(`\nПроблем: ${problems.length}`);
for (const problem of problems) console.error(`  • ${problem}`);
process.exit(1);
