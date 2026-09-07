// Стенд звука: каждый звук по кнопке, залп из двадцати, темы и слои музыки,
// живой показ сжатия на лимитере и обе дороги голоса.
//
// ЗАЧЕМ. В звуке сорок чисел — частоты, громкости, пороги, интервалы — и
// крутить их, перезагружая игру и добегая до нужного события, невозможно.
// Отдельно проверяется то, что глазами не видно вовсе: хрипит ли толпа. Один
// «поп» звучит нормально всегда, а восемь в одном кадре — это и есть тот
// случай, ради которого в графе стоит лимитер.
//
// Живёт вкладкой на общей странице стендов (preview.html). mount() возвращает
// функцию остановки: без неё цикл показа сжатия копился бы при каждом
// переключении вкладки.

import { Audio } from '../js/core/audio.js';
import { Speech } from '../js/core/speech.js';
import { VoiceBank } from '../js/core/voice-bank.js';
import { Voice } from '../js/core/voice.js';
import { allPhrases } from '../js/core/phrases.js';
import { CONFIG } from '../js/config.js';

export const title = 'Звук';
export const about = 'Все звуки по кнопке, залп из двадцати, темы и слои музыки, лимитер под нагрузкой';

// Звуки, которым нужна позиция: у них проверяется ещё и панорама.
const POSITIONAL = ['pop', 'boom', 'zap', 'medal', 'money', 'splat', 'clank', 'hurt', 'bite'];

const SOUNDS = [
  'shoot', 'pop', 'boom', 'zap', 'flame', 'freeze', 'slash', 'medal', 'money',
  'levelUp', 'bonesCollapse', 'bonesRise', 'splat', 'whistle', 'beam', 'buzz',
  'bite', 'abilityReady', 'abilityUse', 'clank', 'hurt', 'bossAppear',
  'special', 'evolve', 'victory', 'fail', 'click',
];

export function mount(root) {
  root.innerHTML = `
    <div id="bgs" class="bgs"></div>
    <div id="report" class="report"></div>
    <div id="out"></div>
  `;
  const $ = (sel) => root.querySelector(sel);

  const audio = new Audio(true);
  audio.unlock();
  const speech = new Speech(true);
  const bank = new VoiceBank(audio);
  const voice = new Voice({ audio, speech, bank, enabled: true });
  bank.load();

  // Слушателя ставим в центр условной арены: без него панорама всегда по
  // центру, и проверять её было бы нечем.
  audio.panHalf = 450;
  audio.listenerX = 450;
  audio.listenerY = 300;

  let pan = 0; // -1 слева, 0 по центру, 1 справа

  const out = $('#out');
  const row = (label) => {
    const box = document.createElement('div');
    box.className = 'bgs';
    box.innerHTML = `<b style="min-width:130px">${label}</b>`;
    out.appendChild(box);
    return box;
  };
  const button = (box, label, onClick) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.onclick = onClick;
    box.appendChild(btn);
    return btn;
  };

  const where = () => ({ x: audio.listenerX + pan * audio.panHalf, y: audio.listenerY });

  const panRow = row('панорама');
  for (const [label, value] of [['слева', -1], ['по центру', 0], ['справа', 1]]) {
    button(panRow, label, () => { pan = value; });
  }

  const soundRows = [row('звуки'), row('звуки'), row('звуки')];
  SOUNDS.forEach((name, i) => {
    button(soundRows[Math.floor(i / 9)], name, () => {
      if (POSITIONAL.includes(name)) audio[name](where());
      else audio[name]();
    });
  });

  // Главное на этом стенде. Двадцать «попов» в одном кадре — это помидор,
  // положивший толпу; раньше сумма их пиков уходила далеко за полную шкалу.
  const stress = row('нагрузка');
  button(stress, '20 попов в одном кадре', () => {
    for (let i = 0; i < 20; i++) {
      audio.pop({ x: audio.listenerX + (Math.random() * 2 - 1) * audio.panHalf, y: audio.listenerY });
    }
  });
  button(stress, '5 взрывов', () => {
    for (let i = 0; i < 5; i++) audio.boom(where());
  });
  button(stress, '8 медалек подряд', () => {
    for (let i = 0; i < 8; i++) setTimeout(() => audio.medal(where()), i * 200);
  });

  const musicRow = row('музыка');
  button(musicRow, 'играть', () => audio.startMusic());
  button(musicRow, 'стоп', () => audio.stopMusic());
  button(musicRow, 'босс вкл', () => audio.setBossMode(true));
  button(musicRow, 'босс выкл', () => audio.setBossMode(false));

  const themeRow = row('локация');
  for (const theme of CONFIG.themes) {
    button(themeRow, theme.id, () => audio.setMusicTheme(theme.id));
  }

  const dangerRow = row('напряжение');
  for (const level of [0, 0.3, 0.65, 0.9]) {
    button(dangerRow, String(level), () => audio.setDanger(level));
  }

  // Голос: обе дороги. Принудительное выключение банка — единственный способ
  // услышать, как игра звучит там, где формат не поддерживается.
  const voiceRow = row('голос');
  const samples = allPhrases();
  button(voiceRow, 'подпись', () => voice.label(samples.describeCard[10], { source: 'button' }));
  button(voiceRow, 'объявление', () => voice.announce(samples.fixedLines[20]));
  button(voiceRow, 'босс', () => voice.alert(samples.fixedLines[0]));
  button(voiceRow, 'три подряд', () => voice.script(samples.fixedLines.slice(1, 4)));
  button(voiceRow, 'молчать', () => voice.stop());
  const bankBtn = button(voiceRow, 'банк: ?', () => {
    bank.disabled = !bank.disabled;
    syncBank();
  });
  const syncBank = () => {
    if (bank.disabled) bankBtn.textContent = 'банк выключен (синтез)';
    else if (!bank.ready) bankBtn.textContent = 'банка нет (синтез)';
    else bankBtn.textContent = `банк включён (${bank.urls.size})`;
  };

  const enabledRow = row('кнопка звука');
  button(enabledRow, 'выключить', () => audio.setEnabled(false));
  button(enabledRow, 'включить', () => audio.setEnabled(true));

  // Сжатие на лимитере: единицы децибел — норма, десятки означают, что звук
  // задавлен и толпа перестала быть громче одиночки.
  let frame = 0;
  const report = $('#report');
  const loop = () => {
    const reduction = audio.limiter ? audio.limiter.reduction : 0;
    report.textContent = `сжатие на лимитере: ${reduction.toFixed(1)} дБ`
      + ` | музыка ${audio.musicBus ? audio.musicBus.gain.value.toFixed(2) : '-'}`
      + ` | звуки ${audio.sfxBus ? audio.sfxBus.gain.value.toFixed(2) : '-'}`
      + ` | приглушений ${audio.ducks}`;
    syncBank();
    frame = requestAnimationFrame(loop);
  };
  loop();

  return () => {
    cancelAnimationFrame(frame);
    voice.stop();
    audio.stopMusic();
    audio.setEnabled(false);
  };
}
