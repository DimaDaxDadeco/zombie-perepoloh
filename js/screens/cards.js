// Экран прокачки: три большие карточки. Выбор мышью или стрелками + Enter.
// Текста минимум — ребёнок ориентируется по иконке и количеству звёзд,
// а название оружия может послушать голосом (кнопка 🔈).

import { CONFIG } from '../config.js';
import { CardKind } from '../systems/levelup.js';
import { Overlay } from './overlay.js';

export class CardsScreen extends Overlay {
  constructor(rootId, { onPick, onSpeak }) {
    super(rootId);
    this.onPick = onPick;
    this.onSpeak = onSpeak;
    this.decks = [];

    // Стрелки двигают выбор, Enter/Пробел подтверждает. Вдвоём каждый листает
    // СВОЮ колоду: арсеналы у игроков разные, и общая карточка слила бы их.
    this.bindNavigation({
      perPlayer: true,
      onMove: (d, i) => this.move(d, i),
      onConfirm: (i) => this.confirm(i),
    });
  }

  // decks — по колоде карточек на игрока, looks — по внешности героя.
  render(decks, { looks = [] } = {}) {
    this.decks = Array.isArray(decks[0]) ? decks : [decks];
    this.startPicking(this.decks.length);
    this.setContent(`
      <div class="panel panel--cards${this.total > 1 ? ' panel--duo' : ''}">
        <h2 class="title title--small">НОВЫЙ УРОВЕНЬ!</h2>
        ${this.pickerColumns((i) => `
          ${this.total > 1 ? `<canvas class="menu-hero-canvas" width="90" height="90"
              data-player="${i}"></canvas>` : ''}
          <div class="cards">
            ${this.decks[i].map((card, k) => this.renderCard(card, k)).join('')}
          </div>`)}
        <p class="hint">Кликни картинку или выбери стрелками и нажми Enter.
           Нажми 🔈, чтобы послушать название</p>
      </div>
    `);
    this.onCards('.card', (owner, index) => {
      this.picks[owner].selected = index;
      this.highlight(owner);
      this.confirm(owner);
    });
    this.bindSpeakButtons(this.onSpeak);
    // Вдвоём над колонкой — герой её хозяина: ребёнок не читает, и одного
    // цвета заголовка мало, а свой персонаж узнаётся сразу.
    this.root.querySelectorAll('.menu-hero-canvas').forEach((canvas) => {
      Overlay.paintHero(canvas, looks[Number(canvas.dataset.player)]);
    });
    this.show();
    this.picks.forEach((_, i) => this.highlight(i));
  }

  renderCard(card, index) {
    const label = { [CardKind.NEW_WEAPON]: 'НОВОЕ!', [CardKind.EVOLVE]: 'ВЫРОСЛО!' }[card.kind] || '';
    const stars = card.kind === CardKind.HEAL
      ? ''
      : '⭐'.repeat(card.stars) + '☆'.repeat(Math.max(0, CONFIG.maxStars - card.stars));
    return `
      <div class="card ${card.kind === CardKind.EVOLVE ? 'card--evolve' : ''}" data-index="${index}">
        ${label ? `<span class="card__badge">${label}</span>` : ''}
        ${Overlay.speakButton(describeCard(card))}
        <span class="card__emoji">${card.emoji}</span>
        <span class="card__title">${card.title}</span>
        <span class="card__stars">${stars}</span>
      </div>
    `;
  }

  move(delta, playerIndex = 0) {
    const at = this.movePick(playerIndex, delta, this.decks[playerIndex].length);
    if (at === null) return;
    this.highlight(playerIndex);
    // При выборе с клавиатуры сразу читаем вслух — так ребёнок понимает,
    // что именно он сейчас выбирает, не умея прочитать подпись.
    this.onSpeak(describeCard(this.decks[playerIndex][at]));
  }

  highlight(playerIndex = 0) {
    this.highlightIn(playerIndex, '.card', 'card--selected');
  }

  confirm(playerIndex = 0) {
    const chosen = this.confirmPick(playerIndex);
    if (chosen) this.onPick(chosen.map((at, i) => this.decks[i][at]));
  }
}

// Фраза для голоса: что это и насколько прокачано.
function describeCard(card) {
  if (!card) return '';
  if (card.kind === CardKind.HEAL) return 'Сердечко. Плюс одна жизнь';
  if (card.kind === CardKind.NEW_WEAPON) return `Новое оружие: ${card.title}`;
  // Здесь голос обязателен: ребёнок должен понять, что случилось нечто
  // большее, чем «плюс одна звезда».
  if (card.kind === CardKind.EVOLVE) return `${card.title}! Твоё оружие выросло. ${card.about}`;
  return `${card.title}, ${card.stars} ${starWord(card.stars)}`;
}

function starWord(count) {
  if (count === 1) return 'звезда';
  if (count >= 2 && count <= 4) return 'звезды';
  return 'звёзд';
}
