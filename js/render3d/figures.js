// Объёмные фигурки по тому же полю look, по которому персонажа рисует
// render/sprites.js.
//
// ЗАЧЕМ ОДИН КОНСТРУКТОР НА ВСЕХ. Героев десять, зомби семнадцать, боссов
// двенадцать, но различаются они не формой, а цветами и несколькими
// перечислимыми флагами: причёска, эмблема на груди, телосложение, шляпа.
// Ровно поэтому в 2D тоже одна функция drawHero, а не десять. Здесь то же
// самое: пропорции взяты оттуда числами, чтобы силуэт остался узнаваемым —
// ребёнок должен узнать Соника и Халка, а не «кого-то в синем».
//
// ОСИ И ЕДИНИЦЫ. Всё строится для радиуса 1, ступнями на нуле, лицом в +z.
// Масштаб и поворот ставит scene.js. У холста y растёт вниз, в сцене вверх,
// поэтому каждая координата из sprites.js пересчитывается как
// (низ ступней) - y — это единственная формула перевода, и она вынесена в
// константы FLOOR_* рядом с пропорциями.

import {
  Group, Mesh, SphereGeometry, CylinderGeometry, ConeGeometry,
} from 'three';
import { roundedRect, starShape, boltShape, extrude } from './shapes.js';

// Низ ступней в координатах холста: у героя ноги кончаются на 1.1 радиуса,
// у зомби на 1.05. Из этих двух чисел и получается «поставить на землю».
const HERO_FLOOR = 1.1;
const ZOMBIE_FLOOR = 1.05;

// Толщина деталей. В 2D её нет вовсе, поэтому числа подобраны на глаз в
// стенде: тоньше — фигурка складывается в открытку при повороте камеры,
// толще — перестаёт читаться силуэт, ради которого всё и затевалось.
const BODY_DEPTH = 0.62;
const LEG_DEPTH = 0.34;
const FLAT_DEPTH = 0.12;

// Размах шага и рук. Тот же источник, что в 2D: sin(walkPhase).
const LEG_SWING = 0.5;
const ARM_SWING = 0.35;

const BODY_WIDTH = { normal: 1, thin: 0.82, fat: 1.28 };
const EYE_WHITE = '#ffffff';
const DARK = '#2a2320';

// --- Сборка ---

// Единственная точка входа: по сущности и её look отдаёт готовый узел сцены и
// список подвижных частей. materialFor приходит снаружи, чтобы материалы
// кэшировались один раз на всю игру, а не на каждого зомби.
export function buildFigure(look = {}, kind, materialFor) {
  if (look.shape === 'beast') return buildBeast(look, materialFor);
  if (look.shape === 'balloon') return buildBalloon(look, materialFor);
  if (look.shape === 'snow') return buildSnowman(look, materialFor);
  if (look.shape === 'golem') return buildGolem(look, materialFor);
  if (look.shape === 'hankey') return buildHankey(look, materialFor);
  return kind === 'hero' ? buildHero(look, materialFor) : buildZombie(look, materialFor);
}

