// Сцена объёмного режима: второй композитор кадра рядом с Round.draw.
//
// ГРАНИЦА. Сцена ничего не меняет в мире — она его читает. Ни одного поля
// сущности здесь не присваивается, `world` приходит только на чтение. Это то
// же правило, по которому живёт render/sprites.js, и на нём держится
// возможность выключить 3D одной кнопкой.
//
// ПОРЯДОК СЛОЁВ. В 2D его задаёт Round.draw: земля, наземные пропы, добыча,
// персонажи по глубине, снаряды. В 3D порядок не нужен вовсе — глубину
// считает буфер видеокарты. Что действительно приходится повторять — это
// СПИСОК того, что вообще показывается; за этим следит `collect()`.
//
// ФИГУРКИ. Персонажей лепит figures.js по тому же полю look, что и 2D.
// Сцена только ставит их на место, поворачивает и качает ногами; ни одной
// пропорции здесь нет — иначе они разошлись бы с двумерными.

import {
  Scene, WebGLRenderer, Color, Fog, Mesh, Group,
  PlaneGeometry, BoxGeometry,
  MeshLambertMaterial, DirectionalLight, HemisphereLight, PointLight, PCFShadowMap,
} from 'three';
import { CONFIG } from '../config.js';
import { Camera3D } from './camera.js';
import {
  buildFigure, buildProp, buildPickup, buildShot, poseFigure, lookOf,
} from './figures.js';
import { Effects } from './effects.js';
import { Decor } from './decor.js';
import { WorldFx } from './worldfx.js';

const DEFAULT_COLOR = '#c8c8c8';

// Ниже этого шага за кадр поворот не пересчитывается: стоящая фигурка иначе
// вертится от миллиметровых толчков расталкивания.
const HEADING_MIN_STEP = 0.05;
const HEADING_LERP = 0.25;
// Насколько герой может повернуть голову к цели, не отрывая её от плеч.
const HEAD_TURN_LIMIT = 1.15;

// Как выглядит попадание, заморозка и горение. Цвета и доли — те же, что в
// drawZombie: белая вспышка, слабая синева (сильная сливает зомби с глыбой),
// оранжевая подпалина.
const HURT_COLOR = '#ffffff';
const GHOST_OPACITY = 0.4;
const MOOD_TINT = {
  frozen: { color: '#7fd8ff', amount: 0.3 },
  burning: { color: '#ff7a2b', amount: 0.4 },
};

// Порядок важен: попадание перекрывает всё остальное — это самый громкий
// сигнал, и ребёнок должен видеть именно его.
function moodOf(entity) {
  if (entity.hurtTimer > 0) return 'hurt';
  if (entity.isFrozen) return 'frozen';
  if (entity.isBurning) return 'burning';
  if (entity.downed) return 'ghost';
  return 'normal';
}

function blinking(entity) {
  return entity.invulnTimer > 0 && Math.floor(entity.invulnTimer * 10) % 2 === 0;
}

export class Scene3D {
  constructor(canvas) {
    this.spec = CONFIG.render3d;
    this.arena = { width: 0, height: 0 };

    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.shadowMap.enabled = true;
    // PCF, а не PCFSoft: мягкий вариант в Three объявлен устаревшим и молча
    // подменяется этим же.
    this.renderer.shadowMap.type = PCFShadowMap;

    this.scene = new Scene();
    this.camera = new Camera3D(this.spec);

    this.materials = new Map();   // цвет -> материал, один на всю игру
    this.figures = new Map();     // сущность -> меш; переживает кадры
    this.seen = new Set();        // кто попался в этом кадре

    this.buildGround();
    this.buildBorder();
    this.buildLights();
    this.effects = new Effects(this.scene);
    this.decor = new Decor(this.scene, (color) => this.materialFor(color));
    this.fx = new WorldFx(this.scene, this.spec);

    this.themeId = null;
    this.theme = null;
    this.sky = null;
    this.checked = null;   // мир, для которого уже проверен состав списков
    // Общее время сцены: по нему трепещет пламя и трясётся подарок. Своё, а
    // не игровое, — это украшение, и на симуляцию оно не влияет.
    this.phase = 0;
  }

  // --- Постоянная обстановка ---

