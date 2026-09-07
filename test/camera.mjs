// Камера объёмного режима: проверяем не картинку, а управление.
//
// Единственное, чем 3D может испортить игру ребёнку, — это развернуть
// стрелки. Поэтому здесь проверяется ровно одно: что преобразование
// направления обратимо, что при нетронутой камере оно тождественно, и что
// поворот на прямой угол даёт именно то, что ожидает глаз. Картинку,
// освещение и фигурки этот тест не трогает — на них есть стенд.
//
// Запуск: node test/camera.mjs (входит в npm test)

import { CONFIG } from '../js/config.js';
import { CameraMath } from '../js/render3d/camera-math.js';

const ARENA = { width: 900, height: 600 };
const EPS = 1e-9;

const problems = [];

function check(name, condition, detail = '') {
  if (!condition) problems.push(`${name}${detail ? `: ${detail}` : ''}`);
}

function near(a, b, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

function makeCamera() {
  const camera = new CameraMath(CONFIG.render3d);
  camera.setArena(ARENA);
  return camera;
}

const DIRECTIONS = [
  { x: 0, y: -1 },   // вверх по экрану
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0.6, y: -0.8 },
];

// 1. Камеру не трогали — управление обязано совпасть с 2D до последнего знака.
{
  const camera = makeCamera();
  for (const dir of DIRECTIONS) {
    const world = camera.worldDirection(dir);
    check('нетронутая камера меняет направление',
      near(world.x, dir.x, EPS) && near(world.y, dir.y, EPS),
      `${JSON.stringify(dir)} стало ${JSON.stringify(world)}`);
  }
}

// 2. Обратимость: мир -> экран -> мир возвращает то же самое при любом угле.
{
  const camera = makeCamera();
  for (const yaw of [0.3, 1.0, -2.2, Math.PI, 5.5]) {
    camera.yaw = yaw;
    for (const dir of DIRECTIONS) {
      const back = camera.screenDirection(camera.worldDirection(dir));
      check('преобразование направления необратимо',
        near(back.x, dir.x) && near(back.y, dir.y),
        `yaw=${yaw} ${JSON.stringify(dir)} -> ${JSON.stringify(back)}`);
    }
  }
}

// 3. Длина не меняется: иначе герой при повёрнутой камере побежал бы быстрее.
{
  const camera = makeCamera();
  camera.yaw = 0.87;
  for (const dir of DIRECTIONS) {
    const world = camera.worldDirection(dir);
    check('поворот камеры меняет скорость героя',
      near(Math.hypot(world.x, world.y), Math.hypot(dir.x, dir.y)),
      `${JSON.stringify(dir)} -> ${JSON.stringify(world)}`);
  }
}

// 4. Четверть оборота: камера уезжает на восток от героя и смотрит оттуда на
// запад, значит экранное «вперёд» обязано стать движением на запад. Это тот
// самый случай, который ребёнок заметит первым, если знак перепутан.
{
  const camera = makeCamera();
  camera.yaw = Math.PI / 2;
  const world = camera.worldDirection({ x: 0, y: -1 });
  check('после четверти оборота «вперёд» уводит не туда',
    near(world.x, -1) && near(world.y, 0),
    `получилось ${JSON.stringify(world)}`);
}

// 5. Глаз стоит позади цели и выше неё, а при повороте ездит по кольцу вокруг
// героя, не меняя расстояния до него.
{
  const camera = makeCamera();
  camera.snapTo({ x: 400, y: 300 });
  const target = camera.targetPoint();
  const eye = camera.eyePoint();
  check('камера не позади героя', eye.z > target.z, `eye.z=${eye.z} target.z=${target.z}`);
  check('камера не над полем', eye.y > 0, `eye.y=${eye.y}`);

  const flat = (p) => Math.hypot(p.x - target.x, p.z - target.z);
  const base = flat(eye);
  for (const yaw of [0.5, 1.9, -3.0]) {
    camera.yaw = yaw;
    check('поворот меняет расстояние до героя', near(flat(camera.eyePoint()), base, 1e-6),
      `yaw=${yaw}`);
  }
}

// 6. Слежение догоняет героя и не перелетает через него.
{
  const camera = makeCamera();
  camera.snapTo({ x: 0, y: 0 });
  const target = { x: 300, y: 0 };
  for (let i = 0; i < 240; i++) camera.follow(target, 1 / 60);
  check('камера не догнала героя за четыре секунды',
    near(camera.focus.x, target.x, 0.5), `focus.x=${camera.focus.x}`);

  const overshoot = makeCamera();
  overshoot.snapTo({ x: 0, y: 0 });
  overshoot.follow(target, 1 / 60);
  check('камера перелетает через героя',
    overshoot.focus.x > 0 && overshoot.focus.x < target.x, `focus.x=${overshoot.focus.x}`);
}

// 7. Высоту камеры мышью нельзя увести за пределы: под землю или в зенит.
{
  const camera = makeCamera();
  const { minHeightFactor, maxHeightFactor } = CONFIG.render3d;
  camera.raiseBy(-1000);
  check('камеру можно опустить под пол', near(camera.heightFactor, minHeightFactor),
    `${camera.heightFactor}`);
  camera.raiseBy(1000);
  check('камеру можно задрать в зенит', near(camera.heightFactor, maxHeightFactor),
    `${camera.heightFactor}`);
}

if (problems.length === 0) {
  console.log('Камера в порядке: управление при нетронутой камере совпадает с 2D,'
    + ' поворот обратим и не меняет скорость.');
  process.exit(0);
}

console.error(`Проблем: ${problems.length}`);
for (const problem of problems) console.error(`  • ${problem}`);
process.exit(1);
