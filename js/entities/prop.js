// Объекты мира, которые ставит цель раунда: клетка с другом, костёр, ноша и
// место доставки.
//
// Почему отдельная сущность, а не зомби со скоростью ноль: враг попадает в
// счётчик убитых, роняет добычу, заряжает способность, занимает место в
// лимите спавнера и расталкивается толпой. Клетке всё это не нужно и вредно.
//
// Контракт тот же, что у любой сущности в проекте: update(dt, world),
// draw(ctx), alive, x/y/radius. Списком владеет Round — он их обновляет,
// сортирует по Y вместе с персонажами и выметает мёртвых.
//
// Реестра и фабрики здесь намеренно НЕТ, в отличие от питомцев и
// способностей: проп создаёт не строка из сохранения, а конкретная цель
// конкретными параметрами. Фабрика была бы церемонией.

import { CONFIG } from '../config.js';
import {
  drawCage, drawCampfire, drawGiftBox, drawDropZone,
} from '../render/sprites.js';

export class Prop {
  constructor(x, y, spec = {}) {
    this.x = x;
    this.y = y;
    this.spec = spec;
    this.radius = spec.radius ?? 24;
    // 'ground' — рисуется в слое земли, под персонажами. Всё остальное идёт в
    // общую сортировку по Y и честно закрывает того, кто стоит выше.
    this.layer = 'char';
    this.alive = true;
    this.phase = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.phase += dt;
  }

  draw() {}

  // Ближайший игрок НА НОГАХ. Round.nearestPlayer возвращает лежачего, если
  // лежат оба, — и клетка открывалась бы от призрака.
  nearestStandingPlayer(world) {
    let best = null;
    let bestDist = Infinity;
    for (const player of world.players) {
      if (player.downed) continue;
      const dist = Math.hypot(player.x - this.x, player.y - this.y);
      if (dist < bestDist) {
        best = player;
        bestDist = dist;
      }
    }
    return best;
  }

  // Арена изменилась (повернули планшет) — вернуться в кадр. Проп за краем
  // экрана делает главу непроходимой: до него не добежать.
  clampToArena(arena) {
    const m = this.radius + 8;
    this.x = Math.max(m, Math.min(arena.width - m, this.x));
    this.y = Math.max(m, Math.min(arena.height - m, this.y));
  }

  // Круг с кругом, как все столкновения в проекте. reach — запас, чтобы
  // ребёнку не приходилось попадать в пиксель.
  touching(entity) {
    const reach = this.radius + entity.radius + (this.spec.reach ?? 0);
    return Math.hypot(entity.x - this.x, entity.y - this.y) < reach;
  }
}

// Клетка с другом. Игрок стоит рядом — растёт дуга; отошёл — прогресс
// ЗАМИРАЕТ, а не откатывается. Прогресс в этой игре не отбирают нигде, и
// клетка не исключение: ребёнок, которого согнали с места, вернётся и
// продолжит с того же места.
export class Cage extends Prop {
  constructor(x, y, spec, onOpen) {
    super(x, y, spec);
    this.onOpen = onOpen;
    this.progress = 0;
    this.open = false;
  }

  update(dt, world) {
    super.update(dt);
    if (this.open) return;
    const player = this.nearestStandingPlayer(world);
    if (!player || !this.touching(player)) return;

    this.progress = Math.min(1, this.progress + dt / this.spec.holdTime);
    if (this.progress < 1) return;

    this.open = true;
    world.audio.medal();
    world.particles.addBurst(this.x, this.y, 16, 1.1);
    this.onOpen(this, player, world);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    drawCage(ctx, {
      radius: this.radius,
      progress: this.progress,
      open: this.open,
      look: this.spec.look,
    });
    ctx.restore();
  }
}

// Костёр. Зомби рядом его тушат, без них он разгорается сам.
//
// Погаснуть насмерть он НЕ может: heat === 0 — это угли, а не поражение.
// Пока костёр не горит, цель просто не набирает секунды, и счётчик замирает.
// Так «прогресс не отбирают» и «пятилетний не понимает „успей“» соблюдены
// разом: задача звучит не «продержись сорок секунд», а «набери сорок секунд
// огня».
export class Campfire extends Prop {
  constructor(x, y, spec) {
    super(x, y, spec);
    this.heat = 1;
    this.held = 0;    // накоплено секунд горения — это и есть прогресс цели
  }

