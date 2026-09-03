// Особые раунды: каждый четвёртый устроен не как обычный.
//
// Модуль сделан как способности и питомцы: базовый класс, класс на вид,
// реестр и фабрика, спека в CONFIG.specialRounds.
//
// Два правила, которые удерживают модификаторы от превращения в свалку:
//   - onLoot ТОЛЬКО добавляет лут и никогда не отнимает. Лут — источник
//     прокачки, и модификатор, который его режет, ломает баланс там, где
//     этого никто не ищет;
//   - tuneSpawner работает один раз, в конструкторе раунда — в тот же момент,
//     когда спавнер и так считает все свои числа.

import { CONFIG } from '../config.js';
import { Pickup, PickupType } from '../entities/pickup.js';

// Какой модификатор в этом раунде. Детерминированно от номера, не случайно:
// предсказуемость тут и есть удовольствие — ребёнок запоминает, что «на
// четвёртом идёт дождь медалек», и ждёт его. Случайность превратила бы
// подарок в лотерею, а ночь — в неприятный сюрприз. Заодно автотест остаётся
// воспроизводимым: раунд 8 — всегда ночь.
export function modifierForRound(round) {
  const { everyRounds, order } = CONFIG.specialRounds;
  if (round % everyRounds !== 0) return null;
  return order[(round / everyRounds - 1) % order.length];
}

export class RoundModifier {
  constructor(id) {
    this.id = id;
    this.spec = CONFIG.specialRounds[id];
    this.timer = 0;
  }

  get icon() { return this.spec.icon; }
  get announce() { return this.spec.announce; }

  tuneSpawner(spawner) {}          // разово, при создании раунда
  update(dt, world) {}             // каждый кадр
  onLoot(enemy, world) {}          // только добавляет добычу
  drawWorld(ctx, world) {}         // поверх персонажей, до частиц
}

// 🌧 Дождь медалек — раунд-подарок. Спавнер и урон не трогает вообще.
class MedalRain extends RoundModifier {
  constructor() { super('medalRain'); }

  onLoot(enemy, world) {
    if (enemy.isBoss) return;      // у босса свой лут
    for (let i = 0; i < this.spec.extraMedals; i++) {
      world.pickups.push(new Pickup(enemy.x, enemy.y, PickupType.MEDAL));
    }
  }

  update(dt, world) {
    // Потолок обязателен: Pickup.update дёргается по каждому, а магнит
    // соберёт не всё, и поле зарастёт медальками.
    if (world.pickups.length >= this.spec.maxPickups) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = this.spec.dropInterval;

    // Падает в кольце вокруг героя: достаточно близко, чтобы заметить, и
    // достаточно далеко, чтобы захотелось добежать.
    const player = world.player;
    const angle = Math.random() * Math.PI * 2;
    const { dropMinDist, dropRadius } = this.spec;
    const dist = dropMinDist + Math.random() * (dropRadius - dropMinDist);
    const x = clamp(player.x + Math.cos(angle) * dist, 20, world.arena.width - 20);
    const y = clamp(player.y + Math.sin(angle) * dist, 20, world.arena.height - 20);
    world.pickups.push(new Pickup(x, y, PickupType.MEDAL));
  }
}

// 🌙 Ночь — чистая отрисовка, ноль логики. Ни спавнер, ни прицеливание не
// меняются: оружие целится по тем, кто в кадре, а не по освещённым. Иначе
// ребёнок увидит, что оружие «сломалось».
class Night extends RoundModifier {
  constructor() { super('night'); }

  update(dt) {
    this.timer += dt;
  }

  drawWorld(ctx, world) {
    const player = world.player;
    const r = this.spec.lightRadius + Math.sin(this.timer * 2) * this.spec.flicker;

    // Один радиальный градиент даёт и тёмный экран, и мягкую дырку: за
    // внешним радиусом он продолжается последним стопом.
    //
    // Очевидное «залить и вырезать через destination-out» здесь ловушка:
    // мир уже нарисован в этот же canvas, и вырезание сотрёт вместе с
    // темнотой героя и зомби.
    const gradient = ctx.createRadialGradient(
      player.x, player.y, r * 0.45,
      player.x, player.y, r,
    );
    gradient.addColorStop(0, 'rgba(14,18,48,0)');
    gradient.addColorStop(1, this.spec.tint);

    ctx.save();
    ctx.fillStyle = gradient;
    // Запас: мир рисуется внутри тряски, и без него у края экрана мелькала
    // бы светлая полоса.
    ctx.fillRect(-60, -60, world.arena.width + 120, world.arena.height + 120);
    ctx.restore();
  }
}

// 🧟 Волна-толпа: много слабых зомби. Правило balance.md «быстрый — хрупкий»
// здесь читается как «многочисленный — хрупкий».
class Horde extends RoundModifier {
  constructor() { super('horde'); }

  tuneSpawner(spawner) {
    spawner.baseHp = Math.max(1, Math.round(spawner.baseHp * this.spec.hp));
    spawner.availableTypes = spawner.availableTypes.filter((t) => t.hp <= this.spec.maxTypeHp);
    spawner.intervalFactor = this.spec.intervalFactor;
    spawner.batchBonus = this.spec.batchBonus;
    spawner.hordeMaxAlive = this.spec.maxAlive;
  }
}

export const MODIFIER_CLASSES = { medalRain: MedalRain, night: Night, horde: Horde };

export function createModifier(id) {
  const Klass = MODIFIER_CLASSES[id];
  return Klass ? new Klass() : null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
