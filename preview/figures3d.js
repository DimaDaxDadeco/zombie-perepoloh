// Стенд объёмных фигурок: каждый персонаж плоским и объёмным, рядом.
//
// Смотреть надо именно парами. Вопрос, на который отвечает этот стенд, ровно
// один: узнаёт ли ребёнок того же самого героя. Отдельно взятая объёмная
// фигурка всегда выглядит «нормально» — расхождение видно только рядом с
// оригиналом.
//
// Импортирует настоящие модули игры: правишь figures.js — правится и стенд.

import { CONFIG } from '../js/config.js';
import { drawHero, drawZombie, drawBoss, drawBeast, drawShadow } from '../js/render/sprites.js';
import {
  Scene, WebGLRenderer, OrthographicCamera, Color, Group,
  DirectionalLight, HemisphereLight, MeshLambertMaterial,
} from 'three';
import { buildFigure, buildShot, poseFigure } from '../js/render3d/figures.js';
import * as SHOT from '../js/entities/projectile.js';

export const title = 'Объём';
export const about = 'Каждый персонаж и каждый снаряд дважды: слева как рисует игра, справа как лепит объёмный режим. Сравнивать надо пары, а не фигурки по отдельности';

const CELL = 190;          // ширина пары «плоский + объёмный»
const ROW = 210;
const RADIUS = 34;         // крупнее боевого: на стенде важны детали
const SHOT_RADIUS = 16;    // снаряды в бою мелкие, здесь тоже крупнее
// Наклон к зрителю. Величина не случайная: игровая камера смотрит на поле
// примерно под этим углом, и снаряды, лежащие плашмя (снежинка, бумеранг),
// видны в бою именно так. При маленьком наклоне стенд показывал их ребром —
// то есть врал ровно про те снаряды, ради которых он и заведён.
const SHOT_TILT = 0.95;

// Снаряды и то, из чего они летят. Имя — оружия, а не класса: сверять надо с
// тем, что ребёнок видит в слоте.
const SHOTS = [
  { name: 'Водяной пистолет', make: () => new SHOT.Bullet(0, 0, 0, 0, 1) },
  { name: 'Водяная пушка', make: () => new SHOT.PiercingBullet(0, 0, 0, 0, 1) },
  { name: 'Огнемёт', make: () => new SHOT.FlameBolt(0, 0, 0, 0, 1, {}) },
  { name: 'Ледяная пушка', make: () => new SHOT.IceShard(0, 0, 0, 0, 1, {}) },
  { name: 'Ракета-морковка', make: () => new SHOT.Rocket(0, 0, { x: 1, y: 0 }, { speed: 0, damage: 1, radius: 10, turnSpeed: 0 }) },
  { name: 'Помидорометалка', make: () => new SHOT.Lob(0, 0, 40, 0, { speed: 0, damage: 1, radius: 10 }) },
  { name: 'Бумеранг', make: () => new SHOT.Boomerang({ x: 0, y: 0 }, 0, { speed: 0, damage: 1, reach: 40 }) },
  { name: 'Мыльные пузыри', make: () => new SHOT.Bubble(0, 0, 0, { speed: 0, damage: 1, radius: 14 }) },
  { name: 'Пчелиный рой', make: () => new SHOT.Bee(0, 0, 0, { speed: 0, damage: 1 }) },
  { name: 'Паучок', make: () => new SHOT.SpiderMinion(0, 0, 0, { speed: 0, damage: 1 }) },
  { name: 'Подарки Хэнки', make: () => new SHOT.GiftLob(0, 0, 40, 0, { speed: 0, damage: 1, radius: 12 }) },
  { name: 'Паутина', make: () => new SHOT.WebGlob(0, 0, 40, 0, { speed: 0, damage: 1, radius: 12 }) },
  { name: 'Торт клоуна', make: () => new SHOT.CakeLob(0, 0, 40, 0, { speed: 0, damage: 1, radius: 12 }) },
  { name: 'Бэтмобиль', make: () => new SHOT.Batmobile(0, 0, { x: 1, y: 0 }, { speed: 0, damage: 1, force: 1, life: 99, waveAmp: 0, waveLength: 1 }) },
];

