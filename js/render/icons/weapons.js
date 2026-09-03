// Значки оружий и их эволюций — двадцать девять штук.
//
// Главное ограничение здесь не художественное, а размерное: в слоте HUD
// значку достаётся около двадцати пикселей, а на телефоне меньше. Двадцать
// девять различимых силуэтов на таком размере не нарисовать.
//
// Поэтому эволюция НАМЕРЕННО делит силуэт с родителем и отличается цветом или
// добавкой: лавовая дорожка — та же комета, но раскалённая, двойной меч — тот
// же клинок, но два. Различимых силуэтов остаётся пятнадцать, и это уже
// посильно. Тот же приём применён в WEAPON_IN_HAND, где эволюция берёт
// отрисовку родителя.
//
// Значок показывает ЭФФЕКТ, а не ствол: капля, помидор, молния, снежинка.
// Ребёнок связывает слот с тем, что летит по экрану, а не с рукояткой в руке.

import { disc, ring, ellipse, rect, poly, line, drop, bolt, arc, around } from './shapes.js';

// Снежинка: три луча с засечками на концах. Шести лучей не делаем — на
// шестнадцати пикселях они сливаются в кляксу, проверено на стенде.
function snowflake(cx, cy, r) {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    const dx = Math.cos(a) * r;
    const dy = Math.sin(a) * r;
    // Засечка — «птичка» поперёк луча, она и делает снежинку снежинкой.
    const bx = Math.cos(a + 1.15) * r * 0.32;
    const by = Math.sin(a + 1.15) * r * 0.32;
    parts.push(line([[cx - dx, cy - dy], [cx + dx, cy + dy]]));
    for (const sign of [1, -1]) {
      const tx = cx + dx * 0.58 * sign;
      const ty = cy + dy * 0.58 * sign;
      parts.push(line([[tx - bx, ty - by], [tx, ty], [tx + bx, ty + by]]));
    }
  }
  return parts.join('');
}

// Язык пламени: остриё сверху, круглое донце, волна сбоку.
function flame(cx, cy, w, h) {
  return `M${cx} ${cy - h}`
    + `c${w * 0.9} ${h * 0.42} ${w * 0.2} ${h * 0.5} ${w * 0.45} ${h * 0.72}`
    + `a${w} ${w} 0 1 1 ${-w * 1.9} 0`
    + `c${w * 0.25} ${-h * 0.34} ${-w * 0.35} ${-h * 0.3} ${w * 0.95} ${-h}z`;
}

// Спираль вихря: три витка сужающейся дуги. Общая основа вертушки, торнадо и
// урагана — они и в игре родня.
function swirl(cx, cy, r) {
  return `M${cx + r} ${cy}`
    + `A${r} ${r} 0 1 1 ${cx} ${cy - r}`
    + `A${r * 0.66} ${r * 0.66} 0 1 0 ${cx} ${cy + r * 0.66}`
    + `A${r * 0.36} ${r * 0.36} 0 1 1 ${cx - r * 0.36} ${cy}`;
}

// Бумеранг — толстый уголок, нарисованный ОБВОДКОЙ. Первая версия была
// залитой фигурой с изогнутыми боками и на шестнадцати пикселях читалась как
// клякса: у заливки на таком размере нет места на переменную толщину.
function boomerangShape(cx, cy, r) {
  return `M${cx - r} ${cy + r * 0.55}L${cx} ${cy - r * 0.6}L${cx + r} ${cy + r * 0.55}`;
}

