// Декорации локаций в объёме: цветы, деревья, ракушки, звёзды, кристаллы,
// лёд и сено.
//
// ТОЧКИ ТЕ ЖЕ. Расстановку считает render/background.js, сея её номером
// раунда, — и мы берём готовый список, а не сеем свой. Иначе один и тот же
// раунд выглядел бы в двух режимах по-разному, и стенд локаций перестал бы
// что-либо доказывать.
//
// ЗАЧЕМ ВООБЩЕ. На пустом поле объём не читается: единственное, по чему видно
// перспективу, — это предметы, стоящие на земле. Плоская игра обходилась
// пятнами на траве, здесь они обязаны иметь высоту.

import { Group, Mesh, ConeGeometry, CylinderGeometry, SphereGeometry, OctahedronGeometry } from 'three';

// Геометрии единичного размера, общие на всю игру: декораций на арене
// двадцать шесть, но тем семь, и плодить по набору на тему незачем.
const CONE = new ConeGeometry(1, 1, 7);
const TRUNK = new CylinderGeometry(0.16, 0.22, 1, 6);
const BALL = new SphereGeometry(1, 8, 6);
const SHARD = new OctahedronGeometry(1, 0);
const DRUM = new CylinderGeometry(1, 1, 1, 10);

export class Decor {
  constructor(scene, materialFor) {
    this.scene = scene;
    this.materialFor = materialFor;
    this.group = new Group();
    scene.add(this.group);
    this.source = null;   // список, по которому собрано текущее содержимое
    this.themeId = null;
  }

  // Пересобирает, только если сменилась тема или сам список: он живёт до
  // следующего раунда, а кадров между ними тысячи.
  sync(background) {
    if (!background) return;
    const { theme, decorations } = background;
    if (decorations === this.source && theme?.id === this.themeId) return;
    this.source = decorations;
    this.themeId = theme?.id || null;
    this.rebuild(theme, decorations);
  }

  rebuild(theme, decorations) {
    this.group.clear();
    if (!theme || !decorations) return;
    const build = BUILDERS[theme.deco] || BUILDERS.flowers;
    for (const d of decorations) {
      const item = build(d, theme, this.materialFor);
      if (!item) continue;
      item.position.set(d.x, 0, d.y);
      // Поворот от variant, а не от случайного числа: декорации обязаны
      // остаться детерминированными, иначе они замигают между кадрами.
      item.rotation.y = d.variant * Math.PI * 2;
      item.traverse((part) => { if (part.isMesh) part.castShadow = true; });
      this.group.add(item);
    }
  }
}

// Каждый строитель получает декорацию из background.js ({x, y, size, variant})
// и отдаёт узел, стоящий на нуле.
const BUILDERS = {
  flowers(d, theme, paint) {
    const node = new Group();
    const h = d.size * 1.6;
    node.add(put(TRUNK, paint(theme.accent), 0, h / 2, 0, d.size * 0.18, h, d.size * 0.18));
    // Цвет венчика — от variant: клумба из одинаковых цветов выглядит
    // напечатанной.
    const petal = ['#ff6b9d', '#ffd93d', '#ffffff', '#c77dff'][Math.floor(d.variant * 4) % 4];
    node.add(put(BALL, paint(petal), 0, h, 0, d.size * 0.5, d.size * 0.3, d.size * 0.5));
    return node;
  },

  trees(d, theme, paint) {
    const node = new Group();
    const h = d.size * 3.2;
    node.add(put(TRUNK, paint('#8a5a2b'), 0, h * 0.3, 0, d.size * 0.5, h * 0.6, d.size * 0.5));
    node.add(put(CONE, paint(theme.accent), 0, h * 0.72, 0, d.size * 1.5, h * 0.85, d.size * 1.5));
    return node;
  },

  beach(d, theme, paint) {
    const node = new Group();
    // Ракушка — приплюснутый шар: на песке важнее тень, чем детали.
    node.add(put(BALL, paint('#fff0d6'), 0, d.size * 0.2, 0, d.size * 0.9, d.size * 0.4, d.size * 0.7));
    return node;
  },

  space(d, theme, paint) {
    const node = new Group();
    // Звёзды не лежат, а висят: в космосе пол условный, и парящие обломки
    // читаются лучше камней.
    const lift = d.size * (2 + d.variant * 3);
    node.add(put(SHARD, paint('#e8ecff'), 0, lift, 0, d.size * 0.5, d.size * 0.5, d.size * 0.5));
    return node;
  },

  crystals(d, theme, paint) {
    const node = new Group();
    const h = d.size * 2.6;
    node.add(put(CONE, paint('#9b7fd4'), 0, h / 2, 0, d.size * 0.7, h, d.size * 0.7));
    node.add(put(CONE, paint(theme.accent), d.size * 0.7, h * 0.32, 0,
      d.size * 0.4, h * 0.6, d.size * 0.4));
    return node;
  },

  ice(d, theme, paint) {
    const node = new Group();
    // Торос — низкий и широкий: высокие льдины закрывали бы зомби, а на
    // катке они и так белые.
    node.add(put(SHARD, paint('#cfeaff'), 0, d.size * 0.35, 0,
      d.size * 1.1, d.size * 0.7, d.size * 1.1));
    return node;
  },

  hay(d, theme, paint) {
    const node = new Group();
    const r = d.size * 0.9;
    // Цвет от темы, а не свой: на ферме поле и сено намеренно различаются
    // насыщенностью, а не оттенком, и своя краска эту разницу стирала бы.
    const roll = put(DRUM, paint(theme.accent), 0, r, 0, r, r * 1.6, r);
    roll.rotation.z = Math.PI / 2;   // рулон лежит на боку
    node.add(roll);
    return node;
  },
};

function put(geometry, material, x, y, z, sx, sy, sz) {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}
