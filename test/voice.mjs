// Гейт: банк голосовых фраз не разошёлся с игрой.
//
// ЗАЧЕМ. Фиксированные фразы лежат записанными файлами (docs/audio.md). Если
// фразу добавили, а npm run voice не позвали, ребёнок услышит её браузерным
// роботом — и никакой ошибки при этом не будет. Разница между хорошим голосом
// и плохим на слух заметна, но заметить её должен не ребёнок, а тест.
//
// Проверка чисто файловая и строковая, миллисекунды, и она НИЧЕГО не
// произносит: банк тут только читается с диска.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { allPhrases } from '../js/core/phrases.js';
import { normalizeVoice } from '../js/core/voice-text.js';
import * as phrases from '../js/core/phrases.js';

const ROOT = new URL('..', import.meta.url).pathname;
const MANIFEST = join(ROOT, 'assets/voice/manifest.json');
const MIN_BYTES = 1024;
const LONG_PHRASE = 120;

const errors = [];
const warnings = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

// 1. Каждый построитель перечислен. Соглашение «фраза для голоса — это
// функция describeХХХ плюс строка в allPhrases()» несущее: без него новый
// экран заговорит мимо банка, и поймать это будет нечем.
const groups = allPhrases();
const exported = Object.keys(phrases).filter((name) => name.startsWith('describe'));
for (const name of exported) {
  check(name in groups, `построитель ${name} не перечислен в allPhrases()`);
}

// 2. Все фразы нормализуются и не пустые.
const wanted = new Set();
for (const [group, lines] of Object.entries(groups)) {
  check(Array.isArray(lines) && lines.length > 0, `группа ${group} пуста`);
  for (const line of lines) {
    const text = normalizeVoice(line);
    check(Boolean(text), `в группе ${group} есть пустая фраза`);
    check(normalizeVoice(text) === text, `нормализация не идемпотентна: «${line}»`);
    if (text.length > LONG_PHRASE) warnings.push(`длинная фраза (${text.length}): «${text}»`);
    const latin = text.match(/[A-Za-z]{2,}/g);
    if (latin) warnings.push(`латиница вне карты сокращений (${latin.join(', ')}): «${text}»`);
    if (text) wanted.add(text);
  }
}

// 3. Манифеста может не быть вовсе: свежий клон и CI должны быть зелёными до
// первой генерации. Игра в этом случае просто говорит синтезом.
if (!existsSync(MANIFEST)) {
  report('банка нет — игра будет говорить синтезом');
} else {
  const data = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const clips = data.clips || {};
  const dir = join(ROOT, 'assets/voice', data.dir || 'ru');
  const ext = `.${data.format || 'm4a'}`;

  for (const text of wanted) {
    check(text in clips, `фразы нет в банке: «${text}» (запустите npm run voice)`);
  }
  for (const text of Object.keys(clips)) {
    check(wanted.has(text), `лишняя запись в банке: «${text}» (npm run voice перезапишет)`);
    check(normalizeVoice(text) === text, `ключ банка не нормализован: «${text}»`);
  }

  const files = new Set(readdirSync(dir).filter((f) => f.endsWith(ext)));
  for (const [text, id] of Object.entries(clips)) {
    const name = `${id}${ext}`;
    if (!files.has(name)) {
      errors.push(`нет файла ${name} для «${text}»`);
      continue;
    }
    check(statSync(join(dir, name)).size >= MIN_BYTES, `файл ${name} подозрительно мал`);
  }
  const used = new Set(Object.values(clips).map((id) => `${id}${ext}`));
  for (const name of files) {
    check(used.has(name), `осиротевший файл ${name} (удалить: npm run voice:prune)`);
  }
  report(`банк: ${Object.keys(clips).length} фраз, ${files.size} файлов`);
}

function report(summary) {
  for (const line of warnings) console.warn(`  ! ${line}`);
  if (errors.length) {
    console.error(`Озвучка: ${errors.length} проблем.`);
    for (const line of errors) console.error(`  - ${line}`);
    process.exit(1);
  }
  console.log(`Озвучка в порядке: ${wanted.size} фраз в игре, ${summary}.`);
}
