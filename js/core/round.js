// Раунд — вся симуляция игрового мира: герой, зомби, снаряды, пикапы, босс.
// Round одновременно играет роль объекта `world`, который получают сущности
// и оружие: через него они наносят урон, добавляют снаряды и взрывы.
//
// Round ничего не знает про экраны и меню — о событиях он сообщает колбэками
// (onLevelUp, onBossAppear, onVictory, onDefeat). Склейкой занимается core/game.js.

import { CONFIG } from '../config.js';
import { Player } from '../entities/player.js';
import { Pickup, PickupType } from '../entities/pickup.js';
import { Spawner } from '../systems/spawner.js';
import { createAbility } from '../systems/ability.js';
import { createPet } from '../entities/pet.js';
import { createModifier, modifierForRound } from '../systems/modifier.js';
import { createGoal } from '../systems/goal.js';
import { Particles } from '../systems/particles.js';
import { resolveProjectileHits, resolvePlayerHits, separateEnemies } from '../systems/collisions.js';
import { createWeapon, evolveWeapon } from '../weapons/weapons.js';
import { Background } from '../render/background.js';
import { bossTypeForRound } from '../entities/boss.js';
import { bossSpawnPoint } from '../systems/spawner.js';

// Длительность появления босса и паузы для зомби — в CONFIG.boss.

const ZERO = { x: 0, y: 0 };
// Множители ко-опа при одном игроке. Держим отдельной константой, чтобы
// «одиночная игра ничего не умножает» было видно, а не выводилось из кода.
const NO_COOP = { xpFactor: 1, chargeFactor: 1, spawnFactor: 1, maxAliveFactor: 1, bossHpFactor: 1 };

