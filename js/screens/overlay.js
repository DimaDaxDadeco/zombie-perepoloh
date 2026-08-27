// Базовый класс экрана-оверлея.
// Игровой мир рисуется на canvas, а меню/карточки/магазин — обычный DOM:
// с ним проще делать крупные кликабельные кнопки и не изобретать вёрстку на canvas.

import { drawHero, drawZombie, drawBoss } from '../render/sprites.js';

export class Overlay {
  constructor(rootId) {
    this.root = document.getElementById(rootId) || Overlay.createRoot(rootId);
  }

  // Если элемента в разметке нет — создаём его сами. Это страхует от
  // закешированного браузером index.html при добавлении новых экранов:
  // игра не должна падать целиком из-за отсутствия одного контейнера.
  static createRoot(rootId) {
    const el = document.createElement('div');
    el.id = rootId;
    el.className = 'overlay hidden';
    document.body.appendChild(el);
    return el;
  }

  // Все созданные оверлеи — нужен реестр, чтобы Game знал, кому отдавать
  // нажатия, не перечисляя экраны руками.
  static registry = new Set();

  // Экран объявляет, что умеет навигацию. Кто именно нажал — стрелка,
  // крестовина геймпада или палец — экран не знает и знать не должен:
  // раньше каждый экран сам слушал keydown, и добавление геймпада означало
  // бы пятую копию одного и того же блока.
  bindNavigation({ onMove, onConfirm, onCancel } = {}) {
    this.nav = { onMove, onConfirm, onCancel };
    Overlay.registry.add(this);
  }

  // Видимый экран, умеющий навигацию. Их всегда не больше одного.
  static activeNav() {
    for (const screen of Overlay.registry) {
      if (screen.isVisible && screen.nav) return screen;
    }
    return null;
  }

  show() {
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
  }

  get isVisible() {
    return !this.root.classList.contains('hidden');
  }

  // Полностью перерисовывает содержимое оверлея.
  setContent(html) {
    this.root.innerHTML = html;
  }

  // Навешивает обработчик клика на элемент внутри оверлея.
  on(selector, handler) {
    const el = this.root.querySelector(selector);
    if (el) el.addEventListener('click', handler);
  }

  onAll(selector, handler) {
    this.root.querySelectorAll(selector).forEach((el, index) => {
      el.addEventListener('click', () => handler(el, index));
    });
  }

  // Рисует выбранного героя на маленьком canvas. Общий хелпер: героя показывают
  // меню, экран выбора и экран победы, и рисовать его надо всюду одинаково —
  // той же функцией, что и персонажа в бою.
  static paintHero(canvas, look) {
    if (!canvas || !look) return;
    const ctx = canvas.getContext('2d');
    const radius = canvas.width * 0.26;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2 + radius * 0.7);
    drawHero(ctx, { radius, walkPhase: 0, facing: 1, blinking: false, look });
    ctx.restore();
  }

  // Наклейки альбома рисуются тем же кодом, что зомби и боссы в бою.
  static paintZombie(canvas, look, options) {
    paintSticker(canvas, options, (ctx, radius) => drawZombie(ctx, {
      radius, walkPhase: 0, facing: 1, hurtFlash: false, look,
    }));
  }

  static paintBoss(canvas, look, options) {
    paintSticker(canvas, options, (ctx, radius) => drawBoss(ctx, {
      radius, walkPhase: 0, facing: 1, hurtFlash: false, look,
    }), 0.3);
  }

  // Кнопка-динамик: ребёнок не читает, поэтому любую подпись можно послушать.
  // Возвращает разметку; обработчики вешает bindSpeakButtons().
  static speakButton(text) {
    return `<span class="speak" data-speak="${escapeAttribute(text)}" title="Послушать">🔈</span>`;
  }

  // Клик по динамику не должен выбирать карточку, на которой он стоит.
  bindSpeakButtons(onSpeak) {
    this.root.querySelectorAll('.speak').forEach((el) => {
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        onSpeak(el.dataset.speak);
      });
    });
  }
}

// Общая часть наклейки. Тень не рисуем: под наклейкой нет земли, а в силуэте
// тень превращается в непонятное пятно.
function paintSticker(canvas, { locked = false } = {}, paint, scale = 0.24) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const radius = canvas.width * scale;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2 + radius * 0.7);
  paint(ctx, radius);
  ctx.restore();

  if (!locked) return;
  // Силуэт — не второй спрайт, а заливка поверх нарисованного:
  // source-atop красит только уже нарисованные пиксели, поэтому контур точен
  // вместе с каскеткой, тросточкой и хвостом.
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = '#2a2750';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function escapeAttribute(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
