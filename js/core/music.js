// Фоновая музыка: планировщик с забеганием вперёд плюс слои, которые
// включаются по напряжению боя.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ. Раньше мелодия жила в audio.js двадцатью строками на
// setInterval — восемь нот по кругу, с дрейфом на десятки миллисекунд. Восемь
// нот по кругу надоедают за раунд, а дрейф мешает добавить бас и перкуссию:
// они обязаны попадать в долю. С планировщиком и таблицей тем это уже другая
// ответственность, и мешать её со звуками не стоит.
//
// Модуль НИЧЕГО не знает про граф: узел для затухания и два кирпичика
// (tone/noise) ему передаёт audio.js. И он намеренно не трогает window,
// document и setInterval на уровне модуля — иначе импорт core/game.js из
// любого будущего теста в Node упал бы.

const TICK = 80;        // мс между пробуждениями таймера
const LOOKAHEAD = 0.30; // сек: насколько вперёд планируем ноты
const FADE = 0.15;      // сек: столько гаснет музыка на stop()
const C4 = 261.63;

// Ступени пишутся полутонами от тоники, а не герцами: тогда таблица читается
// глазами, а транспонировать тему — это одно слагаемое. Раньше мелодия была
// массивом float, и поменять в ней что-либо означало считать частоты вручную.
function note(semitones) {
  return C4 * 2 ** (semitones / 12);
}

// Локации берутся из CONFIG.themes по id. yard в до-мажоре и на 108 ударах —
// это ровно сегодняшний шаг 0.278 сек и сегодняшние восемь нот: первый раунд
// обязан звучать как игра, к которой ребёнок привык.
const THEMES = {
  yard: { key: 0, bpm: 108, wave: 'triangle', melody: [0, 4, 7, 4, 2, 5, 9, 5] },
  park: { key: 7, bpm: 104, wave: 'triangle', melody: [0, 7, 4, 7, 9, 7, 4, 2] },
  beach: { key: 5, bpm: 100, wave: 'sine', melody: [0, 5, 9, 5, 7, 4, 2, 0] },
  space: { key: 9, bpm: 96, wave: 'sine', melody: [0, 7, 10, 7, 5, 3, 5, 7] },
  cave: { key: 2, bpm: 92, wave: 'triangle', melody: [0, 3, 7, 10, 9, 7, 5, 3] },
  rink: { key: 4, bpm: 116, wave: 'sine', melody: [0, 4, 7, 11, 12, 11, 7, 4] },
  farm: { key: 7, bpm: 112, wave: 'square', melody: [0, 4, 7, 10, 7, 4, 2, 0] },
};
const DEFAULT_THEME = 'yard';

// Босс перекрывает тему целиком: четыре низкие ноты — те же, что были в
// прежнем BOSS_MELODY (соль, си-бемоль, соль, фа), только записанные ступенями.
const BOSS = { melody: [-5, -3, -5, -7], bpmAdd: 4, wave: 'triangle' };

// Бас идёт по кругу из четырёх тактов: тоника, тоника, кварта, квинта.
const BASS_BARS = [0, 0, 5, 7];

// Порог входа в слой и порог выхода. Разные нарочно: количество зомби
// колеблется вокруг любого одного порога, и перкуссия мигала бы каждые полсекунды.
const LAYERS = [
  { enter: 0, leave: 0 },
  { enter: 0.25, leave: 0.15 },
  { enter: 0.60, leave: 0.45 },
  { enter: 0.85, leave: 0.70 },
];

const STEPS_PER_BAR = 16; // шестнадцатые: мелодия идёт через шаг, бас — по половинам

export class Music {
  constructor({ ctx, fade, tone, noise }) {
    this.ctx = ctx;
    this.gain = fade;
    this.playTone = tone;
    this.playNoise = noise;

    this.theme = THEMES[DEFAULT_THEME];
    this.boss = false;
    this.danger = 0;
    this.level = 0;
    this.nextLevel = 0;

    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
  }

  // Тоника в пятой октаве — в ней написана мелодия. Её же спрашивает
  // audio.victory(), чтобы фанфара достраивала игравшую тему, а не всегда
  // приезжала в до.
  get root() {
    return this.theme.key + 12;
  }

  get stepDur() {
    const bpm = this.theme.bpm + (this.boss ? BOSS.bpmAdd : 0);
    return 60 / bpm / 4;
  }

  setTheme(themeId) {
    const theme = THEMES[themeId];
    if (!theme || theme === this.theme) return;
    this.theme = theme;
    this.step = 0; // новая локация начинается с начала такта
  }

  setBoss(on) {
    this.boss = on;
  }

