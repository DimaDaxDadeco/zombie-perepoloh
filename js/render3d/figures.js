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
  Group, Mesh, SphereGeometry, CylinderGeometry, ConeGeometry, TorusGeometry,
  PlaneGeometry, CanvasTexture, MeshBasicMaterial, LinearFilter, Shape, DoubleSide,
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
const CAPE_FLARE = 0.3;    // насколько плащ откинут назад в покое
const CAPE_WAVE = 0.16;    // строго меньше отклона — иначе плащ уйдёт в тело

const BODY_WIDTH = { normal: 1, thin: 0.82, fat: 1.28 };
const EYE_WHITE = '#ffffff';
const DARK = '#2a2320';
const DEFAULT_SKIN = '#c8c8c8';
// Рот — половинка тора: дуга, открытая вверх, читается улыбкой, вниз —
// недовольством. Лежит в плоскости лица, поэтому смотрит туда же, куда глаза.
const MOUTH_GEOMETRY = new TorusGeometry(1, 0.17, 5, 14, Math.PI);
// Длина вытянутой руки зомби. Константой, а не числом по месту: за неё же
// цепляется тросточка деда, и разъехавшись, они перестали бы быть рукой с
// палкой.
const ARM_REACH = 0.85;
const CAPE_LINKS = 3;
const CAPE_LINK_LEN = 0.52;

// --- Сборка ---

// Единственная точка входа: по сущности и её look отдаёт готовый узел сцены и
// список подвижных частей. materialFor приходит снаружи, чтобы материалы
// кэшировались один раз на всю игру, а не на каждого зомби.
export function buildFigure(look = {}, kind, materialFor) {
  if (kind === 'drone') return buildDrone(look, materialFor);
  // Форму зверя задаёт ЛИБО look.shape (так помечены зомби-звери), ЛИБО вид,
  // переданный снаружи. Второе — ради собаки-питомца: у неё в look только
  // beast, без shape, потому что в плоской игре форму знает сам класс питомца
  // и признак ему не нужен. Без этой ветки собака выходила человеком.
  if (kind === 'beast' || look.shape === 'beast') return buildBeast(look, materialFor);
  if (kind === 'thief') return buildZombie(look, materialFor, { thief: true });
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
  // У героев одежда лежит в shirt/pants, а у спасённого друга — в clothes:
  // его look собран как у питомца. Без запасного варианта он выходил серым.
  const shirtColor = look.shirt || look.clothes || DEFAULT_SKIN;
  const pantsColor = look.pants || shade(shirtColor, -0.25);
  const legMat = materialFor(pantsColor);
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
  node.add(box(bodyW, 1.0, BODY_DEPTH, 0.3, materialFor(shirtColor), 0, up(0.1), 0));

  if (look.cape) addCape(node, parts, look.cape, bodyW, up(-0.42), materialFor);

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
  // Маска закрывает лицо целиком и рисует свои глаза — рот под ней не нужен,
  // это же правило и в drawFace.
  if (!look.mask) addMouth(head, 0.52, materialFor);
  if (look.hairStyle === 'ears') addWhiskers(head, 0.52, materialFor);
  addHair(head, look.hairStyle, look.hair, materialFor);
  if (look.hat) addBeanie(head, look.hat, materialFor);
  parts.head = head;
  node.add(head);

  return { node, parts, kind: 'hero' };
}

// Зомби. Из drawZombie: руки вытянуты ВПЕРЁД — это его главная примета, и в
// объёме она наконец работает буквально, а не намёком.
function buildZombie(look, materialFor, { thief = false } = {}) {
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
    const arm = box(0.24, 0.24, ARM_REACH, 0.1, armMat, 0, 0, ARM_REACH / 2);
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
    // Волосы зомби темнее его кожи, а лысина седая — ровно как в drawZombieHair.
    addHair(head, look.hair, look.hair === 'bald' ? '#dfe3e0' : shade(look.skin, -0.35),
      materialFor);
  }
  // Маска охранника закрывает лицо целиком и рисует свой знак — глаза и рот
  // под ней не нужны, ровно как в drawBossFace.
  const masked = look.face === 'guardmask';
  if (!masked) {
    // Глаза врастопырку и разного размера, ухмылка набок с одним зубом — это
    // зомби и в 2D, и здесь.
    addEyes(head, 0.5, 0.15, materialFor, { skew: true });
    if (look.head !== 'pumpkin') addMouth(head, 0.5, materialFor, { tilt: 0.22, tooth: true });
  }
  // Маска воришки — ЧАСТЬ ГОЛОВЫ, а не наклейка поверх фигурки. Наклейка
  // всегда повёрнута к зрителю, а голова — по направлению бега: стоило
  // воришке отвернуться, и маска оказывалась на затылке.
  if (thief) {
    addThiefMask(head, 0.5, materialFor);
    // Мешок с добычей за спиной — вторая его примета.
    node.add(ball(0.42, materialFor('#c9a23c'), 0, up(-0.35), -BODY_DEPTH / 2 - 0.28));
  }
  if (look.helmet) addHelmet(head, look.helmet, materialFor);
  // Шляпа босса приходит СТРОКОЙ (cylinder, crown и прочие), а у героя это
  // объект с цветом и буквой. По типу их и различаем: заводить второе поле
  // ради объёмного режима значило бы трогать конфиг игры.
  if (typeof look.hat === 'string') {
    addBossHat(head, look, materialFor);
    // Эмблема на груди, паучьи лапы за спиной и маска на лице. Без них
    // четверо боссов с бабочкой отличались бы только цветом, а в плоской
    // версии у каждого своя примета.
    addBossChest(node, look, 0.96 * width, up(0.05), materialFor);
    if (look.back === 'spiderlegs') addSpiderLegs(node, look, up(0.1), materialFor);
    if (look.face === 'guardmask') addGuardMask(head, materialFor);
    else if (look.face) addMask(head, look.accent || DARK, materialFor);
  }
  if (look.mask) addMask(head, look.mask, materialFor);
  if (look.beard) node.add(box(0.5, 0.32, 0.2, 0.1, materialFor(look.beard), 0, up(-0.45), 0.36));

  // Тросточка деда — В РУКЕ, а не рядом. Берём ту же точку, где кончается
  // вытянутая вперёд рука: иначе палка висит сбоку сама по себе, и видно,
  // что дед её не держит.
  if (look.cane) {
    const wood = materialFor(look.cane);
    const handX = 0.34 * width;
    const handY = up(-0.15);
    const handZ = BODY_DEPTH / 2 + ARM_REACH;
    // Палка чуть наклонена вперёд — так стоит трость, на которую опираются.
    const stick = cylinder(0.07, handY, wood, handX, handY / 2, handZ + 0.12);
    stick.rotation.x = -0.1;
    node.add(stick);
    // Загнутая ручка обхватывает кисть сверху.
    const grip = new Mesh(new TorusGeometry(0.16, 0.07, 5, 10, Math.PI), wood);
    grip.position.set(handX - 0.14, handY + 0.02, handZ + 0.1);
    grip.rotation.z = -Math.PI / 2;
    node.add(grip);
  }

  // Ролики: платформа и два колеса под каждой ногой. Ноги у роликового зомби
  // не шагают (stride: 0) — он катится, и ролики это объясняют.
  if (look.skates) {
    const board = materialFor(look.skates);
    const wheel = materialFor('#2f3550');
    for (const side of [-1, 1]) {
      node.add(box(0.42, 0.12, 0.5, 0.05, board, side * 0.26, up(1.02), 0.05));
      for (const at of [-0.16, 0.2]) {
        const w = cylinder(0.09, 0.1, wheel, side * 0.26, up(1.16), at);
        w.rotation.z = Math.PI / 2;
        node.add(w);
      }
    }
  }
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
  // Морда: у крота она длиннее всех, у кота почти нет.
  const snout = { mole: 0.5, cat: 0.18 }[look.beast] ?? 0.34;
  head.add(box(0.3, 0.24, snout, 0.1, skin, 0, -0.1, 0.28 + snout / 2));
  head.add(ball(0.09, materialFor(DARK), 0, -0.06, 0.32 + snout));   // нос
  addBeastEars(head, look.beast, skin);
  addEyes(head, 0.4, 0.12, materialFor);
  addMouth(head, 0.4, materialFor, { width: 0.34 });
  parts.head = head;
  node.add(head);

  // Ошейник — примета домашней собаки, а не зомби-пса: в плоской версии он
  // тоже отличает питомца от врага той же формы.
  if (look.collar) {
    const collar = cylinder(0.34, 0.14, materialFor(look.collar), 0, 0.9, 0.35);
    collar.rotation.x = Math.PI / 2;
    node.add(collar);
  }

  // Хвост торчит назад и вверх — по нему зверь читается со спины, когда морды
  // не видно вовсе.
  node.add(box(0.14, 0.14, 0.5, 0.06, skin, 0, 0.9, -0.72));
  parts.stride = 1;
  return { node, parts, kind: 'beast' };
}

