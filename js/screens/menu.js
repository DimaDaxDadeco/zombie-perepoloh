// Главное меню. Две главные кнопки: «Продолжить» (если есть сохранение) и
// «Новая игра», плюс кампания отдельной строкой ниже — она НЕ внутри ветки
// «есть сохранение», иначе при первом запуске её бы не было вовсе, то есть
// ровно тогда, когда начинать историю логичнее всего. Выбор героя и оружия сюда не вынесен намеренно — он идёт
// сразу после «Новой игры», чтобы у ребёнка был один понятный путь.

import { CONFIG } from '../config.js';
import { Overlay } from './overlay.js';
import { albumProgress } from '../core/album.js';
import { campaignProgress } from '../core/campaign.js';
const HERO_PREVIEW_SIZE = 130;

export class MenuScreen extends Overlay {
  constructor(rootId, { onContinue, onNewGame, onShop, onAlbum, onCampaign }) {
    super(rootId);
    this.onContinue = onContinue;
    this.onNewGame = onNewGame;
    this.onShop = onShop;
    this.onAlbum = onAlbum;
    this.onCampaign = onCampaign;

    // С геймпада главная кнопка нажимается сама собой: она в меню одна
    // большая и всегда означает «играем дальше». Поэтому вторая .btn--big в
    // меню запрещена: querySelector берёт первую в разметке, и новая кнопка
    // молча перехватила бы геймпад. Кампания живёт .btn--secondary именно
    // из-за этого, а не потому, что она второстепенна.
    this.bindNavigation({
      onMove: () => {},
      onConfirm: () => this.root.querySelector('.btn--big')?.click(),
    });
  }

  render(save) {
    const character = CONFIG.characters.find((c) => c.id === save.character);
    // Уровень сложности в HUD намеренно не показывается (он не меняется по
    // ходу боя), но в строке фактов о сохранении он на месте — взрослому
    // видно, в каком режиме идёт игра.
    const difficulty = CONFIG.difficulties.find((d) => d.id === save.difficulty)
      || CONFIG.difficulties[0];
    // Продолжать нечего, пока герой не выбран — то есть при самом первом запуске
    // и сразу после «Новой игры». Тогда в меню остаётся одна кнопка.
    const canContinue = Boolean(character);

    this.setContent(`
      <div class="panel panel--menu">
        <h1 class="title">ЗОМБИ-ПЕРЕПОЛОХ</h1>
        <canvas class="menu-hero-canvas" width="${HERO_PREVIEW_SIZE}"
                height="${HERO_PREVIEW_SIZE}"></canvas>
        ${canContinue ? `
          <div class="stats-row">
            <span class="stat">💵 ${save.coins}</span>
            <span class="stat">🏁 Раунд ${save.round}</span>
            <span class="stat" title="${difficulty.name}">${difficulty.emoji}</span>
          </div>
          <button class="btn btn--big" data-action="continue">ПРОДОЛЖИТЬ ▶</button>
          <div class="menu-buttons">
            <button class="btn btn--secondary" data-action="new">✨ Новая игра</button>
            <button class="btn btn--secondary" data-action="shop">🛒 Магазин</button>
            <button class="btn btn--secondary" data-action="album">📖 Альбом ${albumOpen(save)}</button>
          </div>
        ` : `
          <button class="btn btn--big" data-action="new">НОВАЯ ИГРА ▶</button>
        `}
        <div class="menu-buttons">
          <button class="btn btn--secondary" data-action="campaign">
            ${CONFIG.campaign.emoji} ${CONFIG.campaign.title} ${campaignOpen(save)}
          </button>
        </div>
        <p class="hint">Бегай стрелками ← ↑ → ↓ — оружие стреляет само!</p>
      </div>
    `);

    this.drawHeroPreview(character);
    this.on('[data-action="continue"]', this.onContinue);
    this.on('[data-action="new"]', this.onNewGame);
    this.on('[data-action="shop"]', this.onShop);
    this.on('[data-action="album"]', this.onAlbum);
    this.on('[data-action="campaign"]', this.onCampaign);
    this.show();
  }

  // Показываем в меню именно того героя, которым будем играть.
  drawHeroPreview(character) {
    const look = (character || CONFIG.characters[0]).look;
    Overlay.paintHero(this.root.querySelector('.menu-hero-canvas'), look);
  }
}

// Сколько наклеек открыто — цифры для взрослого, ребёнок ориентируется по
// самому альбому.
function albumOpen(save) {
  const p = albumProgress(save);
  return `${p.zombies.open + p.bosses.open}/${p.zombies.total + p.bosses.total}`;
}

function campaignOpen(save) {
  const p = campaignProgress(save);
  return `${p.open}/${p.total}`;
}
