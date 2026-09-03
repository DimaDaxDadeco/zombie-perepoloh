// Палитра иконок: имена вместо шестнадцатеричных кодов.
//
// Иконок в игре около сотни, и если каждая будет носить свои '#ff7043',
// набор молча расползётся на шестьдесят оттенков оранжевого — заметить это
// глазом на стенде уже невозможно. Имя заставляет выбирать из готового.
//
// Цвета взяты у того, что уже нарисовано: огонь того же цвета, что пламя на
// горящем зомби, лёд — что ледяная глыба, зелень — что кожа зомби. Значок в
// магазине и предмет в бою обязаны читаться как одно и то же.

export const ICON_COLORS = {
  // Стихии
  water: '#4fc3f7',
  waterDark: '#1f8fc4',
  fire: '#ff7043',
  fireDeep: '#e04b1f',
  ice: '#8fe3ff',
  iceDeep: '#4aa8d8',
  lightning: '#ffe14d',
  poison: '#9ccc65',
  lava: '#ff5722',

  // Материалы
  metal: '#c9d8e8',
  metalDark: '#7d8fa3',
  wood: '#c98b3a',
  stone: '#9aa3ad',
  gold: '#ffd93d',
  goldDark: '#d9a520',
  silver: '#dfe6ee',

  // Живое
  zombie: '#7cb342',
  zombieDark: '#4e7a25',
  skin: '#ffcc80',
  blood: '#ff4d6d',
  leaf: '#66bb6a',

  // Интерфейс
  night: '#3f51b5',
  sky: '#64b5f6',
  paper: '#fff6e0',
  paperEdge: '#e0d3b0',
  shadow: 'rgba(0, 0, 0, 0.28)',
  white: '#ffffff',
  dark: '#2a2750',

  // Особый: наследует цвет текста. В SVG работает сам собой, в canvas его
  // подставляет drawIcon. Ради него стрелки, галочки и точки звёзд красятся
  // цветом кнопки, на которой стоят, — вместе с наведением и выделением.
  ink: 'currentColor',
};

// Имя → цвет. Неизвестное имя не молчит: молчаливый чёрный пришлось бы
// вылавливать глазами по сотне иконок.
export function resolveColor(name, currentColor = '#ffffff') {
  if (!name) return null;
  const value = ICON_COLORS[name];
  if (value === undefined) {
    console.warn(`[icons] неизвестный цвет: ${name}`);
    return '#ff00ff';
  }
  return value === 'currentColor' ? currentColor : value;
}

// Для canvas: 'currentColor' там не существует, его надо развернуть заранее.
export function resolveForCanvas(name, currentColor) {
  return resolveColor(name, currentColor);
}
