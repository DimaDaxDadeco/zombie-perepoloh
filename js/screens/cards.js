// Экран прокачки: три большие карточки. Выбор мышью или стрелками + Enter.
// Текста минимум — ребёнок ориентируется по иконке и количеству звёзд,
// а название оружия может послушать голосом (кнопка 🔈).

import { CONFIG } from '../config.js';
import { CardKind } from '../systems/levelup.js';
import { Overlay } from './overlay.js';
import { playerTitle } from './characters.js';

export class CardsScreen extends Overlay {
  constructor(rootId, { onPick, onSpeak }) {
    super(rootId);
    this.onPick = onPick;
    this.onSpeak = onSpeak;
    this.cards = [];
    this.selected = 0;

    // Стрелки двигают выбор, Enter/Пробел подтверждает.
    this.bindNavigation({
      onMove: (d) => this.move(d),
      onConfirm: () => this.confirm(),
    });
  }

  render(cards, { playerIndex = 0, total = 1, look = null } = {}) {
    this.cards = cards;
    this.selected = 0;
    this.setContent(`
      <div class="panel panel--cards">
        <h2 class="title title--small">${playerTitle(playerIndex, total)}НОВЫЙ УРОВЕНЬ!</h2>
        ${total > 1 ? '<canvas class="menu-hero-canvas" width="90" height="90"></canvas>' : ''}
        <div class="cards">
          ${cards.map((card, i) => this.renderCard(card, i)).join('')}
        </div>
        <p class="hint">Кликни картинку или выбери стрелками и нажми Enter.
           Нажми 🔈, чтобы послушать название</p>
      </div>
    `);
    this.onAll('.card', (_el, index) => {
      this.selected = index;
      this.confirm();
    });
    this.bindSpeakButtons(this.onSpeak);
    // Вдвоём показываем героя того, чья очередь: ребёнок не читает, и цвета
    // заголовка мало — картинка своего персонажа понятнее любой подписи.
    if (look) Overlay.paintHero(this.root.querySelector('.menu-hero-canvas'), look);
    this.show();
    this.highlight();
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

  move(delta) {
    this.selected = (this.selected + delta + this.cards.length) % this.cards.length;
    this.highlight();
    // При выборе с клавиатуры сразу читаем вслух — так ребёнок понимает,
    // что именно он сейчас выбирает, не умея прочитать подпись.
    this.onSpeak(describeCard(this.cards[this.selected]));
  }

  highlight() {
    this.root.querySelectorAll('.card').forEach((el, i) => {
      el.classList.toggle('card--selected', i === this.selected);
    });
  }

  confirm() {
    const card = this.cards[this.selected];
    if (card) this.onPick(card);
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
