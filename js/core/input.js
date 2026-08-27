// Ввод: клавиатура и геймпад.
//
// Всё сведено к понятию «источник ввода» — у каждого одинаковые isDown() и
// wasPressed(), поэтому игре всё равно, чем именно играют. Источников может
// быть несколько: два комплекта клавиш (для игры вдвоём) и по одному на
// каждый подключённый геймпад.
//
// Клавиатура намеренно приведена к ОПРОСНОЙ модели, как геймпад: keydown
// только наполняет множество нажатого, а «нажали кнопку» вычисляется в одном
// месте — Input.poll(). Иначе пришлось бы держать два разных понятия нажатия
// и дублировать всю маршрутизацию. Задержка при этом ровно один кадр.

import { CONFIG } from '../config.js';

// Имена кнопок общие для всех источников: up/down/left/right, ability, pause,
// confirm, back. Движение и навигация по меню — одни и те же четыре
// направления: стрелка влево и листает карточки, и ведёт героя.

export class InputSource {
  constructor(id, kind) {
    this.id = id;
    this.kind = kind;      // 'keyboard' | 'gamepad' | 'touch'
    this.down = new Set();
    this.prev = new Set();
    this.stick = { x: 0, y: 0 };  // аналоговое направление, если источник умеет
  }

  poll() {}

  // Фиксация кадра. Вызывается ПОСЛЕ разбора нажатий — иначе фронт будет
  // стёрт до того, как его успеют прочитать.
  endFrame() {
    this.prev = new Set(this.down);
  }

  isDown(name) {
    return this.down.has(name);
  }

  // Фронт нажатия: было отпущено, стало нажато. Единственный способ спросить
  // «нажали кнопку» — одинаковый и для опросного геймпада, и для клавиатуры.
  wasPressed(name) {
    return this.down.has(name) && !this.prev.has(name);
  }

  release() {
    this.down.clear();
    this.stick = { x: 0, y: 0 };
  }

  get connected() {
    return true;
  }

  // Нормализованный вектор движения.
  getDirection() {
    if (this.stick.x !== 0 || this.stick.y !== 0) return this.stick;
    return dpadVector(this.down);
  }
}

// Четыре направления → единичный вектор. Общее для клавиш и крестовины.
function dpadVector(down) {
  let x = 0, y = 0;
  if (down.has('left')) x -= 1;
  if (down.has('right')) x += 1;
  if (down.has('up')) y -= 1;
  if (down.has('down')) y += 1;
  if (x !== 0 && y !== 0) {
    const len = Math.hypot(x, y);
    x /= len; y /= len;
  }
  return { x, y };
}

// Комплект клавиш. keymap: { KeyCode: buttonName }.
export class KeyboardSource extends InputSource {
  constructor(id, keymap) {
    super(id, 'keyboard');
    this.keymap = keymap;
  }

  handleKey(code, isDown) {
    const button = this.keymap[code];
    if (!button) return false;
    if (isDown) this.down.add(button);
    else this.down.delete(button);
    return true;
  }
}

// Один геймпад. Держим только индекс: Chrome возвращает НОВЫЙ объект Gamepad
// на каждый вызов getGamepads(), поэтому сам объект кэшировать нельзя.
export class GamepadSource extends InputSource {
  constructor(index) {
    super(`gamepad${index}`, 'gamepad');
    this.index = index;
    this.pad = null;
  }

  get connected() {
    return Boolean(this.pad);
  }

  poll(pads) {
    const pad = pads[this.index];
    this.pad = pad || null;
    if (!pad) {
      this.release();
      return;
    }

    const { buttons: map, stickDeadzone } = CONFIG.input.gamepad;
    this.down.clear();
    for (const [button, indices] of Object.entries(map)) {
      if (indices.some((i) => pad.buttons[i]?.pressed)) this.down.add(button);
    }

    // Крестовина и стик складываются в одно направление, но крестовина
    // побеждает: она дискретная и потому точнее.
    const dpad = dpadVector(this.down);
    if (dpad.x !== 0 || dpad.y !== 0) {
      this.stick = dpad;
      return;
    }

    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    const len = Math.hypot(ax, ay);
    if (len < stickDeadzone) {
      this.stick = { x: 0, y: 0 };
      return;
    }
    // Нормализуем в единичный вектор, а не отдаём аналоговую величину:
    // пятилетний полраунда проползёт на четверти отклонения стика и решит,
    // что герой сломался. Предсказуемость важнее нюанса.
    this.stick = CONFIG.input.analogSpeed
      ? { x: ax, y: ay }
      : { x: ax / len, y: ay / len };
  }
}

