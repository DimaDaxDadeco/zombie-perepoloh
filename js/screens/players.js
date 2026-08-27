// Сколько играет человек — первый шаг новой игры, до выбора сложности.
// Спрашиваем именно здесь: от ответа зависит, сколько раз показывать выбор
// героя и оружия.

import { Overlay } from './overlay.js';

const OPTIONS = [
  {
    count: 1, emoji: '🦸', name: 'Один',
    about: 'Играешь сам', hint: '← ↑ → ↓ или геймпад',
  },
  {
    count: 2, emoji: '🦸🦸', name: 'Вдвоём',
    about: 'Вдвоём на одном экране', hint: 'первый — стрелки, второй — WASD или геймпад',
  },
];

export class PlayersScreen extends Overlay {
  constructor(rootId, { onPick, onSpeak }) {
    super(rootId);
    this.onPick = onPick;
    this.onSpeak = onSpeak;
    this.selected = 0;

    this.bindNavigation({
      onMove: (d) => this.move(d),
      onConfirm: () => this.confirm(),
    });
  }

  render(currentCount) {
    const index = OPTIONS.findIndex((o) => o.count === currentCount);
    this.selected = index >= 0 ? index : 0;

    this.setContent(`
      <div class="panel panel--characters">
        <h2 class="title title--small">КТО ИГРАЕТ?</h2>
        <div class="heroes">
          ${OPTIONS.map((option, i) => this.renderCard(option, i)).join('')}
        </div>
        <button class="btn btn--big" data-action="next">ДАЛЬШЕ ▶</button>
        <p class="hint">Вдвоём — на одной клавиатуре или с геймпадом.
           Нажми 🔈, чтобы послушать</p>
      </div>
    `);

    this.onAll('.hero-card', (_el, i) => {
      this.selected = i;
      this.highlight();
      this.confirm();
    });
    this.on('[data-action="next"]', () => this.confirm());
    this.bindSpeakButtons(this.onSpeak);

    this.show();
    this.highlight();
  }

  renderCard(option, index) {
    return `
      <div class="hero-card" data-index="${index}">
        ${Overlay.speakButton(describePlayers(option))}
        <span class="weapon-choice__emoji">${option.emoji}</span>
        <span class="hero-card__name">${option.name}</span>
        <span class="hero-card__perk">${option.about}</span>
        <span class="hero-card__ability">${option.hint}</span>
      </div>
    `;
  }

  move(delta) {
    const count = OPTIONS.length;
    this.selected = (this.selected + delta + count) % count;
    this.highlight();
    this.onSpeak(describePlayers(OPTIONS[this.selected]));
  }

  highlight() {
    this.root.querySelectorAll('.hero-card').forEach((el, i) => {
      el.classList.toggle('hero-card--selected', i === this.selected);
    });
  }

  confirm() {
    this.onPick(OPTIONS[this.selected].count);
  }
}

function describePlayers(option) {
  return `${option.name}. ${option.about}`;
}
