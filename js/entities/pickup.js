// Пикапы: медальки (опыт) и доллары (валюта магазина).
// Летят к герою, когда он подходит на радиус магнита.

import { CONFIG } from '../config.js';
import { drawMedalPickup, drawMoneyPickup } from '../render/sprites.js';

export const PickupType = {
  MEDAL: 'medal',
  MONEY: 'money',
};

export class Pickup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    // Доллар чуть крупнее медальки: купюра приплюснутая, иначе теряется на поле.
    this.radius = type === PickupType.MEDAL ? 11 : 12;
    this.alive = true;
    this.phase = Math.random() * Math.PI * 2;
    this.attracted = false;

    // Небольшой разлёт в момент появления — «выпало из зомби»
    const angle = Math.random() * Math.PI * 2;
    const force = 40 + Math.random() * 60;
    this.vx = Math.cos(angle) * force;
    this.vy = Math.sin(angle) * force;
  }

  update(dt, world) {
    this.phase += dt * 3;

    // Цель фиксируем и больше не переназначаем: медалька, зависшая ровно
    // между игроками, иначе металась бы и не долетала ни до кого.
    if (!this.target || this.target.downed) this.target = world.nearestPlayer(this.x, this.y);
    const player = this.target;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist < player.magnetRadius) this.attracted = true;

    if (this.attracted) {
      this.x += (dx / dist) * CONFIG.pickups.flySpeed * dt;
      this.y += (dy / dist) * CONFIG.pickups.flySpeed * dt;
    } else {
      // Разлёт затухает
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const decay = Math.pow(0.01, dt);
      this.vx *= decay;
      this.vy *= decay;
    }

    if (dist < CONFIG.pickups.collectRadius) {
      this.alive = false;
      world.collectPickup(this, player);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.type === PickupType.MEDAL) {
      drawMedalPickup(ctx, { radius: this.radius, phase: this.phase });
    } else {
      drawMoneyPickup(ctx, { radius: this.radius, phase: this.phase });
    }
    ctx.restore();
  }
}
