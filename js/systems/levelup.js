// Генерация трёх карточек прокачки при повышении уровня.
// Карточка — это либо новое оружие, либо +1 звезда уже имеющемуся.

import { CONFIG } from '../config.js';
import {
  ALL_WEAPON_IDS, baseWeaponId, createWeapon, evolveWeapon,
} from '../weapons/weapons.js';

const MAX_WEAPONS = 5;   // сколько оружий герой может носить одновременно
const CARDS_COUNT = 3;

export const CardKind = {
  NEW_WEAPON: 'new',
  UPGRADE: 'upgrade',
  HEAL: 'heal',
  EVOLVE: 'evolve',
};

// Возвращает массив карточек: { kind, weaponId, title, emoji, stars }
export function generateCards(player) {
  // Ключ — id ДО эволюции: водомёт занимает слот водяного пистолета и
  // закрывает его от повторной выдачи. Иначе эволюционировавшее оружие снова
  // выпадало бы как новое, с одной звездой, и съедало второй слот из пяти.
  const owned = new Map(player.weapons.map((w) => [baseWeaponId(w.id), w]));
  const options = [];

  // Апгрейды имеющегося оружия
  for (const weapon of player.weapons) {
    if (weapon.isMaxed) continue;
    // Карточка пятой звезды — и есть карточка эволюции, с новым именем и
    // новой картинкой ещё до того, как её взяли. Ребёнок сам выбирает
    // превращение, и это его победа, а не подарок системы.
    const evolveId = weapon.stars + 1 >= CONFIG.maxStars
      ? CONFIG.weapons[weapon.id].evolution
      : null;
    if (evolveId) {
      options.push({
        kind: CardKind.EVOLVE,
        weaponId: weapon.id,
        title: CONFIG.weapons[evolveId].name,
        emoji: CONFIG.weapons[evolveId].emoji,
        about: CONFIG.weapons[evolveId].about,
        stars: CONFIG.maxStars,
      });
      continue;
    }
    options.push({
      kind: CardKind.UPGRADE,
      weaponId: weapon.id,
      title: weapon.name,
      emoji: weapon.emoji,
      stars: weapon.stars + 1,
    });
  }

  // Новое оружие, если есть свободный слот
  if (owned.size < MAX_WEAPONS) {
    for (const id of ALL_WEAPON_IDS) {
      if (owned.has(id)) continue;
      options.push({
        kind: CardKind.NEW_WEAPON,
        weaponId: id,
        title: CONFIG.weapons[id].name,
        emoji: CONFIG.weapons[id].emoji,
        stars: 1,
      });
    }
  }

  // Эволюция всегда попадает в набор, а не разыгрывается наравне с прочим:
  // она — цель всей прокачки внутри раунда, и прятать её в случайности
  // значит обесценить фичу целиком. Их не может быть больше двух-трёх.
  const evolutions = options.filter((o) => o.kind === CardKind.EVOLVE);
  const rest = options.filter((o) => o.kind !== CardKind.EVOLVE);
  const cards = [
    ...evolutions.slice(0, CARDS_COUNT),
    ...pickRandom(rest, CARDS_COUNT - Math.min(evolutions.length, CARDS_COUNT)),
  ];

  // Если апгрейдов не осталось (всё прокачано) — предлагаем сердечко,
  // чтобы экран выбора никогда не оказался пустым.
  while (cards.length < CARDS_COUNT) {
    cards.push({
      kind: CardKind.HEAL,
      weaponId: null,
      title: 'Сердечко',
      emoji: '❤️',
      stars: 0,
    });
  }
  return cards;
}

// Применить выбранную карточку к герою. Живёт рядом с generateCards, которая
// эти карточки и производит: разнести производство и применение по разным
// модулям значит завести два места, где надо помнить состав CardKind.
//
// Возвращает эволюционировавшее оружие или null. Салют, звук и голос остаются
// на Game: они трогают audio и speech, а этот модуль обязан оставаться чистым —
// его зовёт автотест в Node, где ни того, ни другого нет.
export function applyCard(player, card) {
  if (!player || !card) return null;
  if (card.kind === CardKind.NEW_WEAPON) {
    player.weapons.push(createWeapon(card.weaponId));
    return null;
  }
  if (card.kind === CardKind.EVOLVE) {
    // Замена на месте, по индексу: слот в HUD не должен переезжать.
    const index = player.weapons.findIndex((w) => w.id === card.weaponId);
    player.weapons[index] = evolveWeapon(player.weapons[index]);
    return player.weapons[index];
  }
  if (card.kind === CardKind.UPGRADE) {
    player.findWeapon(card.weaponId)?.upgrade();
    return null;
  }
  player.hp = Math.min(player.maxHp, player.hp + 1);
  return null;
}

function pickRandom(items, count) {
  const pool = [...items];
  const result = [];
  while (pool.length > 0 && result.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}