// Уши: у кота торчком, у собаки висят, у крота почти нет. По ним зверь и
// различается — тело у всех троих одно.
function addBeastEars(head, beast, material) {
  for (const side of [-1, 1]) {
    if (beast === 'cat') {
      const ear = cone(0.16, 0.34, material, side * 0.22, 0.38, -0.02);
      ear.rotation.z = -side * 0.15;
      head.add(ear);
    } else if (beast === 'mole') {
      head.add(ball(0.1, material, side * 0.3, 0.24, -0.06));
    } else {
      const ear = box(0.16, 0.42, 0.22, 0.09, material, side * 0.34, 0.12, -0.04);
      ear.rotation.z = -side * 0.35;
      head.add(ear);
    }
  }
}

function buildBalloon(look, materialFor) {
  const node = new Group();
  // Покачивание вешаем на ВНУТРЕННИЙ узел. Раньше оно двигало сам node, а его
  // позицией распоряжается сцена — шарик уезжал из своей клетки и на стенде
  // пропадал вовсе.
  const float = new Group();
  node.add(float);
  const color = look.balloon || look.clothes || look.skin;
  float.add(ball(0.85, materialFor(color), 0, 1.15, 0));
  float.add(cone(0.16, 0.3, materialFor(color), 0, 0.35, 0));
  const head = new Group();
  head.position.set(0, 1.3, 0);
  addEyes(head, 0.85, 0.16, materialFor);
  addMouth(head, 0.85, materialFor, { width: 0.3 });
  float.add(head);
  return { node, parts: { legs: [], arms: [], head, float }, kind: 'balloon' };
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


// Дрон-питомец: корпус, глаз и винт. Ног нет, поэтому висит над землёй.
function buildDrone(look, materialFor) {
  const node = new Group();
  const float = new Group();
  node.add(float);
  const body = materialFor(look.body || '#8fa3b8');
  float.add(ball(0.5, body, 0, 1.2, 0));
  float.add(ball(0.2, materialFor(look.eye || '#4fc3f7'), 0, 1.2, 0.42));
  const rotor = cylinder(0.62, 0.05, materialFor('#cfd8e3'), 0, 1.72, 0);
  float.add(rotor);
  return { node, parts: { legs: [], arms: [], rotor, float }, kind: 'drone' };
}

// --- Объекты целей ---
//
// Клетка, костёр, подарок и место доставки. Каждый строится в тех же долях
// радиуса, что и персонажи, и каждый отдаёт tick — свою маленькую анимацию:
// клетка открывается, костёр горит, подарок трясётся. В 2D это делают
// drawCage, drawCampfire и drawGiftBox, читая те же поля пропа.

// Треугольник для половинки бабочки.
function triangleShape(size) {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.lineTo(size, size * 0.8);
  shape.lineTo(size, -size * 0.8);
  shape.closePath();
  return shape;
}

export function buildProp(prop, materialFor) {
  if (prop.layer === 'ground') return buildDropZone(materialFor);
  if ('heat' in prop) return buildCampfire(materialFor);
  if ('carrier' in prop) return buildGift(materialFor);
  if ('progress' in prop) return buildCage(prop, materialFor);
  return null;
}

function buildCage(prop, materialFor) {
  const node = new Group();
  const bars = new Group();
  const metal = materialFor('#b9c4d0');
  const BAR_COUNT = 10;
  for (let i = 0; i < BAR_COUNT; i++) {
    const a = (i / BAR_COUNT) * Math.PI * 2;
    bars.add(cylinder(0.05, 1.7, metal, Math.cos(a) * 0.95, 0.85, Math.sin(a) * 0.95));
  }
  bars.add(torusRing(0.95, 0.06, metal, 1.7));
  bars.add(torusRing(0.95, 0.06, metal, 0.06));
  node.add(bars);

  // Внутри сидит друг — ради него клетку и открывают. Строим его тем же
  // конструктором героя: в 2D клетка тоже получает геройский look.
  const friend = buildFigure(prop.look || {}, 'hero', materialFor);
  friend.node.scale.setScalar(0.55);
  node.add(friend.node);

  return {
    node,
    parts: { legs: [], arms: [] },
    kind: 'cage',
    tick: () => {
      // Прутья поднимаются по мере накопления прогресса, а не разом в конце:
      // ребёнок должен видеть, что стояние рядом работает.
      bars.position.y = (prop.open ? 1 : prop.progress || 0) * 2.4;
      bars.visible = bars.position.y < 2.35;
    },
  };
}

function buildCampfire(materialFor) {
  const node = new Group();
  const wood = materialFor('#8a5a2b');
  for (let i = 0; i < 3; i++) {
    const log = box(0.22, 1.5, 0.22, 0.1, wood, 0, 0.12, 0);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI;
    node.add(log);
  }
  const flame = cone(0.55, 1.3, materialFor('#ff8a2b'), 0, 0.85, 0);
  const core = cone(0.3, 0.8, materialFor('#ffe14d'), 0, 0.6, 0);
  node.add(flame, core);
  return {
    node,
    parts: { legs: [], arms: [] },
    kind: 'campfire',
    tick: (prop, phase) => {
      // Пламя живёт от heat: потухающий костёр оседает, и это единственное,
      // по чему нечитающий ребёнок понимает, что его тушат.
      const heat = Math.max(0, Math.min(1, prop.heat ?? 1));
      const flicker = 1 + Math.sin(phase * 9) * 0.08;
      flame.scale.set(heat * flicker, heat * flicker, heat * flicker);
      core.scale.setScalar(heat * flicker);
      flame.visible = heat > 0.02;
      core.visible = flame.visible;
    },
  };
}

function buildGift(materialFor) {
  const node = new Group();
  const boxMat = materialFor('#e0453f');
  const ribbon = materialFor('#ffd93d');
  node.add(box(1.4, 1.3, 1.4, 0.14, boxMat, 0, 0.65, 0));
  node.add(box(0.26, 1.36, 1.46, 0.05, ribbon, 0, 0.65, 0));
  const across = box(0.26, 1.36, 1.46, 0.05, ribbon, 0, 0.65, 0);
  across.rotation.y = Math.PI / 2;
  node.add(across);
  for (const side of [-1, 1]) node.add(ball(0.22, ribbon, side * 0.2, 1.42, 0));
  return {
    node,
    parts: { legs: [], arms: [] },
    kind: 'gift',
    // Подарок зовёт тряской, а не свечением: так решено ещё в плоской версии.
    tick: (prop, phase) => {
      const shake = prop.carrier ? 0 : Math.sin(phase * 7) * 0.09;
      node.rotation.z = shake;
    },
  };
}

function buildDropZone(materialFor) {
  const node = new Group();
  const ring = torusRing(0.9, 0.1, materialFor('#ffd93d'), 0.06);
  node.add(ring);
  return {
    node,
    parts: { legs: [], arms: [] },
    kind: 'dropzone',
    tick: (prop, phase) => {
      const pulse = 1 + Math.sin(phase * 3) * 0.06;
      ring.scale.set(pulse, 1, pulse);
    },
  };
}

// --- Добыча ---

export function buildPickup(type, materialFor) {
  const node = new Group();
  if (type === 'money') {
    // Купюра лежит на траве, а не стоит ребром: камера смотрит сверху, и
    // поставленная вертикально она с высоты превращается в нитку.
    const note = box(1.7, 1.0, 0.12, 0.1, materialFor('#7bd67b'), 0, 0, 0);
    note.rotation.x = -Math.PI / 2;
    node.add(note);
    const mark = flat(starShape(0.3, 4, 0.4), materialFor('#e8f7e8'), 0, 0.1, 0);
    mark.rotation.x = -Math.PI / 2;
    node.add(mark);
  } else {
    // Монета тоже плашмя: цилиндр и так стоит на оси y, поворачивать его не
    // надо — именно этим он и отличается от выдавленной звезды.
    node.add(cylinder(0.9, 0.18, materialFor('#ffd93d'), 0, 0, 0));
    const star = flat(starShape(0.55), materialFor('#fff3b0'), 0, 0.12, 0);
    star.rotation.x = -Math.PI / 2;
    node.add(star);
  }
  return { node, parts: { legs: [], arms: [] }, kind: 'pickup' };
}

// Кольцо из тонкого цилиндра-обода. Настоящий тор Three умеет, но кольцо из
// плоского цилиндра дешевле и в мультяшной картинке неотличимо.
function torusRing(radius, thickness, material, y) {
  const ring = new Group();
  const SEGMENTS = 16;
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    const piece = box(radius * 0.42, thickness, thickness, thickness / 2, material,
      Math.cos(a) * radius, y, Math.sin(a) * radius);
    piece.rotation.y = -a;
    ring.add(piece);
  }
  return ring;
}


