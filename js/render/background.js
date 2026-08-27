// Фоны арены. Тема меняется каждые CONFIG.roundsPerTheme раундов.
// Декорации детерминированы (сеются номером раунда), чтобы не мигали между кадрами.

import { CONFIG } from '../config.js';

export function getTheme(round) {
  const index = Math.floor((round - 1) / CONFIG.roundsPerTheme) % CONFIG.themes.length;
  return CONFIG.themes[index];
}

export class Background {
  constructor() {
    this.theme = CONFIG.themes[0];
    this.decorations = [];
  }

  // Пересобирает декорации под новый раунд и размер арены.
  rebuild(round, arena) {
    this.theme = getTheme(round);
    this.decorations = [];
    const random = makeSeededRandom(round * 7919);
    const count = 26;
    for (let i = 0; i < count; i++) {
      this.decorations.push({
        x: random() * arena.width,
        y: random() * arena.height,
        size: 6 + random() * 12,
        variant: random(),
      });
    }
  }

  draw(ctx, arena) {
    ctx.fillStyle = this.theme.ground;
    ctx.fillRect(0, 0, arena.width, arena.height);

    // Мягкие пятна-неровности, чтобы поле не было плоской заливкой
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = this.theme.accent;
    for (const d of this.decorations) {
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.size * 2.2, d.size * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (const d of this.decorations) {
      this.drawDecoration(ctx, d);
    }
  }

  drawDecoration(ctx, d) {
    ctx.save();
    ctx.translate(d.x, d.y);
    switch (this.theme.deco) {
      case 'flowers': drawFlower(ctx, d); break;
      case 'trees': drawBush(ctx, d); break;
      case 'beach': drawShell(ctx, d); break;
      case 'space': drawStarDot(ctx, d); break;
      default: break;
    }
    ctx.restore();
  }
}

function drawFlower(ctx, d) {
  const colors = ['#ff6b9d', '#ffd93d', '#ffffff'];
  ctx.fillStyle = colors[Math.floor(d.variant * colors.length)];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d.size * 0.4, Math.sin(a) * d.size * 0.4, d.size * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.arc(0, 0, d.size * 0.25, 0, Math.PI * 2);
  ctx.fill();
}

function drawBush(ctx, d) {
  ctx.fillStyle = '#2f7d32';
  [[-0.5, 0], [0.5, 0], [0, -0.5]].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.arc(dx * d.size, dy * d.size, d.size * 0.7, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawShell(ctx, d) {
  ctx.fillStyle = d.variant > 0.5 ? '#ffb3c1' : '#fff1d0';
  ctx.beginPath();
  ctx.arc(0, 0, d.size * 0.5, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawStarDot(ctx, d) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, d.size * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

// Простой детерминированный генератор — одинаковый фон при одном номере раунда.
function makeSeededRandom(seed) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}
