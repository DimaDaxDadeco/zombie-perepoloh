// Эффекты оружия, способностей и статусов в объёмном мире.
//
// Их много и они очень разные: двадцать три ствола в руке, огненная дорожка,
// паутина, портал, вихрь, пузырь вокруг пойманного зомби, ярость босса,
// ледяная глыба, полоса здоровья. Лепить каждый заново — месяцы работы и
// гарантированное расхождение с плоской версией, поэтому здесь три приёма, и
// выбор между ними определяется одним вопросом: где эффект живёт.
//
// 1. НА ЗЕМЛЕ, и герой по нему бегает — огненная дорожка, паутина, портал,
//    кольцо игрока, холмик крота. Такие рисуются НАСТОЯЩИМ 2D-кодом в один
//    холст, который лежит плоскостью чуть выше пола. Персонажи закрывают его
//    собой сами, как и должно быть: в плоской игре пламя тоже под ногами, и
//    не случайно — «иначе оно накрывает того, кто по нему бежит».
//
// 2. НА ПЕРСОНАЖЕ и всегда лицом к зрителю — ствол в руке, пузырь, ярость,
//    искры способности, кости. Это наклейки (sticker.js): та же функция из
//    sprites.js, но запечённая в картинку.
//
// 3. У ЧЕГО ЕСТЬ ОБЪЁМ ПО СМЫСЛУ — луч лазера, лопасти вертушки, пламя на
//    горящем зомби, лёд вокруг замороженного. Это единственное, что слеплено
//    заново из примитивов, потому что плоской наклейкой оно выглядело бы
//    приклеенным к экрану.
//
// Мир только читается. Ни одно поле сущности здесь не меняется.

import {
  Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, CanvasTexture, LinearFilter,
  PlaneGeometry, BoxGeometry, CylinderGeometry, ConeGeometry, RingGeometry,
  Color, DoubleSide, Vector3,
} from 'three';
import { CONFIG } from '../config.js';
import {
  drawCatchBubble, drawTornado, drawBossRage, drawBossBones,
  drawArmorShield, drawDownedTimer, drawAbilitySparks, drawAbilityEffect,
  drawWeaponInHand, drawMoleMound, drawSmokePuff, drawWeb, drawLoot, drawThiefMask,
} from '../render/sprites.js';
import { stickerTexture, StickerPool, step } from './sticker.js';

// Насколько высоко над полом лежит слой наземных эффектов. Больше нуля, иначе
// он спорит с полом за глубину и мерцает полосами.
const GROUND_LIFT = 0.8;
// Пламя и лёд на зомби — единственные статусы, которые лепятся объёмом.
const FLAME_GEOMETRY = new ConeGeometry(0.3, 1, 6);
const ICE_GEOMETRY = new BoxGeometry(1, 1, 1);
const BLADE_GEOMETRY = new CylinderGeometry(1, 1, 0.25, 12);
const BEAM_GEOMETRY = new CylinderGeometry(1, 1, 1, 8);
// Кольцо у ног и облако вони. Объёмом, а не в общем холсте наземных
// эффектов: они есть в КАЖДОМ кадре, и ради них холст пришлось бы грузить в
// видеопамять постоянно — а он затем и заведён, чтобы включаться редко.
const RING_GEOMETRY = new RingGeometry(0.78, 1, 28);
const DISC_GEOMETRY = new RingGeometry(0, 1, 24);

export class WorldFx {
  constructor(scene, spec) {
    this.scene = scene;
    this.spec = spec;

    this.ground = new GroundDecals(scene, spec);
    this.stickers = new StickerPool(scene, spec.maxStickers);
    this.solid = new SolidPool(scene);
  }

  setArena(arena) {
    this.ground.setArena(arena);
  }

  update(world) {
    this.stickers.reset();
    this.solid.reset();

    this.ground.update(world);
    for (const player of world.players) this.heroFx(player);
    for (const enemy of world.enemies) this.enemyFx(enemy);
    this.boltsFx(world.particles?.bolts);
    this.entranceFx(world.particles?.entrances);

    this.stickers.finish();
    this.solid.finish();
  }

