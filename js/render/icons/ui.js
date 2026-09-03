// Интерфейсные значки: кнопки, состояния, счётчики.
//
// Рисуются в квадрате 32×32 помощниками из shapes.js. Главная проверка для
// каждого — стенд preview.html#icons на РАЗМЕРЕ 16: именно столько остаётся
// значку в слоте оружия на телефоне, и силуэт обязан читаться там, а не
// только на девяноста шести пикселях.
//
// Цвет 'ink' означает «наследовать цвет текста»: такие значки красятся
// цветом кнопки, на которой стоят, вместе с наведением и выделением. Всё
// остальное — свои цвета из палитры.

import { disc, ring, rect, poly, line, star, heart, spark, arc } from './shapes.js';

// Стрелка со стеблем: подпись «← ↑ → ↓ или геймпад» на экране выбора игроков
// это не украшение, а инструкция, как ходить.
function arrowAt(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const at = (fx, fy) => [16 + fx * c - fy * s, 16 + fx * s + fy * c];
  return poly([at(9, 0), at(1, -7), at(1, -3), at(-9, -3), at(-9, 3), at(1, 3), at(1, 7)]);
}

// Динамик без волн — общая часть для трёх значков звука.
const SPEAKER = poly([[6, 13], [10, 13], [15, 8], [15, 24], [10, 19], [6, 19]]);

