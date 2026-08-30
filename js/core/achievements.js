// Медали: что ребёнок сумел, а не кого встретил.
//
// Устроено ровно как альбом наклеек (album.js) — тонкая обёртка над куском
// сохранения, — и по той же причине: Round про медали не знает, он лишь
// рассказывает в getSummary(), что случилось за раунд. Решает уже Game, одним
// вызовом в конце раунда, там же, где пишется альбом.
//
// Условия живут в CHECKS внизу файла, тексты и картинки — в CONFIG.achievements.
// Разделение то же, что у способностей, питомцев и модификаторов: спека в
// конфиге, код в реестре.

import { CONFIG } from '../config.js';
import { albumProgress } from './album.js';

export class Achievements {
  constructor(storage) {
    this.storage = storage;
  }

  get data() {
    return this.storage.data.achievements;
  }

  has(id) {
    return this.data.includes(id);
  }

  // Проверить все условия и выдать то, что заслужено впервые.
  //
  // Возвращает спеки новых медалей — их показывает экран конца раунда. Запись
  // в localStorage не делает: Game сохраняется и без того, одним вызовом.
  check(context) {
    const fresh = [];
    for (const spec of CONFIG.achievements) {
      if (this.has(spec.id)) continue;
      const rule = CHECKS[spec.id];
      // Медаль без правила — опечатка в id, а не «условие всегда ложно».
      // Молча пропускать её нельзя: она навсегда останется недостижимой.
      if (!rule) {
        console.warn(`Медаль «${spec.id}» описана в конфиге, но правила для неё нет`);
        continue;
      }
      if (!rule(context)) continue;
      this.data.push(spec.id);
      fresh.push(spec);
    }
    return fresh;
  }

  // Выдать медаль прямо сейчас, вне конца раунда. Нужна тем условиям, которые
  // случаются посреди боя и к его исходу отношения не имеют, — например
  // превращению оружия: раунд после него можно и проиграть.
  unlock(id) {
    if (this.has(id)) return null;
    const spec = CONFIG.achievements.find((a) => a.id === id);
    if (!spec) return null;
    this.data.push(id);
    return spec;
  }
}

// Сколько открыто из скольких — для заголовка альбома.
export function achievementsProgress(save) {
  return {
    open: (save.achievements || []).length,
    total: CONFIG.achievements.length,
  };
}

// --- Условия ---
//
// context = { save, summary, outcome, playersCount }
// summary — то, что вернул Round.getSummary(): факты о прошедшем раунде.
//
// Победа НЕ подразумевается: до конца раунда доходит и поражение. Где победа
// нужна — она проверяется явно, где нет (сто зомби) — не проверяется вовсе,
// иначе медаль за упорство доставалась бы только за удачу.
const CHECKS = {
  noHit: ({ summary, outcome }) => outcome === 'victory' && summary.damageTaken === 0,

  bossByAbility: ({ summary }) => summary.bossKilledBy === 'ability',

  // Пятая звезда и есть превращение: отдельного состояния «пять звёзд без
  // эволюции» в игре не существует (см. levelup.js). Выдаётся не отсюда, а
  // сразу в момент превращения — через unlock(), — потому что раунд после
  // него можно и проиграть, а медаль уже заслужена.
  evolved: ({ summary }) => summary.maxStars >= CONFIG.maxStars,

  arsenal: ({ summary, outcome }) => outcome === 'victory' && summary.weaponsHeld >= 5,

  century: ({ summary }) => summary.zombiesDefeated >= 100,

  hardWin: ({ save, outcome }) => outcome === 'victory' && save.difficulty === 'hard',

  nightWin: ({ summary, outcome }) => outcome === 'victory' && summary.modifierId === 'night',

  hordeWin: ({ summary, outcome }) => outcome === 'victory' && summary.modifierId === 'horde',

  duo: ({ summary, outcome }) => outcome === 'victory' && summary.playersCount > 1,

  // bestRound уже обновлён к моменту проверки — см. порядок в Game.endRound.
  deepRun: ({ save }) => save.bestRound >= 10,

  allHeroes: ({ save }) => save.heroesPlayed.length >= CONFIG.characters.length,

  // Считается по конфигу, а не по длине списка: если глав станет больше,
  // старая медаль не должна оставаться выданной за неполное прохождение.
  pagesBack: ({ save }) => CONFIG.campaign.chapters
    .every((c) => (save.campaign?.done || []).includes(c.id)),

  collector: ({ save }) => {
    const progress = albumProgress(save);
    return progress.zombies.open >= progress.zombies.total
      && progress.bosses.open >= progress.bosses.total;
  },
};
