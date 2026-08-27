// Выбор уровня сложности — первый шаг новой игры, до выбора героя и оружия.
// Поменять уровень позже нельзя: он часть этого прохождения, а «Новая игра»
// и так стирает прогресс. Как и везде: крупные иконки и кнопка 🔈, потому что
// ребёнок ещё не читает.

import { CONFIG } from '../config.js';
import { Overlay } from './overlay.js';

export class DifficultyScreen extends Overlay {
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

  render(currentId) {
    const index = CONFIG.difficulties.findIndex((d) => d.id === currentId);
    this.selected = index >= 0 ? index : 0;

    this.setContent(`
      <div class="panel panel--characters">
        <h2 class="title title--small">ВЫБЕРИ, КАК ИГРАТЬ</h2>
        <div class="heroes">
          ${CONFIG.difficulties.map((spec, i) => this.renderCard(spec, i)).join('')}
        </div>
        <button class="btn btn--big" data-action="next">ДАЛЬШЕ ▶</button>
        <p class="hint">Дальше выберешь героя и оружие.
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

  renderCard(spec, index) {
    return `
      <div class="hero-card" data-index="${index}">
        ${Overlay.speakButton(describeDifficulty(spec))}
        <span class="weapon-choice__emoji">${spec.emoji}</span>
        <span class="hero-card__name">${spec.name}</span>
        <span class="hero-card__perk">${spec.about}</span>
      </div>
    `;
  }

  move(delta) {
    const count = CONFIG.difficulties.length;
    this.selected = (this.selected + delta + count) % count;
    this.highlight();
    this.onSpeak(describeDifficulty(CONFIG.difficulties[this.selected]));
  }

  highlight() {
    this.root.querySelectorAll('.hero-card').forEach((el, i) => {
      el.classList.toggle('hero-card--selected', i === this.selected);
    });
  }

  confirm() {
    this.onPick(CONFIG.difficulties[this.selected].id);
  }
}

function describeDifficulty(spec) {
  return `${spec.name}. ${spec.about}`;
}
