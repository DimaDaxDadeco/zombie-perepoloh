// Запасной голос: синтез речи, встроенный в браузер.
//
// Основной голос — записанные файлы (core/voice-bank.js). Синтез остаётся для
// того, чего в банке нет: файл не успел загрузиться, браузер не умеет
// декодировать формат, банка вообще нет на этой машине. Игра в любом случае
// обязана говорить: ребёнок пяти лет не читает, и молчащая подпись для него
// означает, что кнопка сломана.
//
// Очередь, приоритеты и приглушение музыки живут в core/voice.js. Здесь —
// только «произнеси эту строку и скажи, когда закончишь».

const LANG = 'ru-RU';
const RATE = 0.95;  // чуть медленнее обычного — так понятнее ребёнку
const PITCH = 1.15; // чуть выше — голос звучит дружелюбнее

// Список голосов в некоторых браузерах приходит асинхронно и на первый запрос
// возвращает пустоту. Событию voiceschanged верить можно не везде, поэтому
// ещё и опрашиваем.
const POLL_STEP = 250;
const POLL_LIMIT = 3000;

// Chrome и Safari теряют фразу, если cancel() и speak() случились в одной
// задаче. Быстрый пролёт стрелкой по карточкам — это ровно такая
// последовательность, и кончался он тишиной.
const CANCEL_GAP = 60;

// Сторож: onend приходит не всегда (особенно после cancel), а без сигнала
// «договорил» цепочка фраз встала бы навсегда, и музыка осталась бы
// приглушённой. Оценка длины фразы грубая и специально с запасом.
const WATCH_BASE = 400;
const WATCH_PER_CHAR = 75;

// Насколько имя голоса обещает качество. Флага качества в
// SpeechSynthesisVoice нет вовсе, поэтому судим по названию: улучшенные и
// премиальные голоса на macOS называются именно так. Ранжирование подхватит
// premium в тот же миг, как его скачают, без единой правки кода.
function score(voice) {
  const name = voice.name || '';
  let points = voice.lang === LANG ? 10 : 0;
  if (/premium/i.test(name)) points += 40;
  if (/enhanced|улучшенн/i.test(name)) points += 30;
  if (/siri/i.test(name)) points += 20;
  if (/compact/i.test(name)) points -= 30;
  if (voice.localService) points += 5;
  return points;
}

export class Speech {
  constructor(enabled) {
    this.enabled = enabled;
    this.synth = typeof window === 'undefined' ? null : (window.speechSynthesis || null);
    this.voice = null;
    this.cancelledAt = 0;
    this.pending = null;
    this.watchdog = null;
    this.current = null;
    this.warmed = false;

    if (!this.synth) return;
    this.pickVoice();
    this.synth.addEventListener?.('voiceschanged', () => this.pickVoice());
    this.pollVoices(0);
  }

  get isAvailable() {
    return this.synth !== null;
  }

  pickVoice() {
    const voices = this.synth.getVoices().filter((v) => v.lang === LANG || v.lang?.startsWith('ru'));
    if (!voices.length) return;
    this.voice = voices.reduce((best, v) => (score(v) > score(best) ? v : best), voices[0]);
  }

  pollVoices(waited) {
    if (this.voice || waited >= POLL_LIMIT) return;
    setTimeout(() => {
      this.pickVoice();
      this.pollVoices(waited + POLL_STEP);
    }, POLL_STEP);
  }

  // Прогрев на разблокировке звука: без него в Safari обрезана самая первая
  // фраза сессии. Нулевая громкость — чтобы прогрев не был слышен.
  warmUp() {
    if (this.warmed || !this.synth) return;
    this.warmed = true;
    const utterance = new SpeechSynthesisUtterance(' ');
    utterance.volume = 0;
    utterance.lang = LANG;
    this.synth.speak(utterance);
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.stop();
  }

  // Произносит фразу и зовёт onDone, когда она договорена или сорвалась.
  // Прерывает предыдущую: несколько наложенных голосов ребёнок всё равно не
  // разберёт, а выбор, что важнее, делает core/voice.js.
  speak(text, onDone = null) {
    if (!this.enabled || !this.synth || !text) {
      onDone?.();
      return;
    }
    this.stop();
    // Голос ещё не выбран (список не приехал) — лучше подождать до четверти
    // секунды, чем произнести русскую фразу английским голосом по умолчанию.
    const delay = Math.max(
      this.voice ? 0 : POLL_STEP,
      CANCEL_GAP - (performance.now() - this.cancelledAt),
    );
    const start = () => {
      this.pending = null;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LANG;
      utterance.rate = RATE;
      utterance.pitch = PITCH;
      if (this.voice) utterance.voice = this.voice;
      const settle = () => {
        if (this.current !== utterance) return;
        this.clearWatchdog();
        this.current = null;
        onDone?.();
      };
      utterance.onend = settle;
      utterance.onerror = settle;
      this.current = utterance;
      this.watchdog = setTimeout(() => {
        // Движок залип: молчаливое зависание страшнее оборванной фразы.
        if (this.synth.speaking) this.synth.cancel();
        settle();
      }, WATCH_BASE + WATCH_PER_CHAR * text.length);
      this.synth.speak(utterance);
    };
    if (delay > 0) this.pending = setTimeout(start, delay);
    else start();
  }

  stop() {
    if (this.pending) {
      clearTimeout(this.pending);
      this.pending = null;
    }
    this.clearWatchdog();
    this.current = null;
    if (!this.synth) return;
    this.synth.cancel();
    this.cancelledAt = typeof performance === 'undefined' ? 0 : performance.now();
  }

  clearWatchdog() {
    if (!this.watchdog) return;
    clearTimeout(this.watchdog);
    this.watchdog = null;
  }
}