  // Бортик по краю арены: четыре бруска, ровно по тем границам, о которые
  // бьётся герой. Он же и объясняет ребёнку, почему тот дальше не идёт.
  buildBorder() {
    this.border = new Group();
    this.borderBars = [];
    for (let i = 0; i < 4; i++) {
      const bar = new Mesh(new BoxGeometry(1, 1, 1), this.materialFor(DEFAULT_COLOR));
      bar.castShadow = true;
      bar.receiveShadow = true;
      this.borderBars.push(bar);
      this.border.add(bar);
    }
    this.scene.add(this.border);
  }

  frameBorder() {
    const { width, height } = this.arena;
    if (!width || !height) return;
    const h = this.spec.borderHeight;
    const t = this.spec.borderThickness;
    // Длинные стороны заходят за короткие, чтобы в углах не оставалось щели.
    const places = [
      [width / 2, h / 2, -t / 2, width + t * 2, h, t],
      [width / 2, h / 2, height + t / 2, width + t * 2, h, t],
      [-t / 2, h / 2, height / 2, t, h, height],
      [width + t / 2, h / 2, height / 2, t, h, height],
    ];
    places.forEach(([x, y, z, sx, sy, sz], i) => {
      const bar = this.borderBars[i];
      bar.position.set(x, y, z);
      bar.scale.set(sx, sy, sz);
    });
  }

  paintBorder() {
    if (!this.theme) return;
    // Темнее пола, но того же семейства: бортик — край этой же лужайки, а не
    // чужой предмет. Ночью уходит в синеву вместе с землёй.
    const base = mixColor(this.theme.accent, '#000000', 0.25);
    const color = this.night
      ? mixColor(base, this.spec.night.sky, this.spec.night.groundMix)
      : base;
    const material = this.materialFor(color);
    for (const bar of this.borderBars) bar.material = material;
  }

  buildGround() {
    // Пол лежит в плоскости XZ, поэтому плоскость приходится класть: она
    // рождается стоящей, лицом к зрителю.
    this.ground = new Mesh(new PlaneGeometry(1, 1), this.materialFor(DEFAULT_COLOR));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }

