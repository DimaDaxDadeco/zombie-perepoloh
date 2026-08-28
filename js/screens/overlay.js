// Базовый класс экрана-оверлея.
// Игровой мир рисуется на canvas, а меню/карточки/магазин — обычный DOM:
// с ним проще делать крупные кликабельные кнопки и не изобретать вёрстку на canvas.

import { CONFIG } from '../config.js';
import { drawHero, drawZombie, drawBoss } from '../render/sprites.js';

// Чей это выбор. Цвет — тот же, что кольцо у ног героя в бою. Живёт здесь, а
// не в characters.js: подпись нужна всем трём экранам выбора, а импорт из
// characters.js в базовый класс замкнул бы цикл.
export function playerTitle(index, total) {
  if (total < 2) return '';
  const color = CONFIG.coop.colors[index % CONFIG.coop.colors.length];
  return `<span style="color:${color}">ИГРОК ${index + 1}</span>`;
}

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
  //
  // perPlayer означает «экран показывает по окну на игрока и слушает всех
  // одновременно»: onMove и onConfirm тогда получают ещё и индекс игрока.
  // Экраны без него (пауза, магазин, альбом, итоги) работают как раньше.
  bindNavigation({ onMove, onConfirm, onCancel, perPlayer = false } = {}) {
    this.nav = { onMove, onConfirm, onCancel, perPlayer };
    Overlay.registry.add(this);
  }

  // --- Одновременный выбор вдвоём ---
  //
  // Три экрана выбора — герой, оружие и карточки прокачки — устроены
  // одинаково: список карточек, у каждого игрока свой курсор и своя галочка
  // «готов». Раньше они ходили по очереди, и очередь жила в Game. Теперь
  // ожидание держит сам экран, а Game получает готовый результат разом —
  // так три экрана физически не могут разойтись в мелочах.
  startPicking(total, startIndex = () => 0) {
    this.total = total;
    this.picks = Array.from({ length: total }, (_, i) => ({
      selected: startIndex(i),
      confirmed: false,
    }));
  }

  // Возвращает новый индекс или null, если листать нельзя (уже выбрал).
  movePick(playerIndex, delta, count) {
    const pick = this.picks?.[playerIndex];
    if (!pick || pick.confirmed) return null;
    pick.selected = (pick.selected + delta + count) % count;
    return pick.selected;
  }

  // Отмечает игрока готовым. Возвращает массив выбранных индексов, когда
  // готовы ВСЕ, и null, пока кто-то ещё думает.
  confirmPick(playerIndex) {
    const pick = this.picks?.[playerIndex];
    if (!pick || pick.confirmed) return null;
    pick.confirmed = true;
    this.column(playerIndex)?.classList.add('picker__column--ready');
    return this.picks.every((p) => p.confirmed) ? this.picks.map((p) => p.selected) : null;
  }

  column(playerIndex) {
    return this.root.querySelector(`.picker__column[data-player="${playerIndex}"]`);
  }

  // Колонки: одна на игрока. При одном игроке колонка одна и без заголовка —
  // экран выглядит и работает ровно как раньше.
  pickerColumns(renderInner) {
    const duo = this.total > 1;
    return `<div class="picker${duo ? ' picker--duo' : ''}">
      ${this.picks.map((_, i) => `
        <div class="picker__column" data-player="${i}">
          ${duo ? `<div class="picker__who">${playerTitle(i, this.total)}</div>` : ''}
          ${renderInner(i)}
          ${duo ? '<div class="picker__ready">ГОТОВ ✓</div>' : ''}
        </div>`).join('')}
    </div>`;
  }

  // Подсветка курсора в колонке игрока.
  highlightIn(playerIndex, selector, selectedClass) {
    const column = this.column(playerIndex);
    if (!column) return;
    const chosen = this.picks[playerIndex].selected;
    column.querySelectorAll(selector).forEach((el, i) => {
      el.classList.toggle(selectedClass, i === chosen);
    });
  }

  // Клик по карточке: работает за того игрока, в чьей колонке кликнули.
  onCards(selector, handler) {
    this.root.querySelectorAll('.picker__column').forEach((column) => {
      const owner = Number(column.dataset.player);
      column.querySelectorAll(selector).forEach((el, index) => {
        el.addEventListener('click', () => handler(owner, index));
      });
    });
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
