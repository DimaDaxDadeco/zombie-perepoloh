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
import { Cage, Campfire, Load, DropZone, placeAway } from '../entities/prop.js';
import { createPet } from '../entities/pet.js';
import { Thief } from '../entities/thief.js';

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
  //
  // Живёт в базовом классе, а не у одной цели: полей может не быть, и тогда
  // множители нейтральны — у боссовой и счётных целей выходит ровно то же
  // самое, что раньше делал пустой метод.
  tuneSpawner(spawner) {
    spawner.intervalFactor *= this.spec.intervalFactor ?? 1;
    spawner.batchBonus += this.spec.batchBonus ?? 0;
  }

  // Расставить свои объекты мира: клетку, костёр, ношу. Зовётся ОДИН раз,
  // последней строкой конструктора Round, когда готовы и арена, и игроки.
  // Кладут их через world.addProp() — списком владеет раунд, а не цель.
  setup() {}

  // Куда на самом деле идёт этот зомби. null — «как обычно, к ближайшему
  // игроку». Через него глава с костром уводит толпу от героя, и это
  // единственный способ поменять цель зомби, не заводя ему нового поведения.
  lureFor() { return null; }

  // Куда бежать боту автотеста. Единственный метод здесь, существующий
  // РАДИ ТЕСТА, и это осознанный размен: бот умеет только убегать от зомби, а
  // новые задачи требуют бежать К чему-то. Альтернатива — копия игровых
  // правил внутри харнесса, а он не считает ничего сам принципиально.
  // null у всех старых целей, поэтому смоук и балансная сетка идут прежним
  // кодом байт в байт.
  botHint() { return null; }

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
  isComplete(world) {
    return world.timeLeft <= 0;
  }

  hudLine(world) {
    return { icon: 'ui-timer', done: Math.max(0, Math.ceil(world.timeLeft)), target: null };
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
    return { icon: this.spec.icon, done: this.done(world), target: this.target(world) };
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


// --- Цели со своими объектами мира ---
//
// Все четыре ставят пропы в setup() и читают их в done(). Пропами владеет
// Round: он их обновляет, сортирует по Y и выметает мёртвых. Цель только
// расставляет и считает — роль, описанная в шапке этого файла, сохраняется.

// Освободить друзей из клеток. Ребёнок впервые бежит К точке и стоит там, а
// не убегает: новая глагольная форма, а не новые числа.
class RescueGoal extends CountGoal {
  // Поля заводятся здесь, а не в setup: setup зовётся на первом кадре, а
  // спросить done() и botHint() могут раньше — бот автотеста делает это до
  // первого update.
  constructor(id, params) {
    super(id, params);
    this.cages = [];
  }

  setup(world) {
    for (let i = 0; i < this.target(world); i++) {
      const at = placeAway(world, this.cages, { minSpacing: this.spec.minSpacing });
      const cage = new Cage(at.x, at.y, this.spec, (c, player, w) => this.freeFriend(c, player, w));
      this.cages.push(world.addProp(cage));
    }
  }

  // Спасённый достаётся тому, кто открыл: вдвоём это и есть награда за то,
  // что разошлись по разным клеткам.
  freeFriend(cage, player, world) {
    const friend = createPet(this.spec.friendPet, cage.x, cage.y, player);
    if (friend) player.pets.push(friend);
    void world;
  }

  done() {
    return this.cages.filter((cage) => cage.open).length;
  }

  botHint(world, player) {
    const left = this.cages.filter((cage) => !cage.open);
    if (!left.length) return null;
    return left.reduce((best, cage) => (
      Math.hypot(cage.x - player.x, cage.y - player.y)
        < Math.hypot(best.x - player.x, best.y - player.y) ? cage : best));
  }

  get announce() {
    return 'Освободи друзей!';
  }
}

// Отнести ношу на светлое место. Единственная задача, где ребёнок чем-то
// жертвует ради цели: с ношей он бежит медленнее.
class DeliveryGoal extends CountGoal {
  constructor(id, params) {
    super(id, params);
    this.delivered = 0;
    this.loads = [];
    this.zone = null;
  }

  setup(world) {
    this.zone = world.addProp(new DropZone(0, 0, { radius: this.spec.zoneRadius }));
    // Нош столько же, сколько игроков: вдвоём иначе второй бегает без дела.
    this.loads = world.players.map(() => world.addProp(new Load(0, 0, {
      radius: this.spec.loadRadius,
      carryFactor: this.spec.carryFactor,
      zone: this.zone,
      onDeliver: (load, w) => this.onDeliver(load, w),
    })));
    this.placeZone(world);
    for (const load of this.loads) this.placeLoad(load, world);
  }

  placeZone(world) {
    const at = placeAway(world, [], { minSpacing: 0 });
    this.zone.moveTo(at.x, at.y);
  }

  // Ноша не должна появиться рядом с местом доставки: иначе главу проходят,
  // не сходя с пятна.
  placeLoad(load, world) {
    for (let i = 0; i < 12; i++) {
      const at = placeAway(world, this.loads.filter((l) => l !== load), { minSpacing: 120 });
      const far = Math.hypot(at.x - this.zone.x, at.y - this.zone.y) >= this.spec.minRunDistance;
      if (far || i === 11) {
        load.x = at.x;
        load.y = at.y;
        return;
      }
    }
  }

  onDeliver(load, world) {
    load.drop();
    this.delivered += 1;
    world.audio.medal();
    world.particles.addBurst(this.zone.x, this.zone.y, 14, 1);
    // Последнюю доставку не переставляем: раунд закончится в этом же кадре, и
    // мигнувшая на новом месте ноша была бы обманом.
    if (this.done() >= this.target(world)) return;
    this.placeZone(world);
    this.placeLoad(load, world);
  }

  done() {
    return this.delivered;
  }

  botHint(world, player) {
    if (!this.zone) return null;
    const mine = this.loads.find((load) => load.carrier === player);
    if (mine) return this.zone;
    return this.loads.find((load) => !load.carrier) || null;
  }

  get announce() {
    return 'Отнеси на светлое место!';
  }
}

// Беречь костёр. Единственная задача, где ребёнок бежит В толпу, а не от неё.
class CampfireGoal extends CountGoal {
  constructor(id, params) {
    super(id, params);
    this.fire = null;
  }

  setup(world) {
    const at = placeAway(world, [], { minSpacing: 0 });
    this.fire = world.addProp(new Campfire(at.x, at.y, this.spec));
  }

  // Кто идёт тушить. Решение фиксируется НА ЗОМБИ один раз: пересматривай его
  // каждые retargetTime секунд — и зомби заметался бы между героем и костром,
  // ровно та болезнь, из-за которой retargetTime вообще появился.
  //
  // Доля меньше единицы намеренно: если к костру уйдут все, глава превратится
  // в статичную оборону, а ребёнок умеет только бегать.
  lureFor(enemy) {
    if (!this.fire || enemy.isBoss) return null;
    if (enemy.luredToFire === undefined) enemy.luredToFire = Math.random() < this.spec.lureShare;
    return enemy.luredToFire && this.fire.heat > 0 ? this.fire : null;
  }

  done() {
    return this.fire ? Math.floor(this.fire.held) : 0;
  }

  // Боту — встать между костром и ближайшим к нему зомби.
  botHint(world) {
    if (!this.fire) return null;
    let closest = null;
    let best = Infinity;
    for (const enemy of world.enemies) {
      if (!enemy.alive || enemy.isHidden) continue;
      const dist = Math.hypot(enemy.x - this.fire.x, enemy.y - this.fire.y);
      if (dist < best) { best = dist; closest = enemy; }
    }
    if (!closest) return this.fire;
    return { x: (closest.x + this.fire.x) / 2, y: (closest.y + this.fire.y) / 2 };
  }

  get announce() {
    return 'Береги костёр!';
  }
}

// Догнать воришку. Единственная задача, где ребёнок догоняет, а не убегает.
class ThiefGoal extends CountGoal {
  constructor(id, params) {
    super(id, params);
    this.caught = 0;
    this.thieves = [];
  }

  // Воришки выходят ВОЛНАМИ, по atOnce разом, а не все сразу.
  //
  // Иначе не влезают: семь штук с приличным разносом на арене 900×600 не
  // расставить, отбор точек сваливается в запасной вариант и ставит их кучей
  // — а куча ловится залпом. Глава на семь воришек проходилась за те же
  // одиннадцать секунд, что и на пять.
  setup(world) {
    this.released = 0;
    this.refill(world);
  }

  refill(world) {
    while (this.thieves.filter((t) => t.alive).length < this.spec.atOnce
      && this.released < this.target(world)) {
      this.released += 1;
      const at = placeAway(world, this.thieves.filter((t) => t.alive), {
        minSpacing: this.spec.minSpacing, margin: this.spec.startMargin,
      });
      const thief = new Thief(at.x, at.y, this.spec, world, (t, w) => this.onCatch(t, w));
      this.thieves.push(thief);
      world.addEnemy(thief);
    }
  }

  onCatch(thief, world) {
    this.caught += 1;
    this.refill(world);
  }

  done() {
    return this.caught;
  }

  botHint(world, player) {
    const left = this.thieves.filter((t) => t.alive);
    if (!left.length) return null;
    return left.reduce((best, t) => (
      Math.hypot(t.x - player.x, t.y - player.y)
        < Math.hypot(best.x - player.x, best.y - player.y) ? t : best));
  }

  get announce() {
    return 'Догони воришку!';
  }
}

export const GOAL_CLASSES = {
  boss: BossGoal,
  survive: SurviveGoal,
  zombies: ZombiesGoal,
  medals: MedalsGoal,
  rescue: RescueGoal,
  delivery: DeliveryGoal,
  campfire: CampfireGoal,
  thief: ThiefGoal,
};

// spec — либо строка-id, либо { kind, count, ... }. Незнакомый вид — боссовый:
// ошибаться надо в сторону играбельного раунда, а не пустой арены без выхода.
export function createGoal(spec = 'boss') {
  const { kind, ...params } = typeof spec === 'string' ? { kind: spec } : spec;
  const Class = GOAL_CLASSES[kind] || GOAL_CLASSES.boss;
  return new Class(GOAL_CLASSES[kind] ? kind : 'boss', params);
}
