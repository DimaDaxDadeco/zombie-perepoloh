// Частицы и эффекты: конфетти от лопнувших зомби, взрывы, молнии, взмахи, салют.
// Всё чисто декоративное — на геймплей не влияет.

const CONFETTI_COLORS = ['#ffd93d', '#ff6b6b', '#4fb3ff', '#7fe57f', '#c77dff', '#ff9f43'];

export class Particles {
  constructor() {
    this.confetti = [];
    this.rings = [];
    this.bolts = [];
    this.slashes = [];
    this.entrances = [];  // эффекты появления боссов
  }

  clear() {
    this.confetti.length = 0;
    this.rings.length = 0;
    this.bolts.length = 0;
    this.slashes.length = 0;
    this.entrances.length = 0;
  }

  // Зомби лопнул — брызги конфетти.
  addBurst(x, y, count = 14, scale = 1) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (60 + Math.random() * 180) * scale;
      this.confetti.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: (3 + Math.random() * 4) * scale,
        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
        life: 0.6 + Math.random() * 0.5,
        maxLife: 1.1,
        spin: (Math.random() - 0.5) * 12,
        angle: Math.random() * Math.PI,
      });
    }
  }

  // Расходящееся кольцо — взрыв помидора или ракеты.
  addRing(x, y, radius, color) {
    this.rings.push({ x, y, radius, color, life: 0.35, maxLife: 0.35 });
  }

  // Ломаная молния по точкам [{x,y}, ...].
  addLightning(points) {
    if (points.length < 2) return;
    this.bolts.push({ points, life: 0.18, maxLife: 0.18 });
  }

  // Праздничный салют на экране победы.
  // След светового меча: дуга, которая быстро гаснет.
  addSlash(x, y, angle, reach, arc) {
    this.slashes.push({ x, y, angle, reach, arc, life: 0.22, maxLife: 0.22 });
  }

  // Эффект появления босса. Вид задаётся полем entrance из CONFIG.bossTypes:
  // у каждого босса он свой, чтобы выход читался ещё до того, как босс виден.
  addBossEntrance(x, y, effect, radius, duration) {
    this.entrances.push({
      kind: effect, x, y, radius,
      life: duration, maxLife: duration,
      seed: Math.random() * Math.PI * 2,
    });
  }

  // Финальный «хлопок» в момент, когда босс уже материализовался.
  addBossArrival(x, y, effect, radius) {
    switch (effect) {
      case 'slam':
        this.addRing(x, y, radius * 2.2, '#c9a26b');
        this.addBurst(x, y, 26, 1.3);
        break;
      case 'swirl':
        this.addRing(x, y, radius * 1.8, '#ff9db1');
        this.addBurst(x, y, 22, 1.1);
        break;
      case 'rush':
        this.addRing(x, y, radius * 1.6, '#ffffff');
        this.addBurst(x, y, 16, 0.9);
        break;
      case 'ice':
        this.addShards(x, y, radius * 2.0, '#bfefff');
        this.addRing(x, y, radius * 1.8, '#9fd8e8');
        break;
      case 'fire':
        this.addRing(x, y, radius * 2.0, '#ff8a2b');
        this.addBurst(x, y, 24, 1.2);
        break;
      default:
        this.addBurst(x, y, 18, 1);
    }
  }

  // Разлетающиеся осколки — лёд крошится, а не рассыпается конфетти.
  addShards(x, y, radius, color) {
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
      const speed = radius * (1.2 + Math.random());
      this.confetti.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - radius * 0.6,
        size: 5 + Math.random() * 6,
        color,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 12,
        life: 0.5 + Math.random() * 0.4,
      });
    }
  }

  addFirework(x, y) {
    this.addBurst(x, y, 30, 1.4);
  }

  update(dt) {
    this.confetti = this.confetti.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;         // конфетти падает
      p.vx *= Math.pow(0.3, dt);
      p.angle += p.spin * dt;
      return p.life > 0;
    });

    this.rings = this.rings.filter((r) => {
      r.life -= dt;
      return r.life > 0;
    });

    this.bolts = this.bolts.filter((b) => {
      b.life -= dt;
      return b.life > 0;
    });

    this.slashes = this.slashes.filter((s) => {
      s.life -= dt;
      return s.life > 0;
    });

    this.entrances = this.entrances.filter((e) => {
      e.life -= dt;
      return e.life > 0;
    });
  }

  draw(ctx) {
    // Взрывные кольца
    for (const r of this.rings) {
      const t = 1 - r.life / r.maxLife;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 8 * (1 - t) + 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius * (0.4 + t * 0.8), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Эффекты появления боссов — рисуются под персонажами, как «из земли»
    for (const e of this.entrances) drawEntrance(ctx, e);

    // Взмахи светового меча — дуга, которая гаснет и чуть расширяется
    for (const s of this.slashes) {
      const t = 1 - s.life / s.maxLife;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#7fe3ff';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.reach * (0.75 + t * 0.25),
        s.angle - s.arc / 2, s.angle + s.arc / 2);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
    }

    // Молнии
    for (const b of this.bolts) {
      ctx.save();
      ctx.globalAlpha = b.life / b.maxLife;
      ctx.strokeStyle = '#fff36b';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(b.points[0].x, b.points[0].y);
      for (let i = 1; i < b.points.length; i++) {
        // Зигзаг между точками — чтобы выглядело как разряд
        const prev = b.points[i - 1];
        const cur = b.points[i];
        const midX = (prev.x + cur.x) / 2 + (Math.random() - 0.5) * 30;
        const midY = (prev.y + cur.y) / 2 + (Math.random() - 0.5) * 30;
        ctx.lineTo(midX, midY);
        ctx.lineTo(cur.x, cur.y);
      }
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Конфетти
    for (const p of this.confetti) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / 0.3);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

// --- Эффекты появления боссов ---
// Каждый рисуется по прогрессу t (0 — только начался, 1 — босс уже здесь).

function drawEntrance(ctx, e) {
  const t = 1 - e.life / e.maxLife;
  ctx.save();
  ctx.translate(e.x, e.y);
  switch (e.kind) {
    case 'slam': drawSlamEntrance(ctx, e, t); break;
    case 'swirl': drawSwirlEntrance(ctx, e, t); break;
    case 'rush': drawRushEntrance(ctx, e, t); break;
    case 'ice': drawIceEntrance(ctx, e, t); break;
    case 'fire': drawFireEntrance(ctx, e, t); break;
    default: break;
  }
  ctx.restore();
}

// Толстяк падает с неба: тень на земле растёт, сам он летит сверху вниз.
function drawSlamEntrance(ctx, e, t) {
  const shadow = e.radius * (0.3 + t * 0.9);
  ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + t * 0.3})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, shadow, shadow * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Падающая «туша» — тёмный силуэт, детали дорисует сам босс.
  // Высота падает квадратично: силуэт входит в кадр сверху и ускоряется,
  // как настоящий тяжёлый предмет.
  const fallHeight = (1 - t) * (1 - t) * 420;
  ctx.globalAlpha = Math.min(1, 0.35 + t);
  ctx.fillStyle = '#3c3550';
  ctx.beginPath();
  ctx.ellipse(0, -fallHeight - e.radius * 0.7, e.radius * 0.85, e.radius * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();

  // Свист падения — вертикальные штрихи за силуэтом
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 * (1 - t)})`;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const x = i * e.radius * 0.5;
    const top = -fallHeight - e.radius * 3.2;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, -fallHeight - e.radius * 1.6);
    ctx.stroke();
  }
}

// Мама выходит из розового вихря: частицы-сердечки закручиваются к центру.
function drawSwirlEntrance(ctx, e, t) {
  const count = 14;
  for (let i = 0; i < count; i++) {
    const angle = e.seed + (i / count) * Math.PI * 2 + t * 9;
    const dist = e.radius * (1.9 - t * 1.3) * (0.7 + (i % 3) * 0.15);
    const size = e.radius * 0.26 * (1 - t * 0.25);
    ctx.globalAlpha = 0.6 + t * 0.35;
    ctx.fillStyle = i % 2 ? '#ff9db1' : '#ffd93d';
    drawHeart(ctx, Math.cos(angle) * dist, Math.sin(angle) * dist * 0.6, size);
  }
}

function drawHeart(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.5);
  ctx.bezierCurveTo(-size, -size * 0.3, -size * 0.4, -size, 0, -size * 0.35);
  ctx.bezierCurveTo(size * 0.4, -size, size, -size * 0.3, 0, size * 0.5);
  ctx.fill();
  ctx.restore();
}

// Спортсмен влетает: полосы скорости стягиваются к точке появления.
function drawRushEntrance(ctx, e, t) {
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - t) + 0.2})`;
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const offset = (i - 3) * e.radius * 0.32;
    const from = e.radius * (5.5 - t * 4.5);
    const to = e.radius * (1.6 - t * 1.2);
    ctx.lineWidth = 4 + (3 - Math.abs(i - 3)) * 2;
    ctx.beginPath();
    ctx.moveTo(-from, offset);
    ctx.lineTo(-to, offset);
    ctx.stroke();
  }
  // Пыль из-под ног в конце разгона
  if (t > 0.6) {
    ctx.fillStyle = `rgba(220, 210, 190, ${(t - 0.6) * 1.6})`;
    ctx.beginPath();
    ctx.ellipse(0, e.radius * 0.5, e.radius * t, e.radius * 0.3 * t, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Ледяной вырастает из глыбы: льдина поднимается, а под конец идёт трещинами.
function drawIceEntrance(ctx, e, t) {
  const h = e.radius * 2.2 * Math.min(1, t * 1.4);
  const w = e.radius * 1.1;

  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#bfefff';
  ctx.beginPath();
  ctx.moveTo(-w, e.radius * 0.4);
  ctx.lineTo(-w * 0.55, e.radius * 0.4 - h);
  ctx.lineTo(0, e.radius * 0.4 - h * 1.15);
  ctx.lineTo(w * 0.55, e.radius * 0.4 - h);
  ctx.lineTo(w, e.radius * 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#7fd8ff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Трещины в последней трети — глыба вот-вот расколется
  if (t > 0.65) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${(t - 0.65) * 3})`;
    ctx.lineWidth = 2.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * w * 0.35, e.radius * 0.4);
      ctx.lineTo(i * w * 0.15, e.radius * 0.4 - h * 0.6);
      ctx.lineTo(i * w * 0.45, e.radius * 0.4 - h);
      ctx.stroke();
    }
  }
}

// Огненный поднимается из столба пламени.
function drawFireEntrance(ctx, e, t) {
  const h = e.radius * 3.4 * Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.8);
  const w = e.radius * (0.7 + t * 0.5);

  for (const [scale, color] of [[1, '#ff6b2b'], [0.62, '#ffb703'], [0.3, '#ffe680']]) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55 + scale * 0.35;
    ctx.beginPath();
    ctx.moveTo(-w * scale, e.radius * 0.4);
    // Язык пламени: волнистые бока, чтобы столб «жил»
    ctx.quadraticCurveTo(
      -w * scale * 1.5, e.radius * 0.4 - h * 0.5,
      Math.sin(e.seed + t * 12) * w * 0.25, e.radius * 0.4 - h * scale,
    );
    ctx.quadraticCurveTo(
      w * scale * 1.5, e.radius * 0.4 - h * 0.5,
      w * scale, e.radius * 0.4,
    );
    ctx.closePath();
    ctx.fill();
  }
}
