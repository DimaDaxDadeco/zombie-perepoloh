// Частицы объёмного режима: конфетти, кольца взрывов и круги-предупреждения.
//
// ЧТО СЮДА ПОПАДАЕТ. Только то, без чего ребёнок теряет обратную связь.
// Конфетти — единственный признак, что зомби лопнул. Круг-предупреждение —
// единственный признак, что сейчас ударит босс; в 2D он нарисован частицей
// именно поэтому (см. комментарий к addTelegraph). Кольца взрывов объясняют,
// почему умерли сразу трое. Молнии, взмахи меча и эффекты появления боссов
// пока остаются плоскими — они украшают, а не сообщают.
//
// ПОЧЕМУ ИНСТАНСЫ. Конфетти на экране бывает несколько сотен, и отдельным
// мешем на каждую частицу сцена перестала бы держать кадр на планшете. Один
// InstancedMesh рисуется одним вызовом независимо от их числа.
//
// Массивы частиц читаются НАПРЯМУЮ и только на чтение: systems/particles.js
// про объёмный режим не знает и меняться ради него не должен.

import {
  InstancedMesh, BoxGeometry, RingGeometry, Mesh,
  MeshLambertMaterial, MeshBasicMaterial, Color, Object3D, DoubleSide,
} from 'three';

// Потолок инстансов. Больше на экране не бывает: конфетти живёт около
// секунды, а спавнер держит десятки зомби, не тысячи.
const MAX_CONFETTI = 600;
const MAX_RINGS = 24;
const MAX_TELEGRAPHS = 12;

// Высота, на которой летает конфетти. В плоской игре у частиц нет третьей
// координаты вовсе, поэтому поднимаем их на глаз — примерно на грудь.
const CONFETTI_HEIGHT = 26;
// Кольца и круги лежат на земле, но чуть выше нуля: ровно в нуле они спорят
// с полом за глубину и мерцают.
const GROUND_LIFT = 0.6;

export class Effects {
  constructor(scene) {
    this.dummy = new Object3D();
    this.color = new Color();

    this.confetti = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      new MeshLambertMaterial(),
      MAX_CONFETTI,
    );
    this.confetti.frustumCulled = false;   // облако живёт по всей арене
    this.confetti.count = 0;
    scene.add(this.confetti);

    this.rings = pool(scene, MAX_RINGS, () => new Mesh(
      new RingGeometry(0.82, 1, 28),
      new MeshBasicMaterial({ transparent: true, side: DoubleSide }),
    ));
    this.telegraphs = pool(scene, MAX_TELEGRAPHS, () => new Mesh(
      new RingGeometry(0, 1, 28),
      new MeshBasicMaterial({ transparent: true, side: DoubleSide, color: new Color('#ff4d6d') }),
    ));
  }

  update(particles) {
    if (!particles) return;
    this.updateConfetti(particles.confetti);
    this.updateRings(particles.rings);
    this.updateTelegraphs(particles.telegraphs);
  }

  updateConfetti(list) {
    const count = Math.min(list.length, MAX_CONFETTI);
    for (let i = 0; i < count; i++) {
      const p = list[i];
      // Гаснет размером, а не прозрачностью: полупрозрачные инстансы пришлось
      // бы сортировать по глубине каждый кадр, а выигрыш нулевой — частица
      // живёт секунду.
      const fade = Math.max(0, Math.min(1, p.life / (p.maxLife || 1)));
      const size = p.size * fade;
      this.dummy.position.set(p.x, CONFETTI_HEIGHT * fade, p.y);
      this.dummy.rotation.set(p.angle || 0, p.angle || 0, (p.angle || 0) * 0.7);
      this.dummy.scale.setScalar(size);
      this.dummy.updateMatrix();
      this.confetti.setMatrixAt(i, this.dummy.matrix);
      this.confetti.setColorAt(i, this.color.set(p.color));
    }
    this.confetti.count = count;
    this.confetti.instanceMatrix.needsUpdate = true;
    if (this.confetti.instanceColor) this.confetti.instanceColor.needsUpdate = true;
  }

  updateRings(list) {
    show(this.rings, list, (mesh, ring) => {
      const fade = Math.max(0, ring.life / (ring.maxLife || 1));
      mesh.position.set(ring.x, GROUND_LIFT, ring.y);
      // Кольцо расходится к концу жизни, а не в начале: так оно читается как
      // ударная волна, а не как схлопывание.
      mesh.scale.setScalar(ring.radius * (1.15 - fade * 0.15));
      mesh.material.color.set(ring.color);
      mesh.material.opacity = fade;
    });
  }

  updateTelegraphs(list) {
    show(this.telegraphs, list, (mesh, mark) => {
      const fade = Math.max(0, mark.life / (mark.maxLife || 1));
      mesh.position.set(mark.x, GROUND_LIFT, mark.y);
      mesh.scale.setScalar(mark.radius);
      // Наоборот: чем ближе удар, тем ярче. Предупреждение обязано пугать
      // сильнее всего в последний момент.
      mesh.material.opacity = 0.2 + (1 - fade) * 0.45;
    });
  }
}

function pool(scene, size, make) {
  const items = [];
  for (let i = 0; i < size; i++) {
    const mesh = make();
    mesh.rotation.x = -Math.PI / 2;   // положить на землю
    mesh.visible = false;
    scene.add(mesh);
    items.push(mesh);
  }
  return items;
}

function show(meshes, list, apply) {
  const count = Math.min(list.length, meshes.length);
  for (let i = 0; i < count; i++) {
    meshes[i].visible = true;
    apply(meshes[i], list[i]);
  }
  for (let i = count; i < meshes.length; i++) meshes[i].visible = false;
}
