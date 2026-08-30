// Game — оркестратор: игровой цикл, машина состояний экранов и связь
// между Round (симуляция), экранами (DOM) и сохранением.
// Схема состояний описана в docs/architecture.md.

import { CONFIG } from '../config.js';
import {
  buildUpgrades, getCharacter, getDifficulty, characterKey, weaponKey,
} from './upgrades.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Speech } from './speech.js';
import { Storage } from './storage.js';
import { Album } from './album.js';
import { Achievements } from './achievements.js';
import { Campaign } from './campaign.js';
import { Round } from './round.js';
// applyCard под псевдонимом: одноимённый метод ниже — обёртка над ней,
// и без псевдонима вызов читался бы как рекурсия.
import { generateCards, applyCard as applyCardTo } from '../systems/levelup.js';
import { MenuScreen } from '../screens/menu.js';
import { CardsScreen } from '../screens/cards.js';
import { ShopScreen } from '../screens/shop.js';
import { EndScreen } from '../screens/endscreen.js';
import { CharactersScreen } from '../screens/characters.js';
import { DifficultyScreen } from '../screens/difficulty.js';
import { PlayersScreen } from '../screens/players.js';
import { AlbumScreen } from '../screens/album.js';
import { MapScreen } from '../screens/map.js';
import { StoryScreen } from '../screens/story.js';
import { ConfirmScreen } from '../screens/confirm.js';
import { WeaponsScreen } from '../screens/weapons.js';
import { PauseScreen } from '../screens/pause.js';
import { Hud } from '../screens/hud.js';
import { Overlay } from '../screens/overlay.js';
import { TouchControls } from '../screens/touch.js';

export const GameState = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  CARDS: 'cards',
  SHOP: 'shop',
  ROUND_END: 'round-end',
  PLAYERS: 'players',
  DIFFICULTY: 'difficulty',
  CHARACTERS: 'characters',
  WEAPONS: 'weapons',
  CONFIRM: 'confirm',
  ALBUM: 'album',
  MAP: 'map',       // карта сюжетной кампании
  STORY: 'story',   // кадры истории: завязка и финал
};

const MAX_FRAME_DELTA = 0.05; // сек: защита от «скачка» после сворачивания окна
const FIREWORK_INTERVAL = 0.35;

// Завязка и финал кампании. Одна фраза на кадр — длиннее ребёнок не дослушает,
// да и Speech всё равно не умеет говорить две подряд.
const INTRO_FRAMES = [
  { emoji: '📖', line: 'Зомби утащили твой альбом с наклейками!' },
  { emoji: '📄', line: 'Они порвали его на двенадцать страниц.' },
  { emoji: '🗺', line: 'И спрятали страницы по всему свету.' },
  { emoji: '🦸', line: 'Пойдём забирать! Первая — во дворе.' },
];