// --- Снаряды ---
//
// У каждого оружия свой снаряд, и по нему выстрел узнаётся: из морковной
// ракеты летит морковка, из помидорной пушки помидор, из улья пчела. В
// плоской игре это так и есть, и терять примету в объёме нельзя — ребёнок
// различает оружие именно по тому, что из него вылетает.
//
// Различать по классу можно смело: у проекта нет сборки, имена классов
// доживают до браузера неизменными. Незнакомый снаряд получает синий шарик —
// новое оружие не должно ронять объёмный режим, только выглядеть скромно.
//
// Каждый строитель работает в единичном радиусе и смотрит в +z: масштаб и
// поворот по скорости ставит buildShot.
const SHOTS = {
  // Растяжение капли передаём явно у обоих: строителю всегда приходит
  // (узел, материал, краска), и число третьим аргументом молча превратилось
  // бы в функцию — меш вышел бы с координатами NaN и просто не нарисовался.
  Bullet: { color: '#4fb3ff', build: (n, m) => drop(n, m, 1) },
  PiercingBullet: { color: '#4fb3ff', build: (n, m) => drop(n, m, 1.7) },
  FlameBolt: { color: '#ff7a2b', build: fireball, spins: false },
  IceShard: { color: '#eafaff', build: snowflake, spins: true },
  Rocket: { color: '#ff8a3b', build: carrot },
  Lob: { color: '#e0453f', build: tomato, spins: true },
  ArcLob: { color: '#e0453f', build: tomato, spins: true },
  GiftLob: { color: '#e0453f', build: gift, spins: true },
  CakeLob: { color: '#ffb6d5', build: cake, spins: true },
  WebGlob: { color: '#f2f2f2', alpha: 0.8, build: webWad, spins: true },
  Boomerang: { color: '#ffd93d', build: boomerang, spins: true },
  // Пузырь — единственный снаряд без объёмной формы: его рисует worldfx
  // наклейкой, той же функцией drawSoapBubble, что и плоская игра. Иначе
  // летящий пузырь и тот, в котором зомби оказывается после попадания,
  // выглядят разными предметами — а связь между ними ребёнок должен видеть
  // сразу.
  Bubble: { flat: true },
  Bee: { color: '#ffd93d', build: bee },
  SpiderMinion: { color: '#2a2320', build: spider },
  Batmobile: { color: '#1b1e26', build: car },
};

const PLATE_BEVEL = 0.03; // доли радиуса: только чтобы грань поймала свет

const SHOT_MIN_STEP = 0.05; // пикселей за кадр: ниже — дрожание, а не полёт

const DEFAULT_SHOT = { color: '#4fb3ff', build: blob };

