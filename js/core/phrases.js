// Все фразы, которые игра произносит голосом, и полный их перечень.
//
// ЗАЧЕМ ЭТОТ МОДУЛЬ. Раньше каждый экран строил свою фразу сам, приватной
// функцией describeХХХ рядом с разметкой. Пока голос был синтезом, это работало.
// Теперь фиксированные фразы лежат записанными файлами (docs/audio.md), и их
// нужно ПЕРЕЧИСЛИТЬ в Node, не поднимая ни одного экрана: генератор,
// импортировав screens/cards.js, потянул бы за собой overlay и всю отрисовку.
//
// Поэтому построители живут здесь — в модуле без DOM, без побочных эффектов и
// без импортов тяжелее конфига. Экраны его импортируют, генератор и тест —
// тоже, и расходиться им негде.
//
// Правило, на котором держится вся защита от гниения: любая новая фраза для
// голоса — это функция с именем describeХХХ здесь плюс строка в allPhrases().
// test/voice.mjs проверяет ровно это соответствие.

import { CONFIG } from '../config.js';
import { CardKind } from '../systems/levelup.js';
import { GOAL_CLASSES, createGoal } from '../systems/goal.js';
import { themeName, goalText } from './campaign.js';

// --- Данные, которые нужны и разметке, и голосу ---

// Кто играет. Экран выбора добавляет к этим записям значки и подсказку с
// раскладкой; голосу нужны только имя и пояснение.
export const PLAYER_OPTIONS = [
  { count: 1, name: 'Один', about: 'Играешь сам' },
  { count: 2, name: 'Вдвоём', about: 'Вдвоём на одном экране' },
];

// Чем оружие берёт — одной строкой. Лежит здесь, а не на экране выбора,
// потому что это озвучиваемый текст, а не разметка.
export const WEAPON_HINTS = {
  water: 'Стреляет часто',
  tomato: 'Взрывается кляксой',
  lightning: 'Бьёт сразу нескольких',
  spinner: 'Крутится вокруг тебя',
  rocket: 'Редко, зато бабах!',
  fire: 'Поджигает зомби',
  ice: 'Замораживает зомби',
  saber: 'Рубит всех рядом',
  laser: 'Жжёт лучом насквозь',
  boomerang: 'Улетает и возвращается',
  bees: 'Летят и жалят сами',
  firetrail: 'Горит там, где ты пробежал',
  bubbles: 'Ловит зомби в пузырь',
  tornado: 'Вихрь таскает зомби',
  web: 'Липкие пятна замедляют',
};

// Похвала и предупреждения в бою. Список короткий нарочно: переговорить —
// такой же отказ, как промолчать. Правила и кулдауны — в core/voice.js.
export const REACTIONS = {
  streakA: 'Вот это да!',
  streakB: 'Ух ты!',
  lowHp: 'Осторожно! Одно сердечко!',
  goalHalf: 'Половина!',
  goalLast: 'Ещё один!',
  bossHalf: 'Ещё немножко!',
  win: 'Ты справился!',
};

// Главы называются по порядку, а не номером: «глава первая» ребёнок понимает,
// а «глава один» синтез произносит именно так, как написано, и это звучит
// поломкой.
const ORDINALS = ['первая', 'вторая', 'третья', 'четвёртая', 'пятая', 'шестая',
  'седьмая', 'восьмая', 'девятая', 'десятая', 'одиннадцатая', 'двенадцатая'];

// --- Согласование по числу ---
//
// Неправильное склонение ребёнок замечает сразу и переспрашивает. Обе функции
// раньше существовали в двух копиях (экран карточек и экран паузы).

export function starWord(count) {
  if (count === 1) return 'звезда';
  if (count >= 2 && count <= 4) return 'звезды';
  return 'звёзд';
}

export function dollarWord(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'долларов';
  if (last === 1) return 'доллар';
  if (last >= 2 && last <= 4) return 'доллара';
  return 'долларов';
}

// --- Построители фраз ---

export function describePlayers(option) {
  return `${option.name}. ${option.about}`;
}

export function describeDifficulty(spec) {
  return `${spec.name}. ${spec.about}`;
}

