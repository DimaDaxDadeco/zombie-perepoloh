// Базовый класс оружия.
// Всё оружие стреляет автоматически: ребёнок только бегает, целиться не нужно.
// Характеристики берутся из CONFIG.weapons[id] по текущему количеству звёзд.

import { CONFIG } from '../config.js';
import { drawWeaponInHand } from '../render/sprites.js';

export class Weapon {
  constructor(id) {
    this.id = id;
    this.spec = CONFIG.weapons[id];
    this.stars = 1;
    this.cooldownTimer = 0;

    // Для отрисовки в руке: куда смотрит ствол и сколько ещё длится отдача.
    this.aimAngle = 0;
    this.recoil = 0;
  }

  get name() { return this.spec.name; }
  get emoji() { return this.spec.emoji; }
  get isMaxed() { return this.stars >= CONFIG.maxStars; }

  upgrade() {
    if (!this.isMaxed) this.stars += 1;
  }

  // Значение характеристики для текущего числа звёзд.
  // Массив короче числа звёзд — берём последний элемент.
  stat(key) {
    const values = this.spec[key];
    if (!Array.isArray(values)) return values;
    return values[Math.min(this.stars, values.length) - 1];
  }

  // Стандартный цикл: тикаем кулдаун, при готовности стреляем.
  // Оружие без кулдауна (вертушка) переопределяет update целиком.
  //
  // owner — герой, которому оружие принадлежит. Раньше здесь стоял
  // world.player: пока герой был один, это совпадало. Брать владельца из
  // мира нельзя — при игре вдвоём оружие второго целилось бы от первого.
  update(dt, world, owner) {
    this.cooldownTimer -= dt;
    this.recoil = Math.max(0, this.recoil - dt);

    // Целимся каждый кадр, даже на перезарядке: иначе ствол в руке дёргается
    // рывками от выстрела к выстрелу вместо плавного доворота.
    const target = world.findNearestEnemy(owner.x, owner.y);
    if (target) this.aimAt(owner, target);

    if (this.cooldownTimer > 0 || !target) return;
    this.fire(world, target, owner);
    this.recoil = CONFIG.player.weaponRecoilTime;
    owner.setActiveWeapon(this);
    this.cooldownTimer = this.stat('cooldown');
  }

  // Цели нет — угол остаётся прежним, ствол просто замирает,
  // а не прыгает в нулевой угол.
  aimAt(player, target) {
    this.aimAngle = Math.atan2(target.y - player.y, target.x - player.x);
  }

  // Оружие в руке. Вертушка переопределяет draw целиком — её лопасти
  // и так видны вокруг героя, в руке ей делать нечего.
  draw(ctx, player) {
    if (player.activeWeapon !== this) return;
    drawWeaponInHand(ctx, {
      id: this.id,
      stars: this.stars,
      angle: this.aimAngle,
      recoil: this.recoil / CONFIG.player.weaponRecoilTime,
      x: player.x,
      y: player.y,
      radius: player.radius,
    });
  }

  // Переопределяется наследниками.
  fire() {
    throw new Error(`Оружие ${this.id} не реализует fire()`);
  }
}
