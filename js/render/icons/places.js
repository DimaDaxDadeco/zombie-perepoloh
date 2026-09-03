// Локации и особые раунды.
//
// Значок локации на карте кампании стоит рядом с медальоном, покрашенным
// грунтом своей темы. Цвета здесь взяты у декораций фона (background.js):
// связь «значок на карте → место, куда я попаду» держится именно цветом, и
// разъехаться им нельзя.

import { disc, rect, poly, line, star, arc } from './shapes.js';

export const PLACE_ICONS = {
  // Двор — домик с цветком.
  'place-yard': [
    { d: poly([[16, 5], [28, 15], [24, 15], [24, 27], [8, 27], [8, 15], [4, 15]]), fill: 'fire' },
    { d: rect(13, 19, 6, 8, 1), fill: 'paper' },
  ],
  // Парк — дерево.
  'place-park': [
    { d: rect(14, 18, 4, 11, 1), fill: 'wood' },
    { d: disc(16, 13, 10), fill: 'leaf' },
    { d: disc(9, 17, 5.5), fill: 'leaf' },
    { d: disc(23, 17, 5.5), fill: 'leaf' },
  ],
  // Пляж — ракушка.
  'place-beach': [
    { d: `M16 28C7 28 3 20 3 13a13 13 0 0 1 26 0c0 7-4 15-13 15z`, fill: 'gold' },
    { d: line([[16, 27], [16, 4]]), stroke: 'goldDark', width: 1.6 },
    { d: line([[16, 27], [7, 8]]), stroke: 'goldDark', width: 1.6 },
    { d: line([[16, 27], [25, 8]]), stroke: 'goldDark', width: 1.6 },
  ],
  // Космос — ракета.
  'place-space': [
    { d: `M16 2c5 5 7 11 7 17H9c0-6 2-12 7-17z`, fill: 'metal' },
    { d: disc(16, 12, 3.5), fill: 'sky' },
    { d: poly([[9, 15], [4, 24], [9, 22]]), fill: 'blood' },
    { d: poly([[23, 15], [28, 24], [23, 22]]), fill: 'blood' },
    { d: poly([[13, 19], [16, 30], [19, 19]]), fill: 'fire' },
  ],
  // Пещера — кристаллы.
  'place-cave': [
    { d: poly([[10, 29], [5, 15], [12, 8], [16, 18]]), fill: 'night' },
    { d: poly([[21, 29], [16, 18], [23, 11], [28, 22]]), fill: 'sky' },
    { d: poly([[12, 8], [16, 18], [12, 20]]), fill: 'white', alpha: 0.3 },
  ],
  // Каток — конёк.
  'place-rink': [
    { d: `M9 4h7v13l8 5v4H9z`, fill: 'sky' },
    { d: rect(5, 25, 24, 3, 1.5), fill: 'metal' },
    { d: arc(5, 24, 3, 0, Math.PI / 2), stroke: 'metal', width: 3 },
  ],
  // Ферма — колос. Сноп из трёх треугольников с перевязью читался как
  // корона, а корона в игре уже занята боссом.
  'place-farm': [
    { d: line([[16, 30], [16, 8]]), stroke: 'leaf', width: 2.2 },
    { d: [0, 1, 2, 3].map((i) => {
      const y = 9 + i * 5;
      return `M16 ${y + 4}Q9 ${y + 3} 10 ${y - 1}Q16 ${y} 16 ${y + 4}z`
        + `M16 ${y + 4}Q23 ${y + 3} 22 ${y - 1}Q16 ${y} 16 ${y + 4}z`;
    }).join(''), fill: 'gold' },
    { d: `M16 8Q13 3 16 1Q19 3 16 8z`, fill: 'goldDark' },
  ],
};

export const ROUND_ICONS = {
  // Дождь медалек: туча и падающие звёздочки.
  'round-medalRain': [
    { d: `M9 15a6 6 0 0 1 1-10 8 8 0 0 1 15 2 5 5 0 0 1-1 8z`, fill: 'metal' },
    { d: star(9, 24, 4), fill: 'gold' },
    { d: star(17, 27, 4), fill: 'gold' },
    { d: star(25, 23, 4), fill: 'gold' },
  ],
  // Ночь: месяц. Тот же силуэт, что у медали «Не боюсь темноты», но там он
  // на плаще и со звездой — в одном списке они не встречаются.
  'round-night': [
    { d: `M21 3a13 13 0 1 0 6 22A11 11 0 0 1 21 3z`, fill: 'ice' },
    { d: disc(11, 13, 2), fill: 'white', alpha: 0.35 },
    { d: disc(15, 21, 2.6), fill: 'white', alpha: 0.25 },
  ],
  // Толпа: четыре головы плотно.
  'round-horde': [
    { d: rect(2, 12, 9, 16, 3), fill: 'zombieDark' },
    { d: rect(21, 12, 9, 16, 3), fill: 'zombieDark' },
    { d: rect(11.5, 9, 9, 19, 3), fill: 'zombie' },
    { d: disc(14, 15, 1.6), fill: 'white' },
    { d: disc(18, 15, 1.6), fill: 'white' },
  ],
};