  // --- Герой ---

  heroFx(player) {
    const r = player.radius;
    // Центр плоского героя — середина туловища; в объёме фигурка стоит
    // ступнями на нуле. Одна поправка на все наклейки героя.
    const y = r * HERO_MID;
    const z = player.y;

    if (player.armorFlash > 0) {
      const progress = clamp01(1 - player.armorFlash / CONFIG.player.armorFlashTime);
      this.stickers.show(
        stickerTexture(`armor:${step(progress, 5)}`, (ctx, R) => drawArmorShield(ctx, R, progress)),
        player.x, y, z, r,
      );
    }

    if (player.downed) {
      const progress = clamp01(1 - player.reviveTimer / CONFIG.coop.reviveTime);
      this.stickers.show(
        stickerTexture(`downed:${step(progress, 8)}`, (ctx, R) => drawDownedTimer(ctx, R, progress)),
        player.x, y, z, r,
      );
    }

    // Облако вони Хэнки: постоянная аура, по которой видно, докуда достаёт.
    if (player.stinkRadius) {
      this.flat(DISC_GEOMETRY, '#9ccc65', player.x, player.y, player.stinkRadius, 0.18);
    }
    // Кольцо цвета игрока. Вдвоём без него нельзя отличить своего героя.
    if (player.color) {
      this.flat(RING_GEOMETRY, player.color, player.x, player.y, r * 1.25, 0.85);
    }

    this.abilityFx(player);
    this.weaponFx(player);
  }

  // Плоский круг на земле: кладём кольцо и приподнимаем над полом, иначе оно
  // спорит с ним за глубину и мерцает.
  flat(geometry, color, x, z, radius, opacity) {
    const mesh = this.solid.show(geometry, color, x, GROUND_LIFT * 2, z,
      radius, radius, radius, true, opacity);
    if (mesh) mesh.rotation.x = -Math.PI / 2;
  }

  abilityFx(player) {
    const ability = player.ability;
    if (!ability) return;
    const r = player.radius;
    const y = r * HERO_MID;
    // Стиль эффекта — это id способности, а фаза берётся у героя: ровно так
    // же, как в Player.drawAbilityFx.
    const phase = player.glowPhase;

    // Готовность: звёздочки вокруг героя. Без них шкала в углу остаётся
    // единственным способом узнать, что пробел уже работает, — а ребёнок
    // смотрит на героя, не на угол.
    if (ability.isReady && !ability.isActive) {
      this.stickers.show(
        stickerTexture(`sparks:${ability.color}:${step(phase % 1, 8)}`,
          (ctx, R) => drawAbilitySparks(ctx, { radius: R, color: ability.color, phase, layer: 'front' })),
        player.x, y, player.y, r,
      );
    }

    if (ability.isActive) {
      // Два слоя, как в 2D: эффект обнимает героя, а не лежит на нём плашкой.
      // Задний уходит чуть за фигурку, передний — чуть перед ней; на плоскости
      // это делал порядок вызовов, здесь — сдвиг по глубине.
      for (const [layer, shift] of [['back', -r * 0.6], ['front', r * 0.6]]) {
        this.stickers.show(
          stickerTexture(`abil:${ability.id}:${ability.color}:${layer}:${step(phase % 1, 8)}`,
            (ctx, R) => drawAbilityEffect(ctx, {
              style: ability.id, radius: R, color: ability.color,
              phase, facing: 1, layer,
            })),
          player.x, y, player.y + shift, r,
        );
      }
    }
  }

  // Ствол в руке и то, что рисует само оружие.
  weaponFx(player) {
    const r = player.radius;
    for (const weapon of player.weapons) {
      this.weaponOwnFx(weapon, player);
      if (player.activeWeapon !== weapon) continue;
      // Ствол печём БЕЗ поворота: наклейка и так всегда повёрнута к зрителю,
      // а угол прицела показываем зеркалом — как это делает и плоская версия,
      // когда герой стреляет влево.
      const texture = stickerTexture(`hand:${weapon.id}:${weapon.stars}`,
        (ctx, R) => drawWeaponInHand(ctx, {
          id: weapon.id, stars: weapon.stars, angle: 0, recoil: 0, x: 0, y: 0, radius: R,
        }));
      const aimsLeft = Math.abs(weapon.aimAngle) > Math.PI / 2;
      this.stickers.show(texture, player.x, r * HERO_MID, player.y, r, { flip: aimsLeft });
    }
  }

