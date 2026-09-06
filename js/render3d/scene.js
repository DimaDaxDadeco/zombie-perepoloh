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
  Scene, WebGLRenderer, Color, Fog, Mesh,
  SphereGeometry, PlaneGeometry,
  MeshLambertMaterial, DirectionalLight, HemisphereLight, PCFSoftShadowMap,
} from 'three';
import { CONFIG } from '../config.js';
import { Camera3D } from './camera.js';
import { buildFigure, buildProp, buildPickup, poseFigure } from './figures.js';

// Заготовка для того, что ещё не стало фигуркой, — снарядов: радиус ровно
// единица, масштаб задаётся у меша.
const UNIT_SPHERE = new SphereGeometry(1, 12, 10);

const DEFAULT_COLOR = '#c8c8c8';

// Ниже этого шага за кадр поворот не пересчитывается: стоящая фигурка иначе
// вертится от миллиметровых толчков расталкивания.
const HEADING_MIN_STEP = 0.05;
const HEADING_LERP = 0.25;

export class Scene3D {
  constructor(canvas) {
    this.spec = CONFIG.render3d;
    this.arena = { width: 0, height: 0 };

    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.scene = new Scene();
    this.camera = new Camera3D(this.spec);

    this.materials = new Map();   // цвет -> материал, один на всю игру
    this.figures = new Map();     // сущность -> меш; переживает кадры
    this.seen = new Set();        // кто попался в этом кадре

    this.buildGround();
    this.buildLights();

    this.themeId = null;
    this.theme = null;
    // Общее время сцены: по нему трепещет пламя и трясётся подарок. Своё, а
    // не игровое, — это украшение, и на симуляцию оно не влияет.
    this.phase = 0;
  }

  // --- Постоянная обстановка ---

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
    this.scene.add(new HemisphereLight(
      new Color(light.skyColor), new Color(light.groundColor), light.ambientIntensity,
    ));

    this.sun = new DirectionalLight(new Color(light.sunColor), light.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(light.shadowSize, light.shadowSize);
    this.scene.add(this.sun);
    // Цель света — отдельный объект, и в сцену её нужно добавить руками,
    // иначе Three не пересчитает её мировую матрицу и тени уедут.
    this.scene.add(this.sun.target);
  }

  materialFor(color) {
    const key = String(color || DEFAULT_COLOR);
    let material = this.materials.get(key);
    if (!material) {
      // Lambert, а не Standard: металлов и шероховатостей в мультяшной игре
      // нет, а на планшете он заметно дешевле.
      material = new MeshLambertMaterial({ color: new Color(key) });
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
    this.updateFog();
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
    this.ground.material = this.materialFor(theme.ground);
    this.scene.background = new Color(theme.sky);
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
    if (!this.theme) return;
    const unit = Math.max(this.arena.width, this.arena.height);
    if (!unit) return;
    this.scene.fog = new Fog(new Color(this.theme.sky), unit * 0.8, unit * 1.9);
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

    this.seen.clear();
    this.collect(world);
    this.sweep();

    this.camera.sync();
    this.renderer.render(this.scene, this.camera.camera);
  }

  // Единственное место, где перечислено, что вообще видно в мире. Меняется
  // состав — меняется и Round.draw; расхождение этих двух списков и есть
  // главный способ сломать объёмный режим незаметно.
  collect(world) {
    for (const player of world.players) this.place(player, HERO_SPEC);
    for (const enemy of world.enemies) this.place(enemy, ENEMY_SPEC);
    for (const pet of world.pets) this.place(pet, petSpec(pet));
    for (const prop of world.props) this.place(prop, PROP_SPEC);
    for (const pickup of world.pickups) this.place(pickup, PICKUP_SPEC);
    for (const shot of world.projectiles) this.place(shot, ballSpec(shot));
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

    const radius = entity.radius || spec.radius;
    figure.node.scale.setScalar(radius);
    figure.node.position.set(entity.x, spec.lift * radius, entity.y);

    if (figure.tick) {
      figure.tick(entity, this.phase);
    } else if (figure.parts) {
      figure.node.rotation.y = this.headingOf(entity, figure);
      poseFigure(figure, entity.walkPhase || 0);
    }
  }

  create(entity, spec) {
    if (spec.shape) {
      const node = new Mesh(spec.shape, this.materialFor(spec.color));
      node.castShadow = true;
      node.receiveShadow = true;
      return { node };
    }
    const paint = (color) => this.materialFor(color);
    const figure = spec.kind === 'prop'
      ? (buildProp(entity, paint) || buildFigure(entity.look, 'zombie', paint))
      : spec.kind === 'pickup'
        ? buildPickup(entity.type, paint)
        : buildFigure(entity.look, spec.kind, paint);
    figure.node.traverse((part) => {
      if (!part.isMesh) return;
      part.castShadow = true;
      part.receiveShadow = true;
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

const PROP_SPEC = { kind: 'prop', radius: CONFIG.player.radius, lift: 0 };
// Медалька и монетка висят над травой, иначе плоский кружок в ней тонет.
const PICKUP_SPEC = { kind: 'pickup', radius: 10, lift: 1.1 };

// Питомец-друг — тот же герой: в 2D его рисует drawHero, и look у него
// геройский. Пёс идёт зверем, дрон — своей формой.
function petSpec(pet) {
  const kind = pet.id === 'friend' ? 'hero' : (pet.id === 'drone' ? 'drone' : 'zombie');
  return { kind, radius: CONFIG.player.radius, lift: 0 };
}

// Снаряды пока шарики: формы под каждый из тринадцати видов — следующий шаг.
function ballSpec() {
  return { shape: UNIT_SPHERE, color: '#4fb3ff', radius: 7, lift: 1 };
}