export const UI_ICONS = {
  'ui-play': [{ d: poly([[11, 6], [27, 16], [11, 26]]), fill: 'ink' }],
  'ui-back': [{ d: poly([[21, 6], [5, 16], [21, 26]]), fill: 'ink' }],

  'ui-check': [{ d: line([[6, 17], [13, 24], [26, 8]]), stroke: 'ink', width: 4.5 }],

  // Пройдено. Зелёный кружок с галочкой — на карте кампании он стоит поверх
  // тёмного медальона, и без подложки белая галочка на нём тонет.
  'ui-done': [
    { d: disc(16, 16, 13), fill: 'leaf' },
    { d: line([[9, 16.5], [14, 21.5], [23, 11]]), stroke: 'white', width: 3.6 },
  ],

  'ui-speak': [
    { d: SPEAKER, fill: 'ink' },
    { d: arc(15, 16, 6, -0.9, 0.9), stroke: 'ink', width: 2.2 },
  ],
  'ui-sound-on': [
    { d: SPEAKER, fill: 'ink' },
    { d: arc(15, 16, 5.5, -0.9, 0.9), stroke: 'ink', width: 2.2 },
    { d: arc(15, 16, 9.5, -0.85, 0.85), stroke: 'ink', width: 2.2 },
  ],
  'ui-sound-off': [
    { d: SPEAKER, fill: 'ink' },
    { d: line([[20, 12], [28, 20]]), stroke: 'ink', width: 2.6 },
    { d: line([[28, 12], [20, 20]]), stroke: 'ink', width: 2.6 },
  ],

  'ui-pause': [
    { d: rect(9, 7, 5.5, 18, 2), fill: 'ink' },
    { d: rect(17.5, 7, 5.5, 18, 2), fill: 'ink' },
  ],

  // Искра-звёздочка: всё «волшебное» — новая игра, способность, победа.
  'ui-spark': [
    { d: spark(15, 14, 10), fill: 'gold' },
    { d: spark(25, 24, 5), fill: 'gold', alpha: 0.85 },
    { d: spark(7, 25, 3.5), fill: 'gold', alpha: 0.7 },
  ],

  'ui-home': [
    { d: poly([[16, 4], [29, 15], [25, 15], [25, 28], [7, 28], [7, 15], [3, 15]]), fill: 'fire' },
    { d: rect(13, 18, 6, 10, 1), fill: 'paper' },
  ],

  // Тележка магазина: корзина, ручка и два колеса.
  'ui-shop': [
    { d: poly([[8, 10], [28, 10], [25, 21], [11, 21]]), fill: 'sky' },
    { d: line([[3, 5], [7, 5], [11, 21]]), stroke: 'metalDark', width: 2.4 },
    { d: disc(12, 26, 2.6), fill: 'metalDark' },
    { d: disc(23, 26, 2.6), fill: 'metalDark' },
  ],

  // Раскрытая книга: две страницы и корешок между ними.
  'ui-album': [
    { d: poly([[16, 8], [16, 27], [4, 24], [4, 5]]), fill: 'paper' },
    { d: poly([[16, 8], [16, 27], [28, 24], [28, 5]]), fill: 'paperEdge' },
    { d: line([[16, 8], [16, 27]]), stroke: 'wood', width: 2 },
  ],

  'ui-money': [
    { d: rect(3, 8, 26, 16, 2.5), fill: 'leaf' },
    { d: ring(16, 16, 5, 3), fill: 'paper' },
  ],

  // Клетчатый флажок финиша: четыре клетки читаются и на 16px, шахматка из
  // девяти превращается в серое пятно.
  'ui-flag': [
    { d: line([[8, 4], [8, 29]]), stroke: 'metalDark', width: 2.4 },
    { d: rect(9, 5, 18, 13, 1), fill: 'paper' },
    { d: rect(9, 5, 9, 6.5), fill: 'dark' },
    { d: rect(18, 11.5, 9, 6.5), fill: 'dark' },
  ],

  // «Ты здесь»: булавка остриём вниз.
  'ui-pin': [
    { d: `M16 29C16 29 26 18.5 26 12.5A10 10 0 0 0 6 12.5C6 18.5 16 29 16 29z`, fill: 'blood' },
    { d: disc(16, 12.5, 4), fill: 'paper' },
  ],

  'ui-lock': [
    { d: arc(16, 13, 6, Math.PI, 0), stroke: 'metalDark', width: 3.4, cap: 'butt' },
    { d: rect(6, 13, 20, 15, 3), fill: 'gold' },
    { d: disc(16, 20, 2.6), fill: 'goldDark' },
    { d: rect(14.8, 20, 2.4, 5, 1), fill: 'goldDark' },
  ],

  // Закрытая наклейка альбома. Вопрос собран из дуги и точки: буква из
  // системного шрифта — ровно та зависимость, от которой мы уходим.
  'ui-question': [
    { d: disc(16, 16, 13), fill: 'night' },
    { d: `M11 12.5A5 5 0 0 1 21 13c0 3.2-4 3.6-4 6.6`, stroke: 'white', width: 3, cap: 'round' },
    { d: disc(17, 24, 1.9), fill: 'white' },
  ],

  'ui-crown': [
    { d: poly([[3, 24], [5, 9], [11, 16], [16, 6], [21, 16], [27, 9], [29, 24]]), fill: 'gold' },
    { d: rect(3, 24, 26, 4, 1.5), fill: 'goldDark' },
    { d: disc(16, 15, 2), fill: 'blood' },
  ],

  // Страница альбома с загнутым уголком.
  'ui-page': [
    { d: poly([[7, 3], [20, 3], [26, 9], [26, 29], [7, 29]]), fill: 'paper' },
    { d: poly([[20, 3], [26, 9], [20, 9]]), fill: 'paperEdge' },
    { d: line([[11, 14], [22, 14]]), stroke: 'paperEdge', width: 2 },
    { d: line([[11, 19], [22, 19]]), stroke: 'paperEdge', width: 2 },
    { d: line([[11, 24], [18, 24]]), stroke: 'paperEdge', width: 2 },
  ],

  // Медалька: та же лента и та же звезда, что у медальки на земле.
  'ui-medal': [
    { d: poly([[10, 2], [15, 2], [18, 13], [12, 13]]), fill: 'blood' },
    { d: poly([[22, 2], [17, 2], [14, 13], [20, 13]]), fill: 'sky' },
    { d: disc(16, 20, 9.5), fill: 'gold' },
    { d: star(16, 20, 6), fill: 'goldDark' },
  ],

  // Голова зомби — подпись к счётчику, а не портрет: настоящий спрайт на
  // двадцати пикселях превращается в зелёное пятно.
  'ui-zombie': [
    { d: rect(7, 8, 18, 19, 5), fill: 'zombie' },
    { d: poly([[7, 11], [10, 5], [13, 10], [17, 4], [20, 10], [24, 6], [25, 12]]), fill: 'zombieDark' },
    { d: disc(12.5, 16, 2.4), fill: 'white' },
    { d: disc(21, 16, 2.4), fill: 'white' },
    { d: disc(12.5, 16, 1.1), fill: 'dark' },
    { d: disc(21, 16, 1.1), fill: 'dark' },
    { d: line([[12, 22], [20, 22]]), stroke: 'zombieDark', width: 2 },
  ],

  'ui-star': [{ d: star(16, 16, 13), fill: 'gold' }],
  'ui-star-empty': [{ d: star(16, 16, 12), stroke: 'gold', width: 2.4, alpha: 0.55 }],
  'ui-dot': [{ d: disc(16, 16, 8), fill: 'gold' }],
  'ui-dot-empty': [{ d: ring(16, 16, 8, 5), fill: 'gold', alpha: 0.4 }],

  'ui-heart': [{ d: heart(16, 15, 13), fill: 'blood' }],
  'ui-heart-empty': [{ d: heart(16, 15, 13), fill: 'white', alpha: 0.25 }],

  // Секундомер: кнопка сверху и стрелки внутри.
  'ui-timer': [
    { d: rect(13, 2, 6, 4, 1), fill: 'metalDark' },
    { d: disc(16, 18, 12), fill: 'metal' },
    { d: disc(16, 18, 9.5), fill: 'white' },
    { d: line([[16, 18], [16, 11.5]]), stroke: 'dark', width: 2.2 },
    { d: line([[16, 18], [21, 20]]), stroke: 'dark', width: 2.2 },
  ],

  // Победа: хлопушка с конфетти.
  'ui-party': [
    { d: poly([[4, 29], [13, 8], [24, 19]]), fill: 'fire' },
    { d: poly([[4, 29], [8.5, 18.5], [15.5, 25.5]]), fill: 'gold' },
    { d: disc(25, 7, 2.4), fill: 'sky' },
    { d: disc(29, 14, 2), fill: 'leaf' },
    { d: disc(20, 4, 1.8), fill: 'blood' },
  ],

  // Поражение: не страшное, а смущённое лицо — правило «нелепый, а не
  // страшный» действует и на значки.
  'ui-sad': [
    { d: disc(16, 16, 13), fill: 'gold' },
    { d: disc(11.5, 13.5, 2), fill: 'dark' },
    { d: disc(20.5, 13.5, 2), fill: 'dark' },
    { d: `M10 23q6-5 12 0`, stroke: 'dark', width: 2.4 },
    { d: `M26 8q3 4 0 6q-3-2 0-6z`, fill: 'sky' },
  ],

  // Силуэт героя в плаще — для подписей «кто играет» и кадров истории.
  'ui-hero': [
    { d: poly([[16, 9], [27, 27], [5, 27]]), fill: 'blood' },
    { d: rect(11, 12, 10, 15, 3), fill: 'sky' },
    { d: disc(16, 8, 5.5), fill: 'skin' },
    { d: star(16, 18, 4), fill: 'gold' },
  ],

  // Двое героев рядом. Отдельный значок, а не два подряд: два значка в одном
  // боксе переносятся на вторую строку, и карточка «Вдвоём» становилась вдвое
  // выше соседней.
  'ui-heroes': [
    { d: poly([[9, 12], [17, 27], [1, 27]]), fill: 'blood' },
    { d: rect(5, 14, 8, 13, 2.5), fill: 'sky' },
    { d: disc(9, 11, 4.5), fill: 'skin' },
    { d: poly([[23, 12], [31, 27], [15, 27]]), fill: 'fire' },
    { d: rect(19, 14, 8, 13, 2.5), fill: 'leaf' },
    { d: disc(23, 11, 4.5), fill: 'skin' },
  ],

  // Значки задач сюжетных глав. Все четыре встречаются в HUD на 16 пикселях,
  // поэтому силуэт важнее деталей.
  'ui-cage': [
    { d: rect(5, 8, 22, 19, 3), fill: 'metalDark' },
    { d: rect(8, 11, 16, 13, 2), fill: 'dark' },
    { d: line([[12, 11], [12, 24]]), stroke: 'metal', width: 2.2 },
    { d: line([[16, 11], [16, 24]]), stroke: 'metal', width: 2.2 },
    { d: line([[20, 11], [20, 24]]), stroke: 'metal', width: 2.2 },
    { d: rect(11, 4, 10, 4, 2), fill: 'metalDark' },
  ],

  'ui-fire': [
    { d: `M16 3c6 8 3 9 5 12s4-1 4-1c2 4 1 17-9 17S5 21 8 15c1 3 3 4 4 2s-2-6 4-14z`, fill: 'fire' },
    { d: `M16 17c3 3 2 5 1 7s-4 1-4-2 2-3 3-5z`, fill: 'gold' },
  ],

  'ui-bag': [
    { d: `M9 12h14l3 17H6z`, fill: 'wood' },
    { d: rect(11, 8, 10, 5, 2), fill: 'goldDark' },
    { d: disc(16, 21, 3), fill: 'gold' },
  ],

  'ui-box': [
    { d: rect(4, 11, 24, 17, 2), fill: 'wood' },
    { d: rect(4, 11, 24, 5, 2), fill: 'goldDark' },
    { d: rect(14, 11, 4, 17), fill: 'gold' },
  ],

  'ui-trophy': [
    { d: poly([[9, 4], [23, 4], [22, 15], [10, 15]]), fill: 'gold' },
    { d: `M9 6C3 6 3 15 10.5 15`, stroke: 'goldDark', width: 2.4 },
    { d: `M23 6C29 6 29 15 21.5 15`, stroke: 'goldDark', width: 2.4 },
    { d: rect(13.5, 15, 5, 6), fill: 'goldDark' },
    { d: rect(8, 24, 16, 4, 1.5), fill: 'goldDark' },
  ],

  // Сложенная карта путешествия: три створки и пунктир дороги.
  'ui-map': [
    { d: poly([[3, 8], [12, 5], [12, 25], [3, 28]]), fill: 'leaf' },
    { d: poly([[12, 5], [21, 8], [21, 28], [12, 25]]), fill: 'paper' },
    { d: poly([[21, 8], [29, 5], [29, 25], [21, 28]]), fill: 'leaf' },
    { d: line([[7, 22], [11, 14], [17, 18], [22, 10]]), stroke: 'blood', width: 2 },
  ],

  'ui-arrow-right': [{ d: arrowAt(0), fill: 'ink' }],
  'ui-arrow-left': [{ d: arrowAt(Math.PI), fill: 'ink' }],
  'ui-arrow-up': [{ d: arrowAt(-Math.PI / 2), fill: 'ink' }],
  'ui-arrow-down': [{ d: arrowAt(Math.PI / 2), fill: 'ink' }],

  // Геймпад — во второй половине той же подписи «или геймпад».
  'ui-gamepad': [
    { d: rect(2, 10, 28, 14, 6), fill: 'metalDark' },
    { d: rect(7.5, 15, 6, 2.4, 1), fill: 'white' },
    { d: rect(9.3, 13.2, 2.4, 6, 1), fill: 'white' },
    { d: disc(22, 15.5, 2), fill: 'white' },
    { d: disc(25.5, 19, 2), fill: 'white' },
  ],
};
