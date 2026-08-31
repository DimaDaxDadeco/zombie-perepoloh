// Герой: мальчик-супергерой. Двигается по стрелкам, оружие стреляет само.

import { CONFIG } from '../config.js';
import {
  drawHero, drawShadow, drawAbilitySparks, drawAbilityEffect,
  drawPlayerMarker, drawDownedTimer, drawStinkCloud, drawArmorShield,
} from '../render/sprites.js';

// Реже стреляет — значит выстрел заметнее, и показать его важнее.
function isRarer(weapon, other) {
  const cooldown = (w) => (typeof w.stat === 'function' ? w.stat('cooldown') ?? 0 : 0);
  return cooldown(weapon) > cooldown(other);
}

export class Player {
  constructor(x, y, {
    speed, maxHp, magnetRadius, look, regenInterval, stinkRadius, armorEvery,
  }) {
    this.x = x;
    this.y = y;
    // Радиус — геттер, потому что Ярость Халка временно раздувает героя, а
    // радиус читают столкновения, притяжение медалек и рисовка. Один геттер
    // честнее, чем множитель, подставленный в каждом месте вызова.
    this.baseRadius = CONFIG.player.radius;
    this.speed = speed;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.magnetRadius = magnetRadius;
    // Перк Мистера Хэнки: зомби в этом радиусе ползут медленнее. У прочих
    // героев ноль, и проход по врагам не запускается вовсе.
    this.stinkRadius = stinkRadius || 0;
    // Перк Бэтмена: каждый armorEvery-й укус костюм держит. Ноль у прочих
    // героев — тогда броня не считается вовсе.
    this.armorEvery = armorEvery || 0;
    this.bitesTaken = 0;
    this.armorFlash = 0;   // пока идёт — на герое видна вспышка щита
    this.blocked = false;  // последний укус приняла броня — читается сразу после takeDamage
    // Интервал регенерации зависит от уровня сложности, поэтому приходит
    // снаружи. Фолбэк — для автотеста и неполных upgrades.
    this.regenInterval = regenInterval ?? CONFIG.player.regenInterval;
    this.look = look; // внешность выбранного персонажа

    // Ледяной босс примораживает героя — временно замедляет.
    this.chillTimer = 0;
    this.chillFactor = 1;

    // Суперспособность героя. Экземпляр создаёт Round — Player не должен
    // знать про CONFIG.characters.
    this.ability = null;
    this.turboTimer = 0;
    // Спин-дэш Соника: пока тикает, шаг считается по rollAngle, а не по
    // тому, куда жмёт ребёнок.
    this.rollTimer = 0;
    this.rollAngle = 0;
    this.rollSpeed = 0;
    // Ярость Халка: герой временно больше и неуязвим.
    this.rageTimer = 0;
    this.sizeFactor = 1;    // турбо Робота: оружие стреляет чаще
    this.glowPhase = 0;     // фаза пульсации свечения «способность готова»

    this.invulnTimer = 0;
    this.regenTimer = 0;
    this.walkPhase = 0;
    this.facing = 1;
    // Куда герой бежал последний раз. facing хранит только «влево/вправо», а
    // спин-дэшу нужен настоящий угол: иначе рывок вверх уезжает вбок.
    this.moveAngle = 0;

    this.weapons = [];   // экземпляры Weapon, добавляются через карточки прокачки
    // В руке показываем то оружие, что стреляло последним, — так видна связь
    // между картинкой и выстрелом. Таймер не даёт стволу мигать, когда
    // несколько оружий стреляют вперемешку.
    this.activeWeapon = null;
    this.activeWeaponTimer = 0;
    // Игра вдвоём: индекс, цвет кольца у ног и состояние «упал».
    this.index = 0;
    this.color = null;
    this.downed = false;
    this.reviveTimer = 0;
  }

  get radius() {
    return this.baseRadius * this.sizeFactor;
  }

  get isAlive() {
    return this.hp > 0;
  }

  // Упал — но не выбыл: лежит призраком, через несколько секунд встаёт.
  // Убирать его с поля нельзя, пятилетний решит, что его выкинули из игры.
  down() {
    this.downed = true;
    this.hp = 0;
    this.reviveTimer = CONFIG.coop.reviveTime;
  }

