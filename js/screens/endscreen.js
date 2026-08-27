// Экраны конца раунда.
// Победа — салют и похвала. «Поражения» как такового нет: герой просто
// отряхивается, и предлагается попробовать ещё раз. Никаких GAME OVER.

import { CONFIG } from '../config.js';
import { Overlay } from './overlay.js';

const HERO_SIZE = 130;

export class EndScreen extends Overlay {
  constructor(rootId, { onNext, onRetry, onMenu }) {
    super(rootId);
    this.onNext = onNext;
    this.onRetry = onRetry;
    this.onMenu = onMenu;

    this.bindNavigation({
      onMove: () => {},
      onConfirm: () => this.root.querySelector('.btn--big')?.click(),
    });
  }

  // look — внешность выбранного героя: на победе он и радуется,
  // а не абстрактный смайлик супергероя.
  renderVictory({ round, zombiesDefeated, coinsEarned }, look, fresh = null) {
    this.setContent(`
      <div class="panel panel--end">
        <h2 class="title">ПОБЕДА! 🎉</h2>
        <canvas class="menu-hero-canvas" width="${HERO_SIZE}" height="${HERO_SIZE}"></canvas>
        <p class="big-line">Ты прогнал <b>${zombiesDefeated}</b> зомби!</p>
        <p class="big-line">Заработано 💵 <b>${coinsEarned}</b></p>
        ${renderFresh(fresh)}
        <button class="btn btn--big" data-action="next">РАУНД ${round + 1} ▶</button>
        <button class="btn btn--secondary" data-action="menu">🏠 В меню</button>
      </div>
    `);
    Overlay.paintHero(this.root.querySelector('.menu-hero-canvas'), look);
    this.paintFresh(fresh);
    this.on('[data-action="next"]', this.onNext);
    this.on('[data-action="menu"]', this.onMenu);
    this.show();
  }

  renderDefeat({ zombiesDefeated, coinsEarned }, fresh = null) {
    this.setContent(`
      <div class="panel panel--end">
        <h2 class="title title--soft">ПОЧТИ ПОЛУЧИЛОСЬ!</h2>
        <div class="menu-hero">😅</div>
        <p class="big-line">Ты прогнал <b>${zombiesDefeated}</b> зомби — это много!</p>
        <p class="big-line">Заработано 💵 <b>${coinsEarned}</b></p>
        ${renderFresh(fresh)}
        <button class="btn btn--big" data-action="retry">ЕЩЁ РАЗ ▶</button>
        <button class="btn btn--secondary" data-action="menu">🏠 В меню</button>
      </div>
    `);
    this.paintFresh(fresh);
    this.on('[data-action="retry"]', this.onRetry);
    this.on('[data-action="menu"]', this.onMenu);
    this.show();
  }

  // Новые наклейки показываем прямо здесь, а не отдельным экраном «Ты открыл
  // наклейку!»: награда должна приходить туда, где ребёнок уже стоит, и не
  // добавлять лишнего нажатия. На поражении тоже — тем и ценно правило
  // «зомби открывается по появлению».
  paintFresh(fresh) {
    for (const canvas of this.root.querySelectorAll('.fresh-sticker')) {
      const { kind, id } = canvas.dataset;
      const list = kind === 'bosses' ? CONFIG.bossTypes : CONFIG.zombieTypes;
      const spec = list.find((t) => t.id === id);
      const paint = kind === 'bosses' ? Overlay.paintBoss : Overlay.paintZombie;
      if (spec) paint(canvas, spec.look, {});
    }
  }
}

function renderFresh(fresh) {
  if (!fresh) return '';
  const all = [
    ...fresh.zombies.map((id) => ({ kind: 'zombies', id })),
    ...fresh.bosses.map((id) => ({ kind: 'bosses', id })),
  ];
  if (!all.length) return '';
  return `
    <p class="big-line">📖 НОВЫЕ НАКЛЕЙКИ!</p>
    <div class="fresh-stickers">
      ${all.map((s) => `<canvas class="fresh-sticker" width="70" height="70"
          data-kind="${s.kind}" data-id="${s.id}"></canvas>`).join('')}
    </div>
  `;
}
