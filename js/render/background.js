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
  //
  // theme задаётся явно только сюжетными главами: у них локация своя и от
  // номера не зависит. Обычный раунд его не передаёт и идёт по getTheme.
  rebuild(round, arena, theme = null) {
    this.theme = theme || getTheme(round);
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
      case 'crystals': drawCrystals(ctx, d); break;
      case 'ice': drawIce(ctx, d); break;
      case 'hay': drawHay(ctx, d); break;
      // Опечатка в deco не роняет игру — фон просто останется голым. Заметить
      // это можно только глазами, поэтому после правки открывайте стенд.
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

const CRYSTAL_COLORS = ['#8fe3ff', '#c9a2ff', '#7effc4'];

// Пещера: кучка кристаллов из общего основания. Светлая грань с одной стороны
// даёт объём — без неё ромбы читаются как плоские наклейки.
function drawCrystals(ctx, d) {
  const color = CRYSTAL_COLORS[Math.floor(d.variant * CRYSTAL_COLORS.length)];
  const shards = [[-0.5, 0.9], [0.15, 1.4], [0.7, 0.75]];
  for (const [offset, height] of shards) {
    const x = offset * d.size * 0.6;
    const top = -d.size * height;
    const half = d.size * 0.22;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + half, top * 0.35);
    ctx.lineTo(x, 0);
    ctx.lineTo(x - half, top * 0.35);
    ctx.closePath();
    ctx.fill();
    // Блик: половина той же грани, светлее.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + half, top * 0.35);
    ctx.lineTo(x, 0);
    ctx.closePath();
    ctx.fill();
  }
}

// Каток: снежинка или гладкая льдинка. Обводка обязательна — белое на
// светло-голубом без неё не видно вовсе.
function drawIce(ctx, d) {
  ctx.strokeStyle = '#a9cbe3';
  ctx.lineWidth = 1.2;
  if (d.variant > 0.5) {
    // Льдинка — неровный шестиугольник. Чередовать радиус через один нельзя:
    // на шести вершинах это даёт трёхлучевую звезду, и осколок читается как
    // стрелка «плей». Радиус тут гуляет слабо и по всем вершинам.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + d.variant * 2;
      const r = d.size * (0.42 + Math.sin(i * 2.3 + d.variant * 9) * 0.1);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return;
  }
  // Снежинка: шесть лучей с короткими усиками.
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.cos(a) * d.size * 0.5;
    const y = Math.sin(a) * d.size * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(x, y);
    ctx.moveTo(x * 0.6, y * 0.6);
    ctx.lineTo(x * 0.6 - y * 0.25, y * 0.6 + x * 0.25);
    ctx.stroke();
  }
}

// Ферма: сноп сена, изредка тыква. Тыква тут декорация, а не зомби-тыква из
// боя, — поэтому она заметно мельче героя и без глаз.
function drawHay(ctx, d) {
  if (d.variant > 0.65) {
    ctx.fillStyle = '#e08b2f';
    ctx.strokeStyle = 'rgba(110,60,10,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, d.size * 0.55, d.size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#3f7d34';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -d.size * 0.45);
    ctx.lineTo(0, -d.size * 0.8);
    ctx.stroke();
    return;
  }
  // Сноп светлее земли всего на пару тонов, поэтому держится он на обводке, а
  // не на заливке: без неё на жёлтом фоне видно только пятно.
  ctx.fillStyle = '#e6cd7a';
  ctx.strokeStyle = 'rgba(110,80,20,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-d.size * 0.6, -d.size * 0.45, d.size * 1.2, d.size * 0.9, d.size * 0.25);
  ctx.fill();
  ctx.stroke();
  for (const at of [-0.2, 0.2]) {
    ctx.beginPath();
    ctx.moveTo(at * d.size, -d.size * 0.42);
    ctx.lineTo(at * d.size, d.size * 0.42);
    ctx.stroke();
  }
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