  revive() {
    // Костюм после подъёма чинится, причём так, что СЛЕДУЮЩИЙ укус он примет.
    // Это милость, а не арифметика: встаёшь с одним сердечком, и настоящий
    // укус в этот момент читался бы как «игра меня добила».
    this.bitesTaken = this.armorEvery ? this.armorEvery - 1 : 0;
    this.downed = false;
    this.hp = 1;
    this.invulnTimer = CONFIG.coop.reviveInvuln;
  }

  get isInvulnerable() {
    return this.invulnTimer > 0 || this.downed || this.isRolling || this.isRaging;
  }

  // Катится шаром: сшибает всех на пути и сам неуязвим.
  get isRolling() {
    return this.rollTimer > 0;
  }

  // В ярости: больше, неуязвим, и всё, что коснулось, гибнет.
  get isRaging() {
    return this.rageTimer > 0;
  }

  get isChilled() {
    return this.chillTimer > 0;
  }

  // Множители скорости бега и скорострельности — по образцу Zombie.speedFactor.
  get speedFactor() {
    return this.chillTimer > 0 ? this.chillFactor : 1;
  }

  get fireRateFactor() {
    return this.turboTimer > 0 ? CONFIG.abilities.turbo.rate : 1;
  }

  // Приморозить героя: factor 0.55 — заметно медленнее, но убежать можно.
  chill(factor, duration) {
    this.chillFactor = factor;
    this.chillTimer = Math.max(this.chillTimer, duration);
  }

  // Пускает героя катиться. Направление берём из последнего движения: катиться
  // «в никуда» у стоящего нельзя, поэтому фолбэк — туда, куда он смотрит.
  roll(angle, speed, duration) {
    this.rollAngle = angle;
    this.rollSpeed = speed;
    this.rollTimer = Math.max(this.rollTimer, duration);
  }

  rage(size, duration) {
    this.sizeFactor = size;
    this.rageTimer = Math.max(this.rageTimer, duration);
  }

  turbo(duration) {
    this.turboTimer = Math.max(this.turboTimer, duration);
  }

  // Оружие выстрелило — оно и оказывается в руке. Чужой ствол не перехватывает
  // руку, пока не истёк короткий таймер удержания: без него при стрельбе из
  // нескольких оружий разом картинка в руке мельтешила бы каждый кадр.
  //
  // Исключение — редкое оружие: ракета стреляет раз в три секунды, и без
  // приоритета её бы вечно перебивал частый водяной пистолет, так что в руке
  // она не появлялась бы вовсе.
  setActiveWeapon(weapon) {
    const busy = this.activeWeapon && this.activeWeapon !== weapon
      && this.activeWeaponTimer > 0;
    if (busy && !isRarer(weapon, this.activeWeapon)) return;

    this.activeWeapon = weapon;
    this.activeWeaponTimer = CONFIG.player.weaponHoldTime;
  }

  // Урон из внешнего источника (огоньки огненного босса).
  takeHit(world) {
    if (this.isInvulnerable) return;
    if (this.takeDamage()) world.onPlayerHurt();
    else if (this.blocked) world.onPlayerBlocked(this);
  }