export function mount(root) {
  root.innerHTML = `
    <div class="tools">
      <button id="group">Показать: герои</button>
      <button id="spin">Вращение: да</button>
      <button id="walk">Походка: да</button>
    </div>
    <div id="pairs" style="position: relative">
      <canvas id="flat" class="stage"></canvas>
      <canvas id="solid" class="stage" style="position: absolute; inset: 0"></canvas>
    </div>
  `;
  const $ = (sel) => root.querySelector(sel);
  const flat = $('#flat');
  const solid = $('#solid');
  const ctx = flat.getContext('2d');

  const groups = ['heroes', 'zombies', 'bosses', 'shots'];
  const groupNames = { heroes: 'герои', zombies: 'зомби', bosses: 'боссы', shots: 'снаряды' };
  let groupIndex = 0;
  let spinning = true;
  let walking = true;
  let alive = true;
  let phase = 0;

  const renderer = new WebGLRenderer({ canvas: solid, antialias: true, alpha: true });

  const scene = new Scene();
  // Ортографическая камера, и именно по границам холста: тогда мировая
  // единица равна пикселю, и объёмная фигурка встаёт ровно в ту же клетку,
  // что и плоская. С перспективой сетки разъезжаются, а сравнивать надо пары.
  // Теней тут нет намеренно — на стенде важен силуэт, а пол под фигурками
  // закрыл бы собой плоский холст, который лежит ниже.
  const camera = new OrthographicCamera(0, 1, 0, -1, -4000, 4000);
  const materials = new Map();
  const materialFor = (color) => {
    const key = String(color || '#c8c8c8');
    if (!materials.has(key)) materials.set(key, new MeshLambertMaterial({ color: new Color(key) }));
    return materials.get(key);
  };

  scene.add(new HemisphereLight(new Color('#dff0ff'), new Color('#6b6250'), 1.0));
  const sun = new DirectionalLight(new Color('#fff6e0'), 2.0);
  sun.position.set(-400, 700, 900);
  scene.add(sun, sun.target);

  let figures = [];
  const holder = new Group();
  scene.add(holder);

  function entries() {
    if (groups[groupIndex] === 'shots') return shotEntries();
    if (groups[groupIndex] === 'heroes') {
      return CONFIG.characters.map((c) => ({ name: c.name, look: c.look, kind: 'hero' }));
    }
    if (groups[groupIndex] === 'zombies') {
      return CONFIG.zombieTypes.map((z) => ({ name: z.name, look: z.look, kind: 'zombie' }));
    }
    return CONFIG.bossTypes.map((b) => ({ name: b.name, look: b.look, kind: 'zombie' }));
  }

  // Снаряды. Каждый строится настоящим классом из projectile.js: у стенда и
  // боя один и тот же конструктор, иначе стенд перестал бы что-либо
  // доказывать. Скорость нулевая — они стоят на месте и не улетают.
  function shotEntries() {
    return SHOTS.map(({ name, make }) => {
      const shot = make();
      shot.radius = SHOT_RADIUS;
      shot.alive = true;
      return { name, shot, kind: 'shot' };
    });
  }

  function layout() {
    const list = entries();
    const perRow = Math.max(1, Math.floor((root.clientWidth || 1200) / CELL));
    const rows = Math.ceil(list.length / perRow);
    const width = perRow * CELL;
    const height = rows * ROW;

    for (const canvas of [flat, solid]) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    renderer.setSize(width, height, false);

    camera.left = 0;
    camera.right = width;
    camera.top = 0;
    camera.bottom = -height;
    camera.position.set(0, 0, 1000);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    for (const figure of figures) holder.remove(figure.holder || figure.node);
    sun.target.position.set(width / 2, -height / 2, 0);
    figures = list.map((item, i) => {
      const figure = item.kind === 'shot'
        ? buildShot(item.shot, materialFor)
        : buildFigure(item.look, item.kind, materialFor);
      figure.node.scale.setScalar(item.kind === 'shot' ? SHOT_RADIUS : RADIUS);
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      // Ноги на той же линии, что у плоского соседа: фигурка слеплена
      // ступнями на нуле, поэтому линия и есть её позиция.
      const lift = item.kind === 'shot' ? SHOT_RADIUS * 2 : 0;
      const at = [col * CELL + CELL * 0.72, -(row * ROW + ROW * 0.58) + lift, 0];

      if (item.kind !== 'shot') {
        figure.node.position.set(...at);
        holder.add(figure.node);
        return figure;
      }

      // Снаряд разворачиваем боком и наклоняем к зрителю ДВУМЯ узлами, а не
      // одним поворотом. Порядок здесь решает всё: сначала разворот вокруг
      // своей оси (в лоб морковка и капля схлопываются в кружок), и только
      // потом наклон вокруг экранной горизонтали (иначе плоская снежинка
      // встаёт ребром и превращается в палочку). Одним Euler это выражается
      // мутно, вложенными узлами — однозначно.
      const tilt = new Group();
      tilt.position.set(...at);
      tilt.rotation.x = SHOT_TILT;   // плюс: верх наклоняется К зрителю, как при взгляде сверху
      figure.node.rotation.y = Math.PI / 2;
      tilt.add(figure.node);
      holder.add(tilt);
      figure.holder = tilt;
      return figure;
    });
    return { list, perRow };
  }

  let grid = layout();

  function drawFlat() {
    const { list, perRow } = grid;
    ctx.clearRect(0, 0, flat.width, flat.height);
    ctx.font = '12px system-ui, sans-serif';

    // Светлая карточка под каждой парой. Страница стендов тёмная, а
    // персонажи и снаряды рисовались для светлого поля: на тёмном пропадают
    // и чёрный паучок, и белая паутина — то есть ровно то, что и надо
    // сверять.
    list.forEach((item, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      ctx.fillStyle = '#e7eef6';
      ctx.beginPath();
      ctx.roundRect(col * CELL + 6, row * ROW + 6, CELL - 12, ROW - 26, 12);
      ctx.fill();
    });

    list.forEach((item, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = col * CELL + CELL * 0.26;
      const y = row * ROW + ROW * 0.58;

      ctx.save();
      if (item.kind === 'shot') {
        // Снаряд рисует себя сам, в мировых координатах: ставим его в клетку
        // и зовём тот же draw, что и бой.
        item.shot.x = x;
        item.shot.y = y - SHOT_RADIUS * 2;
        item.shot.draw(ctx);
      } else {
        ctx.translate(x, y);
        drawShadow(ctx, RADIUS);
        const args = { radius: RADIUS, walkPhase: phase, facing: 1, look: item.look };
        if (item.kind === 'hero') drawHero(ctx, args);
        else if (item.look.shape === 'beast') drawBeast(ctx, { ...args, mood: 'angry' });
        else if (groups[groupIndex] === 'bosses') drawBoss(ctx, args);
        else drawZombie(ctx, args);
      }
      ctx.restore();

      ctx.fillStyle = '#b9c4d4';
      ctx.textAlign = 'center';
      ctx.fillText(item.name, col * CELL + CELL / 2, row * ROW + ROW - 8);
    });
  }

  function frame() {
    if (!alive) return;
    if (walking) phase += 0.09;
    for (const figure of figures) {
      if (spinning) figure.node.rotation.y += 0.012;
      if (figure.parts) poseFigure(figure, phase);
    }
    drawFlat();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();

  $('#group').addEventListener('click', (e) => {
    groupIndex = (groupIndex + 1) % groups.length;
    e.target.textContent = `Показать: ${groupNames[groups[groupIndex]]}`;
    grid = layout();
  });
  $('#spin').addEventListener('click', (e) => {
    spinning = !spinning;
    e.target.textContent = `Вращение: ${spinning ? 'да' : 'нет'}`;
  });
  $('#walk').addEventListener('click', (e) => {
    walking = !walking;
    e.target.textContent = `Походка: ${walking ? 'да' : 'нет'}`;
  });

  // Без остановки каждый переход по вкладкам оставлял бы позади живой цикл и
  // ещё один контекст WebGL — их у браузера всего десяток.
  return () => {
    alive = false;
    renderer.dispose();
  };
}
