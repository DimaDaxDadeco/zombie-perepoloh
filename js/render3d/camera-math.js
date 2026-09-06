// Математика камеры объёмного режима: где стоит глаз, куда он смотрит и как
// повернуть направление, которое пришло от стрелок.
//
// ЗАЧЕМ ОТДЕЛЬНЫМ ФАЙЛОМ, БЕЗ THREE. Здесь живёт единственное место, где 3D
// может испортить управление: ребёнок жмёт «вправо», а герой бежит куда-то
// вбок. Поэтому математика вынесена из рендера, не знает ни про Three, ни про
// DOM, и проверяется автотестом в Node (test/camera.mjs). Всё остальное в
// render3d/ — уже картинка, её проверяют глазами.
//
// СИСТЕМА КООРДИНАТ. Мир игры плоский: x вправо, y вниз по карте — ровно те же
// пиксели арены, что и в 2D. В сцене это плоскость пола: x остаётся x, y
// становится z, а вверх смотрит ось y. Никакого масштабирования: один пиксель
// арены — одна единица сцены, иначе пришлось бы делить каждое число из
// config.js, и радиусы зомби разошлись бы с радиусами столкновений.
//
// УГОЛ. yaw = 0 означает «камера стоит южнее героя и смотрит на север», то
// есть картинка развёрнута ровно как в 2D: экранный верх — это меньшие y.
// Пока ребёнок не тронул мышь, yaw остаётся нулём и стрелки работают в
// точности как раньше.

export class CameraMath {
  constructor(spec) {
    this.spec = spec;
    this.arena = { width: 0, height: 0 };

    this.yaw = 0;
    // Высота задаётся множителем, а не углом: угол пришлось бы пересчитывать
    // при каждом изменении размера окна, а множитель от размера не зависит.
    this.heightFactor = spec.heightFactor;

    // Сглаженная позиция, за которой едет камера. Держим отдельно от героя:
    // он дёргается (рывок Соника, отскок от толпы), а камера не должна.
    this.focus = { x: 0, y: 0 };
    this.hasFocus = false;

    this.shake = { x: 0, y: 0 };
  }

  setArena(arena) {
    this.arena = arena;
  }

  // Опорный размер, от которого считаются высота и отступ камеры. Меньшая
  // сторона, а не диагональ: на широком мониторе кадр должен охватывать поле
  // по высоте, иначе камера уезжает в стратосферу.
  get unit() {
    return Math.min(this.arena.width, this.arena.height) || 1;
  }

  // Мгновенно поставить камеру на героя — при старте раунда и после смены
  // размера окна. Без этого камера первую секунду доезжает из угла.
  snapTo(target) {
    if (!target) return;
    this.focus.x = target.x;
    this.focus.y = target.y;
    this.hasFocus = true;
  }

  follow(target, dt) {
    if (!target) return;
    if (!this.hasFocus) {
      this.snapTo(target);
      return;
    }
    // Экспоненциальное сглаживание: доля пути за кадр, не зависящая от fps.
    const k = 1 - Math.exp(-this.spec.followLerp * dt);
    this.focus.x += (target.x - this.focus.x) * k;
    this.focus.y += (target.y - this.focus.y) * k;
  }

  // Мышь: горизонталь крутит камеру вокруг героя, вертикаль поднимает и
  // опускает её. Оба движения ограничены — перевернуть камеру под землю или
  // задрать в зенит ребёнок не должен.
  rotateBy(dx, dy) {
    this.yaw += dx * this.spec.mouseYawSpeed;
    this.raiseBy(-dy * this.spec.mousePitchSpeed);
  }

  raiseBy(amount) {
    const { minHeightFactor, maxHeightFactor } = this.spec;
    this.heightFactor = clamp(this.heightFactor + amount, minHeightFactor, maxHeightFactor);
  }

  reset() {
    this.yaw = 0;
    this.heightFactor = this.spec.heightFactor;
  }

  setShake(x, y) {
    this.shake.x = x;
    this.shake.y = y;
  }

  // Точка, на которую смотрит камера, — в координатах сцены.
  targetPoint() {
    return {
      x: this.focus.x + this.shake.x,
      y: 0,
      z: this.focus.y + this.shake.y,
    };
  }

  // Где стоит глаз. Отступ назад считается по yaw, высота — отдельно: она не
  // участвует в повороте, иначе камера ходила бы по наклонному кольцу.
  eyePoint() {
    const unit = this.unit;
    const back = unit * this.spec.distanceFactor;
    const target = this.targetPoint();
    return {
      x: target.x + Math.sin(this.yaw) * back,
      y: unit * this.heightFactor,
      z: target.z + Math.cos(this.yaw) * back,
    };
  }

  // Направление от стрелок — в мировое. Вектор приходит экранный: x вправо,
  // y вниз по экрану. При yaw = 0 это тождество, поэтому 2D-управление
  // остаётся ровно тем же, пока камеру не повернули.
  worldDirection({ x, y }) {
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    return { x: x * cos + y * sin, y: -x * sin + y * cos };
  }

  // Обратное преобразование: куда персонаж бежит С ТОЧКИ ЗРЕНИЯ ЗРИТЕЛЯ.
  // Нужно для facing: герой должен поворачиваться лицом туда, куда бежит на
  // экране, а не туда, куда растёт мировой x.
  screenDirection({ x, y }) {
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    return { x: x * cos - y * sin, y: x * sin + y * cos };
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
