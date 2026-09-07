// Генератор банка голосовых фраз: перечисляет всё, что игра может произнести,
// и записывает это системным голосом в assets/voice.
//
// Запуск: npm run voice
//
// ЗАЧЕМ ОН ЕСТЬ. Браузерный синтез на большинстве машин — компактный робот, а
// ребёнок пяти лет слушает подписи постоянно: озвучка для него не украшение, а
// единственный способ узнать, что написано. Хороший голос в браузере получить
// нельзя, а офлайн — можно: macOS отдаёт премиальные голоса через say.
//
// ПОЧЕМУ НЕ В test/. В test/ живут гейты, которые крутятся в npm test на любой
// машине. Этому нужен macOS с установленным премиальным голосом.
//
// Файлы коммитятся в репозиторий: Pages выкладывает его как есть, шага сборки
// нет, и сгенерировать их в CI невозможно.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, existsSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { allPhrases } from '../js/core/phrases.js';
import { normalizeVoice } from '../js/core/voice-text.js';

const ROOT = new URL('..', import.meta.url).pathname;
const DIR = 'ru';
const OUT = join(ROOT, 'assets/voice', DIR);
const MANIFEST = join(ROOT, 'assets/voice/manifest.json');

// Темп: 165 слов в минуту примерно соответствует rate 0.95 у браузерного
// синтеза, на котором игра говорила раньше. Питча у say нет вовсе, поэтому
// записанный голос чуть ниже прежнего — гоняться за этим через [[pbas]] не
// стоит, современные голоса такие команды не поддерживают.
const RATE = 165;
const FORMAT = 'm4a';
const BITRATE = 32000;
const SAMPLE_RATE = 22050;

const MIN_BYTES = 1024;
const MAX_SECONDS = 8;
const WARN_BYTES = 8 * 1024 * 1024;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

function hash(text) {
  return createHash('sha1').update(text, 'utf8').digest('hex').slice(0, 12);
}

// Каким голосом писать.
//
// По умолчанию — СИСТЕМНЫМ, то есть тем, что выбран в Системных настройках ->
// Универсальный доступ -> Read & Speak -> System voice. Причина: `say -v` видит
// только старые голоса MacinTalk и не видит Siri-голоса, а они нейросетевые и
// живее любой Milena, включая премиальную. Зато `say` БЕЗ флага -v говорит
// ровно системным голосом — этим и пользуемся.
//
// Качество судим по идентификатору выбранного голоса: у хороших в нём есть
// premium, neural или enhanced. Имя голоса из настроек читается ради записи в
// манифест — чтобы потом было видно, чем банк записан.
function systemVoice() {
  const read = spawnSync('defaults', [
    'read', 'com.apple.Accessibility', 'SpokenContentDefaultVoiceSelectionsByLanguage',
  ], { encoding: 'utf8' });
  const id = read.stdout?.match(/voiceId\s*=\s*"([^"]+)"/)?.[1] || null;
  if (!id) return { error: 'не удалось узнать системный голос — выберите его в Системных настройках' };
  return { name: id, flag: null, good: /premium|neural|enhanced/i.test(id) };
}

// Явно названный голос: только из тех, что видит say -v.
function namedVoice(asked) {
  const listed = spawnSync('say', ['-v', '?'], { encoding: 'utf8' });
  if (listed.status !== 0) return { error: 'say недоступен: это не macOS?' };
  const voices = listed.stdout.split('\n')
    .map((line) => line.match(/^(.+?)\s{2,}(\S+)/))
    .filter((m) => m && m[2] === 'ru_RU')
    .map((m) => m[1].trim());
  if (!voices.includes(asked)) {
    return { error: `голоса «${asked}» в системе нет. Есть: ${voices.join(', ') || 'ни одного русского'}` };
  }
  return { name: asked, flag: asked, good: /\((Premium|Enhanced)\)/.test(asked) };
}

function pickVoice() {
  const asked = option('voice');
  return asked ? namedVoice(asked) : systemVoice();
}

function loadManifest() {
  if (!existsSync(MANIFEST)) return {};
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8')).clips || {};
  } catch {
    return {};
  }
}

function seconds(file) {
  const info = spawnSync('afinfo', [file], { encoding: 'utf8' });
  const match = info.stdout?.match(/estimated duration: ([\d.]+)/);
  return match ? Number(match[1]) : 0;
}