  weaponOwnFx(weapon, player) {
    // Пузыри: пойманный зомби сидит внутри мыльного шара. Именно на нём, а не
    // рядом: в плоской версии это оговорено отдельно.
    if (weapon.caught) {
      for (const held of weapon.caught) {
        if (!held.enemy.alive) continue;
        const life = held.life;
        this.stickers.show(
          stickerTexture(`bubble:${step(Math.min(1, life), 6)}`,
            (ctx, R) => drawCatchBubble(ctx, 0, 0, R, life)),
          held.enemy.x, held.enemy.radius * 1.2, held.enemy.y, weapon.spec.radius,
        );
      }
    }

    // Вихрь бродит по арене сам.
    if (weapon.vortex) {
      const vortex = weapon.vortex;
      this.stickers.show(
        stickerTexture(`tornado:${step((vortex.spin || 0) % 1, 8)}`,
          (ctx, R) => drawTornado(ctx, { ...vortex, x: 0, y: 0, radius: R }, vortex.spin)),
        vortex.x, vortex.radius * 1.1, vortex.y, vortex.radius,
      );
    }

    // Лопасти вертушки. Единственный эффект оружия, слепленный объёмом: это
    // предмет, летающий вокруг героя, и плоской наклейкой он читается как
    // наклейка.
    if (typeof weapon.getBladePositions === 'function') {
      for (const blade of weapon.getBladePositions(player)) {
        this.solid.show(BLADE_GEOMETRY, '#7fd8ff', blade.x, player.radius * 0.9, blade.y, 9, 9, 9);
      }
    }

    // Луч лазерных глаз: от каждого глаза в одну точку.
    if (weapon.beamOn && !player.downed && typeof weapon.eyes === 'function') {
      const tip = {
        x: player.x + Math.cos(weapon.aimAngle) * weapon.beamLen,
        y: player.y + Math.sin(weapon.aimAngle) * weapon.beamLen,
      };
      const color = weapon.stat('beamColor');
      const eyeY = player.radius * HERO_EYE;
      for (const from of weapon.eyes(player)) {
        this.beam(from, tip, eyeY, color);
      }
    }
  }

  // Появление босса. У каждого свой вид, и по нему выход читается ещё до
  // того, как босса видно, — значит терять его нельзя. Рисуем наклейкой той
  // же функцией частиц, что и плоская версия.
  entranceFx(entrances) {
    if (!entrances?.length) return;
    for (const item of entrances) {
      const life = clamp01(item.life / (item.maxLife || 1));
      this.stickers.show(
        stickerTexture(`entrance:${item.kind}:${step(1 - life, 10)}`,
          (ctx, R) => drawEntranceMark(ctx, R, item.kind, 1 - life)),
        item.x, item.radius * 0.9, item.y, item.radius,
        { opacity: Math.min(1, life * 2) },
      );
    }
  }

  // Молния: ломаная из отрезков. Единственная частица, которую нельзя ни
  // положить на землю, ни повесить наклейкой — она бьёт сверху и соединяет
  // две точки, а такое честнее нарисовать объёмом.
  boltsFx(bolts) {
    if (!bolts?.length) return;
    for (const bolt of bolts) {
      const fade = Math.max(0, bolt.life / (bolt.maxLife || 1));
      for (let i = 1; i < bolt.points.length; i++) {
        const from = bolt.points[i - 1];
        const to = bolt.points[i];
        const dx = to.x - from.x;
        const dz = to.y - from.y;
        const length = Math.hypot(dx, dz) || 1;
        const mesh = this.solid.show(BEAM_GEOMETRY, '#ffe14d',
          (from.x + to.x) / 2, BOLT_HEIGHT, (from.y + to.y) / 2,
          2.5, length, 2.5, true, fade);
        if (!mesh) return;
        mesh.rotation.set(Math.PI / 2, 0, 0);
        mesh.rotateOnWorldAxis(UP, Math.atan2(dx, dz));
      }
    }
  }

