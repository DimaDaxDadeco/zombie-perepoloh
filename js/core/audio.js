// Звук на Web Audio API: всё синтезируется на лету, аудиофайлов нет.
// Подробности и рецепт добавления нового звука — в docs/audio.md.

// Ноты весёлой фоновой мелодии (мажорная гамма, зацикленная).
const MELODY = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880.0, 698.46];
const MELODY_STEP = 0.28; // секунд на ноту
const BOSS_MELODY = [196.0, 233.08, 196.0, 174.61];

export class Audio {
  constructor(soundOn) {
    this.enabled = soundOn;
    this.ctx = null;
    this.master = null;
    this.musicTimer = null;
    this.musicIndex = 0;
    this.bossMode = false;
  }

  // Браузеры разрешают звук только после действия пользователя,
  // поэтому контекст создаётся при первом клике/нажатии.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.35 : 0;
    this.master.connect(this.ctx.destination);
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.35 : 0;
  }

  // Базовый кирпичик: нота с заданной формой волны и огибающей.
  tone({ freq, endFreq = null, duration = 0.15, type = 'square', volume = 0.3, delay = 0 }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== null) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  // Короткий шумовой всплеск — для «пуфф» и взрывов.
  noise({ duration = 0.2, volume = 0.25, delay = 0 }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this.master);
    src.start(t0);
  }

  // --- Игровые звуки ---

  shoot() {
    this.tone({ freq: 700 + Math.random() * 200, endFreq: 300, duration: 0.07, type: 'triangle', volume: 0.12 });
  }

  pop() { // зомби лопнул
    const base = 380 + Math.random() * 260;
    this.tone({ freq: base, endFreq: base * 2.4, duration: 0.11, type: 'sine', volume: 0.3 });
    this.noise({ duration: 0.09, volume: 0.12 });
  }

  boom() { // взрыв помидора/ракеты
    this.tone({ freq: 180, endFreq: 50, duration: 0.3, type: 'sawtooth', volume: 0.25 });
    this.noise({ duration: 0.28, volume: 0.25 });
  }

  zap() { // молния
    this.tone({ freq: 1400, endFreq: 260, duration: 0.14, type: 'sawtooth', volume: 0.2 });
  }

  flame() { // струя огнемёта
    this.noise({ duration: 0.16, volume: 0.1 });
    this.tone({ freq: 240, endFreq: 120, duration: 0.16, type: 'sawtooth', volume: 0.06 });
  }

  freeze() { // ледяной выстрел
    this.tone({ freq: 1600, endFreq: 900, duration: 0.14, type: 'sine', volume: 0.1 });
    this.tone({ freq: 2400, duration: 0.05, type: 'sine', volume: 0.05, delay: 0.04 });
  }

  slash() { // взмах светового меча
    this.tone({ freq: 380, endFreq: 900, duration: 0.1, type: 'square', volume: 0.06 });
    this.noise({ duration: 0.08, volume: 0.05 });
  }

  medal() { // подобрал медальку
    this.tone({ freq: 1050, duration: 0.06, type: 'sine', volume: 0.16 });
    this.tone({ freq: 1580, duration: 0.07, type: 'sine', volume: 0.14, delay: 0.05 });
  }

  money() { // подобрал доллар
    this.tone({ freq: 880, duration: 0.07, type: 'square', volume: 0.16 });
    this.tone({ freq: 1320, duration: 0.12, type: 'square', volume: 0.14, delay: 0.06 });
  }

  levelUp() { // та-дам!
    [523, 659, 784, 1047].forEach((f, i) => {
      this.tone({ freq: f, duration: 0.2, type: 'triangle', volume: 0.25, delay: i * 0.09 });
    });
  }

  bite() { // собачка тяпнула зомби
    this.tone({ freq: 520, endFreq: 240, duration: 0.09, type: 'square', volume: 0.12 });
    this.noise({ duration: 0.06, volume: 0.08 });
  }

  abilityReady() { // шкала способности наполнилась — «жми пробел»
    // Короче и тише, чем levelUp(): это подсказка, а не праздник.
    [880, 1175, 1568].forEach((f, i) => {
      this.tone({ freq: f, duration: 0.1, type: 'sine', volume: 0.16, delay: i * 0.06 });
    });
  }

  abilityUse() { // способность сработала — общий «вжух»
    this.tone({ freq: 700, endFreq: 180, duration: 0.25, type: 'sawtooth', volume: 0.18 });
    this.noise({ duration: 0.2, volume: 0.12 });
  }

  hurt() { // герою досталось — не страшно, а смешно
    this.tone({ freq: 300, endFreq: 120, duration: 0.28, type: 'sawtooth', volume: 0.22 });
  }

  bossAppear() { // низкое смешное «во-о-ой»
    this.tone({ freq: 90, endFreq: 200, duration: 0.9, type: 'sawtooth', volume: 0.3 });
    this.tone({ freq: 45, endFreq: 100, duration: 1.0, type: 'square', volume: 0.2 });
  }

  special() { // начался особый раунд
    [660, 880, 1100].forEach((f, i) => {
      this.tone({ freq: f, duration: 0.14, type: 'triangle', volume: 0.18, delay: i * 0.1 });
    });
  }

  evolve() { // оружие выросло — ярче уровня, но короче победы
    [523, 784, 1047, 1319].forEach((f, i) => {
      this.tone({ freq: f, duration: 0.22, type: 'square', volume: 0.22, delay: i * 0.08 });
    });
  }

  victory() { // фанфары
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => {
      this.tone({ freq: f, duration: 0.28, type: 'square', volume: 0.24, delay: i * 0.14 });
    });
  }

  fail() { // мягкое «уупс», без драмы
    [400, 340, 280].forEach((f, i) => {
      this.tone({ freq: f, duration: 0.25, type: 'triangle', volume: 0.22, delay: i * 0.15 });
    });
  }

  click() {
    this.tone({ freq: 660, duration: 0.06, type: 'square', volume: 0.18 });
  }

  // --- Фоновая музыка ---

  startMusic() {
    this.stopMusic();
    this.musicIndex = 0;
    const tick = () => {
      const melody = this.bossMode ? BOSS_MELODY : MELODY;
      const freq = melody[this.musicIndex % melody.length];
      this.tone({ freq, duration: MELODY_STEP * 0.8, type: 'triangle', volume: 0.07 });
      this.tone({ freq: freq / 2, duration: MELODY_STEP * 0.9, type: 'sine', volume: 0.05 });
      this.musicIndex++;
    };
    tick();
    this.musicTimer = setInterval(tick, MELODY_STEP * 1000);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  setBossMode(on) {
    this.bossMode = on;
  }
}
