// Стенд объектов мира: клетка, костёр, ноша и место доставки — те, что
// ставит цель раунда (js/entities/prop.js).
//
// Живёт вкладкой на общей странице стендов (preview.html). mount() рисует
// свою разметку внутрь переданного корня и возвращает функцию остановки —
// без неё циклы анимации копились бы с каждым переключением вкладки.

import { CONFIG } from '../js/config.js';
import {
  drawCage, drawCampfire, drawLoot, drawDropZone, drawHero, drawZombie,
} from '../js/render/sprites.js';

export const title = 'Объекты';
export const about = 'Клетка, костёр, ноша и место доставки — на всех семи грунтах, рядом с героем для масштаба';

// Ровно те состояния, в которых объект вообще бывает в игре.
const SCENES = [
  { name: 'клетка: закрыта', draw: (ctx, r) => drawCage(ctx, { radius: r, progress: 0 }) },
  { name: 'клетка: наполовину', draw: (ctx, r) => drawCage(ctx, { radius: r, progress: 0.55 }) },
  { name: 'клетка: открыта', draw: (ctx, r) => drawCage(ctx, { radius: r, progress: 1, open: true }) },
  { name: 'костёр: горит', draw: (ctx, r, t) => drawCampfire(ctx, { radius: r, heat: 1, phase: t }) },
  { name: 'костёр: тускнеет', draw: (ctx, r, t) => drawCampfire(ctx, { radius: r, heat: 0.4, phase: t }) },
  { name: 'костёр: угли', draw: (ctx, r, t) => drawCampfire(ctx, { radius: r, heat: 0, phase: t }) },
  { name: 'ноша', draw: (ctx, r, t) => drawLoot(ctx, { radius: r * 0.6, phase: t }) },
  { name: 'место доставки', draw: (ctx, r, t) => drawDropZone(ctx, { radius: r * 1.2, phase: t }) },
];

const TILE = 190;
const RADIUS = 34;   // в игре меньше — здесь крупнее, чтобы разглядеть

export function mount(root) {
  root.innerHTML = `
    <div class="tools">
      <button id="toggle">Пауза</button>
      <button id="scale">Игровой размер</button>
    </div>
    <div class="grid" id="grid"></div>
  `;
  const $ = (sel) => root.querySelector(sel);
  let alive = true;
  let running = true;
  let big = true;

  $('#toggle').onclick = (e) => {
    running = !running;
    e.target.textContent = running ? 'Пауза' : 'Продолжить';
  };
  // Главная проверка стенда — не «красиво ли крупно», а «видно ли в бою».
  $('#scale').onclick = (e) => {
    big = !big;
    e.target.textContent = big ? 'Игровой размер' : 'Крупно';
  };

  const grid = $('#grid');
  const tiles = [];
  for (const theme of CONFIG.themes) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.innerHTML = `<h2>${theme.name}</h2>
      <canvas width="${TILE * SCENES.length}" height="${TILE}"></canvas>`;
    grid.appendChild(tile);
    tiles.push({ theme, ctx: tile.querySelector('canvas').getContext('2d') });
  }
  // Плитки широкие: каждая — целая полоса из восьми сцен.
  grid.style.gridTemplateColumns = '1fr';

  let t = 0;
  let last = performance.now();
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (running) t += dt;

    const radius = big ? RADIUS : RADIUS * 0.55;
    for (const { theme, ctx } of tiles) {
      ctx.fillStyle = theme.ground;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      SCENES.forEach((scene, i) => {
        const x = TILE * (i + 0.5);
        ctx.save();
        ctx.translate(x, TILE * 0.62);
        scene.draw(ctx, radius, t);
        ctx.restore();
        // Герой и зомби рядом — иначе про размер объекта ничего не понять.
        ctx.save();
        ctx.translate(x - TILE * 0.34, TILE * 0.62);
        drawHero(ctx, {
          radius: (big ? 20 : 11) * 1.7, walkPhase: 0, facing: 1,
          look: CONFIG.characters[0].look,
        });
        ctx.restore();
        ctx.save();
        ctx.translate(x + TILE * 0.34, TILE * 0.62);
        drawZombie(ctx, {
          radius: (big ? 16 : 9) * 1.7, walkPhase: 0, facing: -1, hurtFlash: 0,
          look: CONFIG.zombieTypes[0].look, burning: false, frozen: false,
        });
        ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(scene.name, x, TILE - 8);
      });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return () => { alive = false; };
}