export class Round {
  // difficultySpec — запись из CONFIG.difficulties. Имя не `difficulty`
  // намеренно: у Spawner так называется кривая по номеру раунда, и два разных
  // смысла под одним именем в одной цепочке вызовов обязательно аукнутся.
  // theme — локация; не передана, значит считается по номеру раунда.
  // theme — локация; не передана, значит считается по номеру раунда.
  // goal — задача раунда; по умолчанию классическая, «убей босса».
  // duration и victoryCoins сюжетная глава задаёт свои: у главы «продержись 45
  // секунд» и время своё, и платить за неё как за двенадцатый раунд не за что.
  constructor({
    round, arena, audio, upgrades, players, callbacks,
    difficulty = CONFIG.difficulties[0], theme = null, goal = 'boss',
    duration = CONFIG.round.duration, victoryCoins = null,
    bossType = null, modifier,
  }) {
    this.round = round;
    this.difficultySpec = difficulty;
    this.arena = arena;
    this.audio = audio;
    this.callbacks = callbacks;

    // Игроков может быть один или двое. `player` ниже — геттер «первый»:
    // он остался ради совместимости (превью-стенды, автотест), а в боевом
    // коде каждый спрашивает конкретного владельца или ближайшего.
    const specs = players || [upgrades];
    this.players = specs.map((spec, i) => this.createPlayer(spec, i, specs.length));
    this.coopFactor = specs.length > 1 ? CONFIG.coop : NO_COOP;

    // Перки-множители команды: доллары Соника и опыт Пикачу достаются всем —
    // и деньги, и уровень в игре общие, разделять их было бы странно.
    // Берём ЛУЧШИЙ, а не сумму: два Соника не должны удваивать заработок.
    this.coinFactor = 1 + Math.max(0, ...specs.map((spec) => spec.coinBonus || 0));
    this.xpFactor = 1 + Math.max(0, ...specs.map((spec) => spec.xpBonus || 0));

    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = new Particles();
    this.spawner = new Spawner(round, difficulty, this.coopFactor);
    // Модификатор особого раунда правит уже посчитанные числа спавнера.
    // Модификатор трёхзначен намеренно. Не передан — считаем по номеру, как
    // было всегда. null — «не давать»: сюжетная глава не должна получить ночь
    // поверх тёмной локации только потому, что её номер делится на четыре.
    // Строка — дать именно этот.
    this.modifier = createModifier(
      modifier === undefined ? modifierForRound(round) : modifier,
    );
    this.modifier?.tuneSpawner(this.spawner);
    // Баннер в начале раунда: имя особого раунда или задача сюжетной главы.
    // Слот один — двух надписей поверх арены разом ребёнок всё равно не
    // прочитает, а кто именно его занял, решает Game (см. announceRound).
    this.bannerText = this.modifier ? this.modifier.spec.name : null;
    this.bannerTimer = this.bannerText ? CONFIG.specialRounds.bannerTime : 0;
    // Локация: сюжетная глава задаёт её явно, обычный раунд считает по номеру.
    this.theme = theme;
    this.background = new Background();
    this.background.rebuild(round, arena, this.theme);

    // Опыт и уровень общие на команду. Две полосы ребёнок не читает, а при
    // раздельном опыте активный игрок обгоняет тихого, и тот получает вдвое
    // меньше карточек — то есть «второй испортил первому», только наоборот.
    this.level = 1;
    this.xp = 0;
    this.xpToNext = CONFIG.xp.baseToLevel;

    this.goal = createGoal(goal);
    this.goal.tuneSpawner(this.spawner);
    this.duration = duration;
    this.victoryCoins = victoryCoins ?? (CONFIG.round.victoryCoinsBase + round);
    this.timeLeft = duration;
    this.medalsCollected = 0;
    this.zombiesDefeated = 0;
    this.coinsEarned = 0;
    this.bossPhase = 'none'; // none -> intro -> fight
    // Спрашиваем ОДИН раз за раунд и запоминаем: после двенадцатого раунда
    // выбор случайный, и повторный вызов дал бы другого босса — баннер
    // объявил бы одного, а вышел бы другой.
    // Сюжетная глава называет босса сама. Без этого карта могла бы показать
    // одного, а в бой вышел бы другой: после двенадцатого раунда выбор
    // случайный (см. ниже).
    this.bossType = bossType
      ? CONFIG.bossTypes.find((t) => t.id === bossType) || bossTypeForRound(this.round)
      : bossTypeForRound(this.round);
    this.bossIntroTimer = 0;
    this.bossSpawnPoint = null; // где именно появится босс (внутри экрана)
    this.freezeTimer = 0;       // пока идёт — обычные зомби стоят
    // Приказ охранника: множитель времени для зомби. Живёт здесь, а не в
    // Zombie.speedFactor — иначе там было бы три источника правды сразу.
    this.rallyTimer = 0;
    this.rallyFactor = 1;
    this.shakeTimer = 0;
    this.shakeMaxTime = 1;
    this.shakeStrength = 0;
    this.finished = false;
    // Открытые в этом раунде наклейки. Round про Storage не знает — отдаёт их
    // в getSummary(), а пишет уже Game, одним вызовом в конце раунда.
    this.discovered = { zombies: new Set(), bosses: new Set() };
    // Факты для медалей. Round про них тоже не знает: он только считает, а
    // решает Achievements в конце раунда. Флаги живут ЗДЕСЬ, а не на Game,
    // потому что «повторить раунд» не двигает номер раунда — новый Round
    // обязан начать с чистого листа сам.
    this.damageTaken = 0;
    this.bossKilledBy = null;   // 'ability' | 'weapon' | 'enemy'
  }

  // Герой со всем снаряжением. Двое встают по разные стороны от центра,
  // чтобы не начинать раунд, стоя друг в друге.
  createPlayer(spec, index, count) {
    const offset = count > 1 ? (index === 0 ? -70 : 70) : 0;
    const player = new Player(this.arena.width / 2 + offset, this.arena.height / 2, spec);
    player.index = index;
    player.color = CONFIG.coop.colors[index % CONFIG.coop.colors.length];
    const startWeapon = this.createStartingWeapon(spec.startWeapon, spec.startStars);
    player.weapons.push(startWeapon);
    player.activeWeapon = startWeapon;   // иначе первые секунды руки пустые
    player.ability = createAbility(spec.ability);
    player.pets = (spec.pets || [])
      .map((petId) => createPet(petId, player.x, player.y, player))
      .filter(Boolean);
    return player;
  }