export function buildShot(shot, materialFor) {
  const spec = SHOTS[shot.constructor?.name] || DEFAULT_SHOT;
  const node = new Group();
  if (spec.flat) return { node, kind: 'shot', flat: true };
  const paint = (color, alpha) => materialFor(color, alpha ?? spec.alpha ?? 1);
  spec.build(node, paint(spec.color), paint);

  const flight = { x: shot.x, y: shot.y, yaw: 0 };

  return {
    node,
    kind: 'shot',
    tick: (entity, phase) => {
      // Летящее разворачиваем по курсу, вертящееся крутим.
      // Своё вращение у снаряда важнее общего: снежинка крутится по
      // собственному spin, и в плоской версии по нему же.
      if (spec.spins) node.rotation.y = entity.spin ?? phase * 6;
      else node.rotation.y = shotHeading(entity, flight);
    },
  };
}

// Куда снаряд смотрит носом. Курс приходится собирать из трёх разных полей:
// прямые снаряды хранят скорость (vx/vy), самонаводящиеся — угол (морковка,
// пчела, паучок доворачивают его каждый кадр), бэтмобиль — только сторону
// (dir). Морковка летела боком именно поэтому: vx/vy у Rocket нет вовсе,
// проверка их не находила, и снаряд оставался в стартовом развороте.
//
// Последним средством — фактическое смещение за кадр: оно есть у чего угодно
// движущегося, и новый класс снаряда не окажется снова заклиненным. Курс
// запоминаем: на месте зависший снаряд должен смотреть туда же, куда летел.
function shotHeading(entity, flight) {
  const dx = entity.x - flight.x;
  const dy = entity.y - flight.y;
  flight.x = entity.x;
  flight.y = entity.y;
  // atan2(x, глубина): нос модели смотрит в +z, как у морковки и бэтмобиля.
  if (entity.vx || entity.vy) flight.yaw = Math.atan2(entity.vx, entity.vy);
  else if (typeof entity.angle === 'number') {
    flight.yaw = Math.atan2(Math.cos(entity.angle), Math.sin(entity.angle));
  } else if (entity.dir) flight.yaw = Math.atan2(entity.dir, 0);
  else if (Math.hypot(dx, dy) > SHOT_MIN_STEP) flight.yaw = Math.atan2(dx, dy);
  return flight.yaw;
}

// Капля воды: шарик с оттянутым назад хвостиком.
function drop(node, material, stretch) {
  node.add(ball(1, material, 0, 0, 0));
  const tail = cone(0.85, 1.6 * stretch, material, 0, 0, -0.9 * stretch, -Math.PI / 2);
  node.add(tail);
}

// Морковка: рыжий конус носом вперёд и зелёная ботва сзади.
function carrot(node, material, paint) {
  node.add(cone(0.78, 2.6, material, 0, 0, 0.2, Math.PI / 2));
  // Поперечные рёбра: без них конус читается как морковка только по цвету.
  const ridge = paint('#e07020');
  for (let i = 0; i < 3; i++) {
    const r = 0.6 - i * 0.14;
    const ring = cylinder(r, 0.12, ridge, 0, 0, -0.4 + i * 0.62);
    ring.rotation.x = Math.PI / 2;
    node.add(ring);
  }
  // Ботва торчит пучком назад и вверх — по ней морковка и опознаётся.
  const leaves = paint('#4f9c34');
  for (let i = -1; i <= 1; i++) {
    const leaf = cone(0.3, 1.5, leaves, i * 0.34, 0.45, -1.5);
    leaf.rotation.x = 0.6;
    leaf.rotation.z = -i * 0.5;
    node.add(leaf);
  }
}

// Помидор: красный шар, зелёная звёздочка-чашелистик сверху.
function tomato(node, material, paint) {
  const body = ball(1, material, 0, 0, 0);
  body.scale.y = 0.88;             // помидор приплюснут, а не идеальный шар
  node.add(body);
  const green = paint('#4f9c34');
  const cap = flat(starShape(0.62), green, 0, 0.8, 0);
  cap.rotation.x = -Math.PI / 2;
  node.add(cap);
  // Черенок торчит вверх: чашелистик лежит плашмя и с уровня земли не виден,
  // а по черенку помидор узнаётся с любой стороны.
  node.add(cylinder(0.12, 0.5, green, 0, 1.05, 0));
}

// Огонь. Не шар: языки пламени, разной длины и с разным наклоном, вокруг
// светлого ядра. Шар читался мячиком — а из огнемёта должно лететь пламя,
// и узнаётся оно именно по рваному краю.
function fireball(node, material, paint) {
  node.add(ball(0.55, paint('#ffe14d'), 0, 0, 0.1));
  node.add(ball(0.8, paint('#ffb03b', 0.9), 0, 0, -0.1));
  // Языки: назад и в стороны, разной длины — ровный веер выглядит цветком.
  const tongues = [
    [0, 0.55, -0.2, 2.1], [0, -0.5, -0.3, 1.7],
    [0.6, 0.1, -0.2, 1.9], [-0.6, 0.15, -0.25, 1.6],
    [0, 0, 0, 2.4],
  ];
  tongues.forEach(([x, y, z, len], i) => {
    const tongue = cone(0.42 - i * 0.03, len, material, x, y, z - len * 0.35, -Math.PI / 2);
    tongue.rotation.z = x * 0.5;
    tongue.rotation.x += y * 0.5;
    node.add(tongue);
  });
}

// Ледяной шип.
// Снежинка: шесть лучей с ответвлениями и льдинка в центре. Ровно то, что
// рисует плоская версия, — там это шестилучевая звезда, и заменять её шипом
// значило бы менять сам предмет, а не только его подачу.
//
// Лежит ПЛАШМЯ, в плоскости земли: камера смотрит сверху, и поставленная
// ребром снежинка превращается в палочку.
function snowflake(node, material, paint) {
  const arm = 0.16;
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI;
    const beam = box(2.4, arm, arm, arm / 2, material, 0, 0, 0);
    beam.rotation.y = angle;
    node.add(beam);
    // Ответвления у концов: без них шесть лучей читаются звёздочкой, а не
    // снежинкой.
    for (const end of [-1, 1]) {
      for (const side of [-1, 1]) {
        const twig = box(0.7, arm * 0.8, arm * 0.8, arm / 2, material,
          Math.cos(angle) * end * 0.85, 0, -Math.sin(angle) * end * 0.85);
        twig.rotation.y = angle + side * 0.9;
        node.add(twig);
      }
    }
  }
  node.add(ball(0.42, paint('#7fd8ff'), 0, 0, 0));
}

