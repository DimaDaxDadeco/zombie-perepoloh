// Экран подтверждения для действий, которые нельзя отменить.
// Кнопка «нет» намеренно крупная и стоит первой: если ребёнок ткнёт наугад,
// он попадёт в безопасный вариант.

import { Overlay } from './overlay.js';
import { icon } from '../render/icons.js';

export class ConfirmScreen extends Overlay {
  constructor(rootId) {
    super(rootId);
    this.onConfirm = null;
    this.onCancel = null;

    // С клавиатуры и геймпада подтверждается безопасный вариант — отмена.
    // Необратимое действие делается только осознанным кликом.
    this.bindNavigation({
      onMove: () => {},
      onConfirm: () => this.onCancel?.(),
      onCancel: () => this.onCancel?.(),
    });
  }

  render({ title, icon: iconName, question, confirmText, cancelText, onConfirm, onCancel }) {
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;

    this.setContent(`
      <div class="panel panel--end">
        <h2 class="title title--small">${title}</h2>
        <div class="menu-hero">${icon(iconName)}</div>
        <p class="big-line">${question}</p>
        <button class="btn btn--big" data-action="cancel">${cancelText}</button>
        <button class="btn btn--danger" data-action="confirm">${confirmText}</button>
      </div>
    `);

    this.on('[data-action="cancel"]', () => this.onCancel?.());
    this.on('[data-action="confirm"]', () => this.onConfirm?.());
    this.show();
  }
}