export function describeView(spec) {
  return `${spec.name}. ${spec.about}`;
}

// Имя героя, его бонус и способность.
//
// Способность здесь ТОЛЬКО названием. Раньше подставлялся icon(), то есть
// целая строка SVG, и ребёнок, нажав динамик, слушал разметку. Значок остаётся
// на карточке — это дело экрана, а не голоса.
export function describeCharacter(character) {
  return `${character.name}. ${character.about}. Способность: ${abilityName(character)}`;
}

// Не экспортируется и не перечисляется отдельно: само по себе название
// способности голосом никогда не звучит, только внутри фразы про героя.
function abilityName(character) {
  const ability = CONFIG.abilities[character.ability];
  return ability ? ability.name : '';
}

// Стартовое оружие на экране выбора.
export function describeWeaponPick(id) {
  return `${CONFIG.weapons[id].name}. ${WEAPON_HINTS[id]}`;
}

// Оружие в списке на паузе: что это и насколько прокачано.
export function describeArsenalWeapon(weapon) {
  return `${weapon.name}, ${weapon.stars} ${starWord(weapon.stars)}`;
}

// Карточка прокачки: что это и насколько прокачано.
export function describeCard(card) {
  if (!card) return '';
  if (card.kind === CardKind.HEAL) return 'Сердечко. Плюс одна жизнь';
  if (card.kind === CardKind.NEW_WEAPON) return `Новое оружие: ${card.title}`;
  // Здесь голос обязателен: ребёнок должен понять, что случилось нечто
  // большее, чем «плюс одна звезда».
  if (card.kind === CardKind.EVOLVE) return `${card.title}! Твоё оружие выросло. ${card.about}`;
  return `${card.title}, ${card.stars} ${starWord(card.stars)}`;
}

// Товар в магазине: что это, сколько стоит и хватает ли денег.
export function describeItem(spec, price, isMaxed, affordable) {
  if (isMaxed) return `${spec.name}. ${spec.about}. Уже куплено полностью`;
  const cost = `${price} ${dollarWord(price)}`;
  return affordable
    ? `${spec.name}. ${spec.about}. Стоит ${cost}`
    : `${spec.name}. ${spec.about}. Стоит ${cost}. Пока не хватает`;
}

export function describeSticker(sticker) {
  if (sticker.kind === 'medals') {
    // Закрытая медаль говорит УСЛОВИЕ, а не «???»: иначе для нечитающего
    // ребёнка её попросту нет.
    return sticker.open
      ? `${sticker.spec.name}. ${sticker.spec.about}`
      : `${sticker.spec.name}. ${sticker.spec.hint}`;
  }
  // Закрытая карточка тоже говорит: иначе ребёнок нажимает динамик, и ничего
  // не происходит.
  if (!sticker.open) return 'Этого зомби ты ещё не встречал. Найди его в игре!';
  return `${sticker.spec.name}. ${sticker.spec.about}`;
}

// Остановка на карте кампании.
export function describeStop(stop) {
  const { chapter, done, open, index } = stop;
  const where = `${themeName(chapter.theme)}, глава ${ORDINALS[index] || index + 1}.`;
  if (done) return `${where} Пройдено! Страница уже в альбоме.`;
  if (!open) return `${where} Сюда ещё рано.`;
  return `${where} ${chapter.about}. ${goalText(chapter)}`;
}

// Путешествие на экране выбора. Принимает уже посчитанный прогресс, а не
// объект кампании: перечислить все состояния в Node иначе нельзя.
export function describeJourneyProgress(title, open, total) {
  if (open >= total) return `${title}. Пройдено целиком!`;
  if (open === 0) return `${title}. Новое путешествие.`;
  return `${title}. Осталось глав: ${total - open}.`;
}

// --- Полный перечень ---