  update(dt, world) {
    super.update(dt);

    let dousers = 0;
    for (const enemy of world.enemies) {
      if (!enemy.alive || enemy.isHidden || enemy.isBoss) continue;
      if (!this.touching(enemy)) continue;
      dousers += 1;
      // Костёр защищается сам — та же страховка проходимости, что у воришки:
      // подпустить всю толпу вплотную ребёнок может, а погасить костёр за
      // полсекунды толпа не должна. Огонь при этом нелепый, а не страшный:
      // зомби подпрыгивает и отбегает.
      if (this.heat > 0) enemy.ignite(this.spec.burnDps, this.spec.burnTime);
    }

    // Потолок обязателен: без него двадцать зомби тушат костёр мгновенно, и
    // глава становится непроходимой без единого сообщения.
    const capped = Math.min(dousers, this.spec.maxDousers);
    this.heat = capped > 0
      ? Math.max(0, this.heat - this.spec.douseRate * capped * dt)
      : Math.min(1, this.heat + this.spec.relightRate * dt);

    if (this.heat > 0) this.held += dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    drawCampfire(ctx, { radius: this.radius, heat: this.heat, phase: this.phase });
    ctx.restore();
  }
}

// Ноша. Лежит, пока её не подняли; поднятая едет над головой носителя.
export class Load extends Prop {
  constructor(x, y, spec) {
    super(x, y, spec);
    this.carrier = null;
  }

  update(dt, world) {
    super.update(dt);

    if (!this.carrier) {
      const player = this.nearestStandingPlayer(world);
      if (player && this.touching(player)) this.pickUp(player);
      return;
    }

    // Носитель упал — ноша падает там же. Отбирать её за падение было бы
    // наказанием, а игра прогресс не отбирает: она просто лежит и ждёт.
    if (this.carrier.downed) {
      this.drop();
      return;
    }

    this.x = this.carrier.x;
    // Над головой: сортировка по Y тогда сама кладёт ношу поверх героя.
    this.y = this.carrier.y - this.carrier.radius * 2.2;

    // Донесли. Проверяет сама ноша, а не цель: тогда цели не нужен свой
    // покадровый крючок, и её роль остаётся прежней — расставить и посчитать.
    const zone = this.spec.zone;
    if (zone && zone.touching(this.carrier)) this.spec.onDeliver(this, world);
  }

  pickUp(player) {
    this.carrier = player;
    player.carryFactor = this.spec.carryFactor;
  }

  drop() {
    if (this.carrier) {
      this.x = this.carrier.x;
      this.y = this.carrier.y;
      this.carrier.carryFactor = 1;
    }
    this.carrier = null;
  }

  // Донесли. Ноша исчезает, скорость носителю возвращается.
  deliver() {
    if (this.carrier) this.carrier.carryFactor = 1;
    this.carrier = null;
    this.alive = false;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    // Трясётся, только пока лежит: поднятая ноша уже нашлась, и звать
    // больше некого.
    drawGiftBox(ctx, { radius: this.radius, phase: this.phase, shake: !this.carrier });
    ctx.restore();
  }
}

// Куда нести. Светящееся пятно НА ЗЕМЛЕ: герой пробегает его насквозь, а не
// огибает, — та же причина, по которой в слое земли рисуется огненная дорожка.
export class DropZone extends Prop {
  constructor(x, y, spec) {
    super(x, y, spec);
    this.layer = 'ground';
  }

  moveTo(x, y) {
    this.x = x;
    this.y = y;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    drawDropZone(ctx, { radius: this.radius, phase: this.phase });
    ctx.restore();
  }
}

// Точка для объекта цели: не ближе minFromPlayer от каждого игрока и не ближе
// minSpacing от уже расставленных.
//
// Порог по игроку ЗАЖАТ по арене. CONFIG.spawner.minDistanceFromPlayer — это
// 340 пикселей, и на телефоне в альбомной ориентации (700×360) отбор выродился
// бы в «взять первую попавшуюся», то есть клетка встала бы герою в ноги.
export function placeAway(world, taken, { minSpacing = 0, margin = 60 } = {}) {
  const { width, height } = world.arena;
  const minFromPlayer = Math.min(
    CONFIG.spawner.minDistanceFromPlayer,
    Math.min(width, height) * 0.4,
  );
  let best = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 24; i++) {
    const x = margin + Math.random() * (width - margin * 2);
    const y = margin + Math.random() * (height - margin * 2);
    const fromPlayers = Math.min(...world.players.map((p) => Math.hypot(p.x - x, p.y - y)));
    const fromTaken = taken.length
      ? Math.min(...taken.map((t) => Math.hypot(t.x - x, t.y - y)))
      : Infinity;
    if (fromPlayers >= minFromPlayer && fromTaken >= minSpacing) return { x, y };
    // Фолбэк: если за двадцать четыре попытки идеала не нашлось (тесная арена,
    // много объектов), берём самую удачную из виденных. Пустого места не
    // вернуть нельзя — цель без объекта недостижима.
    const score = Math.min(fromPlayers, fromTaken);
    if (score > bestScore) {
      bestScore = score;
      best = { x, y };
    }
  }
  return best;
}