// Пчела: полосатое тельце и прозрачные крылышки.
function bee(node, material, paint) {
  // Брюшко жёлтое, полоска одна и узкая, голова чёрная: широкие полосы
  // съедали весь жёлтый, и пчела читалась просто тёмной кляксой.
  const dark = paint('#2a2320');
  node.add(ball(0.85, material, 0, 0, -0.45));
  node.add(ball(0.8, material, 0, 0, 0.15));
  const stripe = ball(0.86, dark, 0, 0, -0.15);
  stripe.scale.z = 0.28;
  node.add(stripe);
  node.add(ball(0.62, dark, 0, 0, 0.8));
  node.add(cone(0.16, 0.6, dark, 0, 0, -1.15, -Math.PI / 2));   // жало
  const wing = paint('#e8f4ff', 0.7);
  for (const side of [-1, 1]) {
    const w = box(1.2, 0.08, 0.7, 0.35, wing, side * 0.8, 0.55, -0.2);
    w.rotation.z = -side * 0.45;
    node.add(w);
  }
}

// Паучок: тёмное тельце и лапки веером.
function spider(node, material, paint) {
  // Тельце нарочно МЕЛЬЧЕ лап: у паука узнаётся не туловище, а размах ног, и
  // крупный шар их просто съедает. Лапы светлее и с коленом.
  node.add(ball(0.6, material, 0, 0.1, -0.3));
  node.add(ball(0.38, material, 0, 0.1, 0.45));
  const mark = flat(starShape(0.24, 4, 0.35), paint('#e0453f'), 0, 0.6, -0.3);
  mark.rotation.x = -Math.PI / 2;
  node.add(mark);

  const limb = paint('#8a7f70');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const hip = new Group();
    hip.position.set(Math.cos(a) * 0.45, 0.15, Math.sin(a) * 0.45);
    hip.rotation.y = -a;
    // Бедро вверх, голень вниз — характерный паучий излом.
    const thigh = box(0.13, 0.13, 0.9, 0.06, limb, 0, 0.28, 0.4);
    thigh.rotation.x = -0.7;
    const shin = box(0.11, 0.11, 0.95, 0.05, limb, 0, 0.1, 0.95);
    shin.rotation.x = 0.8;
    hip.add(thigh, shin);
    node.add(hip);
  }
}

// Бумеранг: два колена под углом. Тонкий и небольшой — он и в плоской игре
// пластинка, а объёмный брус в две длины радиуса выглядел бревном.
function boomerang(node, material) {
  for (const side of [-1, 1]) {
    const arm = box(0.34, 0.2, 1.25, 0.1, material, side * 0.34, 0, 0);
    arm.rotation.y = side * 0.6;
    node.add(arm);
  }
}

// Подарок: коробка с лентой. Тот же силуэт, что у ноши на арене.
function gift(node, material, paint) {
  node.add(box(1.6, 1.5, 1.6, 0.16, material, 0, 0, 0));
  const ribbon = paint('#ffd93d');
  node.add(box(0.3, 1.56, 1.66, 0.06, ribbon, 0, 0, 0));
  const across = box(0.3, 1.56, 1.66, 0.06, ribbon, 0, 0, 0);
  across.rotation.y = Math.PI / 2;
  node.add(across);
}

// Торт: розовый корж и вишенка.
function cake(node, material, paint) {
  node.add(cylinder(1, 1.1, material, 0, 0, 0));
  node.add(cylinder(1.05, 0.3, paint('#ffffff'), 0, 0.5, 0));
  node.add(ball(0.28, paint('#e0453f'), 0, 0.8, 0));
}

// Бэтмобиль: длинный корпус, кабина, острый нос и колёса. Колёса тут не
// украшение — без них скруглённый корпус читается просто тёмным бруском, а
// это машина Бэтмена, ребёнок её ждёт.
// Бэтмобиль. Плоская версия рисует его в профиль (drawBatmobile: клин,
// плавник, стекло, фара), но камера в объёме смотрит СВЕРХУ — и узнают
// машину по плану: острый нос, узкая талия и раздвоенный хвост крыльями
// летучей мыши. Поэтому корпус здесь — не выдавленный профиль, а выдавленный
// СИЛУЭТ СВЕРХУ, двумя ярусами: широкое основание и сужённая надстройка.
// Первая попытка была профилем, и с высоты получался фургончик.
//
// Плавник, стекло, фары и сопло добавлены сверх плана: они дочитывают машину
// с земли, когда камеру опускают мышкой.
function car(node, material, paint) {
  const dark = paint('#0d0f14');
  // Корпус одной пластиной: два яруса выглядели горой чёрных обломков, а
  // машина должна читаться одним силуэтом. Низкая и длинная — этим бэтмобиль
  // и отличается от машинки из «Объектов».
  node.add(planPlate(CAR_PLAN, 1, 0.26, material, -0.14));
  // Хребет: узкая полоса от носа к плавнику. Она и делает плоскую пластину
  // машиной, а не кляксой.
  node.add(sidePlate([[-0.66, 0.0], [-0.58, 0.16], [0.5, 0.16], [0.86, -0.02]], 0.3, material));
  // Плавник на корме, скошенный назад: им машина опознаётся, когда камеру
  // опускают к земле.
  node.add(sidePlate([[-0.95, 0.02], [-0.7, 0.5], [-0.45, 0.04]], 0.1, material));
  // Стекло кабины скошенным клином, а не коробкой: коробка лежала на крыше
  // отдельным синим кубиком.
  node.add(sidePlate([[-0.28, 0.14], [-0.02, 0.34], [0.36, 0.12]], 0.32, paint('#3f7fae')));
  // Фары по краям носа.
  for (const side of [-1, 1]) node.add(ball(0.08, paint('#ffe14d'), side * 0.13, 0.02, 1.0));
  // Сопло турбины: горячее кольцо в корме. Сверху это единственное яркое
  // пятно на чёрной машине — по нему видно, где у неё зад.
  const jet = cylinder(0.15, 0.13, paint('#ff7a2b'), 0, -0.02, -1.0);
  jet.rotation.x = Math.PI / 2;
  node.add(jet);
  // Колёса прижаты к борту: расставленные широко превращали машину в багги.
  const hub = paint('#3a3f4a');
  for (const sx of [-1, 1]) {
    for (const sz of [-0.5, 0.45]) {
      const tyre = cylinder(0.24, 0.14, dark, sx * 0.34, -0.16, sz);
      tyre.rotation.z = Math.PI / 2;
      node.add(tyre);
      const disc = cylinder(0.1, 0.16, hub, sx * 0.37, -0.16, sz);
      disc.rotation.z = Math.PI / 2;
      node.add(disc);
    }
  }
}

// Силуэт сверху: нос впереди (+z), к корме крылья с вырезом между ними.
// Пары — [поперёк, вдоль]; вторая половина достраивается зеркально, чтобы
// машина не оказалась кривой от опечатки в одной точке.
const CAR_PLAN = [
  [0, 1.18], [0.2, 0.75], [0.3, 0.15], [0.36, -0.45],
  [0.8, -0.7], [0.46, -0.82], [0.52, -1.08], [0.13, -0.92],
];

