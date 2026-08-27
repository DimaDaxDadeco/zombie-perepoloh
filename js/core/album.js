// Альбом наклеек: кого ребёнок уже встретил.
//
// Тонкая обёртка над куском сохранения — чтобы Game не дедуплицировал руками,
// а меню и экран считали прогресс одной функцией.

import { CONFIG } from '../config.js';

export class Album {
  constructor(storage) {
    this.storage = storage;
  }

  get data() {
    return this.storage.data.album;
  }

  has(kind, id) {
    return this.data[kind].includes(id);
  }

  // Возвращает только по-настоящему новые наклейки — их и показывает экран
  // конца раунда. Запись в localStorage не делает: Game сохраняет и без того,
  // одним вызовом в конце раунда.
  discoverAll({ zombies = [], bosses = [] } = {}) {
    return {
      zombies: this.add('zombies', zombies),
      bosses: this.add('bosses', bosses),
    };
  }

  add(kind, ids) {
    const fresh = ids.filter((id) => !this.has(kind, id));
    this.data[kind].push(...fresh);
    return fresh;
  }
}

// Сколько открыто из скольких — для кнопки в меню и заголовка альбома.
export function albumProgress(save) {
  const album = save.album || { zombies: [], bosses: [] };
  return {
    zombies: { open: album.zombies.length, total: CONFIG.zombieTypes.length },
    bosses: { open: album.bosses.length, total: CONFIG.bossTypes.length },
  };
}
