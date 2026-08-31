// Кампания: какие главы пройдены и какая открыта.
//
// Тонкая обёртка над куском сохранения — ровно как album.js и
// achievements.js, и по той же причине: Game не должен дедуплицировать руками,
// а карта и меню должны считать прогресс одной функцией.
//
// Порядок глав задаётся конфигом, а не сохранением. В сохранении лежат только
// id пройденных, поэтому добавление тринадцатой главы не требует ни миграции,
// ни единой правки здесь.

import { CONFIG } from '../config.js';

export class Campaign {
  constructor(storage) {
    this.storage = storage;
  }

  get done() {
    return this.storage.data.campaign.done;
  }

  get chapters() {
    return CONFIG.campaign.chapters;
  }

  isDone(id) {
    return this.done.includes(id);
  }

  // Открыта глава — пройденная или первая непройденная. Идём по конфигу, а не
  // по длине done: если состав глав поменяется, «следующая по счёту» уедет, а
  // «первая непройденная» останется верной.
  get currentIndex() {
    const index = this.chapters.findIndex((c) => !this.isDone(c.id));
    return index === -1 ? this.chapters.length - 1 : index;
  }

  isOpen(id) {
    const index = this.chapters.findIndex((c) => c.id === id);
    return index !== -1 && index <= this.currentIndex;
  }

  get isComplete() {
    return this.chapters.every((c) => this.isDone(c.id));
  }

  chapter(id) {
    return this.chapters.find((c) => c.id === id) || null;
  }

  // Отметить главу пройденной. Возвращает true, если она пройдена ВПЕРВЫЕ —
  // по этому признаку показывается вернувшаяся страница. Запись в localStorage
  // не делает: Game сохраняется и без того, одним вызовом в конце раунда.
  complete(id) {
    if (this.isDone(id)) return false;
    this.done.push(id);
    return true;
  }

  reset() {
    this.storage.data.campaign.done = [];
  }
}

// Сколько глав пройдено из скольких — для кнопки в меню и заголовка карты.
export function campaignProgress(save) {
  return {
    open: (save.campaign?.done || []).length,
    total: CONFIG.campaign.chapters.length,
  };
}

// Эмодзи локации: карта и экран победы показывают ими место главы. Держим
// здесь, а не в CONFIG.themes: это подпись для ребёнка, а не свойство фона, и
// тема без эмодзи не должна считаться сломанной.
const THEME_EMOJI = {
  yard: '🏡', park: '🌳', beach: '🏖', space: '🚀',
  cave: '🕳', rink: '⛸', farm: '🌾',
};

export function themeEmoji(themeId) {
  return THEME_EMOJI[themeId] || '📄';
}

// Цвета локации — карта красит ими остановки, и семь разных мест читаются с
// одного взгляда, без чтения подписей.
export function themeColors(themeId) {
  const theme = CONFIG.themes.find((t) => t.id === themeId);
  return { ground: theme?.ground || '#5a5468', accent: theme?.accent || '#4a4459' };
}

export function themeName(themeId) {
  return CONFIG.themes.find((t) => t.id === themeId)?.name || '';
}

export function bossOf(chapter) {
  return CONFIG.bossTypes.find((b) => b.id === chapter.boss) || null;
}

// Задача главы словами — для озвучки на карте и подписи под карточкой.
export function goalText(chapter) {
  const goal = typeof chapter.goal === 'string' ? { kind: chapter.goal } : chapter.goal;
  if (goal.kind === 'zombies') return `Прогони ${goal.count} зомби`;
  if (goal.kind === 'medals') return `Собери ${goal.count} медалек`;
  if (goal.kind === 'survive') return `Продержись ${chapter.duration} секунд`;
  return `Победи босса: ${bossOf(chapter)?.name || ''}`;
}
