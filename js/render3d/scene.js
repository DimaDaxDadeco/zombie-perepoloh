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
// ПЕРВЫЙ ЭТАП. Все персонажи здесь — капсулы цвета своей одежды. Настоящие
// фигурки по look приедут отдельным шагом (см. docs/render3d.md): сначала надо
// понять, играется ли вообще объёмный режим, и только потом вкладываться в
// десять героев, семнадцать зомби и двенадцать боссов.

import {
  Scene, WebGLRenderer, Color, Fog, Mesh,
  CapsuleGeometry, SphereGeometry, PlaneGeometry, CylinderGeometry,
  MeshLambertMaterial, DirectionalLight, HemisphereLight, PCFSoftShadowMap,
} from 'three';
import { CONFIG } from '../config.js';
import { Camera3D } from './camera.js';

// Заготовки геометрии: радиус ровно единица, масштаб задаётся у меша. Так на
// всю игру приходится по одной геометрии на форму, а не по одной на зомби.
//
// Полная высота капсулы — это длина цилиндра плюс два полушария, поэтому
// цилиндру достаётся figureHeightFactor минус два. Тогда после умножения на
// игровой радиус фигурка ровно во столько раз выше своего радиуса, во сколько
// сказано в конфиге, и её центр всегда на половине этой высоты.
const FIGURE_HEIGHT = CONFIG.render3d.figureHeightFactor;
const UNIT_CAPSULE = new CapsuleGeometry(1, Math.max(0, FIGURE_HEIGHT - 2), 4, 12);
const UNIT_SPHERE = new SphereGeometry(1, 12, 10);
// Плоские объекты: место доставки и прочее, по чему герой пробегает насквозь.
const DISC_HEIGHT = 0.12;
const UNIT_DISC = new CylinderGeometry(1, 1, DISC_HEIGHT, 20);

const DEFAULT_COLOR = '#c8c8c8';

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
    this.ground.material = this.materialFor(theme.ground);
    this.scene.background = new Color(theme.sky);
    // Туман того же цвета, что небо: дальний край поля растворяется в
    // горизонте вместо того, чтобы обрываться ровной линией.
    const unit = Math.max(this.arena.width, this.arena.height) || 1;
    this.scene.fog = new Fog(new Color(theme.sky), unit * 0.8, unit * 1.9);
  }

  // --- Кадр ---

  update(dt, world) {
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
    for (const player of world.players) this.place(player, figureSpec(player));
    for (const enemy of world.enemies) this.place(enemy, figureSpec(enemy));
    for (const pet of world.pets) this.place(pet, figureSpec(pet));
    for (const prop of world.props) this.place(prop, figureSpec(prop));
    for (const pickup of world.pickups) this.place(pickup, ballSpec(pickup));
    for (const shot of world.projectiles) this.place(shot, ballSpec(shot));
  }

  // Ставит меш сущности на место, создавая его при первой встрече. Ключ —
  // сам объект сущности: он живёт ровно столько же, сколько нужен меш.
  place(entity, spec) {
    if (!entity || entity.alive === false) return;
    this.seen.add(entity);

    let figure = this.figures.get(entity);
    if (!figure) {
      figure = this.build(spec);
      this.figures.set(entity, figure);
      this.scene.add(figure.node);
    }
    if (figure.color !== spec.color) {
      figure.color = spec.color;
      figure.node.material = this.materialFor(spec.color);
    }

    const radius = entity.radius || spec.radius;
    figure.node.position.set(entity.x, (radius * spec.heightFactor) / 2, entity.y);
    figure.node.scale.setScalar(radius);
  }

  build(spec) {
    const node = new Mesh(spec.shape, this.materialFor(spec.color));
    node.castShadow = true;
    // Плоские объекты (место доставки) тень не отбрасывают, но принимают:
    // иначе герой, стоящий на светящемся круге, парит над ним.
    node.receiveShadow = true;
    return { node, color: spec.color };
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

// Заготовка фигурки: капсула цвета одежды. Цвет ищем в look — том же поле, по
// которому 2D рисует персонажа, — чтобы Халк остался зелёным, а Соник синим
// даже на этапе капсул.
//
// Наземные пропы (место доставки) — не капсула, а лепёшка: герой должен
// пробегать по ним насквозь, а торчащий столб он бы огибал.
function figureSpec(entity) {
  const look = entity.look || {};
  if (entity.layer === 'ground') {
    return { shape: UNIT_DISC, color: look.clothes || '#ffd93d', radius: CONFIG.player.radius, heightFactor: DISC_HEIGHT };
  }
  return {
    shape: UNIT_CAPSULE,
    color: look.shirt || look.clothes || look.skin || DEFAULT_COLOR,
    radius: CONFIG.player.radius,
    heightFactor: FIGURE_HEIGHT,
  };
}

function ballSpec(entity) {
  return {
    shape: UNIT_SPHERE,
    color: entity.type === 'money' ? '#7bd67b' : '#ffd93d',
    radius: 8,
    heightFactor: 2,
  };
}
