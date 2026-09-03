// Управление на планшете: палец ведёт героя, плюс кнопка способности.
//
// Модель простая до предела: где палец — туда герой и идёт. Не джойстик со
// смещением от точки касания: ребёнок прижимает палец и держит, не ведя им,
// и смещение остаётся нулевым — герой стоит. Именно так и было, и именно на
// это жаловались. Здесь же неподвижный палец продолжает вести героя, потому
// что направление считается каждый кадр заново от его текущей позиции.
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
import { icon } from '../render/icons.js';

// Источник ввода, который наполняется пальцами. Для игры он неотличим от
// клавиатуры и геймпада — тот же InputSource.
class TouchSource extends InputSource {
  constructor() {
    super('touch', 'touch');
    this.active = false;
    this.target = null;      // куда указывает палец, в координатах арены
  }

  get connected() {
    return this.active;
  }

  // Единственный источник, которому важно, кто спрашивает: направление тут
  // не абсолютное, а «от героя к пальцу».
  getDirection(from) {
    if (!this.target || !from) return { x: 0, y: 0 };
    const dx = this.target.x - from.x;
    const dy = this.target.y - from.y;
    const dist = Math.hypot(dx, dy);
    // Дошёл — стоит. Без этого герой дрожал бы вокруг пальца, перешагивая
    // цель туда-сюда каждый кадр.
    if (dist < CONFIG.input.touch.arrivalRadius) return { x: 0, y: 0 };
    return { x: dx / dist, y: dy / dist };
  }

  // Цель обязана уходить вместе с нажатиями: иначе после потери фокуса или
  // паузы герой продолжит бежать к последней точке сам.
  release() {
    super.release();
    this.target = null;
  }
}

export class TouchControls {
  constructor({ onPause }) {
    this.source = new TouchSource();
    this.onPause = onPause;
    this.moveId = null;      // pointerId ведущего пальца
    this.abilityId = null;   // и пальца на кнопке способности

    this.root = document.getElementById('touch-controls') || this.createRoot();
    this.field = this.root.querySelector('#touch-field');
    this.marker = this.root.querySelector('#touch-marker');
    this.button = this.root.querySelector('#touch-ability');
    // Значок по умолчанию ставим здесь: в index.html кнопка пустая (иначе там
    // пришлось бы держать эмодзи), а setAbility зовётся только в бою.
    this.abilityIcon = null;
    this.setAbility({});

    this.bindField();
    this.bindButton();
  }

  createRoot() {
    const el = document.createElement('div');
    el.id = 'touch-controls';
    el.className = 'hidden';
    el.innerHTML = `
      <div id="touch-field"><div id="touch-marker"></div></div>
      <button id="touch-ability" type="button">${icon('ui-spark')}</button>
    `;
    document.body.appendChild(el);
    return el;
  }

  // Тач-режим определяется в два шага: сначала догадка по типу указателя,
  // дальше — по факту. Одного `pointer: coarse` мало: ноутбук с сенсорным
  // экраном тоже «coarse», и контролы вылезли бы на десктопе.
  static watchTouchMode(onChange) {
    const guess = window.matchMedia('(pointer: coarse)').matches;
    onChange(guess);
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') onChange(true);
    });
    window.addEventListener('keydown', () => onChange(false));
    window.addEventListener('gamepadconnected', () => onChange(false));
  }

  // Ведущая зона — весь экран: ребёнок тычет туда, куда смотрит, а не в
  // отведённый ему угол. Кнопки звука и паузы остаются нажимаемыми: у них
  // z-index выше, чем у контролов.
  bindField() {
    const zone = this.field;
    const track = (e) => {
      this.source.target = this.toArena(e.clientX, e.clientY);
      this.moveMarker(e.clientX, e.clientY);
    };

    zone.addEventListener('pointerdown', (e) => {
      if (this.moveId !== null) return;   // ведёт первый палец, остальные ждут
      this.moveId = e.pointerId;
      capture(zone, e.pointerId);         // палец наш до конца жеста
      track(e);
      this.marker.classList.add('visible');
    });

    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.moveId) return;
      track(e);
    });

    const end = (e) => {
      if (e.pointerId !== this.moveId) return;
      this.moveId = null;
      this.source.target = null;
      this.marker.classList.remove('visible');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  // Палец → координаты арены. Арена живёт в CSS-пикселях (Game.resize кладёт
  // туда innerWidth/innerHeight), а devicePixelRatio учтён только в
  // ctx.setTransform — поэтому домножать на него здесь НЕЛЬЗЯ, это ровно та
  // ошибка, ради которой контролы и сделаны на DOM.
  toArena(clientX, clientY) {
    const rect = this.field.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  // Метка под пальцем: ребёнок видит, куда тянет. Заодно она объясняет, почему
  // герой останавливается рядом, а не под пальцем, — иначе палец просто
  // закрывал бы героя, и было бы непонятно, дошёл он или застрял.
  moveMarker(clientX, clientY) {
    this.marker.style.left = `${clientX}px`;
    this.marker.style.top = `${clientY}px`;
  }

  // Кнопка держит свой pointerId: без захвата второй палец, ткнувший в неё,
  // перехватил бы ведущий, и герой замер бы посреди боя.
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

  // Показываем только в бою: во время паузы палец не должен вести героя.
  setVisible(on) {
    this.root.classList.toggle('hidden', !on);
    if (!on) {
      this.source.release();
      this.moveId = null;
      this.abilityId = null;
      this.marker.classList.remove('visible');
    }
  }

  // Кнопка показывает значок способности героя и наливается цветом, когда
  // та готова. Сейчас о готовности сообщает только шкала в углу — на планшете
  // палец и так лежит на кнопке, и подсветка попадает прямо в поле зрения.
  //
  // Сравниваем ИМЯ значка, а не разметку: метод зовётся каждый кадр, и
  // сличать на каждом кадре строку с целым svg внутри — пустая работа.
  setAbility({ icon: iconName, color, ready }) {
    const next = iconName || 'ui-spark';
    if (this.abilityIcon !== next) {
      this.abilityIcon = next;
      this.button.innerHTML = icon(next);
    }
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
