// Голос игры: очередь фраз с приоритетами над двумя бэкендами — записанными
// файлами (core/voice-bank.js) и синтезом речи (core/speech.js).
//
// ЗАЧЕМ ОЧЕРЕДЬ. Раньше speak() всегда прерывал предыдущую фразу, и это
// прорастало в игру тремя компромиссами: кадр истории приходилось держать в
// одну строку, из нескольких новых медалей объявлялась только первая, а задача
// главы вытесняла объявление особого раунда. Все три снимаются здесь.
//
// Правило приоритетов простое: объявление важнее подписи, а осознанное нажатие
// на динамик важнее автоозвучки при прокрутке.

import { WAIT_MS } from './voice-bank.js';
import { normalizeVoice } from './voice-text.js';

export const Priority = {
  LABEL: 0,    // подпись под курсором — читается сама при прокрутке
  USER: 1,     // ребёнок нажал динамик
  ANNOUNCE: 2, // медаль, задача главы, особый раунд, эволюция, похвала
  ALERT: 3,    // босс: важнее всего, что вообще есть
};

const QUEUE_MAX = 4;

// Прокрутка стрелками: озвучивается та карточка, на которой ребёнок
// остановился, а не все одиннадцать по дороге.
const DEBOUNCE_MS = 180;

// Приглушение снимается не сразу: между связанными строками истории и двумя
// медалями подряд оно иначе мигало бы.
const UNDUCK_HOLD = 150;

// Бюджет реплик за раунд. Переговорить для пятилетнего — такой же отказ, как
// промолчать, и потолок здесь именно поэтому.
const REACTIONS_PER_ROUND = 3;

// Минимальный зазор между любыми двумя реплаками — чтобы похвала и
// предупреждение не наложились. Маленький нарочно: общий кулдаун в полминуты
// проглотил бы «одно сердечко», а это самое важное, что голос вообще говорит
// в бою. Сдержанность обеспечивают потолок за раунд и кулдаун каждой реплики
// по отдельности.
const REACTION_GAP = 6;

export class Voice {
  constructor({ audio, speech, bank, enabled }) {
    this.audio = audio;
    this.speech = speech;
    this.bank = bank;
    this.enabled = enabled;

    this.queue = [];
    this.playing = null;
    this.token = 0;
    this.ducked = false;
    this.debounce = null;
    this.unduckTimer = null;
    this.reacted = new Map(); // id реакции -> { at, times }
    this.roundReactions = 0;
    this.lastReaction = -Infinity;
  }

  setEnabled(on) {
    this.enabled = on;
    this.speech.setEnabled(on);
    if (!on) this.stop();
  }

  prefetch(texts) {
    this.bank.prefetch(texts);
  }

  // --- Публичные входы ---

  // Подпись карточки. source: 'button' — это нажатие на динамик, и его нельзя
  // проглатывать: возможность послушать любую подпись и есть главное обещание
  // игры нечитающему ребёнку.
  label(text, { source = 'move' } = {}) {
    this.push(text, source === 'button' ? Priority.USER : Priority.LABEL, { debounce: source !== 'button' });
  }

  announce(text) {
    this.push(text, Priority.ANNOUNCE);
  }

  alert(text) {
    this.push(text, Priority.ALERT);
  }

  // Несколько фраз подряд: следующая начинается, когда договорена предыдущая.
  script(lines, onDone = null) {
    const clean = (lines || []).filter(Boolean);
    if (!clean.length) {
      onDone?.();
      return;
    }
    clean.forEach((line, i) => {
      this.push(line, Priority.ANNOUNCE, { onDone: i === clean.length - 1 ? onDone : null });
    });
  }

  // Похвала и предупреждения в бою. Молча пропускает, если рано.
  //
  // times — сколько раз за раунд эта реплика может прозвучать; cooldown — через
  // сколько секунд она может повториться. Плюс два общих ограничения:
  // REACTIONS_PER_ROUND на все реплики и REACTION_GAP между любыми двумя.
  react(id, text, { cooldown = 30, oncePerRound = false, times = Infinity, delay = 0 } = {}) {
    const now = performance.now() / 1000;
    const limit = oncePerRound ? 1 : times;
    const seen = this.reacted.get(id) || { at: -Infinity, times: 0 };
    if (seen.times >= limit) return;
    if (now - seen.at < cooldown) return;
    if (this.roundReactions >= REACTIONS_PER_ROUND) return;
    if (now - this.lastReaction < REACTION_GAP) return;
    this.reacted.set(id, { at: now, times: seen.times + 1 });
    this.roundReactions += 1;
    this.lastReaction = now;
    // Задержка нужна там, где реакция иначе легла бы поверх собственного
    // звука события: «минус сердечко» должно сначала прозвучать, а потом уже
    // быть названо словами.
    if (delay > 0) setTimeout(() => this.announce(text), delay * 1000);
    else this.announce(text);
  }

  // Новый раунд — реакции снова разрешены.
  resetReactions() {
    this.reacted.clear();
    this.roundReactions = 0;
    this.lastReaction = -Infinity;
  }

  stop() {
    if (this.debounce) {
      clearTimeout(this.debounce);
      this.debounce = null;
    }
    this.token += 1;
    const dropped = this.queue.splice(0);
    this.playing = null;
    for (const item of dropped) item.onDone?.();
    this.speech.stop();
    this.audio.stopVoice();
    this.unduck(true);
  }