export const WEAPON_ICONS = {
  // --- Вода ---
  'weapon-water': [
    { d: drop(16, 20, 8.5, 20), fill: 'water' },
    { d: ellipse(12.5, 21, 2.4, 3.2), fill: 'white', alpha: 0.5 },
  ],
  'weapon-watercannon': [
    { d: `M2 24q6-9 13-4t15-8v14z`, fill: 'waterDark' },
    { d: `M2 26q6-8 13-3t15-7`, stroke: 'water', width: 3 },
    { d: drop(9, 11, 3.5, 8), fill: 'water' },
    { d: drop(23, 9, 3, 7), fill: 'water', alpha: 0.75 },
  ],

  // --- Помидор ---
  'weapon-tomato': [
    { d: disc(16, 19, 10.5), fill: 'blood' },
    { d: ellipse(12, 16, 3, 2), fill: 'white', alpha: 0.4 },
    { d: poly([[16, 9], [11, 5], [13, 10], [8, 9], [12, 12],
      [20, 12], [24, 9], [19, 10], [21, 5]]), fill: 'leaf' },
  ],
  'weapon-tomatocannon': [
    { d: disc(9, 22, 7), fill: 'blood' },
    { d: disc(23, 22, 7), fill: 'blood' },
    { d: disc(16, 12, 8), fill: 'blood' },
    { d: poly([[16, 5], [12, 2], [14, 6], [18, 6], [20, 2]]), fill: 'leaf' },
  ],

  // --- Молния ---
  'weapon-lightning': [{ d: bolt(16, 16, 26), fill: 'lightning' }],
  'weapon-stormbolt': [
    { d: `M9 17a6 6 0 0 1 1-11 8 8 0 0 1 15 2 5 5 0 0 1-1 9z`, fill: 'metal' },
    { d: bolt(16, 22, 15), fill: 'lightning' },
  ],

  // --- Вертушка ---
  'weapon-spinner': [
    { d: swirl(16, 16, 11), stroke: 'sky', width: 3.4 },
    { d: disc(16, 16, 2.6), fill: 'white' },
  ],
  'weapon-cyclone': [
    { d: ring(16, 16, 13, 10), fill: 'sky' },
    { d: ring(16, 16, 7.5, 4.5), fill: 'water' },
    { d: disc(16, 16, 2.4), fill: 'white' },
  ],

  // --- Ракета-морковка ---
  'weapon-rocket': [
    { d: poly([[16, 3], [11, 10], [16, 10]]), fill: 'leaf' },
    { d: poly([[16, 3], [21, 10], [16, 10]]), fill: 'leaf' },
    { d: poly([[16, 29], [23, 9], [9, 9]]), fill: 'fire' },
    { d: line([[12, 14], [19, 14]]), stroke: 'white', width: 1.6, alpha: 0.45 },
    { d: line([[13.5, 19], [18, 19]]), stroke: 'white', width: 1.6, alpha: 0.45 },
  ],
  'weapon-carrotswarm': [
    { d: poly([[7, 25], [11, 9], [3, 9]]), fill: 'fire' },
    { d: poly([[25, 25], [29, 9], [21, 9]]), fill: 'fire' },
    { d: poly([[16, 30], [22, 8], [10, 8]]), fill: 'fire' },
    { d: poly([[7, 9], [4, 3], [10, 3]]), fill: 'leaf' },
    { d: poly([[25, 9], [22, 3], [28, 3]]), fill: 'leaf' },
    { d: poly([[16, 8], [12, 2], [20, 2]]), fill: 'leaf' },
  ],

  // --- Огнемёт ---
  'weapon-fire': [
    { d: flame(16, 27, 8.5, 24), fill: 'fire' },
    { d: flame(16, 27, 4.5, 13), fill: 'gold' },
  ],
  'weapon-firestorm': [
    { d: flame(8, 28, 5, 15), fill: 'fireDeep' },
    { d: flame(24, 28, 5, 15), fill: 'fireDeep' },
    { d: flame(16, 28, 8, 25), fill: 'fire' },
    { d: flame(16, 28, 4, 13), fill: 'gold' },
  ],

  // --- Лёд ---
  'weapon-ice': [{ d: snowflake(16, 16, 12), stroke: 'ice', width: 2.6 }],
  'weapon-blizzard': [
    { d: `M9 15a6 6 0 0 1 1-9 8 8 0 0 1 15 2 5 5 0 0 1-1 9z`, fill: 'metal' },
    { d: snowflake(11, 24, 4.5), stroke: 'ice', width: 1.8 },
    { d: snowflake(22, 25, 4), stroke: 'ice', width: 1.8 },
  ],

  // --- Меч ---
  'weapon-saber': [
    { d: rect(14, 3, 4, 17, 2), fill: 'ice' },
    { d: rect(13, 20, 6, 3, 1), fill: 'metalDark' },
    { d: rect(14, 23, 4, 6, 1.5), fill: 'metal' },
  ],
  'weapon-dualsaber': [
    { d: rect(4.5, 4, 3.6, 24, 1.8), fill: 'ice' },
    { d: rect(23.9, 4, 3.6, 24, 1.8), fill: 'blood' },
    { d: rect(3.5, 14, 5.6, 4, 1.4), fill: 'metalDark' },
    { d: rect(22.9, 14, 5.6, 4, 1.4), fill: 'metalDark' },
  ],

  // --- Лазер ---
  'weapon-laser': [
    { d: `M2 16q14-11 28 0-14 11-28 0z`, fill: 'white' },
    { d: disc(16, 16, 6), fill: 'sky' },
    { d: disc(16, 16, 2.8), fill: 'dark' },
    { d: line([[22, 16], [31, 16]]), stroke: 'blood', width: 3 },
  ],
  'weapon-wideray': [
    { d: `M2 16q14-11 28 0-14 11-28 0z`, fill: 'white' },
    { d: disc(16, 16, 6), fill: 'blood' },
    { d: disc(16, 16, 2.8), fill: 'dark' },
    { d: poly([[22, 10], [31, 5], [31, 27], [22, 22]]), fill: 'blood', alpha: 0.55 },
  ],

  // --- Бумеранг ---
  'weapon-boomerang': [
    { d: boomerangShape(16, 18, 12), stroke: 'wood', width: 6.5 },
    { d: boomerangShape(16, 17, 12), stroke: 'gold', width: 1.6, alpha: 0.5 },
  ],
  'weapon-doubleboomerang': [
    { d: boomerangShape(10, 11, 8), stroke: 'gold', width: 5 },
    { d: boomerangShape(22, 22, 8), stroke: 'wood', width: 5 },
  ],

  // --- Пчёлы ---
  'weapon-bees': [
    { d: ellipse(9, 10, 6, 4), fill: 'white', alpha: 0.55 },
    { d: ellipse(23, 10, 6, 4), fill: 'white', alpha: 0.55 },
    { d: ellipse(16, 19, 8.5, 7.5), fill: 'gold' },
    { d: rect(11, 14, 4, 12), fill: 'dark' },
    { d: rect(18, 14, 4, 12), fill: 'dark' },
  ],
  'weapon-hive': [
    { d: `M16 4l11 6v11a11 8 0 0 1-22 0V10z`, fill: 'gold' },
    { d: line([[7, 14], [25, 14]]), stroke: 'goldDark', width: 2 },
    { d: line([[6, 21], [26, 21]]), stroke: 'goldDark', width: 2 },
    { d: disc(16, 25, 3), fill: 'dark' },
  ],

  // --- Огненная дорожка ---
  'weapon-firetrail': [
    { d: `M3 27q7-3 12-9t15-14q-4 12-11 17T3 27z`, fill: 'fire', alpha: 0.6 },
    { d: disc(24, 8, 6), fill: 'gold' },
    { d: disc(24, 8, 3), fill: 'white' },
  ],
  'weapon-lavatrail': [
    { d: `M2 28q8-3 13-9t16-15q-4 13-12 18T2 28z`, fill: 'lava' },
    { d: `M6 27q7-3 11-8t12-12`, stroke: 'gold', width: 2.4 },
    { d: disc(25, 7, 6), fill: 'white' },
  ],

  // --- Пузыри ---
  'weapon-bubbles': [
    { d: disc(19, 18, 10), fill: 'sky', alpha: 0.45 },
    { d: ring(19, 18, 10, 8), fill: 'ice' },
    { d: disc(8, 9, 5.5), fill: 'sky', alpha: 0.45 },
    { d: ring(8, 9, 5.5, 4), fill: 'ice' },
    { d: disc(16, 14, 2.4), fill: 'white' },
  ],
  'weapon-bubblestorm': [
    { d: ring(11, 20, 9, 7.2), fill: 'ice' },
    { d: ring(23, 22, 7, 5.5), fill: 'ice' },
    { d: ring(21, 9, 6, 4.6), fill: 'ice' },
    { d: ring(7, 7, 4.5, 3.4), fill: 'ice' },
    { d: disc(11, 20, 7.2), fill: 'sky', alpha: 0.4 },
    { d: disc(23, 22, 5.5), fill: 'sky', alpha: 0.4 },
  ],

  // --- Торнадо ---
  'weapon-tornado': [
    { d: `M4 6h24l-5 6H9zM8 14h16l-4 6h-8zM12 22h8l-3 7h-2z`, fill: 'metal' },
    { d: line([[7, 9], [25, 9]]), stroke: 'white', width: 1.6, alpha: 0.5 },
  ],
  'weapon-hurricane': [
    { d: `M2 6h28l-6 7H8zM7 15h18l-5 7h-8zM12 24h8l-3 6h-2z`, fill: 'metalDark' },
    { d: `M2 6h28l-6 7H8z`, fill: 'metal' },
    { d: swirl(17, 12, 5), stroke: 'white', width: 1.6, alpha: 0.55 },
  ],

  // --- Паутина Человека-паука ---
  'weapon-web': [
    { d: around(6, 0, 16, 16, (x, y, a) =>
      line([[16, 16], [16 + Math.cos(a) * 13, 16 + Math.sin(a) * 13]])),
      stroke: 'white', width: 1.6 },
    { d: around(6, 13, 16, 16, (x, y, a) => {
      const b = a + Math.PI / 3;
      return line([[x, y], [16 + Math.cos(b) * 13, 16 + Math.sin(b) * 13]]);
    }), stroke: 'white', width: 1.4 },
    { d: around(6, 7, 16, 16, (x, y, a) => {
      const b = a + Math.PI / 3;
      return line([[x, y], [16 + Math.cos(b) * 7, 16 + Math.sin(b) * 7]]);
    }), stroke: 'white', width: 1.4 },
  ],
};
