// Стенд боссов: походка, ярость и стихийные статусы — настоящим игровым
// кодом, а не отдельной отрисовкой для стенда.
//
// Живёт вкладкой на общей странице стендов (preview.html). mount() рисует
// свою разметку внутрь переданного корня и возвращает функцию остановки —
// без неё циклы анимации копились бы с каждым переключением вкладки.

import { CONFIG } from '../js/config.js';
import { drawBoss, drawBossRage, drawShadow } from '../js/render/sprites.js';

export const title = 'Боссы';
export const about = 'Верхняя дорожка — обычные, нижняя — в ярости (быстрее и со своим эффектом)';

export function mount(root) {
  root.innerHTML = `
    <div class="tools">
      <button id="toggle">Пауза</button>
      <button id="slow">Замедлить</button>
      <button id="status">Стихия: нет</button>
    </div>
    <canvas id="stage" class="stage" width="1400" height="1080"></canvas>
  `;
  const $ = (sel) => root.querySelector(sel);
  let alive = true;

  // Стенд для просмотра боссов. Импортирует настоящие модули игры, поэтому
  // походка и эффекты здесь ровно те же, что увидит ребёнок.

  const canvas = $('#stage');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;

  const types = CONFIG.bossTypes;
  // Высоту ставим из JS по числу боссов: при делении фиксированной высоты
  // добавление босса молча сплющивает полосы, и разъярённый лезет на спокойного.
  const LANE_HEIGHT = 216;
  canvas.height = types.length * LANE_HEIGHT;
  const RADIUS = 50;
  const WALK_SPEED = 70;        // пикселей в секунду, как у босса в игре примерно

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

  // Стихийные статусы босс получает наравне с зомби — по кнопке можно
  // посмотреть, как на нём сидят пламя и льдина.
  const STATUSES = ['none', 'burning', 'frozen'];
  const STATUS_NAMES = { none: 'нет', burning: 'огонь', frozen: 'лёд' };
  let status = 'none';
  let freezeAge = 0;   // растёт по кругу, чтобы было видно и трещины

  $('#status').onclick = (e) => {
    status = STATUSES[(STATUSES.indexOf(status) + 1) % STATUSES.length];
    freezeAge = 0;
    e.target.textContent = `Стихия: ${STATUS_NAMES[status]}`;
  };

  // Два «бегуна» на каждого босса: спокойный и разъярённый.
  const walkers = [];
  types.forEach((type, i) => {
    const laneTop = LANE_HEIGHT * i;
    // Внутри полосы: спокойный идёт выше, разъярённый — ниже и стартует левее,
    // чтобы сразу было видно, насколько он быстрее
    walkers.push({ type, y: laneTop + LANE_HEIGHT * 0.42, x: W * 0.25, phase: 0, enraged: false, seed: i * 37 });
    walkers.push({ type, y: laneTop + LANE_HEIGHT * 0.85, x: W * 0.25, phase: 0, enraged: true, seed: i * 91 + 5 });
  });

  function drawWalker(w) {
    const radius = RADIUS * w.type.radius;
    const rage = { radius, walkPhase: w.phase, look: w.type.look, style: w.type.rage };

    ctx.save();
    ctx.translate(w.x, w.y);
    drawShadow(ctx, radius);
    if (w.enraged) drawBossRage(ctx, { ...rage, layer: 'back' });

    ctx.save();
    drawBoss(ctx, {
      radius,
      walkPhase: w.phase,
      facing: 1,
      hurtFlash: false,
      look: w.type.look,
      burning: status === 'burning',
      frozen: status === 'frozen',
      freezeProgress: freezeAge % 1,
      freezeSeed: w.seed,
    });
    ctx.restore();

    if (w.enraged) drawBossRage(ctx, { ...rage, layer: 'front' });
    ctx.restore();
  }

  // Полосы чередуются оттенком — так пары не сливаются между собой
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
      ctx.fillText(`ярость: ${type.rage} · способность: ${type.ability} · вход: ${type.entrance}`,
        18, top + 52);

      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('обычный', 18, top + LANE_HEIGHT * 0.42);
      ctx.fillStyle = 'rgba(180,40,60,0.85)';
      ctx.fillText('в ярости', 18, top + LANE_HEIGHT * 0.85);
    });
  }

  let last = performance.now();
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000) * timeScale;
    last = now;

    if (running) {
      freezeAge += dt * 0.2;   // полный цикл заморозки за пять секунд
      for (const w of walkers) {
        // Разъярённый идёт быстрее ровно во столько же раз, что и в игре
        const speed = WALK_SPEED * (w.enraged ? CONFIG.boss.enrageSpeed : 1);
        w.x += speed * dt;
        w.phase += dt * 6 * (w.enraged ? CONFIG.boss.enrageSpeed : 1);
        if (w.x > W + 120) w.x = -120;   // ушёл за край — заходит снова слева
      }
    }

    drawLanes();
    // Дальние (верхние) рисуются первыми, чтобы ближние перекрывали
    [...walkers].sort((a, b) => a.y - b.y).forEach(drawWalker);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return () => { alive = false; };
}
