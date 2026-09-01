// Что герой получает на старте раунда: покупки из магазина, перк персонажа и
// сдвиги уровня сложности, сведённые в один объект для Round.
//
// Живёт отдельно от Game намеренно. Это чистая арифметика над сохранением —
// ни DOM, ни звука, ни экранов, — и ровно поэтому её можно позвать из Node.
// Балансный автотест (test/) обязан считать бонусы ТЕМ ЖЕ кодом, что и игра:
// стоит ему завести свою копию формулы, и он начнёт мерить игру, которой нет.
// Ошибка при этом выйдет молчаливой — деструктуризация в Player роняет
// незнакомые поля без единого сообщения, герой просто встанет с нулём убитых.

import { CONFIG } from '../config.js';

// Ключи сохранения для игрока N. Второй хранится отдельными полями —
// см. комментарий в storage.js.
export function characterKey(i) { return i === 0 ? 'character' : `character${i + 1}`; }
export function weaponKey(i) { return i === 0 ? 'weapon' : `weapon${i + 1}`; }

// Уровень сложности из сохранения. Незнакомый id (правленый localStorage
// или сохранение из будущей версии) — «Легко»: ошибаться надо в сторону
// проходимости, а не в сторону непроходимой игры.
export function getDifficulty(save) {
  const id = save.difficulty || CONFIG.defaultDifficulty;
  return CONFIG.difficulties.find((d) => d.id === id) || CONFIG.difficulties[0];
}

// Выбранный герой; если сохранения ещё нет — герой по умолчанию.
export function getCharacter(save, playerIndex = 0) {
  const id = save[characterKey(playerIndex)] || CONFIG.defaultCharacter;
  return CONFIG.characters.find((c) => c.id === id) || CONFIG.characters[0];
}

// Бонусы, применяемые к герою на старте раунда.
export function buildUpgrades(save, playerIndex = 0) {
  const bought = save.shop;
  const character = getCharacter(save, playerIndex);
  const perk = character.perk;
  const diff = getDifficulty(save);
  return {
    speed: CONFIG.player.baseSpeed
      + bought.speed * CONFIG.shop.speed.bonus
      + (perk.speedBonus || 0),
    // На «Сложно» сердечек на одно меньше, но никогда не ноль.
    maxHp: Math.max(1, CONFIG.player.baseMaxHp
      + bought.heart * CONFIG.shop.heart.bonus
      + (perk.extraHp || 0)
      + diff.extraHearts),
    regenInterval: CONFIG.player.regenInterval * diff.regenFactor,
    startStars: bought.star * CONFIG.shop.star.bonus + (perk.startStars || 0),
    magnetRadius: CONFIG.pickups.baseMagnetRadius
      + bought.magnet * CONFIG.pickups.magnetPerLevel
      + (perk.magnetBonus || 0),
    // Питомцы: товар с полем pet отдаёт id живого спутника.
    pets: Object.entries(CONFIG.shop)
      .filter(([id, spec]) => spec.pet && bought[id])
      .map(([, spec]) => spec.pet),
    // Множители команды: применяются в Round, потому что и деньги, и опыт
    // в игре общие.
    coinBonus: perk.coinBonus || 0,
    xpBonus: perk.xpBonus || 0,
    // Ноль у всех, кроме Хэнки: по нулю проход по врагам не запускается.
    stinkRadius: perk.stinkRadius || 0,
    // Ноль у всех, кроме Бэтмена: по нулю броня не считается.
    armorEvery: perk.armorEvery || 0,
    look: character.look,
    ability: character.ability,
    // Герой со своим оружием (Паук) выбор игнорирует: у него оно одно.
    startWeapon: character.fixedWeapon
      || save[weaponKey(playerIndex)]
      || CONFIG.startingWeapon,
  };
}
