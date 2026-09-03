// Стенд обычных зомби. Импортирует настоящие модули игры, поэтому походка,
// цвета и статусы здесь ровно те же, что в бою.
//
// Живёт вкладкой на общей странице стендов (preview.html). mount() рисует
// свою разметку внутрь переданного корня и возвращает функцию остановки —
// без неё циклы анимации копились бы с каждым переключением вкладки.

import { CONFIG } from '../js/config.js';
import { drawZombie, drawShadow } from '../js/render/sprites.js';

export const title = 'Зомби';
export const about = 'В каждой полосе трое: обычный, горящий и замороженный — замороженный отстаёт, потому что и в игре ползёт медленнее';

export function mount(root) {
  root.innerHTML = `
    <div class="tools">
      <button id="toggle">Пауза</button>
      <button id="slow">Замедлить</button>
    </div>
    <canvas id="stage" class="stage" width="1400" height="1000"></canvas>
  `;
  const $ = (sel) => root.querySelector(sel);
  let alive = true;

  // Стенд для просмотра обычных зомби. Импортирует настоящие модули игры,
  // поэтому походка, цвета и статусы здесь ровно те же, что в бою.

  const canvas = $('#stage');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;

  const types = CONFIG.zombieTypes;
  // Высоту ставим из JS по числу видов: при делении фиксированной высоты
  // добавление вида молча сплющивает полосы, и фигуры лезут друг на друга.
  const LANE_HEIGHT = 118;
  canvas.height = types.length * LANE_HEIGHT;
  const BASE_RADIUS = 42;
  const BASE_SPEED = 60;          // масштаб скорости для стенда, пропорции как в игре
  const FREEZE_FACTOR = CONFIG.weapons.ice.freezeFactor[0];

  let running = true;
  let timeScale = 1;

  $('#toggle').onclick = (e) => {
    running = !running;
    e.target.textContent = running ? 'Пауза' : 'Продолжить';
  };
  $('#slow').onclick = (e) => {
    timeScale = timeScale === 1 ? 0.25 : 1;
    e.target.textContent = timeScale === 1 ? 'Замедлить' : 'Обычная скорость';
  };

  // Три состояния на каждый вид: обычный, горящий, замороженный.
  // Замороженный идёт медленнее ровно во столько же раз, что и в игре.
  const STATES = [
    { key: 'normal', label: 'обычный', burning: false, frozen: false, slow: 1 },
    { key: 'burning', label: 'горит', burning: true, frozen: false, slow: 1 },
    { key: 'frozen', label: 'заморожен', burning: false, frozen: true, slow: FREEZE_FACTOR },
  ];

  // Все трое идут по одной линии, но с большим интервалом: если разносить их
  // по вертикали, персонажи налезают друг на друга — полоса слишком узкая.
  const walkers = [];
  types.forEach((type, i) => {
    const laneY = LANE_HEIGHT * (i + 0.72);
    STATES.forEach((state, k) => {
      walkers.push({
        type,
        state,
        y: laneY,
        x: W * (0.18 + k * 0.28),
        phase: Math.random() * Math.PI * 2,
      });
    });
  });

  function drawWalker(w) {
    const radius = BASE_RADIUS * w.type.radius;
    ctx.save();
    ctx.translate(w.x, w.y);
    drawShadow(ctx, radius * (w.type.look.shadowScale ?? 1));
    drawZombie(ctx, {
      radius,
      walkPhase: w.phase,
      facing: 1,
      hurtFlash: false,
      look: w.type.look,
      burning: w.state.burning,
      frozen: w.state.frozen,
    });
    ctx.restore();
  }

  function drawLanes() {
    types.forEach((type, i) => {
      const top = LANE_HEIGHT * i;
      ctx.fillStyle = i % 2 ? '#78c04b' : '#7ec850';
      ctx.fillRect(0, top, W, LANE_HEIGHT);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#1c1a38';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(type.name, 18, top + 30);

      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(28,26,56,0.65)';
      ctx.fillText(
        `с ${type.fromRound} раунда · здоровье ×${type.hp} · скорость ×${type.speed}`
          + ` · ${type.behavior ?? 'идёт к герою'}${type.death ? ' · смерть: ' + type.death : ''}`,
        18, top + 52,
      );

    });
  }

  let last = performance.now();
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000) * timeScale;
    last = now;

    if (running) {
      for (const w of walkers) {
        // Скорость вида × замедление от заморозки — те же множители, что в игре
        const speed = BASE_SPEED * w.type.speed * w.state.slow;
        w.x += speed * dt;
        w.phase += dt * 6 * w.state.slow;
        if (w.x > W + 100) w.x = -100;
      }
    }

    drawLanes();
    [...walkers].sort((a, b) => a.y - b.y).forEach(drawWalker);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return () => { alive = false; };
}