  buildLights() {
    const light = this.spec.light;

    // Полусферный свет подсвечивает изнанку фигурок. Без него всё, что не
    // повёрнуто к солнцу, становится чёрным — а зомби и так тёмные.
    this.ambient = new HemisphereLight(
      new Color(light.skyColor), new Color(light.groundColor), light.ambientIntensity,
    );
    this.scene.add(this.ambient);

    this.sun = new DirectionalLight(new Color(light.sunColor), light.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(light.shadowSize, light.shadowSize);
    this.scene.add(this.sun);
    // Цель света — отдельный объект, и в сцену её нужно добавить руками,
    // иначе Three не пересчитает её мировую матрицу и тени уедут.
    this.scene.add(this.sun.target);

    // Фонарик героя. Живёт всегда, но горит только ночью: создавать источник
    // света посреди раунда — это перекомпиляция всех шейдеров сцены и
    // гарантированный рывок ровно в тот момент, когда выходит босс.
    const night = this.spec.night;
    this.lamp = new PointLight(new Color(night.lampColor), 0, 1, night.lampDecay);
    this.lamp.visible = false;
    this.scene.add(this.lamp);
    this.night = false;
  }

  // Ночь: гасим солнце и включаем герою фонарик. В плоской игре это тёмная
  // заливка и светлый круг — здесь то же самое, только честным светом.
  setNight(on, world) {
    const light = this.spec.light;
    const night = this.spec.night;
    if (on !== this.night) {
      this.night = on;
      this.sun.intensity = light.sunIntensity * (on ? night.sunFactor : 1);
      this.ambient.intensity = light.ambientIntensity * (on ? night.ambientFactor : 1);
      this.ambient.color.set(on ? night.skyColor : light.skyColor);
      this.ambient.groundColor.set(on ? night.groundColor : light.groundColor);
      this.lamp.visible = on;
      this.lamp.intensity = on ? night.lampIntensity : 0;
      this.applySky(on ? night.sky : this.theme?.sky);
      this.paintGround();
      this.paintBorder();
    }
    if (!on) return;
    const hero = world.player;
    // Радиус фонарика — тот же, что в плоской версии: свет и «зона, где враг
    // уже виден» обязаны совпадать, иначе ребёнок учится не тому.
    this.lamp.distance = world.modifier?.spec?.lightRadius || 0;
    this.lamp.position.set(hero.x, this.lamp.distance * 0.45, hero.y);
  }

  // opacity < 1 — для того немногого, что и в плоской игре просвечивает:
  // мыльный пузырь, ледяная глыба. Ключ кэша включает прозрачность, иначе
  // первый же прозрачный материал сделал бы полупрозрачным весь свой цвет.
  materialFor(color, opacity = 1) {
    const key = `${color || DEFAULT_COLOR}|${opacity}`;
    let material = this.materials.get(key);
    if (!material) {
      // Lambert, а не Standard: металлов и шероховатостей в мультяшной игре
      // нет, а на планшете он заметно дешевле.
      material = new MeshLambertMaterial({ color: new Color(color || DEFAULT_COLOR) });
      if (opacity < 1) {
        material.transparent = true;
        material.opacity = opacity;
        // Без записи глубины: иначе пузырь вырезает дырку в зомби, который
        // сквозь него виден.
        material.depthWrite = false;
      }
      this.materials.set(key, material);
    }
    return material;
  }

  // --- Размер и тема ---

  setArena(arena) {
    this.arena = arena;
    this.camera.setArena(arena);

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(arena.width, arena.height, false);

    const over = this.spec.groundOverscan;
    this.ground.scale.set(arena.width * over, arena.height * over, 1);
    this.ground.position.set(arena.width / 2, 0, arena.height / 2);

    this.frameLight();
    this.frameBorder();
    this.updateFog();
    this.fx.setArena(arena);
  }

  // Тень должна накрывать всё поле: у направленного света объём тени задаётся
  // ортографической камерой, и по умолчанию она крошечная.
  frameLight() {
    const { width, height } = this.arena;
    const at = this.spec.light.sunAt;
    const unit = Math.max(width, height) || 1;

    this.sun.target.position.set(width / 2, 0, height / 2);
    this.sun.position.set(
      width / 2 + at.x * unit,
      at.y * unit,
      height / 2 + at.z * unit,
    );

    const half = unit * this.spec.light.shadowSpan;
    const shadow = this.sun.shadow.camera;
    shadow.left = -half;
    shadow.right = half;
    shadow.top = half;
    shadow.bottom = -half;
    shadow.near = 1;
    shadow.far = unit * 4;
    shadow.updateProjectionMatrix();
  }

  applyTheme(theme) {
    if (!theme || theme.id === this.themeId) return;
    this.themeId = theme.id;
    this.theme = theme;
    this.paintGround();
    this.paintBorder();
    if (!this.night) this.applySky(theme.sky);
    this.updateFog();
  }

  // Цвет пола. Ночью он не просто темнеет от слабого света, а уводится в
  // синеву: песок пляжа и сено фермы под синим светом дают бурый, и ночь
  // читается как мутный день. Это тот же приём, что тёмно-синий тинт плоской
  // версии, только вмешанный в сам материал.
  paintGround() {
    if (!this.theme) return;
    const color = this.night
      ? mixColor(this.theme.ground, this.spec.night.sky, this.spec.night.groundMix)
      : this.theme.ground;
    this.ground.material = this.materialFor(color);
  }

  // Цвет неба и тумана всегда один: иначе на горизонте появляется шов между
  // растворяющейся землёй и другим по цвету небом.
  applySky(color) {
    if (!color) return;
    this.sky = color;
    this.scene.background = new Color(color);
    this.updateFog();
  }

  // Туман того же цвета, что небо: дальний край поля растворяется в горизонте
  // вместо того, чтобы обрываться ровной линией.
  //
  // Дальность считается от размера арены, поэтому пересчитывать её надо и при
  // смене темы, и при смене размера окна. Забыть второе легко, а последствие
  // громкое: арена, посчитанная нулевой (окно ещё не измерено), даёт туман в
  // полторы единицы, и весь мир превращается в ровную заливку цвета неба.
  updateFog() {
    const unit = Math.max(this.arena.width, this.arena.height);
    if (!this.sky || !unit) return;
    this.scene.fog = new Fog(new Color(this.sky), unit * 0.8, unit * 1.9);
  }

  // --- Кадр ---

  update(dt, world) {
    this.phase += dt;
    if (!world) return;
    this.camera.follow(world.player, dt);
    this.camera.setShake(...shakeOf(world));
  }

  // Мгновенно поставить камеру на героя: начало раунда и поворот планшета.
  snap(world) {
    if (world) this.camera.snapTo(world.player);
  }

  draw(world) {
    if (!world) return;
    this.applyTheme(world.background?.theme);
    this.decor.sync(world.background);
    this.setNight(world.modifier?.id === 'night', world);

    if (world !== this.checked) {
      this.checked = world;
      this.warnAboutMissed(world);
    }

    this.seen.clear();
    this.collect(world);
    this.sweep();
    this.effects.update(world.particles);
    this.fx.update(world, this.camera, this.arena);

    this.camera.sync();
    this.renderer.render(this.scene, this.camera.camera);
  }

  // Единственное место, где перечислено, что вообще видно в мире. Меняется
  // состав — меняется и Round.draw; расхождение этих двух списков и есть
  // главный способ сломать объёмный режим незаметно. За этим следит
  // warnAboutMissed ниже.
  collect(world) {
    for (const player of world.players) this.place(player, HERO_SPEC);
    for (const enemy of world.enemies) this.place(enemy, enemySpec(enemy));
    for (const pet of world.pets) this.place(pet, petSpec(pet));
    for (const prop of world.props) this.place(prop, PROP_SPEC);
    for (const pickup of world.pickups) this.place(pickup, PICKUP_SPEC);
    for (const shot of world.projectiles) this.place(shot, SHOT_SPEC);
  }

  // Ставит фигурку на место, слепив её при первой встрече. Ключ — сам объект
  // сущности: он живёт ровно столько же, сколько нужна фигурка.
  place(entity, spec) {
    if (!entity || entity.alive === false) return;
    this.seen.add(entity);

    let figure = this.figures.get(entity);
    if (!figure) {
      figure = this.create(entity, spec);
      this.figures.set(entity, figure);
      this.scene.add(figure.node);
    }

    const radius = (entity.radius || spec.radius) * this.readableBoost(entity);
    figure.node.scale.setScalar(radius);
    // liftWorld — постоянная высота в единицах мира, lift — доля радиуса.
    // Снарядам нужна первая: доля радиуса забрасывала крупный снаряд выше
    // деревьев, хотя в плоской игре они все летят в одной плоскости.
    figure.node.position.set(entity.x, spec.liftWorld ?? spec.lift * radius, entity.y);

    if (figure.tick) {
      figure.tick(entity, this.phase);
    } else if (figure.parts) {
      const heading = this.headingOf(entity, figure);
      figure.node.rotation.y = heading;
      this.turnHead(figure, entity, heading);
      poseFigure(figure, entity.walkPhase || 0);
      this.applyMood(figure, moodOf(entity));
      // Мигание неуязвимости: в плоской игре герой полупрозрачен через кадр,
      // здесь просто пропадает. Для ребёнка это одно и то же — «меня сейчас
      // не укусят», — а прозрачность целой фигурки стоит перебора материалов
      // на каждом мигании.
      figure.node.visible = !blinking(entity);
    }
  }

  // Голова смотрит туда, куда целится оружие, а не туда, куда бегут ноги.
  // Без этого лазерные глаза стреляли из затылка: тело развёрнуто по
  // движению, а луч уходит к ближайшему зомби.
  //
  // Поворот ограничен: свернуть голову за плечо человек не может, и фигурка,
  // которая это делает, выглядит сломанной, а не внимательной.
  turnHead(figure, entity, heading) {
    const head = figure.parts?.head;
    if (!head) return;
    const aim = entity.activeWeapon?.aimAngle;
    if (aim === undefined) { head.rotation.y = 0; return; }
    // Мировой угол прицела в той же системе, что и heading: у него первым
    // аргументом идёт x, вторым — глубина.
    const wanted = Math.atan2(Math.cos(aim), Math.sin(aim));
    let delta = wanted - heading;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    head.rotation.y = Math.max(-HEAD_TURN_LIMIT, Math.min(HEAD_TURN_LIMIT, delta));
  }

  // Настроение фигурки: белая вспышка от попадания, синева заморозки,
  // подпалина, призрак упавшего. Меняем материалы только когда настроение
  // ДЕЙСТВИТЕЛЬНО сменилось: обход дерева каждый кадр на полсотни фигурок
  // стоит дороже самой отрисовки.
  applyMood(figure, mood) {
    if (figure.mood === mood) return;
    figure.mood = mood;
    figure.node.traverse((part) => {
      if (!part.isMesh) return;
      if (!part.userData.base) part.userData.base = part.material;
      const base = part.userData.base;
      if (mood === 'normal') { part.material = base; return; }
      const color = `#${base.color.getHexString()}`;
      part.material = mood === 'hurt'
        ? this.materialFor(HURT_COLOR)
        : mood === 'ghost'
          ? this.materialFor(color, GHOST_OPACITY)
          : this.materialFor(mixColor(color, MOOD_TINT[mood].color, MOOD_TINT[mood].amount));
    });
  }

  // Насколько увеличить дальнюю фигурку, чтобы она осталась заметной.
  //
  // Опорное расстояние — до героя: он всегда в центре кадра, и всё, что
  // дальше него, шло бы на убыль. Ближе героя не уменьшаем вовсе: враг,
  // подошедший вплотную, обязан выглядеть большим — это и есть тревога.
  readableBoost(entity) {
    const eye = this.camera.math.eyePoint();
    const focus = this.camera.math.focus;
    const ref = Math.hypot(eye.x - focus.x, eye.y, eye.z - focus.y) || 1;
    const dist = Math.hypot(eye.x - entity.x, eye.y, eye.z - entity.y);
    if (dist <= ref) return 1;
    const boost = (dist / ref) ** this.spec.distanceCompensation;
    return Math.min(this.spec.maxDistanceBoost, boost);
  }

  create(entity, spec) {
    const paint = (color, opacity) => this.materialFor(color, opacity);
    const look = lookOf(entity);
    const figure = spec.kind === 'prop'
      ? (buildProp(entity, paint) || buildFigure(entity.look, 'zombie', paint))
      : spec.kind === 'pickup'
        ? buildPickup(entity.type, paint)
        : spec.kind === 'shot'
          ? buildShot(entity, paint)
          : buildFigure(look, spec.kind, paint);
    figure.node.traverse((part) => {
      if (!part.isMesh) return;
      // Светящееся тени не бросает и не принимает: пламя костра, помеченное
      // флагом при сборке, иначе кладёт под себя чёрное пятно — а огонь сам
      // источник света, а не предмет на свету.
      const glow = part.userData.glow === true;
      part.castShadow = !glow;
      part.receiveShadow = !glow;
    });
    figure.heading = 0;
    figure.lastX = entity.x;
    figure.lastY = entity.y;
    return figure;
  }

  // Куда фигурка смотрит. Считаем по фактическому смещению за кадр, а не по
  // полю сущности: facing в игре хранит только «влево или вправо» — этого
  // хватало плоской картинке, но в объёме персонаж от такого ходит боком.
  // Угол сглаживаем, иначе толпа дёргается при каждом расталкивании.
  headingOf(entity, figure) {
    const dx = entity.x - figure.lastX;
    const dy = entity.y - figure.lastY;
    figure.lastX = entity.x;
    figure.lastY = entity.y;
    if (Math.hypot(dx, dy) > HEADING_MIN_STEP) {
      const wanted = Math.atan2(dx, dy);
      let delta = wanted - figure.heading;
      // Кратчайшая дуга: без этого разворот через северный полюс идёт длинным
      // путём и фигурка крутится волчком.
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      figure.heading += delta * HEADING_LERP;
    }
    return figure.heading;
  }

  // Убираем то, чего в мире больше нет. Проходом по всему кэшу, а не по
  // событиям смерти: у Round нет колбэка «сущность исчезла», а заводить его
  // ради картинки — значит трогать логику.
  sweep() {
    for (const [entity, figure] of this.figures) {
      if (this.seen.has(entity)) continue;
      this.scene.remove(figure.node);
      this.figures.delete(entity);
    }
  }

  // Куда показывать стрелками: враги, которых не видно в кадре.
  //
  // Нужно это только при опущенной камере — при стартовой в кадр помещается
  // почти вся арена. Но опустить её ребёнок может в любой момент, и тогда
  // «зомби подкрался сзади» перестаёт быть его ошибкой и становится нашей.
  //
  // Отдаём точку на краю экрана и угол: рисует стрелки Game на холсте HUD,
  // потому что это подсказка интерфейса, а не часть мира.
  offscreenMarkers(world, arena, limit = 6) {
    const marks = [];
    const cx = arena.width / 2;
    const cy = arena.height / 2;
    for (const enemy of world.enemies) {
      if (marks.length >= limit) break;
      const point = this.camera.project(enemy.x, enemy.y, arena);
      if (point.onScreen) continue;
      // У точки за спиной проекция зеркальна, поэтому направление берём от
      // центра к её отражению.
      const dx = (point.behind ? -1 : 1) * (point.x - cx);
      const dy = (point.behind ? -1 : 1) * (point.y - cy);
      const len = Math.hypot(dx, dy) || 1;
      marks.push({ dx: dx / len, dy: dy / len, boss: Boolean(enemy.isBoss) });
    }
    return marks;
  }

  // Сторож против расхождения рендереров.
  //
  // Однажды кто-то заведёт в Round новый список — скажем, ловушки, — добавит
  // его в Round.draw и забудет здесь. В плоском режиме ловушки будут, в
  // объёмном их не будет, и заметит это ребёнок, а не автотест: node-тесты
  // рисование не вызывают вовсе, а глазами обычно смотрят один режим.
  //
  // Поэтому раз за раунд проходим по самому миру и ищем списки сущностей,
  // которых нет в collect(). Проверка стоит один кадр из тысяч и говорит в
  // консоль — там же, где разработчик и смотрит.
  warnAboutMissed(world) {
    const known = new Set(['players', 'enemies', 'pets', 'props', 'pickups', 'projectiles']);
    for (const [name, value] of Object.entries(world)) {
      if (known.has(name) || !Array.isArray(value) || !value.length) continue;
      const looksDrawable = value.every((item) => item
        && typeof item.x === 'number' && typeof item.y === 'number'
        && typeof item.draw === 'function');
      if (!looksDrawable) continue;
      console.warn(`Объёмный режим не показывает world.${name}:`
        + ' список появился в Round, но не в Scene3D.collect (см. docs/render3d.md).');
    }
  }

  dispose() {
    for (const [, figure] of this.figures) this.scene.remove(figure.node);
    this.figures.clear();
    this.renderer.dispose();
  }
}

// Тряска мира при ударе. Формула та же, что в Round.applyShake, — здесь она
// повторена, а не вынесена, потому что 2D сдвигает контекст, а 3D двигает
// камеру: общего кода получилось бы две строки на три строки обёртки.
function shakeOf(world) {
  if (!world.shakeTimer || world.shakeTimer <= 0) return [0, 0];
  const amount = world.shakeStrength * (world.shakeTimer / world.shakeMaxTime);
  return [(Math.random() - 0.5) * amount * 2, (Math.random() - 0.5) * amount * 2];
}

// Что и как ставить. Фигурки описываются видом (его разбирает figures.js), а
// то, что фигуркой ещё не стало, — готовой геометрией.
//
// lift — насколько поднять над полом в долях радиуса. У фигурок ноль: они
// слеплены стоящими на нуле. У шарика половина его высоты, иначе он утонет.
const HERO_SPEC = { kind: 'hero', radius: CONFIG.player.radius, lift: 0 };
const ENEMY_SPEC = { kind: 'zombie', radius: CONFIG.player.radius, lift: 0 };
const THIEF_SPEC = { kind: 'thief', radius: CONFIG.player.radius, lift: 0 };

// Воришка — тот же зомби, но в маске и с мешком. Опознаём по lootPhase: это
// его собственное поле, и заводить ради картинки признак в самой сущности
// значило бы трогать логику.
function enemySpec(enemy) {
  return enemy.lootPhase !== undefined ? THIEF_SPEC : ENEMY_SPEC;
}

const PROP_SPEC = { kind: 'prop', radius: CONFIG.player.radius, lift: 0 };
// Медалька и монетка висят над травой, иначе плоский кружок в ней тонет.
const PICKUP_SPEC = { kind: 'pickup', radius: 10, lift: 1.1 };

// Где у сущности лежит внешность. У героя и зомби это своё поле look, а у
// питомца — spec.look: класс питомца в плоской версии берёт её оттуда сам, и
// поля look у него просто нет. Без этой развилки собака красилась цветом по
// умолчанию и выходила серой.
// Питомец-друг — тот же герой: в 2D его рисует drawHero, и look у него
// геройский. Пёс — зверь, дрон — своя форма. Вид передаём явно: у собаки в
// look нет shape, и без этого она выходила человеком.
const PET_KINDS = { friend: 'hero', drone: 'drone', dog: 'beast' };

function petSpec(pet) {
  return { kind: PET_KINDS[pet.id] || 'zombie', radius: CONFIG.player.radius, lift: 0 };
}

// Снаряд летит на уровне груди, а не по траве: в 2D высоты нет вовсе, и без
// подъёма пуля катилась бы по земле.
const SHOT_SPEC = { kind: 'shot', radius: 7, liftWorld: 24 };

// Смешать два шестнадцатеричных цвета. Своя копия, а не общая утилита: в
// render3d это единственное место, где цвета смешиваются, а тянуть ради него
// зависимость от sprites.js значило бы связать два рендера.
function mixColor(from, to, amount) {
  const a = new Color(from);
  const b = new Color(to);
  return `#${a.lerp(b, amount).getHexString()}`;
}