// Герой. Пропорции — из drawHero: ноги 0.35 ширины, туловище в радиус,
// голова 0.52, руки 0.2.
function buildHero(look, materialFor) {
  const node = new Group();
  const parts = { legs: [], arms: [] };
  const build = look.build === 'buff' ? 1.28 : 1;
  const up = (y) => HERO_FLOOR - y;

  const legW = 0.35 * build;
  const legX = 0.45 * build - legW / 2;
  const legMat = materialFor(look.pants);
  const shoeMat = look.shoes ? materialFor(look.shoes) : null;
  for (const side of [-1, 1]) {
    // Бедро — отдельный узел: шаг это поворот ноги в бедре, а не сдвиг всей
    // ноги вбок, как приходится делать на плоскости.
    const hip = new Group();
    hip.position.set(side * legX, up(0.5), 0);
    hip.add(box(legW, 0.6, LEG_DEPTH, 0.15, legMat, 0, -0.3, 0));
    if (shoeMat) hip.add(box(legW + 0.15, 0.28, LEG_DEPTH + 0.14, 0.13, shoeMat, 0, -0.5, 0.06));
    parts.legs.push(hip);
    node.add(hip);
  }

  const bodyW = 1 * build;
  node.add(box(bodyW, 1.0, BODY_DEPTH, 0.3, materialFor(look.shirt), 0, up(0.1), 0));

  if (look.cape) {
    const cape = box(bodyW * 0.95, 1.15, FLAT_DEPTH, 0.2, materialFor(look.cape),
      0, up(0.15), -BODY_DEPTH / 2 - FLAT_DEPTH * 0.6);
    cape.rotation.x = -0.12;   // плащ отстаёт от спины, а не приклеен к ней
    node.add(cape);
  }

  addChestEmblem(node, look, bodyW, up(0.15), materialFor);

  const armR = 0.2 * build;
  const armMat = materialFor(look.gloves || look.skin);
  for (const side of [-1, 1]) {
    const shoulder = new Group();
    shoulder.position.set(side * 0.62 * build, up(-0.22), 0);
    shoulder.add(ball(armR, armMat, 0, -0.27, 0));
    parts.arms.push(shoulder);
    node.add(shoulder);
  }

  const head = new Group();
  head.position.set(0, up(-0.85), 0);
  head.add(ball(0.52, materialFor(look.skin)));
  addEyes(head, 0.52, 0.16, materialFor);
  addHair(head, look, materialFor);
  if (look.hat) addBeanie(head, look.hat, materialFor);
  parts.head = head;
  node.add(head);

  return { node, parts, kind: 'hero' };
}

// Зомби. Из drawZombie: руки вытянуты ВПЕРЁД — это его главная примета, и в
// объёме она наконец работает буквально, а не намёком.
function buildZombie(look, materialFor) {
  const node = new Group();
  const parts = { legs: [], arms: [] };
  const width = BODY_WIDTH[look.body] || 1;
  const up = (y) => ZOMBIE_FLOOR - y;

  const legMat = materialFor(shade(look.skin, -0.18));
  for (const side of [-1, 1]) {
    const hip = new Group();
    hip.position.set(side * 0.26, up(0.45), 0);
    hip.add(box(0.32, 0.6, LEG_DEPTH, 0.12, legMat, 0, -0.3, 0));
    parts.legs.push(hip);
    node.add(hip);
  }

  node.add(box(0.96 * width, 0.9, BODY_DEPTH, 0.2, materialFor(look.clothes), 0, up(0.1), 0));

  const armMat = materialFor(look.skin);
  for (const side of [-1, 1]) {
    const shoulder = new Group();
    shoulder.position.set(side * 0.34 * width, up(-0.15), BODY_DEPTH / 2);
    const arm = box(0.24, 0.24, 0.85, 0.1, armMat, 0, 0, 0.42);
    shoulder.add(arm);
    parts.arms.push(shoulder);
    node.add(shoulder);
  }

  const head = new Group();
  head.position.set(0, up(-0.8), 0);
  if (look.head === 'pumpkin') {
    head.add(ball(0.55, materialFor(look.headColor || '#f08a2b')));
    head.add(cylinder(0.07, 0.2, materialFor('#5a8a3a'), 0, 0.6, 0));
  } else {
    head.add(ball(0.5, materialFor(look.skin)));
    addHair(head, look, materialFor);
  }
  // Глаза врастопырку и разного размера — это зомби и в 2D, и здесь.
  addEyes(head, 0.5, 0.15, materialFor, { skew: true });
  if (look.helmet) addHelmet(head, look.helmet, materialFor);
  if (look.mask) addMask(head, look.mask, materialFor);
  if (look.beard) node.add(box(0.5, 0.32, 0.2, 0.1, materialFor(look.beard), 0, up(-0.45), 0.36));
  parts.head = head;
  node.add(head);

  // Постоянный наклон вперёд: в 2D это look.lean, и без него ролик-зомби
  // перестаёт читаться как разогнавшийся.
  if (look.lean) node.rotation.x = -look.lean;
  parts.stride = look.stride ?? 1;
  return { node, parts, kind: 'zombie' };
}