  // Луч — вытянутый цилиндр от глаза до точки попадания.
  beam(from, to, y, color) {
    const dx = to.x - from.x;
    const dz = to.y - from.y;
    const length = Math.hypot(dx, dz) || 1;
    const mesh = this.solid.show(BEAM_GEOMETRY, color,
      (from.x + to.x) / 2, y, (from.y + to.y) / 2, 3, length, 3, true);
    if (!mesh) return;
    // Цилиндр рождается стоящим вдоль y: кладём его и разворачиваем по лучу.
    mesh.rotation.set(Math.PI / 2, 0, 0);
    mesh.rotateOnWorldAxis(UP, Math.atan2(dx, dz));
  }

  // --- Зомби ---

  enemyFx(enemy) {
    const r = enemy.radius;

    if (enemy.isBurning) {
      // Три язычка пламени над головой. Дрожат от собственного времени, а не
      // от игрового: это украшение, и синхронность тут не нужна.
      for (let i = -1; i <= 1; i++) {
        const wobble = 0.7 + Math.abs(Math.sin(performance.now() / 90 + i)) * 0.6;
        this.solid.show(FLAME_GEOMETRY, i === 0 ? '#ffd93d' : '#ff8a2b',
          enemy.x + i * r * 0.35, r * 2.6, enemy.y, r * 0.5, r * wobble, r * 0.5);
      }
    }

    if (enemy.isFrozen && enemy.icy) {
      // Глыба появляется сразу целиком и к концу чуть оседает и светлеет:
      // freezeProgress это «сколько осталось до оттаивания», ноль — только
      // что заморозили. Значение зажимаем — при отладке в него легко попадает
      // мусор, а отрицательный масштаб выворачивает меш наизнанку.
      const thaw = clamp01(enemy.freezeProgress ?? 0);
      const size = 1 - thaw * 0.15;
      this.solid.show(ICE_GEOMETRY, '#8fe3ff',
        enemy.x, r * 1.35 * size, enemy.y, r * 2.2 * size, r * 2.7 * size, r * 2.2 * size,
        false, 0.5 - thaw * 0.18);
    }

    // Воришка: мешок за спиной и маска. Без них он неотличим от обычного
    // зомби, а правило у него другое — его нельзя убить, только догнать.
    if (enemy.lootPhase !== undefined) {
      this.stickers.show(
        stickerTexture(`loot:${step(enemy.lootPhase % 1, 6)}`,
          (ctx, R) => drawLoot(ctx, { radius: R * 0.5, phase: enemy.lootPhase })),
        enemy.x, r * 1.5, enemy.y, r * 0.9,
      );
      this.stickers.show(
        stickerTexture('thiefmask', (ctx, R) => drawThiefMask(ctx, R)),
        enemy.x, r * HERO_MID, enemy.y, r,
      );
    }

    if (enemy.isBoss) this.bossFx(enemy, r);
  }

  bossFx(boss, r) {
    if (boss.isDown) {
      const progress = clamp01(1 - boss.downTimer / boss.type.revive.downTime);
      this.stickers.show(
        stickerTexture(`bones:${step(progress, 6)}`,
          (ctx, R) => drawBossBones(ctx, { radius: R, progress })),
        boss.x, r * 0.6, boss.y, r,
      );
      return;
    }

    if (boss.isEnraged) {
      const phase = boss.walkPhase;
      for (const layer of ['back', 'front']) {
        this.stickers.show(
          stickerTexture(`rage:${boss.type.rage}:${layer}:${step(phase % 1, 8)}`,
            (ctx, R) => drawBossRage(ctx, {
              radius: R, walkPhase: phase, look: boss.type.look, style: boss.type.rage, layer,
            })),
          boss.x, r * HERO_MID, boss.y, r,
        );
      }
    }

    // Полоса здоровья над боссом: единственный способ для нечитающего
    // ребёнка понять, что удары вообще доходят.
    const share = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
    this.stickers.show(
      stickerTexture(`hpbar:${step(share, 20)}`, (ctx, R) => drawBossHealth(ctx, R, share)),
      boss.x, r * 3.1, boss.y, r,
    );
  }
}

