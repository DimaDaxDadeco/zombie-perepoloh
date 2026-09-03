// Главное меню. Две большие кнопки: обычная игра («Продолжить» или «Новая
// игра») и путешествие. Обе — способы играть, и выглядеть они должны одинаково
// весомо: путешествие в виде маленькой кнопки рядом с магазином и альбомом
// читалось как служебный раздел, а не как «нажми и играй».
//
// Раньше вторая .btn--big в меню была запрещена: геймпад жал первую в разметке
// вслепую, и новая кнопка молча перехватила бы управление. Теперь меню умеет
// навигацию, как все прочие экраны, и запрет снят — но выбор по умолчанию
// стоит на обычной игре, чтобы «нажал пробел не глядя» по-прежнему означало
// «играем дальше».
//
// Выбор героя и оружия сюда не вынесен намеренно — он идёт сразу после «Новой
// игры», чтобы у ребёнка был один понятный путь.

import { CONFIG } from '../config.js';
import { Overlay } from './overlay.js';
import { albumProgress } from '../core/album.js';
import { campaignProgress } from '../core/campaign.js';
import { icon } from '../render/icons.js';

const HERO_PREVIEW_SIZE = 130;

export class MenuScreen extends Overlay {
  constructor(rootId, { onContinue, onNewGame, onShop, onAlbum, onCampaign }) {
    super(rootId);
    this.onContinue = onContinue;
    this.onNewGame = onNewGame;
    this.onShop = onShop;
    this.onAlbum = onAlbum;
    this.onCampaign = onCampaign;
    this.buttons = [];
    this.selected = 0;

    this.bindNavigation({
      onMove: (d) => this.move(d),
      onConfirm: () => this.activate(),
    });
  }

  render(save) {
    const character = CONFIG.characters.find((c) => c.id === save.character);
    // Уровень сложности в HUD намеренно не показывается (он не меняется по
    // ходу боя), но в строке фактов о сохранении он на месте — взрослому
    // видно, в каком режиме идёт игра.
    const difficulty = CONFIG.difficulties.find((d) => d.id === save.difficulty)
      || CONFIG.difficulties[0];
    // Продолжать нечего, пока герой не выбран — то есть при самом первом
    // запуске и сразу после «Новой игры».
    const canContinue = Boolean(character);
    const campaign = campaignProgress(save);

    this.setContent(`
      <div class="panel panel--menu">
        <h1 class="title">ЗОМБИ-ПЕРЕПОЛОХ</h1>
        <canvas class="menu-hero-canvas" width="${HERO_PREVIEW_SIZE}"
                height="${HERO_PREVIEW_SIZE}"></canvas>
        ${canContinue ? `
          <div class="stats-row">
            <span class="stat">${icon('ui-money')} ${save.coins}</span>
            <span class="stat">${icon('ui-flag')} Раунд ${save.round}</span>
            <span class="stat" title="${difficulty.name}">${icon(difficulty.icon)}</span>
          </div>
        ` : ''}
        <div class="menu-play">
          ${canContinue
            ? `<button class="btn btn--big" data-action="continue">ПРОДОЛЖИТЬ ${icon('ui-play')}</button>`
            : `<button class="btn btn--big" data-action="new">НОВАЯ ИГРА ${icon('ui-play')}</button>`}
          <button class="btn btn--big btn--journey" data-action="campaign">
            ${icon(CONFIG.campaign.icon)} ${CONFIG.campaign.title.toUpperCase()} ${icon('ui-play')}
            <span class="btn__note">${campaign.open}/${campaign.total} страниц</span>
          </button>
        </div>
        <div class="menu-buttons">
          ${canContinue ? `<button class="btn btn--secondary" data-action="new">${icon('ui-spark')} Новая игра</button>` : ''}
          <button class="btn btn--secondary" data-action="shop">${icon('ui-shop')} Магазин</button>
          <button class="btn btn--secondary" data-action="album">${icon('ui-album')} Альбом ${albumOpen(save)}</button>
        </div>
        <p class="hint">Выбирай стрелками, нажимай пробел. В бою бегай стрелками —
           оружие стреляет само!</p>
      </div>
    `);

    this.drawHeroPreview(character);
    this.on('[data-action="continue"]', this.onContinue);
    this.onAll('[data-action="new"]', this.onNewGame);
    this.on('[data-action="shop"]', this.onShop);
    this.on('[data-action="album"]', this.onAlbum);
    this.on('[data-action="campaign"]', this.onCampaign);

    // Курсор стоит на обычной игре: это по-прежнему главное действие меню, и
    // «нажал не глядя» обязано остаться безопасным.
    this.buttons = [...this.root.querySelectorAll('.btn')];
    this.selected = 0;
    this.highlight();
    this.show();
  }

  move(delta) {
    const count = this.buttons.length;
    if (!count) return;
    this.selected = (this.selected + delta + count) % count;
    this.highlight();
  }

  activate() {
    this.buttons[this.selected]?.click();
  }

  highlight() {
    this.buttons.forEach((el, i) => el.classList.toggle('btn--focused', i === this.selected));
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