  update(dt, world, direction) {
    if (this.downed) {
      this.updateRevive(dt, world);
      return;
    }
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.armorFlash = Math.max(0, this.armorFlash - dt);
    this.chillTimer = Math.max(0, this.chillTimer - dt);
    this.turboTimer = Math.max(0, this.turboTimer - dt);
    this.rollTimer = Math.max(0, this.rollTimer - dt);
    this.rageTimer = Math.max(0, this.rageTimer - dt);
    if (this.rageTimer === 0) this.sizeFactor = 1;
    this.activeWeaponTimer = Math.max(0, this.activeWeaponTimer - dt);
    this.glowPhase += dt * 4;
    this.ability?.update(dt, world, this);   // порталу нужен мир: он тянет зомби каждый кадр
    this.updateRegen(dt, world);

    // Спин-дэш ведёт героя сам: управление на это время отнимается, иначе
    // рывок превращается в обычный бег с ускорением.
    if (this.isRolling) {
      this.x += Math.cos(this.rollAngle) * this.rollSpeed * dt;
      this.y += Math.sin(this.rollAngle) * this.rollSpeed * dt;
      this.walkPhase += dt * 20;
      this.clampToArena(world.arena);
      this.updateWeapons(dt, world);
      return;
    }

    const speed = this.speed * this.speedFactor;
    const moving = direction.x !== 0 || direction.y !== 0;
    if (moving) {
      this.x += direction.x * speed * dt;
      this.y += direction.y * speed * dt;
      this.walkPhase += dt * 9;
      this.moveAngle = Math.atan2(direction.y, direction.x);
      if (direction.x !== 0) this.facing = direction.x > 0 ? 1 : -1;
    } else {
      this.walkPhase = 0;
    }

    this.clampToArena(world.arena);

    this.updateWeapons(dt, world);
    this.updateStink(world);
  }

  // Вонючее облако: всех вокруг замедляет, пока они рядом.
  //
  // Нового состояния у зомби не заводит — та же freeze(), что у липких пятен
  // паутины, коротким импульсом каждый кадр. Вышел из облака — импульс не
  // продлевается, и зомби разгоняется сам. Третьим аргументом идёт «без
  // льда»: вонь замедляет, а не морозит.
  //
  // Живёт на герое, а не в Round: аура принадлежит конкретному игроку, и
  // вдвоём у каждого своя.
  updateStink(world) {
    if (!this.stinkRadius) return;
    const factor = CONFIG.player.stinkFactor;
    for (const enemy of world.enemies) {
      if (!enemy.alive || enemy.isHidden) continue;
      if (Math.hypot(enemy.x - this.x, enemy.y - this.y) > this.stinkRadius + enemy.radius) continue;
      enemy.freeze(factor, 0.15, false);
    }
  }

  // Турбо ускоряет всё оружие разом: мы просто ускоряем для него время.
  // Так способность работает и с вертушкой, у которой свой update() без
  // перезарядки, и ни один из классов оружия про турбо не знает.
  updateWeapons(dt, world) {
    const weaponDt = dt * this.fireRateFactor;
    for (const weapon of this.weapons) {
      weapon.update(weaponDt, world, this);
    }
  }

  // Напарник рядом поднимает быстрее — приятный бонус, который учит
  // помогать, но не обязателен: таймер дойдёт и сам.
  updateRevive(dt, world) {
    const helper = world.players.some((p) => p !== this && !p.downed
      && Math.hypot(p.x - this.x, p.y - this.y) < CONFIG.coop.reviveRadius);
    this.reviveTimer -= dt * (helper ? CONFIG.coop.reviveHelpFactor : 1);
    if (this.reviveTimer <= 0) {
      this.revive();
      world.onPlayerRevived?.(this);
    }
  }

  // Сердечки понемногу восстанавливаются сами: у ребёнка не должно
  // накапливаться необратимого урона за долгий раунд.
  updateRegen(dt, world) {
    if (this.hp >= this.maxHp) {
      this.regenTimer = 0;
      return;
    }
    this.regenTimer += dt;
    if (this.regenTimer >= this.regenInterval) {
      this.regenTimer = 0;
      this.hp += 1;
      world.onPlayerHealed();
    }
  }

  clampToArena({ width, height }) {
    const r = this.radius;
    this.x = Math.min(Math.max(this.x, r), width - r);
    this.y = Math.min(Math.max(this.y, r), height - r);
  }

