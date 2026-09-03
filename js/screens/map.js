// Карта путешествия: двенадцать остановок кампании.
//
// Устроена как альбом — DOM-карточки, а внутри каждой маленький canvas, на
// котором босса рисует настоящий игровой код. Правило проекта: мир на canvas,
// меню и карточки на DOM. Карта статична, перерисовывать её каждый кадр
// незачем, а всё, что нужно DOM (клики, прокрутка, ресайз), в Overlay уже
// есть, тогда как для canvas нет ничего.
//
// Дорожка идёт ЗМЕЙКОЙ: слева направо, потом ряд обратно. Сетка «по четыре в
// ряд» читалась как таблица, а не как путь, и было непонятно, куда идти
// дальше. Колонка каждой остановки считается здесь, а не в CSS: правило вида
// «пятая карточка — в четвёртую колонку» пришлось бы переписывать при любом
// изменении числа глав, причём молча.
//
// Навигация ОДНОМЕРНА, и это не оформление: Game.feedScreen переводит любую
// стрелку в сдвиг на одну позицию. Ходят по остановкам в порядке глав, как бы
// ни вилась дорожка на экране.
//
// Экран один на двоих: кампания общая, поэтому инфраструктура picker
// (startPicking/pickerColumns) тут не нужна.

import { Overlay } from './overlay.js';
import { icon } from '../render/icons.js';
import {
  journeyProgress, themeIcon, themeName, themeColors, bossOf, goalText,
} from '../core/campaign.js';

const BOSS_SIZE = 72;
// Ширина ряда. Четыре — компромисс: змейка из трёх рядов помещается на
// телефоне целиком и не превращается в длинную ленту на мониторе.
const PER_ROW = 4;

