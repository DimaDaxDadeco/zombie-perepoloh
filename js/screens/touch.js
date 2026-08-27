// Управление на планшете: виртуальный джойстик и кнопка способности.
//
// Сделано обычным DOM, а не рисованием на canvas. Причины:
//   - зона захвата пальца обязана совпадать с картинкой пиксель-в-пиксель, а
//     на canvas это две системы координат (события в CSS-пикселях, отрисовка
//     в devicePixelRatio-пикселях) — ровно тот класс багов, который вылезает
//     только на планшете и только у ребёнка;
//   - нужны setPointerCapture, touch-action: none и safe-area-inset — это
//     свойства DOM-элемента, у canvas их нет.
//
// Контролы не трясутся вместе с миром: они интерфейс, ровно как HUD.

import { CONFIG } from '../config.js';
import { InputSource } from '../core/input.js';

// Источник ввода, который наполняется пальцами. Для игры он неотличим от
// клавиатуры и геймпада — тот же InputSource.
class TouchSource extends InputSource {
  constructor() {
    super('touch', 'touch');
    this.active = false;
  }

  get connected() {
    return this.active;
  }
}

export class TouchControls {
  constructor({ onPause }) {
    this.source = new TouchSource();
    this.onPause = onPause;
    this.stickId = null;     // pointerId пальца на джойстике
    this.abilityId = null;   // и на кнопке способности

    this.root = document.getElementById('touch-controls') || this.createRoot();
    this.stick = this.root.querySelector('#touch-stick');
    this.knob = this.root.querySelector('#touch-knob');
    this.button = this.root.querySelector('#touch-ability');

    this.bindStick();
    this.bindButton();
  }

  createRoot() {
    const el = document.createElement('div');
    el.id = 'touch-controls';
    el.className = 'hidden';
    el.innerHTML = `
      <div id="touch-stick"><div id="touch-knob"></div></div>
      <button id="touch-ability" type="button">✨</button>
    `;
    document.body.appendChild(el);
    return el;
  }

  // Тач-режим определяется в два шага: сначала догадка по типу указателя,
  // дальше — по факту. Одного `pointer: coarse` мало: ноутбук с сенсорным
  // экраном тоже «coarse», и джойстик вылез бы на десктопе.
  static watchTouchMode(onChange) {
    const guess = window.matchMedia('(pointer: coarse)').matches;
    onChange(guess);
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') onChange(true);
    });
    window.addEventListener('keydown', () => onChange(false));
    window.addEventListener('gamepadconnected', () => onChange(false));
  }

  // Джойстик плавающий: палец ставится куда придётся в левой половине экрана,
  // и стик появляется там. Целиться пальцем в нарисованный кружок ребёнок не
  // должен — он смотрит на героя, а не на свою руку.
  bindStick() {
    const zone = this.stick;
    zone.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null) return;
      this.stickId = e.pointerId;
      capture(zone, e.pointerId);            // палец наш до конца жеста
      this.origin = { x: e.clientX, y: e.clientY };
      this.moveKnob(0, 0);
      this.knob.classList.add('visible');
    });

    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      const { stickRadius, deadzone } = CONFIG.input.touch;
      let dx = e.clientX - this.origin.x;
      let dy = e.clientY - this.origin.y;
      const dist = Math.hypot(dx, dy);
      if (dist > stickRadius) {
        dx = (dx / dist) * stickRadius;
        dy = (dy / dist) * stickRadius;
      }
      this.moveKnob(dx, dy);
      // Нормируем по УЖЕ обрезанному вектору: если делить на исходную длину,
      // за пределами радиуса стик отдаёт меньше единицы, и герой замедляется
      // ровно там, где палец отведён до упора.
      const len = Math.hypot(dx, dy) || 1;
      this.source.stick = dist / stickRadius < deadzone
        ? { x: 0, y: 0 }
        : { x: dx / len, y: dy / len };
    });

    const end = (e) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.source.stick = { x: 0, y: 0 };
      this.knob.classList.remove('visible');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  moveKnob(dx, dy) {
    const { x, y } = this.origin;
    this.knob.style.left = `${x + dx}px`;
    this.knob.style.top = `${y + dy}px`;
  }

  // Кнопка держит свой pointerId: без захвата второй палец, ткнувший в неё,
  // перехватил бы джойстик, и герой замер бы посреди боя.
  bindButton() {
    this.button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.abilityId = e.pointerId;
      capture(this.button, e.pointerId);
      this.source.down.add('ability');
    });
    const end = (e) => {
      if (e.pointerId !== this.abilityId) return;
      this.abilityId = null;
      this.source.down.delete('ability');
    };
    this.button.addEventListener('pointerup', end);
    this.button.addEventListener('pointercancel', end);
  }

  setEnabled(on) {
    this.source.active = on;
    if (!on) this.setVisible(false);
  }

  // Показываем только в бою: во время паузы палец не должен ловить стик.
  setVisible(on) {
    this.root.classList.toggle('hidden', !on);
    if (!on) {
      this.source.release();
      this.stickId = null;
      this.abilityId = null;
      this.knob.classList.remove('visible');
    }
  }

  // Кнопка показывает эмодзи способности героя и наливается цветом, когда
  // та готова. Сейчас о готовности сообщает только шкала в углу — на планшете
  // палец и так лежит на кнопке, и подсветка попадает прямо в поле зрения.
  setAbility({ emoji, color, ready }) {
    if (this.button.textContent !== emoji) this.button.textContent = emoji || '✨';
    this.button.classList.toggle('ready', Boolean(ready));
    if (color) this.button.style.setProperty('--ability-color', color);
  }
}

// Захват пальца не должен ронять обработчик: браузер бросает NotFoundError,
// если указателя с таким id уже нет (палец подняли между событиями). Сам жест
// при этом отработает и без захвата.
function capture(element, pointerId) {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Захват — оптимизация, а не обязательное условие.
  }
}
