// Геометрия иконок: помощники, собирающие строку пути SVG.
//
// Главное решение модуля: КАЖДЫЙ примитив превращается в строку `d`. Круг,
// прямоугольник и звезда не рисуются «своими» средствами — они тоже пути.
// Из-за этого у обоих рендереров (SVG в меню и Path2D в HUD) остаётся ровно
// один источник геометрии, и они не могут разойтись. Разойтись двум
// рендерерам из одного определения — самый вероятный класс ошибок в этой
// задаче, и здесь он закрыт устройством, а не внимательностью.
//
// Система координат — квадрат 32×32, центр (16, 16). Тот же принцип, что у
// спрайтов: рисуем в известном квадрате, размер задаёт вызывающий.

export const BOX = 32;
export const MID = BOX / 2;

// Короткие числа: путь из тридцати вершин с шестью знаками после запятой
// нечитаем, а разница в тысячную долю пикселя невидима.
const n = (v) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};

// --- Базовые фигуры ---

// Круг двумя полудугами: единственный способ выразить его путём.
export function disc(cx, cy, r) {
  return `M${n(cx - r)} ${n(cy)}`
    + `a${n(r)} ${n(r)} 0 1 0 ${n(r * 2)} 0`
    + `a${n(r)} ${n(r)} 0 1 0 ${n(-r * 2)} 0z`;
}

// Кольцо: внешний круг по часовой, внутренний против — дырка получается сама
// правилом nonzero, без evenodd. Так фигура ведёт себя одинаково и в SVG, и
// в canvas, где правило заливки задаётся отдельным аргументом и его легко
// забыть.
export function ring(cx, cy, outer, inner) {
  return disc(cx, cy, outer)
    + `M${n(cx - inner)} ${n(cy)}`
    + `a${n(inner)} ${n(inner)} 0 1 1 ${n(inner * 2)} 0`
    + `a${n(inner)} ${n(inner)} 0 1 1 ${n(-inner * 2)} 0z`;
}

export function ellipse(cx, cy, rx, ry) {
  return `M${n(cx - rx)} ${n(cy)}`
    + `a${n(rx)} ${n(ry)} 0 1 0 ${n(rx * 2)} 0`
    + `a${n(rx)} ${n(ry)} 0 1 0 ${n(-rx * 2)} 0z`;
}

export function rect(x, y, w, h, r = 0) {
  if (!r) return `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}z`;
  const k = Math.min(r, w / 2, h / 2);
  return `M${n(x + k)} ${n(y)}h${n(w - k * 2)}a${n(k)} ${n(k)} 0 0 1 ${n(k)} ${n(k)}`
    + `v${n(h - k * 2)}a${n(k)} ${n(k)} 0 0 1 ${n(-k)} ${n(k)}`
    + `h${n(-(w - k * 2))}a${n(k)} ${n(k)} 0 0 1 ${n(-k)} ${n(-k)}`
    + `v${n(-(h - k * 2))}a${n(k)} ${n(k)} 0 0 1 ${n(k)} ${n(-k)}z`;
}

export function poly(points, close = true) {
  const [first, ...rest] = points;
  return `M${n(first[0])} ${n(first[1])}`
    + rest.map(([x, y]) => `L${n(x)} ${n(y)}`).join('')
    + (close ? 'z' : '');
}

// Ломаная под обводку: то же, что poly, но незамкнутая. Отдельное имя, чтобы
// в определении иконки было видно, что фигура обводится, а не заливается.
export function line(points) {
  return poly(points, false);
}

// --- Составные ---

// Звезда. Внутренний радиус по умолчанию 0.45 — тот же, что у drawStarShape
// в спрайтах: звезда на медальке и звезда-иконка обязаны быть одной звездой.
export function star(cx, cy, outer, points = 5, innerRatio = 0.45, rot = -Math.PI / 2) {
  const inner = outer * innerRatio;
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poly(pts);
}

// Капля: круглое донце с центром (cx, cy) радиуса r и остриё на высоте
// height над ним. Основа для воды, огня и всего «текучего».
export function drop(cx, cy, r, height = r * 2.2) {
  const apex = cy - height;
  const waist = apex + height * 0.45;
  return `M${n(cx)} ${n(apex)}`
    + `C${n(cx + r * 0.62)} ${n(waist)} ${n(cx + r)} ${n(cy - r * 0.45)} ${n(cx + r)} ${n(cy)}`
    + `a${n(r)} ${n(r)} 0 0 1 ${n(-r * 2)} 0`
    + `c0 ${n(-r * 0.45)} ${n(r * 0.38)} ${n(waist - (cy - r * 0.45))} ${n(r)} ${n(apex - cy)}z`;
}

// Сердце. Одна кривая на половину, зеркальная — на вторую.
export function heart(cx, cy, size) {
  const s = size;
  return `M${n(cx)} ${n(cy + s * 0.75)}`
    + `C${n(cx - s * 1.3)} ${n(cy - s * 0.1)} ${n(cx - s * 0.75)} ${n(cy - s * 1.05)} ${n(cx)} ${n(cy - s * 0.35)}`
    + `C${n(cx + s * 0.75)} ${n(cy - s * 1.05)} ${n(cx + s * 1.3)} ${n(cy - s * 0.1)} ${n(cx)} ${n(cy + s * 0.75)}z`;
}

// Вспышка-искра: четырёхлучевая звезда с вогнутыми боками. Ею помечено всё
// «волшебное» — способность, новая игра, победа.
export function spark(cx, cy, r, thin = 0.26) {
  const t = r * thin;
  return `M${n(cx)} ${n(cy - r)}`
    + `Q${n(cx + t * 0.6)} ${n(cy - t * 0.6)} ${n(cx + r)} ${n(cy)}`
    + `Q${n(cx + t * 0.6)} ${n(cy + t * 0.6)} ${n(cx)} ${n(cy + r)}`
    + `Q${n(cx - t * 0.6)} ${n(cy + t * 0.6)} ${n(cx - r)} ${n(cy)}`
    + `Q${n(cx - t * 0.6)} ${n(cy - t * 0.6)} ${n(cx)} ${n(cy - r)}z`;
}

// Молния: одна ломаная, вершины подобраны так, чтобы силуэт читался на 16px.
export function bolt(cx, cy, h) {
  const w = h * 0.46;
  return poly([
    [cx + w * 0.35, cy - h / 2],
    [cx - w, cy + h * 0.1],
    [cx - w * 0.1, cy + h * 0.1],
    [cx - w * 0.45, cy + h / 2],
    [cx + w, cy - h * 0.14],
    [cx + w * 0.05, cy - h * 0.14],
  ]);
}

// Дуга под обводку — хвосты, улыбки, орбиты.
export function arc(cx, cy, r, from, to, sweep = 1) {
  const x0 = cx + Math.cos(from) * r;
  const y0 = cy + Math.sin(from) * r;
  const x1 = cx + Math.cos(to) * r;
  const y1 = cy + Math.sin(to) * r;
  const large = Math.abs(to - from) > Math.PI ? 1 : 0;
  return `M${n(x0)} ${n(y0)}A${n(r)} ${n(r)} 0 ${large} ${sweep} ${n(x1)} ${n(y1)}`;
}

// Повторить фигуру по кругу — лучи, лепестки, шипы.
export function around(count, radius, cx, cy, make, rot = -Math.PI / 2) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = rot + (i * Math.PI * 2) / count;
    parts.push(make(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, a, i));
  }
  return parts.join('');
}
