// Гейт: в выводимом на экран коде не осталось эмодзи, и все имена иконок из
// конфига существуют.
//
// ЗАЧЕМ. Эмодзи рисует шрифт операционной системы: на маке одни картинки, на
// Windows другие, на Linux часть отсутствует. Ребёнок пяти лет читать не умеет
// и ориентируется в игре исключительно по значкам. Один забытый эмодзи в
// разметке — и на чужом компьютере в этом месте будет чужая картинка либо
// пустой прямоугольник, причём здесь, на маке, всё будет выглядеть прекрасно.
// Такое глазами не ловится в принципе.
//
// Проверка идёт первой в `npm test`: она занимает миллисекунды, а смоук —
// полминуты.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { ICON_NAMES } from '../js/render/icons.js';
import { CONFIG } from '../js/config.js';

const ROOT = new URL('..', import.meta.url).pathname;

// Что проверяем. docs/ и README.md намеренно НЕ проверяем: там эмодзи —
// текст для разработчика, они уместны и полезны в таблицах.
const DIRS = ['js', 'css', 'preview'];
const FILES = ['index.html', 'preview.html'];

// Одной «эмодзи-области» мало. ▶ (U+25B6) и ● (U+25CF) живут в блоке
// геометрических фигур, и без него проверка пропустила бы половину кнопок.
// Кириллица, латиница, цифры и типографские тире сюда не попадают.
const MARKS = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}\u{FE0F}\u{2190}-\u{21FF}\u{23F0}-\u{23FF}]/u;

// Комментарии вырезаем: эмодзи в них помечают разделы кода, их больше сотни,
// и они полезны. Вырезаем честно, а не построчно, — правило не должно
// сломаться молча на первом же эмодзи после кода в той же строке.
function stripComments(text, ext) {
  if (ext === '.css') return text.replace(/\/\*[\s\S]*?\*\//g, ' ');
  if (ext === '.html') {
    return text.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n').map(dropLineComment).join('\n');
  }
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map(dropLineComment).join('\n');
}

// `//` внутри строки или адреса (http://) комментарием не является.
function dropLineComment(line) {
  let quote = null;
  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '/' && line[i + 1] === '/' && line[i - 1] !== ':') return line.slice(0, i);
  }
  return line;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (['.js', '.css', '.html'].includes(extname(name))) out.push(path);
  }
  return out;
}

const targets = [
  ...DIRS.flatMap((d) => walk(join(ROOT, d))),
  ...FILES.map((f) => join(ROOT, f)),
];

const found = [];
for (const path of targets) {
  const ext = extname(path);
  const code = stripComments(readFileSync(path, 'utf8'), ext);
  code.split('\n').forEach((line, i) => {
    const m = line.match(new RegExp(MARKS, 'gu'));
    if (!m) return;
    const point = m[0].codePointAt(0).toString(16).toUpperCase();
    found.push(`${path.replace(ROOT, '')}:${i + 1}  ${m.join(' ')}  (U+${point})`);
  });
}

// Третья проверка: обращений к полю `emoji` не осталось. Поле переименовано в
// `icon`, но забытое `spec.emoji` даёт undefined, а не ошибку — на экране
// появляется слово «undefined», и ни первая проверка, ни глаз этого не ловят.
// Ровно так уцелел заголовок карты кампании.
const stale = [];
for (const path of targets) {
  if (extname(path) !== '.js') continue;
  const code = stripComments(readFileSync(path, 'utf8'), '.js');
  code.split('\n').forEach((line, i) => {
    if (/\.emoji\b|\bemoji:/.test(line)) {
      stale.push(`${path.replace(ROOT, '')}:${i + 1}  ${line.trim()}`);
    }
  });
}

// Вторая проверка: имя иконки из конфига обязано существовать в реестре.
// Опечатку иначе заметит только ребёнок, увидев красный квадрат.
const names = [];
const add = (where, list) => list.forEach((v) => v && names.push([where, v]));
add('оружие', Object.values(CONFIG.weapons).map((w) => w.icon));
add('способность', Object.values(CONFIG.abilities || {}).map((a) => a && a.icon));
add('магазин', Object.values(CONFIG.shop).map((s) => s.icon));
add('медаль', CONFIG.achievements.map((a) => a.icon));
add('сложность', CONFIG.difficulties.map((d) => d.icon));
add('особый раунд', Object.values(CONFIG.specialRounds.types || {}).map((m) => m && m.icon));
add('цель', Object.values(CONFIG.goals || {}).map((g) => g && g.icon));
add('путешествие', CONFIG.journeys.map((j) => j.icon));
add('награда', CONFIG.journeys.map((j) => j.reward?.icon));
// Значки кадров истории раньше не проверялись вовсе — закрываем заодно.
add('кадр истории', CONFIG.journeys.flatMap((j) =>
  [...(j.intro || []), ...(j.finale || []), ...(j.unlock || [])].map((f) => f.icon)));

const known = new Set(ICON_NAMES);
const missing = names.filter(([, name]) => !known.has(name));

if (found.length || missing.length || stale.length) {
  if (found.length) {
    console.error(`\nЭмодзи в выводимом коде — ${found.length}:`);
    console.error(found.map((f) => `  ${f}`).join('\n'));
    console.error('\nЗначки должен рисовать js/render/icons.js, а не шрифт системы.');
  }
  if (missing.length) {
    console.error(`\nНет таких иконок в реестре — ${missing.length}:`);
    console.error(missing.map(([w, n]) => `  ${w}: ${n}`).join('\n'));
  }
  if (stale.length) {
    console.error(`\nОсталось поле emoji — ${stale.length}:`);
    console.error(stale.map((f) => `  ${f}`).join('\n'));
    console.error('\nОно переименовано в icon и хранит имя значка.');
  }
  process.exit(1);
}

console.log(`Значки: эмодзи в коде нет, поля emoji не осталось, `
  + `все ${names.length} имён из конфига найдены (в реестре ${ICON_NAMES.length}).`);
