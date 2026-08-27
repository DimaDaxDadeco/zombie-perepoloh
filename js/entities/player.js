// Герой: мальчик-супергерой. Двигается по стрелкам, оружие стреляет само.

import { CONFIG } from '../config.js';
import {
  drawHero, drawShadow, drawAbilitySparks, drawAbilityEffect,
  drawPlayerMarker, drawDownedTimer,
} from '../render/sprites.js';

// Реже стреляет — значит выстрел заметнее, и показать его важнее.
function isRarer(weapon, other) {
  const cooldown = (w) => (typeof w.stat === 'function' ? w.stat('cooldown') ?? 0 : 0);
  return cooldown(weapon) > cooldown(other);
}

export class Player {
  constructor(x, y, { speed, maxHp, magnetRadius, look, regenInterval }) {
    this.x = x;
    this.y = y;
    this.radius = CONFIG.player.radius;
    this.speed = speed;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.magnetRadius = magnetRadius;
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
    this.boostTimer = 0;    // рывок Супер-Егора: быстрее и неуязвим
    this.boostFactor = 1;
    this.turboTimer = 0;    // турбо Робота: оружие стреляет чаще
    this.glowPhase = 0;     // фаза пульсации свечения «способность готова»

    this.invulnTimer = 0;
    this.regenTimer = 0;
    this.walkPhase = 0;
    this.facing = 1;

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
    this.downed = false;
    this.hp = 1;
    this.invulnTimer = CONFIG.coop.reviveInvuln;
  }

  // В рывке герой неуязвим — это и даёт право пробегать сквозь толпу.
  get isInvulnerable() {
    return this.invulnTimer > 0 || this.boostTimer > 0 || this.downed;
  }

  get isChilled() {
    return this.chillTimer > 0;
  }

  get isDashing() {
    return this.boostTimer > 0;
  }

  // Множители скорости бега и скорострельности — по образцу Zombie.speedFactor.
  get speedFactor() {
    const chill = this.chillTimer > 0 ? this.chillFactor : 1;
    const boost = this.boostTimer > 0 ? this.boostFactor : 1;
    return chill * boost;
  }

  get fireRateFactor() {
    return this.turboTimer > 0 ? CONFIG.abilities.turbo.rate : 1;
  }

  // Приморозить героя: factor 0.55 — заметно медленнее, но убежать можно.
  chill(factor, duration) {
    this.chillFactor = factor;
    this.chillTimer = Math.max(this.chillTimer, duration);
  }

  // Разогнать героя: factor 2 — вдвое быстрее. Как и chill(), эффект
  // продлевается, а не складывается.
  boost(factor, duration) {
    this.boostFactor = factor;
    this.boostTimer = Math.max(this.boostTimer, duration);
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
  }

  update(dt, world, direction) {
    if (this.downed) {
      this.updateRevive(dt, world);
      return;
    }
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.chillTimer = Math.max(0, this.chillTimer - dt);
    this.boostTimer = Math.max(0, this.boostTimer - dt);
    this.turboTimer = Math.max(0, this.turboTimer - dt);
    this.activeWeaponTimer = Math.max(0, this.activeWeaponTimer - dt);
    this.glowPhase += dt * 4;
    this.ability?.update(dt);
    this.updateRegen(dt, world);

    const speed = this.speed * this.speedFactor;
    const moving = direction.x !== 0 || direction.y !== 0;
    if (moving) {
      this.x += direction.x * speed * dt;
      this.y += direction.y * speed * dt;
      this.walkPhase += dt * 9;
      if (direction.x !== 0) this.facing = direction.x > 0 ? 1 : -1;
    } else {
      this.walkPhase = 0;
    }

    this.clampToArena(world.arena);

    // Турбо ускоряет всё оружие разом: мы просто ускоряем для него время.
    // Так способность работает и с вертушкой, у которой свой update() без
    // перезарядки, и ни один из восьми классов про турбо не знает.
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

  // Возвращает true, если урон действительно прошёл (не было неуязвимости).
  takeDamage() {
    if (this.isInvulnerable || this.downed) return false;
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

    // Кольцо цвета игрока. Дети оба захотят Котика, и без маркера отличить
    // своего героя на экране будет нельзя.
    if (this.color) drawPlayerMarker(ctx, this.radius, this.color);

    // Способность рисуется двумя слоями — до героя и после, чтобы эффект
    // обнимал персонажа, а не лежал на нём плашкой. Готовность и работа
    // взаимоисключающи: применил — заряд обнулился.
    this.drawAbilityFx(ctx, 'back');

    // Во время неуязвимости герой мигает. В рывке — не мигает: иначе
    // Супер-Егор пять секунд подряд стробит по глазам.
    const blinking = this.invulnTimer > 0 && !this.isDashing
      && Math.floor(this.invulnTimer * 10) % 2 === 0;
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
