// Суперспособности — десять значков.
//
// Значок способности живёт в двух местах: на шкале заряда в HUD и на круглой
// кнопке под палец (⌀88). Оба раза он один, крупный и без соседей, поэтому
// здесь можно позволить себе больше деталей, чем в слоте оружия.

import { disc, ring, ellipse, rect, poly, line, star, bolt, arc, around } from './shapes.js';

export const ABILITY_ICONS = {
  // Волна, расходящаяся от удара: три дуги и кулак-эпицентр.
  'ability-shockwave': [
    { d: arc(16, 20, 13, -2.6, -0.55), stroke: 'gold', width: 2.6, alpha: 0.55 },
    { d: arc(16, 20, 9, -2.6, -0.55), stroke: 'gold', width: 2.8, alpha: 0.8 },
    { d: ellipse(16, 23, 9, 3.5), fill: 'fire' },
    { d: star(16, 12, 7, 4, 0.38), fill: 'gold' },
  ],

  // Портал: воронка кольцами, втягивающая внутрь.
  'ability-portal': [
    { d: ellipse(16, 16, 13, 13), fill: 'night' },
    { d: ring(16, 16, 10, 6.5), fill: 'sky', alpha: 0.85 },
    { d: ring(16, 16, 4.5, 2), fill: 'white' },
  ],

  'ability-turbo': [
    { d: bolt(19, 16, 24), fill: 'lightning' },
    { d: line([[3, 9], [10, 9]]), stroke: 'lightning', width: 2.4, alpha: 0.5 },
    { d: line([[2, 16], [8, 16]]), stroke: 'lightning', width: 2.4, alpha: 0.5 },
    { d: line([[3, 23], [10, 23]]), stroke: 'lightning', width: 2.4, alpha: 0.5 },
  ],

  // Спин-дэш: свернувшийся в шар герой и след рывка.
  'ability-spindash': [
    { d: line([[2, 20], [11, 20]]), stroke: 'sky', width: 2.4, alpha: 0.5 },
    { d: line([[4, 26], [12, 26]]), stroke: 'sky', width: 2.4, alpha: 0.5 },
    { d: disc(20, 16, 11), fill: 'sky' },
    { d: around(6, 8, 20, 16, (x, y, a) =>
      poly([[x, y], [20 + Math.cos(a + 0.5) * 12, 16 + Math.sin(a + 0.5) * 12],
        [20 + Math.cos(a - 0.5) * 12, 16 + Math.sin(a - 0.5) * 12]])), fill: 'water' },
  ],

  // Паучок. Первая версия была чёрной и на тёмной панели меню исчезала
  // целиком — значок обязан читаться и на светлом листе, и на космосе.
  'ability-swarm': [
    { d: around(4, 0, 16, 17, (x, y, a) => {
      const dx = Math.cos(a + 0.4) * 13;
      const dy = Math.sin(a + 0.4) * 13;
      return line([[16 - dx, 17 - dy], [16 + dx, 17 + dy]]);
    }), stroke: 'stone', width: 2.2 },
    { d: ellipse(16, 18, 7.5, 6.5), fill: 'night' },
    { d: ellipse(16, 11, 4.5, 4), fill: 'night' },
    { d: disc(14, 10.5, 1.5), fill: 'blood' },
    { d: disc(18, 10.5, 1.5), fill: 'blood' },
  ],

  // Ярость: кулак, вид спереди — костяшки и большой палец поперёк. Вид
  // сбоку читался как круассан.
  'ability-rage': [
    { d: rect(8, 9, 17, 17, 5), fill: 'skin' },
    { d: line([[11, 14], [22, 14]]), stroke: 'wood', width: 1.8, alpha: 0.45 },
    { d: line([[11, 18.5], [22, 18.5]]), stroke: 'wood', width: 1.8, alpha: 0.45 },
    { d: rect(4, 16, 11, 7, 3.5), fill: 'skin' },
    { d: rect(9, 25, 15, 4, 2), fill: 'wood', alpha: 0.3 },
  ],

  // Подарок Мистера Хэнки: коробка с бантом.
  'ability-gifts': [
    { d: rect(4, 13, 24, 15, 2), fill: 'blood' },
    { d: rect(14, 13, 4, 15), fill: 'gold' },
    { d: rect(4, 13, 24, 4), fill: 'goldDark', alpha: 0.35 },
    { d: `M16 13C10 13 8 6 12 6s4 7 4 7 0-7 4-7 2 7-4 7z`, fill: 'gold' },
  ],

  // Бэтмобиль: низкий силуэт с плавником, вид сбоку — как он и ездит.
  'ability-batmobile': [
    { d: poly([[2, 22], [7, 15], [19, 15], [24, 11], [26, 22]]), fill: 'dark' },
    { d: poly([[9, 15], [18, 15], [21, 12], [11, 12]]), fill: 'sky', alpha: 0.6 },
    { d: poly([[26, 22], [30, 8], [31, 22]]), fill: 'dark' },
    { d: disc(9, 23, 4), fill: 'metalDark' },
    { d: disc(22, 23, 4), fill: 'metalDark' },
  ],

  // Разряд: туча и молния из неё.
  'ability-zap': [
    { d: `M9 16a6 6 0 0 1 1-10 8 8 0 0 1 15 2 5 5 0 0 1-1 8z`, fill: 'metalDark' },
    { d: bolt(16, 23, 14), fill: 'lightning' },
  ],

  // Мяу: кошачья лапка — та же, что рисуется в мире.
  'ability-meow': [
    { d: ellipse(16, 21, 8, 6.5), fill: 'blood' },
    { d: ellipse(8, 12, 3.2, 4), fill: 'blood' },
    { d: ellipse(13.5, 8.5, 3.2, 4.2), fill: 'blood' },
    { d: ellipse(19.5, 8.5, 3.2, 4.2), fill: 'blood' },
    { d: ellipse(25, 12, 3.2, 4), fill: 'blood' },
  ],
};
