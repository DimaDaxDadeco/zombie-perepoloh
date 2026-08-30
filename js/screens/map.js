// Карта путешествия: двенадцать остановок кампании.
//
// Устроена как альбом — сетка карточек на DOM, а внутри карточки маленький
// canvas, который рисует босса настоящим игровым кодом. Правило проекта: мир
// на canvas, меню и карточки на DOM. Карта статична, перерисовывать её каждый
// кадр незачем, а всё, что нужно для DOM (клики, прокрутка, ресайз), в Overlay
// уже есть, тогда как для canvas этого нет ничего.
//
// Карта ОДНОМЕРНА, и это не выбор оформления. Game.feedScreen передаёт экранам
// только left/right/confirm/back — up/down до экранов не доходят вовсе.
// Поэтому стрелки листают остановки по порядку глав, как наклейки в альбоме,
// а «змейка» на экране — дело вёрстки.
//
// Экран один на двоих: кампания общая, поэтому инфраструктура picker
// (startPicking/pickerColumns) тут не нужна.

import { CONFIG } from '../config.js';
import { Overlay } from './overlay.js';
import { campaignProgress, themeEmoji, themeName, bossOf, goalText } from '../core/campaign.js';

const BOSS_SIZE = 96;

export class MapScreen extends Overlay {
  constructor(rootId, { onPlay, onShop, onClose, onSpeak }) {
    super(rootId);
    this.onPlay = onPlay;
    this.onShop = onShop;
    this.onClose = onClose;
    this.onSpeak = onSpeak;
    this.stops = [];
    this.selected = 0;

    this.bindNavigation({
      onMove: (d) => this.move(d),
      onConfirm: () => this.enter(),
      onCancel: () => this.onClose(),
    });
  }

  render(save, campaign, look) {
    this.look = look;
    this.stops = campaign.chapters.map((chapter, index) => ({
      chapter,
      index,
      boss: bossOf(chapter),
      done: campaign.isDone(chapter.id),
      open: campaign.isOpen(chapter.id),
      here: index === campaign.currentIndex,
    }));
    // Курсор встаёт на первую непройденную — на то место, куда ребёнку идти.
    this.selected = campaign.currentIndex;

    const progress = campaignProgress(save);
    this.setContent(`
      <div class="panel panel--map">
        <h2 class="title title--small">${CONFIG.campaign.emoji} ${CONFIG.campaign.title.toUpperCase()}</h2>
        <div class="stats-row">
          <span class="stat">📖 ${progress.open}/${progress.total} страниц</span>
        </div>
        <div class="map-road">
          ${this.stops.map((stop) => this.renderStop(stop)).join('')}
        </div>
        <button class="btn btn--big" data-action="play">ИГРАТЬ ▶</button>
        <div class="menu-buttons">
          <button class="btn btn--secondary" data-action="shop">🛒 Магазин 💵 ${save.coins}</button>
          <button class="btn btn--secondary" data-action="close">🏠 В меню</button>
        </div>
        <p class="hint">Зомби утащили альбом! Забери страницы обратно.
           Нажми 🔈, чтобы послушать</p>
      </div>
    `);

    this.onAll('.map-stop', (_el, i) => {
      this.selected = i;
      this.highlight();
      this.speakCurrent();
    });
    this.on('[data-action="play"]', () => this.enter());
    this.on('[data-action="shop"]', this.onShop);
    this.on('[data-action="close"]', this.onClose);
    this.bindSpeakButtons(this.onSpeak);

    this.show();
    this.paintStops();
    this.highlight();
  }

  renderStop(stop) {
    const { chapter, index, done, open } = stop;
    // Метка «ты здесь» нужна отдельно от подсветки курсора: ребёнок листает
    // остановки, курсор уезжает, и без неё непонятно, куда возвращаться.
    const state = done ? 'map-stop--done' : (open ? 'map-stop--open' : 'album-card--locked');
    return `
      <div class="map-stop album-card ${state}" data-index="${index}">
        ${Overlay.speakButton(describeStop(stop))}
        <span class="map-stop__number">${index + 1}</span>
        <canvas class="album-card__canvas map-stop__canvas" width="${BOSS_SIZE}"
                height="${BOSS_SIZE}" data-index="${index}"></canvas>
        <span class="album-card__name">${themeEmoji(chapter.theme)} ${themeName(chapter.theme)}</span>
        ${done ? '<span class="map-stop__page">📄</span>' : ''}
        ${stop.here && !done ? '<span class="map-stop__here">📍</span>' : ''}
      </div>
    `;
  }

  // Индекс берём из dataset, а не из порядка итерации: у карточек могут быть и
  // другие canvas'ы, и нумерация forEach разъехалась бы со stops молча.
  paintStops() {
    for (const canvas of this.root.querySelectorAll('.map-stop__canvas')) {
      const stop = this.stops[Number(canvas.dataset.index)];
      if (!stop?.boss) continue;
      Overlay.paintBoss(canvas, stop.boss.look, { locked: !stop.open });
    }
  }

  move(delta) {
    const count = this.stops.length;
    this.selected = (this.selected + delta + count) % count;
    this.highlight();
    this.speakCurrent();
  }

  speakCurrent() {
    this.onSpeak(describeStop(this.stops[this.selected]));
  }

  highlight() {
    const cards = this.root.querySelectorAll('.map-stop');
    cards.forEach((el, i) => {
      el.classList.toggle('album-card--selected', i === this.selected);
    });
    // Панель прокручивается (max-height: 92vh), а остановок двенадцать: без
    // этого выбранная уезжает за край, и стрелками ребёнок водит вслепую.
    cards[this.selected]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  enter() {
    const stop = this.stops[this.selected];
    if (!stop) return;
    // Закрытая глава не запускается, но и молчать нельзя: ребёнок нажал и
    // должен понять, почему ничего не произошло.
    if (!stop.open) {
      this.onSpeak('Сюда ещё рано. Пройди предыдущую страницу!');
      return;
    }
    this.onPlay(stop.chapter.id);
  }
}

function describeStop(stop) {
  const { chapter, done, open, index } = stop;
  const where = `${themeName(chapter.theme)}, глава ${index + 1}.`;
  if (done) return `${where} Пройдено! Страница уже в альбоме.`;
  if (!open) return `${where} Сюда ещё рано.`;
  return `${where} ${chapter.about}. ${goalText(chapter)}`;
}