// Пластина по силуэту сверху: контур задаётся половиной, отражается и
// выдавливается вниз на height.
function planPlate(plan, scale, height, material, y) {
  const half = plan.map(([x, z]) => [x * scale, z * scale]);
  const shape = new Shape();
  shape.moveTo(half[0][0], half[0][1]);
  for (const [x, z] of half.slice(1)) shape.lineTo(x, z);
  for (const [x, z] of [...half].reverse()) shape.lineTo(-x, z);
  shape.closePath();
  const mesh = new Mesh(extrude(shape, height, PLATE_BEVEL), material);
  mesh.rotation.x = Math.PI / 2;   // контур ложится в плоскость земли
  mesh.position.set(0, y, 0);
  return mesh;
}

// Пластина по профилю «вид сбоку»: точки задаются парами [вдоль машины,
// вверх], выдавливание идёт поперёк. extrude() центрирует геометрию, поэтому
// деталь возвращаем на её место в профиле сами — иначе каждая часть съезжала
// бы к нулю и машина рассыпалась.
//
// Фаска задаётся МАЛЕНЬКОЙ и явно: по умолчанию extrude() берёт её от
// толщины, а поперёк кузова толщина большая — фаска раздувала профиль на
// полтора десятых радиуса в каждую сторону, и клин с плавником превращался в
// скруглённый ящик.
function sidePlate(points, width, material, bevel = PLATE_BEVEL) {
  const shape = new Shape();
  points.forEach(([z, y], i) => (i ? shape.lineTo(z, y) : shape.moveTo(z, y)));
  shape.closePath();
  const mesh = new Mesh(extrude(shape, width, bevel), material);
  mesh.rotation.y = -Math.PI / 2;   // ось профиля (+x) смотрит вперёд, в +z
  const zs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  mesh.position.set(0, (Math.min(...ys) + Math.max(...ys)) / 2,
    (Math.min(...zs) + Math.max(...zs)) / 2);
  return mesh;
}

function blob(node, material) {
  node.add(ball(1, material, 0, 0, 0));
}

// Ком паутины: приплюснутый шар и нити крест-накрест поверх него.
function webWad(node, material, paint) {
  const wad = ball(0.9, material, 0, 0, 0);
  wad.scale.set(1, 0.75, 1);
  node.add(wad);
  // Нити СЕРО-ГОЛУБЫЕ, а не белые: белым по белому кому паутины не видно
  // вовсе, и снаряд опять превращается в кружок.
  const thread = paint('#8fa3b8');
  for (let i = 0; i < 3; i++) {
    const strand = box(2.3, 0.13, 0.13, 0.06, thread, 0, 0, 0);
    strand.rotation.y = (i / 3) * Math.PI;
    strand.rotation.z = 0.3;
    node.add(strand);
  }
  for (const [r, y] of [[0.75, 0.28], [1.05, -0.05]]) {
    const ring = cylinder(r, 0.11, thread, 0, y, 0);
    ring.rotation.x = Math.PI / 2;
    node.add(ring);
  }
}

// --- Детали ---

function addEyes(head, headRadius, eyeRadius, materialFor, { skew = false } = {}) {
  const white = materialFor(EYE_WHITE);
  const dark = materialFor(DARK);
  const z = faceDepth(headRadius, headRadius * 0.1) * 0.9;
  const spread = headRadius * 0.36;
  const pairs = skew
    ? [[-spread, headRadius * 0.1, eyeRadius], [spread * 0.95, headRadius * 0.16, eyeRadius * 0.78]]
    : [[-spread, headRadius * 0.08, eyeRadius], [spread, headRadius * 0.08, eyeRadius]];
  for (const [x, y, r] of pairs) {
    head.add(ball(r, white, x, y, z));
    head.add(ball(r * 0.5, dark, x, y, z + r * 0.62));
  }
}

// Плащ из трёх звеньев, подвешенных друг за друга. Плоская панель за спиной
// не годится: в 2D плащ ВОЛНУЕТСЯ — его контур пересчитывается от walkPhase,
// и это половина всего образа Супер-мэна и Бэтмена. Цепочка звеньев даёт то
// же самое: качается каждое, и волна бежит сверху вниз.
function addCape(node, parts, color, bodyW, topY, materialFor) {
  const mat = materialFor(color);
  const links = [];
  let parent = node;
  for (let i = 0; i < CAPE_LINKS; i++) {
    const link = new Group();
    if (i === 0) link.position.set(0, topY, -BODY_DEPTH / 2 - FLAT_DEPTH * 0.5);
    else link.position.set(0, -CAPE_LINK_LEN, 0);
    // Книзу плащ сужается — иначе он висит доской.
    const w = bodyW * (1.02 - i * 0.13);
    link.add(box(w, CAPE_LINK_LEN, FLAT_DEPTH, 0.08, mat, 0, -CAPE_LINK_LEN / 2, 0));
    parent.add(link);
    parent = link;
    links.push(link);
  }
  parts.cape = links;
}

// Надпись на груди — настоящим текстом на холсте. Выдавить её фигурой нельзя:
// «67» Супер-Егора на игровом размере превращается в две кляксы, а ребёнок
// узнаёт героя именно по ней.
const textures = new Map();

function textPlate(text, color) {
  const key = `${text}|${color}`;
  if (textures.has(key)) return textures.get(key);
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(size * 0.62)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2);
  const texture = new CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  const material = new MeshBasicMaterial({ map: texture, transparent: true, side: DoubleSide });
  textures.set(key, material);
  return material;
}

// Рот. В плоской игре он есть у всех — у героя дуга под глазами, у зомби
// кривая ухмылка с зубом, — и без него лицо выходит пустым.
//
// tilt перекашивает ухмылку, tooth добавляет зуб: ровно то, чем зомби
// отличается от героя, и ровно то, что рисует drawZombie.
function addMouth(head, headRadius, materialFor, { tilt = 0, tooth = false, width = 0.42 } = {}) {
  const y = -headRadius * 0.3;
  // Глубину считаем по САМОЙ сфере, а не долей радиуса: голова круглая, и на
  // уровне рта её поверхность ближе к центру, чем на уровне глаз. Первый
  // вариант с фиксированной долей утопил рты внутрь головы, и лица остались
  // без них.
  const z = faceDepth(headRadius, y);

  if (!tooth) {
    // Улыбка — дуга под глазами. Полоборота: тор рождается сверху, а улыбка
    // это дуга снизу.
    const mouth = new Mesh(MOUTH_GEOMETRY, materialFor(DARK));
    mouth.scale.setScalar(headRadius * width);
    mouth.position.set(0, y, z);
    mouth.rotation.z = Math.PI + tilt;
    head.add(mouth);
    return;
  }

  // Щербатая ухмылка зомби — ОТКРЫТЫЙ рот: тёмное пятно, и зубы внутри него.
  // Раньше зубы висели поверх тонкой дуги и читались белыми пятнами на лице,
  // а не зубами во рту: у дуги нет внутренней области, куда их поставить.
  const mouthW = headRadius * 0.62;
  const mouthH = headRadius * 0.34;
  const cavity = flat(roundedRect(mouthW, mouthH, headRadius * 0.12), materialFor(DARK), 0, y, z);
  cavity.rotation.z = tilt;
  head.add(cavity);

  // Зубы свисают с верхней кромки, не выходя за пятно, — потому и читаются
  // как зубы во рту. Разной длины: они и растут неровно.
  const white = materialFor('#ffffff');
  for (const [side, w, h] of [[-0.22, 0.17, 0.2], [0.2, 0.14, 0.15]]) {
    const tw = headRadius * w;
    const th = headRadius * h;
    const tip = box(tw, th, FLAT_DEPTH * 0.7, tw * 0.2, white,
      headRadius * side, y + mouthH / 2 - th / 2, z + 0.03);
    tip.rotation.z = tilt;
    head.add(tip);
  }
}

