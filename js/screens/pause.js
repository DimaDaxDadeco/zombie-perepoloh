// Пауза по Esc. Одна большая кнопка «Продолжить» — чтобы случайное
// нажатие не выбило ребёнка из игры.
// Заодно показываем собранное оружие: каждое можно послушать голосом.
//
// Здесь же переключатель объёмного режима (docs/render3d.md). Именно на
// паузе, а не в меню: меню держит ровно две большие кнопки, и третья читалась
// бы как «ещё один способ играть». А на паузе ребёнок уже видит поле и сразу
// замечает, что с ним стало.

import { CONFIG } from '../config.js';
import { Overlay } from './overlay.js';
import { icon } from '../render/icons.js';

export class PauseScreen extends Overlay {
  constructor(rootId, { onResume, onMenu, onToggleView, onSpeak }) {
    super(rootId);
    this.onResume = onResume;
    this.onMenu = onMenu;
    this.onToggleView = onToggleView;
    this.onSpeak = onSpeak;

    // На паузе безопасное действие одно — продолжить. И confirm, и back
    // ведут туда же: ребёнок не должен случайно выйти в меню.
    this.bindNavigation({
      onMove: () => {},
      onConfirm: () => this.onResume(),
      onCancel: () => this.onResume(),
    });
  }

  render(weapons = [], view3d = false) {
    this.setContent(`
      <div class="panel panel--end">
        <h2 class="title title--small">ПАУЗА</h2>
        ${weapons.length ? this.renderWeapons(weapons) : `<div class="menu-hero">${icon('ui-pause')}</div>`}
        <button class="btn btn--big" data-action="resume">ПРОДОЛЖИТЬ ${icon('ui-play')}</button>
        <button class="btn btn--secondary" data-action="view">
          ${icon('ui-cube')} Объём: ${view3d ? 'да' : 'нет'}
        </button>
        <button class="btn btn--secondary" data-action="menu">${icon('ui-home')} В меню</button>
      </div>
    `);
    this.on('[data-action="resume"]', this.onResume);
    this.on('[data-action="view"]', this.onToggleView);
    this.on('[data-action="menu"]', this.onMenu);
    this.bindSpeakButtons(this.onSpeak);
    this.show();
  }

  renderWeapons(weapons) {
    const items = weapons.map((weapon) => `
      <div class="weapon-chip">
        ${Overlay.speakButton(describeWeapon(weapon))}
        <span class="weapon-chip__emoji">${icon(weapon.icon)}</span>
        <span class="weapon-chip__stars">
          ${icon('ui-star').repeat(weapon.stars)}${icon('ui-star-empty').repeat(CONFIG.maxStars - weapon.stars)}
        </span>
      </div>
    `).join('');

    return `
      <p class="big-line">Твоё оружие:</p>
      <div class="weapon-chips">${items}</div>
      <p class="hint">Нажми ${icon('ui-speak')}, чтобы послушать название</p>
    `;
  }
}

function describeWeapon(weapon) {
  return `${weapon.name}, ${weapon.stars} ${starWord(weapon.stars)}`;
}

function starWord(count) {
  if (count === 1) return 'звезда';
  if (count >= 2 && count <= 4) return 'звезды';
  return 'звёзд';
}