  // --- Очередь ---

  push(rawText, priority, { debounce = false, onDone = null } = {}) {
    if (!this.enabled) {
      onDone?.();
      return;
    }
    const text = normalizeVoice(rawText);
    if (!text) {
      onDone?.();
      return;
    }
    if (debounce) {
      if (this.debounce) clearTimeout(this.debounce);
      this.debounce = setTimeout(() => {
        this.debounce = null;
        this.enqueue(text, priority, onDone);
      }, DEBOUNCE_MS);
      return;
    }
    if (this.debounce) {
      // Пришло что-то важнее прокрутки — отложенная подпись уже не нужна.
      clearTimeout(this.debounce);
      this.debounce = null;
    }
    this.enqueue(text, priority, onDone);
  }

  enqueue(text, priority, onDone) {
    // Та же фраза уже звучит — второй раз незачем: экраны зовут озвучку и на
    // движении курсора, и на клике.
    if (this.playing?.text === text) {
      onDone?.();
      return;
    }
    const busy = this.playing?.priority ?? -1;
    const queued = this.queue.reduce((max, item) => Math.max(max, item.priority), -1);
    // Подпись во время объявления ОТБРАСЫВАЕМ, а не копим: к концу объявления
    // ребёнок уже пролистал дальше, и услышать он должен то, где стоит сейчас,
    // а не где стоял пять секунд назад.
    if (priority === Priority.LABEL && Math.max(busy, queued) >= Priority.ANNOUNCE) {
      onDone?.();
      return;
    }
    if (priority >= Priority.ANNOUNCE) {
      // Подписи из очереди выметаем, но их onDone всё равно зовём: иначе
      // цепочка, ждущая «договорил», зависла бы вместе с музыкой.
      const dropped = this.queue.filter((item) => item.priority < Priority.ANNOUNCE);
      this.queue = this.queue.filter((item) => item.priority >= Priority.ANNOUNCE);
      for (const item of dropped) item.onDone?.();
    }
    this.queue.push({ text, priority, onDone });
    if (this.queue.length > QUEUE_MAX) {
      // Выбрасываем самый низкий и самый старый.
      let worst = 0;
      this.queue.forEach((item, i) => {
        if (item.priority < this.queue[worst].priority) worst = i;
      });
      this.queue.splice(worst, 1)[0].onDone?.();
    }

    // Прерывать играющее можно только более важным. Подпись сменяет подпись —
    // это и есть прокрутка; объявление сменяет подпись; босс сменяет всё.
    if (!this.playing || priority > this.playing.priority
      || (priority === this.playing.priority && priority <= Priority.USER)) {
      this.interrupt();
    }
    this.drain();
  }

  interrupt() {
    if (!this.playing) return;
    this.token += 1;
    this.playing = null;
    this.speech.stop();
    this.audio.stopVoice();
  }

  drain() {
    if (this.playing || !this.queue.length) return;
    // Из очереди берём самое важное, при равенстве — самое давнее.
    let best = 0;
    this.queue.forEach((item, i) => {
      if (item.priority > this.queue[best].priority) best = i;
    });
    const item = this.queue.splice(best, 1)[0];
    this.playing = item;
    const token = ++this.token;
    this.duck();
    this.play(item, token);
  }

  // Записанный файл, если он есть и успел; иначе синтез. Гонка честная: буфер
  // и таймер стартуют одновременно, и кто первый — тот и говорит.
  play(item, token) {
    const settle = () => {
      if (token !== this.token) return; // фразу успели прервать
      this.playing = null;
      item.onDone?.();
      if (this.queue.length) this.drain();
      else this.scheduleUnduck();
    };

    if (!this.bank.has(item.text)) {
      this.speech.speak(item.text, settle);
      return;
    }

    let decided = false;
    const fallback = setTimeout(() => {
      if (decided || token !== this.token) return;
      decided = true;
      this.speech.speak(item.text, settle);
    }, WAIT_MS);

    this.bank.buffer(item.text).then((buffer) => {
      if (decided || token !== this.token) return;
      clearTimeout(fallback);
      decided = true;
      const source = buffer && this.audio.voice(buffer, { duck: false });
      if (!source) {
        this.speech.speak(item.text, settle);
        return;
      }
      source.addEventListener('ended', settle);
    });
  }

  // --- Приглушение музыки ---

  duck() {
    if (this.unduckTimer) {
      clearTimeout(this.unduckTimer);
      this.unduckTimer = null;
    }
    if (this.ducked) return;
    this.ducked = true;
    this.audio.duck(true);
  }

  scheduleUnduck() {
    if (!this.ducked || this.unduckTimer) return;
    this.unduckTimer = setTimeout(() => {
      this.unduckTimer = null;
      if (!this.playing && !this.queue.length) this.unduck();
    }, UNDUCK_HOLD);
  }

  unduck(immediate = false) {
    if (this.unduckTimer) {
      clearTimeout(this.unduckTimer);
      this.unduckTimer = null;
    }
    if (!this.ducked) return;
    if (!immediate && (this.playing || this.queue.length)) return;
    this.ducked = false;
    this.audio.duck(false);
  }
}
