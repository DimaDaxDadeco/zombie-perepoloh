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
import { buildFigure, poseFigure } from '../js/render3d/figures.js';

export const title = 'Объём';
export const about = 'Каждый персонаж дважды: слева как рисует игра, справа как лепит объёмный режим. Сравнивать надо пары, а не фигурки по отдельности';

const CELL = 190;          // ширина пары «плоский + объёмный»
const ROW = 210;
const RADIUS = 34;         // крупнее боевого: на стенде важны детали

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

  const groups = ['heroes', 'zombies', 'bosses'];
  const groupNames = { heroes: 'герои', zombies: 'зомби', bosses: 'боссы' };
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
    if (groups[groupIndex] === 'heroes') {
      return CONFIG.characters.map((c) => ({ name: c.name, look: c.look, kind: 'hero' }));
    }
    if (groups[groupIndex] === 'zombies') {
      return CONFIG.zombieTypes.map((z) => ({ name: z.name, look: z.look, kind: 'zombie' }));
    }
    return CONFIG.bossTypes.map((b) => ({ name: b.name, look: b.look, kind: 'zombie' }));
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

    for (const figure of figures) holder.remove(figure.node);
    sun.target.position.set(width / 2, -height / 2, 0);
    figures = list.map((item, i) => {
      const figure = buildFigure(item.look, item.kind, materialFor);
      figure.node.scale.setScalar(RADIUS);
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      // Ноги на той же линии, что у плоского соседа: фигурка слеплена
      // ступнями на нуле, поэтому линия и есть её позиция.
      figure.node.position.set(col * CELL + CELL * 0.72, -(row * ROW + ROW * 0.58), 0);
      holder.add(figure.node);
      return figure;
    });
    return { list, perRow };
  }

  let grid = layout();

  function drawFlat() {
    const { list, perRow } = grid;
    ctx.clearRect(0, 0, flat.width, flat.height);
    ctx.font = '12px system-ui, sans-serif';
    list.forEach((item, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = col * CELL + CELL * 0.26;
      const y = row * ROW + ROW * 0.58;

      ctx.save();
      ctx.translate(x, y);
      drawShadow(ctx, RADIUS);
      const args = { radius: RADIUS, walkPhase: phase, facing: 1, look: item.look };
      if (item.kind === 'hero') drawHero(ctx, args);
      else if (item.look.shape === 'beast') drawBeast(ctx, { ...args, mood: 'angry' });
      else if (groups[groupIndex] === 'bosses') drawBoss(ctx, args);
      else drawZombie(ctx, args);
      ctx.restore();

      ctx.fillStyle = '#444';
      ctx.textAlign = 'center';
      ctx.fillText(item.name, col * CELL + CELL / 2, row * ROW + ROW - 12);
    });
  }

  function frame() {
    if (!alive) return;
    if (walking) phase += 0.09;
    for (const figure of figures) {
      if (spinning) figure.node.rotation.y += 0.012;
      poseFigure(figure, phase);
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
