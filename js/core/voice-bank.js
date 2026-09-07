// Банк записанных фраз: манифест, кеш и воспроизведение.
//
// Фразы лежат готовыми файлами в assets/voice — их делает офлайн
// tools/voice-build.mjs хорошим системным голосом. Ключ в манифесте — сам
// нормализованный текст, поэтому слой умеет ровно одно: «дай буфер для этой
// строки, если он есть».
//
// Играем через Web Audio, а НЕ через <audio>. Причины все из этого кода:
// выключение звука сделано как master.gain = 0, и элемент <audio> его бы
// обошёл; приглушение музыки требует, чтобы голос был узлом того же графа;
// source.onended — точный сигнал «договорил»; и контекст уже разблокирован на
// первом касании страницы, а каждому новому <audio> на iOS нужен свой жест.

import { normalizeVoice } from './voice-text.js';

const MANIFEST = 'assets/voice/manifest.json';

// Сколько ждать файл, прежде чем сказать фразу синтезом. Пятилетка, нажавший
// динамик, обязан услышать что-то СЕЙЧАС: чуть роботный голос — отказ
// несравнимо меньший, чем четверть секунды тишины и непонимание, работает ли
// кнопка. Загрузка при этом продолжается и в следующий раз успеет.
export const WAIT_MS = 250;

export class VoiceBank {
  constructor(audio) {
    this.audio = audio;
    this.ready = false;
    // Совсем отключён: браузер не умеет декодировать формат банка. Без этого
    // флага каждая фраза заикалась бы через таймаут ожидания.
    this.disabled = typeof window === 'undefined';
    this.dir = '';
    this.ext = 'm4a';
    this.urls = new Map();    // текст -> адрес файла
    this.bytes = new Map();   // адрес -> ArrayBuffer
    this.buffers = new Map(); // адрес -> AudioBuffer
    this.broken = new Set();  // тексты, за которыми ходить больше не надо
  }

  // Манифест загружается один раз и молча: его отсутствие — не поломка, а
  // «эта копия игры говорит синтезом». Игра не ждёт его ни одного кадра.
  async load() {
    if (this.disabled) return;
    try {
      const response = await fetch(MANIFEST, { cache: 'default' });
      if (!response.ok) throw new Error(`манифест: ${response.status}`);
      const data = await response.json();
      this.dir = `assets/voice/${data.dir}`;
      this.ext = data.format || 'm4a';
      for (const [text, id] of Object.entries(data.clips)) {
        this.urls.set(text, `${this.dir}/${id}.${this.ext}`);
      }
      this.ready = this.urls.size > 0;
    } catch {
      // Тишины не будет: core/voice.js свалится на синтез речи.
      this.ready = false;
    }
  }

  has(text) {
    return this.ready && !this.disabled && this.urls.has(text) && !this.broken.has(text);
  }

  // Заранее подтянуть байты фраз, которые точно понадобятся. Расшифровку не
  // трогаем: расшифровать четыреста буферов на старте — это мегабайты PCM в
  // памяти ради фраз, до которых ребёнок может и не дойти.
  prefetch(texts) {
    if (!this.ready || this.disabled) return;
    for (const text of texts) {
      const url = this.urls.get(normalizeVoice(text));
      if (url && !this.bytes.has(url)) this.fetchBytes(url).catch(() => {});
    }
  }

  async fetchBytes(url) {
    if (this.bytes.has(url)) return this.bytes.get(url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    const bytes = await response.arrayBuffer();
    this.bytes.set(url, bytes);
    return bytes;
  }

  // Готовый к игре буфер или null. Ошибку не бросает: любой сбой означает
  // «скажи синтезом», и звонящему незачем про него знать.
  async buffer(text) {
    if (!this.has(text)) return null;
    const url = this.urls.get(text);
    if (this.buffers.has(url)) return this.buffers.get(url);
    try {
      const bytes = await this.fetchBytes(url);
      await this.audio.ready();
      // Копия обязательна: decodeAudioData забирает ArrayBuffer себе, и
      // второе воспроизведение той же фразы получило бы пустышку.
      const decoded = await this.audio.ctx.decodeAudioData(bytes.slice(0));
      this.buffers.set(url, decoded);
      return decoded;
    } catch (error) {
      this.fail(text, url, error);
      return null;
    }
  }

  // Первая же ошибка расшифровки (в отличие от отсутствующего файла)
  // выключает банк целиком: если браузер не умеет формат, не умеет он его для
  // всех четырёхсот фраз, и упираться в таймаут на каждой — только заикание.
  fail(text, url, error) {
    this.broken.add(text);
    const missing = !this.bytes.has(url);
    if (missing) {
      console.warn(`[voice] нет файла для «${text}»`);
      return;
    }
    this.disabled = true;
    console.warn('[voice] браузер не умеет формат банка, дальше говорит синтез', error?.message || error);
  }
}