export class MapScreen extends Overlay {
  constructor(rootId, { onPlay, onShop, onHero, onPlayers, onJourney, onClose, onSpeak }) {
    super(rootId);
    this.onPlay = onPlay;
    this.onShop = onShop;
    this.onHero = onHero;
    this.onPlayers = onPlayers;
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
      last: index === campaign.chapters.length - 1,
      ...placeOnRoad(index, campaign.chapters.length),
    }));
    // Курсор встаёт на первую непройденную — туда, куда ребёнку идти.
    this.selected = campaign.currentIndex;

    const progress = journeyProgress(campaign);
    // Кнопка показывает нынешний выбор, а не приглашение его сменить:
    // ребёнок читать не умеет, и «Вдвоём» рядом с двумя фигурками говорит
    // ему, что сейчас играют двое, — а нажатие это меняет.
    const duo = (save.playersCount || 1) > 1;
    this.setContent(`
      <div class="panel panel--map">
        <h2 class="title title--small">${icon(campaign.spec.icon)} ${campaign.spec.title.toUpperCase()}</h2>
        <div class="map-pages">
          ${renderPageStrip(progress, campaign.spec.reward.icon)}
          <span class="map-pages__count">${progress.open}/${progress.total}</span>
        </div>
        <div class="map-road">
          ${this.stops.map((stop) => this.renderStop(stop)).join('')}
        </div>
        <div class="map-info"></div>
        <button class="btn btn--big" data-action="play">ИГРАТЬ ${icon('ui-play')}</button>
        <div class="menu-buttons">
          <button class="btn btn--secondary" data-action="hero">${icon('ui-hero')} Герой</button>
          <button class="btn btn--secondary" data-action="players">
            ${icon(duo ? 'ui-heroes' : 'ui-hero')} ${duo ? 'Вдвоём' : 'Один'}
          </button>
          <button class="btn btn--secondary" data-action="shop">${icon('ui-shop')} Магазин ${icon('ui-money')} ${save.coins}</button>
          <button class="btn btn--secondary" data-action="close">${icon('ui-home')} В меню</button>
        </div>
      </div>
    `);

    this.onAll('.map-stop', (_el, i) => {
      this.selected = i;
      this.highlight();
      this.speakCurrent();
    });
    this.on('[data-action="play"]', () => this.enter());
    this.on('[data-action="hero"]', this.onHero);
    this.on('[data-action="players"]', this.onPlayers);
    this.on('[data-action="shop"]', this.onShop);
    this.on('[data-action="close"]', this.onClose);
    this.bindSpeakButtons(this.onSpeak);

    this.show();
    this.paintStops();
    this.highlight();
  }

  renderStop(stop) {
    const { chapter, index, done, open, here, last, column, turn } = stop;
    const colors = themeColors(chapter.theme);
    const state = done ? 'map-stop--done' : (open ? 'map-stop--open' : 'map-stop--locked');
    // Значок состояния один на остановку: пройдено, ты здесь или замок. Три
    // разом превратили бы кружок в кашу из эмодзи.
    //
    // Пройдено помечаем галочкой, а не страницей: страница на тёмном кружке
    // читается как серое надгробие, а галочку ребёнок понимает мгновенно.
    // Страницы при этом никуда не делись — они в полоске над картой.
    const badge = done ? 'ui-done' : (here ? 'ui-pin' : (open ? null : 'ui-lock'));
    return `
      <div class="map-stop ${state} map-stop--${turn}" data-index="${index}"
           style="grid-area: ${stop.row} / ${column};
                  --stop-ground: ${colors.ground}; --stop-accent: ${colors.accent}">
        ${Overlay.speakButton(describeStop(stop))}
        <div class="map-stop__disc">
          <canvas class="map-stop__canvas" width="${BOSS_SIZE}" height="${BOSS_SIZE}"
                  data-index="${index}"></canvas>
          <span class="map-stop__number">${index + 1}</span>
          ${badge ? `<span class="map-stop__badge">${icon(badge)}</span>` : ''}
          ${last ? `<span class="map-stop__crown">${icon('ui-crown')}</span>` : ''}
        </div>
        <span class="map-stop__place">${icon(themeIcon(chapter.theme))}</span>
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
      el.classList.toggle('map-stop--selected', i === this.selected);
    });
    // Панель прокручивается (max-height: 92vh): без этого выбранная остановка
    // уезжает за край, и стрелками ребёнок водит вслепую.
    cards[this.selected]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    this.renderInfo();
  }

  // Подпись под картой: где мы и что там делать. Голос это тоже говорит, но
  // голос легко пропустить — а тут написано, пока смотришь.
  renderInfo() {
    const stop = this.stops[this.selected];
    const box = this.root.querySelector('.map-info');
    if (!stop || !box) return;
    const { chapter, boss, done, open } = stop;
    box.className = `map-info ${open ? '' : 'map-info--locked'}`;
    box.innerHTML = `
      <span class="map-info__place">${icon(themeIcon(chapter.theme))} ${themeName(chapter.theme)}</span>
      <span class="map-info__task">
        ${open
          ? `${done ? `${icon('ui-done')} ` : ''}${goalText(chapter)}`
          : `${icon('ui-lock')} Сюда ещё рано — ${boss?.name || ''} ждёт`}
      </span>
    `;
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

// Где остановка стоит на змейке и куда от неё уходит дорога.
//
// Чётные ряды идут слева направо, нечётные — обратно, поэтому конец ряда
// оказывается ровно над началом следующего, и поворот получается без разрывов.
function placeOnRoad(index, total) {
  const row = Math.floor(index / PER_ROW);
  const inRow = index % PER_ROW;
  const leftToRight = row % 2 === 0;
  const column = leftToRight ? inRow + 1 : PER_ROW - inRow;
  const lastInRow = inRow === PER_ROW - 1;
  const last = index === total - 1;

  // Ряд задаём явно вместе с колонкой. С одной только колонкой сетка кладёт
  // элементы разреженно: поставив пятую остановку в четвёртую колонку второго
  // ряда, курсор проходит мимо третьей колонки, и шестая уезжает в третий ряд.
  // Змейка при этом рассыпается, а выглядит это как «через одну».
  if (last) return { row: row + 1, column, turn: 'end' };
  if (lastInRow) return { row: row + 1, column, turn: 'down' };
  return { row: row + 1, column, turn: leftToRight ? 'right' : 'left' };
}

// Полоска страниц вверху: наглядно, сколько альбома уже собрано. Для
// нечитающего ребёнка это единственный способ увидеть прогресс числом.
function renderPageStrip(progress, rewardIcon) {
  return Array.from({ length: progress.total }, (_, i) => `
    <span class="map-page ${i < progress.open ? 'map-page--back' : ''}">${icon(rewardIcon)}</span>
  `).join('');
}

function describeStop(stop) {
  const { chapter, done, open, index } = stop;
  const where = `${themeName(chapter.theme)}, глава ${index + 1}.`;
  if (done) return `${where} Пройдено! Страница уже в альбоме.`;
  if (!open) return `${where} Сюда ещё рано.`;
  return `${where} ${chapter.about}. ${goalText(chapter)}`;
}
