// Наклейки: плоские картинки в объёмном мире, нарисованные ТЕМ ЖЕ кодом, что
// и плоская игра.
//
// ЗАЧЕМ. Эффектов у оружия и способностей десятки: двадцать три ствола в руке,
// пузырь вокруг пойманного зомби, ледяная глыба, пламя, паутина, портал,
// вихрь, кости упавшего босса. Лепить каждый из примитивов — это месяцы и
// гарантированное расхождение с плоской версией. Но почти все они и в 2D
// плоские: это наклейка поверх мира, а не предмет. Значит её можно нарисовать
// настоящей функцией из render/sprites.js в маленький холст и повесить в сцену
// картинкой, всегда повёрнутой к зрителю.
//
// Выигрыш не только в скорости работы: арт получается не «похожий», а тот же
// самый. Правят sprites.js — правится и объёмный режим.
//
// ЧЕГО СЮДА НЕ НАДО. Всё, что должно лежать НА ЗЕМЛЕ и по чему герой бегает
// (огненная дорожка, портал, паутина), наклейкой к зрителю быть не может —
// такие вещи кладутся плоскостью в worldfx.js. И всё, что имеет объём по
// смыслу (сами персонажи), лепится в figures.js.

import { Sprite, SpriteMaterial, CanvasTexture, LinearFilter } from 'three';

// В скольких пикселях рисуем наклейку. Радиус, а не диаметр: функции
// sprites.js рисуют вокруг нуля. 64 — компромисс: мельче видно лесенку на
// ближнем плане, крупнее незачем, наклейка и так меньше персонажа.
const TEXTURE_RADIUS = 64;
// Запас вокруг: пламя, искры и ярость вылезают далеко за собственный радиус.
const PADDING = 1.9;

const cache = new Map();

// Текстура по ключу. Ключ обязан включать ВСЁ, от чего зависит рисунок:
// оружие, число звёзд, шаг прогресса. Иначе в кэше окажется чужая картинка —
// а заметить это можно только глазами, на конкретном оружии.
export function stickerTexture(key, draw) {
  let texture = cache.get(key);
  if (texture) return texture;

  const size = Math.ceil(TEXTURE_RADIUS * PADDING * 2);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.translate(size / 2, size / 2);
  draw(ctx, TEXTURE_RADIUS);

  texture = new CanvasTexture(canvas);
  // Мипмапы не нужны: наклейка почти всегда крупнее пикселя, а их построение
  // на каждой новой звезде оружия — лишняя работа на ровном месте.
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  cache.set(key, texture);
  return texture;
}

// Во сколько раз мир больше картинки: наклейка радиуса R в игре должна занять
// столько же, сколько занимала бы нарисованная в 2D функцией с тем же R.
export const STICKER_SPAN = PADDING * 2;

// Пул наклеек одного назначения. Пул, а не создание по месту: пламя и искры
// появляются и исчезают каждый кадр, а спрайт с материалом — это объект,
// который иначе пришлось бы собирать и выбрасывать шестьдесят раз в секунду.
export class StickerPool {
  constructor(scene, limit) {
    this.scene = scene;
    this.limit = limit;
    this.items = [];
    this.used = 0;
  }

  // Начало кадра.
  reset() {
    this.used = 0;
  }

  // Показать наклейку. radius — игровой радиус, ТОТ ЖЕ, что ушёл бы в
  // sprites.js: увеличивать его «чтобы эффект влез» не надо, запас на выход
  // за радиус уже заложен в PADDING. Подогнанный руками множитель раздувает
  // эффект и закрывает им персонажа. y — высота над землёй.
  show(texture, x, y, z, radius, { opacity = 1, flip = false, flipY = false, spin = 0 } = {}) {
    if (this.used >= this.limit) return null;
    const sprite = this.items[this.used] || this.make();
    this.used += 1;

    sprite.visible = true;
    sprite.material.map = texture;
    sprite.material.opacity = opacity;
    sprite.material.rotation = spin;
    sprite.material.needsUpdate = true;
    sprite.position.set(x, y, z);
    // Отражение делается масштабом ДО поворота, поэтому зеркалит по
    // собственной оси наклейки, а не по экранной, — ровно как ctx.scale(1,-1)
    // после ctx.rotate в плоской версии.
    sprite.scale.set(
      radius * STICKER_SPAN * (flip ? -1 : 1),
      radius * STICKER_SPAN * (flipY ? -1 : 1),
      1,
    );
    return sprite;
  }

  // Конец кадра: спрятать то, что в этот раз не понадобилось.
  finish() {
    for (let i = this.used; i < this.items.length; i++) this.items[i].visible = false;
  }

  make() {
    const sprite = new Sprite(new SpriteMaterial({
      transparent: true,
      // Без записи в буфер глубины: наклейки полупрозрачны, и записанная
      // глубина вырезала бы дырки в том, что за ними.
      depthWrite: false,
    }));
    this.scene.add(sprite);
    this.items.push(sprite);
    return sprite;
  }
}

// Шаг квантования прогресса для тех наклеек, чья ФОРМА меняется со временем:
// ледяная глыба нарастает, кости проявляются, пузырь сдувается. Печём
// несколько ступеней и берём ближайшую — перерисовывать текстуру каждый кадр
// значило бы грузить её в видеопамять шестьдесят раз в секунду.
export function step(value, steps = 6) {
  return Math.max(0, Math.min(steps, Math.round(value * steps)));
}