// Записывает одну фразу. Аргументы массивом, НИКОГДА через шелл: текст
// русский и авторский, и одна кавычка в подписи иначе сломала бы команду.
function render(voice, text, id) {
  // Промежуточный файл именно .wav: say выводит формат по расширению, и
  // LEI16 в aiff (он big-endian) отваливается с «Opening output file failed».
  const raw = join(tmpdir(), `voice-${id}.wav`);
  const out = join(OUT, `${id}.${FORMAT}`);
  const said = spawnSync('say', [
    ...(voice ? ['-v', voice] : []),
    '-r', String(RATE), '-o', raw, '--data-format=LEI16@22050', text,
  ]);
  if (said.status !== 0) return `say не смог: ${said.stderr?.toString().trim()}`;
  const converted = spawnSync('afconvert', [
    '-f', 'm4af', '-d', `aac@${SAMPLE_RATE}`, '-c', '1', '-b', String(BITRATE), raw, out,
  ]);
  try { unlinkSync(raw); } catch { /* временный файл уже убрали */ }
  if (converted.status !== 0) return `afconvert не смог: ${converted.stderr?.toString().trim()}`;
  if (!existsSync(out) || statSync(out).size < MIN_BYTES) return 'файл вышел пустым';
  const length = seconds(out);
  if (length > MAX_SECONDS) {
    console.warn(`  ! ${length.toFixed(1)} с — ребёнок такое не дослушает: «${text}»`);
  }
  return null;
}

function main() {
  const voice = pickVoice();
  if (voice.error) {
    console.error(`[voice] ${voice.error}`);
    process.exit(1);
  }
  // Заморозить компактное качество в git строго хуже, чем говорить синтезом:
  // те же пять мегабайт и тот же робот, только теперь никто не заметит, что
  // это надо переделать.
  if (!voice.good && !flag('allow-compact')) {
    console.error(`[voice] выбранный голос выглядит компактным: ${voice.name}`);
    console.error('        Он звучит так же, как браузерный синтез, и записывать его');
    console.error('        в репозиторий незачем. Выберите нейросетевой:');
    console.error('        Системные настройки -> Универсальный доступ -> Read & Speak ->');
    console.error('        System voice -> Siri -> любой русский.');
    console.error('        Если очень надо прямо сейчас: npm run voice -- --allow-compact');
    process.exit(1);
  }

  const wanted = new Map();
  for (const [group, lines] of Object.entries(allPhrases())) {
    for (const line of lines) {
      const text = normalizeVoice(line);
      if (!text) continue;
      if (!wanted.has(text)) wanted.set(text, group);
    }
  }

  mkdirSync(OUT, { recursive: true });
  const known = loadManifest();
  // Расширение отрезаем по его длине, а не «последними пятью символами»:
  // с .m4a это отъедало ещё и символ хеша, ни один id не совпадал с манифестом,
  // и повторный запуск переписывал весь банк вместо «без изменений».
  const suffix = `.${FORMAT}`;
  const onDisk = new Set(readdirSync(OUT)
    .filter((f) => f.endsWith(suffix))
    .map((f) => f.slice(0, -suffix.length)));

  const clips = {};
  let added = 0;
  let kept = 0;
  const failed = [];
  for (const text of [...wanted.keys()].sort()) {
    const id = hash(text);
    clips[text] = id;
    if (known[text] === id && onDisk.has(id)) {
      kept += 1;
      continue;
    }
    const error = render(voice.flag, text, id);
    if (error) {
      failed.push(`${text}: ${error}`);
      continue;
    }
    added += 1;
    if (added % 25 === 0) console.log(`  ...записано ${added}`);
  }

  if (failed.length) {
    console.error(`[voice] не записалось ${failed.length}:`);
    for (const line of failed.slice(0, 10)) console.error(`  ${line}`);
    process.exit(1);
  }

  // Лишние файлы только докладываем: случайное переименование не должно
  // смахнуть банк одной командой.
  const used = new Set(Object.values(clips));
  const orphans = [...onDisk].filter((id) => !used.has(id));
  if (orphans.length && flag('prune')) {
    for (const id of orphans) unlinkSync(join(OUT, `${id}.${FORMAT}`));
  }

  // Манифест пишется ПОСЛЕДНИМ: тогда запись в нём без файла на диске
  // невозможна по построению.
  writeFileSync(MANIFEST, `${JSON.stringify({
    version: 1, voice: voice.name, rate: RATE, format: FORMAT, dir: DIR,
    clips: Object.fromEntries(Object.keys(clips).sort().map((k) => [k, clips[k]])),
  }, null, 1)}\n`);

  const bytes = readdirSync(OUT).reduce((sum, f) => sum + statSync(join(OUT, f)).size, 0);
  console.log(`[voice] голос: ${voice.name}`);
  console.log(`[voice] фраз ${Object.keys(clips).length}: добавлено ${added}, без изменений ${kept}`);
  console.log(`[voice] лишних файлов ${orphans.length}${orphans.length && !flag('prune') ? ' (удалить: npm run voice:prune)' : ''}`);
  console.log(`[voice] размер банка ${(bytes / 1024 / 1024).toFixed(1)} МБ`);
  if (bytes > WARN_BYTES) console.warn('[voice] банк тяжелее восьми мегабайт — стоит подумать про формат');
}

main();
