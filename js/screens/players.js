// Сколько играет человек — первый шаг новой игры, до выбора сложности.
// Спрашиваем именно здесь: от ответа зависит, сколько раз показывать выбор
// героя и оружия.

import { Overlay } from './overlay.js';
import { icon } from '../render/icons.js';
import { describePlayers, PLAYER_OPTIONS } from '../core/phrases.js';

// Значки и подсказка с раскладкой — дело экрана; имя и пояснение живут в
// core/phrases.js, потому что их читает голос.
//
// Подпись со стрелками — не украшение, а инструкция, как ходить. Значки тут
// поэтому такие же нарисованные, как всё остальное.
const HINTS = {
  1: `${icon('ui-arrow-left')}${icon('ui-arrow-up')}${icon('ui-arrow-right')}`
    + `${icon('ui-arrow-down')} или ${icon('ui-gamepad')} геймпад`,
  2: 'первый — стрелки, второй — WASD или геймпад',
};
const ICONS = { 1: 'ui-hero', 2: 'ui-heroes' };
const OPTIONS = PLAYER_OPTIONS.map((option) => ({
  ...option, icon: ICONS[option.count], hint: HINTS[option.count],
}));

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
        <button class="btn btn--big" data-action="next">ДАЛЬШЕ ${icon('ui-play')}</button>
        <p class="hint">Вдвоём — на одной клавиатуре или с геймпадом.
           Нажми ${icon('ui-speak')}, чтобы послушать</p>
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
        <span class="weapon-choice__emoji">${icon(option.icon)}</span>
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