const UP = new Vector3(0, 1, 0);
// Где у объёмной фигурки середина плоского персонажа и уровень глаз, в долях
// радиуса. Совпадает с HERO_FLOOR из figures.js — там же и объяснено, почему
// это единственная формула перевода.
const HERO_MID = 1.1;
const HERO_EYE = 1.95;
// Молния идёт на уровне груди зомби: по земле она читается как трещина, а
// высоко над головами — как чужой эффект.
const BOLT_HEIGHT = 26;

function clamp01(value) {
  return Math.min(1, Math.max(0, value || 0));
}

// Появление босса. Своей функции для одной частицы в sprites.js нет — там
// это ветка внутри Particles.draw, которая рисует все виды разом. Поэтому
// здесь общая для всех воронка: расходящееся кольцо и подсветка пятна, куда
// он встанет. Вид сохраняется цветом, а не формой: разбирать десять веток
// ради полусекундного эффекта не стоит того.
const ENTRANCE_COLORS = {
  slam: '#8a5a2b', swirl: '#c77dff', rush: '#4fb3ff', ice: '#8fe3ff',
  fire: '#ff7a2b', bones: '#f3efe0', balloons: '#ff6b9d', whistle: '#ffd93d',
  thread: '#e8ecff', spark: '#ffe14d',
};

function drawEntranceMark(ctx, R, kind, grow) {
  const color = ENTRANCE_COLORS[kind] || '#ffd93d';
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = R * 0.16;
  ctx.beginPath();
  ctx.arc(0, 0, R * (0.25 + grow * 0.85), 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.9 * (1 - grow * 0.4), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Полоса здоровья босса. Своя, а не из sprites.js: там она рисуется в
// экранных пикселях от позиции босса, а наклейке нужна картинка вокруг нуля.
function drawBossHealth(ctx, R, share) {
  const w = R * 2.2;
  const h = R * 0.34;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = share > 0.35 ? '#ff4d6d' : '#ffd93d';
  ctx.fillRect(-w / 2 + 2, -h / 2 + 2, (w - 4) * share, h - 4);
}

// --- Наземные эффекты ---

// Один холст на всё, что лежит под ногами. Рисуется НАСТОЯЩИМИ функциями
// плоской игры: `weapon.drawGround(ctx)`, `ability.drawWorld(ctx)`,
// `boss.drawWebs(ctx)` — теми же вызовами и в том же порядке, что в
// Round.draw. Поэтому огонь, паутина и портал выглядят в объёме ровно так же,
// как ребёнок привык.
//
// Холст грузится в видеопамять только когда на нём что-то есть: в обычном
// раунде наземных эффектов нет вовсе, и платить за них незачем.
class GroundDecals {
  constructor(scene, spec) {
    this.spec = spec;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.texture = new CanvasTexture(this.canvas);
    this.texture.generateMipmaps = false;
    this.texture.minFilter = LinearFilter;

    this.mesh = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false }),
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.arena = { width: 1, height: 1 };
  }

  setArena(arena) {
    this.arena = arena;
    // Холст повторяет пропорции арены, иначе круги на нём станут овалами.
    const wide = arena.width >= arena.height;
    const size = this.spec.groundDecalSize;
    this.canvas.width = Math.round(wide ? size : size * (arena.width / arena.height));
    this.canvas.height = Math.round(wide ? size * (arena.height / arena.width) : size);
    this.mesh.scale.set(arena.width, arena.height, 1);
    this.mesh.position.set(arena.width / 2, GROUND_LIFT, arena.height / 2);
  }

  update(world) {
    if (!hasGroundFx(world)) {
      this.mesh.visible = false;
      return;
    }
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / (this.arena.width || 1);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Порядок тот же, что в Round.draw: способности под оружием, оружие под
    // персонажами.
    for (const player of world.players) player.ability?.drawWorld?.(ctx);
    for (const player of world.players) {
      for (const weapon of player.weapons) {
        if (weapon.drawGround) { weapon.drawGround(ctx); continue; }
        // Паутина лежит на земле, но рисует её weapon.draw — вместе со
        // стволом в руке. Ствол на земле нам не нужен, поэтому паутину
        // рисуем сами той же функцией, что и плоская версия.
        if (!weapon.patches) continue;
        for (const patch of weapon.patches) {
          drawWeb(ctx, patch, patch.radius, weapon.spec.patchLife);
        }
      }
    }
    for (const enemy of world.enemies) {
      if (enemy.isBoss) {
        enemy.drawWebs?.(ctx);
        enemy.drawFlames?.(ctx);
      }
      if (enemy.underground) drawBurrowMark(ctx, enemy);
    }
    drawSlashes(ctx, world.particles?.slashes);

    this.texture.needsUpdate = true;
    this.mesh.visible = true;
  }
}