export class Input {
  constructor() {
    this.keyboards = [
      new KeyboardSource('keys1', CONFIG.input.keyboard1),
      new KeyboardSource('keys2', CONFIG.input.keyboard2),
    ];
    this.gamepads = [];
    this.extra = [];      // тач-контролы регистрируются снаружи
    this.playerCount = 1; // сколько человек играет; выставляет Game

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return; // автоповтор не нужен: экраны листаются по одному
      let handled = false;
      for (const source of this.keyboards) {
        if (source.handleKey(e.code, true)) handled = true;
      }
      // preventDefault нельзя отложить на кадр — он обязан произойти прямо в
      // обработчике, иначе пробел прокрутит страницу и «нажмёт» кнопку,
      // оставшуюся в фокусе после меню.
      if (handled) e.preventDefault();
    });

    window.addEventListener('keyup', (e) => {
      for (const source of this.keyboards) source.handleKey(e.code, false);
    });

    // Окно потеряло фокус — отпускаем всё, герой не должен убегать сам.
    window.addEventListener('blur', () => {
      for (const source of this.sources) source.release();
    });
  }

  get sources() {
    return [...this.keyboards, ...this.gamepads, ...this.extra];
  }

  // Источники, которыми сейчас можно листать меню. С owner — только те, что
  // принадлежат этому игроку: так второй не может выбрать за первого, пока
  // идёт его очередь.
  menuSources(owner = null) {
    if (owner === null) return this.sources.filter((s) => s.connected);
    return this.sourcesFor(owner);
  }

  add(source) {
    this.extra.push(source);
  }

  poll() {
    const pads = navigator.getGamepads?.() || [];
    // Заводим источник на каждый новый индекс прямо здесь, а не по событию
    // gamepadconnected: событие может не прийти, если геймпад «проснулся» от
    // нажатия кнопки уже во время игры.
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && !this.gamepads.some((g) => g.index === i)) {
        this.gamepads.push(new GamepadSource(i));
      }
    }
    for (const source of this.sources) source.poll(pads);
  }

  endFrame() {
    for (const source of this.sources) source.endFrame();
  }

  // Любой источник нажал кнопку — нужно для паузы, которая глобальна.
  anyPressed(button) {
    return this.sources.some((s) => s.connected && s.wasPressed(button));
  }

  get gamepadCount() {
    return this.gamepads.filter((g) => g.connected).length;
  }

  // Источник управления героем. Пока игрок один — это клавиши-стрелки плюс
  // всё, что даёт направление (геймпад, тач): ребёнок может взять любой.
  getDirection(playerIndex = 0) {
    for (const source of this.sourcesFor(playerIndex)) {
      const dir = source.getDirection();
      if (dir.x !== 0 || dir.y !== 0) return dir;
    }
    return { x: 0, y: 0 };
  }

  abilityPressed(playerIndex = 0) {
    return this.sourcesFor(playerIndex).some((s) => s.wasPressed('ability'));
  }

  // Кому принадлежит какой источник.
  //
  // Один игрок: все источники его — ребёнок может взять что угодно.
  // Двое: первому стрелки, второму WASD, а геймпады раздаются по порядку —
  // с одним геймпадом играет второй, потому что первому остаётся клавиатура.
  sourcesFor(playerIndex = 0) {
    const connected = this.sources.filter((s) => s.connected);
    if (this.playerCount < 2) return playerIndex === 0 ? connected : [];

    const pads = this.gamepads.filter((g) => g.connected);
    const own = [this.keyboards[playerIndex]];
    if (pads.length === 1) {
      if (playerIndex === 1) own.push(pads[0]);
    } else if (pads[playerIndex]) {
      own.push(pads[playerIndex]);
    }
    // Тач-контролы всегда у первого: на планшете играют по одному.
    if (playerIndex === 0) own.push(...this.extra.filter((s) => s.connected));
    return own.filter((s) => s && s.connected);
  }
}
