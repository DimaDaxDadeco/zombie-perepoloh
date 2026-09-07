// Контуры частей тела для объёмного режима.
//
// Здесь ровно те же формы, которыми рисует render/sprites.js: скруглённый
// прямоугольник, круг, звезда, молния. Разница одна — там из них получается
// заливка на плоскости, здесь плоский контур выдавливается в объём. Поэтому
// пропорции переносятся числами, а не переизобретаются: у 2D-героя ноги
// шириной 0.35 радиуса, и в объёме они такие же.
//
// ЕДИНИЦЫ. Всё строится в долях игрового радиуса, то есть для r = 1. Масштаб
// на настоящий радиус ставит scene.js — иначе каждую фигурку пришлось бы
// пересобирать, когда Ярость Халка раздувает героя.
//
// ОСИ. У холста y растёт вниз, в сцене — вверх. Пересчёт делает figures.js
// одной формулой, здесь контуры уже в «сценовых» осях: выше — больше y.

import { Shape, ExtrudeGeometry } from 'three';

// Скругление считаем от меньшей стороны: у тонкой детали радиус угла не может
// быть больше её половины, иначе контур сам себя выворачивает.
export function roundedRect(width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  const x = -width / 2;
  const y = -height / 2;

  const shape = new Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

export function starShape(radius, points = 5, innerFactor = 0.45) {
  const shape = new Shape();
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? radius : radius * innerFactor;
    // Начинаем с макушки: звезда, повёрнутая лучом вбок, читается как клякса.
    const angle = -Math.PI / 2 + i * step;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function boltShape(size) {
  const s = size;
  const shape = new Shape();
  shape.moveTo(0.25 * s, s);
  shape.lineTo(-0.45 * s, 0.05 * s);
  shape.lineTo(-0.05 * s, 0.05 * s);
  shape.lineTo(-0.3 * s, -s);
  shape.lineTo(0.45 * s, -0.1 * s);
  shape.lineTo(0.05 * s, -0.1 * s);
  shape.closePath();
  return shape;
}

// Выдавливание с фаской. Фаска маленькая и обязательная: без неё грань ловит
// свет ровным пятном и деталь выглядит наклейкой, а не предметом.
export function extrude(shape, depth, bevel = depth * 0.18) {
  const geometry = new ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 8,
  });
  // Выдавливание уходит по +z от нуля; центрируем, чтобы деталь можно было
  // ставить по её собственной середине.
  geometry.center();
  return geometry;
}