// Зверь на четырёх лапах: собака, кот, крот. В 2D это drawBeast — своя форма
// целиком, человеческий силуэт им не подходит.
function buildBeast(look, materialFor) {
  const node = new Group();
  const parts = { legs: [], arms: [] };
  const skin = materialFor(look.skin);
  const cloth = materialFor(look.clothes || look.skin);

  node.add(box(0.7, 0.55, 1.25, 0.22, cloth, 0, 0.72, 0));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const hip = new Group();
      hip.position.set(sx * 0.26, 0.5, sz * 0.42);
      hip.add(box(0.2, 0.5, 0.2, 0.08, skin, 0, -0.25, 0));
      parts.legs.push(hip);
      node.add(hip);
    }
  }

  const head = new Group();
  head.position.set(0, 0.92, 0.68);
  head.add(ball(0.4, skin));
  head.add(box(0.3, 0.24, 0.3, 0.1, skin, 0, -0.1, 0.32));   // морда
  const ear = look.beast === 'cat' ? 0.3 : 0.22;
  for (const side of [-1, 1]) {
    head.add(cone(0.15, ear, skin, side * 0.22, 0.36, -0.04));
  }
  addEyes(head, 0.4, 0.12, materialFor);
  parts.head = head;
  node.add(head);

  // Хвост торчит назад и вверх — по нему зверь читается со спины, когда морды
  // не видно вовсе.
  node.add(box(0.14, 0.14, 0.5, 0.06, skin, 0, 0.9, -0.72));
  parts.stride = 1;
  return { node, parts, kind: 'beast' };
}

function buildBalloon(look, materialFor) {
  const node = new Group();
  const color = look.balloon || look.clothes || look.skin;
  node.add(ball(0.85, materialFor(color), 0, 1.15, 0));
  node.add(cone(0.16, 0.3, materialFor(color), 0, 0.35, 0));
  const head = new Group();
  head.position.set(0, 1.3, 0);
  addEyes(head, 0.85, 0.16, materialFor);
  node.add(head);
  return { node, parts: { legs: [], arms: [], head, float: true }, kind: 'balloon' };
}

function buildSnowman(look, materialFor) {
  const node = new Group();
  const snow = materialFor(look.skin || '#f4f8ff');
  node.add(ball(0.62, snow, 0, 0.62, 0));
  node.add(ball(0.48, snow, 0, 1.5, 0));
  const head = new Group();
  head.position.set(0, 2.1, 0);
  head.add(ball(0.36, snow));
  head.add(cone(0.1, 0.34, materialFor(look.nose || '#ff8a3b'), 0, 0, 0.38, -Math.PI / 2));
  addEyes(head, 0.36, 0.1, materialFor);
  if (look.bucket) head.add(cylinder(0.3, 0.34, materialFor(look.bucket), 0, 0.42, 0));
  node.add(head);
  // Руки-веточки: тонкие палки в стороны, они и делают снеговика снеговиком.
  if (look.twigs) {
    for (const side of [-1, 1]) {
      node.add(box(0.7, 0.08, 0.08, 0.04, materialFor(look.twigs), side * 0.75, 1.55, 0));
    }
  }
  return { node, parts: { legs: [], arms: [], head }, kind: 'snow' };
}

function buildGolem(look, materialFor) {
  const node = new Group();
  const parts = { legs: [], arms: [] };
  const stone = materialFor(look.skin);
  const accent = materialFor(look.accent || shade(look.skin, -0.2));

  for (const side of [-1, 1]) {
    const hip = new Group();
    hip.position.set(side * 0.36, 0.75, 0);
    hip.add(box(0.44, 0.75, 0.44, 0.08, accent, 0, -0.38, 0));
    parts.legs.push(hip);
    node.add(hip);
  }
  node.add(box(1.35, 1.0, 0.85, 0.14, stone, 0, 1.3, 0));
  for (const side of [-1, 1]) {
    const shoulder = new Group();
    shoulder.position.set(side * 0.85, 1.6, 0);
    shoulder.add(box(0.36, 0.9, 0.36, 0.1, accent, 0, -0.45, 0));
    parts.arms.push(shoulder);
    node.add(shoulder);
  }
  const head = new Group();
  head.position.set(0, 2.15, 0);
  head.add(box(0.7, 0.6, 0.6, 0.12, stone));
  addEyes(head, 0.35, 0.11, materialFor);
  parts.head = head;
  node.add(head);
  return { node, parts, kind: 'golem' };
}

