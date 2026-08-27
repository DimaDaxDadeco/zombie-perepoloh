// Выбор стартового оружия. Показывается один раз после выбора героя,
// дальше — по кнопке в меню. Как и везде: крупные иконки и кнопка 🔈,
// потому что ребёнок ещё не читает.

import { CONFIG } from '../config.js';
import { Overlay } from './overlay.js';
import { ALL_WEAPON_IDS } from '../weapons/weapons.js';
import { playerTitle } from './characters.js';

export class WeaponsScreen extends Overlay {
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

  render(currentId, { playerIndex = 0, total = 1 } = {}) {
    const index = ALL_WEAPON_IDS.indexOf(currentId);
    this.selected = index >= 0 ? index : 0;

    this.setContent(`
      <div class="panel panel--characters">
        <h2 class="title title--small">${playerTitle(playerIndex, total)}С ЧЕГО НАЧНЁМ?</h2>
        <div class="heroes">
          ${ALL_WEAPON_IDS.map((id, i) => this.renderCard(id, i)).join('')}
        </div>
        <button class="btn btn--big" data-action="play">ИГРАТЬ ▶</button>
        <p class="hint">Это оружие будет у тебя с самого начала.
           Остальное можно набрать в бою. Нажми 🔈, чтобы послушать</p>
      </div>
    `);

    this.onAll('.hero-card', (_el, i) => {
      this.selected = i;
      this.highlight();
      this.confirm();
    });
    this.on('[data-action="play"]', () => this.confirm());
    this.bindSpeakButtons(this.onSpeak);

    this.show();
    this.highlight();
  }

  renderCard(id, index) {
    const spec = CONFIG.weapons[id];
    return `
      <div class="hero-card" data-index="${index}">
        ${Overlay.speakButton(describeWeapon(id))}
        <span class="weapon-choice__emoji">${spec.emoji}</span>
        <span class="hero-card__name">${spec.name}</span>
        <span class="hero-card__perk">${WEAPON_HINTS[id]}</span>
      </div>
    `;
  }

  move(delta) {
    const count = ALL_WEAPON_IDS.length;
    this.selected = (this.selected + delta + count) % count;
    this.highlight();
    this.onSpeak(describeWeapon(ALL_WEAPON_IDS[this.selected]));
  }

  highlight() {
    this.root.querySelectorAll('.hero-card').forEach((el, i) => {
      el.classList.toggle('hero-card--selected', i === this.selected);
    });
  }

  confirm() {
    this.onPick(ALL_WEAPON_IDS[this.selected]);
  }
}

// Короткие подсказки «на что это похоже» — детским языком, без цифр.
const WEAPON_HINTS = {
  water: 'Стреляет часто',
  tomato: 'Взрывается кляксой',
  lightning: 'Бьёт сразу нескольких',
  spinner: 'Крутится вокруг тебя',
  rocket: 'Редко, зато бабах!',
  fire: 'Поджигает зомби',
  ice: 'Замораживает зомби',
  saber: 'Рубит всех рядом',
};

function describeWeapon(id) {
  return `${CONFIG.weapons[id].name}. ${WEAPON_HINTS[id]}`;
}
