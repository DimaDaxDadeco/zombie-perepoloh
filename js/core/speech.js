// Озвучка подписей голосом через встроенный в браузер синтез речи.
// Ребёнок ещё не читает, поэтому любое название в игре можно послушать.
// Аудиофайлов не требуется — говорит сам браузер (Web Speech API).

const LANG = 'ru-RU';
const RATE = 0.95;  // чуть медленнее обычного — так понятнее ребёнку
const PITCH = 1.15; // чуть выше — голос звучит дружелюбнее

export class Speech {
  constructor(enabled) {
    this.enabled = enabled;
    this.synth = window.speechSynthesis || null;
    this.voice = null;

    if (!this.synth) return;
    // Список голосов в некоторых браузерах приходит асинхронно.
    this.pickVoice();
    this.synth.addEventListener?.('voiceschanged', () => this.pickVoice());
  }

  get isAvailable() {
    return this.synth !== null;
  }

  pickVoice() {
    const voices = this.synth.getVoices();
    if (!voices.length) return;
    this.voice = voices.find((v) => v.lang === LANG)
      || voices.find((v) => v.lang?.startsWith('ru'))
      || null;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.stop();
  }

  // Произносит фразу, прерывая предыдущую: несколько наложенных голосов
  // ребёнок всё равно не разберёт.
  speak(text) {
    if (!this.enabled || !this.synth || !text) return;
    this.stop();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG;
    utterance.rate = RATE;
    utterance.pitch = PITCH;
    if (this.voice) utterance.voice = this.voice;
    this.synth.speak(utterance);
  }

  stop() {
    this.synth?.cancel();
  }
}
