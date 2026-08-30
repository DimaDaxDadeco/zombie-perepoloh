// Экраны конца раунда.
// Победа — салют и похвала. «Поражения» как такового нет: герой просто
// отряхивается, и предлагается попробовать ещё раз. Никаких GAME OVER.

import { CONFIG } from '../config.js';
import { Overlay } from './overlay.js';
import { themeEmoji, themeName } from '../core/campaign.js';

const HERO_SIZE = 130;

export class EndScreen extends Overlay {
  constructor(rootId, { onRetry, onMenu, onSpeak }) {
    super(rootId);
    this.onRetry = onRetry;
    this.onMenu = onMenu;
    this.onSpeak = onSpeak;
    // Куда ведёт большая кнопка, решает Game: обычный раунд идёт в магазин, а
    // глава кампании — обратно на карту. Экран об этом не знает и знать не
    // должен.
    this.onNext = () => {};

    this.bindNavigation({
      onMove: () => {},
      onConfirm: () => this.root.querySelector('.btn--big')?.click(),
    });
  }

  // look — внешность выбранного героя: на победе он и радуется,
  // а не абстрактный смайлик супергероя.
  // Хвост собран в объект, а не в пятый позиционный аргумент: их и так было
  // четыре, и на пятом вызов перестал бы читаться.
  renderVictory({ round, zombiesDefeated, coinsEarned }, look,
    { fresh = null, medals = [], page = null, next } = {}) {
    const button = next || { label: `РАУНД ${round + 1} ▶`, action: () => {} };
    this.onNext = button.action;
    this.setContent(`
      <div class="panel panel--end">
        <h2 class="title">ПОБЕДА! 🎉</h2>
        <canvas class="menu-hero-canvas" width="${HERO_SIZE}" height="${HERO_SIZE}"></canvas>
        <p class="big-line">Ты прогнал <b>${zombiesDefeated}</b> зомби!</p>
        <p class="big-line">Заработано 💵 <b>${coinsEarned}</b></p>
        ${renderPage(page)}
        ${renderFresh(fresh)}
        ${renderMedals(medals)}
        <button class="btn btn--big" data-action="next">${button.label}</button>
        <button class="btn btn--secondary" data-action="menu">🏠 В меню</button>
      </div>
    `);
    Overlay.paintHero(this.root.querySelector('.menu-hero-canvas'), look);
    this.paintFresh(fresh);
    this.on('[data-action="next"]', () => this.onNext());
    this.on('[data-action="menu"]', this.onMenu);
    this.bindSpeakButtons(this.onSpeak);
    this.show();
    // Вернувшаяся страница — главное событие главы, и ребёнок не читает.
    if (page) this.onSpeak?.('Ура! Страница вернулась в альбом!');
  }

  renderDefeat({ zombiesDefeated, coinsEarned }, { fresh = null, medals = [] } = {}) {
    this.setContent(`
      <div class="panel panel--end">
        <h2 class="title title--soft">ПОЧТИ ПОЛУЧИЛОСЬ!</h2>
        <div class="menu-hero">😅</div>
        <p class="big-line">Ты прогнал <b>${zombiesDefeated}</b> зомби — это много!</p>
        <p class="big-line">Заработано 💵 <b>${coinsEarned}</b></p>
        ${renderFresh(fresh)}
        ${renderMedals(medals)}
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

// Медали — сюда же, где и наклейки, и по той же причине: награда приходит
// туда, где ребёнок уже стоит. Отдельного экрана «Ты получил медаль!» нет и
// не надо — это лишнее нажатие между ним и следующим раундом.
//
// Canvas тут не нужен: медаль это эмодзи (см. album.js).
function renderMedals(medals) {
  if (!medals || !medals.length) return '';
  return `
    <p class="big-line">🏅 ${medals.length > 1 ? 'НОВЫЕ МЕДАЛИ!' : 'НОВАЯ МЕДАЛЬ!'}</p>
    <div class="fresh-stickers">
      ${medals.map((m) => `
        <span class="fresh-medal" title="${m.name}">
          <span class="fresh-medal__emoji">${m.emoji}</span>
          <span class="fresh-medal__name">${m.name}</span>
        </span>
      `).join('')}
    </div>
  `;
}

// Вернувшаяся страница альбома — награда за главу кампании. Эмодзи локации, а
// не картинка: страницы как объекта в игре нет, рисовать нечего, и заводить
// ради неё функцию в sprites.js (он и так самый большой модуль) незачем.
function renderPage(chapter) {
  if (!chapter) return '';
  return `
    <p class="big-line">📖 СТРАНИЦА ВЕРНУЛАСЬ!</p>
    <div class="fresh-stickers">
      <span class="fresh-medal">
        <span class="fresh-medal__emoji">${themeEmoji(chapter.theme)}</span>
        <span class="fresh-medal__name">${themeName(chapter.theme)}</span>
      </span>
    </div>
  `;
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