const FINALE_FRAMES = [
  { emoji: '📖', line: 'Двенадцать страниц! Альбом снова целый!' },
  { emoji: '🏆', line: 'Ты вернул все наклейки. Ты настоящий герой!' },
];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.arena = { width: 0, height: 0 };

    this.storage = new Storage();
    this.album = new Album(this.storage);
    this.achievements = new Achievements(this.storage);
    this.campaign = new Campaign(this.storage);
    // Спека текущей главы или null. Единственный признак «мы в кампании», и
    // снимается он в launch() — то есть при ЛЮБОМ входе в бой, включая
    // обычный раунд. Иначе после выхода из главы игра продолжала бы считать,
    // что мы в ней, и «ЕЩЁ РАЗ» увело бы ребёнка не туда.
    this.chapter = null;
    this.audio = new Audio(this.storage.data.soundOn);
    this.speech = new Speech(this.storage.data.soundOn);
    this.input = new Input();
    this.hud = new Hud();

    this.state = GameState.MENU;
    this.round = null;
    this.lastOutcome = null;
    this.fireworkTimer = 0;
    this.lastFrameTime = 0;

    this.screens = this.createScreens();

    this.setupTouch();
    this.setupSoundButton();
    this.setupPauseButton();
    this.setupResize();
    // Первый клик разблокирует звук — требование браузеров.
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
  }

  createScreens() {
    return {
      menu: new MenuScreen('menu-overlay', {
        onContinue: () => this.continueGame(),
        onNewGame: () => this.askNewGame(),
        onShop: () => this.openShop(GameState.MENU),
        onAlbum: () => this.openAlbum(),
        onCampaign: () => this.openCampaign(),
      }),
      players: new PlayersScreen('players-overlay', {
        onPick: (count) => this.choosePlayers(count),
        onSpeak: (text) => this.speech.speak(text),
      }),
      difficulty: new DifficultyScreen('difficulty-overlay', {
        onPick: (id) => this.chooseDifficulty(id),
        onSpeak: (text) => this.speech.speak(text),
      }),
      characters: new CharactersScreen('characters-overlay', {
        onPick: (ids) => this.chooseCharacters(ids),
        onSpeak: (text) => this.speech.speak(text),
      }),
      weapons: new WeaponsScreen('weapons-overlay', {
        onPick: (ids) => this.chooseWeapons(ids),
        onSpeak: (text) => this.speech.speak(text),
      }),
      album: new AlbumScreen('album-overlay', {
        onClose: () => this.closeAlbum(),
        onSpeak: (text) => this.speech.speak(text),
      }),
      confirm: new ConfirmScreen('confirm-overlay'),
      cards: new CardsScreen('cards-overlay', {
        onPick: (cards) => this.applyCards(cards),
        onSpeak: (text) => this.speech.speak(text),
      }),
      shop: new ShopScreen('shop-overlay', {
        onBuy: (itemId) => this.buyUpgrade(itemId),
        onClose: () => this.closeShop(),
        onSpeak: (text) => this.speech.speak(text),
      }),
      end: new EndScreen('end-overlay', {
        // «ЕЩЁ РАЗ» обязан перезапускать именно то, что проиграли: после
        // провала главы обычный раунд увёл бы ребёнка в другой режим, ничего
        // у него не спросив.
        onRetry: () => (this.chapter
          ? this.startChapter(this.chapter.id)
          : this.startRound(this.storage.data.round)),
        onMenu: () => this.goToMenu(),
        onSpeak: (text) => this.speech.speak(text),
      }),
      map: new MapScreen('map-overlay', {
        onPlay: (chapterId) => this.startChapter(chapterId),
        // Магазин прямо с карты. Без него ребёнок упирается в седьмую главу:
        // замер показал, что кампания проходится с первой попытки, только
        // если доллары тратятся, — а дорога «карта → меню → магазин → меню →
        // кампания» для пятилетнего непроходима сама по себе.
        onShop: () => this.openShop(GameState.MAP),
        // Сменить героя прямо с карты. Иначе кампания — единственный режим, в
        // котором ребёнок ни разу не выбирает, кем играть: обычная цепочка
        // выбора живёт только внутри «Новой игры», а она стирает прогресс.
        onHero: () => this.openCharacters(() => this.openMap()),
        onClose: () => this.goToMenu(),
        onSpeak: (text) => this.speech.speak(text),
      }),
      story: new StoryScreen('story-overlay', {
        onSpeak: (text) => this.speech.speak(text),
      }),
      pause: new PauseScreen('pause-overlay', {
        onResume: () => this.togglePause(),
        onMenu: () => this.goToMenu(),
        onSpeak: (text) => this.speech.speak(text),
      }),
    };
  }

  // --- Запуск и цикл ---

  start() {
    this.resize();
    this.goToMenu();
    requestAnimationFrame((t) => this.loop(t));
  }

  loop(timestamp) {
    const dt = Math.min(MAX_FRAME_DELTA, (timestamp - this.lastFrameTime) / 1000 || 0);
    this.lastFrameTime = timestamp;

    // Порядок принципиален: endFrame() фиксирует кадр ПОСЛЕ разбора нажатий,
    // иначе фронт нажатия стирается до того, как его успеют прочитать.
    this.input.poll();
    this.routeInput();
    this.input.endFrame();

    this.update(dt);
    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }

  // Единственное место, где нажатия превращаются в действия. Куда пойдёт
  // кнопка, решает состояние игры, а не то, чем её нажали: клавиатура,
  // геймпад и тач приходят сюда одинаковыми.
  routeInput() {
    // Пауза глобальна: ставит и снимает любой источник. Иначе «мой геймпад
    // не снимает паузу» — а объяснить это ребёнку невозможно.
    if (this.input.anyPressed('pause')
      && (this.state === GameState.PLAYING || this.state === GameState.PAUSED)) {
      this.togglePause();
      return;
    }

    if (this.state === GameState.PLAYING) {
      this.round?.players.forEach((_, i) => {
        if (this.input.abilityPressed(i)) this.round.useAbility(i);
      });
      return;
    }

    const screen = Overlay.activeNav();
    if (!screen) return;

    // Экраны выбора (герой, оружие, карточки) показывают по окну на игрока и
    // слушают обоих одновременно — им нужен индекс того, кто нажал. Остальные
    // экраны (пауза, магазин, альбом, итоги) слушают всех как один.
    if (screen.nav.perPlayer) {
      for (let i = 0; i < this.playersCount; i++) {
        this.feedScreen(screen, this.input.sourcesFor(i), i);
      }
      return;
    }
    this.feedScreen(screen, this.input.menuSources(), undefined);
  }

  feedScreen(screen, sources, playerIndex) {
    for (const source of sources) {
      if (source.wasPressed('left')) screen.nav.onMove?.(-1, playerIndex);
      if (source.wasPressed('right')) screen.nav.onMove?.(1, playerIndex);
      // Кнопка способности и подтверждение — одна и та же клавиша у ребёнка
      // (пробел, A на геймпаде). В меню она означает «выбрал это».
      if (source.wasPressed('confirm') || source.wasPressed('ability')) {
        screen.nav.onConfirm?.(playerIndex);
      }
      if (source.wasPressed('back')) screen.nav.onCancel?.(playerIndex);
    }
  }

  update(dt) {
    if (this.state === GameState.PLAYING) {
      // Героя передаём как точку отсчёта: на планшете направление считается
      // от него к пальцу, и без этого он бы просто стоял.
      this.round.update(dt, this.round.players.map((p, i) => this.input.getDirection(i, p)));
    } else if (this.state === GameState.ROUND_END) {
      this.updateVictoryFireworks(dt);
    }
  }

  updateVictoryFireworks(dt) {
    if (!this.round || this.lastOutcome !== 'victory') return;
    this.round.particles.update(dt);
    this.fireworkTimer -= dt;
    if (this.fireworkTimer <= 0) {
      this.fireworkTimer = FIREWORK_INTERVAL;
      this.round.particles.addFirework(
        Math.random() * this.arena.width,
        Math.random() * this.arena.height * 0.6,
      );
    }
  }

  draw() {
    const { ctx, arena } = this;
    this.syncTouch();
    if (this.round) {
      this.round.draw(ctx);
      if (this.state === GameState.PLAYING || this.state === GameState.PAUSED) {
        this.hud.draw(ctx, {
          players: this.round.players,
          level: this.round.level,
          xp: this.round.xp,
          xpToNext: this.round.xpToNext,
          arena,
          timeLeft: this.round.timeLeft,
          zombiesDefeated: this.round.zombiesDefeated,
          round: this.round.round,
          bossActive: this.round.bossActive,
          // Цель отдаёт числа, а не строку: она живёт в systems/ и про HUD
          // ничего не знает — на этом правиле стоит автотест.
          goal: this.round.goal.hudLine(this.round),
          modifier: this.round.modifier,
          // На телефоне HUD ужимается: считаем признак здесь, чтобы Hud не
          // лез в размеры окна сам.
          compact: Math.min(arena.width, arena.height) < CONFIG.hud.compactBelow,
        });
      }
    } else {
      this.drawMenuBackdrop(ctx, arena);
    }
  }

  // Кнопка способности на планшете показывает эмодзи героя и загорается,
  // когда шкала полна.
  syncTouch() {
    if (!this.touch.source.connected) return;   // не сенсорное устройство
    const ability = this.round?.player.ability;
    this.touch.setVisible(this.state === GameState.PLAYING);
    if (ability) {
      this.touch.setAbility({ emoji: ability.emoji, color: ability.color, ready: ability.isReady });
    }
  }

  drawMenuBackdrop(ctx, arena) {
    const gradient = ctx.createLinearGradient(0, 0, 0, arena.height);
    gradient.addColorStop(0, '#7ec850');
    gradient.addColorStop(1, '#4f9a3a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, arena.width, arena.height);
  }

  // --- Переходы состояний ---

  goToMenu() {
    this.state = GameState.MENU;
    this.round = null;
    this.chapter = null;
    this.audio.stopMusic();
    this.hideAllScreens();
    this.screens.menu.render(this.storage.data);
  }

  // «Продолжить» — сразу в бой с сохранённым героем, оружием и раундом.
  continueGame() {
    const save = this.storage.data;
    // Подстраховка на случай неполного сохранения: дособерём недостающее.
    if (!save.character) return this.openCharacters(0);
    if (this.playersCount > 1 && !save.character2) return this.openCharacters(1);
    if (!save.weapon) return this.openWeapons(0);
    if (this.playersCount > 1 && !save.weapon2) return this.openWeapons(1);
    this.startRound(save.round);
  }

  // «Новая игра» стирает прогресс, поэтому спрашиваем — но только если есть
  // что терять. При первом запуске лишний вопрос ребёнку ни к чему.
  askNewGame() {
    if (!this.storage.data.character) return this.startNewGame();

    this.state = GameState.CONFIRM;
    this.hideAllScreens();
    this.screens.confirm.render({
      title: 'НОВАЯ ИГРА?',
      emoji: '✨',
      question: 'Доллары, покупки и раунды пропадут. Начинаем сначала?',
      cancelText: 'НЕТ, ОСТАВИТЬ ◀',
      confirmText: 'Да, новая игра',
      onCancel: () => {
        this.audio.click();
        this.goToMenu();
      },
      onConfirm: () => this.startNewGame(),
    });
  }

  // Сброс и сразу выбор: сколько играет человек → сложность → герои → оружие.
  // Экраны выбора появляются только здесь.
  startNewGame() {
    this.storage.reset();
    this.audio.unlock();
    this.audio.click();
    this.openPlayers();
  }

  // У альбома один обратный путь — в меню, в отличие от магазина с его
  // двумя. Меньше состояний — меньше мест, где ребёнок может застрять.
  openAlbum() {
    this.state = GameState.ALBUM;
    this.audio.click();
    this.hideAllScreens();
    this.screens.album.render(this.storage.data);
  }

  closeAlbum() {
    this.audio.click();
    this.speech.stop();
    this.goToMenu();
  }

  openPlayers() {
    this.state = GameState.PLAYERS;
    this.hideAllScreens();
    this.screens.players.render(this.storage.data.playersCount);
  }

  choosePlayers(count) {
    this.storage.data.playersCount = count;
    this.input.playerCount = count;   // экраны выбора уже идут по очереди
    this.storage.save();
    this.audio.unlock();
    this.audio.click();
    this.speech.stop();
    this.screens.players.hide();
    this.openDifficulty();
  }

  openDifficulty() {
    this.state = GameState.DIFFICULTY;
    this.hideAllScreens();
    this.screens.difficulty.render(this.storage.data.difficulty);
  }

  chooseDifficulty(id) {
    this.storage.data.difficulty = id;
    this.storage.save();
    this.audio.unlock();
    this.audio.click();
    this.speech.stop();
    this.screens.difficulty.hide();
    this.openCharacters(); // выбор героя — второй шаг новой игры
  }

  // Ключи сохранения для игрока N. Сами функции живут в upgrades.js рядом с
  // остальной работой по сохранению; здесь они остаются под привычными
  // именами, чтобы не править пять мест вызова.
  static characterKey(i) { return characterKey(i); }
  static weaponKey(i) { return weaponKey(i); }

  get playersCount() {
    return this.storage.data.playersCount || 1;
  }

  // Все игроки выбирают одновременно, каждый в своей колонке. Ожидание
  // напарника держит сам экран — сюда выбор приходит уже полным.
  eachPlayer() {
    return Array.from({ length: this.playersCount }, (_, i) => i);
  }

  // Выбор героя и оружия — общая цепочка для двух входов: новой игры и карты
  // кампании. Куда она приведёт, решает вызывающий: держать это флагом «мы
  // пришли с карты» значило бы завести ещё одно скрытое состояние, которое
  // забудут сбросить.
  openCharacters(after = null) {
    this.afterPicking = after || (() => this.startRound(this.storage.data.round));
    this.state = GameState.CHARACTERS;
    this.hideAllScreens();
    this.screens.characters.render(
      this.eachPlayer().map((i) => this.storage.data[Game.characterKey(i)]),
      { total: this.playersCount },
    );
  }

  chooseCharacters(ids) {
    ids.forEach((id, i) => { this.storage.data[Game.characterKey(i)] = id; });
    this.storage.save();
    this.audio.unlock();
    this.audio.click();
    this.speech.stop();
    this.screens.characters.hide();
    // Сначала героев выбирают оба, и только потом оружие: так каждый видит,
    // кем будет играть напарник, прежде чем подбирать себе ствол.
    this.openWeapons();
  }

  openWeapons() {
    // У Паука оружие своё, и выбирать ему нечего. Если своё оружие у ВСЕХ,
    // экран показывать не из чего — уходим сразу в бой, иначе ребёнок увидел
    // бы страницу, на которой нечего нажать.
    const fixed = this.eachPlayer().map((i) => this.getCharacter(i).fixedWeapon || null);
    if (fixed.every(Boolean)) {
      this.finishPicking();
      return;
    }

    this.state = GameState.WEAPONS;
    this.hideAllScreens();
    this.screens.weapons.render(
      this.eachPlayer().map((i) => fixed[i] || this.storage.data[Game.weaponKey(i)]
        || CONFIG.startingWeapon),
      { total: this.playersCount, fixed },
    );
  }

  chooseWeapons(ids) {
    // Своё оружие в сохранение не пишем: иначе, сменив Паука на другого
    // героя, ребёнок обнаружил бы у него паутину.
    ids.forEach((id, i) => {
      if (this.getCharacter(i).fixedWeapon) return;
      this.storage.data[Game.weaponKey(i)] = id;
    });
    this.storage.save();
    this.audio.unlock();
    this.audio.click();
    this.speech.stop();
    this.screens.weapons.hide();
    this.finishPicking();
  }

  // Конец цепочки выбора. По умолчанию — в бой, с карты — обратно на карту.
  finishPicking() {
    const next = this.afterPicking || (() => this.startRound(this.storage.data.round));
    this.afterPicking = null;
    next();
  }

  startRound(roundNumber) {
    this.chapter = null;
    this.launch({ round: roundNumber });
  }

  // Глава кампании. От обычного раунда отличается только тем, что называет
  // локацию, босса, задачу и длительность явно — вместо того чтобы вычислять
  // их из номера.
  startChapter(chapterId) {
    const chapter = this.campaign.chapter(chapterId);
    if (!chapter || !this.campaign.isOpen(chapterId)) return;
    this.chapter = chapter;
    this.launch({
      round: chapter.level,
      theme: CONFIG.themes.find((t) => t.id === chapter.theme) || null,
      bossType: chapter.boss,
      goal: chapter.goal,
      modifier: chapter.modifier,
      duration: chapter.duration ?? CONFIG.round.duration,
    });
  }

  // Общий вход в бой. Обычный раунд и глава кампании отличаются только
  // содержимым options — колбэки, звук и объявления у них одни и те же, и
  // держать их в двух местах значило бы разойтись на первой же правке.
  launch(options) {
    this.hideAllScreens();
    this.speech.stop(); // голос не должен договаривать поверх боя
    this.audio.unlock();
    this.state = GameState.PLAYING;
    this.lastOutcome = null;
    this.input.playerCount = this.playersCount;
    this.rememberHeroes();

    this.round = new Round({
      arena: this.arena,
      audio: this.audio,
      players: Array.from({ length: this.playersCount }, (_, i) => this.getUpgrades(i)),
      difficulty: this.getDifficulty(),
      callbacks: {
        onLevelUp: () => this.openCards(),
        onBossAppear: (name) => this.speech.speak(`Осторожно! ${name}!`),
        onBossRevive: () => this.speech.speak('Он встаёт!'),
        onVictory: (summary) => this.endRound('victory', summary),
        onDefeat: (summary) => this.endRound('defeat', summary),
      },
      ...options,
    });
    this.audio.startMusic();
    this.announceRound();
  }

  // Что объявляется в начале боя. Попадает ровно в 2.5 секунды тишины, которые
  // и без того предназначены «осмотреться». Голос один: speak прерывает
  // предыдущую реплику, и две фразы подряд ребёнок услышал бы как одну
  // оборванную. Поэтому задача главы важнее особого раунда — она объясняет,
  // что вообще делать.
  announceRound() {
    const goalAnnounce = this.chapter ? this.round.goal.announce : null;
    const modifier = this.round.modifier;
    if (modifier) this.audio.special();
    if (goalAnnounce) {
      this.round.showBanner(goalAnnounce);
      this.speech.speak(goalAnnounce);
    } else if (modifier) {
      this.speech.speak(modifier.announce);
    }
  }

  // Уровень сложности, герой и бонусы считаются в upgrades.js — чистой
  // арифметикой над сохранением, без DOM. Здесь только подстановка save,
  // чтобы автотест в Node звал ровно те же формулы, что и игра.
  getDifficulty() {
    return getDifficulty(this.storage.data);
  }

  getCharacter(playerIndex = 0) {
    return getCharacter(this.storage.data, playerIndex);
  }

  getUpgrades(playerIndex = 0) {
    return buildUpgrades(this.storage.data, playerIndex);
  }

  // За кого сегодня играли — копится для медали «Все герои». Отмечаем на
  // старте раунда, а не на экране выбора: выбор можно открыть и передумать,
  // а вот раунд начат по-настоящему.
  rememberHeroes() {
    const played = this.storage.data.heroesPlayed;
    for (const i of this.eachPlayer()) {
      const id = this.getCharacter(i).id;
      if (!played.includes(id)) played.push(id);
    }
  }

  endRound(outcome, summary) {
    // Прячем всё, как делает любой другой переход между экранами. В обычной
    // игре раунд не может кончиться поверх открытого оверлея (при карточках и
    // паузе он просто не обновляется), но Overlay.activeNav держится на том,
    // что видимый экран с навигацией ровно один, и оставлять это на честном
    // слове не стоит.
    this.hideAllScreens();
    this.state = GameState.ROUND_END;
    this.lastOutcome = outcome;
    this.audio.stopMusic();

    const save = this.storage.data;
    save.coins += summary.coinsEarned;
    save.totalZombies += summary.zombiesDefeated;
    // Единственная запись альбома за раунд — здесь же, где и так сохраняемся.
    const fresh = this.album.discoverAll(summary.discovered);

    // Ветка победы разрезана надвое намеренно: медали должны проверяться уже
    // по обновлённым round/bestRound и по пополненному альбому, но ДО того,
    // как экран отрисуется, — иначе новую медаль на нём не показать.
    // Глава кампании не двигает раунд обычного режима: у неё своя ось, и
    // победа в двенадцатой главе не должна выставить save.round = 13.
    let page = false;
    if (outcome === 'victory') {
      if (this.chapter) page = this.campaign.complete(this.chapter.id);
      else {
        save.round = summary.round + 1;
        save.bestRound = Math.max(save.bestRound, save.round);
      }
    }
    const medals = this.achievements.check({
      save, summary, outcome, playersCount: this.playersCount,
    });

    // Куда ведёт большая кнопка. Из главы — обратно на карту: там страница и
    // встанет на место, а магазин между главами не открывается сам.
    const next = this.chapter
      ? { label: 'НА КАРТУ 🗺', action: () => this.openMap() }
      : { label: `РАУНД ${summary.round + 1} ▶`, action: () => this.openShop(GameState.ROUND_END) };

    if (outcome === 'victory') {
      this.audio.victory();
      this.fireworkTimer = 0;
      this.screens.end.renderVictory(summary, this.getCharacter().look, {
        fresh, medals, next, page: page ? this.chapter : null,
      });
    } else {
      this.audio.fail();
      this.screens.end.renderDefeat(summary, {
        fresh,
        medals,
        back: this.chapter ? { label: '🗺 На карту', action: () => this.openMap() } : null,
      });
    }
    // Голосом — иначе для нечитающего ребёнка медаль пройдёт мимо. Одну, даже
    // если их несколько: список подряд он не дослушает.
    if (medals.length) this.speech.speak(`Новая медаль! ${medals[0].name}`);
    this.storage.save();
  }

  // --- Кампания ---

  // Вход из меню. Первый раз показываем завязку: без неё карта — просто
  // двенадцать картинок, и непонятно, зачем по ним идти.
  openCampaign() {
    if (this.campaign.done.length === 0) {
      this.state = GameState.STORY;
      this.hideAllScreens();
      this.screens.story.play(INTRO_FRAMES, () => this.openMap());
      return;
    }
    this.openMap();
  }

  openMap() {
    // Финал показываем один раз — в тот момент, когда собрана последняя
    // страница, а не при каждом заходе на пройденную карту.
    if (this.campaign.isComplete && this.chapter) {
      this.chapter = null;
      this.state = GameState.STORY;
      this.hideAllScreens();
      this.screens.story.play(FINALE_FRAMES, () => this.openMap());
      return;
    }
    this.chapter = null;
    this.state = GameState.MAP;
    this.round = null;
    this.audio.stopMusic();
    this.hideAllScreens();
    this.screens.map.render(this.storage.data, this.campaign, this.getCharacter().look);
  }

  togglePause() {
    if (this.state === GameState.PLAYING) {
      this.state = GameState.PAUSED;
      this.audio.stopMusic();
      this.screens.pause.render(this.round?.player.weapons);
    } else if (this.state === GameState.PAUSED) {
      this.state = GameState.PLAYING;
      this.screens.pause.hide();
      this.audio.startMusic();
    }
  }

  // --- Прокачка ---

  // Карточки выбирают одновременно, у каждого своя колода: арсеналы у игроков
  // разные, и общая карточка слила бы их в один.
  openCards() {
    this.state = GameState.CARDS;
    this.screens.cards.render(
      this.round.players.map((player) => generateCards(player)),
      { looks: this.round.players.map((player) => player.look) },
    );
  }

  // Событие редкое и должно ощущаться крупнее обычного уровня — поэтому три
  // сигнала разом: салют, кольцо и голос.
  celebrateEvolution(weapon, player) {
    // Медаль за превращение выдаётся ЗДЕСЬ, а не в конце раунда: раунд после
    // эволюции можно и проиграть, а заслужена она уже сейчас.
    this.achievements.unlock('evolved');
    this.round.particles.addFirework(player.x, player.y - 40);
    this.round.particles.addRing(player.x, player.y, 90, '#ffd93d');
    this.audio.evolve();
    this.speech.speak(`${weapon.name}!`);
  }

  // Карточки всех игроков разом — так их отдаёт экран. Автотест из balance.md
  // подменяет openCards и зовёт applyCards с одной карточкой; поэтому
  // одиночная карточка тоже принимается.
  applyCards(cards) {
    const list = Array.isArray(cards) ? cards : [cards];
    list.forEach((card, i) => this.applyCard(card, i));
    this.audio.click();
    this.speech.stop();
    this.screens.cards.hide();
    this.state = GameState.PLAYING;
  }

  applyCard(card, playerIndex = 0) {
    const player = this.round.players[playerIndex];
    const evolved = applyCardTo(player, card);
    if (evolved) this.celebrateEvolution(evolved, player);
  }

  // --- Магазин ---

  openShop(returnState) {
    this.shopReturnState = returnState;
    this.state = GameState.SHOP;
    this.hideAllScreens();
    this.screens.shop.render(this.storage.data);
  }

  buyUpgrade(itemId) {
    const save = this.storage.data;
    const spec = CONFIG.shop[itemId];
    const level = save.shop[itemId] || 0;
    if (level >= spec.prices.length) return;

    const price = spec.prices[level];
    if (save.coins < price) return;

    save.coins -= price;
    save.shop[itemId] = level + 1;
    this.storage.save();
    this.audio.money();
    this.screens.shop.render(save); // перерисовываем цены и доступность
  }

  closeShop() {
    this.audio.click();
    this.screens.shop.hide();
    // Из меню возвращаемся в меню, после победы — сразу в следующий раунд,
    // с карты — обратно на карту.
    if (this.shopReturnState === GameState.ROUND_END) {
      this.startRound(this.storage.data.round);
    } else if (this.shopReturnState === GameState.MAP) {
      this.openMap();
    } else {
      this.goToMenu();
    }
  }

  hideAllScreens() {
    Object.values(this.screens).forEach((screen) => screen.hide());
  }

  // --- Звук и размеры ---

  // Управление пальцем появляется только на сенсорных устройствах — и
  // исчезает, как только взяли клавиатуру или геймпад.
  setupTouch() {
    this.touch = new TouchControls({ onPause: () => this.togglePause() });
    this.input.add(this.touch.source);
    TouchControls.watchTouchMode((on) => {
      this.touch.setEnabled(on);
      document.getElementById('pause-button')?.classList.toggle('hidden', !on);
    });
  }

  // Кнопка паузы нужна именно на планшете: клавиши Esc там нет.
  setupPauseButton() {
    document.getElementById('pause-button')?.addEventListener('click', () => {
      if (this.state === GameState.PLAYING || this.state === GameState.PAUSED) this.togglePause();
    });
  }

  setupSoundButton() {
    const button = document.getElementById('sound-button');
    const sync = () => {
      button.textContent = this.storage.data.soundOn ? '🔊' : '🔇';
    };
    button.addEventListener('click', () => {
      const on = !this.storage.data.soundOn;
      this.storage.data.soundOn = on;
      this.storage.save();
      this.audio.unlock();
      this.audio.setEnabled(on);
      this.speech.setEnabled(on); // одна кнопка выключает и звуки, и голос
      sync();
    });
    sync();
  }

  setupResize() {
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    // Рисуем в честных пикселях устройства, чтобы на ретине не мылило.
    const ratio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = width * ratio;
    this.canvas.height = height * ratio;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    this.arena.width = width;
    this.arena.height = height;
    this.round?.onArenaResize(this.arena);
  }
}