// Мистер Хэнки: витая горка, ручки по бокам, колпак. Ни ног, ни туловища.
function buildHankey(look, materialFor) {
  const node = new Group();
  const skin = materialFor(look.skin);
  // Нижний виток самый широкий, и его радиус же задаёт, на какой высоте
  // лежит вся горка: иначе она проваливается в землю на треть.
  const coils = [[0.62, 0.62], [0.48, 1.16], [0.36, 1.6]];
  for (const [r, y] of coils) node.add(ball(r, skin, 0, y, 0));
  for (const side of [-1, 1]) node.add(ball(0.16, skin, side * 0.55, 1.15, 0.1));
  const head = new Group();
  head.position.set(0, 1.7, 0);
  addEyes(head, 0.36, 0.13, materialFor);
  if (look.hat) head.add(cone(0.34, 0.55, materialFor(look.hat.color || '#e03b3b'), 0, 0.45, 0));
  node.add(head);
  return { node, parts: { legs: [], arms: [], head }, kind: 'hankey' };
}

// --- Детали ---

function addEyes(head, headRadius, eyeRadius, materialFor, { skew = false } = {}) {
  const white = materialFor(EYE_WHITE);
  const dark = materialFor(DARK);
  const z = headRadius * 0.82;
  const spread = headRadius * 0.36;
  const pairs = skew
    ? [[-spread, headRadius * 0.1, eyeRadius], [spread * 0.95, headRadius * 0.16, eyeRadius * 0.78]]
    : [[-spread, headRadius * 0.08, eyeRadius], [spread, headRadius * 0.08, eyeRadius]];
  for (const [x, y, r] of pairs) {
    head.add(ball(r, white, x, y, z));
    head.add(ball(r * 0.5, dark, x, y, z + r * 0.62));
  }
}

// Причёски. Те же восемь вариантов, что в 2D: список закрытый, и незнакомое
// значение должно оставлять героя лысым, а не ронять сцену.
function addHair(head, look, materialFor) {
  const style = look.hairStyle;
  const color = look.hair;
  if (!color || style === 'none') return;
  const mat = materialFor(color);

  switch (style) {
    // Шапочка садится ВЫСОКО и приплюснуто. Полусфера по размеру головы
    // закрывает в объёме и лоб, и глаза: на плоскости она лежала за лицом, а
    // здесь оборачивается вокруг него, и герой остаётся без лица.
    case 'bowl':
      head.add(squash(halfBall(0.55, mat, 0, 0.2, 0), 0.62));
      break;
    case 'cap':
      head.add(squash(halfBall(0.55, mat, 0, 0.18, 0), 0.68));
      head.add(box(0.66, 0.07, 0.36, 0.03, mat, 0, 0.2, 0.4));   // козырёк
      break;
    case 'antenna':
      head.add(cylinder(0.04, 0.36, mat, 0, 0.66, 0));
      head.add(ball(0.12, mat, 0, 0.88, 0));
      break;
    case 'ears':
      for (const side of [-1, 1]) head.add(ball(0.19, mat, side * 0.42, 0.36, 0));
      break;
    case 'pikaears':
      for (const side of [-1, 1]) {
        const ear = cone(0.13, 0.6, mat, side * 0.26, 0.62, 0);
        ear.rotation.z = -side * 0.35;
        head.add(ear);
      }
      break;
    case 'batears':
      for (const side of [-1, 1]) {
        const ear = cone(0.15, 0.45, mat, side * 0.24, 0.56, 0);
        ear.rotation.z = -side * 0.2;
        head.add(ear);
      }
      break;
    case 'quills':
      for (let i = -2; i <= 2; i++) {
        const q = cone(0.14, 0.7, mat, i * 0.16, 0.32, -0.34);
        q.rotation.x = 1.1;
        head.add(q);
      }
      break;
    case 'spiky':
      for (let i = -1; i <= 1; i++) head.add(cone(0.13, 0.34, mat, i * 0.24, 0.5, 0));
      break;
    case 'bun':
      head.add(squash(halfBall(0.55, mat, 0, 0.18, 0), 0.62));
      head.add(ball(0.22, mat, 0, 0.6, -0.18));
      break;
    case 'bald':
    default:
      break;
  }
}

function addBeanie(head, hat, materialFor) {
  const mat = materialFor(hat.color || DARK);
  head.add(squash(halfBall(0.57, mat, 0, 0.18, 0), 0.72));
  head.add(box(0.86, 0.09, 0.46, 0.04, mat, 0, 0.2, 0.38));
}