  // Уровень опасности 0..1 приходит дважды в секунду из Round. Слой меняется
  // только на границе такта, поэтому здесь мы лишь выбираем желаемый.
  setDanger(level) {
    this.danger = level;
    const current = this.nextLevel;
    let wanted = current;
    for (let i = LAYERS.length - 1; i > current; i--) {
      if (level >= LAYERS[i].enter) { wanted = i; break; }
    }
    if (wanted === current && current > 0 && level < LAYERS[current].leave) wanted = current - 1;
    this.nextLevel = wanted;
  }

  // Начать, если стоит, иначе — продолжить с того же места. Прежний startMusic
  // всегда сбрасывал шаг в ноль, и снятие с паузы прыгало на начало мелодии.
  start() {
    if (this.timer) return;
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(1, now);
    this.nextTime = now + 0.05;
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK);
  }

  // Свернули вкладку: планировщик замолкает, но мелодия и шаг сохраняются.
  pause() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  // Совсем остановить — с затуханием: с басом и перкуссией резкий обрыв стал
  // заметен, а победные фанфары должны попадать в открывшуюся тишину.
  stop() {
    this.pause();
    if (!this.gain) return;
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(0, now + FADE);
  }

  tick() {
    const now = this.ctx.currentTime;
    // Опоздали — вкладку придушили или главный поток залип. Не досыпаем
    // пропущенные ноты пачкой в прошлое (Web Audio сыграл бы их все разом,
    // одним слышимым залпом), а перецепляемся к текущему времени.
    if (this.nextTime < now) this.nextTime = now + 0.02;
    while (this.nextTime < now + LOOKAHEAD) {
      this.scheduleStep(this.step, this.nextTime);
      this.nextTime += this.stepDur;
      this.step++;
    }
  }

  scheduleStep(step, time) {
    const inBar = step % STEPS_PER_BAR;
    // Слой переключаем только на границе такта: иначе перкуссия влезает
    // посреди доли и это слышно как сбой, а не как нарастание.
    if (inBar === 0) this.level = this.nextLevel;
    const level = this.boss ? 3 : this.level;
    const delay = Math.max(0, time - this.ctx.currentTime);
    const dur = this.stepDur;

    if (inBar % 2 === 0) this.scheduleMelody(inBar, delay, dur);
    if (level >= 1 && inBar % 8 === 0) this.scheduleBass(step, inBar, delay, dur);
    if (level >= 2) this.schedulePercussion(inBar, delay);
    if (level >= 3) this.scheduleShaker(inBar, delay);
    if (level >= 3 && inBar % 4 === 2) this.scheduleArp(inBar, delay, dur);
  }

  scheduleMelody(inBar, delay, dur) {
    const key = this.theme.key;
    const pattern = this.boss ? BOSS.melody : this.theme.melody;
    const wave = this.boss ? BOSS.wave : this.theme.wave;
    const degree = pattern[(inBar / 2) % pattern.length];
    const freq = note(key + degree + (this.boss ? 0 : 12));
    this.playTone({ freq, duration: dur * 1.6, type: wave, volume: 0.07, delay });
    // Октавой ниже — как было: два голоса дают мелодии тело.
    this.playTone({ freq: freq / 2, duration: dur * 1.8, type: 'sine', volume: 0.05, delay });
  }

  scheduleBass(step, inBar, delay, dur) {
    const bar = Math.floor(step / STEPS_PER_BAR) % BASS_BARS.length;
    const degree = BASS_BARS[bar] + (inBar === 8 ? 7 : 0);
    this.playTone({
      freq: note(this.theme.key + degree - 12),
      duration: dur * 7,
      type: 'sine',
      volume: 0.06,
      delay,
      filter: { type: 'lowpass', freq: 300 },
    });
  }

  schedulePercussion(inBar, delay) {
    if (inBar === 0 || inBar === 8) {
      this.playNoise({ duration: 0.09, volume: 0.1, delay, filter: { type: 'lowpass', freq: 120 } });
    }
    if (inBar === 4 || inBar === 12) {
      this.playNoise({ duration: 0.07, volume: 0.05, delay, filter: { type: 'bandpass', freq: 1800, q: 1 } });
    }
  }

  // Шейкер, а не снейр: для пятилетнего мягкий пульс дружелюбнее бита.
  scheduleShaker(inBar, delay) {
    if (inBar % 2 === 0) return;
    this.playNoise({ duration: 0.04, volume: 0.035, delay, filter: { type: 'highpass', freq: 5000 } });
  }

  scheduleArp(inBar, delay, dur) {
    const pattern = this.boss ? BOSS.melody : this.theme.melody;
    const degree = pattern[(inBar / 2) % pattern.length];
    this.playTone({
      freq: note(this.theme.key + degree + 19),
      duration: dur * 1.2,
      type: 'square',
      volume: 0.04,
      delay,
    });
  }
}
