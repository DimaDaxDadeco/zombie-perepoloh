// HUD поверх игрового поля: сердечки, шкала опыта, шкала суперспособности,
// таймер до босса, счётчик зомби и панель оружия со звёздами.
//
// На телефоне (флаг compact, порог в CONFIG.hud.compactBelow) остаётся только
// то, без чего играть нельзя: сердечки, таймер, тонкая полоса опыта и слоты
// оружия. Уходят счётчик убитых, номер раунда, надпись с уровнем и шкала
// способности — о её готовности на телефоне сообщает сама кнопка, она
// наливается цветом и пульсирует, так что шкала была бы вторым способом
// сказать то же самое. Всё это ради места: экран телефона и так тесный, а
// смотреть ребёнок должен на героя.

import { CONFIG } from '../config.js';
import { drawHeartIcon } from '../render/sprites.js';

const PADDING = 20;
const HEART_SIZE = 16;
const XP_BAR_HEIGHT = 16;
const XP_BAR_HEIGHT_COMPACT = 7;   // на телефоне полоса опыта без надписи
const ABILITY_BAR_HEIGHT = 14;
const ABILITY_BAR_WIDTH = 150;
const SOUND_BUTTON_CLEARANCE = 52; // высота кнопки звука в правом верхнем углу

export class Hud {
  // При одном игроке раскладка ровно та же, что была: сердечки слева,
  // счётчики справа, оружие по центру снизу. Второй игрок зеркалит левую
  // колонку направо, а счётчики уезжают в центр.
  draw(ctx, {
    players, level, xp, xpToNext, arena, timeLeft, zombiesDefeated, round, bossActive, modifier,
    compact = false,
  }) {
    const coop = players.length > 1;
    players.forEach((player, i) => {
      const right = coop && i === 1;
      this.drawHearts(ctx, player, arena, right);
      if (!compact) this.drawAbilityBar(ctx, player, arena, right);
      this.drawWeapons(ctx, player, arena, weaponAlign(coop, right, compact));
    });
    this.drawXpBar(ctx, { level, xp, xpToNext }, arena, compact);
    this.drawCounters(ctx, arena,
      { timeLeft, zombiesDefeated, round, bossActive, coop, modifier, compact });
  }

  drawHearts(ctx, player, arena, right) {
    const step = HEART_SIZE * 2.4;
    // Правая колонка начинается ниже: там кнопки звука и паузы.
    const top = PADDING + HEART_SIZE + (right ? SOUND_BUTTON_CLEARANCE : 0);
    for (let i = 0; i < player.maxHp; i++) {
      const x = right
        ? arena.width - PADDING - HEART_SIZE - i * step
        : PADDING + HEART_SIZE + i * step;
      drawHeartIcon(ctx, x, top, HEART_SIZE, i < player.hp);
    }
  }

