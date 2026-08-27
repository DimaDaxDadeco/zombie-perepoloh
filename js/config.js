// Все игровые константы и баланс — в одном месте.
// Хочешь сделать игру легче/сложнее — крути числа здесь (см. docs/balance.md).

export const CONFIG = {
  round: {
    duration: 120,          // секунд до появления босса
    difficultyPerRound: 0.08, // +8% скорости/количества зомби за раунд
    difficultyCap: 2.0,     // потолок сложности (раунд ~13)
    victoryCoinsBase: 5,    // бонус монет за победу (+ номер раунда)
  },

  // Игра вдвоём. Все множители равны единице при одном игроке и применяются
  // в одном месте — иначе через полгода никто не найдёт, где ко-оп разошёлся
  // с одиночной игрой.
  coop: {
    retargetTime: 0.7,      // как часто зомби пересматривает, за кем бежать
    colors: ['#ffd93d', '#7fd8ff'],  // кольцо у ног: дети возьмут одного героя

    // Падение не заканчивает раунд: герой лежит призраком и встаёт сам.
    reviveTime: 12,
    reviveHelpFactor: 3,    // напарник рядом поднимает втрое быстрее
    reviveRadius: 90,
    reviveInvuln: 3,        // секунд неуязвимости после подъёма

    // Двое убивают вдвое быстрее — компенсация. При одном игроке все эти
    // множители равны единице (см. NO_COOP в round.js).
    //
    // Важно: спавном сложность вдвоём НЕ регулируется. Замер показал ноль
    // падений за шесть прогонов при 30 зомби на экране в среднем — толпа
    // делится между двумя героями, и каждый убегает легче, чем одиночка.
    // Крутить эти числа вверх бессмысленно: экран зарастает, а опаснее не
    // становится. Подробности — в docs/balance.md.
    xpFactor: 0.6,          // иначе к боссу всё оружие максимальное
    chargeFactor: 1.5,      // способности заряжаются от каждого убийства обоим
    spawnFactor: 1.7,       // чтобы поле не пустело — но не стена из зомби
    maxAliveFactor: 1.6,
    bossHpFactor: 2,        // иначе босс падает за пятнадцать секунд
  },

  // Особые раунды. Каждый четвёртый — необычный, по кругу. Первые три
  // чистые: ребёнок осваивает базу. Первым в цикле стоит подарок, а не ночь —
  // первое «необычное» должно быть однозначно приятным.
  specialRounds: {
    everyRounds: 4,
    bannerTime: 2.5,        // ровно окно spawner.warmupDelay
    order: ['medalRain', 'night', 'horde'],

    medalRain: {
      emoji: '🌧', name: 'Дождь медалек', announce: 'Дождь медалек!',
      extraMedals: 1, dropInterval: 1.2, dropRadius: 300, dropMinDist: 70,
      maxPickups: 40,
    },
    night: {
      emoji: '🌙', name: 'Ночь', announce: 'Ночь! Смотри, у тебя фонарик',
      // Тёмно-синий, а не чёрный: чёрный экран — единственное, что реально
      // страшно в пять лет. Прозрачность 0.55, а не 0.9: зомби вне круга
      // обязан оставаться узнаваемым силуэтом, никто не выпрыгивает из
      // пустоты. Убрать 'night' из order — аварийный выключатель.
      tint: 'rgba(14,18,48,0.55)',
      lightRadius: 330,     // чуть меньше дистанции спавна: враг входит в свет сразу
      flicker: 12,
    },
    horde: {
      emoji: '🧟', name: 'Волна-толпа', announce: 'Их очень много! Беги!',
      hp: 0.5, maxTypeHp: 1, intervalFactor: 0.5, batchBonus: 2, maxAlive: 1.6,
    },
  },

  // Ввод. Клавиши перечислены явно и раздельно двумя комплектами: второй
  // готов под игру вдвоём, сейчас он просто вторая раскладка для одного.
  input: {
    analogSpeed: false,     // true — скорость зависит от наклона стика (см. docs)
    keyboard1: {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      Space: 'ability', Enter: 'confirm', Escape: 'pause',
    },
    keyboard2: {
      KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
      KeyQ: 'ability',        // мизинец левой руки на WASD дотягивается
    },
    // Числа подобраны под детский палец на планшете, а не под курсор мыши.
    touch: {
      stickRadius: 70,      // ход большого пальца, ~18 мм на iPad
      deadzone: 0.2,        // детская рука дрожит; ниже 0.15 герой ползёт сам
    },
    gamepad: {
      stickDeadzone: 0.28,    // детская рука не держит стик в нуле
      buttons: {
        ability: [0],         // A
        confirm: [0],
        back: [1],            // B
        pause: [9, 8],        // Start / Select
        up: [12], down: [13], left: [14], right: [15],   // крестовина
      },
    },
  },

  player: {
    radius: 20,
    baseSpeed: 230,         // пикселей в секунду
    baseMaxHp: 5,           // сердечек без прокачки
    invulnTime: 2.0,        // секунд неуязвимости после удара
    knockbackRadius: 200,   // зомби отлетают при ударе по герою
    knockbackForce: 620,    // чтобы ребёнок всегда мог вырваться из окружения
    regenInterval: 18,      // секунд на восстановление одного сердечка
    weaponHoldTime: 0.35,   // сколько оружие держит руку, прежде чем его сменит другое
    weaponRecoilTime: 0.18, // длительность отдачи
  },

  // Герои. Внешность рисуется кодом по полю look (см. render/sprites.js),
  // perk — небольшой бонус, чтобы выбор был осмысленным, но не «правильным».
  characters: [
    {
      id: 'max',
      name: 'Супер-мэн',
      about: 'Лишнее сердечко',
      perk: { extraHp: 1 },
      ability: 'shockwave',
      look: {
        skin: '#ffcc99', hair: '#5c3a21', hairStyle: 'bowl',
        shirt: '#2f6fd0', pants: '#3a3a5c',
        cape: '#e03b3b', chest: 'star',
      },
    },
    {
      id: 'superS',
      name: 'Супер-Егор',
      about: 'Бегает быстрее всех',
      perk: { speedBonus: 30 },
      ability: 'dash',
      look: {
        skin: '#f7c9a0', hair: '#3b2a1c', hairStyle: 'cap',
        shirt: '#ffffff', pants: '#2f3550',
        cape: null, chest: 'text', chestText: '67',
        hat: { color: '#1c1c1c', letter: 'S' },
      },
    },
    {
      id: 'robot',
      name: 'Робот',
      about: 'Оружие сразу сильнее',
      perk: { startStars: 1 },
      ability: 'turbo',
      look: {
        skin: '#b8c4d0', hair: '#8b98a6', hairStyle: 'antenna',
        shirt: '#6c7a8c', pants: '#4a5461',
        cape: null, chest: 'bolt',
      },
    },
    {
      id: 'cat',
      name: 'Котик',
      about: 'Собирает медальки издалека',
      perk: { magnetBonus: 90 },
      ability: 'meow',
      look: {
        skin: '#ffb84d', hair: '#e09a2b', hairStyle: 'ears',
        shirt: '#7fd8a0', pants: '#4e9c72',
        cape: '#ffd93d', chest: 'none',
      },
    },
  ],
  defaultCharacter: 'max',

  // Уровень сложности выбирается один раз, в начале новой игры. Все поля —
  // множители и сдвиги к базовым числам ниже, поэтому «Легко» арифметически
  // тождественно балансу, который подбирался под пятилетнего: там все
  // множители единичные. Подробности и цели по победам — в docs/balance.md.
  difficulties: [
    {
      id: 'easy', name: 'Легко', emoji: '🐣',
      about: 'Зомби медленные, сердечки быстро возвращаются',
      hpRoundOffset: 0, hpEveryRounds: 3,
      zombieSpeed: 1, spawnRate: 1, maxAlive: 1, bossHp: 1,
      regenFactor: 1, extraHearts: 0, money: 1,
    },
    {
      id: 'normal', name: 'Нормально', emoji: '🙂',
      about: 'Зомби покрепче, зато долларов больше',
      // Сердечки намеренно не режем: «нормально» должно читаться как
      // «зомби больше», а не «жизней меньше».
      hpRoundOffset: 1, hpEveryRounds: 3,
      zombieSpeed: 1.12, spawnRate: 1.15, maxAlive: 1.2, bossHp: 1.25,
      regenFactor: 1.35, extraHearts: 0, money: 1.5,
    },
    {
      id: 'hard', name: 'Сложно', emoji: '🔥',
      about: 'Зомби быстрые и злые, зато долларов вдвое больше',
      hpRoundOffset: 1, hpEveryRounds: 2,
      zombieSpeed: 1.25, spawnRate: 1.3, maxAlive: 1.35, bossHp: 1.45,
      regenFactor: 1.8, extraHearts: -1, money: 2,
    },
  ],
  defaultDifficulty: 'easy',

  // Суперспособности. Копятся за убитых зомби, срабатывают по пробелу —
  // единственная кнопка в игре, кроме стрелок. У каждого героя своя, в
  // характере его перка: быстрый бегает ещё быстрее, у робота — турбо.
  abilities: {
    chargeNeeded: 20,   // столько зомби — полная шкала (примерно 3 раза за раунд)
    bossCharge: 10,     // босс сразу даёт полшкалы: убил босса — есть чем начать

    shockwave: {
      name: 'Супер-удар', emoji: '💥', about: 'Волна раскидывает зомби',
      color: '#ff8a2b',
      radius: 260, damage: 6, force: 900,
      shake: { strength: 12, time: 0.35 },
    },
    dash: {
      name: 'Супер-скорость', emoji: '🏃', about: 'Бежишь как ветер',
      color: '#7fd8ff',
      duration: 5, speedFactor: 2, knockback: 700,
    },
    turbo: {
      name: 'Турбо', emoji: '⚡', about: 'Оружие палит вдвое чаще',
      color: '#9be86b',
      duration: 6, rate: 2,
    },
    meow: {
      name: 'Мяу!', emoji: '🐾', about: 'Все зомби замирают',
      color: '#ffb3de',
      duration: 4,
    },
  },

  zombie: {
    radius: 21,
    baseHp: 2,              // ступенька роста HP — в difficulties.hpEveryRounds
    baseSpeed: 36,
    speedJitter: 14,        // разброс скорости, чтобы толпа не шла строем
    moneyDropChance: 0.25,
    medalDropChance: 0.6,   // медаль падает не с каждого зомби — опыт ценнее
    doubleMedalChance: 0.2,
  },

  // Виды зомби. hp/speed/radius — множители к базовым значениям раунда.
  // fromRound — с какого раунда вид начинает встречаться, weight — как часто.
  zombieTypes: [
    {
      id: 'normal', name: 'Обычный', about: 'Обычный зомби, ковыляет не спеша',
      hp: 1, speed: 1, radius: 1, weight: 10, fromRound: 1,
      look: { skin: '#8fd67a', clothes: '#7a6bb5', body: 'normal' },
    },
    {
      id: 'runner', name: 'Шустрик', about: 'Бегает быстро, но слабенький',
      hp: 0.5, speed: 1.75, radius: 0.8, weight: 5, fromRound: 2,
      look: { skin: '#c3e88d', clothes: '#e08a3c', body: 'thin', hair: 'spiky' },
    },
    {
      id: 'tank', name: 'Толстяк', about: 'Толстый и живучий, зато медленный',
      hp: 3, speed: 0.55, radius: 1.4, weight: 3, fromRound: 3,
      look: { skin: '#6fae5c', clothes: '#4a6fa5', body: 'fat' },
    },
    {
      id: 'helmet', name: 'Каскетка', about: 'В каске — попробуй пробей',
      hp: 2, speed: 0.85, radius: 1.05, weight: 4, fromRound: 4,
      look: { skin: '#93cf9a', clothes: '#5f7a8a', body: 'normal', helmet: '#ffb703' },
    },
    {
      id: 'grandpa', name: 'Дед с тросточкой', about: 'Дедушка с тросточкой, идёт не торопясь',
      hp: 2.5, speed: 0.7, radius: 1.1, weight: 3, fromRound: 5,
      look: {
        skin: '#8fbf86', clothes: '#6b5f4a', body: 'normal',
        hair: 'bald', beard: '#dfe3e0', cane: '#8b5a2b',
      },
    },
    // --- Зомби-животные. Ходят на четырёх лапах и ведут себя по-своему:
    // поле behavior читает Zombie.update, см. docs/entities.md ---
    {
      id: 'dog', name: 'Зомби-собака', about: 'Прибегает стайкой, очень быстрая', behavior: 'pack',
      hp: 0.8, speed: 1.5, radius: 0.85, weight: 4, fromRound: 3,
      packMin: 2, packMax: 4,          // всегда прибегает стайкой
      look: { shape: 'beast', beast: 'dog', skin: '#a3b884', clothes: '#7d8f63' },
    },
    {
      id: 'cat', name: 'Зомби-котик', about: 'Виляет из стороны в сторону', behavior: 'zigzag',
      hp: 0.6, speed: 1.4, radius: 0.7, weight: 4, fromRound: 4,
      // Реже, но размашистее: частое мелкое виляние на глаз не читается
      zigzagAmount: 1.4,
      zigzagSpeed: 2.6,
      look: { shape: 'beast', beast: 'cat', skin: '#b8a0c8', clothes: '#9b82ad' },
    },
    {
      id: 'mole', name: 'Зомби-крот', about: 'Ныряет под землю и выныривает рядом', behavior: 'burrow',
      hp: 2, speed: 0.9, radius: 0.9, weight: 3, fromRound: 6,
      burrowInterval: 4,               // секунд на поверхности до нырка
      burrowTime: 1.6,                 // сколько сидит под землёй
      burrowJump: 240,                 // на столько подбирается, вынырнув
      look: { shape: 'beast', beast: 'mole', skin: '#8d7a6b', clothes: '#6f5f52' },
    },
    {
      id: 'grandma', name: 'Бабуля', about: 'Бабуля, а бегает шустро',
      hp: 1.5, speed: 1.15, radius: 0.95, weight: 3, fromRound: 6,
      look: { skin: '#a9d9a0', clothes: '#c96b9c', body: 'normal', hair: 'bun' },
    },
  ],

  boss: {
    radius: 58,
    baseHp: 115,
    hpGrowthPerRound: 0.2,  // +20% здоровья босса за раунд
    speed: 26,
    coins: 10,
    spawnDistance: 320,     // не ближе к герою — появление должно быть безопасным
    spawnMargin: 110,       // отступ от краёв: босс должен влезть в кадр целиком
    introTime: 2.0,         // секунд на эффект появления
    freezeTime: 2.2,        // столько зомби стоят, пока ребёнок смотрит
    shake: { time: 0.4, strength: 9 },      // тряска по умолчанию
    slamShake: { time: 0.6, strength: 18 }, // и усиленная — для падения толстяка

    // Вторая фаза: на половине здоровья босс звереет. Это важнее лишних HP —
    // бой получает перелом в середине, а не тянется ровной полосой.
    enrageAt: 0.5,          // доля здоровья, ниже которой начинается ярость
    enrageSpeed: 1.3,       // во столько раз быстрее
    enrageRate: 0.6,        // множитель интервалов способностей (меньше = чаще)
  },

  // Виды боссов. hp/speed/radius — множители к базовым значениям выше.
  // Каждый раунд выходит следующий по списку, потом круг начинается заново,
  // поэтому пять раундов подряд ребёнок встречает пять разных боссов.
  bossTypes: [
    {
      id: 'tophat', name: 'Толстяк в цилиндре', about: 'Топает так, что земля дрожит', ability: 'none', entrance: 'slam', rage: 'stomp',
      hp: 1, speed: 1, radius: 1,
      look: { skin: '#7cc766', clothes: '#4a3f6b', hat: 'tophat', accent: '#e03b3b', chest: 'bowtie' },
    },
    {
      id: 'mother', name: 'Мама-зомби', about: 'Зовёт малышей на помощь', ability: 'spawn', entrance: 'swirl', rage: 'hearts',
      hp: 1.1, speed: 0.9, radius: 1.05,
      look: { skin: '#9ed48f', clothes: '#c96b9c', hat: 'bun', accent: '#ffd93d', chest: 'bowtie' },
      spawnInterval: 3.2, // секунд между выводками
      spawnCount: 2,      // малышей за раз
    },
    {
      id: 'runner', name: 'Босс-спортсмен', about: 'Разгоняется и бросается рывком', ability: 'dash', entrance: 'rush', rage: 'speed',
      hp: 0.85, speed: 1.5, radius: 0.85,
      look: {
        skin: '#bfe38a', clothes: '#2f6fd0', accent: '#ffffff',
        hat: 'headband', headbandColor: '#ff4d6d',
        chest: 'number', chestText: '1',
      },
      dashInterval: 2.8,  // секунд между рывками
      dashSpeed: 3.2,     // во сколько раз быстрее во время рывка
      dashTime: 0.8,
    },
    {
      id: 'ice', name: 'Ледяной босс', about: 'Примораживает, если тронет', ability: 'chill', entrance: 'ice', rage: 'frost',
      hp: 1.15, speed: 0.85, radius: 1.05,
      look: { skin: '#9fd8e8', clothes: '#3f7fbf', hat: 'crown', accent: '#e8fbff', chest: 'bowtie' },
      chillFactor: 0.55,  // насколько замедляет героя
      chillTime: 2,
    },
    {
      id: 'fire', name: 'Огненный босс', about: 'Роняет за собой огоньки', ability: 'flames', entrance: 'fire', rage: 'blaze',
      hp: 1.05, speed: 1.05, radius: 1,
      look: { skin: '#f2a35c', clothes: '#b8362a', hat: 'crown', accent: '#ffd93d', chest: 'bowtie' },
      flameInterval: 0.9, // как часто роняет огонёк
      flameLife: 3.5,     // сколько секунд огонёк горит
      flameRadius: 26,
    },
  ],

  spawner: {
    startInterval: 2.2,     // секунд между волнами в начале раунда
    endInterval: 0.7,       // и в конце раунда
    batchMin: 1,
    batchMax: 2,
    maxAlive: 32,
    minDistanceFromPlayer: 340, // зомби не появляется у героя за спиной
    warmupDelay: 2.5,       // секунд тишины в начале раунда — освоиться

  },

  xp: {
    baseToLevel: 4,         // звёзд до первого уровня
    perLevel: 2,            // +столько за каждый следующий
  },

  pickups: {
    medalXp: 1,             // опыта за одну медальку
    collectRadius: 26,
    baseMagnetRadius: 140,  // щедро: медальки не должны копиться мусором на поле
    magnetPerLevel: 60,     // прибавка радиуса за уровень магнита в магазине
    flySpeed: 420,          // скорость притяжения к герою
  },

  // Оружие: массивы — значения по звёздам (индекс 0 = 1 звезда).
  weapons: {
    // evolution — id обычного оружия, а не вложенный блок: эволюция обязана
    // быть полноценным оружием (класс, ствол в руке, эмодзи, озвучка).
    // Флаг evolved прячет её из выбора стартового и из карточек «новое».
    water: {
      name: 'Водяной пистолет', emoji: '💧', evolution: 'watercannon',
      cooldown: [0.55, 0.45, 0.4, 0.35, 0.28],
      count:    [1, 1, 2, 2, 3],
      damage:   [1, 1, 1, 2, 2],
      speed: 520,
    },
    tomato: {
      name: 'Помидорометалка', emoji: '🍅', evolution: 'tomatocannon',
      cooldown: [1.7, 1.5, 1.3, 1.15, 1.0],
      radius:   [60, 72, 84, 96, 112],
      damage:   [2, 2, 3, 3, 4],
      flightTime: 0.55,
    },
    lightning: {
      name: 'Молния', emoji: '⚡',
      cooldown: [1.5, 1.3, 1.15, 1.0, 0.85],
      chain:    [1, 2, 2, 3, 4],
      damage:   [3, 3, 4, 4, 5],
      chainRadius: 170,
    },
    spinner: {
      name: 'Вертушка', emoji: '🌀',
      // Вертушка бьёт вблизи, а ребёнок убегает — поэтому со старта ей нужны
      // две лопасти и широкая орбита, иначе преследователи её не задевают.
      blades:   [2, 2, 3, 3, 4],
      orbit:    [96, 106, 116, 126, 138],
      damage:   [2, 3, 3, 4, 4],
      spinSpeed: 3.2,       // радиан в секунду
      hitCooldown: 0.4,     // пауза между ударами по одному зомби
    },
    rocket: {
      name: 'Ракета-морковка', emoji: '🥕',
      cooldown: [3.5, 3.1, 2.7, 2.3, 1.9],
      radius:   [80, 90, 100, 115, 130],
      damage:   [5, 6, 7, 8, 10],
      speed: 300,
      turnSpeed: 3.5,       // как резко доворачивает к цели
    },
    fire: {
      name: 'Огнемёт', emoji: '🔥',
      cooldown: [0.9, 0.8, 0.7, 0.6, 0.5],
      damage:   [1, 1, 2, 2, 3],   // урон самой струи
      burnDps:  [1, 2, 2, 3, 4],   // и сколько капает каждую секунду горения
      burnTime: [2.0, 2.5, 3.0, 3.5, 4.0],
      count:    [3, 3, 4, 4, 5],   // язычков пламени в струе
      spread: 0.34,                // конус разлёта
      speed: 320,
      range: 330,                  // пламя гаснет на лету: бьёт ближе других, но достаёт
    },
    ice: {
      name: 'Ледяная пушка', emoji: '❄️',
      cooldown:    [1.1, 0.95, 0.85, 0.75, 0.65],
      damage:      [2, 2, 3, 4, 5],
      freezeTime:  [1.4, 1.7, 2.0, 2.4, 2.8],
      freezeFactor:[0.55, 0.5, 0.45, 0.4, 0.35], // во столько раз медленнее
      count:       [1, 1, 2, 2, 3],
      spread: 0.22,
      speed: 420,
    },
    saber: {
      name: 'Световой меч', emoji: '⚔️', evolution: 'dualsaber',
      cooldown: [0.75, 0.65, 0.58, 0.5, 0.42],
      damage:   [3, 4, 5, 6, 8],
      reach:    [95, 105, 115, 125, 140],  // длина клинка
      arc:      [1.5, 1.7, 1.9, 2.2, 2.6], // ширина взмаха в радианах
    },

    // --- Эволюции: доступны только как награда за пятую звезду ---
    // Массив длиной 1 — норма: stat() берёт последний элемент, если массив
    // короче числа звёзд. Звёзды у эволюции всегда максимальные.
    watercannon: {
      evolved: true,
      name: 'Водомёт', emoji: '🌊', about: 'Бьёт струёй насквозь',
      cooldown: [0.16], damage: [2], count: [1], speed: 640, pierce: 4,
    },
    tomatocannon: {
      evolved: true,
      name: 'Помидорная пушка', emoji: '🍝', about: 'Три помидора разом',
      cooldown: [1.1], damage: [6], radius: [130], count: [3],
      flightTime: 0.55, spread: 90,
    },
    dualsaber: {
      evolved: true,
      name: 'Двойной меч', emoji: '🗡', about: 'Рубит вокруг себя',
      cooldown: [0.38], damage: [9], reach: [155], arc: [6.3],
    },
  },
  startingWeapon: 'water',
  maxStars: 5,

  // Магазин: цены по уровням (длина массива = максимум покупок).
  // about — короткое детское объяснение, что покупка делает. Без него ребёнок
  // видит только иконку и цену и не понимает, за что платит.
  // Питомцы. Бегают за героем и кусают сами; покупаются в магазине.
  // Уровней у них нет: для пятилетнего «собачка теперь бьёт на единицу
  // больше» невидимо, а «у меня есть собачка» — событие.
  pets: {
    dog: {
      name: 'Собачка', radius: 14,
      followDistance: 46, followOffset: 16, personalSpace: 30,
      maxSpeed: 300, accel: 1500, friction: 0.02,
      wanderSpeed: 2.2, wanderAmount: 10,
      chaseRadius: 240, leash: 260,
      // Урон нарочно маленький: номинальный dps занижает реальную пользу —
      // собака ещё и отбрасывает укушенного и перехватывает тех, кто догоняет
      // сзади, то есть закрывает ровно ту дыру, которую ребёнок закрыть не
      // умеет. С уроном 2 автотест давал 115 побед из 120 при норме ~101.
      damage: 1, cooldown: 1.2, biteRange: 6, force: 150,
      look: { skin: '#d8a25c', clothes: '#b07c3e', beast: 'dog', collar: '#e34b3a' },
    },
    drone: {
      name: 'Робот-помощник', radius: 12,
      followDistance: 40, followOffset: -6, personalSpace: 26,
      maxSpeed: 340, accel: 1700, friction: 0.02,
      wanderSpeed: 3, wanderAmount: 6,
      chaseRadius: 300, leash: 300,
      damage: 1, cooldown: 0.8, speed: 460,
      look: { body: '#8c9bb0', eye: '#4fd2ff' },
    },
  },

  shop: {
    speed: {
      name: 'Быстрые кроссовки', emoji: '👟', about: 'Бегаешь быстрее',
      prices: [10, 20, 35, 55, 80], bonus: 18,
    },
    heart: {
      name: 'Сердечко', emoji: '❤️', about: 'Ещё одна жизнь',
      prices: [20, 50], bonus: 1,
    },
    star: {
      name: 'Сильный старт', emoji: '💪', about: 'Оружие сразу сильнее',
      prices: [40, 90], bonus: 1,
    },
    magnet: {
      name: 'Магнит медалек', emoji: '🧲', about: 'Медальки летят к тебе издалека',
      prices: [10, 25, 45, 70], bonus: 1,
    },
    // Питомцы — товары с одной ценой: точки читаются как «есть / нет», и
    // весь остальной код магазина работает без единой правки.
    dog: {
      name: 'Собачка', emoji: '🐕', about: 'Бегает с тобой и кусает зомби',
      prices: [60], bonus: 1, pet: 'dog',
    },
    drone: {
      name: 'Робот-помощник', emoji: '🤖', about: 'Летает рядом и стреляет',
      prices: [90], bonus: 1, pet: 'drone',
    },
  },

  // Фоны: каждые 3 раунда следующий, по кругу.
  themes: [
    { name: 'Двор',   ground: '#7ec850', accent: '#5aa63c', deco: 'flowers' },
    { name: 'Парк',   ground: '#5aa956', accent: '#3d8a44', deco: 'trees' },
    { name: 'Пляж',   ground: '#f0d9a0', accent: '#d9bd7d', deco: 'beach' },
    { name: 'Космос', ground: '#2b2d4a', accent: '#3d4066', deco: 'space' },
  ],
  roundsPerTheme: 3,
};
