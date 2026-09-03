// Магазин, медали и уровни сложности.
//
// Медалей тринадцать, и в альбоме они лежат сеткой рядом — значит каждая
// обязана отличаться от соседок с одного взгляда. Закрытая медаль показывает
// значок под серым фильтром CSS, поэтому силуэт важнее цвета: серая медаль
// «Ни царапины» и серая «Против толпы» должны различаться формой.

import { disc, ellipse, rect, poly, line, star, heart, arc } from './shapes.js';

export const SHOP_ICONS = {
  // Кроссовок с крылышком — «быстрые».
  'shop-speed': [
    { d: `M3 24h24a3 3 0 0 0 0-6l-9-1-6-6H6l-3 6z`, fill: 'sky' },
    { d: line([[8, 17], [11, 20]]), stroke: 'white', width: 2 },
    { d: line([[12, 15], [15, 19]]), stroke: 'white', width: 2 },
    { d: poly([[20, 12], [30, 6], [26, 15]]), fill: 'white', alpha: 0.8 },
  ],
  'shop-heart': [{ d: heart(16, 16, 14), fill: 'blood' }],
  // Сильный старт даёт звёзды оружию — звёзды и рисуем. Бицепс (как было в
  // эмодзи) — метафора, а звёзды ребёнок увидит в бою буквально: сколько
  // звёзд, столько силы. Двух попыток нарисовать узнаваемую руку хватило.
  'shop-star': [
    { d: star(17, 14, 12), fill: 'gold' },
    { d: star(6, 24, 6), fill: 'goldDark' },
    { d: star(27, 25, 5), fill: 'goldDark' },
  ],

  // Магнит подковой.
  'shop-magnet': [
    { d: `M7 27V16a9 9 0 0 1 18 0v11h-6V16a3 3 0 0 0-6 0v11z`, fill: 'blood' },
    { d: rect(7, 24, 6, 4), fill: 'metal' },
    { d: rect(19, 24, 6, 4), fill: 'metal' },
  ],
  // Собачья морда. Уши торчком делали из неё кота — у собаки они висят.
  'shop-dog': [
    { d: ellipse(6, 16, 4, 8), fill: 'wood' },
    { d: ellipse(26, 16, 4, 8), fill: 'wood' },
    { d: ellipse(16, 18, 10, 9), fill: 'gold' },
    { d: disc(12, 16, 1.8), fill: 'dark' },
    { d: disc(20, 16, 1.8), fill: 'dark' },
    { d: ellipse(16, 22, 3, 2.2), fill: 'dark' },
  ],
  // Робот-помощник: голова с антенной.
  'shop-drone': [
    { d: line([[16, 3], [16, 8]]), stroke: 'metalDark', width: 2 },
    { d: disc(16, 3, 2), fill: 'blood' },
    { d: rect(5, 8, 22, 18, 5), fill: 'metal' },
    { d: rect(9, 13, 14, 7, 3), fill: 'dark' },
    { d: disc(12.5, 16.5, 2), fill: 'sky' },
    { d: disc(19.5, 16.5, 2), fill: 'sky' },
  ],
};

export const DIFFICULTY_ICONS = {
  // Цыплёнок в скорлупе — «легко».
  'difficulty-easy': [
    { d: ellipse(16, 15, 8, 8.5), fill: 'gold' },
    { d: poly([[16, 15], [21, 18], [16, 20]]), fill: 'fire' },
    { d: disc(13, 13, 1.6), fill: 'dark' },
    { d: `M6 21h20l-3 8H9z`, fill: 'paper' },
    { d: `M6 21l4 3 4-3 4 3 4-3 4 3`, stroke: 'paperEdge', width: 1.8 },
  ],
  // Улыбка — «нормально».
  'difficulty-normal': [
    { d: disc(16, 16, 13), fill: 'gold' },
    { d: disc(11.5, 13, 2), fill: 'dark' },
    { d: disc(20.5, 13, 2), fill: 'dark' },
    { d: arc(16, 17, 7, 0.5, Math.PI - 0.5), stroke: 'dark', width: 2.6 },
  ],
  // Пламя — «сложно». Тот же язык, что у огнемёта, но иного цвета: они в
  // одном списке не встречаются никогда.
  'difficulty-hard': [
    { d: `M16 3c6 8 3 9 5 12s4-1 4-1c2 4 1 17-9 17S5 21 8 15c1 3 3 4 4 2s-2-6 4-14z`, fill: 'fire' },
    { d: `M16 17c3 3 2 5 1 7s-4 1-4-2 2-3 3-5z`, fill: 'gold' },
  ],
};

