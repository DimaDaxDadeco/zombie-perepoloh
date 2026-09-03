// Иконки интерфейса: значки, нарисованные кодом вместо системных эмодзи.
//
// ЗАЧЕМ. Эмодзи рисует шрифт операционной системы: на маке одни картинки, на
// Windows другие, на Linux часть может отсутствовать вовсе. Ребёнок пяти лет
// читать не умеет и ориентируется в игре ИСКЛЮЧИТЕЛЬНО по значкам — значит на
// чужом компьютере игра для него выглядит иначе, а местами ломается.
//
// ГРАНИЦА. Иконка — это значок интерфейса: оружие в слоте, товар в магазине,
// медаль в альбоме. ПЕРСОНАЖИ сюда не переезжают: герой, зомби и босс всюду
// рисуются тем же кодом, что и в бою (Overlay.paintHero и соседи), и в этом
// весь смысл альбома. Правило короткое: персонаж — canvas, значок — SVG.
//
// ДВА РЕНДЕРЕРА, ОДНО ОПРЕДЕЛЕНИЕ. Значки нужны в двух несовместимых местах:
// в разметке экранов (её собирают шаблонными строками через setContent) и на
// игровом canvas (HUD). Поэтому иконка описывается один раз, а отрисовок две:
//
//   icon(name)                 → строка <svg>, вставляется прямо в шаблон
//   drawIcon(ctx, name, x, y)  → рисует на canvas через Path2D
//
// Разойтись они не могут по устройству: обе берут ОДНУ И ТУ ЖЕ строку пути,
// собранную помощниками из icons/shapes.js. Круг там — тоже путь, а не
// ctx.arc и не <circle>.
//
// РАЗМЕР В EM. icon() по умолчанию не ставит ни width, ни height — их даёт
// CSS-правило `.icon { width: 1.15em; height: 1.15em }`. Благодаря этому все
// прежние правила вида `.card__emoji { font-size: 60px }` продолжают работать
// без единой правки, включая оба медиазапроса и посчитанную вручную раскладку
// выбора героя под 375 пикселей.
//
// НИКАКОГО DOM ПРИ ИМПОРТЕ. Модуль обязан импортироваться в Node: автотест
// сверяет имена иконок из конфига с реестром. Path2D существует только в
// браузере, поэтому он строится лениво — при первой отрисовке на canvas.

import { ICONS } from './icons/registry.js';
import { resolveColor } from './icons/palette.js';
import { BOX } from './icons/shapes.js';

export const ICON_NAMES = Object.keys(ICONS).sort();

export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(ICONS, name);
}

// Заглушка для неизвестного имени. Молчать нельзя: опечатку в имени иначе
// заметит только ребёнок, и то не сразу. Ровно эта грабля уже описана в
// документации для декораций фона, где забытая ветка молча оставляла фон
// голым.
const MISSING = [
  { d: `M2 2h28v28h-28z`, fill: 'blood' },
  { d: `M11 10h10v3h-3.5v6h-3v-6h-3.5z`, fill: 'white' },
];
const warned = new Set();

function partsOf(name) {
  if (hasIcon(name)) return ICONS[name];
  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`[icons] нет иконки «${name}»`);
  }
  return MISSING;
}

// --- Разметка для экранов ---

// size: число пикселей либо 'em' (по умолчанию) — тогда размер задаёт
// font-size родителя, как это делало эмодзи.
export function icon(name, size = 'em', { color, className = '' } = {}) {
  const parts = partsOf(name);
  const box = size === 'em' ? '' : ` width="${size}" height="${size}"`;
  // Цвет строкой на самом svg: части с цветом 'ink' наследуют его через
  // currentColor и красятся заодно с наведением на кнопку.
  const tint = color ? ` style="color:${color}"` : '';
  const body = parts.map(svgPart).join('');
  return `<svg class="icon icon--${name}${className ? ` ${className}` : ''}"`
    + ` viewBox="0 0 ${BOX} ${BOX}"${box}${tint} aria-hidden="true" focusable="false">${body}</svg>`;
}

function svgPart(part) {
  const attrs = [`d="${part.d}"`];
  attrs.push(part.fill ? `fill="${resolveColor(part.fill)}"` : 'fill="none"');
  if (part.stroke) {
    attrs.push(`stroke="${resolveColor(part.stroke)}"`);
    attrs.push(`stroke-width="${part.width ?? 2}"`);
    attrs.push(`stroke-linecap="${part.cap || 'round'}"`);
    attrs.push('stroke-linejoin="round"');
  }
  if (part.alpha !== undefined) attrs.push(`opacity="${part.alpha}"`);
  return `<path ${attrs.join(' ')}/>`;
}

// --- Отрисовка на canvas ---

// Path2D разбирает строку пути, и делать это шестьдесят раз в секунду для
// каждого значка HUD незачем — кешируем по имени иконки.
const pathCache = new Map();

function pathsOf(name) {
  let cached = pathCache.get(name);
  if (!cached) {
    cached = partsOf(name).map((part) => ({ part, path: new Path2D(part.d) }));
    pathCache.set(name, cached);
  }
  return cached;
}

// Центр иконки — в (x, y), как у сердечка в HUD: счётчики и слоты
// раскладываются по центрам, а не по левым верхним углам.
export function drawIcon(ctx, name, x, y, size, { color = '#ffffff', alpha = 1 } = {}) {
  const scale = size / BOX;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(scale, scale);
  for (const { part, path } of pathsOf(name)) {
    ctx.globalAlpha = alpha * (part.alpha ?? 1);
    if (part.fill) {
      ctx.fillStyle = resolveColor(part.fill, color);
      ctx.fill(path);
    }
    if (part.stroke) {
      ctx.strokeStyle = resolveColor(part.stroke, color);
      ctx.lineWidth = part.width ?? 2;
      ctx.lineCap = part.cap || 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(path);
    }
  }
  ctx.restore();
}

// Значок поверх игрового поля обязан читаться на любом фоне — космос тёмный,
// каток светлый. HUD рисует текст белым с тёмной обводкой; иконка рядом без
// такой же подложки выглядит жиже и на светлой теме теряется.
export function drawIconOnField(ctx, name, x, y, size, options = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 3;
  drawIcon(ctx, name, x, y, size, options);
  ctx.restore();
}
