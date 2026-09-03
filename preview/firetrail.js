// Стенд огненной дорожки. Эффект лежит на слое земли, и в бою его не
// разглядеть: он всё время под ногами бегущего героя.
//
// Живёт вкладкой на общей странице стендов (preview.html). mount() рисует
// свою разметку внутрь переданного корня и возвращает функцию остановки —
// без неё циклы анимации копились бы с каждым переключением вкладки.

import { createWeapon } from '../js/weapons/weapons.js';
import { drawHero, drawZombie } from '../js/render/sprites.js';
import { CONFIG } from '../js/config.js';

export const title = 'Дорожка';
export const about = 'Как звено разгорается на бегу и как выглядит замкнутое кольцо свежим и через четыре секунды';

export function mount(root) {
  root.innerHTML = `
    <h3>Дорожка на бегу</h3>
    <p class="note">справа только что брошено, слева догорает — звено разгорается за свои пять секунд</p>
    <canvas id="a" width="880" height="300"></canvas>
    <h3>Кольцо: зомби окружён</h3>
    <p class="note">кольцо только что замкнуто (свежие звенья) и оно же через четыре секунды</p>
    <canvas id="b" width="880" height="360"></canvas>
  `;
  const $ = (sel) => root.querySelector(sel);

  const HERO = CONFIG.characters[0].look;
  const ZOMB = CONFIG.zombieTypes[0].look;

  function at(ctx, x, y, fn) { ctx.save(); ctx.translate(x, y); fn(); ctx.restore(); }
  function hero(ctx, x, y) {
    at(ctx, x, y, () => drawHero(ctx, { radius: 20, walkPhase: 1, facing: 1, look: HERO }));
  }
  function zombie(ctx, x, y) {
    at(ctx, x, y, () => drawZombie(ctx, { radius: 16, walkPhase: 1, facing: -1, hurtFlash: 0,
      look: ZOMB, burning: true, frozen: false }));
  }
  function trail(pts, ages) {
    const w = createWeapon('firetrail');
    pts.forEach((p, i) => w.patches.push({
      x: p[0], y: p[1], radius: w.stat('radius'), life: w.spec.patchLife * ages(i, pts.length),
    }));
    return w;
  }

  // Сцена 1 — бег по дуге.
  const ca = $('#a').getContext('2d');
  const path = Array.from({ length: 74 }, (_, i) => {
    const t = i / 73;
    return [70 + t * 740, 150 + Math.sin(t * 3.4) * 78];
  });
  trail(path, (i, n) => i / (n - 1)).drawGround(ca);
  hero(ca, path[73][0], path[73][1]);

  // Сцена 2 — замкнутое кольцо, свежее и через четыре секунды.
  const cb = $('#b').getContext('2d');
  for (const [cx, age] of [[230, 1], [650, 0.2]]) {
    const ring = Array.from({ length: 60 }, (_, i) => {
      const a = (i / 60) * Math.PI * 2;
      return [cx + Math.cos(a) * 96, 180 + Math.sin(a) * 96];
    });
    trail(ring, () => age).drawGround(cb);
    zombie(cb, cx - 34, 172);
    zombie(cb, cx + 30, 190);
  }

  return () => { };
}
