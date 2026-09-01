// Выбор стартового оружия. Показывается один раз после выбора героя,
// дальше — по кнопке в меню. Как и везде: крупные иконки и кнопка 🔈,
// потому что ребёнок ещё не читает.

import { CONFIG } from '../config.js';
import { Overlay } from './overlay.js';
import { ALL_WEAPON_IDS } from '../weapons/weapons.js';

export class WeaponsScreen extends Overlay {
  constructor(rootId, { onPick, onSpeak }) {
    super(rootId);
    this.onPick = onPick;
    this.onSpeak = onSpeak;
    this.bindNavigation({
      perPlayer: true,
      onMove: (d, i) => this.move(d, i),
      onConfirm: (i) => this.confirm(i),
    });
  }

  // fixed[i] — id своего оружия игрока (Паук) или null. Такая колонка
  // показывает одну карточку, не листается и считается подтверждённой сразу:
  // экран сам дождётся остальных, механика ожидания уже есть в Overlay.
  render(currentIds, { total = 1, fixed = [] } = {}) {
    const ids = Array.isArray(currentIds) ? currentIds : [currentIds];
    this.fixed = fixed;
    this.startPicking(total, (i) => Math.max(0, ALL_WEAPON_IDS.indexOf(ids[i])));
    this.picks.forEach((pick, i) => { if (this.fixed[i]) pick.confirmed = true; });

    // Одиннадцать карточек в две колонки не помещаются в обычном размере —
    // отсюда panel--weapons-duo: карточки уже и по три в ряд.
    this.setContent(`
      <div class="panel panel--characters panel--weapons${total > 1 ? ' panel--duo panel--weapons-duo' : ''}">
        <h2 class="title title--small">С ЧЕГО НАЧНЁМ?</h2>
        ${this.pickerColumns((i) => (this.fixed[i]
          ? `<div class="heroes">${this.renderCard(this.fixed[i], 0, true)}</div>
             <p class="hint">Своё оружие — выбирать нечего</p>`
          : `<div class="heroes">
              ${ALL_WEAPON_IDS.map((id, k) => this.renderCard(id, k)).join('')}
            </div>
            <button class="btn btn--big" data-confirm="${i}">
              ${total > 1 ? 'ГОТОВ ▶' : 'ИГРАТЬ ▶'}
            </button>`))}
        <p class="hint">Это оружие будет у тебя с самого начала.
           Остальное можно набрать в бою. Нажми 🔈, чтобы послушать</p>
      </div>
    `);

    this.onCards('.hero-card', (owner, i) => {
      if (this.fixed[owner]) return;
      this.picks[owner].selected = i;
      this.highlight(owner);
      this.confirm(owner);
    });
    this.onAll('[data-confirm]', (el) => this.confirm(Number(el.dataset.confirm)));
    this.bindSpeakButtons(this.onSpeak);

    this.show();
    // Флаг «готов» у своих колонок ставится до того, как появилась разметка,
    // поэтому класс на колонку вешаем здесь — иначе галочки не видно.
    this.picks.forEach((_, i) => {
      if (this.fixed[i]) this.column(i)?.classList.add('picker__column--ready');
      this.highlight(i);
    });
  }

  renderCard(id, index, locked = false) {
    const spec = CONFIG.weapons[id];
    return `
      <div class="hero-card ${locked ? 'hero-card--locked hero-card--selected' : ''}"
           data-index="${index}">
        ${Overlay.speakButton(describeWeapon(id))}
        <span class="weapon-choice__emoji">${spec.emoji}</span>
        <span class="hero-card__name">${spec.name}</span>
        <span class="hero-card__perk">${WEAPON_HINTS[id]}</span>
      </div>
    `;
  }

  move(delta, playerIndex = 0) {
    if (this.fixed[playerIndex]) return;
    const at = this.movePick(playerIndex, delta, ALL_WEAPON_IDS.length);
    if (at === null) return;
    this.highlight(playerIndex);
    this.onSpeak(describeWeapon(ALL_WEAPON_IDS[at]));
  }

  highlight(playerIndex = 0) {
    if (this.fixed[playerIndex]) return;   // там одна карточка, и она уже выбрана
    this.highlightIn(playerIndex, '.hero-card', 'hero-card--selected');
  }

  confirm(playerIndex = 0) {
    if (this.fixed[playerIndex]) return;
    const chosen = this.confirmPick(playerIndex);
    // Своё оружие подставляем по имени: индекса в ALL_WEAPON_IDS у него нет,
    // он оттуда намеренно исключён.
    if (chosen) this.onPick(chosen.map((at, i) => this.fixed[i] || ALL_WEAPON_IDS[at]));
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
  laser: 'Жжёт лучом насквозь',
  boomerang: 'Улетает и возвращается',
  bees: 'Летят и жалят сами',
  firetrail: 'Горит там, где ты пробежал',
  bubbles: 'Ловит зомби в пузырь',
  tornado: 'Вихрь таскает зомби',
  web: 'Липкие пятна замедляют',
};

function describeWeapon(id) {
  return `${CONFIG.weapons[id].name}. ${WEAPON_HINTS[id]}`;
}