  // Полоса опыта. На телефоне остаётся, но тонкой и без надписи: это
  // единственное объяснение, откуда берутся карточки прокачки, и убрать её
  // целиком значило бы сделать их появление необъяснимым. А вот номер уровня
  // ребёнок всё равно не читает.
  drawXpBar(ctx, team, arena, compact = false) {
    const width = arena.width - PADDING * 2;
    const height = compact ? XP_BAR_HEIGHT_COMPACT : XP_BAR_HEIGHT;
    const y = PADDING + HEART_SIZE * 2.4;
    const ratio = Math.min(1, team.xp / team.xpToNext);
    const radius = height / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.roundRect(PADDING, y, width, height, radius);
    ctx.fill();

    ctx.fillStyle = '#ffd93d';
    ctx.beginPath();
    ctx.roundRect(PADDING, y, Math.max(0, width * ratio), height, radius);
    ctx.fill();

    if (!compact) {
      // Медалька вместо слова «уровень» — читать ребёнку пока нечем
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`🏅 ${team.level}`, PADDING + 8, y + XP_BAR_HEIGHT / 2 + 1);
    }
    ctx.restore();
  }

  // Шкала суперспособности — прямо под полосой опыта, уже и своего цвета,
  // чтобы ребёнок не путал её с опытом. Слева эмодзи: читать он не умеет,
  // а картинку со своим героем узнаёт.
  drawAbilityBar(ctx, player, arena, right) {
    const ability = player.ability;
    if (!ability) return;   // старое сохранение или автотест

    const y = PADDING + HEART_SIZE * 2.4 + XP_BAR_HEIGHT + 8
      + (right ? SOUND_BUTTON_CLEARANCE : 0);
    const x = right ? arena.width - PADDING - ABILITY_BAR_WIDTH : PADDING;
    // Готовая шкала пульсирует — это и есть приглашение нажать пробел.
    const pulse = ability.isReady ? 0.75 + Math.sin(player.glowPhase) * 0.25 : 1;
    // Пока способность работает, шкала показывает, сколько эффекта осталось.
    const ratio = ability.isActive
      ? ability.timer / (ability.spec.duration || 1)
      : ability.ratio;

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.roundRect(x, y, ABILITY_BAR_WIDTH, ABILITY_BAR_HEIGHT, 7);
    ctx.fill();

    ctx.fillStyle = ability.color;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(0, ABILITY_BAR_WIDTH * ratio), ABILITY_BAR_HEIGHT, 7);
    ctx.fill();

    ctx.font = `${ability.isReady ? 18 : 15}px system-ui, sans-serif`;
    ctx.textAlign = right ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    const emojiX = right ? x - 8 : x + ABILITY_BAR_WIDTH + 8;
    ctx.fillText(ability.emoji, emojiX, y + ABILITY_BAR_HEIGHT / 2);
    ctx.restore();
  }

  drawCounters(ctx, arena,
    { timeLeft, zombiesDefeated, round, bossActive, coop, modifier, compact = false }) {
    ctx.save();
    ctx.font = 'bold 20px system-ui, sans-serif';
    // Вдвоём справа сидят сердечки второго игрока — счётчики уезжают в центр.
    ctx.textAlign = coop ? 'center' : 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 4;

    const label = bossActive ? '👑 БОСС!' : `⏱ ${formatTime(timeLeft)}`;
    // Особый раунд — только эмодзи: имя ребёнок не прочитает, а место справа
    // и без того дефицитное.
    // На телефоне — только таймер (и значок особого раунда). Счётчик убитых и
    // номер раунда там просто занимают место: ни на одно решение ребёнка они
    // не влияют.
    const lines = compact ? [label] : [label, `🧟 ${zombiesDefeated}`, `Раунд ${round}`];
    if (modifier) lines.splice(1, 0, modifier.emoji);
    lines.forEach((line, i) => {
      // Отступ сверху — чтобы счётчики не налезали на кнопку звука.
      const y = PADDING + (coop ? 0 : SOUND_BUTTON_CLEARANCE) + i * 28;
      const x = coop ? arena.width / 2 : arena.width - PADDING;
      ctx.strokeText(line, x, y);
      ctx.fillText(line, x, y);
    });
    ctx.restore();
  }

  drawWeapons(ctx, player, arena, align = 'center') {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const slotSize = 46;
    const totalWidth = player.weapons.length * slotSize;
    const startX = {
      center: (arena.width - totalWidth) / 2,
      left: PADDING,
      right: arena.width - PADDING - totalWidth,
    }[align] + slotSize / 2;
    const y = arena.height - PADDING - slotSize / 2;

    player.weapons.forEach((weapon, i) => {
      const x = startX + i * slotSize;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.roundRect(x - slotSize / 2 + 3, y - slotSize / 2, slotSize - 6, slotSize, 10);
      ctx.fill();

      ctx.font = '22px system-ui, sans-serif';
      ctx.fillText(weapon.emoji, x, y - 6);

      // Звёзды точками: заполненные = текущий уровень оружия
      ctx.font = '9px system-ui, sans-serif';
      ctx.fillStyle = '#ffd93d';
      // Эволюция — не «пять точек как у прокачанного», а звезда: слот
      // выросшего оружия должен читаться одним взглядом.
      const dots = weapon.spec.evolved
        ? '★'
        : '●'.repeat(weapon.stars) + '○'.repeat(CONFIG.maxStars - weapon.stars);
      ctx.fillText(dots, x, y + 14);
    });
    ctx.restore();
  }
}

// Куда прижать ряд оружия. На телефоне — вправо: слева в нижнем углу лежит
// кнопка способности (⌀88, а с пульсацией «готово» до ~98), и слоты попадали
// бы прямо под неё.
function weaponAlign(coop, right, compact) {
  if (compact) return 'right';
  if (!coop) return 'center';
  return right ? 'right' : 'left';
}

function formatTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const mm = Math.floor(total / 60);
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
