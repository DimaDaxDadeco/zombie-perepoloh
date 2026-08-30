// Цель раунда: что надо сделать, чтобы он считался пройденным.
//
// Модуль сделан как модификаторы, способности и питомцы: базовый класс, класс
// на вид, реестр и фабрика, спека в CONFIG.goals.
//
// Зачем он вообще появился. Раньше сценарий раунда жил в одном методе
// Round.updateBossPhase: он и тикал таймер, и кормил спавнер, и решал, что
// раунд выигран. Сюжетным главам нужны разные задачи — прогнать столько-то
// зомби, собрать столько-то медалек, просто продержаться, — и четыре сценария
// превратили бы тот метод в лестницу условий. Теперь развилка ровно одна, и
// это вызов метода цели.
//
// Два правила, которые удерживают цели от превращения в свалку:
//   - цель ЧИТАЕТ мир и отвечает «выполнено или нет». Своих действий у неё
//     почти нет: единственное исключение — onTimeUp у боссовой цели, и та
//     дёргает уже существующий публичный метод раунда;
//   - победу объявляет Round.finish('victory'), а не сама цель. Иначе исход
//     перестал бы приходить в onVictory, и автотест начал бы считать
//     пройденную главу проигранной — молча.
//
// И третье, менее очевидное: цель живёт в js/systems/ и не трогает DOM. Для
// HUD она отдаёт ЧИСЛА, а не готовую строку. На этом правиле стоит автотест,
// который поднимает Round в Node без браузера.

import { CONFIG } from '../config.js';

export class Goal {
  constructor(id, params = {}) {
    this.id = id;
    this.spec = { ...(CONFIG.goals[id] || {}), ...params };
  }

  // Сколько нужно набрать. Вдвоём зомби спавнится больше, значит и медалек, и
  // убитых больше — счётные цели пришлось бы проходить вдвое быстрее. Целям
  // без счёта множитель не нужен: там ко-оп уже отбалансирован.
  target(world) {
    const base = this.spec.count || 0;
    return Math.round(base * (world.isCoop ? CONFIG.coop.goalFactor : 1));
  }

  // Раунд с целью без босса легче обычного на всю боевую фазу. Компенсируется
  // тут — тем же крючком и тем же контрактом, что у RoundModifier.tuneSpawner:
  // работает один раз, в конструкторе раунда.
  tuneSpawner() {}

  // Таймер добежал до нуля. Для боссовой цели это «выпускай босса», для
  // «продержись» — победа, для счётных целей таймера нет вовсе.
  onTimeUp() {}

  // Насколько цель близка к выполнению, 0…1. Спавнер разгоняет темп волн по
  // этому числу: у временных целей это доля прошедшего времени, у счётных —
  // доля набранного. Без второго варианта счётная глава шла бы на постоянном
  // максимальном темпе с первой секунды.
  progress(world) {
    return 1 - world.timeLeft / world.duration;
  }

  isComplete() {
    return false;
  }

  // Данные для HUD, не текст: { emoji, done, target }. null — «показывай
  // таймер, как раньше».
  hudLine() {
    return null;
  }

  // Короткая задача словами — её объявляет баннер в начале раунда и произносит
  // голос. null — объявлять нечего (обычный раунд).
  get announce() {
    return null;
  }
}

// Классика: волны, потом босс, смерть босса — победа. Дословно то, что раньше
// было единственным сценарием.
class BossGoal extends Goal {
  onTimeUp(world) {
    world.startBossIntro();
  }

  isComplete(world) {
    return world.bossPhase === 'fight' && world.boss && !world.boss.alive;
  }
}

// Продержаться. Босса нет вовсе, поэтому startBossIntro не зовётся, боевая
// музыка не включается и баннер с именем босса не рисуется — всё это выходит
// само собой, без единой проверки «а есть ли босс».
class SurviveGoal extends Goal {
  tuneSpawner(spawner) {
    spawner.intervalFactor *= this.spec.intervalFactor ?? 1;
    spawner.batchBonus += this.spec.batchBonus ?? 0;
  }

  isComplete(world) {
    return world.timeLeft <= 0;
  }

  hudLine(world) {
    return { emoji: '⏳', done: Math.max(0, Math.ceil(world.timeLeft)), target: null };
  }

  get announce() {
    return 'Продержись!';
  }
}

// Счётные цели. Времени у них нет: проиграть можно только упав. Пятилетний не
// понимает «успей», но прекрасно понимает «набери», и полоса, которая растёт,
// а не тает, читается как прогресс, а не как угроза.
class CountGoal extends Goal {
  done() {
    return 0;
  }

  progress(world) {
    const target = this.target(world);
    return target > 0 ? this.done(world) / target : 1;
  }

  isComplete(world) {
    return this.done(world) >= this.target(world);
  }

  hudLine(world) {
    return { emoji: this.spec.emoji, done: this.done(world), target: this.target(world) };
  }
}

class ZombiesGoal extends CountGoal {
  done(world) {
    return world.zombiesDefeated;
  }

  get announce() {
    return 'Прогони зомби!';
  }
}

class MedalsGoal extends CountGoal {
  done(world) {
    return world.medalsCollected;
  }

  get announce() {
    return 'Собери медальки!';
  }
}

export const GOAL_CLASSES = {
  boss: BossGoal,
  survive: SurviveGoal,
  zombies: ZombiesGoal,
  medals: MedalsGoal,
};

// spec — либо строка-id, либо { kind, count, ... }. Незнакомый вид — боссовый:
// ошибаться надо в сторону играбельного раунда, а не пустой арены без выхода.
export function createGoal(spec = 'boss') {
  const { kind, ...params } = typeof spec === 'string' ? { kind: spec } : spec;
  const Class = GOAL_CLASSES[kind] || GOAL_CLASSES.boss;
  return new Class(GOAL_CLASSES[kind] ? kind : 'boss', params);
}
