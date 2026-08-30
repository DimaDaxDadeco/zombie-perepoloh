// Сохранение прогресса в localStorage: монеты, покупки, раунд, звук.

const KEY = 'zombie-perepoloh-save-v1';

const DEFAULT_SAVE = {
  coins: 0,
  round: 1,          // текущий раунд (с него продолжаем игру)
  bestRound: 1,
  totalZombies: 0,   // всего прогнано зомби за всё время
  soundOn: true,
  difficulty: 'easy',// уровень сложности; старые сохранения получают его сами
  playersCount: 1,   // 1 или 2 — игра вдвоём на одном экране
  character: null,   // id выбранного героя; null — выбор ещё не делали
  weapon: null,      // id стартового оружия; null — берём из CONFIG.startingWeapon
  // Второй игрок отдельными полями, а не массивом: load() мержит только
  // верхний уровень, и вложенный массив из старого сохранения пришлось бы
  // чинить миграцией. Плоские поля переживают его бесплатно.
  character2: null,
  weapon2: null,
  shop: { speed: 0, heart: 0, star: 0, magnet: 0, dog: 0, drone: 0 }, // купленные уровни
  album: { zombies: [], bosses: [] },  // открытые наклейки, в порядке встречи
  achievements: [],   // полученные медали, в порядке получения
  // За кого уже играли. Плоский массив id, а не флаг на герое: нужен ровно для
  // медали «Все герои», и заводить ради него объект со статистикой рано.
  heroesPlayed: [],
};

const KEEP_ON_RESET = ['soundOn', 'album', 'achievements', 'heroesPlayed'];

function toIdArray(value) {
  return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
}

export class Storage {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULT_SAVE);
      // Мержим с дефолтом, чтобы старые сохранения переживали новые поля.
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULT_SAVE),
        ...parsed,
        shop: { ...DEFAULT_SAVE.shop, ...(parsed.shop || {}) },
        // Альбом чиним так же, как магазин: правленый localStorage не должен
        // ронять экран. Незнакомые id не отсеиваем — экран идёт по конфигу и
        // просто их не увидит.
        album: {
          zombies: toIdArray(parsed.album?.zombies),
          bosses: toIdArray(parsed.album?.bosses),
        },
        achievements: toIdArray(parsed.achievements),
        heroesPlayed: toIdArray(parsed.heroesPlayed),
      };
    } catch {
      return structuredClone(DEFAULT_SAVE);
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // Нет localStorage (например, приватный режим) — играем без сохранений.
    }
  }

  // Полный сброс: монеты, раунды, покупки и выбранный герой.
  //
  // Что переживает «Новую игру»: soundOn — это настройка, а не прогресс.
  // album и achievements — коллекция ребёнка, а не прохождение: наклейки и
  // медали он собирал сам, и терять их из-за нажатия на большую кнопку обидно
  // и непонятно. heroesPlayed переживает вместе с медалью, которую питает.
  // Стереть всё целиком можно через localStorage.clear() — это операция для
  // взрослого.
  //
  // Следствие, которое чинить НЕ надо: медали вроде «Далеко зашёл» считаются
  // от полей, которые сброс обнуляет (bestRound). После «Новой игры» счётчик
  // начнётся заново, а медаль останется — так и задумано: заслуженное не
  // отбирают.
  reset() {
    const kept = Object.fromEntries(KEEP_ON_RESET.map((key) => [key, this.data[key]]));
    this.data = { ...structuredClone(DEFAULT_SAVE), ...kept };
    this.save();
  }
}
