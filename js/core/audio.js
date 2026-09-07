// Звук на Web Audio API: всё синтезируется на лету, аудиофайлов нет.
//
// Единственное исключение — голосовые фразы: их файлы расшифровывает
// core/voice-bank.js, но играет через шину ЭТОГО графа. Иначе кнопка звука
// (она гасит мастер-узел) голос бы не выключала, а музыку под фразу нельзя
// было бы приглушить.
//
// Подробности и рецепт добавления нового звука — в docs/audio.md.

import { Music } from './music.js';

const MASTER = 0.35;

// Лимитер на мастере. Порог выбран под реальные пики: самый громкий одиночный
// звук — pop() и bossAppear(), около 0.42 (−7.5 дБ). С коленом 6 дБ такой
// звук проходит практически без сжатия, то есть СЕГОДНЯШНИЙ БАЛАНС НЕ
// СДВИГАЕТСЯ — меняются только навалы. Помидор кладёт восьмерых зомби в одном
// кадре (round.js), это +12 дБ и честный клиппинг; с ratio 12 навал выходит на
// −2.7 дБ, и толпа по-прежнему громче одного зомби, просто на 15 дБ, а не на
// 20. Атака 3 мс, а не ноль: нулевая съедает щелчок, по которому pop и clank
// вообще узнаются, а с мастером 0.35 этот «пролёт» до полной шкалы не дотянет.
const LIMITER = { threshold: -4, knee: 6, ratio: 12, attack: 0.003, release: 0.25 };

// Приглушение под голос. Музыку убираем почти совсем, а звуки — только на 5 дБ:
// заглушить их целиком значит на всю длину фразы оставить ребёнка стрелять в
// тишину. Вниз быстро, обратно медленно — иначе на серии фраз слышно «качание».
const DUCK = { music: 0.18, sfx: 0.55, down: 0.12, up: 0.25 };

// Один буфер шума на всю игру: раньше каждый boom() выделял новый и прокручивал
// 13 тысяч Math.random(). Играем случайный срез, поэтому повтор не слышен.
const NOISE_SECONDS = 1;

// Панорама никогда не в упор: ребёнок часто слушает в одном наушнике, и звук,
// уехавший в тишину, для него просто исчезает.
const PAN_MAX = 0.5;
const FAR_FADE = 0.35; // насколько тише звук у дальнего края арены

// Лесенка для подобранных подряд медалек и монет: пять штук становятся
// мелодией, а не пятью одинаковыми «дзинь».
const MEDAL_STEPS = [0, 2, 4, 5, 7, 9, 11, 12];
const MEDAL_CHAIN = 0.6; // через столько тишины лесенка сбрасывается

const STINGER_DELAY = 0.16; // фанфары ждут, пока музыка догаснет