// Взмах светового меча: дуга вокруг героя. Данные лежат в частицах, но
// Particles.draw рисует всё разом, а нам нужна только эта их часть.
function drawSlashes(ctx, slashes) {
  if (!slashes?.length) return;
  for (const slash of slashes) {
    const fade = Math.max(0, slash.life / 0.22);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#bfe6ff';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(slash.x, slash.y, slash.reach, slash.angle - slash.arc / 2, slash.angle + slash.arc / 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBurrowMark(ctx, enemy) {
  const trace = {
    radius: enemy.radius,
    progress: enemy.behaviorTimer / (enemy.type?.burrowTime || 1),
  };
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  if (enemy.type?.behavior === 'ninja') drawSmokePuff(ctx, trace);
  else drawMoleMound(ctx, trace);
  ctx.restore();
}

// Есть ли вообще что рисовать на земле. Проверка дешёвая, а экономит загрузку
// целого холста в видеопамять каждый кадр.
function hasGroundFx(world) {
  for (const player of world.players) {
    if (player.ability?.isActive) return true;
    for (const weapon of player.weapons) {
      if (weapon.drawGround || weapon.patches?.length) return true;
    }
  }
  for (const enemy of world.enemies) {
    if (enemy.underground) return true;
    if (enemy.isBoss && (enemy.webs?.length || enemy.flames?.length)) return true;
  }
  return Boolean(world.particles?.slashes?.length);
}

// --- Объёмные мелочи ---

// Пул одноразовых мешей: пламя, лёд, лопасти, лучи. Живут один кадр, поэтому
// переиспользуются, а не создаются заново.
class SolidPool {
  constructor(scene) {
    this.scene = scene;
    this.group = new Group();
    scene.add(this.group);
    this.items = [];
    this.used = 0;
    this.materials = new Map();
  }

  reset() { this.used = 0; }

  show(geometry, color, x, y, z, sx, sy, sz, unlit = false, opacity = 1) {
    const mesh = this.items[this.used] || this.make();
    this.used += 1;
    mesh.visible = true;
    mesh.geometry = geometry;
    mesh.material = this.materialFor(color, unlit, opacity);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(0, 0, 0);
    return mesh;
  }

  finish() {
    for (let i = this.used; i < this.items.length; i++) this.items[i].visible = false;
  }

  make() {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    this.group.add(mesh);
    this.items.push(mesh);
    return mesh;
  }

  materialFor(color, unlit, opacity) {
    const key = `${color}|${unlit}|${opacity}`;
    let material = this.materials.get(key);
    if (!material) {
      const options = { color: new Color(color), transparent: opacity < 1, opacity, side: DoubleSide };
      material = unlit ? new MeshBasicMaterial(options) : new MeshLambertMaterial(options);
      if (opacity < 1) material.depthWrite = false;
      this.materials.set(key, material);
    }
    return material;
  }
}
