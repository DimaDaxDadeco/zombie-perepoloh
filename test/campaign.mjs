// Кампания: все двенадцать глав проходятся и ни одна не ломается.
//
// Гейт того же класса, что смоук, и с той же логикой: проверяем не победу, а
// отсутствие поломки. Проиграть главу — законный исход, а вот «раунд не
// завершился за пять минут» означает, что цель недостижима: числа завышены,
// или зомби перестали спавниться, или цель никогда не выполняется. Ровно это
// на глаз и не увидеть — глава просто идёт и идёт.
//
// Заодно проверяются ссылки в спеках глав: босс, тема и вид цели должны
// существовать. Опечатка в них не роняет игру — босс молча подменится
// случайным, тема сползёт на «по номеру раунда», — и заметить это можно было
// бы только глазами.
//
// Запуск: npm run test:campaign (входит в npm test)

import { seedRandom, unseedRandom } from './seed.mjs';

const { playChapter } = await import('./harness.mjs');
const { CONFIG } = await import('../js/config.js');

const HERO = 'superS';
const WEAPON = 'water';
const FIRST_SEED = 500;

// Магазин копится по ходу кампании — так в неё и играют. Голым героем главы с
// седьмой непроходимы вовсе, и замер таким ботом мерил бы не кампанию, а
// отсутствие снаряжения. Покупаем самое дешёвое из доступного, как ребёнок,
// который тратит всё сразу.
const shop = {};
let coins = 0;

function spendCoins() {
  for (;;) {
    const affordable = Object.entries(CONFIG.shop)
      .map(([id, spec]) => ({ id, price: spec.prices[shop[id] || 0] }))
      .filter((o) => o.price !== undefined && o.price <= coins)
      .sort((a, b) => a.price - b.price);
    if (!affordable.length) return;
    const pick = affordable[0];
    shop[pick.id] = (shop[pick.id] || 0) + 1;
    coins -= pick.price;
  }
}

const chapters = CONFIG.campaign.chapters;
const problems = [];
// Проигрыши гейтом не считаются — упасть можно и в честной главе. Но если
// падает половина кампании, это уже не невезение, а сломанная кривая.
const losses = [];

// --- Ссылки в спеках ---
const bossIds = new Set(CONFIG.bossTypes.map((b) => b.id));
const themeIds = new Set(CONFIG.themes.map((t) => t.id));
const goalKinds = new Set(Object.keys(CONFIG.goals));

chapters.forEach((chapter, i) => {
  const where = `${chapter.id} (глава ${i + 1})`;
  if (chapter.level !== i + 1) problems.push(`${where}: level ${chapter.level}, а по порядку ${i + 1}`);
  if (!bossIds.has(chapter.boss)) problems.push(`${where}: нет босса «${chapter.boss}»`);
  if (!themeIds.has(chapter.theme)) problems.push(`${where}: нет темы «${chapter.theme}»`);
  const kind = typeof chapter.goal === 'string' ? chapter.goal : chapter.goal.kind;
  if (!goalKinds.has(kind)) problems.push(`${where}: нет вида цели «${kind}»`);
});

// Все боссы и все локации должны быть задействованы: иначе кампания молча
// теряет контент, который в игре уже нарисован.
const usedBosses = new Set(chapters.map((c) => c.boss));
const usedThemes = new Set(chapters.map((c) => c.theme));
if (usedBosses.size !== bossIds.size) {
  const missing = [...bossIds].filter((id) => !usedBosses.has(id));
  problems.push(`боссы не в кампании: ${missing.join(', ')}`);
}
if (usedThemes.size !== themeIds.size) {
  const missing = [...themeIds].filter((id) => !usedThemes.has(id));
  problems.push(`локации не в кампании: ${missing.join(', ')}`);
}

// --- Прогоны ---
const started = Date.now();
const rows = [];
let seed = FIRST_SEED;

for (const [i, chapter] of chapters.entries()) {
  const where = `${chapter.id} (глава ${i + 1})`;
  seedRandom(seed++);
  try {
    const result = playChapter(chapter, { heroId: HERO, weaponId: WEAPON, shop: { ...shop } });
    coins += result.coinsEarned;
    spendCoins();
    const seconds = (result.frames / 60).toFixed(0);
    rows.push(`  ${String(i + 1).padStart(2)}. ${chapter.theme.padEnd(6)} ${result.goalId.padEnd(8)}`
      + ` ${(result.won ? 'прошёл' : 'упал ').padEnd(7)} ${String(seconds).padStart(3)} с,`
      + ` убито ${String(result.zombiesDefeated).padStart(3)}, 💵 ${String(coins).padStart(3)}`);
    if (!result.won) losses.push(where);

    if (!result.finished) problems.push(`${where}: не завершилась за ${result.frames} кадров — цель недостижима?`);
    if (result.zombiesDefeated === 0) problems.push(`${where}: ноль убитых зомби`);
    if (!Number.isFinite(result.hp)) problems.push(`${where}: hp = ${result.hp}`);
    // У боссовой цели босс обязан выйти: иначе глава выиграна не тем, чем
    // задумано, и «убей босса» на деле оказалась «дождись конца».
    if (result.goalId === 'boss' && result.won && result.bossPhase !== 'fight') {
      problems.push(`${where}: победа без выхода босса (фаза «${result.bossPhase}»)`);
    }
    if (result.goalId !== 'boss' && result.bossPhase !== 'none') {
      problems.push(`${where}: цель без босса, а босс вышел`);
    }
  } catch (error) {
    problems.push(`${where}: ${error.message.split('\n')[0]}`);
  } finally {
    unseedRandom();
  }
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`Кампания: ${chapters.length} глав, ${seconds} с`);
console.log(rows.join('\n'));

if (losses.length > chapters.length / 3) {
  problems.push(`провалено глав: ${losses.length} из ${chapters.length} (${losses.join(', ')})`
    + ' — кампания стала непроходимой');
}

if (problems.length === 0) {
  console.log(`\nВсё в порядке. Провалено ${losses.length} из ${chapters.length},`
    + ` куплено: ${Object.entries(shop).map(([k, v]) => `${k}${v}`).join(' ') || '—'}.`);
  process.exit(0);
}

console.error(`\nПроблем: ${problems.length}`);
for (const problem of problems) console.error(`  • ${problem}`);
process.exit(1);
