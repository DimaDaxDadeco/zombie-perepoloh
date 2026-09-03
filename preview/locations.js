// Стенд локаций. На каждой теме стоят герой, зомби и добыча: проверяем не
// фон, а силуэты НА фоне. Именно так выяснилось, что на белом льду белый
// снеговик почти растворяется, и Каток пришлось притемнить.
//
// Живёт вкладкой на общей странице стендов (preview.html). mount() рисует
// свою разметку внутрь переданного корня и возвращает функцию остановки —
// без неё циклы анимации копились бы с каждым переключением вкладки.

import { CONFIG } from '../js/config.js';
import { Background } from '../js/render/background.js';
import {
  drawHero, drawZombie, drawShadow, drawMedalPickup, drawMoneyPickup,
} from '../js/render/sprites.js';

export const title = 'Локации';
export const about = 'На каждой — герой, зомби и добыча: так видно, что ничего не теряется на фоне';

export function mount(root) {
  root.innerHTML = `
    <div class="tools">
      <button id="toggle">Пауза</button>
      <button id="night">Ночь: выкл</button>
    </div>
    <div class="grid" id="grid"></div>
  `;
  const $ = (sel) => root.querySelector(sel);
  let alive = true;

  // Стенд локаций. Импортирует настоящие модули игры, поэтому фон, декорации
  // и персонажи здесь ровно те же, что в бою.

  const TILE_W = 640;
  const TILE_H = 340;
  const HERO = CONFIG.characters.find((c) => c.id === 'superS') || CONFIG.characters[0];

  let running = true;
  $('#toggle').onclick = (e) => {
    running = !running;
    e.target.textContent = running ? 'Пауза' : 'Продолжить';
  };

  // Ночь накладывается на все темы разом: вопрос «читается ли она на
  // пляже и в космосе» — ровно про локации, отдельный стенд для него не нужен.
  let night = false;
  $('#night').onclick = (e) => {
    night = !night;
    e.target.textContent = night ? 'Ночь: вкл' : 'Ночь: выкл';
  };

  // Диапазон раундов, в которых встречается тема (дальше список идёт по кругу).
  function roundsForTheme(index) {
    const per = CONFIG.roundsPerTheme;
    const from = index * per + 1;
    return `раунды ${from}–${from + per - 1}, дальше по кругу`;
  }

  const scenes = CONFIG.themes.map((theme, i) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.innerHTML = `
      <h2>${theme.name}</h2>
      <p>${roundsForTheme(i)} · декорации «${theme.deco}»</p>
      <canvas width="${TILE_W}" height="${TILE_H}"></canvas>
    `;
    $('#grid').appendChild(tile);

    const arena = { width: TILE_W, height: TILE_H };
    const background = new Background();
    // Первый раунд этой темы — так Background выберет нужную и засеет декорации
    background.rebuild(i * CONFIG.roundsPerTheme + 1, arena);

    // По зомби каждого вида, чтобы проверить контраст силуэтов с фоном
    const zombies = CONFIG.zombieTypes.map((type, k) => ({
      type,
      x: TILE_W * (0.32 + k * 0.14),
      y: TILE_H * (0.34 + (k % 3) * 0.2),
      phase: Math.random() * Math.PI * 2,
    }));

    return { theme, arena, background, zombies, ctx: tile.querySelector('canvas').getContext('2d') };
  });

  let last = performance.now();
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    for (const scene of scenes) {
      const { ctx, arena, background, zombies } = scene;
      background.draw(ctx, arena);

      // Добыча: медаль и доллар — их читаемость на фоне важнее всего,
      // зелёные деньги однажды уже терялись на траве
      const pickupY = arena.height * 0.8;
      [[arena.width * 0.12, 'medal'], [arena.width * 0.2, 'money']].forEach(([x, kind]) => {
        ctx.save();
        ctx.translate(x, pickupY);
        if (kind === 'medal') drawMedalPickup(ctx, { radius: 13, phase: now / 400 });
        else drawMoneyPickup(ctx, { radius: 14, phase: now / 400 });
        ctx.restore();
      });

      // Герой
      ctx.save();
      ctx.translate(arena.width * 0.14, arena.height * 0.45);
      drawShadow(ctx, 26);
      drawHero(ctx, {
        radius: 26, walkPhase: now / 160, facing: 1, blinking: false, look: HERO.look,
      });
      ctx.restore();

      // Зомби бредут к герою и заходят снова с правого края
      for (const z of zombies) {
        if (running) {
          z.x -= 22 * z.type.speed * dt;
          z.phase += dt * 6;
          if (z.x < -60) z.x = arena.width + 60;
        }
        ctx.save();
        ctx.translate(z.x, z.y);
        const radius = 20 * z.type.radius;
        drawShadow(ctx, radius);
        drawZombie(ctx, {
          radius, walkPhase: z.phase, facing: -1, hurtFlash: false, look: z.type.look,
        });
        ctx.restore();
      }
    }
    if (night) {
      const spec = CONFIG.specialRounds.night;
      for (const scene of scenes) {
        const { ctx, arena } = scene;
        const cx = arena.width / 2;
        const cy = arena.height / 2;
        const g = ctx.createRadialGradient(cx, cy, spec.lightRadius * 0.45, cx, cy, spec.lightRadius);
        g.addColorStop(0, 'rgba(14,18,48,0)');
        g.addColorStop(1, spec.tint);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, arena.width, arena.height);
      }
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return () => { alive = false; };
}