  get player() {
    return this.players[0];
  }

  get isCoop() {
    return this.players.length > 1;
  }

  // Питомцы всех игроков одним списком — для обновления и отрисовки.
  get pets() {
    return this.players.flatMap((p) => p.pets || []);
  }

  // Ближайший игрок — единственный правильный ответ на вопрос «к кому идти».
  nearestPlayer(x, y) {
    let best = this.players[0];
    let bestDist = Infinity;
    for (const p of this.players) {
      if (p.downed && this.players.some((o) => !o.downed)) continue;
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < bestDist) {
        best = p;
        bestDist = dist;
      }
    }
    return best;
  }

  createStartingWeapon(weaponId, startStars) {
    const weapon = createWeapon(weaponId || CONFIG.startingWeapon);
    for (let i = 0; i < startStars; i++) weapon.upgrade();
    // Правило «пятая звезда = превращение» должно работать и здесь. Иначе
    // «Сильный старт» из магазина вывел бы оружие сразу на максимум, карточка
    // апгрейда для него не выпадает — и эволюции не случилось бы никогда.
    return weapon.isMaxed ? evolveWeapon(weapon) : weapon;
  }

  get bossActive() {
    return this.bossPhase === 'intro' || this.bossPhase === 'fight';
  }

  // Арена изменилась (окно ресайзнули) — не даём герою остаться за краем.
  onArenaResize(arena) {
    this.arena = arena;
    // Тему передаём и здесь: без неё глава при повороте планшета молча
    // переехала бы с Пляжа во Двор.
    this.background.rebuild(this.round, arena, this.theme);
    this.player.clampToArena(arena);
  }

  // directions — по вектору на игрока. Одиночная игра передаёт массив из
  // одного элемента.
  update(dt, directions) {
    if (this.finished) return;

    this.updatePhase(dt);
    this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    // Принимаем и одиночный вектор: так старые сниппеты автотеста и консоли
    // не превращаются молча в «бот стоит на месте».
    const dirs = Array.isArray(directions) ? directions : [directions];
    this.players.forEach((player, i) => player.update(dt, this, dirs[i] || ZERO));
    // Питомцы — после героев (идут в их новую позицию) и до попаданий:
    // укус должен успеть убить зомби вместе со всеми остальными.
    for (const pet of this.pets) pet.update(dt, this);

    // Пока появляется босс, зомби замирают: ребёнок должен успеть посмотреть
    // на выход, а не получить удар в спину, пока любуется. Герой при этом
    // продолжает бегать — отнимать управление нельзя, решит, что игра зависла.
    const frozen = this.freezeTimer > 0;
    this.rallyTimer = Math.max(0, this.rallyTimer - dt);
    // Приказ ускоряет зомби ровно так же, как турбо Робота ускоряет оружие:
    // мы просто отдаём им больше времени за кадр. Босса это не касается —
    // командир себя не разгоняет.
    const rally = this.rallyTimer > 0 ? this.rallyFactor : 1;
    if (!frozen) {
      for (const enemy of this.enemies) enemy.update(enemy.isBoss ? dt : dt * rally, this);
    }
    for (const projectile of this.projectiles) projectile.update(dt, this);
    for (const pickup of this.pickups) pickup.update(dt, this);

    separateEnemies(this.enemies);
    resolveProjectileHits(this);
    if (!frozen) resolvePlayerHits(this);
    this.modifier?.update(dt, this);
    this.bannerTimer = Math.max(0, this.bannerTimer - dt);
    this.particles.update(dt);
    this.removeDead();

    // Цель проверяется здесь, а не в updatePhase: и убитые, и подобранные
    // медальки становятся известны только после того, как за кадр отработали
    // попадания и подборы.
    if (this.goal.isComplete(this)) this.finish('victory');
    // Раунд проигран, только когда лежат все: падение одного не должно
    // заканчивать игру напарнику.
    if (this.players.every((p) => p.downed)) this.finish('defeat');
  }

  // Фаза раунда. Вся разница между целями — одна строка: что происходит, когда
  // таймер добежал до нуля. Победу проверяет не этот метод, а конец update():
  // счётной цели решать нечего до того, как зомби и подборы за кадр обновятся.
  updatePhase(dt) {
    if (this.bossPhase === 'none') {
      this.timeLeft -= dt;
      this.spawner.update(dt, this, clamp01(this.goal.progress(this)));
      if (this.timeLeft <= 0) this.goal.onTimeUp(this);
      return;
    }

    if (this.bossPhase === 'intro') {
      this.bossIntroTimer -= dt;
      if (this.bossIntroTimer <= 0) this.spawnBoss();
    }
  }

  startBossIntro() {
    const type = this.bossType;
    this.bossPhase = 'intro';
    this.bossIntroTimer = CONFIG.boss.introTime;
    this.freezeTimer = CONFIG.boss.freezeTime;

    // Точка появления — внутри экрана: выход босса надо увидеть.
    this.bossSpawnPoint = bossSpawnPoint(this.arena, this.players);
    this.particles.addBossEntrance(
      this.bossSpawnPoint.x, this.bossSpawnPoint.y,
      type.entrance, CONFIG.boss.radius * type.radius, CONFIG.boss.introTime,
    );

    this.audio.setBossMode(true);
    this.audio.bossAppear();
    // Босс каждый раунд новый, а ребёнок не читает — объявляем голосом.
    this.callbacks.onBossAppear?.(type.name);
  }

  spawnBoss() {
    const type = this.bossType;
    this.bossPhase = 'fight';
    this.boss = this.spawner.createBoss(this.arena, this.players, this.bossSpawnPoint, type);
    this.enemies.push(this.boss);

    // Момент приземления: хлопок, тряска и звук удара.
    this.particles.addBossArrival(this.boss.x, this.boss.y, type.entrance, this.boss.radius);
    const shake = type.entrance === 'slam' ? CONFIG.boss.slamShake : CONFIG.boss.shake;
    this.shake(shake.strength, shake.time);
    this.audio.boom();
  }

  // Пробел: суперспособность героя. Не готова — молча ничего, заряд остаётся.
  // Во время выхода босса не срабатывает: зомби и так замерли, и полная шкала
  // сгорела бы впустую.
  useAbility(playerIndex = 0) {
    if (this.finished || this.freezeTimer > 0) return false;
    const player = this.players[playerIndex];
    return player?.ability?.tryActivate(this, player) ?? false;
  }

  // Охранник скомандовал — толпа побежала быстрее.
  rallyZombies(factor, time) {
    this.rallyFactor = factor;
    this.rallyTimer = Math.max(this.rallyTimer, time);
    this.audio.whistle();
    for (const enemy of this.enemies) {
      if (!enemy.isBoss) this.particles.addBurst(enemy.x, enemy.y, 4, 0.5);
    }
  }

  // Торт клоуна: пятно крема и минус сердечко тому, кто не убежал. Зеркало
  // explode(), но получатель урона обратный — герои, а не зомби.
  splat(x, y, radius) {
    this.particles.addRing(x, y, radius, '#ffd7e6');
    this.particles.addBurst(x, y, 14, 1);
    this.audio.splat();
    for (const player of this.players) {
      if (Math.hypot(player.x - x, player.y - y) <= radius + player.radius) {
        player.takeHit(this);   // одно сердечко, неуязвимость работает
      }
    }
  }

  // Удар молнии в заранее показанный круг.
  strike(x, y, radius, from) {
    this.particles.addLightning([from, { x, y }]);
    this.particles.addRing(x, y, radius, '#ffe66d');
    this.audio.zap();
    for (const player of this.players) {
      if (Math.hypot(player.x - x, player.y - y) <= radius + player.radius) {
        player.takeHit(this);
      }
    }
  }

  // Костяной рассыпался и собирается обратно. Сущность зовёт мир, мир зовёт
  // колбэк — тот же приём, что у onPlayerHurt.
  onBossDown(boss) {
    this.particles.addShards(boss.x, boss.y, boss.radius * 2.2, '#e8e4d4');
    this.shake(CONFIG.boss.shake.strength, CONFIG.boss.shake.time);
    this.audio.bonesCollapse();
  }

  onBossRevived(boss) {
    this.particles.addRing(boss.x, boss.y, boss.radius * 2, '#e8e4d4');
    this.particles.addBurst(boss.x, boss.y, 24, 1.2);
    this.audio.bonesRise();
    this.callbacks.onBossRevive?.(boss.name);
  }

  // Тряска мира при появлении босса. HUD рисуется отдельно в game.js и
  // не трясётся — интерфейс должен оставаться на месте.
  // Показать надпись поверх арены. Тем же слотом, что и особый раунд: если
  // глава объявляет задачу, она вытесняет имя модификатора, а не рисуется
  // поверх него.
  showBanner(text) {
    this.bannerText = text;
    this.bannerTimer = CONFIG.specialRounds.bannerTime;
  }

  shake(strength, time) {
    this.shakeStrength = strength;
    this.shakeTimer = time;
    this.shakeMaxTime = time;
  }

  finish(outcome) {
    if (this.finished) return;
    this.finished = true;
    this.audio.setBossMode(false);
    if (outcome === 'victory') {
      this.coinsEarned += this.victoryCoins;
      this.callbacks.onVictory(this.getSummary());
    } else {
      this.callbacks.onDefeat(this.getSummary());
    }
  }

  getSummary() {
    return {
      round: this.round,
      zombiesDefeated: this.zombiesDefeated,
      // Множитель за сложность применяем один раз здесь, а не к каждой монете:
      // так он накрывает и медальки, и добычу с босса, и бонус за победу,
      // и не копится ошибка округления.
      coinsEarned: Math.round(this.coinsEarned * this.difficultySpec.money * this.coinFactor),
      goalId: this.goal.id,
      medalsCollected: this.medalsCollected,
      discovered: {
        zombies: [...this.discovered.zombies],
        bosses: [...this.discovered.bosses],
      },
      // Факты для медалей. Round не знает, какие медали существуют, — он лишь
      // рассказывает, что случилось; условия проверяет Achievements.
      damageTaken: this.damageTaken,
      bossKilledBy: this.bossKilledBy,
      modifierId: this.modifier?.id || null,
      level: this.level,
      weaponsHeld: Math.max(...this.players.map((p) => p.weapons.length)),
      maxStars: Math.max(...this.players.flatMap((p) => p.weapons.map((w) => w.stars))),
      playersCount: this.players.length,
    };
  }

  removeDead() {
    this.enemies = this.enemies.filter((e) => e.alive);
    this.projectiles = this.projectiles.filter((p) => p.alive);
    this.pickups = this.pickups.filter((p) => p.alive);
  }

  // --- API мира: этим пользуются оружие, снаряды и сущности ---

  addProjectile(projectile) {
    this.projectiles.push(projectile);
  }

  addEnemy(enemy) {
    this.enemies.push(enemy);
    // Зомби открывается, когда появился, а не когда убит: альбом не должен
    // наказывать за поражение — увидел крота, погиб, наклейка всё равно
    // осталась. У боссов правило другое, см. onEnemyDefeated.
    if (enemy.type && !enemy.isBoss) this.discovered.zombies.add(enemy.type.id);
  }

  // Ближайший живой враг. options.exclude — множество уже задетых (для молнии).
  // Оружие целится только в тех, кого видно: зомби заходят из-за края экрана,
  // и стрелять по невидимой цели выглядит как «палит в пустоту».
  findNearestEnemy(x, y, { exclude = null, maxDistance = Infinity, onScreenOnly = true } = {}) {
    let best = null;
    let bestDist = maxDistance;
    for (const enemy of this.enemies) {
      if (!enemy.alive || (exclude && exclude.has(enemy))) continue;
      if (enemy.isHidden) continue;   // крот под землёй — не цель
      if (onScreenOnly && !this.isOnScreen(enemy)) continue;
      const dist = Math.hypot(enemy.x - x, enemy.y - y);
      if (dist < bestDist) {
        best = enemy;
        bestDist = dist;
      }
    }
    return best;
  }

  // Враг считается видимым, когда вошёл в кадр хотя бы наполовину.
  isOnScreen(enemy) {
    const margin = enemy.radius * 0.5;
    return enemy.x > -margin && enemy.x < this.arena.width + margin
      && enemy.y > -margin && enemy.y < this.arena.height + margin;
  }

  // source — чем нанесли урон: 'weapon' (по умолчанию), 'ability' или 'enemy'
  // (взрыв тыквы, догорание). Это ТЕГ, а не атрибуция убийства: считать, кто
  // именно добил, в этой игре нечестно и дорого — молния бьёт цепью, помидор
  // кладёт пятерых, огонь догорает через три секунды после выстрела. Тег нужен
  // ровно для медали «добил босса суперспособностью», и потому необязателен:
  // забытый вызов молча получит 'weapon', то есть медаль не выдастся. Ошибка
  // в безопасную сторону.
  damageEnemy(enemy, amount, source = 'weapon') {
    if (!enemy.alive) return;
    const killed = enemy.takeDamage(amount);
    if (killed) this.onEnemyDefeated(enemy, source);
  }

  // Урон по площади: помидор и ракета.
  explode(x, y, radius, damage, kind) {
    const color = kind === 'tomato' ? '#e34b3a' : '#ffb703';
    this.particles.addRing(x, y, radius, color);
    this.particles.addBurst(x, y, 10, 0.9);
    this.audio.boom();

    for (const enemy of [...this.enemies]) {
      if (!enemy.alive) continue;
      if (Math.hypot(enemy.x - x, enemy.y - y) <= radius + enemy.radius) {
        // Тыква взрывается сама, когда её убили, — это урон от врага, а не от
        // оружия ребёнка, и медаль за него давать не за что.
        this.damageEnemy(enemy, damage, kind === 'pumpkin' ? 'enemy' : 'weapon');
      }
    }
  }

  onEnemyDefeated(enemy, source = 'weapon') {
    this.zombiesDefeated += 1;
    // ??= а не =: сюда можно зайти рекурсивно (тыква в onDeath зовёт explode,
    // тот — damageEnemy), и вложенный вызов перезаписал бы источник чужим.
    if (enemy.isBoss) this.bossKilledBy ??= source;
    // Босс выходит каждый раунд сам — по появлению наклейка досталась бы
    // даром. Это единственное в игре, что надо заслужить.
    if (enemy.isBoss) this.discovered.bosses.add(enemy.type.id);
    // Убийства копят суперспособность. Звоночек звучит один раз — ровно в тот
    // момент, когда шкала наполнилась.
    // Заряжаем шкалы обоих: атрибутировать убийство нечестно и дорого —
    // молния бьёт цепью, помидор кладёт пятерых, а огонь догорает через три
    // секунды после выстрела.
    const charge = enemy.isBoss ? CONFIG.abilities.bossCharge : 1;
    let ready = false;
    for (const player of this.players) {
      if (player.ability?.addCharge(charge / this.coopFactor.chargeFactor)) ready = true;
    }
    if (ready) this.audio.abilityReady();

    this.audio.pop();
    this.particles.addBurst(enemy.x, enemy.y, enemy.isBoss ? 60 : 16, enemy.isBoss ? 2 : 1);
    this.dropLoot(enemy);
    this.modifier?.onLoot(enemy, this);

    // Особая смерть вида — в самом конце. Тыква рекурсивно заходит сюда же
    // для соседей, и пока текущий зомби не досчитал свой заряд и лут, входить
    // в рекурсию нельзя: порядок начислений стал бы зависеть от плотности
    // толпы. Боссы этого метода не имеют — отсюда `?.`.
    enemy.onDeath?.(this);
  }

  dropLoot(enemy) {
    if (enemy.isBoss) {
      for (let i = 0; i < CONFIG.boss.coins; i++) {
        this.pickups.push(new Pickup(enemy.x, enemy.y, PickupType.MONEY));
      }
      return;
    }

    // Медаль падает не с каждого зомби: так опыт ощущается наградой, а не фоном.
    if (Math.random() < CONFIG.zombie.medalDropChance) {
      const medals = Math.random() < CONFIG.zombie.doubleMedalChance ? 2 : 1;
      for (let i = 0; i < medals; i++) {
        this.pickups.push(new Pickup(enemy.x, enemy.y, PickupType.MEDAL));
      }
    }
    if (Math.random() < CONFIG.zombie.moneyDropChance) {
      this.pickups.push(new Pickup(enemy.x, enemy.y, PickupType.MONEY));
    }
  }

  collectPickup(pickup) {
    if (pickup.type === PickupType.MONEY) {
      this.coinsEarned += 1;
      this.audio.money();
      return;
    }
    this.audio.medal();
    this.medalsCollected += 1;
    if (this.addXp(CONFIG.pickups.medalXp * this.coopFactor.xpFactor * this.xpFactor)) {
      this.audio.levelUp();
      this.callbacks.onLevelUp();
    }
  }

  // Возвращает true, если команда взяла уровень.
  addXp(amount) {
    this.xp += amount;
    if (this.xp < this.xpToNext) return false;
    this.xp -= this.xpToNext;
    this.level += 1;
    this.xpToNext += CONFIG.xp.perLevel;
    return true;
  }

  onPlayerHealed() {
    this.audio.medal();
    this.particles.addBurst(this.player.x, this.player.y - this.player.radius, 6, 0.6);
  }

  onPlayerHurt() {
    // Единственная точка урона по герою — сюда сходятся и укус зомби, и торт
    // клоуна, и молния огненного босса. Кому именно прилетело, она не знает,
    // поэтому медаль «ни царапины» командная: вдвоём её теряют оба.
    this.damageTaken += 1;
    this.audio.hurt();
    this.particles.addBurst(this.player.x, this.player.y, 8, 0.8);
  }

  // --- Отрисовка ---

  draw(ctx) {
    ctx.save();
    this.applyShake(ctx);

    this.background.draw(ctx, this.arena);

    // Способности, живущие в мире, а не на герое (портал), — в слое земли:
    // они лежат под персонажами, иначе воронка накрывает того, кто в неё падает.
    for (const player of this.players) player.ability?.drawWorld(ctx);

    for (const pickup of this.pickups) pickup.draw(ctx);
    // Сортировка по Y: кто ниже — тот ближе к зрителю.
    const characters = [...this.enemies, ...this.players, ...this.pets]
      .sort((a, b) => a.y - b.y);
    for (const character of characters) character.draw(ctx);
    for (const projectile of this.projectiles) projectile.draw(ctx);

    this.modifier?.drawWorld(ctx, this);
    this.particles.draw(ctx);
    if (this.bossPhase === 'intro') this.drawBanner(ctx, this.bossType.name);
    else if (this.bannerTimer > 0) this.drawBanner(ctx, this.bannerText, this.bannerTimer);

    ctx.restore();
  }

  // Смещение мира при тряске, затухающее к концу.
  applyShake(ctx) {
    if (this.shakeTimer <= 0) return;
    const fade = this.shakeTimer / this.shakeMaxTime;
    const amount = this.shakeStrength * fade;
    ctx.translate(
      (Math.random() - 0.5) * amount * 2,
      (Math.random() - 0.5) * amount * 2,
    );
  }

  // Крупная надпись на арене: имя вышедшего босса или название особого
  // раунда. Кегль подбирается под ширину — «Толстяк в цилиндре» и «Волна-
  // толпа» не влезают в узкое окно.
  drawBanner(ctx, name, pulseTimer = this.bossIntroTimer) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const scale = 1 + Math.sin(pulseTimer * 12) * 0.08;
    // Надпись держим в верхней части экрана: центр теперь занят эффектом
    // появления босса, и перекрывать его нельзя.
    ctx.translate(this.arena.width / 2, this.arena.height * 0.18);
    ctx.scale(scale, scale);
    const size = Math.min(56, Math.max(26, (this.arena.width * 0.85) / name.length * 1.5));
    ctx.font = `bold ${Math.round(size)}px system-ui, sans-serif`;
    ctx.lineWidth = Math.max(4, size * 0.14);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.fillStyle = '#ffd93d';
    ctx.strokeText(name, 0, 0);
    ctx.fillText(name, 0, 0);
    ctx.restore();
  }
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}