// Где поверхность головы на заданной высоте. Чуть снаружи — иначе деталь
// наполовину тонет в сфере и выглядит вдавленной.
function faceDepth(headRadius, y) {
  const inside = Math.max(0.02, headRadius * headRadius - y * y);
  return Math.sqrt(inside) * 0.99;
}

// Усы и носик кота. В плоской версии их рисует drawWhiskers, и именно по ним
// кот отличается от медведя — круглых ушей для этого мало.
function addWhiskers(head, headRadius, materialFor) {
  const hair = materialFor('#6b5540');
  for (const side of [-1, 1]) {
    for (const dy of [-0.06, 0.06]) {
      const y = headRadius * (dy - 0.12);
      const whisker = box(headRadius * 0.66, 0.05, 0.05, 0.02, hair,
        side * headRadius * 0.6, y, faceDepth(headRadius, y) * 0.8);
      whisker.rotation.z = -side * dy * 2.4;
      head.add(whisker);
    }
  }
  const noseY = -headRadius * 0.12;
  head.add(cone(headRadius * 0.13, headRadius * 0.16, materialFor('#ff9db1'),
    0, noseY, faceDepth(headRadius, noseY), Math.PI));
}

// Причёски. Те же варианты, что в 2D: список закрытый, и незнакомое значение
// должно оставлять персонажа лысым, а не ронять сцену.
//
// Стиль и цвет приходят ОТДЕЛЬНО, и это не придирка: у героя look.hairStyle —
// причёска, а look.hair — её цвет, а у зомби look.hair это САМА причёска, а
// цвет считается от кожи. Один общий разбор look молча красил бы зомби в
// цвет с именем «spiky».
function addHair(head, style, color, materialFor) {
  if (!style || !color || style === 'none') return;
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
    // Кошачьи уши ОСТРЫЕ и с розовой серединкой. Круглые шарики читались
    // медвежьими — это была главная причина, по которой Котик не выглядел
    // котом.
    case 'ears':
      for (const side of [-1, 1]) {
        const ear = cone(0.22, 0.52, mat, side * 0.32, 0.5, 0);
        ear.rotation.z = -side * 0.3;
        head.add(ear);
        const inner = cone(0.12, 0.34, materialFor('#ff9db1'), side * 0.32, 0.52, 0.06);
        inner.rotation.z = -side * 0.3;
        head.add(inner);
      }
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
    // Ирокез: гребень колючек по центру головы, откинутый назад. Раньше это
    // был веер вбок — со спины он читался, а спереди пропадал совсем.
    case 'quills':
      for (let i = 0; i < 4; i++) {
        const len = 0.85 - i * 0.12;
        const q = cone(0.17, len, mat, 0, 0.46 - i * 0.06, -0.1 - i * 0.24);
        q.rotation.x = 0.55 + i * 0.12;   // чем дальше к затылку, тем ниже
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
    // Лысина с двумя кустиками над ушами — дедовская классика, и в плоской
    // версии это отдельная ветка, а не отсутствие волос.
    case 'bald':
      for (const side of [-1, 1]) {
        const tuft = ball(0.16, mat, side * 0.42, 0.16, 0);
        tuft.scale.set(1, 0.62, 0.8);
        head.add(tuft);
      }
      break;
    default:
      break;
  }
}

function addBeanie(head, hat, materialFor) {
  const mat = materialFor(hat.color || DARK);
  head.add(squash(halfBall(0.57, mat, 0, 0.18, 0), 0.72));
  head.add(box(0.86, 0.09, 0.46, 0.04, mat, 0, 0.2, 0.38));
}

// Шляпы боссов. Список закрытый, как и причёски: незнакомая шляпа должна
// оставить босса простоволосым, а не уронить сцену.
//
// Цвета взяты из drawBossHat числами, а не из look.accent: у 2D почти каждая
// шляпа красится своим цветом (цилиндр тёмный с лентой цвета акцента, парик
// рыжий с чёрным котелком, череп костяной), и общий акцент превращал их все
// в одинаковые купола.
function addBossHat(head, look, materialFor) {
  const accent = materialFor(look.accent || DARK);
  switch (look.hat) {
    case 'tophat':
      head.add(cylinder(0.42, 0.85, materialFor('#2b2b3d'), 0, 0.78, 0));
      head.add(cylinder(0.7, 0.08, materialFor('#2b2b3d'), 0, 0.38, 0));
      head.add(cylinder(0.44, 0.16, accent, 0, 0.44, 0));   // лента
      break;
    case 'crown': {
      head.add(cylinder(0.46, 0.3, accent, 0, 0.55, 0));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        head.add(cone(0.1, 0.28, accent, Math.cos(a) * 0.4, 0.8, Math.sin(a) * 0.4));
      }
      break;
    }
    case 'headband':
      head.add(cylinder(0.53, 0.16, materialFor(look.headbandColor || '#e03b3b'), 0, 0.3, 0));
      break;
    case 'skullhat':
      // Запасной череп надет шапкой: костяной шар с двумя тёмными глазницами.
      head.add(ball(0.34, materialFor('#f3efe0'), 0, 0.72, 0));
      for (const side of [-1, 1]) {
        head.add(ball(0.08, materialFor('#3b3b46'), side * 0.12, 0.74, 0.28));
      }
      break;
    case 'wig':
      // Рыжие кудри и крошечный котелок поверх них.
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        head.add(ball(0.24, materialFor('#ff8a2b'), Math.cos(a) * 0.36, 0.44, Math.sin(a) * 0.36));
      }
      head.add(cylinder(0.34, 0.06, materialFor('#2b2b3d'), 0, 0.72, 0));
      head.add(cylinder(0.22, 0.26, materialFor('#2b2b3d'), 0, 0.86, 0));
      head.add(ball(0.1, materialFor('#4fb3ff'), 0.26, 0.86, 0.12));
      break;
    case 'hood':
      // Капюшон комбинезона обтягивает голову — цветом одежды, а не акцентом.
      head.add(squash(halfBall(0.64, materialFor(look.clothes), 0, 0.06, 0), 1.15));
      break;
    case 'bulb':
      head.add(cylinder(0.06, 0.3, materialFor('#8a8a9c'), 0, 0.6, 0));
      head.add(ball(0.28, materialFor('#fff36b'), 0, 0.9, 0));
      break;
    case 'bun':
      // Пучок с бантом: волосы темнее кожи, бант цвета акцента.
      head.add(ball(0.26, materialFor(shade(look.skin, -0.35)), 0, 0.62, -0.1));
      head.add(ball(0.13, accent, 0, 0.78, 0.02));
      break;
    case 'beanie':
    default:
      head.add(squash(halfBall(0.57, materialFor('#c94f8a'), 0, 0.18, 0), 0.72));
      head.add(ball(0.14, materialFor('#ffd93d'), 0, 0.5, 0));   // помпон
      break;
  }
}

