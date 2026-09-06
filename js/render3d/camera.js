// Камера сцены: обёртка Three вокруг чистой математики из camera-math.js.
//
// Разделение намеренное. Всё, что влияет на управление (угол, слежение,
// поворот направления от стрелок), живёт в camera-math и проверяется
// автотестом; здесь остаётся только перекладывание чисел в Three и обратный
// луч для пальца.

import { PerspectiveCamera, Raycaster, Vector2, Vector3, Plane } from 'three';
import { CameraMath } from './camera-math.js';

// Плоскость пола, в которую целится палец. Одна на всё приложение: она
// неподвижна, мир плоский.
const GROUND = new Plane(new Vector3(0, 1, 0), 0);

export class Camera3D {
  constructor(spec) {
    this.spec = spec;
    this.math = new CameraMath(spec);
    this.camera = new PerspectiveCamera(spec.fov, 1, spec.near, spec.far);

    this.raycaster = new Raycaster();
    this.pointer = new Vector2();
    this.hit = new Vector3();
  }

  get yaw() { return this.math.yaw; }

  setArena(arena) {
    this.math.setArena(arena);
    this.camera.aspect = arena.width / Math.max(1, arena.height);
    this.camera.updateProjectionMatrix();
  }

  snapTo(target) { this.math.snapTo(target); }
  follow(target, dt) { this.math.follow(target, dt); }
  rotateBy(dx, dy) { this.math.rotateBy(dx, dy); }
  raiseBy(amount) { this.math.raiseBy(amount); }
  reset() { this.math.reset(); }
  setShake(x, y) { this.math.setShake(x, y); }
  worldDirection(dir) { return this.math.worldDirection(dir); }
  screenDirection(dir) { return this.math.screenDirection(dir); }

  // Ставит камеру Three туда, куда сказала математика. Вызывается раз в кадр,
  // до отрисовки.
  sync() {
    const eye = this.math.eyePoint();
    const target = this.math.targetPoint();
    this.camera.position.set(eye.x, eye.y, eye.z);
    this.camera.lookAt(target.x, target.y, target.z);
  }

  // Экранная точка (в тех же CSS-пикселях, что и арена) — в точку на полу.
  // Нужна пальцу: тач работает по правилу «где палец, туда герой», а при
  // повёрнутой камере экранная точка перестаёт совпадать с мировой.
  //
  // Если луч уходит выше горизонта, пересечения с полом нет. Отдаём null, и
  // вызывающий оставляет прежнее направление — герой не должен дёргаться
  // оттого, что ребёнок ткнул в небо.
  unproject(screenX, screenY, arena) {
    this.pointer.x = (screenX / arena.width) * 2 - 1;
    this.pointer.y = -(screenY / arena.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const point = this.raycaster.ray.intersectPlane(GROUND, this.hit);
    if (!point) return null;
    return { x: point.x, y: point.z };
  }
}