function enumerateCards() {
  const out = [describeCard({ kind: CardKind.HEAL })];
  for (const weapon of Object.values(CONFIG.weapons)) {
    if (weapon.evolved) {
      // Развитая форма живёт только на максимуме звёзд.
      out.push(describeCard({ kind: CardKind.UPGRADE, title: weapon.name, stars: CONFIG.maxStars }));
      out.push(describeCard({
        kind: CardKind.EVOLVE, title: weapon.name, about: weapon.about, stars: CONFIG.maxStars,
      }));
      continue;
    }
    out.push(describeCard({ kind: CardKind.NEW_WEAPON, title: weapon.name }));
    for (let stars = 1; stars <= CONFIG.maxStars; stars++) {
      out.push(describeCard({ kind: CardKind.UPGRADE, title: weapon.name, stars }));
    }
  }
  return out;
}

function enumerateArsenal() {
  const out = [];
  for (const weapon of Object.values(CONFIG.weapons)) {
    const from = weapon.evolved ? CONFIG.maxStars : 1;
    for (let stars = from; stars <= CONFIG.maxStars; stars++) {
      out.push(describeArsenalWeapon({ name: weapon.name, stars }));
    }
  }
  return out;
}

function enumerateShop() {
  const out = [];
  for (const spec of Object.values(CONFIG.shop)) {
    out.push(describeItem(spec, 0, true, true));
    for (const price of spec.prices) {
      out.push(describeItem(spec, price, false, true));
      out.push(describeItem(spec, price, false, false));
    }
  }
  return out;
}

function enumerateStickers() {
  const out = ['Этого зомби ты ещё не встречал. Найди его в игре!'];
  for (const spec of [...CONFIG.zombieTypes, ...CONFIG.bossTypes]) {
    out.push(describeSticker({ kind: 'zombies', spec, open: true }));
  }
  for (const spec of CONFIG.achievements) {
    out.push(describeSticker({ kind: 'medals', spec, open: true }));
    out.push(describeSticker({ kind: 'medals', spec, open: false }));
  }
  return out;
}

function enumerateStops() {
  const out = [];
  for (const journey of CONFIG.journeys) {
    journey.chapters.forEach((chapter, index) => {
      for (const state of [{ done: true, open: true }, { done: false, open: false }, { done: false, open: true }]) {
        out.push(describeStop({ chapter, index, ...state }));
      }
    });
  }
  return out;
}

function enumerateJourneys() {
  const out = [];
  for (const journey of CONFIG.journeys) {
    const total = journey.chapters.length;
    for (let open = 0; open <= total; open++) {
      out.push(describeJourneyProgress(journey.title, open, total));
    }
  }
  return out;
}

// Фразы, которые не привязаны к карточке: объявления, награды, история.
function fixedLines() {
  const out = [];
  for (const type of CONFIG.bossTypes) out.push(`Осторожно! ${type.name}!`);
  out.push('Он встаёт!');
  for (const medal of CONFIG.achievements) out.push(`Новая медаль! ${medal.name}`);
  for (const weapon of Object.values(CONFIG.weapons)) out.push(`${weapon.name}!`);
  for (const id of Object.keys(GOAL_CLASSES)) {
    const announce = createGoal(id).announce;
    if (announce) out.push(announce);
  }
  for (const id of CONFIG.specialRounds.order) out.push(CONFIG.specialRounds[id].announce);
  for (const journey of CONFIG.journeys) {
    for (const frame of [...(journey.intro || []), ...(journey.finale || [])]) {
      if (frame.line) out.push(frame.line);
    }
    if (journey.reward?.voice) out.push(journey.reward.voice);
  }
  out.push(...Object.values(REACTIONS));
  return out;
}

// Всё, что игра может произнести. Ключи совпадают с именами построителей —
// на этом держится проверка в test/voice.mjs.
export function allPhrases() {
  return {
    describePlayers: PLAYER_OPTIONS.map(describePlayers),
    describeDifficulty: CONFIG.difficulties.map(describeDifficulty),
    describeView: CONFIG.views.map(describeView),
    describeCharacter: CONFIG.characters.map(describeCharacter),
    describeWeaponPick: Object.keys(WEAPON_HINTS).map(describeWeaponPick),
    describeArsenalWeapon: enumerateArsenal(),
    describeCard: enumerateCards(),
    describeItem: enumerateShop(),
    describeSticker: enumerateStickers(),
    describeStop: enumerateStops(),
    describeJourneyProgress: enumerateJourneys(),
    fixedLines: fixedLines(),
  };
}