export const MEDAL_ICONS = {
  // Ни царапины — щит.
  'medal-noHit': [
    { d: `M16 3l12 4v10c0 7-6 11-12 13C10 28 4 24 4 17V7z`, fill: 'sky' },
    { d: line([[10, 16], [14.5, 21], [22, 11]]), stroke: 'white', width: 3 },
  ],
  // Супер-финал — взрыв.
  'medal-bossByAbility': [
    { d: star(16, 16, 14, 8, 0.42), fill: 'fire' },
    { d: star(16, 16, 8, 8, 0.42), fill: 'gold' },
  ],
  // Выросло — звезда со стрелкой вверх.
  'medal-evolved': [
    { d: star(16, 18, 12), fill: 'gold' },
    { d: poly([[16, 2], [22, 9], [10, 9]]), fill: 'leaf' },
  ],
  // Полный арсенал — рюкзак. Первая версия была просто зелёной аркой и
  // читалась как надгробие: рюкзак делают лямки и карман, а не силуэт.
  'medal-arsenal': [
    { d: arc(16, 12, 7, Math.PI, 0), stroke: 'wood', width: 2.6 },
    { d: rect(5, 11, 22, 18, 4), fill: 'leaf' },
    { d: rect(5, 11, 22, 6, 3), fill: 'zombieDark' },
    { d: rect(10, 19, 12, 8, 2), fill: 'paper' },
    { d: rect(14, 17, 4, 3, 1), fill: 'gold' },
  ],
  // Сто зомби — три подряд.
  'medal-century': [
    { d: rect(2, 12, 8, 15, 2.5), fill: 'zombieDark' },
    { d: rect(22, 12, 8, 15, 2.5), fill: 'zombieDark' },
    { d: rect(11, 8, 10, 19, 3), fill: 'zombie' },
    { d: disc(14, 14, 1.6), fill: 'white' },
    { d: disc(18, 14, 1.6), fill: 'white' },
  ],
  // Настоящий герой — плащ со звездой.
  'medal-hardWin': [
    { d: poly([[16, 4], [29, 28], [3, 28]]), fill: 'blood' },
    { d: star(16, 19, 8), fill: 'gold' },
  ],
  // Не боюсь темноты — месяц со звёздами.
  'medal-nightWin': [
    { d: `M22 4a13 13 0 1 0 5 21A11 11 0 0 1 22 4z`, fill: 'gold' },
    { d: star(26, 8, 4, 4, 0.36), fill: 'white' },
  ],
  // Против толпы — стена голов. Кругами читалось как клевер: голову зомби
  // делает угловатость и глаза.
  'medal-hordeWin': [
    { d: rect(1, 8, 10, 13, 3), fill: 'zombieDark' },
    { d: rect(21, 8, 10, 13, 3), fill: 'zombieDark' },
    { d: rect(6, 16, 10, 14, 3), fill: 'zombie' },
    { d: rect(16, 16, 10, 14, 3), fill: 'zombie' },
    { d: disc(8.5, 21, 1.5), fill: 'white' },
    { d: disc(13.5, 21, 1.5), fill: 'white' },
    { d: disc(18.5, 21, 1.5), fill: 'white' },
    { d: disc(23.5, 21, 1.5), fill: 'white' },
  ],
  // Вдвоём веселее — два героя рядом. Рукопожатие на шестнадцати пикселях
  // читалось как две стрелки навстречу.
  'medal-duo': [
    { d: `M10 29a7 7 0 0 1 0-13 7 7 0 0 1 0 13z`, fill: 'sky' },
    { d: `M3 29a7 7 0 0 1 14 0z`, fill: 'sky' },
    { d: `M15 29a7 7 0 0 1 14 0z`, fill: 'blood' },
    { d: disc(10, 11, 5.5), fill: 'skin' },
    { d: disc(22, 11, 5.5), fill: 'skin' },
  ],
  // Далеко зашёл — флажок на вершине.
  'medal-deepRun': [
    { d: poly([[2, 28], [12, 10], [20, 22], [24, 16], [30, 28]]), fill: 'stone' },
    { d: poly([[12, 10], [16, 14], [12, 18]]), fill: 'paper' },
    { d: line([[12, 4], [12, 18]]), stroke: 'metalDark', width: 2 },
    { d: poly([[12, 4], [24, 8], [12, 12]]), fill: 'blood' },
  ],
  // Все герои — театральная маска.
  'medal-allHeroes': [
    { d: `M5 6h22v11c0 7-5 12-11 12S5 24 5 17z`, fill: 'gold' },
    { d: poly([[9, 13], [15, 13], [12, 18]]), fill: 'dark' },
    { d: poly([[17, 13], [23, 13], [20, 18]]), fill: 'dark' },
    { d: arc(16, 20, 5, 0.4, Math.PI - 0.4), stroke: 'dark', width: 2.2 },
  ],
  // Всё вернул — карта со звездой.
  'medal-pagesBack': [
    { d: poly([[3, 8], [12, 5], [21, 8], [29, 5], [29, 25], [21, 28], [12, 25], [3, 28]]),
      fill: 'paper' },
    { d: line([[12, 5], [12, 25]]), stroke: 'paperEdge', width: 1.6 },
    { d: line([[21, 8], [21, 28]]), stroke: 'paperEdge', width: 1.6 },
    { d: star(16, 16, 7), fill: 'gold' },
  ],
  // Полный альбом — книга со звездой.
  'medal-collector': [
    { d: rect(5, 4, 22, 25, 3), fill: 'blood' },
    { d: rect(9, 4, 18, 25, 2), fill: 'paper' },
    { d: star(18, 16, 7), fill: 'gold' },
  ],
};