function addHelmet(head, color, materialFor) {
  head.add(squash(halfBall(0.56, materialFor(color), 0, 0.16, 0), 0.7));
}

function addMask(head, color, materialFor) {
  head.add(box(0.9, 0.26, 0.9, 0.1, materialFor(color), 0, 0.06, 0.06));
}

// Эмблема на груди. Звезда, молния и паук — контуры из shapes.js; надпись
// (шестьдесят семь у Супер-Егора) — просто пластина: буквы на груди в объёме
// нечитаемы всё равно, а нечитающему ребёнку они и не адресованы.
function addChestEmblem(node, look, bodyW, y, materialFor) {
  const chest = look.chest;
  if (!chest || chest === 'none') return;
  const z = BODY_DEPTH / 2;
  const white = materialFor(EYE_WHITE);

  if (chest === 'star') {
    node.add(flat(starShape(0.3), materialFor('#ffd93d'), 0, y, z));
  } else if (chest === 'bolt') {
    node.add(flat(boltShape(0.3), materialFor('#ffd93d'), 0, y, z));
  } else if (chest === 'spider') {
    node.add(flat(starShape(0.3, 8, 0.3), materialFor(DARK), 0, y, z));
  } else {
    node.add(flat(roundedRect(0.5 * bodyW, 0.34, 0.08), white, 0, y, z));
  }
}

// --- Походка ---

// Шаг и мах руками — от того же walkPhase, по которому шагает двумерный
// персонаж. Поэтому объёмный герой попадает в такт со звуком и с 2D-версией.
export function poseFigure(figure, walkPhase) {
  const { parts, kind } = figure;
  const swing = Math.sin(walkPhase) * (parts.stride ?? 1);

  if (kind === 'beast') {
    // Четвероногий переставляет лапы по диагонали, иначе он скачет зайцем.
    parts.legs.forEach((leg, i) => {
      leg.rotation.x = swing * LEG_SWING * ((i === 0 || i === 3) ? 1 : -1);
    });
    return;
  }

  parts.legs.forEach((leg, i) => { leg.rotation.x = swing * LEG_SWING * (i ? -1 : 1); });
  if (kind === 'hero') {
    parts.arms.forEach((arm, i) => { arm.rotation.x = swing * ARM_SWING * (i ? 1 : -1); });
  }
  if (parts.float) {
    // Шарик не шагает, он покачивается.
    figure.node.position.y = Math.sin(walkPhase * 0.6) * 0.12;
  }
}

// --- Примитивы ---

function box(w, h, d, radius, material, x = 0, y = 0, z = 0) {
  const mesh = new Mesh(extrude(roundedRect(w, h, radius), d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function flat(shape, material, x, y, z) {
  const mesh = new Mesh(extrude(shape, FLAT_DEPTH), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function ball(r, material, x = 0, y = 0, z = 0) {
  const mesh = new Mesh(new SphereGeometry(r, 14, 10), material);
  mesh.position.set(x, y, z);
  return mesh;
}

// Приплюснуть по высоте. Отдельной операцией, а не отдельной геометрией:
// шапки и шлемы отличаются только тем, насколько они плоские.
function squash(mesh, factor) {
  mesh.scale.y = factor;
  return mesh;
}

function halfBall(r, material, x = 0, y = 0, z = 0) {
  const mesh = new Mesh(new SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function cone(r, h, material, x = 0, y = 0, z = 0, rotX = 0) {
  const mesh = new Mesh(new ConeGeometry(r, h, 10), material);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rotX;
  return mesh;
}

function cylinder(r, h, material, x = 0, y = 0, z = 0) {
  const mesh = new Mesh(new CylinderGeometry(r, r, h, 12), material);
  mesh.position.set(x, y, z);
  return mesh;
}

// Притемнение цвета: у зомби ноги темнее кожи, и в 2D это делает та же
// операция. Держим свою копию, чтобы render3d не зависел от sprites.js.
function shade(hex, amount) {
  const value = String(hex || '#888888').replace('#', '');
  if (value.length !== 6) return hex;
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16);
    const shifted = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.round(Math.min(255, Math.max(0, shifted)));
  });
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
