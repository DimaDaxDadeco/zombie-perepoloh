// Путешествия: все главы проходятся и ни одна не ломается.
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

// Цели, в которых убийства — часть задачи. Медальки тоже: они падают с
// убитых.
const KILLING_GOALS = new Set(['boss', 'zombies', 'survive', 'medals']);

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

const problems = [];

// --- Ссылки в спеках ---
const bossIds = new Set(CONFIG.bossTypes.map((b) => b.id));
const themeIds = new Set(CONFIG.themes.map((t) => t.id));
const goalKinds = new Set(Object.keys(CONFIG.goals));
const journeyIds = new Set(CONFIG.journeys.map((j) => j.id));

// id глав уникальны по ВСЕЙ игре, а не по путешествию: сохранение хранит их
// одним плоским списком, и столкновение id молча смешало бы прогресс двух
// путешествий. Это единственный способ потерять чужой прогресс в этой схеме,
// поэтому проверка здесь, а не в комментарии.
const seenChapterIds = new Set();

CONFIG.journeys.forEach((journey, ji) => {
  const jw = `путешествие «${journey.id}»`;
  if (journey.needs && !journeyIds.has(journey.needs)) {
    problems.push(`${jw}: ссылается на несуществующее «${journey.needs}»`);
  }
  // Ссылка вперёд или на себя заперла бы обе карты навсегда.
  const needsIndex = CONFIG.journeys.findIndex((j) => j.id === journey.needs);
  if (journey.needs && needsIndex >= ji) {
    problems.push(`${jw}: открывается тем, что идёт не раньше него`);
  }
  if (journey.medal && !CONFIG.achievements.some((a) => a.id === journey.medal)) {
    problems.push(`${jw}: нет медали «${journey.medal}»`);
  }
  if (!journey.reward?.icon) problems.push(`${jw}: нет награды`);

  journey.chapters.forEach((chapter, i) => {
    const where = `${chapter.id} (${journey.id}, глава ${i + 1})`;
    if (seenChapterIds.has(chapter.id)) problems.push(`${where}: id уже занят другой главой`);
    seenChapterIds.add(chapter.id);
    // level — это номер раунда, а ось прогрессии кончается на двенадцатом:
    // виды зомби идут по fromRound 1…12, и выше замер показал обрыв
    // проходимости. Порядок внутри путешествия должен расти.
    if (!(chapter.level >= 1 && chapter.level <= 12)) {
      problems.push(`${where}: level ${chapter.level} вне оси 1…12`);
    }
    if (i > 0 && chapter.level < journey.chapters[i - 1].level) {
      problems.push(`${where}: level ${chapter.level} меньше, чем у предыдущей главы`);
    }
    if (!bossIds.has(chapter.boss)) problems.push(`${where}: нет босса «${chapter.boss}»`);
    if (!themeIds.has(chapter.theme)) problems.push(`${where}: нет темы «${chapter.theme}»`);
    const kind = typeof chapter.goal === 'string' ? chapter.goal : chapter.goal.kind;
    if (!goalKinds.has(kind)) problems.push(`${where}: нет вида цели «${kind}»`);
  });
});

// Все боссы и все локации должны быть задействованы: иначе игра молча теряет
// контент, который в ней уже нарисован. Считаем по ОБЪЕДИНЕНИЮ путешествий —
// требовать все семь тем от каждого незачем.
const allChapters = CONFIG.journeys.flatMap((j) => j.chapters);
const usedBosses = new Set(allChapters.map((c) => c.boss));
const usedThemes = new Set(allChapters.map((c) => c.theme));
if (usedBosses.size !== bossIds.size) {
  const missing = [...bossIds].filter((id) => !usedBosses.has(id));
  problems.push(`боссы не в путешествиях: ${missing.join(', ')}`);
}
if (usedThemes.size !== themeIds.size) {
  const missing = [...themeIds].filter((id) => !usedThemes.has(id));
  problems.push(`локации не в путешествиях: ${missing.join(', ')}`);
}

// --- Прогоны ---
//
// Магазин и монеты СКВОЗНЫЕ между путешествиями: во второе ребёнок приходит с
// покупками, и мерить его голым героем значило бы мерить не путешествие, а
// отсутствие снаряжения.
const started = Date.now();
let seed = FIRST_SEED;
let total = 0;

for (const journey of CONFIG.journeys) {
  const chapters = journey.chapters;
  const rows = [];
  // Проигрыши гейтом не считаются — упасть можно и в честной главе. Но если
  // падает треть путешествия, это уже не невезение, а сломанная кривая. Счёт
  // по КАЖДОМУ отдельно: иначе провал всего второго спрячется за первым.
  const losses = [];
  total += chapters.length;

  for (const [i, chapter] of chapters.entries()) {
    const where = `${chapter.id} (${journey.id}, глава ${i + 1})`;
    seedRandom(seed++);
    try {
      const result = playChapter(chapter, { heroId: HERO, weaponId: WEAPON, shop: { ...shop } });
      coins += result.coinsEarned;
      spendCoins();
      const seconds = (result.frames / 60).toFixed(0);
      rows.push(`  ${String(i + 1).padStart(2)}. ${chapter.theme.padEnd(6)} ${result.goalId.padEnd(9)}`
        + ` ${(result.won ? 'прошёл' : 'упал ').padEnd(7)} ${String(seconds).padStart(3)} с,`
        + ` убито ${String(result.zombiesDefeated).padStart(3)}, 💵 ${String(coins).padStart(3)}`);
      if (!result.won) losses.push(where);

      if (!result.finished) problems.push(`${where}: не завершилась за ${result.frames} кадров — цель недостижима?`);
      // Ноль убитых — поломка только там, где убивать И НАДО. В догонялках,
      // спасении и доставке задача другая: бот может пройти главу, не тронув
      // никого, и это законный исход, а не сломанное оружие. Оружие проверяет
      // смоук, отдельно и всеми четырнадцатью.
      if (KILLING_GOALS.has(result.goalId) && result.zombiesDefeated === 0) {
        problems.push(`${where}: ноль убитых зомби`);
      }
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

  console.log(`\n${journey.title}: ${chapters.length} глав`);
  console.log(rows.join('\n'));
  if (losses.length > chapters.length / 3) {
    problems.push(`${journey.title}: провалено ${losses.length} из ${chapters.length}`
      + ` (${losses.join(', ')}) — путешествие стало непроходимым`);
  }
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);

if (problems.length === 0) {
  const n = CONFIG.journeys.length;
  const word = n === 1 ? 'путешествие' : (n < 5 ? 'путешествия' : 'путешествий');
  console.log(`\nВсё в порядке. ${n} ${word}, ${total} глав, ${seconds} с.`
    + ` Куплено: ${Object.entries(shop).map(([k, v]) => `${k}${v}`).join(' ') || '—'}.`);
  process.exit(0);
}

console.error(`\nПроблем: ${problems.length}`);
for (const problem of problems) console.error(`  • ${problem}`);
process.exit(1);