  // Возвращает true, если сердечко действительно отнялось.
  //
  // Возвращаемое значение трогать нельзя: по нему вызывающие решают, звать ли
  // onPlayerHurt и расталкивать ли толпу. Но у false стало два разных смысла —
  // «неуязвим, ничего не было» и «броня приняла удар», — и различает их флаг
  // blocked. Он живёт ровно до следующего вызова: оба места читают его сразу
  // же, следующей строкой.
  takeDamage() {
    this.blocked = false;
    if (this.isInvulnerable || this.downed) return false;

    // Счётчик растёт ПОСЛЕ проверок: удар, пришедшийся в неуязвимость, брони
    // не тратит.
    this.bitesTaken += 1;
    if (this.armorEvery && this.bitesTaken % this.armorEvery === 0) {
      // Неуязвимость после блока короче обычной. Замер показал неочевидное:
      // от укусов в упор она не защищает вовсе — там паузу в 3–5 секунд
      // держит pushEnemiesAway, которая расталкивает толпу и на блоке тоже, и
      // окно просто не успевает пригодиться. Зато она заметно решает на уроне,
      // приходящем МИМО столкновений (takeHit: огоньки, торт, молния) — там
      // расталкивания нет, и без неё герой теряет десять побед из ста
      // шестидесяти пяти. Долю же блоков держит сам счётчик, а не окно.
      this.invulnTimer = CONFIG.player.armorInvulnTime;
      this.armorFlash = CONFIG.player.armorFlashTime;
      this.blocked = true;
      return false;
    }

    this.hp -= 1;
    this.invulnTimer = CONFIG.player.invulnTime;
    if (this.hp <= 0) this.down();
    return true;
  }

  // Возвращает true, если поднялся уровень.
  addXp(amount) {
    this.xp += amount;
    if (this.xp < this.xpToNext) return false;
    this.xp -= this.xpToNext;
    this.level += 1;
    this.xpToNext += CONFIG.xp.perLevel;
    return true;
  }

  findWeapon(id) {
    return this.weapons.find((w) => w.id === id) || null;
  }

  // Заряжена — звёздочки, одинаковые у всех героев. Работает — своя
  // анимация у каждой способности (см. drawAbilityEffect).
  drawAbilityFx(ctx, layer) {
    if (!this.ability) return;
    const fx = {
      radius: this.radius,
      color: this.ability.color,
      phase: this.glowPhase,
      facing: this.facing,
      layer,
    };
    if (this.ability.isActive) drawAbilityEffect(ctx, { ...fx, style: this.ability.id });
    else if (this.ability.isReady) drawAbilitySparks(ctx, fx);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    drawShadow(ctx, this.radius);
    // Облако — под героем и до кольца игрока: невидимый перк для нечитающего
    // ребёнка не существует.
    if (this.stinkRadius) drawStinkCloud(ctx, this.stinkRadius, this.glowPhase);

    // Кольцо цвета игрока. Дети оба захотят Котика, и без маркера отличить
    // своего героя на экране будет нельзя.
    if (this.color) drawPlayerMarker(ctx, this.radius, this.color);

    // Броня приняла удар — щит вспыхивает вокруг героя. Без картинки перк
    // для нечитающего ребёнка неотличим от «зомби промахнулся»: сердечко-то
    // на месте.
    if (this.armorFlash > 0) {
      drawArmorShield(ctx, this.radius, 1 - this.armorFlash / CONFIG.player.armorFlashTime);
    }

    // Способность рисуется двумя слоями — до героя и после, чтобы эффект
    // обнимал персонажа, а не лежал на нём плашкой. Готовность и работа
    // взаимоисключающи: применил — заряд обнулился.
    this.drawAbilityFx(ctx, 'back');

    // Во время неуязвимости герой мигает.
    const blinking = this.invulnTimer > 0 && Math.floor(this.invulnTimer * 10) % 2 === 0;
    if (this.downed) ctx.globalAlpha = 0.4;   // призрак — полупрозрачный
    drawHero(ctx, {
      radius: this.radius,
      walkPhase: this.walkPhase,
      facing: this.facing,
      blinking,
      look: this.look,
    });
    ctx.globalAlpha = 1;
    this.drawAbilityFx(ctx, 'front');
    // Павший лежит призраком, а над ним — круговой отсчёт до подъёма.
    if (this.downed) {
      drawDownedTimer(ctx, this.radius, 1 - this.reviveTimer / CONFIG.coop.reviveTime);
    }
    ctx.restore();

    // Оружие рисует свои визуальные части (например, вертушки) поверх героя.
    for (const weapon of this.weapons) {
      weapon.draw?.(ctx, this);
    }
  }
}