// Ограничители потока: gap — минимальный интервал между запусками, max —
// сколько запусков разрешено подряд без паузы.
//
// Работает не отбрасыванием, а РАЗДВИЖКОЙ. Помидор кладёт восьмерых зомби в
// одном кадре, и все восемь «попов» приходят с одним и тем же ctx.currentTime:
// простой запрет «не чаще, чем раз в gap» оставил бы от залпа один хлопок.
// Поэтому звук, попавший в занятое время, сдвигается вперёд на gap, и только
// когда сдвиг перевалит за gap * (max - 1), лишнее отбрасывается. Толпа
// звучит залпом из четырёх, а не белым шумом из двадцати и не одиночным
// щелчком.
//
// Поток, растянутый во времени (выстрелы раз в 0.1 сек), не ограничивается
// вовсе: к моменту следующего выстрела время уже свободно.
//
// Это ограничитель ПЛОТНОСТИ, а не подсчёт живых голосов: настоящий подсчёт
// требует реестра узлов и ended на каждом, а на слух результат тот же.
//
// Событийные звуки получают max: 1 — второй экземпляр в тот же миг у них
// всегда баг, а не задумка.
const LIMITS = {
  pop: { gap: 0.04, max: 4 },      // залп, а не белый шум
  shoot: { gap: 0.04, max: 3 },    // пушка, пузыри и собачка стреляют в одном кадре
  boom: { gap: 0.06, max: 2 },     // самый длинный громкий звук — именно три взрыва и хрипят
  medal: { gap: 0.05, max: 4 },
  money: { gap: 0.05, max: 4 },     // с босса падает CONFIG.boss.coins монет разом
  zap: { gap: 0.05, max: 3 },      // молния бьёт цепью
  freeze: { gap: 0.06, max: 3 },
  flame: { gap: 0.08, max: 2 },
  slash: { gap: 0.06, max: 3 },
  bite: { gap: 0.05, max: 3 },     // питомцев может быть несколько
  splat: { gap: 0.08, max: 2 },
  clank: { gap: 0.08, max: 2 },
  hurt: { gap: 0.25, max: 1 },      // два зомби укусили разом, а сердечко одно
  click: { gap: 0.05, max: 2 },
  abilityReady: { gap: 0.5, max: 1 }, // в ко-опе шкалы наполняются синхронно
  abilityUse: { gap: 0.15, max: 2 },  // вдвоём можно нажать пробел одновременно
  whistle: { gap: 0.3, max: 1 },
  buzz: { gap: 0.2, max: 1 },
  beam: { gap: 0.2, max: 1 },
  levelUp: { gap: 0.5, max: 1 },
  bonesCollapse: { gap: 0.5, max: 1 },
  bonesRise: { gap: 0.5, max: 1 },
  special: { gap: 0.5, max: 1 },
  evolve: { gap: 0.5, max: 1 },
  bossAppear: { gap: 1, max: 1 },
  victory: { gap: 1, max: 1 },
  fail: { gap: 1, max: 1 },
};

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export class Audio {
  constructor(soundOn) {
    this.enabled = soundOn;
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.voiceBus = null;
    this.musicFade = null;
    this.limiter = null;
    this.noiseBuffer = null;
    this.music = null;
    this.voiceSource = null;
    this.ducks = 0;

    // Куда слушатель смотрит: панорама считается ОТ ИГРОКА, а не от центра
    // арены. В объёмном режиме камера едет за героем, и центр арены разошёлся
    // бы с картинкой.
    this.listenerX = null;
    this.listenerY = null;
    this.panHalf = 450;

    // Чего от музыки хотят до того, как появился контекст. Разблокировка
    // случается позже первого startMusic(), и без этого первый раунд начинался
    // бы в тишине.
    this.wantMusic = false;
    this.themeId = null;
    this.danger = 0;
    this.bossMode = false;

    this.limitFree = {}; // имя звука -> когда ему снова можно звучать
    this.offset = 0;     // сдвиг, с которым играется текущий звук из залпа
    this.chainStep = { medal: -1, money: -1 };
    this.chainAt = { medal: 0, money: 0 };

    this.readyResolve = null;
    this.readyPromise = new Promise((resolve) => { this.readyResolve = resolve; });

    this.installLimits();
  }

  // Ограничители навешиваются поверх методов ОДИН раз, здесь: правило живёт в
  // таблице LIMITS, а не размазано по двадцати восьми звукам. Опечатка в имени
  // падает сразу при создании Audio, а не молчит до первой толпы зомби.
  //
  // Побочный эффект: audio.pop становится собственным свойством, а не
  // прототипным. Это нарочно, «чистить» не надо.
  installLimits() {
    for (const [name, limit] of Object.entries(LIMITS)) {
      const raw = this[name].bind(this);
      this[name] = (...args) => {
        const delay = this.allow(name, limit);
        if (delay === null) return;
        // Сдвиг залпа прибавляют сами кирпичики: иначе про него надо было бы
        // помнить в каждом из двадцати восьми звуков.
        this.offset = delay;
        raw(...args);
        this.offset = 0;
      };
    }
  }

  // Возвращает сдвиг в секундах либо null, если звук лишний.
  allow(name, { gap, max }) {
    if (!this.ctx) return null;
    const now = this.ctx.currentTime;
    const at = Math.max(now, this.limitFree[name] || 0);
    if (at - now > gap * (max - 1)) return null;
    this.limitFree[name] = at + gap;
    return at - now;
  }

  // Браузеры разрешают звук только после действия пользователя,
  // поэтому контекст создаётся при первом клике/нажатии.
  unlock() {
    if (this.ctx) {
      // Не только 'suspended': iOS после звонка оставляет контекст в
      // 'interrupted', и проверка на одно состояние звук уже не возвращала.
      if (this.ctx.state !== 'running') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.buildGraph();
    this.buildNoise();

    // Своя ступень громкости у музыки: stop() гасит именно её, а не musicBus.
    // Иначе затухание и приглушение под голос рампили бы один и тот же
    // параметр и перезаписывали друг друга.
    this.musicFade = this.ctx.createGain();
    this.musicFade.connect(this.musicBus);
    this.music = new Music({
      ctx: this.ctx,
      fade: this.musicFade,
      tone: (opts) => this.tone({ ...opts, bus: this.musicFade }),
      noise: (opts) => this.noise({ ...opts, bus: this.musicFade }),
    });
    if (this.themeId) this.music.setTheme(this.themeId);
    this.music.setDanger(this.danger);
    this.music.setBoss(this.bossMode);
    if (this.wantMusic) this.music.start();

    this.readyResolve(this);
  }

  // Шины существуют ради приглушения и фейдов, а НЕ ради баланса: поставь
  // musicBus в 0.5 — и все громкости нот придётся перетюнивать заново.
  // Поэтому все три стартуют с единицы.
  buildGraph() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? MASTER : 0;

    // Инфраниз (квадрат 45 Гц у bossAppear) на планшете не слышен, но ест
    // хедрум и давит лимитер. Вой босса живёт в свипе 90-200 Гц выше среза.
    const rumble = ctx.createBiquadFilter();
    rumble.type = 'highpass';
    rumble.frequency.value = 45;
    rumble.Q.value = 0.7;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = LIMITER.threshold;
    this.limiter.knee.value = LIMITER.knee;
    this.limiter.ratio.value = LIMITER.ratio;
    this.limiter.attack.value = LIMITER.attack;
    this.limiter.release.value = LIMITER.release;

    // Лимитер ДО мастера: тогда порог соотносится с настоящими пиками звуков,
    // а выключение звука (мастер в ноль) не взаимодействует с компрессией.
    this.limiter.connect(rumble).connect(this.master).connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.voiceBus = ctx.createGain();
    this.sfxBus = ctx.createGain();

    // Шипение белого шума выше 6 кГц — это и есть то, что динамик планшета
    // превращает в кажущийся хрип. Один узел лечит все звуки сразу.
    const tilt = ctx.createBiquadFilter();
    tilt.type = 'highshelf';
    tilt.frequency.value = 6000;
    tilt.gain.value = -6;

    this.sfxBus.connect(tilt).connect(this.limiter);
    this.musicBus.connect(this.limiter);
    this.voiceBus.connect(this.limiter);
  }

  buildNoise() {
    const frames = Math.floor(this.ctx.sampleRate * NOISE_SECONDS);
    this.noiseBuffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  }

  // Промис для голосового слоя: расшифровывать файлы можно только когда есть
  // контекст, а он появляется на первом касании страницы.
  ready() {
    return this.readyPromise;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!this.master) return;
    // Плавно, а не записью .value: по звенящей ноте резкая смена щёлкает.
    // И отменяем висящий ramp приглушения — иначе договоривший голос вернёт
    // громкость поверх только что выключенного звука.
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(on ? MASTER : 0, t + 0.02);
  }

  // --- Голос ---

  // Приглушить музыку и звуки, пока говорит голос. Счётчик, а не флаг: две
  // наложенные фразы иначе разбудили бы друг друга. Кламп в ноль делает лишний
  // duck(false) безвредным.
  duck(on) {
    this.ducks = Math.max(0, this.ducks + (on ? 1 : -1));
    if (!this.ctx) return;
    const quiet = this.ducks > 0;
    const time = this.ctx.currentTime + (quiet ? DUCK.down : DUCK.up);
    for (const [bus, level] of [[this.musicBus, DUCK.music], [this.sfxBus, DUCK.sfx]]) {
      bus.gain.cancelScheduledValues(this.ctx.currentTime);
      bus.gain.setValueAtTime(bus.gain.value, this.ctx.currentTime);
      bus.gain.linearRampToValueAtTime(quiet ? level : 1, time);
    }
  }

  // Играет расшифрованную фразу. Снятие приглушения принадлежит ЭТОМУ методу,
  // а не звонящему: иначе достаточно один раз прервать фразу мимо onended,
  // чтобы игра осталась приглушённой навсегда.
  voice(buffer, { volume = 1, duck = true } = {}) {
    if (!this.ctx || !this.enabled || !buffer) return null;
    this.stopVoice();
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gain).connect(this.voiceBus);
    if (duck) {
      this.duck(true);
      src.addEventListener('ended', () => {
        if (this.voiceSource === src) this.voiceSource = null;
        this.duck(false);
      });
    }
    this.voiceSource = src;
    src.start();
    return src;
  }

  stopVoice() {
    if (!this.voiceSource) return;
    const src = this.voiceSource;
    this.voiceSource = null;
    try {
      src.stop();
    } catch {
      // Уже кончилась — ended сам снимет приглушение.
    }
  }

  // --- Кирпичики ---

  // Нота с заданной формой волны и огибающей.
  tone({ freq, endFreq = null, duration = 0.15, type = 'square', volume = 0.3,
    delay = 0, filter = null, pan = 0, bus = null }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay + this.offset;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== null) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);
    this.route(osc, this.envelope(t0, duration, volume, 0.01), { filter, pan, bus });
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  // Шумовой всплеск — для «пуфф» и взрывов. Затухание живёт в огибающей, а не
  // в сэмплах: раньше volume взаимодействовал с запечённым фейдом, и одно
  // нельзя было менять, не думая про другое.
  noise({ duration = 0.2, volume = 0.25, delay = 0, filter = null, pan = 0, bus = null }) {
    if (!this.ctx || !this.enabled || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime + delay + this.offset;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    this.route(src, this.envelope(t0, duration, volume, 0.002), { filter, pan, bus });
    src.start(t0, Math.random() * Math.max(0, NOISE_SECONDS - duration), duration + 0.05);
  }

  envelope(t0, duration, volume, attack) {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    return gain;
  }

  route(source, gain, { filter, pan, bus }) {
    let node = source;
    if (filter) {
      const biquad = this.ctx.createBiquadFilter();
      biquad.type = filter.type;
      biquad.frequency.value = filter.freq;
      if (filter.q !== undefined) biquad.Q.value = filter.q;
      node = node.connect(biquad);
    }
    node = node.connect(gain);
    if (pan) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      node = node.connect(panner);
    }
    node.connect(bus || this.sfxBus);
  }

  // Разброс высоты: за один раз незаметен, но убивает «пулемёт» на сороковом
  // повторе. Опознаваемые сигналы (levelUp, abilityReady, victory, fail,
  // evolve, special, whistle, bossAppear) НЕ разбрасываем: ребёнок их выучил,
  // и блуждающая высота мешает их узнавать.
  vary(freq, spread) {
    return freq * (1 + (Math.random() * 2 - 1) * spread);
  }

  // Где звук стоит в панораме и насколько он тише из-за расстояния. Позиция
  // необязательна: звук без неё звучит по центру, как и раньше.
  place(at) {
    if (!at || at.x === undefined || this.listenerX === null) return { pan: 0, mul: 1 };
    const dx = at.x - this.listenerX;
    const dy = at.y === undefined || this.listenerY === null ? 0 : at.y - this.listenerY;
    const pan = clamp(dx / this.panHalf, -1, 1) * PAN_MAX;
    const mul = 1 - FAR_FADE * clamp(Math.hypot(dx, dy) / (this.panHalf * 1.2), 0, 1);
    return { pan, mul };
  }

  // --- Игровые звуки ---

  shoot() {
    this.tone({ freq: 700 + Math.random() * 200, endFreq: 300, duration: 0.07, type: 'triangle', volume: 0.12 });
  }

  pop(at) { // зомби лопнул
    const { pan, mul } = this.place(at);
    const base = 380 + Math.random() * 260;
    this.tone({ freq: base, endFreq: base * 2.4, duration: 0.11, type: 'sine', volume: 0.3 * mul, pan });
    this.noise({ duration: 0.09, volume: 0.12 * mul, pan, filter: { type: 'lowpass', freq: 2500 } });
  }

  boom(at) { // взрыв помидора/ракеты
    const { pan, mul } = this.place(at);
    this.tone({ freq: this.vary(180, 0.06), endFreq: 50, duration: 0.3, type: 'sawtooth', volume: 0.25 * mul, pan });
    this.noise({ duration: 0.28, volume: 0.25 * mul, pan, filter: { type: 'lowpass', freq: 900 } });
  }

  zap(at) { // молния
    const { pan, mul } = this.place(at);
    this.tone({ freq: this.vary(1400, 0.05), endFreq: 260, duration: 0.14, type: 'sawtooth', volume: 0.2 * mul, pan });
  }

  flame() { // струя огнемёта
    this.noise({ duration: 0.16, volume: 0.1, filter: { type: 'bandpass', freq: 1200, q: 0.6 } });
    this.tone({ freq: 240, endFreq: 120, duration: 0.16, type: 'sawtooth', volume: 0.06 });
  }

  freeze() { // ледяной выстрел
    this.tone({ freq: 1600, endFreq: 900, duration: 0.14, type: 'sine', volume: 0.1 });
    this.tone({ freq: 2400, duration: 0.05, type: 'sine', volume: 0.05, delay: 0.04 });
    this.noise({ duration: 0.03, volume: 0.04, delay: 0.02, filter: { type: 'highpass', freq: 2000 } });
  }

  slash() { // взмах светового меча
    this.tone({ freq: this.vary(380, 0.06), endFreq: 900, duration: 0.1, type: 'square', volume: 0.06 });
    this.noise({ duration: 0.08, volume: 0.05, filter: { type: 'bandpass', freq: 1800, q: 1.2 } });
  }

  medal(at) { // подобрал медальку
    this.chime('medal', 1050, 'sine', at);
  }

  money(at) { // подобрал доллар
    this.chime('money', 880, 'square', at);
  }

  // Подряд собранные подборы шагают вверх по мажорной гамме и складываются в
  // мелодию. Пять одинаковых «дзинь» ребёнок слышит как один длинный шум, а
  // лесенку — как награду, которая растёт.
  chime(kind, base, type, at) {
    const now = this.ctx.currentTime;
    const step = now - this.chainAt[kind] < MEDAL_CHAIN
      ? Math.min(this.chainStep[kind] + 1, MEDAL_STEPS.length - 1)
      : 0;
    this.chainStep[kind] = step;
    this.chainAt[kind] = now;
    const shift = 2 ** (MEDAL_STEPS[step] / 12);
    const { pan, mul } = this.place(at);
    this.tone({ freq: base * shift, duration: 0.06, type, volume: 0.16 * mul, pan });
    this.tone({ freq: base * 1.5 * shift, duration: 0.09, type, volume: 0.14 * mul, pan, delay: 0.05 });
  }

  levelUp() { // та-дам!
    [523, 659, 784, 1047].forEach((f, i) => {
      this.tone({ freq: f, duration: 0.2, type: 'triangle', volume: 0.25, delay: i * 0.09 });
    });
  }

  bonesCollapse() { // костяной рассыпался
    [520, 440, 380, 300].forEach((f, i) => {
      this.tone({ freq: f, duration: 0.09, type: 'square', volume: 0.13, delay: i * 0.06 });
    });
    this.noise({ duration: 0.2, volume: 0.1, delay: 0.05, filter: { type: 'bandpass', freq: 1500, q: 2 } });
  }

  bonesRise() { // и собирается обратно
    [300, 380, 440, 520].forEach((f, i) => {
      this.tone({ freq: f, duration: 0.16, type: 'square', volume: 0.14, delay: i * 0.09 });
    });
    this.tone({ freq: 70, endFreq: 160, duration: 0.5, type: 'sawtooth', volume: 0.18 });
  }

  splat(at) { // торт клоуна шлёпнулся
    const { pan, mul } = this.place(at);
    this.noise({ duration: 0.14, volume: 0.16 * mul, pan, filter: { type: 'bandpass', freq: 700, q: 0.8 } });
    this.tone({ freq: this.vary(200, 0.07), endFreq: 90, duration: 0.18, type: 'sine', volume: 0.14 * mul, pan });
  }

  whistle() { // свисток охранника
    this.tone({ freq: 2200, duration: 0.12, type: 'sine', volume: 0.1 });
    this.tone({ freq: 2600, duration: 0.12, type: 'sine', volume: 0.09, delay: 0.13 });
  }

  beam() { // включился лазерный луч
    this.tone({ freq: 220, endFreq: 900, duration: 0.18, type: 'sawtooth', volume: 0.08 });
  }

  buzz() { // вылетел рой пчёл
    this.tone({ freq: 90, endFreq: 140, duration: 0.25, type: 'sawtooth', volume: 0.07 });
    this.tone({ freq: 95, endFreq: 145, duration: 0.25, type: 'sawtooth', volume: 0.05 });
  }

  bite(at) { // собачка тяпнула зомби
    const { pan, mul } = this.place(at);
    this.tone({ freq: this.vary(520, 0.08), endFreq: 240, duration: 0.09, type: 'square', volume: 0.12 * mul, pan });
    this.noise({ duration: 0.06, volume: 0.08 * mul, pan, filter: { type: 'bandpass', freq: 1800, q: 1.2 } });
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

  clank(at) { // броня Бэтмена приняла удар — металлический щелчок
    // Нарочно НЕ hurt(): тот звук означает «минус сердечко», и если броня
    // будет звучать так же, ребёнок не поймёт, что она сработала.
    const { pan, mul } = this.place(at);
    this.tone({ freq: this.vary(900, 0.06), endFreq: 380, duration: 0.09, type: 'square', volume: 0.24 * mul, pan });
  }

  hurt(at) { // герою досталось — не страшно, а смешно
    const { pan } = this.place(at);
    this.tone({ freq: this.vary(300, 0.05), endFreq: 120, duration: 0.28, type: 'sawtooth', volume: 0.22, pan });
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

  // Фанфары строятся ступенями от тональности игравшей темы, а не всегда от до:
  // тогда победа ДОСТРАИВАЕТ мелодию, под которую ребёнок выиграл. Задержка
  // ждёт, пока stopMusic() догасит музыку, — иначе фанфара стартует поверх неё.
  victory() {
    const root = 261.63 * 2 ** ((this.music?.root ?? 0) / 12);
    [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => {
      this.tone({
        freq: root * 2 ** (n / 12), duration: 0.28, type: 'square',
        volume: 0.24, delay: STINGER_DELAY + i * 0.14,
      });
    });
  }

  fail() { // мягкое «уупс», без драмы
    [400, 340, 280].forEach((f, i) => {
      this.tone({ freq: f, duration: 0.25, type: 'triangle', volume: 0.22, delay: STINGER_DELAY + i * 0.15 });
    });
    this.noise({ duration: 0.15, volume: 0.06, delay: STINGER_DELAY, filter: { type: 'lowpass', freq: 300 } });
  }

  click() {
    this.tone({ freq: this.vary(660, 0.04), duration: 0.06, type: 'square', volume: 0.18 });
  }

  // --- Фоновая музыка ---
  //
  // Сама музыка живёт в core/music.js. Здесь только желаемое состояние: до
  // первого касания страницы контекста нет, а startMusic() уже могли позвать.

  startMusic() {
    this.wantMusic = true;
    this.music?.start();
  }

  stopMusic() {
    this.wantMusic = false;
    this.music?.stop();
  }

  setMusicTheme(themeId) {
    this.themeId = themeId;
    this.music?.setTheme(themeId);
  }

  setDanger(level) {
    this.danger = level;
    this.music?.setDanger(level);
  }

  setBossMode(on) {
    this.bossMode = on;
    this.music?.setBoss(on);
  }

  // Вкладку свернули: планировщик музыки нужно остановить, иначе придушенный
  // до одного герца таймер проснётся с опозданием и высыпет накопившиеся ноты
  // одним залпом — слышно хуже, чем прежний дрейф.
  setVisible(visible) {
    if (!this.music) return;
    if (visible) {
      if (this.wantMusic) this.music.start();
    } else {
      this.music.pause();
    }
  }
}
