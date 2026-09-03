// Путешествие: какие главы пройдены и какая открыта.
//
// Тонкая обёртка над куском сохранения — ровно как album.js и
// achievements.js, и по той же причине: Game не должен дедуплицировать руками,
// а карта и меню должны считать прогресс одной функцией.
//
// Путешествий несколько, но пройденные главы в сохранении лежат ОДНИМ плоским
// списком id. Прогресс путешествия — это пересечение списка с его главами.
// Схема выбрана ради одного: у второго путешествия нет никакой миграции.
// У ребёнка лежат ch1…ch12, они принадлежат первому, и после появления
// второго он видит ровно то же, что видел. Цена — id глав уникальны по всей
// игре; это проверяет тест.
//
// Экземпляр — на путешествие, и он не переключается. Переключаемый объект
// пришлось бы «не забыть сбросить» — ровно то скрытое состояние, которое в
// проекте уже отказались заводить, когда цепочка выбора героя получила
// параметр «куда вернуться» вместо флага «мы пришли с карты».
//
// Порядок глав задаётся конфигом, а не сохранением. В сохранении лежат только
// id пройденных, поэтому добавление тринадцатой главы не требует ни миграции,
// ни единой правки здесь.

import { CONFIG } from '../config.js';

export class Campaign {
  constructor(storage, journey) {
    this.storage = storage;
    this.journey = journey;
  }

  get id() {
    return this.journey.id;
  }

  get spec() {
    return this.journey;
  }

  get chapters() {
    return this.journey.chapters;
  }

  // Весь плоский список пройденного, включая чужие путешествия. Наружу его
  // отдавать незачем — считайте doneCount.
  get done() {
    return this.storage.data.campaign.done;
  }

  isDone(id) {
    return this.done.includes(id);
  }

  // Сколько глав ЭТОГО путешествия пройдено. Именно это число, а не длину
  // общего списка, спрашивают меню, карта и проверка «показывать ли завязку».
  get doneCount() {
    return this.chapters.filter((c) => this.isDone(c.id)).length;
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

  // Открыто ли само путешествие. Первое — всегда; остальные — когда пройдено
  // то, на которое они ссылаются.
  get isOpenJourney() {
    if (!this.journey.needs) return true;
    const needed = CONFIG.journeys.find((j) => j.id === this.journey.needs);
    return Boolean(needed) && needed.chapters.every((c) => this.isDone(c.id));
  }

  chapter(id) {
    return this.chapters.find((c) => c.id === id) || null;
  }

  // Отметить главу пройденной. Возвращает true, если она пройдена ВПЕРВЫЕ —
  // по этому признаку показывается награда. Запись в localStorage не делает:
  // Game сохраняется и без того, одним вызовом в конце раунда.
  complete(id) {
    if (this.isDone(id)) return false;
    this.done.push(id);
    return true;
  }

  // Вычёркивает ТОЛЬКО свои главы: чужое путешествие сбросом не задевается.
  reset() {
    const mine = new Set(this.chapters.map((c) => c.id));
    this.storage.data.campaign.done = this.done.filter((id) => !mine.has(id));
  }
}

// Все путешествия объектами, в порядке конфига.
export function allJourneys(storage) {
  return CONFIG.journeys.map((journey) => new Campaign(storage, journey));
}

// Только те, до которых ребёнок уже дошёл. Закрытые не показываются нигде.
export function openJourneys(storage) {
  return allJourneys(storage).filter((c) => c.isOpenJourney);
}

// Какое путешествие показывать. Вычисляется, а не хранится: `at` в сохранении
// — это подсказка «где я стоял», и если она устарела или испорчена, мы просто
// считаем заново. Правило то же, что у «текущей главы»: текущее — это первое
// открытое и незавершённое.
export function currentJourney(storage) {
  const open = openJourneys(storage);
  const at = storage.data.campaign.at;
  return open.find((c) => c.id === at)
    || open.find((c) => !c.isComplete)
    || open[open.length - 1]
    || allJourneys(storage)[0];
}

// Сколько глав путешествия пройдено из скольких — для кнопки в меню и
// полоски наград на карте.
export function journeyProgress(campaign) {
  return { open: campaign.doneCount, total: campaign.chapters.length };
}

// Значок локации: карта и экран победы показывают им место главы. Держим
// здесь, а не в CONFIG.themes: это подпись для ребёнка, а не свойство фона, и
// тема без значка не должна считаться сломанной.
const THEME_ICON = {
  yard: 'place-yard', park: 'place-park', beach: 'place-beach', space: 'place-space',
  cave: 'place-cave', rink: 'place-rink', farm: 'place-farm',
};

export function themeIcon(themeId) {
  return THEME_ICON[themeId] || 'ui-page';
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
//
// Таблицей, а не лестницей условий: промах в лестнице молча давал «Победи
// босса: », и заметить это можно было бы только глазами. count берётся из
// спеки главы, а если она его не указала — из умолчания цели, иначе карта
// сказала бы «Освободи undefined друзей».
const GOAL_TEXT = {
  zombies: (g) => `Прогони ${g.count} зомби`,
  medals: (g) => `Собери ${g.count} медалек`,
  survive: (g, chapter) => `Продержись ${chapter.duration} секунд`,
  rescue: (g) => `Освободи ${g.count} друзей`,
  delivery: (g) => `Отнеси вещь ${g.count} раза`,
  campfire: (g) => `Береги костёр ${g.count} секунд`,
  thief: (g) => (g.count > 1 ? `Поймай ${g.count} воришек` : 'Поймай воришку'),
};

export function goalText(chapter) {
  const spec = typeof chapter.goal === 'string' ? { kind: chapter.goal } : chapter.goal;
  const text = GOAL_TEXT[spec.kind];
  if (!text) return `Победи босса: ${bossOf(chapter)?.name || ''}`;
  return text({ ...CONFIG.goals[spec.kind], ...spec }, chapter);
}
