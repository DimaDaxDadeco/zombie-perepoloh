// Выбор картинки — второй шаг новой игры, между сложностью и героем.
// Спрашиваем здесь, а не посреди боя: смена режима перестраивает всю
// отрисовку, и ребёнку это должно достаться как решение «во что играем»,
// а не как случайно нажатая кнопка. Плоская картинка остаётся первой:
// она привычная и работает везде, где не поднялся WebGL.

import { CONFIG } from '../config.js';
import { Overlay } from './overlay.js';
import { icon } from '../render/icons.js';
import { describeView } from '../core/phrases.js';

const SOLID_ID = 'solid'; // объёмный вариант; остальное — плоский

export class ViewScreen extends Overlay {
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

  render(view3d = false) {
    const currentId = view3d ? SOLID_ID : 'flat';
    const index = CONFIG.views.findIndex((v) => v.id === currentId);
    this.selected = index >= 0 ? index : 0;

    this.setContent(`
      <div class="panel panel--characters">
        <h2 class="title title--small">ВЫБЕРИ КАРТИНКУ</h2>
        <div class="heroes">
          ${CONFIG.views.map((spec, i) => this.renderCard(spec, i)).join('')}
        </div>
        <button class="btn btn--big" data-action="next">ДАЛЬШЕ ${icon('ui-play')}</button>
        <p class="hint">Дальше выберешь героя и оружие.
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

  renderCard(spec, index) {
    return `
      <div class="hero-card" data-index="${index}">
        ${Overlay.speakButton(describeView(spec))}
        <span class="weapon-choice__emoji">${icon(spec.icon)}</span>
        <span class="hero-card__name">${spec.name}</span>
        <span class="hero-card__perk">${spec.about}</span>
      </div>
    `;
  }

  move(delta) {
    const count = CONFIG.views.length;
    this.selected = (this.selected + delta + count) % count;
    this.highlight();
    this.onSpeak(describeView(CONFIG.views[this.selected]));
  }

  highlight() {
    this.root.querySelectorAll('.hero-card').forEach((el, i) => {
      el.classList.toggle('hero-card--selected', i === this.selected);
    });
  }

  confirm() {
    this.onPick(CONFIG.views[this.selected].id === SOLID_ID);
  }
}