// Эмблемы на груди боссов. Семь видов, и каждый — примета своего: бабочка у
// толстяка в цилиндре, номер у спортсмена, рёбра у костяного, помпоны у
// клоуна, паук, молния, крест лекаря.
function addBossChest(node, look, bodyW, y, materialFor) {
  const accent = materialFor(look.accent || '#ffd93d');
  const z = BODY_DEPTH / 2;
  switch (look.chest) {
    case 'bowtie': {
      for (const side of [-1, 1]) {
        const wing = flat(triangleShape(0.34), accent, side * 0.2, y, z);
        wing.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        node.add(wing);
      }
      node.add(ball(0.1, accent, 0, y, z + 0.05));
      break;
    }
    case 'number':
      node.add(flat(roundedRect(0.46 * bodyW, 0.34, 0.08), materialFor('#ffffff'), 0, y, z));
      break;
    case 'ribs':
      for (let i = -1; i <= 1; i++) {
        node.add(flat(roundedRect(0.62 * bodyW, 0.1, 0.05), materialFor('#f3efe0'), 0, y + i * 0.22, z));
      }
      break;
    case 'pompoms':
      for (let i = -1; i <= 1; i++) node.add(ball(0.16, accent, 0, y + i * 0.3, z + 0.06));
      break;
    case 'spider':
      node.add(flat(starShape(0.3, 8, 0.3), materialFor(DARK), 0, y, z));
      break;
    case 'bolt':
      node.add(flat(boltShape(0.3), accent, 0, y, z));
      break;
    case 'belt': {
      // Пояс с пряжкой: у охранника на комбинезоне больше ничего нет, и
      // раньше он оставался единственным боссом без приметы на груди.
      node.add(flat(roundedRect(bodyW, 0.18, 0.06), materialFor('#2b2b3d'), 0, y - 0.32, z));
      node.add(flat(roundedRect(0.22, 0.24, 0.06), accent, 0, y - 0.32, z + 0.03));
      break;
    }
    case 'badge':
      node.add(flat(roundedRect(0.42, 0.14, 0.05), materialFor('#ffffff'), 0, y, z));
      node.add(flat(roundedRect(0.14, 0.42, 0.05), materialFor('#ffffff'), 0, y, z));
      break;
    default:
      break;
  }
}

// Паучьи лапы за спиной: четыре дуги, торчащие вверх и в стороны. Это
// единственное, чем босс-паук отличается силуэтом, а не раскраской.
function addSpiderLegs(node, look, y, materialFor) {
  const limb = materialFor(look.clothes || DARK);
  for (const side of [-1, 1]) {
    for (const pair of [0, 1]) {
      const leg = box(0.16, 1.5, 0.16, 0.08, limb,
        side * (0.55 + pair * 0.2), y + 0.6, -BODY_DEPTH / 2 - 0.1);
      leg.rotation.z = side * (0.5 + pair * 0.35);
      node.add(leg);
    }
  }
}

// Маска охранника: тёмный щиток во всё лицо, съехавший набок, и светлый
// треугольник-знак. Щиток чуть БОЛЬШЕ головы и сдвинут вперёд — вписанный в
// сферу, он оказывался внутри неё и пропадал совсем.
function addGuardMask(head, materialFor) {
  const shell = ball(0.54, materialFor('#1c1a2e'), 0, 0.0, 0.12);
  shell.scale.set(0.96, 1.02, 0.72);
  shell.rotation.z = 0.08;
  head.add(shell);
  const sign = flat(triangleShape(0.22), materialFor('#f2f2f7'), 0, 0.0, 0.53);
  sign.rotation.z = -Math.PI / 2;
  head.add(sign);
}

// Маска воришки: тёмная полоса ровно по глазам, с прорезями. По ней ребёнок
// понимает, что этого догоняют, а не убивают.
function addThiefMask(head, headRadius, materialFor) {
  const y = headRadius * 0.1;                 // высота глаз
  const z = faceDepth(headRadius, y);
  // Полоса ОБЛЕГАЕТ голову, а не лежит на ней плашкой: приплюснутый шар чуть
  // крупнее головы. Прямой брус, вписанный в сферу, оказывается внутри — на
  // лице тогда остаются одни белые прорези, и маски будто нет. На этом я
  // обжёгся дважды: так же пряталась маска охранника.
  const band = ball(headRadius * 1.08, materialFor('#2a2320'), 0, y, headRadius * 0.26);
  band.scale.set(1, 0.3, 0.8);
  head.add(band);
  // Прорези для глаз кладём поверх ПОЛОСЫ, а не поверх головы: полоса
  // выступает дальше, и отмеренные от головы щёлки в ней утонули бы.
  const bandFront = headRadius * 0.26 + headRadius * 1.08 * 0.8;
  for (const side of [-1, 1]) {
    head.add(box(headRadius * 0.32, headRadius * 0.15, 0.1, headRadius * 0.05,
      materialFor('#ffffff'), side * headRadius * 0.32, y, bandFront * 0.99));
  }
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
  } else if (chest === 'text' && look.chestText) {
    const plate = new Mesh(new PlaneGeometry(0.62 * bodyW, 0.62 * bodyW), textPlate(look.chestText, '#1c1c1c'));
    plate.position.set(0, y, z + 0.02);
    node.add(plate);
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
  // Волна по плащу: каждое звено отстаёт от предыдущего, и складка бежит
  // сверху вниз.
  //
  // Угол ВСЕГДА положительный, и это не мелочь: при повороте вокруг x низ
  // звена уходит назад только при плюсе, а при минусе — вперёд, сквозь
  // героя. Поэтому размах волны заведомо меньше постоянного отклона, и плащ
  // не может качнуться в тело.
  parts.cape?.forEach((link, i) => {
    link.rotation.x = CAPE_FLARE + Math.sin(walkPhase * 1.7 - i * 0.8) * CAPE_WAVE;
  });
  if (parts.float) {
    // Шарик не шагает, он покачивается. Двигаем внутренний узел: позиция
    // самой фигурки принадлежит сцене.
    parts.float.position.y = Math.sin(walkPhase * 0.6) * 0.12;
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
