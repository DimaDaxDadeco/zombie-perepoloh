// Столкновения: снаряд↔зомби, зомби↔герой, а также лёгкое расталкивание зомби,
// чтобы толпа не слипалась в одну точку. Все проверки — круг с кругом.

import { CONFIG } from '../config.js';

export function circlesOverlap(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius;
}

// Снаряды, которые бьют по контакту (капли воды).
export function resolveProjectileHits(world) {
  for (const projectile of world.projectiles) {
    if (!projectile.alive || !projectile.damagesOnContact) continue;
    for (const enemy of world.enemies) {
      if (!enemy.alive || enemy.isHidden) continue;
      if (circlesOverlap(projectile, enemy)) {
        // Пробивающий снаряд не бьёт одного и того же дважды и живёт дальше,
        // пока не кончится запас пробития.
        if (projectile.alreadyHit?.(enemy)) continue;
        projectile.onHit(enemy, world); // поджечь или заморозить, если снаряд стихийный
        world.damageEnemy(enemy, projectile.damage);
        if (!projectile.piercing) projectile.alive = false;
        break;
      }
    }
  }
}

// Зомби дотронулся до героя — минус сердечко и отталкивание толпы.
export function resolvePlayerHits(world) {
  for (const player of world.players) resolveHitsFor(world, player);
}

function resolveHitsFor(world, player) {
  if (player.downed) return;   // призрака зомби не трогают

  // В рывке герой мчится сквозь толпу и расталкивает её. Без этой ветки
  // неуязвимость просто пропускала бы зомби насквозь, и рывок выглядел бы
  // так, будто ничего не произошло.
  if (player.isDashing) {
    for (const enemy of world.enemies) {
      if (!enemy.alive || enemy.isHidden || !circlesOverlap(player, enemy)) continue;
      enemy.applyKnockback(player.x, player.y, CONFIG.abilities.dash.knockback);
      world.particles.addBurst(enemy.x, enemy.y, 6, 0.7);
    }
    return;
  }

  if (player.isInvulnerable) return;

  for (const enemy of world.enemies) {
    if (!enemy.alive || enemy.isHidden) continue;   // крот под землёй не кусается
    if (!circlesOverlap(player, enemy)) continue;
    enemy.onTouchPlayer?.(player); // ледяной босс примораживает
    if (player.takeDamage()) {
      world.onPlayerHurt();
      pushEnemiesAway(world, player.x, player.y);
    }
    return; // одного удара за кадр достаточно
  }
}

function pushEnemiesAway(world, x, y) {
  for (const enemy of world.enemies) {
    if (!enemy.alive) continue;
    const dist = Math.hypot(enemy.x - x, enemy.y - y);
    if (dist < CONFIG.player.knockbackRadius) {
      enemy.applyKnockback(x, y, CONFIG.player.knockbackForce);
    }
  }
}

// Мягкое расталкивание: зомби не залезают друг в друга, толпа выглядит живой.
export function separateEnemies(enemies) {
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      if (!b.alive) continue;
      // Шарик летит над толпой: толкать его снизу нечем, и сам он никого не
      // давит. Пропускаем пару целиком — это не «я тяжёлый», как у босса
      // ниже, а «мы физически не встречаемся».
      if (a.isFloating || b.isFloating) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minDist = a.radius + b.radius;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < minDist) {
        const push = (minDist - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        // Босса не двигаем — он тяжёлый и важный.
        if (!a.isBoss) { a.x -= nx * push; a.y -= ny * push; }
        if (!b.isBoss) { b.x += nx * push; b.y += ny * push; }
      }
    }
  }
}
