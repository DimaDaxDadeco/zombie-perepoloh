// Процедурная отрисовка персонажей: никаких картинок, всё рисуется кодом.
// Каждая функция рисует объект с центром в (0,0) — вызывающий сам делает translate.

const EYE_WHITE = '#ffffff';
const DARK = '#243b12';

// Зрачки героя в долях радиуса. Вынесены в константу, потому что по ним бьёт
// лазер из weapons.js: два набора одних и тех же чисел разъехались бы при
// первой же правке лица, и луч пошёл бы мимо глаз.
// Пара несимметрична намеренно — так лицо выглядит живее.
const HERO_EYES = [{ x: -0.18, y: -0.85 }, { x: 0.2, y: -0.85 }];

// Покачивание героя при беге. Нужно и drawHero, и тем, кто рисует поверх него
// в МИРОВЫХ координатах: без него луч отрывается от лица на каждом шаге.
function heroBob(radius, walkPhase) {
  return Math.sin(walkPhase * 2) * radius * 0.08;
}

// Где сейчас глаза героя — в его локальных координатах, с уже применённым
// зеркалом и покачиванием. drawHero делает то же самое трансформациями
// холста, но weapons.js рисует вне их, поэтому считает точки честно.
export function heroEyePoints({ radius, walkPhase = 0, facing = 1 }) {
  const bob = heroBob(radius, walkPhase);
  return HERO_EYES.map((eye) => ({
    x: eye.x * radius * facing,
    y: eye.y * radius + bob,
  }));
}

// Телосложение героя. Тот же приём, что BODY_WIDTH у зомби: силуэт должен
// отличаться шириной, а не только цветом — Халка от Соника надо узнавать по
// контуру, а на игровом радиусе 20 цвет и деталей не разглядеть.
const HERO_BUILD = { normal: 1, buff: 1.42 };

// Запасная внешность героя, если look почему-то не передали.
const DEFAULT_LOOK = {
  skin: '#ffcc99', hair: '#5c3a21', hairStyle: 'bowl',
  shirt: '#2f6fd0', pants: '#3a3a5c', cape: '#e03b3b', chest: 'star',
};

// --- Герой. Внешность задаётся объектом look из CONFIG.characters ---
export function drawHero(ctx, { radius, walkPhase, facing, blinking, look = DEFAULT_LOOK }) {
  if (blinking) ctx.globalAlpha = 0.45;
  const r = radius;
  const bob = heroBob(r, walkPhase);   // лёгкое покачивание при беге
  const step = Math.sin(walkPhase) * r * 0.4;

  ctx.save();
  ctx.translate(0, bob);
  ctx.scale(facing, 1);

  if (look.cape) drawCape(ctx, r, walkPhase, look.cape);

  const build = HERO_BUILD[look.build] ?? 1;

  // Ноги-сапожки, шагают в такт. Ширина идёт за телосложением: при широком
  // торсе и прежних ногах качок выходит на спичках.
  const legW = r * 0.35 * build;
  const legX = r * 0.45 * build;
  ctx.fillStyle = look.pants;
  roundRect(ctx, -legX + step, r * 0.5, legW, r * 0.6, r * 0.15);
  roundRect(ctx, legX - legW + step * -1, r * 0.5, legW, r * 0.6, r * 0.15);
  // Ботинки: широкие носки поверх низа ног (красные кроссовки Соника).
  if (look.shoes) {
    ctx.fillStyle = look.shoes;
    roundRect(ctx, -legX - r * 0.07 + step, r * 0.86, legW + r * 0.15, r * 0.28, r * 0.13);
    roundRect(ctx, legX - legW - r * 0.08 - step, r * 0.86, legW + r * 0.15, r * 0.28, r * 0.13);
  }

  // Туловище
  const bodyW = r * build;
  ctx.fillStyle = look.shirt;
  roundRect(ctx, -bodyW / 2, -r * 0.4, bodyW, r * 1.0, r * 0.3);
  // Белой футболке нужен контур, иначе она сливается со светлым фоном
  if (isLight(look.shirt)) {
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.roundRect(-bodyW / 2, -r * 0.4, bodyW, r * 1.0, r * 0.3);
    ctx.stroke();
  }
  // Качку — плечи и намёк на грудные: без них широкое туловище читается
  // просто как «толстый», а не «сильный».
  if (build > 1) drawBulk(ctx, r, bodyW, look);

  drawChestEmblem(ctx, r, look, facing);

  // Руки. Перчатки — необязательный цвет поверх кожи (белые у Соника).
  const armR = r * 0.2 * build;
  const armX = r * 0.62 * build;
  const armY = build > 1 ? -r * 0.06 : r * 0.05;   // качок держит руки выше
  ctx.fillStyle = look.gloves || look.skin;
  circle(ctx, -armX, armY - step * 0.5, armR);
  circle(ctx, armX, armY + step * 0.5, armR);

  // Голова
  ctx.fillStyle = look.skin;
  circle(ctx, 0, -r * 0.85, r * 0.52);

  drawHairStyle(ctx, r, look);
  drawFace(ctx, r, look);
  if (look.hat) drawBeanie(ctx, r, look.hat, facing);

  ctx.restore();
  ctx.globalAlpha = 1;
}

// Плечи и грудные качка: тёмная дуга по верху туловища и разделяющая
// вертикаль. Рисуется тем же цветом рубашки, лишь притемнённым, — так деталь
// работает при любом цвете и не требует второго поля в look.
function drawBulk(ctx, r, bodyW, look) {
  ctx.fillStyle = shade(look.shirt, -0.18);
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.34, bodyW * 0.46, r * 0.2, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(look.shirt, -0.28);
  ctx.lineWidth = Math.max(1, r * 0.05);

  // Пресс-кубики. Именно ЗАЛИВКОЙ, а не штрихами: линии, расходящиеся от
  // центральной вертикали, читаются рыбьим скелетом — так вышло с первой
  // версии, и с решёткой из сплошных поперечин до неё.
  const cubeW = bodyW * 0.19;
  const cubeH = r * 0.13;
  const gap = r * 0.035;
  ctx.fillStyle = shade(look.shirt, -0.14);
  [0, 1, 2].forEach((row) => {
    const y = -r * 0.04 + row * (cubeH + gap);
    // Нижний ряд уже — так живот сужается к поясу, а не идёт кирпичом.
    const w = cubeW * (1 - row * 0.12);
    [-1, 1].forEach((side) => {
      const x = side === -1 ? -gap / 2 - w : gap / 2;
      roundRect(ctx, x, y, w, cubeH, r * 0.045);
    });
  });
}

function drawCape(ctx, r, walkPhase, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.5);
  ctx.quadraticCurveTo(-r * 1.5 - Math.sin(walkPhase) * r * 0.3, -r * 0.1, -r * 0.8, r * 1.1);
  ctx.quadraticCurveTo(-r * 0.2, r * 0.7, r * 0.1, r * 0.5);
  ctx.closePath();
  ctx.fill();
}

function drawChestEmblem(ctx, r, look, facing) {
  const kind = look.chest;
  if (kind === 'text') {
    // Надпись на футболке. scale(facing) компенсирует зеркальный поворот
    // персонажа, иначе цифры окажутся задом наперёд.
    ctx.save();
    ctx.scale(facing, 1);
    ctx.fillStyle = '#1c1c1c';
    ctx.font = `bold ${Math.round(r * 0.44)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(look.chestText, 0, r * 0.08);
    ctx.restore();
    return;
  }
  if (kind === 'star') {
    ctx.fillStyle = '#ffd93d';
    drawStarShape(ctx, 0, r * 0.05, r * 0.26, 5);
  } else if (kind === 'bolt') {
    ctx.fillStyle = '#ffd93d';
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.2);
    ctx.lineTo(-r * 0.12, r * 0.08);
    ctx.lineTo(r * 0.02, r * 0.08);
    ctx.lineTo(-r * 0.08, r * 0.32);
    ctx.lineTo(r * 0.16, r * 0.0);
    ctx.lineTo(r * 0.02, r * 0.0);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'spider') {
    // Паучок на груди: тельце из двух кружков и четыре пары лапок.
    ctx.strokeStyle = '#1c1c28';
    ctx.lineWidth = Math.max(1, r * 0.045);
    ctx.lineCap = 'round';
    [-1, 1].forEach((side) => {
      [-0.16, -0.02, 0.12, 0.26].forEach((dy, i) => {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.05, r * (dy + 0.02));
        // Лапки чуть загибаются книзу — иначе выходит снежинка, а не паук.
        ctx.quadraticCurveTo(side * r * 0.24, r * dy, side * r * 0.3,
          r * (dy + 0.08 + i * 0.02));
        ctx.stroke();
      });
    });
    ctx.fillStyle = '#1c1c28';
    circle(ctx, 0, r * 0.0, r * 0.09);
    circle(ctx, 0, r * 0.16, r * 0.12);
  }
}

function drawHairStyle(ctx, r, look) {
  ctx.fillStyle = look.hair;
  switch (look.hairStyle) {
    case 'bowl': // волосы шапочкой
      ctx.beginPath();
      ctx.arc(0, -r * 0.9, r * 0.53, Math.PI * 1.05, Math.PI * 2.0);
      ctx.fill();
      break;
    case 'cap': // короткая стрижка: из-под шапки видна только чёлка
      ctx.beginPath();
      ctx.arc(0, -r * 1.0, r * 0.52, Math.PI * 1.08, Math.PI * 1.92);
      ctx.fill();
      break;
    case 'antenna': // антенна робота
      ctx.fillRect(-r * 0.04, -r * 1.6, r * 0.08, r * 0.4);
      ctx.fillStyle = '#ff4d6d';
      circle(ctx, 0, -r * 1.62, r * 0.12);
      break;
    case 'ears': // кошачьи ушки
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.18, -r * 1.2);
        ctx.lineTo(side * r * 0.45, -r * 1.55);
        ctx.lineTo(side * r * 0.5, -r * 1.05);
        ctx.closePath();
        ctx.fill();
      });
      // Розовая серединка ушей
      ctx.fillStyle = '#ff9db1';
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.26, -r * 1.2);
        ctx.lineTo(side * r * 0.42, -r * 1.42);
        ctx.lineTo(side * r * 0.44, -r * 1.12);
        ctx.closePath();
        ctx.fill();
      });
      break;
    case 'quills': // колючки ежа: назад и вверх, разной длины
      // Длину держим в пределах половины радиуса от головы: голова — это круг
      // 0.52r, и колючки длиннее неё читаются не как иглы, а как сдутый набок
      // хохол. Проверено глазами на радиусе 20.
      [[-1.02, -1.02], [-0.92, -1.42], [-0.5, -1.66]].forEach(([tipX, tipY], i) => {
        ctx.beginPath();
        // Растут из затылка (герой смотрит вправо) — отсюда минус по X.
        ctx.moveTo(-r * 0.34, -r * (0.75 + i * 0.2));
        ctx.lineTo(r * tipX, r * tipY);
        ctx.lineTo(-r * 0.22, -r * (1.02 + i * 0.16));
        ctx.closePath();
        ctx.fill();
      });
      break;
    case 'pikaears': // длинные уши с тёмными кончиками
      [-1, 1].forEach((side) => {
        ctx.fillStyle = look.hair;
        ctx.beginPath();
        // Кончик тёмный, поэтому ухо рисуем целиком светлым, а сверху
        // накладываем тёмную макушку — так граница выходит ровной.
        ctx.moveTo(side * r * 0.16, -r * 1.15);
        ctx.lineTo(side * r * 0.5, -r * 1.95);
        ctx.lineTo(side * r * 0.62, -r * 1.05);
        ctx.closePath();
        ctx.fill();
      });
      [-1, 1].forEach((side) => {
        ctx.fillStyle = look.skin;
        ctx.beginPath();
        ctx.moveTo(side * r * 0.2, -r * 1.12);
        ctx.lineTo(side * r * 0.42, -r * 1.62);
        ctx.lineTo(side * r * 0.55, -r * 1.05);
        ctx.closePath();
        ctx.fill();
      });
      break;
    default:
      break;
  }
}

function drawFace(ctx, r, look) {
  if (look.hairStyle === 'ears') drawWhiskers(ctx, r);
  // Маска закрывает лицо целиком и рисует свои глаза — обычные тут не нужны.
  if (look.mask) return drawHeroMask(ctx, r, look.mask);

  // Морда: нижняя половина лица другого цвета. Рисуется ДО глаз и рта, чтобы
  // они легли поверх, — без неё Соник выходит синим человечком.
  if (look.muzzle) drawMuzzle(ctx, r, look.muzzle);

  if (look.cheeks) {
    ctx.fillStyle = look.cheeks;
    [-1, 1].forEach((side) => circle(ctx, side * r * 0.42, -r * 0.72, r * 0.13));
  }
  // Белки. Нужны там, где зрачок тонет в тёмной коже: на синем Сонике
  // тёмная точка не видна вовсе. Привязаны к морде, а не к отдельному полю —
  // у зверей с мордой крупные глаза и так положены.
  if (look.muzzle) {
    ctx.fillStyle = EYE_WHITE;
    for (const eye of HERO_EYES) {
      ctx.beginPath();
      ctx.ellipse(eye.x * r * 1.1, eye.y * r, r * 0.15, r * 0.19, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = DARK;
  for (const eye of HERO_EYES) circle(ctx, eye.x * r, eye.y * r, r * 0.07);

  // Брови домиком вниз — весь «злой» держится на них, а не на рте.
  if (look.brows) {
    ctx.strokeStyle = look.brows;
    ctx.lineWidth = Math.max(1.5, r * 0.09);
    ctx.lineCap = 'round';
    HERO_EYES.forEach((eye, i) => {
      const side = i === 0 ? -1 : 1;
      // Внутренний конец (у переносицы) НИЖЕ наружного — «\ /» над глазами.
      // Наоборот, «/ \», получается расстроенное лицо, а не злое; первая
      // версия была именно такой, и Халк вышел грустным.
      const inner = { x: eye.x * r - side * r * 0.02, y: eye.y * r - r * 0.09 };
      const outer = { x: eye.x * r + side * r * 0.26, y: eye.y * r - r * 0.28 };
      ctx.beginPath();
      ctx.moveTo(inner.x, inner.y);
      ctx.lineTo(outer.x, outer.y);
      ctx.stroke();
    });
  }

  ctx.strokeStyle = look.hairStyle === 'antenna' ? '#5a6a7a' : '#a8663f';
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.beginPath();
  if (look.mouth === 'snarl') {
    ctx.stroke();          // пустой путь, чтобы не тянуть предыдущий
    drawSnarl(ctx, r);
  } else {
    ctx.arc(r * 0.02, -r * 0.72, r * 0.2, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
}

// Оскал: открытый тёмный рот с зубами. Просто опущенная дуга не годится —
// она читается как «расстроен», а не «зол»; злость даёт открытый рот.
function drawSnarl(ctx, r) {
  const w = r * 0.27;
  const y = -r * 0.62;
  const h = r * 0.17;

  ctx.fillStyle = '#5a1f1f';
  ctx.beginPath();
  // Углы рта ОПУЩЕНЫ ниже середины — без этого получается ухмылка, что и
  // вышло с первой версии. Верх выгнут вверх, низ вниз: открытая пасть.
  ctx.moveTo(-w, y + h * 0.5);
  ctx.quadraticCurveTo(0, y - h * 0.5, w, y + h * 0.5);
  ctx.quadraticCurveTo(0, y + h * 1.6, -w, y + h * 0.5);
  ctx.closePath();
  ctx.fill();

  // Клыки, свисающие с верхней кромки. Ровная белая полоса читалась зубастой
  // улыбкой; треугольники — злобой.
  ctx.fillStyle = '#ffffff';
  [-0.55, -0.18, 0.18, 0.55].forEach((k) => {
    const fx = w * k;
    const fy = y - h * 0.5 + Math.abs(k) * h * 0.55;   // по дуге верхней кромки
    ctx.beginPath();
    ctx.moveTo(fx - w * 0.13, fy);
    ctx.lineTo(fx + w * 0.13, fy);
    ctx.lineTo(fx, fy + h * 0.55);
    ctx.closePath();
    ctx.fill();
  });
}

// Морда Соника: светлый овал на нижней половине лица и чёрный нос.
function drawMuzzle(ctx, r, color) {
  // Верх морды держим ниже зрачков (они на -0.85r, радиус 0.07r): если морда
  // накрывает глаза, лицо превращается в светлое пятно.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(r * 0.08, -r * 0.55, r * 0.4, r * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1c28';
  ctx.beginPath();
  ctx.ellipse(r * 0.12, -r * 0.68, r * 0.11, r * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Маска на всё лицо: белые линзы вместо глаз, рта нет.
//
// Линзы рисуются ПО HERO_EYES и лишь крупнее — координаты глаз двигать
// нельзя: по ним же бьёт лазер (см. heroEyePoints), и сдвиг увёл бы луч с лица.
function drawHeroMask(ctx, r, color) {
  ctx.fillStyle = color;
  circle(ctx, 0, -r * 0.85, r * 0.52);      // сама маска поверх головы
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = Math.max(1, r * 0.045);
  for (const eye of HERO_EYES) {
    ctx.beginPath();
    // Каплевидная линза: широкая у виска, острая к переносице.
    ctx.ellipse(eye.x * r * 1.35, eye.y * r, r * 0.2, r * 0.13,
      eye.x < 0 ? -0.35 : 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// Усы и носик — без них котик читается как человек с ушами.
function drawWhiskers(ctx, r) {
  ctx.strokeStyle = 'rgba(60,40,20,0.55)';
  ctx.lineWidth = Math.max(1, r * 0.04);
  [-1, 1].forEach((side) => {
    [-0.06, 0.06].forEach((dy) => {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.3, -r * 0.7 + r * dy);
      ctx.lineTo(side * r * 0.62, -r * 0.74 + r * dy * 1.6);
      ctx.stroke();
    });
  });
  ctx.fillStyle = '#ff9db1';
  ctx.beginPath();
  ctx.moveTo(-r * 0.08, -r * 0.76);
  ctx.lineTo(r * 0.08, -r * 0.76);
  ctx.lineTo(0, -r * 0.66);
  ctx.closePath();
  ctx.fill();
}

// Чёрная шапочка-бини с буквой — как у героя на фото.
function drawBeanie(ctx, r, hat, facing) {
  ctx.save();
  ctx.fillStyle = hat.color;
  // Купол
  ctx.beginPath();
  ctx.arc(0, -r * 1.12, r * 0.56, Math.PI, Math.PI * 2);
  ctx.fill();
  // Отворот. Держим его выше линии глаз (-0.85), иначе шапка «съедает» лицо.
  roundRect(ctx, -r * 0.58, -r * 1.18, r * 1.16, r * 0.22, r * 0.08);

  if (hat.letter) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(r * 0.42)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Компенсируем зеркальный поворот персонажа, иначе буква окажется наоборот
    ctx.scale(facing, 1);
    ctx.fillText(hat.letter, 0, -r * 1.32);
  }
  ctx.restore();
}

// Грубая проверка светлоты цвета — нужна, чтобы белую одежду обвести контуром.
function isLight(hexColor) {
  if (typeof hexColor !== 'string' || hexColor[0] !== '#') return false;
  const hex = hexColor.slice(1);
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}

// --- Зомби-животные ---
// Общий каркас: горизонтальное тело, четыре лапы, голова спереди.
// Отличия по видам (уши, морда, хвост) дорисовывает drawBeastHead.
// Зомби-версия четвероногого. Каркас общий с живым питомцем: правка уха или
// хвоста в одном месте не должна разъезжаться с другим.
function drawBeastZombie(ctx, opts) {
  drawBeast(ctx, { ...opts, mood: 'zombie' });
}

// Четвероногий: зомби-собака, зомби-кот, зомби-крот и живая собачка-питомец.
// mood отвечает только за морду — тело, лапы, хвост и уши одинаковы.
export function drawBeast(ctx, {
  radius, walkPhase, facing, hurtFlash = false, look, burning = false, frozen = false,
  freezeProgress = 0, freezeSeed = 0, mood = 'zombie', biteAnim = 0,
}) {
  const r = radius;
  let skin = hurtFlash ? '#ffffff' : look.skin;
  let dark = hurtFlash ? '#dddddd' : look.clothes;
  if (!hurtFlash && frozen) {
    skin = tint(skin, '#7fd8ff', 0.3);
    dark = tint(dark, '#7fd8ff', 0.25);
  } else if (!hurtFlash && burning) {
    skin = tint(skin, '#ff7a2b', 0.4);
  }

  ctx.save();
  ctx.scale(facing, 1);

  const step = Math.sin(walkPhase * 1.6) * r * 0.32;

  // Задние лапы
  ctx.fillStyle = dark;
  roundRect(ctx, -r * 0.75 + step, r * 0.35, r * 0.28, r * 0.6, r * 0.12);
  roundRect(ctx, -r * 0.45 - step, r * 0.35, r * 0.28, r * 0.6, r * 0.12);
  // Передние
  roundRect(ctx, r * 0.35 - step, r * 0.35, r * 0.28, r * 0.6, r * 0.12);
  roundRect(ctx, r * 0.62 + step, r * 0.35, r * 0.28, r * 0.6, r * 0.12);

  drawBeastTail(ctx, r, walkPhase, look, dark);

  // Туловище — горизонтальная «колбаска»
  ctx.fillStyle = skin;
  roundRect(ctx, -r * 0.85, -r * 0.35, r * 1.75, r * 0.8, r * 0.35);

  drawBeastHead(ctx, r, walkPhase, look, skin, dark, hurtFlash, mood, biteAnim);

  ctx.restore();

  if (burning) drawFlames(ctx, r, walkPhase);
  if (frozen) drawIceBlock(ctx, r, freezeProgress, freezeSeed);
}

function drawBeastTail(ctx, r, walkPhase, look, dark) {
  const wag = Math.sin(walkPhase * 3) * r * 0.28;
  ctx.strokeStyle = dark;
  ctx.lineCap = 'round';

  if (look.beast === 'cat') {          // кошачий хвост трубой
    ctx.lineWidth = r * 0.13;
    ctx.beginPath();
    ctx.moveTo(-r * 0.85, -r * 0.1);
    ctx.quadraticCurveTo(-r * 1.5, -r * 0.5 + wag, -r * 1.3, -r * 1.15 + wag);
    ctx.stroke();
    return;
  }
  if (look.beast === 'dog') {          // собачий — короткий и виляет
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.moveTo(-r * 0.85, -r * 0.2);
    ctx.quadraticCurveTo(-r * 1.25, -r * 0.45 + wag, -r * 1.15, -r * 0.75 + wag);
    ctx.stroke();
    return;
  }
  // Крот — куцый хвостик
  ctx.lineWidth = r * 0.1;
  ctx.beginPath();
  ctx.moveTo(-r * 0.85, r * 0.05);
  ctx.lineTo(-r * 1.1, r * 0.05 + wag * 0.3);
  ctx.stroke();
}

function drawBeastHead(ctx, r, walkPhase, look, skin, dark, hurtFlash, mood = 'zombie', biteAnim = 0) {
  // При укусе голова дёргается вперёд — маленькое «ам!», без которого укус
  // не читается вообще.
  const hx = r * (0.95 + biteAnim * 0.22);
  const hy = -r * 0.45;

  ctx.fillStyle = skin;
  circle(ctx, hx, hy, r * 0.45);

  if (look.beast === 'dog') {
    // Висячие уши и вытянутая морда
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(hx - r * 0.28, hy - r * 0.05, r * 0.16, r * 0.34, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    roundRect(ctx, hx + r * 0.25, hy - r * 0.05, r * 0.45, r * 0.3, r * 0.12);
    ctx.fillStyle = '#3b3b46';
    circle(ctx, hx + r * 0.68, hy + r * 0.1, r * 0.1);   // нос
  } else if (look.beast === 'cat') {
    // Острые ушки
    ctx.fillStyle = skin;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(hx + side * r * 0.1 - r * 0.12, hy - r * 0.3);
      ctx.lineTo(hx + side * r * 0.22, hy - r * 0.78);
      ctx.lineTo(hx + side * r * 0.3 + r * 0.05, hy - r * 0.26);
      ctx.closePath();
      ctx.fill();
    });
    ctx.fillStyle = '#ff9db1';
    circle(ctx, hx + r * 0.42, hy + r * 0.08, r * 0.07);  // носик
  } else {
    // Крот: розовый нос-пятачок и лапы-лопаты
    ctx.fillStyle = '#e3a0a8';
    ctx.beginPath();
    ctx.ellipse(hx + r * 0.42, hy + r * 0.05, r * 0.16, r * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dark;
    roundRect(ctx, hx - r * 0.1, hy + r * 0.35, r * 0.4, r * 0.22, r * 0.08);
  }

  if (mood === 'friendly') {
    drawFriendlyFace(ctx, r, hx, hy, look, biteAnim);
    return;
  }

  // Глаза «в кучку» — общая черта всех зомби в игре
  ctx.fillStyle = EYE_WHITE;
  circle(ctx, hx + r * 0.02, hy - r * 0.08, r * 0.15);
  circle(ctx, hx + r * 0.3, hy - r * 0.05, r * 0.12);
  ctx.fillStyle = DARK;
  circle(ctx, hx + r * 0.06, hy - r * 0.08, r * 0.06);
  circle(ctx, hx + r * 0.33, hy - r * 0.03, r * 0.05);

  // Торчащий клык
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, hx + r * 0.2, hy + r * 0.16, r * 0.09, r * 0.14, r * 0.03);
}

// Морда живого питомца. Ошейник обязателен: с третьего раунда по арене бегает
// зомби-собака того же силуэта, и на игровом размере (радиус ~16 px) отличать
// их надо мгновенно — как босса-спортсмена от «Каскетки».
function drawFriendlyFace(ctx, r, hx, hy, look, biteAnim) {
  ctx.fillStyle = DARK;
  circle(ctx, hx + r * 0.08, hy - r * 0.1, r * 0.1);   // глаза-бусины на месте
  circle(ctx, hx + r * 0.34, hy - r * 0.08, r * 0.09);
  ctx.fillStyle = '#ffffff';
  circle(ctx, hx + r * 0.11, hy - r * 0.13, r * 0.035);
  circle(ctx, hx + r * 0.37, hy - r * 0.11, r * 0.03);

  // Высунутый язык — при укусе длиннее
  ctx.fillStyle = '#ff8fa3';
  roundRect(ctx, hx + r * 0.42, hy + r * 0.16, r * 0.16, r * (0.18 + biteAnim * 0.14), r * 0.07);

  if (look.collar) {
    ctx.fillStyle = look.collar;
    roundRect(ctx, hx - r * 0.5, hy + r * 0.18, r * 0.3, r * 0.5, r * 0.08);
    ctx.fillStyle = '#ffd93d';
    circle(ctx, hx - r * 0.35, hy + r * 0.62, r * 0.09);   // жетон
  }
}

// Робот-помощник: летает, поэтому тень бледнее и покачивается.
export function drawDrone(ctx, { radius, phase, facing, look, fireAnim = 0 }) {
  const r = radius;
  const bob = Math.sin(phase * 1.6) * r * 0.22;

  ctx.save();
  ctx.translate(0, -r * 1.2 + bob);
  ctx.scale(facing, 1);

  // Размытый пропеллер
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.75, r * 1.1, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = look.body;
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.75);
  ctx.lineTo(0, -r * 0.35);
  ctx.stroke();

  // Корпус-капсула
  ctx.fillStyle = look.body;
  roundRect(ctx, -r * 0.6, -r * 0.35, r * 1.2, r * 0.85, r * 0.3);

  // Глазок-объектив: при выстреле вспыхивает
  ctx.fillStyle = fireAnim > 0 ? '#ffd93d' : look.eye;
  circle(ctx, r * 0.22, r * 0.05, r * 0.24);
  ctx.fillStyle = '#ffffff';
  circle(ctx, r * 0.28, r * 0.0, r * 0.08);
  ctx.restore();
}

// Голова-тыква: вырезанная рожица светится изнутри, а не чернеет дырами —
// светлая тыква добрее пустой.
function drawPumpkinHead(ctx, r, color) {
  const cy = -r * 0.82;
  const rr = r * 0.56;

  ctx.fillStyle = color;
  circle(ctx, 0, cy, rr);
  // Дольки
  ctx.strokeStyle = shade(color, -0.22);
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  [-0.5, 0.5].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(side * rr * 0.62, cy - rr * 0.86);
    ctx.quadraticCurveTo(side * rr * 0.95, cy, side * rr * 0.62, cy + rr * 0.86);
    ctx.stroke();
  });
  // Хвостик
  ctx.fillStyle = '#4f7a2a';
  roundRect(ctx, -r * 0.07, cy - rr * 1.22, r * 0.14, r * 0.28, r * 0.05);

  // Рожица
  ctx.fillStyle = '#ffe9a8';
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(side * rr * 0.18, cy - rr * 0.05);
    ctx.lineTo(side * rr * 0.56, cy - rr * 0.05);
    ctx.lineTo(side * rr * 0.37, cy - rr * 0.45);
    ctx.closePath();
    ctx.fill();
  });
  ctx.beginPath();
  ctx.moveTo(-rr * 0.55, cy + rr * 0.24);
  ctx.lineTo(rr * 0.55, cy + rr * 0.24);
  ctx.lineTo(rr * 0.3, cy + rr * 0.6);
  ctx.lineTo(rr * 0.12, cy + rr * 0.34);
  ctx.lineTo(-rr * 0.12, cy + rr * 0.6);
  ctx.lineTo(-rr * 0.34, cy + rr * 0.34);
  ctx.closePath();
  ctx.fill();
}

// Ролики под ногами. Рисуются рядом с каской и тросточкой — деталь поверх
// обычного силуэта, а не свой силуэт.
function drawSkates(ctx, r, walkPhase, color) {
  const step = 0;   // ноги ролика не шагают (stride: 0), платформы стоят рядом
  const bump = Math.sin(walkPhase * 3) * r * 0.02;
  [-r * 0.42, r * 0.1].forEach((x) => {
    ctx.fillStyle = color;
    roundRect(ctx, x + step - r * 0.04, r * 1.02 + bump, r * 0.42, r * 0.12, r * 0.05);
    ctx.fillStyle = '#2f3550';
    [0.06, 0.3].forEach((k) => {
      circle(ctx, x + step + r * k, r * 1.2 + bump, r * 0.07);
    });
  });
}

// 🎈 Зомби-шарик: надутая голова на ниточке, тельце болтается снизу.
function drawBalloonZombie(ctx, {
  radius, walkPhase, facing, hurtFlash, look, burning, frozen,
  freezeProgress = 0, freezeSeed = 0,
}) {
  const r = radius;
  let balloon = hurtFlash ? '#ffffff' : look.balloon;
  let skin = hurtFlash ? '#ffffff' : look.skin;
  let clothes = hurtFlash ? '#dddddd' : look.clothes;
  if (!hurtFlash && frozen) {
    balloon = tint(balloon, '#7fd8ff', 0.3);
    skin = tint(skin, '#7fd8ff', 0.3);
    clothes = tint(clothes, '#7fd8ff', 0.25);
  } else if (!hurtFlash && burning) {
    balloon = tint(balloon, '#ff7a2b', 0.4);
  }

  ctx.save();
  // Вся фигура поднята и покачивается — от того же walkPhase, что у всех:
  // отдельный таймер тут был бы лишней сущностью.
  ctx.translate(0, -r * 0.5 + Math.sin(walkPhase * 0.9) * r * 0.12);
  ctx.scale(facing, 1);

  // Тельце-огрызок на ниточке: ножки не шагают, а качаются
  const swing = Math.sin(walkPhase) * 0.25;
  ctx.strokeStyle = 'rgba(60,50,40,0.6)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.08);
  ctx.quadraticCurveTo(Math.sin(walkPhase) * r * 0.12, r * 0.4, 0, r * 0.62);
  ctx.stroke();

  ctx.save();
  ctx.translate(0, r * 0.62);
  ctx.rotate(swing);
  ctx.fillStyle = clothes;
  roundRect(ctx, -r * 0.26, 0, r * 0.52, r * 0.44, r * 0.16);
  ctx.fillStyle = shade(look.skin, -0.18);
  roundRect(ctx, -r * 0.22, r * 0.42, r * 0.18, r * 0.34, r * 0.08);
  roundRect(ctx, r * 0.04, r * 0.42, r * 0.18, r * 0.34, r * 0.08);
  ctx.restore();

  // Сам шар с узелком и бликом
  ctx.fillStyle = balloon;
  circle(ctx, 0, -r * 0.42, r * 0.72);
  ctx.beginPath();
  ctx.moveTo(-r * 0.12, r * 0.24);
  ctx.lineTo(r * 0.12, r * 0.24);
  ctx.lineTo(0, r * 0.44);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.26, -r * 0.66, r * 0.18, r * 0.26, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Рожица прямо на шаре
  ctx.fillStyle = EYE_WHITE;
  circle(ctx, -r * 0.2, -r * 0.5, r * 0.16);
  circle(ctx, r * 0.2, -r * 0.47, r * 0.13);
  ctx.fillStyle = DARK;
  circle(ctx, -r * 0.15, -r * 0.5, r * 0.07);
  circle(ctx, r * 0.24, -r * 0.45, r * 0.06);
  ctx.strokeStyle = DARK;
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.beginPath();
  ctx.arc(0, -r * 0.24, r * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  ctx.restore();

  if (burning) drawFlames(ctx, r, walkPhase);
  if (frozen) drawIceBlock(ctx, r, freezeProgress, freezeSeed);
}

// ☃️ Зомби-снеговик: три шара, ведро вместо шапки, веточки вместо рук.
function drawSnowZombie(ctx, {
  radius, walkPhase, facing, hurtFlash, look, burning, frozen,
  freezeProgress = 0, freezeSeed = 0,
}) {
  const r = radius;
  let snow = hurtFlash ? '#ffffff' : look.skin;
  if (!hurtFlash && frozen) snow = tint(snow, '#7fd8ff', 0.3);
  else if (!hurtFlash && burning) snow = tint(snow, '#ff7a2b', 0.35);

  ctx.save();
  // Снеговик не шагает — он переваливается вокруг нижнего шара.
  ctx.translate(0, r * 0.62);
  ctx.rotate(Math.sin(walkPhase) * 0.1);
  ctx.translate(0, -r * 0.62);
  ctx.scale(facing, 1);

  // Веточки-руки
  ctx.strokeStyle = hurtFlash ? '#dddddd' : look.twigs;
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.32, -r * 0.1);
    ctx.lineTo(side * r * 0.95, -r * 0.36);
    ctx.moveTo(side * r * 0.75, -r * 0.26);
    ctx.lineTo(side * r * 0.92, -r * 0.06);
    ctx.stroke();
  });

  ctx.fillStyle = snow;
  circle(ctx, 0, r * 0.5, r * 0.62);
  circle(ctx, 0, -r * 0.16, r * 0.46);
  circle(ctx, 0, -r * 0.78, r * 0.36);

  // Пуговицы-угольки
  ctx.fillStyle = DARK;
  circle(ctx, 0, -r * 0.24, r * 0.07);
  circle(ctx, 0, r * 0.06, r * 0.07);
  circle(ctx, 0, r * 0.42, r * 0.07);

  // Глаза-угольки и морковка
  circle(ctx, -r * 0.14, -r * 0.86, r * 0.08);
  circle(ctx, r * 0.13, -r * 0.84, r * 0.07);
  ctx.fillStyle = hurtFlash ? '#ffffff' : look.nose;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.76);
  ctx.lineTo(r * 0.46, -r * 0.68);
  ctx.lineTo(0, -r * 0.62);
  ctx.closePath();
  ctx.fill();

  // Кривая ухмылка из угольков
  ctx.fillStyle = DARK;
  [-0.22, -0.08, 0.08, 0.22].forEach((k, i) => {
    circle(ctx, r * k, -r * (0.54 - Math.abs(i - 1.5) * 0.03), r * 0.04);
  });

  if (look.bucket) {
    ctx.fillStyle = hurtFlash ? '#ffffff' : look.bucket;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 1.02);
    ctx.lineTo(r * 0.3, -r * 1.02);
    ctx.lineTo(r * 0.22, -r * 1.5);
    ctx.lineTo(-r * 0.22, -r * 1.5);
    ctx.closePath();
    ctx.fill();
    roundRect(ctx, -r * 0.36, -r * 1.08, r * 0.72, r * 0.12, r * 0.04);
  }

  ctx.restore();

  if (burning) drawFlames(ctx, r, walkPhase);
  if (frozen) drawIceBlock(ctx, r, freezeProgress, freezeSeed);
}

// Холмик земли: крот под землёй, виден только след
export function drawMoleMound(ctx, { radius, progress }) {
  const w = radius * (1.2 + progress * 0.5);
  ctx.fillStyle = 'rgba(110, 90, 70, 0.85)';
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.5, w, w * 0.42, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(80, 64, 50, 0.9)';
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.5, w * 0.55, w * 0.22, 0, Math.PI, Math.PI * 2);
  ctx.fill();
}

// Дымка на месте ниндзя. Держится всю burrowTime и за это время редеет и
// расходится — ребёнок должен успеть понять, что сейчас кто-то выпрыгнет.
export function drawSmokePuff(ctx, { radius, progress }) {
  const spread = radius * (0.7 + progress * 0.9);
  ctx.save();
  // Клубы по кругу, каждый со своим смещением фазы — иначе это одно пятно.
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + progress * 1.2;
    const dist = spread * (0.35 + (i % 2) * 0.35);
    ctx.fillStyle = `rgba(226, 232, 240, ${0.55 * (1 - progress)})`;
    circle(ctx, Math.cos(angle) * dist, Math.sin(angle) * dist * 0.6 + radius * 0.2,
      radius * (0.5 - progress * 0.2));
  }
  ctx.restore();
}

// --- Камень ---
//
// Голем не отличается от прочих ничем, кроме ФОРМЫ: серая заливка на круглом
// силуэте читается как «серый зомби», а не как камень. Поэтому у него те же
// части тела, но нарисованные неровными глыбами.
//
// Обе функции повторяют сигнатуры roundRect и circle — это и позволяет
// подменить их одной строкой, не переписывая рисовку тела целиком.

// Псевдослучайность, привязанная к координатам: forma одной и той же глыбы
// обязана быть одинаковой в каждом кадре, иначе камень кипит.
function chip(seed) {
  return (Math.sin(seed * 127.1) * 43758.5453) % 1;
}

export function rockRect(ctx, x, y, w, h) {
  const pts = [
    [x, y], [x + w * 0.45, y], [x + w, y],
    [x + w, y + h * 0.5], [x + w, y + h],
    [x + w * 0.5, y + h], [x, y + h], [x, y + h * 0.45],
  ];
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    const j = Math.min(w, h) * 0.12;
    const nx = px + chip(px + py + i) * j;
    const ny = py + chip(px * 2 - py + i) * j;
    if (i === 0) ctx.moveTo(nx, ny); else ctx.lineTo(nx, ny);
  });
  ctx.closePath();
  ctx.fill();
}

export function rockBlob(ctx, cx, cy, r) {
  // Восемь граней и умеренный разброс: на семи с большим разбросом макушка
  // вытягивалась в остриё и читалась колпаком, а не сколом.
  const sides = 8;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const rad = r * (1 + chip(cx + cy + i * 7) * 0.13);
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// Трещины и сколы. Толстые и через всё тело: тонкие царапины на игровом
// размере пропадают, а именно они и делают фигуру каменной.
export function drawCracks(ctx, r, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, r * 0.075);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  [[-0.34, -0.34, 1], [0.26, -0.18, -1], [-0.1, 0.12, 1]].forEach(([x0, y0, dir], i) => {
    ctx.beginPath();
    ctx.moveTo(r * x0, r * y0);
    ctx.lineTo(r * (x0 + dir * 0.16), r * (y0 + 0.2));
    ctx.lineTo(r * (x0 - dir * 0.04), r * (y0 + 0.44));
    ctx.stroke();
  });
  // Светлый скол сверху: камень не бывает одного тона, и блик даёт объём.
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(-r * 0.34, -r * 0.3);
  ctx.lineTo(r * 0.1, -r * 0.36);
  ctx.lineTo(-r * 0.02, -r * 0.12);
  ctx.closePath();
  ctx.fill();
}

// Ширина туловища по типу телосложения — так толстяк и шустрик
// отличаются силуэтом, а не только цветом.
const BODY_WIDTH = { thin: 0.72, normal: 1.0, fat: 1.34 };

// --- Зомби. Вид задаётся объектом look из CONFIG.zombieTypes ---
export function drawZombie(ctx, {
  radius, walkPhase, facing, hurtFlash, look, burning, frozen,
  freezeProgress = 0, freezeSeed = 0,
}) {
  // Зомби-животные устроены иначе — четыре лапы и горизонтальное тело,
  // общего с человеческим силуэтом у них почти ничего нет.
  if (look.shape === 'beast') {
    drawBeastZombie(ctx, {
      radius, walkPhase, facing, hurtFlash, look, burning, frozen,
      freezeProgress, freezeSeed,
    });
    return;
  }
  // Шарик и снеговик — тоже свои силуэты: натягивать человеческое тело на
  // три снежных шара дороже, чем завести ветку.
  if (look.shape === 'balloon' || look.shape === 'snow') {
    const draw = look.shape === 'balloon' ? drawBalloonZombie : drawSnowZombie;
    draw(ctx, {
      radius, walkPhase, facing, hurtFlash, look, burning, frozen,
      freezeProgress, freezeSeed,
    });
    return;
  }

  const r = radius;
  // lean — постоянный наклон вперёд: так ролик читается как «разогнался».
  const tilt = Math.sin(walkPhase) * 0.14 + (look.lean ?? 0);
  const width = BODY_WIDTH[look.body] || 1;

  ctx.save();
  ctx.rotate(tilt);
  ctx.scale(facing, 1);

  // Замороженный синеет, горящий краснеет — статус виден без подписей.
  let skin = hurtFlash ? '#ffffff' : look.skin;
  let clothes = hurtFlash ? '#dddddd' : look.clothes;
  if (!hurtFlash && frozen) {
    // Тонируем слабо: сильный голубой + полупрозрачный лёд поверх — и зомби
    // сливается с глыбой, становится непонятно, кого заморозили
    skin = tint(skin, '#7fd8ff', 0.3);
    clothes = tint(clothes, '#7fd8ff', 0.25);
  } else if (!hurtFlash && burning) {
    skin = tint(skin, '#ff7a2b', 0.4);
  }

  // Голем сложен из тех же частей, но глыбами вместо скруглённых форм:
  // сигнатуры совпадают, поэтому хватает подмены двух имён.
  const block = look.stone ? rockRect : roundRect;
  const lump = look.stone ? rockBlob : circle;

  // Ноги. stride: 0 — ноги стоят вместе и не шагают: ролик катится, а не идёт.
  const step = Math.sin(walkPhase) * r * 0.35 * (look.stride ?? 1);
  ctx.fillStyle = hurtFlash ? '#eeeeee' : shade(look.skin, -0.18);
  block(ctx, -r * 0.42 + step, r * 0.45, r * 0.32, r * 0.6, r * 0.12);
  block(ctx, r * 0.1 - step, r * 0.45, r * 0.32, r * 0.6, r * 0.12);

  // Рваная рубаха
  ctx.fillStyle = clothes;
  block(ctx, -r * 0.48 * width, -r * 0.35, r * 0.96 * width, r * 0.9, r * 0.2);

  // Руки вытянуты вперёд — классика
  ctx.fillStyle = skin;
  block(ctx, r * 0.2 * width, -r * 0.25, r * 0.85, r * 0.24, r * 0.12);
  block(ctx, r * 0.2 * width, r * 0.05, r * 0.85, r * 0.24, r * 0.12);

  // Голова. У тыквы она своя целиком — тело, ноги и руки при этом обычные,
  // поэтому отдельной ветки shape ей не нужно.
  if (look.head === 'pumpkin') {
    drawPumpkinHead(ctx, r, hurtFlash ? '#ffffff' : look.headColor);
  } else {
    ctx.fillStyle = skin;
    lump(ctx, 0, -r * 0.8, r * 0.5);

    drawZombieHair(ctx, r, look, hurtFlash);

    // Глаза «в кучку» — разного размера, смотрят в разные стороны
    ctx.fillStyle = EYE_WHITE;
    circle(ctx, -r * 0.18, -r * 0.85, r * 0.17);
    circle(ctx, r * 0.19, -r * 0.82, r * 0.13);
    ctx.fillStyle = DARK;
    circle(ctx, -r * 0.12, -r * 0.85, r * 0.07);
    circle(ctx, r * 0.14, -r * 0.79, r * 0.06);

    // Кривая ухмылка с одним зубом
    ctx.strokeStyle = DARK;
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(-r * 0.18, -r * 0.55);
    ctx.quadraticCurveTo(0, -r * 0.42, r * 0.2, -r * 0.58);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, -r * 0.06, -r * 0.58, r * 0.11, r * 0.15, r * 0.03);
  }

  if (look.cracks) drawCracks(ctx, r, look.cracks);
  if (look.mask) drawNinjaMask(ctx, r, look.mask);
  if (look.skates) drawSkates(ctx, r, walkPhase, look.skates);
  if (look.beard) drawBeard(ctx, r, hurtFlash ? '#ffffff' : look.beard);
  if (look.cane) drawCane(ctx, r, walkPhase, hurtFlash ? '#dddddd' : look.cane);
  if (look.helmet) drawHelmet(ctx, r, hurtFlash ? '#ffffff' : look.helmet);
  if (burning) drawFlames(ctx, r, walkPhase);
  if (frozen) drawIceBlock(ctx, r, freezeProgress, freezeSeed);

  ctx.restore();
}

// Язычки пламени над головой горящего зомби.
function drawFlames(ctx, r, phase) {
  for (let i = -1; i <= 1; i++) {
    const wobble = Math.sin(phase * 4 + i) * r * 0.12;
    const height = r * (0.5 + Math.abs(Math.sin(phase * 5 + i)) * 0.35);
    ctx.fillStyle = 'rgba(255, 138, 43, 0.9)';
    ctx.beginPath();
    ctx.moveTo(i * r * 0.3 - r * 0.14, -r * 1.28);
    ctx.lineTo(i * r * 0.3 + r * 0.14, -r * 1.28);
    ctx.lineTo(i * r * 0.3 + wobble, -r * 1.28 - height);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 217, 61, 0.95)';
    ctx.beginPath();
    ctx.moveTo(i * r * 0.3 - r * 0.06, -r * 1.28);
    ctx.lineTo(i * r * 0.3 + r * 0.06, -r * 1.28);
    ctx.lineTo(i * r * 0.3 + wobble * 0.6, -r * 1.28 - height * 0.6);
    ctx.closePath();
    ctx.fill();
  }
}

// Ледяная корочка вокруг замороженного.
// Ледяная глыба, в которую вморожен зомби. Рисуется ПОВЕРХ него: он должен
// просвечивать сквозь лёд, иначе непонятно, кого заморозили.
//
// progress: 0 — только заморозили, 1 — лёд вот-вот сойдёт (идут трещины).
// seed — фиксируется при заморозке, иначе форма глыбы дёргалась бы каждый кадр.
function drawIceBlock(ctx, r, progress = 0, seed = 0) {
  const cx = 0;
  const cy = -r * 0.35;
  const shape = iceShape(r, seed);

  ctx.save();

  // Тело глыбы: неправильный многоугольник, а не круг — именно ровная
  // окружность и делала прежний эффект дешёвым.
  ctx.beginPath();
  shape.forEach((p, i) => (i ? ctx.lineTo(cx + p.x, cy + p.y) : ctx.moveTo(cx + p.x, cy + p.y)));
  ctx.closePath();
  ctx.fillStyle = 'rgba(150, 220, 255, 0.28)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(220, 248, 255, 0.9)';
  ctx.lineWidth = Math.max(1.5, r * 0.09);
  ctx.stroke();

  // Внутренние грани — сколы льда
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy - r * 0.7);
  ctx.lineTo(cx - r * 0.05, cy + r * 0.1);
  ctx.lineTo(cx - r * 0.35, cy + r * 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.55, cy - r * 0.5);
  ctx.lineTo(cx + r * 0.2, cy + r * 0.25);
  ctx.stroke();

  // Блик, как на стекле
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.5, cy - r * 0.6, r * 0.13, r * 0.28, -0.5, 0, Math.PI * 2);
  ctx.fill();

  drawIcicles(ctx, r, cx, cy);
  if (progress > 0.65) drawIceCracks(ctx, r, cx, cy, progress);
  if (progress > 0.85) drawIceShards(ctx, r, cx, cy, progress);

  ctx.restore();
}

// Вершины глыбы. Разброс детерминированный — от seed, а не от Math.random,
// иначе форма менялась бы каждый кадр.
function iceShape(r, seed) {
  const points = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    // Дешёвый детерминированный шум: синус от индекса и seed
    const noise = 0.82 + Math.abs(Math.sin(seed + i * 2.399)) * 0.36;
    points.push({
      x: Math.cos(angle) * r * 1.25 * noise,
      y: Math.sin(angle) * r * 1.45 * noise,
    });
  }
  return points;
}

function drawIcicles(ctx, r, cx, cy) {
  ctx.fillStyle = 'rgba(225, 250, 255, 0.9)';
  [-0.55, -0.15, 0.3, 0.65].forEach((offset, i) => {
    const x = cx + offset * r;
    const top = cy + r * 1.1;
    const len = r * (0.3 + (i % 3) * 0.16);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.11, top);
    ctx.lineTo(x + r * 0.11, top);
    ctx.lineTo(x, top + len);
    ctx.closePath();
    ctx.fill();
  });
}

// Трещины появляются в последней трети заморозки: ребёнок видит, что зомби
// вот-вот освободится, и успевает отбежать.
function drawIceCracks(ctx, r, cx, cy, progress) {
  const t = (progress - 0.65) / 0.35;         // 0..1 внутри фазы трещин
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + t * 0.5})`;
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.lineJoin = 'round';

  const cracks = 1 + Math.round(t * 2);        // чем ближе к концу, тем больше
  for (let i = 0; i < cracks; i++) {
    const angle = -Math.PI / 2 + i * 2.1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * r * 0.5, cy + Math.sin(angle) * r * 0.55);
    ctx.lineTo(cx + Math.cos(angle + 0.5) * r * 0.85, cy + Math.sin(angle + 0.5) * r * 0.95);
    ctx.lineTo(cx + Math.cos(angle + 0.2) * r * 1.15, cy + Math.sin(angle + 0.2) * r * 1.3);
    ctx.stroke();
  }
}

// Осколки отваливаются и сползают вниз — лёд осыпается.
function drawIceShards(ctx, r, cx, cy, progress) {
  const t = (progress - 0.85) / 0.15;
  ctx.fillStyle = `rgba(235, 252, 255, ${1 - t * 0.5})`;
  ctx.strokeStyle = `rgba(120, 190, 225, ${0.8 - t * 0.4})`;
  ctx.lineWidth = Math.max(1, r * 0.04);
  for (let i = 0; i < 5; i++) {
    const angle = i * 1.35;
    const drift = t * r * 0.8;
    // Осколки не только падают, но и отлетают в стороны
    const x = cx + Math.cos(angle) * r * (1.15 + t * 0.5);
    const y = cy + Math.sin(angle) * r * 1.2 + drift;
    const size = r * 0.24;
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y - size * 0.4);
    ctx.lineTo(x + size * 0.3, y + size);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

// Смешивание цвета с оттенком: amount 0 — исходный, 1 — полностью оттенок.
function tint(hexColor, tintColor, amount) {
  const parse = (hex) => {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  };
  const base = parse(hexColor);
  const over = parse(tintColor);
  const mixed = base.map((v, i) => Math.round(v + (over[i] - v) * amount));
  return `rgb(${mixed.join(',')})`;
}

function drawZombieHair(ctx, r, look, hurtFlash) {
  if (!look.hair) return;
  ctx.fillStyle = hurtFlash ? '#ffffff' : shade(look.skin, -0.35);

  if (look.hair === 'bald') {
    // Лысина с двумя кустиками над ушами — дедовская классика
    ctx.fillStyle = hurtFlash ? '#ffffff' : '#dfe3e0';
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.ellipse(side * r * 0.42, -r * 0.95, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    return;
  }

  if (look.hair === 'spiky') { // взъерошенные вихры шустрика
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.16 - r * 0.06, -r * 1.15);
      ctx.lineTo(i * r * 0.16 + r * 0.06, -r * 1.15);
      ctx.lineTo(i * r * 0.16, -r * 1.5);
      ctx.closePath();
      ctx.fill();
    }
  } else if (look.hair === 'bun') { // пучок бабули
    circle(ctx, 0, -r * 1.32, r * 0.24);
    ctx.beginPath();
    ctx.arc(0, -r * 0.86, r * 0.51, Math.PI * 1.05, Math.PI * 2.0);
    ctx.fill();
  }
}

// Седая борода клинышком — вместе с лысиной делает деда узнаваемым.
function drawBeard(ctx, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.62);
  ctx.quadraticCurveTo(-r * 0.34, -r * 0.05, 0, r * 0.12);
  ctx.quadraticCurveTo(r * 0.34, -r * 0.05, r * 0.3, -r * 0.62);
  ctx.quadraticCurveTo(0, -r * 0.42, -r * 0.3, -r * 0.62);
  ctx.closePath();
  ctx.fill();
}

// Тросточка: дед опирается на неё и постукивает в такт шагам.
function drawCane(ctx, r, walkPhase, color) {
  const tap = Math.sin(walkPhase) * r * 0.12;   // постукивание в такт ходьбе
  const topX = r * 0.95;
  const topY = -r * 0.05;
  const bottomY = r * 1.05 + tap;

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.11);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.lineTo(topX + r * 0.12, bottomY);
  ctx.stroke();

  // Загнутая ручка
  ctx.beginPath();
  ctx.arc(topX - r * 0.13, topY, r * 0.14, Math.PI * 1.75, Math.PI * 0.75, true);
  ctx.stroke();
}

// Строительная каска — зомби в ней заметно крепче.
// Маска ниндзя: повязка на лбу с хвостами и закрытая нижняя половина лица.
// Глаза намеренно остаются открытыми — именно кривые разнокалиберные глаза
// делают зомби зомби, и прятать их нельзя. Заодно рисуется ПОСЛЕ ухмылки,
// то есть закрывает её.
function drawNinjaMask(ctx, r, color) {
  ctx.save();
  // Обрезаем по кругу головы, иначе повязка торчит за щёки прямоугольником.
  ctx.beginPath();
  ctx.arc(0, -r * 0.8, r * 0.5, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = color;
  // Накладка начинается ниже глаз: нижние края зрачков лежат на -0.68r, и
  // всё, что выше, обязано остаться видимым.
  ctx.fillRect(-r * 0.55, -r * 0.66, r * 1.1, r * 0.55);
  ctx.restore();

  ctx.fillStyle = color;
  // Повязка сидит высоко на лбу — так между ней и накладкой остаётся широкая
  // щель для глаз. Прижатая ниже, она превращала лицо в сплошное пятно.
  roundRect(ctx, -r * 0.5, -r * 1.16, r * 1.0, r * 0.14, r * 0.06);
  // Хвосты повязки уходят назад — в ту же сторону, что и волосы-ёжик.
  ctx.beginPath();
  ctx.moveTo(-r * 0.42, -r * 1.12);
  ctx.quadraticCurveTo(-r * 0.85, -r * 1.04, -r * 1.02, -r * 0.74);
  ctx.lineTo(-r * 0.84, -r * 0.8);
  ctx.quadraticCurveTo(-r * 0.72, -r * 1.0, -r * 0.42, -r * 0.98);
  ctx.closePath();
  ctx.fill();
}

function drawHelmet(ctx, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -r * 1.0, r * 0.52, Math.PI, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, -r * 0.62, -r * 1.04, r * 1.24, r * 0.14, r * 0.06);
}

// Осветление/затемнение цвета: amount от -1 (чёрный) до 1 (белый).
function shade(hexColor, amount) {
  const hex = hexColor.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const channels = [0, 2, 4].map((i) => {
    const value = parseInt(full.slice(i, i + 2), 16);
    const shifted = amount < 0 ? value * (1 + amount) : value + (255 - value) * amount;
    return Math.round(Math.min(255, Math.max(0, shifted)));
  });
  return `rgb(${channels.join(',')})`;
}

// --- Босс: огромный зомби в цилиндре и с бабочкой ---
export function drawBoss(ctx, {
  radius, walkPhase, facing, hurtFlash, look = BOSS_DEFAULT_LOOK,
  burning, frozen, freezeProgress = 0, freezeSeed = 0, armUp = false,
}) {
  const r = radius;
  const tilt = Math.sin(walkPhase * 0.7) * 0.1;

  ctx.save();
  ctx.rotate(tilt);
  ctx.scale(facing, 1);

  // Стихийные статусы босс получает наравне с зомби, поэтому и показываем их
  // так же: тонировка плюс пламя или льдина поверх.
  let skin = hurtFlash ? '#ffffff' : look.skin;
  let clothes = hurtFlash ? '#dddddd' : look.clothes;
  if (!hurtFlash && frozen) {
    skin = tint(skin, '#7fd8ff', 0.3);
    clothes = tint(clothes, '#7fd8ff', 0.25);
  } else if (!hurtFlash && burning) {
    skin = tint(skin, '#ff7a2b', 0.4);
  }

  // Что уходит за спину (лапки паука) — до ног, иначе окажется поверх.
  if (look.back) drawBossBack(ctx, r, look);

  // Каменный босс собирается теми же частями, но глыбами — см. rockRect.
  const block = look.stone ? rockRect : roundRect;
  const lump = look.stone ? rockBlob : circle;

  // Ноги
  const step = Math.sin(walkPhase * 0.7) * r * 0.2;
  ctx.fillStyle = hurtFlash ? '#eeeeee' : shade(look.skin, -0.2);
  block(ctx, -r * 0.4 + step, r * 0.5, r * 0.34, r * 0.55, r * 0.12);
  block(ctx, r * 0.06 - step, r * 0.5, r * 0.34, r * 0.55, r * 0.12);

  // Пузо в жилетке
  ctx.fillStyle = clothes;
  lump(ctx, 0, r * 0.1, r * 0.62);

  if (look.cracks) drawCracks(ctx, r, look.cracks);
  drawBossChest(ctx, r, look, facing);

  // Руки. У командира верхняя уходит вверх — это и телеграф приказа.
  ctx.fillStyle = skin;
  if (armUp) {
    ctx.save();
    ctx.translate(r * 0.3, -r * 0.2);
    ctx.rotate(-1.15);
    roundRect(ctx, 0, 0, r * 0.8, r * 0.26, r * 0.13);
    ctx.restore();
  } else {
    block(ctx, r * 0.3, -r * 0.2, r * 0.8, r * 0.26, r * 0.13);
  }
  block(ctx, r * 0.3, r * 0.15, r * 0.8, r * 0.26, r * 0.13);

  // Голова
  ctx.fillStyle = skin;
  lump(ctx, 0, -r * 0.72, r * 0.48);

  // Головной убор — в слое головы, до глаз и лица: капюшон охранника
  // обрамляет лицо, и маска обязана лечь поверх него. Остальные уборы сидят
  // выше головы, порядок их не задевает.
  drawBossHat(ctx, r, look);

  // Глаза
  ctx.fillStyle = '#ffffff';
  circle(ctx, -r * 0.17, -r * 0.78, r * 0.16);
  circle(ctx, r * 0.18, -r * 0.75, r * 0.13);
  ctx.fillStyle = '#243b12';
  circle(ctx, -r * 0.11, -r * 0.78, r * 0.07);
  circle(ctx, r * 0.13, -r * 0.73, r * 0.06);

  const faceCovered = look.face ? drawBossFace(ctx, r, look) : false;

  // Улыбка до ушей — но не поверх маски, закрывающей лицо целиком.
  if (!faceCovered) {
    ctx.strokeStyle = '#243b12';
    ctx.lineWidth = Math.max(2, r * 0.05);
    ctx.beginPath();
    ctx.arc(0, -r * 0.62, r * 0.24, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  // Пламя и лёд считаются от радиуса, так что на крупном боссе выглядят так же
  // уместно, как на обычном зомби.
  if (burning) drawFlames(ctx, r, walkPhase);
  if (frozen) drawIceBlock(ctx, r, freezeProgress, freezeSeed);

  ctx.restore();
}

// Деталь на груди босса. Раньше бабочка рисовалась всем пятерым, но атлет
// в бабочке выглядит нелепо — теперь это настраиваемое поле look.chest.
function drawBossChest(ctx, r, look, facing) {
  switch (look.chest) {
    case 'ribs': {   // нарисованные рёбра на пузе
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = Math.max(2, r * 0.06);
      [-0.16, 0.04, 0.24].forEach((k) => {
        ctx.beginPath();
        ctx.arc(0, r * k, r * 0.34, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      });
      break;
    }
    case 'pompoms': {
      ctx.fillStyle = '#4fb3ff';
      circle(ctx, -r * 0.2, r * 0.02, r * 0.16);
      ctx.fillStyle = '#ffd93d';
      circle(ctx, r * 0.2, r * 0.12, r * 0.16);
      break;
    }
    case 'belt': {   // простой пояс с пряжкой — на комбинезоне больше ничего
      ctx.fillStyle = '#2b2b3d';
      roundRect(ctx, -r * 0.5, r * 0.26, r * 1, r * 0.16, r * 0.05);
      ctx.fillStyle = look.accent;
      roundRect(ctx, -r * 0.1, r * 0.24, r * 0.2, r * 0.2, r * 0.05);
      break;
    }
    case 'badge': {  // жетон-звезда и погоны
      ctx.fillStyle = look.accent;
      drawStarShape(ctx, -r * 0.24, r * 0.02, r * 0.14, 5);
      roundRect(ctx, r * 0.06, -r * 0.3, r * 0.34, r * 0.1, r * 0.03);
      roundRect(ctx, r * 0.06, -r * 0.14, r * 0.34, r * 0.1, r * 0.03);
      break;
    }
    case 'spider': { // паучок на пузе
      ctx.fillStyle = '#2b2b3d';
      circle(ctx, 0, r * 0.08, r * 0.14);
      ctx.strokeStyle = '#2b2b3d';
      ctx.lineWidth = Math.max(1.5, r * 0.04);
      [-1, 1].forEach((side) => {
        [-0.1, 0.06, 0.22].forEach((k) => {
          ctx.beginPath();
          ctx.moveTo(side * r * 0.1, r * (0.08 + k * 0.3));
          ctx.lineTo(side * r * 0.3, r * (0.02 + k));
          ctx.stroke();
        });
      });
      break;
    }
    case 'bolt': {   // зигзаг-молния
      ctx.fillStyle = look.accent;
      ctx.beginPath();
      ctx.moveTo(r * 0.06, -r * 0.28);
      ctx.lineTo(-r * 0.16, r * 0.06);
      ctx.lineTo(0, r * 0.06);
      ctx.lineTo(-r * 0.08, r * 0.4);
      ctx.lineTo(r * 0.2, -r * 0.02);
      ctx.lineTo(r * 0.04, -r * 0.02);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'number': {
      // Номер участника на майке. scale(facing) компенсирует зеркальный
      // поворот персонажа, иначе на бегу влево цифра будет задом наперёд.
      ctx.save();
      ctx.scale(facing, 1);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(r * 0.5)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(look.chestText ?? '1', 0, r * 0.05);
      ctx.restore();
      break;
    }
    case 'none':
      break;
    case 'bowtie':
    default: {
      ctx.fillStyle = look.accent;
      ctx.beginPath();
      ctx.moveTo(-r * 0.22, -r * 0.42);
      ctx.lineTo(0, -r * 0.3);
      ctx.lineTo(r * 0.22, -r * 0.42);
      ctx.lineTo(r * 0.22, -r * 0.18);
      ctx.lineTo(0, -r * 0.3);
      ctx.lineTo(-r * 0.22, -r * 0.18);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}

// Запасная внешность босса, если тип почему-то не передали.
const BOSS_DEFAULT_LOOK = {
  skin: '#7cc766', clothes: '#4a4a7a', hat: 'tophat', accent: '#e03b3b',
};

// Головной убор отличает боссов друг от друга сильнее всего — его видно
// первым, даже когда босс ещё на краю экрана.
function drawBossHat(ctx, r, look) {
  switch (look.hat) {
    case 'skullhat': { // запасной череп надет как шапка — нелепо, а не страшно
      ctx.fillStyle = '#f3efe0';
      circle(ctx, 0, -r * 1.28, r * 0.34);
      ctx.fillStyle = '#3b3b46';
      circle(ctx, -r * 0.12, -r * 1.3, r * 0.08);
      circle(ctx, r * 0.12, -r * 1.3, r * 0.08);
      ctx.fillStyle = '#f3efe0';
      roundRect(ctx, -r * 0.18, -r * 1.14, r * 0.36, r * 0.12, r * 0.04);
      break;
    }
    case 'wig': { // рыжие кудри и крошечный котелок с цветком
      ctx.fillStyle = '#ff8a2b';
      [-0.42, 0.42].forEach((k) => circle(ctx, r * k, -r * 0.94, r * 0.26));
      circle(ctx, 0, -r * 1.06, r * 0.22);
      ctx.fillStyle = '#2b2b3d';
      roundRect(ctx, -r * 0.3, -r * 1.24, r * 0.6, r * 0.08, r * 0.03);
      roundRect(ctx, -r * 0.2, -r * 1.48, r * 0.4, r * 0.26, r * 0.06);
      ctx.fillStyle = '#4fb3ff';
      circle(ctx, r * 0.28, -r * 1.32, r * 0.1);
      break;
    }
    case 'hood': { // капюшон комбинезона: обтягивает голову, лицо в маске
      ctx.fillStyle = look.clothes;
      ctx.beginPath();
      ctx.arc(0, -r * 0.72, r * 0.62, Math.PI * 1.05, Math.PI * 1.95);
      ctx.lineTo(r * 0.5, -r * 0.34);
      ctx.quadraticCurveTo(0, -r * 0.16, -r * 0.5, -r * 0.34);
      ctx.closePath();
      ctx.fill();
      // Из-под капюшона торчит зелёный вихор — он всё-таки зомби
      ctx.fillStyle = shade(look.skin, -0.15);
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.9);
      ctx.lineTo(-r * 0.72, -r * 1.06);
      ctx.lineTo(-r * 0.44, -r * 1.02);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'peakedcap': { // фуражка: тёмный околыш, синяя тулья, жёлтая кокарда
      ctx.fillStyle = '#2f4c85';
      ctx.beginPath();
      ctx.ellipse(0, -r * 1.14, r * 0.52, r * 0.3, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22355e';
      roundRect(ctx, -r * 0.54, -r * 1.16, r * 1.08, r * 0.12, r * 0.04);
      // Козырёк вперёд — по нему фуражка и отличается от каски «Каскетки»
      ctx.beginPath();
      ctx.ellipse(r * 0.36, -r * 1.06, r * 0.34, r * 0.11, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = look.accent;
      drawStarShape(ctx, 0, -r * 1.24, r * 0.11, 5);
      break;
    }
    case 'beanie': { // вязаная шапочка с помпоном
      ctx.fillStyle = '#c94f8a';
      ctx.beginPath();
      ctx.arc(0, -r * 1.02, r * 0.44, Math.PI, Math.PI * 2);
      ctx.fill();
      roundRect(ctx, -r * 0.46, -r * 1.06, r * 0.92, r * 0.12, r * 0.05);
      ctx.fillStyle = '#ffd93d';
      circle(ctx, 0, -r * 1.56, r * 0.14);
      break;
    }
    case 'bulb': { // лампочка на пружинке
      ctx.strokeStyle = '#8a8a9c';
      ctx.lineWidth = Math.max(2, r * 0.06);
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.1);
      ctx.quadraticCurveTo(r * 0.2, -r * 1.3, 0, -r * 1.46);
      ctx.stroke();
      ctx.fillStyle = '#fff36b';
      circle(ctx, 0, -r * 1.62, r * 0.2);
      ctx.fillStyle = '#8a8a9c';
      roundRect(ctx, -r * 0.09, -r * 1.5, r * 0.18, r * 0.12, r * 0.03);
      break;
    }
    case 'tophat': { // цилиндр с лентой
      ctx.fillStyle = '#2b2b3d';
      roundRect(ctx, -r * 0.55, -r * 1.14, r * 1.1, r * 0.1, r * 0.04);
      roundRect(ctx, -r * 0.32, -r * 1.62, r * 0.64, r * 0.5, r * 0.05);
      ctx.fillStyle = look.accent;
      roundRect(ctx, -r * 0.32, -r * 1.26, r * 0.64, r * 0.12, r * 0.03);
      break;
    }
    case 'bun': { // пучок с бантом — мама-зомби
      ctx.fillStyle = shade(look.skin, -0.35);
      circle(ctx, 0, -r * 1.34, r * 0.3);
      ctx.beginPath();
      ctx.arc(0, -r * 0.78, r * 0.5, Math.PI * 1.05, Math.PI * 2.0);
      ctx.fill();
      ctx.fillStyle = look.accent;
      circle(ctx, -r * 0.26, -r * 1.32, r * 0.14);
      circle(ctx, r * 0.26, -r * 1.32, r * 0.14);
      break;
    }
    case 'cap': { // кепка козырьком вперёд — спортсмен
      ctx.fillStyle = look.accent;
      ctx.beginPath();
      ctx.arc(0, -r * 1.06, r * 0.5, Math.PI, Math.PI * 2);
      ctx.fill();
      roundRect(ctx, r * 0.1, -r * 1.12, r * 0.72, r * 0.12, r * 0.05);
      break;
    }
    case 'headband': { // повязка на лбу — бегун
      const color = look.headbandColor || look.accent;
      ctx.fillStyle = color;
      // Лента поперёк лба
      roundRect(ctx, -r * 0.54, -r * 1.06, r * 1.08, r * 0.2, r * 0.06);
      // Узелок сбоку и два хвостика, отлетающих назад
      circle(ctx, -r * 0.56, -r * 0.96, r * 0.1);
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 1.0);
      ctx.lineTo(-r * 1.05, -r * 1.16);
      ctx.lineTo(-r * 0.98, -r * 0.94);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.92);
      ctx.lineTo(-r * 1.02, -r * 0.82);
      ctx.lineTo(-r * 0.86, -r * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'crown': { // корона — стихийные боссы
      ctx.fillStyle = look.accent;
      ctx.beginPath();
      ctx.moveTo(-r * 0.46, -r * 1.06);
      ctx.lineTo(-r * 0.46, -r * 1.5);
      ctx.lineTo(-r * 0.2, -r * 1.24);
      ctx.lineTo(0, -r * 1.62);
      ctx.lineTo(r * 0.2, -r * 1.24);
      ctx.lineTo(r * 0.46, -r * 1.5);
      ctx.lineTo(r * 0.46, -r * 1.06);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default:
      break;
  }
}

// --- Оружие в руке ---
// Рисуется поверх героя в мировых координатах: общий код разворачивает
// систему координат по углу прицела и отодвигает ствол назад при отдаче,
// а каждая ветка switch рисует оружие «от руки вперёд» вдоль оси X.
export function drawWeaponInHand(ctx, { id, stars, angle, recoil, x, y, radius }) {
  const draw = WEAPON_IN_HAND[id];
  if (!draw) return;                       // у вертушки и лазера в руке ничего нет

  // Чем больше звёзд, тем крупнее ствол — заметно, что оружие прокачано
  // В бою герой мелкий (радиус ~20 px), поэтому ствол берём крупнее, чем
  // кажется правильным на превью: иначе в игре его просто не разглядеть.
  const scale = radius * (0.075 + stars * 0.007);
  const kick = recoil * radius * 0.28;     // отдача: ствол уезжает назад

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Держим ствол на уровне руки и подальше от корпуса: иначе он перекрывает
  // грудь с эмблемой и лицо героя
  ctx.translate(radius * 0.72 - kick, radius * 0.3);
  ctx.scale(scale, scale);
  // Вверх ногами оружие смотреться не должно: при стрельбе влево
  // отражаем его по вертикали, а не разворачиваем целиком
  if (Math.abs(angle) > Math.PI / 2) ctx.scale(1, -1);
  draw(ctx, recoil);
  ctx.restore();
}

const WEAPON_IN_HAND = {
  // Ветки для laser здесь нет намеренно: у лазера, как у вертушки, в руке
  // ничего не держат — глаза светятся на лице, а луч рисует сам класс.

  // 🪃 Бумеранг: галка из двух плеч. Раньше это была одна дуга, и на игровом
  // размере она читалась как банан — у бумеранга обязан быть угол.
  boomerang(ctx, recoil) {
    // Локоть чуть уводит вперёд при броске: замах виден без отдельной анимации.
    const elbow = 3 + recoil * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const arms = () => {
      ctx.beginPath();
      ctx.moveTo(elbow - 10, -7);      // верхнее плечо
      ctx.lineTo(elbow, 0);            // локоть
      ctx.lineTo(elbow - 8, 9);        // нижнее плечо, угол около 100°
    };
    ctx.strokeStyle = '#8a5a24';       // тёмный контур
    ctx.lineWidth = 7;
    arms();
    ctx.stroke();
    ctx.strokeStyle = '#c98b3a';       // дерево
    ctx.lineWidth = 5;
    arms();
    ctx.stroke();
    ctx.strokeStyle = '#f0c079';       // светлая жила вдоль плеч
    ctx.lineWidth = 1.6;
    arms();
    ctx.stroke();
  },

  // 🐝 Рой пчёл: баночка мёда, из которой они вылетают
  bees(ctx, recoil) {
    ctx.fillStyle = '#e0a437';
    roundRect(ctx, -1, -5, 11, 10, 3);
    ctx.fillStyle = '#8b5a2b';
    roundRect(ctx, 0, -7, 9, 3, 1.5);
    ctx.fillStyle = '#3b3b46';
    [[13, -6], [16, -2], [12, 3]].forEach(([bx, by], i) => {
      circle(ctx, bx + recoil * 2, by + Math.sin(i) * 1.5, 1.4);
    });
  },

  // 🕸 Паутиномёт: браслет на запястье с соплом
  web(ctx, recoil) {
    ctx.fillStyle = '#b02525';
    roundRect(ctx, -4, -3.5, 10, 7, 2.5);      // браслет
    ctx.fillStyle = '#e8e8f5';
    roundRect(ctx, 6, -2, 6, 4, 1.5);          // сопло
    if (recoil > 0.25) {
      ctx.strokeStyle = 'rgba(232,232,245,0.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(12 + recoil * 8, -2);
      ctx.moveTo(12, 0);
      ctx.lineTo(12 + recoil * 8, 2);
      ctx.stroke();
    }
  },

  // --- Эволюции. Без своей ветки рука была бы пустой ---
  // Циклона тут нет намеренно: у вертушки ствола в руке нет, и у её эволюции
  // тоже — лопасти видны вокруг героя. Широкого луча нет по той же причине,
  // что и лазера: он бьёт из глаз.

  // 🌩 Гроза: жезл с разрядником на конце
  stormbolt(ctx, recoil) {
    ctx.fillStyle = '#3a4250';
    roundRect(ctx, -4, -2, 15, 4, 2);
    ctx.fillStyle = '#7fd8ff';
    drawStarShape(ctx, 15, 0, 6 + recoil * 3, 4);
    ctx.fillStyle = '#ffffff';
    circle(ctx, 15, 0, 2 + recoil * 1.5);
  },

  // 🧡 Морковный залп: три ствола пучком
  carrotswarm(ctx, recoil) {
    ctx.fillStyle = '#5a6472';
    [-4.5, 0, 4.5].forEach((dy) => roundRect(ctx, -4, dy - 2, 14, 4, 1.8));
    ctx.fillStyle = '#39414c';
    roundRect(ctx, -6, -7, 4, 14, 2);          // общий казённик
    ctx.fillStyle = '#ff8a2b';
    [-4.5, 0, 4.5].forEach((dy) => circle(ctx, 11, dy, 2));
    if (recoil > 0.35) {
      ctx.fillStyle = 'rgba(220,220,220,0.75)';
      circle(ctx, -9, 0, 3 + recoil * 2.5);
    }
  },

  // 🌋 Огненный шторм: раструб пошире и языки пламени
  firestorm(ctx, recoil) {
    ctx.fillStyle = '#7a2f1c';
    roundRect(ctx, -4, -4, 12, 8, 3);
    ctx.fillStyle = '#c2462a';
    ctx.beginPath();
    ctx.moveTo(8, -5);
    ctx.lineTo(16, -9);
    ctx.lineTo(16, 9);
    ctx.lineTo(8, 5);
    ctx.closePath();
    ctx.fill();
    ['#ffd93d', '#ff8a2b'].forEach((color, i) => {
      ctx.fillStyle = color;
      circle(ctx, 18 + i * 3 + recoil * 4, (i - 0.5) * 4, 3.4 - i);
    });
  },

  // 🌨 Метель: сопло в инее и снежинка на конце
  blizzard(ctx, recoil) {
    ctx.fillStyle = '#2f6f8f';
    roundRect(ctx, -4, -4, 13, 8, 3);
    ctx.fillStyle = '#bfe9ff';
    roundRect(ctx, 9, -5, 5, 10, 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    const x = 18 + recoil * 3;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * 4, -Math.sin(a) * 4);
      ctx.lineTo(x + Math.cos(a) * 4, Math.sin(a) * 4);
      ctx.stroke();
    }
  },

  // 🌟 Двойной бумеранг: две галки друг за другом
  doubleboomerang(ctx, recoil) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    [0, 7].forEach((dx, i) => {
      const elbow = 1 + dx + recoil * 2;
      const arms = () => {
        ctx.beginPath();
        ctx.moveTo(elbow - 8, -6);
        ctx.lineTo(elbow, 0);
        ctx.lineTo(elbow - 6, 7);
      };
      ctx.strokeStyle = '#8a5a24';
      ctx.lineWidth = 6;
      arms();
      ctx.stroke();
      ctx.strokeStyle = i ? '#e0b060' : '#c98b3a';
      ctx.lineWidth = 4;
      arms();
      ctx.stroke();
    });
  },

  // 🍯 Улей: соты, из которых валит рой
  hive(ctx, recoil) {
    ctx.fillStyle = '#d9932c';
    roundRect(ctx, -3, -7, 13, 14, 4);
    ctx.fillStyle = '#b3761d';
    [-3.5, 0.5].forEach((dy) => roundRect(ctx, 0, dy, 6, 3, 1.2));
    ctx.fillStyle = '#3b3b46';
    [[14, -7], [18, -3], [15, 2], [19, 6]].forEach(([bx, by], i) => {
      circle(ctx, bx + recoil * 3, by + Math.sin(i * 1.7) * 1.5, 1.5);
    });
  },


  // 🌊 Водомёт: широкое сопло и струя
  watercannon(ctx, recoil) {
    ctx.fillStyle = '#1f6ea8';
    roundRect(ctx, -3, -4, 11, 8, 3);
    ctx.fillStyle = '#4fb3ff';
    ctx.beginPath();
    ctx.moveTo(8, -4);
    ctx.lineTo(15, -7);
    ctx.lineTo(15, 7);
    ctx.lineTo(8, 4);
    ctx.closePath();
    ctx.fill();
    if (recoil > 0.2) {
      ctx.fillStyle = 'rgba(190,230,255,0.85)';
      circle(ctx, 18, 0, 3.4);
    }
  },

  // 🍝 Помидорная пушка: ведро побольше и с горкой
  tomatocannon(ctx) {
    ctx.fillStyle = '#6b4f2a';
    ctx.beginPath();
    ctx.moveTo(-3, -6);
    ctx.lineTo(12, -5);
    ctx.lineTo(9, 6);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e34b3a';
    circle(ctx, 2, -6, 3);
    circle(ctx, 7, -7, 2.8);
    circle(ctx, 4.5, -9.5, 2.6);
  },

  // 🗡 Двойной меч: два клинка крест-накрест
  dualsaber(ctx, recoil) {
    [-1, 1].forEach((side) => {
      ctx.strokeStyle = side > 0 ? '#7fd8ff' : '#ff9db1';
      ctx.lineWidth = 4 + recoil * 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, side * 2);
      ctx.lineTo(15, side * -5);
      ctx.stroke();
    });
    ctx.fillStyle = '#4a4a55';
    roundRect(ctx, -3, -3, 5, 6, 2);
  },

  // 💧 Водяной пистолет: коротенький ствол с носиком
  water(ctx, recoil) {
    ctx.fillStyle = '#2f8fd8';
    roundRect(ctx, -2, -3, 9, 6, 2);
    ctx.fillStyle = '#4fb3ff';
    roundRect(ctx, 6, -2, 5, 4, 1.5);
    ctx.fillStyle = '#1f6ea8';
    roundRect(ctx, -1, 2, 4, 6, 1.5);       // рукоять
    if (recoil > 0.4) {                      // брызги у дула
      ctx.fillStyle = 'rgba(190,230,255,0.9)';
      circle(ctx, 12.5, 0, 2.2);
    }
  },

  // 🍅 Помидорометалка: ведро с помидорами
  tomato(ctx) {
    ctx.fillStyle = '#8a6a4a';
    ctx.beginPath();
    ctx.moveTo(-2, -5);
    ctx.lineTo(9, -4);
    ctx.lineTo(7, 5);
    ctx.lineTo(0, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e34b3a';               // помидоры сверху
    circle(ctx, 2, -5, 2.6);
    circle(ctx, 6, -5.5, 2.4);
  },

  // ⚡ Молния: жезл с искрящимся навершием
  lightning(ctx, recoil) {
    ctx.strokeStyle = '#6b4f2a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, 3);
    ctx.lineTo(8, -3);
    ctx.stroke();
    ctx.fillStyle = recoil > 0.3 ? '#ffffff' : '#ffd93d';
    drawStarShape(ctx, 9.5, -4, 3.4 + recoil * 1.6, 4);
  },

  // 🥕 Ракета-морковка: труба-базука
  rocket(ctx, recoil) {
    ctx.fillStyle = '#5a6472';
    roundRect(ctx, -4, -3, 15, 6, 2.5);
    ctx.fillStyle = '#39414c';
    roundRect(ctx, -5, -4, 4, 8, 1.5);       // задний срез
    ctx.fillStyle = '#ff8a2b';
    circle(ctx, 12, 0, 2.6);                  // морковка в дуле
    if (recoil > 0.35) {                      // дымок сзади
      ctx.fillStyle = 'rgba(220,220,220,0.75)';
      circle(ctx, -8, 0, 3 + recoil * 2);
    }
  },

  // 🔥 Огнемёт: баллон с раструбом
  fire(ctx, recoil) {
    ctx.fillStyle = '#8c3b2a';
    roundRect(ctx, -4, -3.5, 11, 7, 2.5);     // баллон
    ctx.fillStyle = '#4a4a55';
    ctx.beginPath();                          // раструб
    ctx.moveTo(7, -2.5);
    ctx.lineTo(12, -4.5);
    ctx.lineTo(12, 4.5);
    ctx.lineTo(7, 2.5);
    ctx.closePath();
    ctx.fill();
    if (recoil > 0.2) {                       // огонёк в раструбе
      ctx.fillStyle = '#ffb703';
      circle(ctx, 13, 0, 2.4 + recoil * 2);
    }
  },

  // ❄️ Ледяная пушка: ствол с сосульками
  ice(ctx, recoil) {
    ctx.fillStyle = '#3f7fbf';
    roundRect(ctx, -3, -3, 13, 6, 2);
    ctx.fillStyle = '#bfefff';
    roundRect(ctx, 9, -2.5, 4, 5, 1.5);       // морозильное дуло
    ctx.fillStyle = '#eafaff';                 // сосульки снизу
    [1, 5].forEach((dx) => {
      ctx.beginPath();
      ctx.moveTo(dx, 3);
      ctx.lineTo(dx + 2, 3);
      ctx.lineTo(dx + 1, 6.5);
      ctx.closePath();
      ctx.fill();
    });
    if (recoil > 0.3) {
      ctx.fillStyle = 'rgba(200,245,255,0.9)';
      circle(ctx, 14, 0, 2.2);
    }
  },

  // ⚔️ Световой меч: рукоять со светящимся клинком
  saber(ctx, recoil) {
    ctx.fillStyle = '#4a4a55';
    roundRect(ctx, -3, -1.8, 7, 3.6, 1.2);    // рукоять
    ctx.fillStyle = '#2a2a33';
    roundRect(ctx, 3.5, -2.4, 2, 4.8, 1);     // гарда
    // Клинок: широкий свет и белая сердцевина
    ctx.strokeStyle = 'rgba(127,227,255,0.85)';
    ctx.lineWidth = 5 + recoil * 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(5.5, 0);
    ctx.lineTo(20, 0);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  },
};

// --- Ярость босса ---
// У каждого босса своя анимация второй фазы: одинаковый эффект на пятерых
// разных персонажей читается как заглушка, а не как их характер.
//
// Рисуется в два слоя: 'back' — под боссом (пыль, шлейф, снежинки позади),
// 'front' — поверх (искры, сердечки, пар). Так эффект обнимает персонажа,
// а не лежит на нём плашкой.
//
// Всё завязано на walkPhase, который в ярости и так растёт быстрее
// (enrageSpeed в speedFactor) — отдельный таймер не нужен.
// Лицо босса. Возвращает true, если оно закрыто целиком — тогда рисовальщик
// не станет поверх маски рисовать улыбку.
function drawBossFace(ctx, r, look) {
  if (look.face === 'guardmask') {
    drawGuardMask(ctx, r, look);
    return true;
  }
  drawHalfMask(ctx, r, look);
  return false;
}

// Маска охранника: тёмный овал на всё лицо со светлой фигурой посередине.
// Сидит чуть набок — как всё в этой игре, он нелепый, а не страшный.
function drawGuardMask(ctx, r, look) {
  ctx.save();
  ctx.translate(0, -r * 0.72);
  ctx.rotate(0.08);          // маска съехала набок
  ctx.fillStyle = '#1c1a2e';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.44, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Блик, чтобы чёрное пятно не выглядело дырой
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.16, -r * 0.16, r * 0.14, r * 0.2, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Фигура-знак. Треугольник читается на игровом размере лучше круга и
  // квадрата — их легко спутать с бликом.
  ctx.fillStyle = '#f2f2f7';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.2);
  ctx.lineTo(r * 0.19, r * 0.14);
  ctx.lineTo(-r * 0.19, r * 0.14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHalfMask(ctx, r, look) {
  if (look.face !== 'mask') return;
  ctx.fillStyle = '#eef2f7';
  roundRect(ctx, -r * 0.34, -r * 0.68, r * 0.68, r * 0.34, r * 0.1);
  ctx.strokeStyle = '#c8d2de';
  ctx.lineWidth = Math.max(1.5, r * 0.04);
  ctx.beginPath();
  ctx.moveTo(-r * 0.34, -r * 0.6);
  ctx.lineTo(-r * 0.5, -r * 0.68);
  ctx.moveTo(r * 0.34, -r * 0.6);
  ctx.lineTo(r * 0.5, -r * 0.68);
  ctx.stroke();
  // Складки
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.56);
  ctx.lineTo(r * 0.3, -r * 0.56);
  ctx.stroke();
}

// То, что уходит за спину. Пока это только лапки паука.
function drawBossBack(ctx, r, look) {
  if (look.back !== 'spiderlegs') return;
  ctx.strokeStyle = '#3a3050';
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    [0, 1, 2, 3].forEach((i) => {
      const spread = 0.25 + i * 0.22;
      ctx.beginPath();
      ctx.moveTo(side * r * 0.3, r * 0.1);
      ctx.quadraticCurveTo(
        side * r * (0.9 + i * 0.1), r * (0.1 - spread * 0.8),
        side * r * (1.1 + i * 0.12), r * (0.5 + i * 0.06),
      );
      ctx.stroke();
    });
  });
}

// Куча костей: босс рассыпался и собирается обратно. progress 0 — только что
// упал, 1 — вот-вот встанет: косточки поднимаются и стягиваются к центру.
export function drawBossBones(ctx, { radius, progress }) {
  const r = radius;
  const pull = progress * progress;   // к концу собирается заметно быстрее
  ctx.save();
  ctx.fillStyle = '#e8e4d4';
  for (let i = 0; i < 11; i++) {
    const angle = i * 2.4;
    const spread = r * (1.1 - pull * 0.8);
    const x = Math.cos(angle) * spread * (0.4 + (i % 3) * 0.3);
    const y = r * 0.9 - pull * r * (0.6 + (i % 4) * 0.3) + Math.sin(angle) * r * 0.18;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + pull * 3);
    roundRect(ctx, -r * 0.18, -r * 0.05, r * 0.36, r * 0.1, r * 0.05);
    circle(ctx, -r * 0.18, 0, r * 0.07);
    circle(ctx, r * 0.18, 0, r * 0.07);
    ctx.restore();
  }
  // Череп сверху кучи
  ctx.fillStyle = '#f3efe0';
  const skullY = r * 0.55 - pull * r * 1.1;
  circle(ctx, 0, skullY, r * 0.3);
  ctx.fillStyle = '#3b3b46';
  circle(ctx, -r * 0.11, skullY - r * 0.03, r * 0.08);
  circle(ctx, r * 0.11, skullY - r * 0.03, r * 0.08);
  ctx.restore();
}

// Липкая зона паука. Рисуется в мировых координатах, под персонажами.
export function drawWeb(ctx, web, radius, maxLife) {
  const fade = Math.min(1, web.life / maxLife);
  ctx.save();
  ctx.translate(web.x, web.y);
  ctx.globalAlpha = 0.25 + fade * 0.45;
  ctx.fillStyle = '#e8e8f5';
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 6; i++) {
    const angle = web.seed + (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.55);
    ctx.stroke();
  }
  [0.4, 0.72, 1].forEach((k) => {
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * k, radius * 0.55 * k, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

export function drawBossRage(ctx, { radius, walkPhase, look, style, layer }) {
  ctx.save();
  switch (style) {
    case 'stomp': drawStompRage(ctx, radius, walkPhase, layer); break;
    case 'hearts': drawHeartsRage(ctx, radius, walkPhase, layer); break;
    case 'speed': drawSpeedRage(ctx, radius, walkPhase, layer); break;
    case 'frost': drawFrostRage(ctx, radius, walkPhase, layer, look); break;
    case 'blaze': drawBlazeRage(ctx, radius, walkPhase, layer); break;
    case 'rattle': drawRattleRage(ctx, radius, walkPhase, layer); break;
    case 'juggle': drawJuggleRage(ctx, radius, walkPhase, layer); break;
    case 'command': drawCommandRage(ctx, radius, walkPhase, layer); break;
    case 'webs': drawWebsRage(ctx, radius, walkPhase, layer); break;
    case 'sparks': drawSparksRage(ctx, radius, walkPhase, layer); break;
    default: break;
  }
  ctx.restore();
}

// Толстяк топает: из-под ног волнами расходится пыль, подпрыгивают камешки.
function drawStompRage(ctx, r, phase, layer) {
  if (layer === 'back') {
    // Шаг завершается дважды за оборот walkPhase — пыль привязана к этим моментам
    for (const offset of [0, Math.PI]) {
      const beat = (phase + offset) % (Math.PI * 2) / (Math.PI * 2);
      if (beat > 0.6) continue;                // облако живёт большую часть шага
      const grow = beat / 0.6;

      // Плотное облако у земли
      ctx.globalAlpha = (1 - grow) * 0.55;
      ctx.fillStyle = '#e8dcc0';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.72, r * (0.55 + grow * 1.5), r * (0.2 + grow * 0.45), 0, 0, Math.PI * 2);
      ctx.fill();

      // И расходящаяся ударная волна по контуру
      ctx.globalAlpha = (1 - grow) * 0.8;
      ctx.strokeStyle = '#c9b68c';
      ctx.lineWidth = r * 0.16 * (1 - grow) + 3;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.72, r * (0.6 + grow * 1.8), r * (0.22 + grow * 0.55), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }

  // Камешки подскакивают в такт топоту — читается даже боковым зрением
  for (let i = 0; i < 5; i++) {
    const hop = (phase * 0.5 + i * 0.2) % 1;
    const side = i % 2 ? 1 : -1;
    const x = side * r * (0.55 + (i % 3) * 0.3 + hop * 0.5);
    const y = r * 0.7 - Math.sin(hop * Math.PI) * r * 0.75;
    ctx.globalAlpha = 1 - hop * 0.7;
    ctx.fillStyle = '#a89372';
    circle(ctx, x, y, r * 0.09 * (1 - hop * 0.3));
  }
}

// Мама кипит: сердечки вьются по орбите вокруг неё.
function drawHeartsRage(ctx, r, phase, layer) {
  const count = 6;
  for (let i = 0; i < count; i++) {
    const angle = phase * 1.6 + (i / count) * Math.PI * 2;
    const front = Math.sin(angle) > 0;         // ближняя половина орбиты — поверх
    if ((layer === 'front') !== front) continue;

    const x = Math.cos(angle) * r * 1.35;
    const y = -r * 0.5 + Math.sin(angle) * r * 0.4 + Math.sin(phase * 3 + i) * r * 0.1;
    const size = r * 0.2 * (front ? 1.15 : 0.85);
    ctx.globalAlpha = front ? 0.95 : 0.55;
    ctx.fillStyle = i % 2 ? '#ff4d6d' : '#ff9db1';
    drawHeartShape(ctx, x, y, size);
  }
}

function drawHeartShape(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.5);
  ctx.bezierCurveTo(-size, -size * 0.3, -size * 0.4, -size, 0, -size * 0.35);
  ctx.bezierCurveTo(size * 0.4, -size, size, -size * 0.3, 0, size * 0.5);
  ctx.fill();
  ctx.restore();
}

// Спортсмен разогнался: шлейф позади и брызги пота.
function drawSpeedRage(ctx, r, phase, layer) {
  if (layer === 'back') {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const y = -r * 0.9 + i * r * 0.42;
      const wave = Math.sin(phase * 2 + i) * r * 0.25;
      ctx.lineWidth = 3 + (2 - Math.abs(i - 2));
      ctx.globalAlpha = 0.25 + (2 - Math.abs(i - 2)) * 0.18;
      ctx.beginPath();
      ctx.moveTo(-r * (1.1 + i * 0.12), y);
      ctx.lineTo(-r * (2.4 + i * 0.2) - wave, y);
      ctx.stroke();
    }
    return;
  }
  // Капли пота летят вверх-назад
  ctx.fillStyle = '#bfe6ff';
  for (let i = 0; i < 4; i++) {
    const t = (phase * 0.6 + i * 0.25) % 1;
    ctx.globalAlpha = 1 - t;
    circle(ctx, -r * (0.3 + t * 1.3), -r * (1.15 + t * 0.6), r * 0.09 * (1 - t * 0.4));
  }
}

// Ледяной злится: снежинки кружат, изо рта валит пар, из плеч растут шипы.
function drawFrostRage(ctx, r, phase, layer, look) {
  if (layer === 'back') {
    ctx.strokeStyle = '#eafaff';
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const angle = -phase * 1.1 + (i / 7) * Math.PI * 2;
      const dist = r * (1.15 + Math.sin(phase * 2 + i) * 0.18);
      const x = Math.cos(angle) * dist;
      const y = -r * 0.4 + Math.sin(angle) * dist * 0.5;
      const size = r * 0.13;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {           // трёхлучевая снежинка
        const a = (k / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * size, y - Math.sin(a) * size);
        ctx.lineTo(x + Math.cos(a) * size, y + Math.sin(a) * size);
        ctx.stroke();
      }
    }
    // Ледяные шипы на плечах
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#bfefff';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.5, -r * 0.15);
      ctx.lineTo(side * r * 0.78, -r * 0.95);
      ctx.lineTo(side * r * 0.86, -r * 0.1);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }
  // Пар изо рта — облачка, уплывающие вперёд
  for (let i = 0; i < 3; i++) {
    const t = (phase * 0.5 + i * 0.33) % 1;
    ctx.globalAlpha = (1 - t) * 0.5;
    ctx.fillStyle = '#ffffff';
    circle(ctx, r * (0.45 + t * 1.1), -r * (0.6 - t * 0.15), r * (0.12 + t * 0.22));
  }
}

// Огненный полыхает: пламя бежит по контуру, вверх летят искры.
function drawBlazeRage(ctx, r, phase, layer) {
  if (layer === 'back') {
    // Языки пламени по контуру. Цвета намеренно светлее самого босса —
    // он и сам рыжий, и на его фоне тёмное пламя просто не читается.
    const count = 11;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const flick = 0.7 + Math.abs(Math.sin(phase * 3.5 + i * 1.7)) * 0.75;
      const x = Math.cos(angle) * r * 0.88;
      const y = -r * 0.35 + Math.sin(angle) * r * 0.78;
      const height = r * 0.6 * flick;
      const width = r * 0.17;

      // Внешний язык
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.moveTo(x - width, y);
      ctx.quadraticCurveTo(
        x - width * 0.4, y - height * 0.55,
        x + Math.sin(phase * 4 + i) * r * 0.08, y - height,
      );
      ctx.quadraticCurveTo(x + width * 0.4, y - height * 0.55, x + width, y);
      ctx.closePath();
      ctx.fill();

      // Светлая сердцевина
      ctx.fillStyle = '#ffe680';
      ctx.beginPath();
      ctx.moveTo(x - width * 0.45, y);
      ctx.quadraticCurveTo(x, y - height * 0.5, x, y - height * 0.62);
      ctx.quadraticCurveTo(x, y - height * 0.5, x + width * 0.45, y);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }
  // Искры взлетают и гаснут
  for (let i = 0; i < 6; i++) {
    const t = (phase * 0.45 + i * 0.17) % 1;
    const x = Math.sin(i * 2.3 + phase * 0.6) * r * 0.7;
    ctx.globalAlpha = (1 - t) * 0.95;
    ctx.fillStyle = t < 0.5 ? '#ffe680' : '#ff8a2b';
    circle(ctx, x, -r * (0.9 + t * 1.6), r * 0.07 * (1 - t * 0.5));
  }
}

// --- Пикапы ---

// Медалька на ленточке — это опыт.
// 🌀 Портал: дыра в земле в МИРОВЫХ координатах. Рисуется в слое земли, до
// персонажей, — иначе воронка накрывала бы того, кто в неё падает.
//
// Тёмный круг рисуется ровно по grip: это и есть смертельная зона, и ребёнок
// должен видеть её границу честно. Дуги выходят наружу до reach — докуда
// портал дотягивается, чтобы тянуть.
export function drawPortal(ctx, { x, y, grip, reach, color, phase, fade = 1 }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = fade;
  ctx.scale(1, 0.5);          // дыра в полу, а не шар

  ctx.fillStyle = '#1b1030';
  circle(ctx, 0, 0, grip);
  // Подсвеченный край: без него дыра сливается с ночным тинтом.
  ctx.strokeStyle = color;
  ctx.lineWidth = grip * 0.16;
  ctx.beginPath();
  ctx.arc(0, 0, grip, 0, Math.PI * 2);
  ctx.stroke();

  // Рукава воронки: три дуги, закрученные наружу до предела досягаемости.
  ctx.strokeStyle = color;
  for (let i = 0; i < 3; i++) {
    const spin = phase * (1.4 + i * 0.5) + (i * Math.PI * 2) / 3;
    ctx.globalAlpha = fade * (0.5 - i * 0.11);
    ctx.lineWidth = grip * 0.22;
    ctx.beginPath();
    ctx.arc(0, 0, grip + (reach - grip) * (0.25 + i * 0.3), spin, spin + Math.PI * 1.1);
    ctx.stroke();
  }

  // Искры летят ВНУТРЬ — направление здесь важнее всего остального: это и
  // есть «затягивает».
  ctx.fillStyle = color;
  for (let i = 0; i < 10; i++) {
    const t = (phase * 0.5 + i / 10) % 1;
    const angle = i * 2.4 + phase * 0.5;
    const dist = grip + (reach - grip) * (1 - t) * 0.8;
    ctx.globalAlpha = fade * t * 0.9;
    circle(ctx, Math.cos(angle) * dist, Math.sin(angle) * dist, grip * 0.11 * t);
  }
  ctx.restore();
}

export function drawMedalPickup(ctx, { radius, phase }) {
  const swing = Math.sin(phase) * 0.15; // медалька слегка покачивается
  ctx.save();
  ctx.rotate(swing);

  // Ленточка двумя полосками
  ctx.fillStyle = '#e03b3b';
  ctx.beginPath();
  ctx.moveTo(-radius * 0.55, -radius * 1.9);
  ctx.lineTo(-radius * 0.05, -radius * 0.5);
  ctx.lineTo(-radius * 0.6, -radius * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2f6fd0';
  ctx.beginPath();
  ctx.moveTo(radius * 0.55, -radius * 1.9);
  ctx.lineTo(radius * 0.05, -radius * 0.5);
  ctx.lineTo(radius * 0.6, -radius * 0.4);
  ctx.closePath();
  ctx.fill();

  // Кружок медали
  ctx.fillStyle = '#ffc93c';
  circle(ctx, 0, radius * 0.35, radius);
  ctx.strokeStyle = '#c98a12';
  ctx.lineWidth = Math.max(1.5, radius * 0.14);
  ctx.beginPath();
  ctx.arc(0, radius * 0.35, radius * 0.99, 0, Math.PI * 2);
  ctx.stroke();

  // Звёздочка в центре — чтобы медаль читалась даже размером в 10 пикселей
  ctx.fillStyle = '#fff3b0';
  drawStarShape(ctx, 0, radius * 0.35, radius * 0.55, 5);

  ctx.restore();
}

// Долларовая купюра — это деньги.
export function drawMoneyPickup(ctx, { radius, phase }) {
  const flip = Math.abs(Math.cos(phase)); // купюра поворачивается на лету
  const w = radius * 2.1;
  const h = radius * 1.25;

  ctx.save();
  ctx.scale(Math.max(0.25, flip), 1);

  // Тёмная обводка обязательна: без неё зелёная купюра теряется на траве.
  ctx.fillStyle = '#2f8f4d';
  roundRect(ctx, -w / 2, -h / 2, w, h, radius * 0.22);
  ctx.strokeStyle = '#14472a';
  ctx.lineWidth = Math.max(1.5, radius * 0.16);
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, radius * 0.22);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(radius * 1.5)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', 0, radius * 0.04);

  ctx.restore();
}

export function drawHeartIcon(ctx, x, y, size, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.3);
  ctx.bezierCurveTo(-size, -size * 0.4, -size * 0.4, -size, 0, -size * 0.35);
  ctx.bezierCurveTo(size * 0.4, -size, size, -size * 0.4, 0, size * 0.3);
  ctx.closePath();
  ctx.fillStyle = filled ? '#ff4d6d' : 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.strokeStyle = filled ? '#c9184a' : 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// --- Общие помощники ---
export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

export function drawStarShape(ctx, cx, cy, radius, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

// Мягкая тень под персонажем — «приземляет» его на поле.
// Способность заряжена: вокруг героя вьются звёздочки-светлячки цвета
// способности. Сигнал одинаковый у всех героев — ребёнок один раз выучивает
// «звёздочки = жми пробел». Круга и пятна тут намеренно нет: общее кольцо
// выглядело дёшево, ровно как когда-то общая красная ярость у боссов.
//
// layer: 'back' рисуется до героя, 'front' — после. Половина звёздочек в
// каждом слое, и вместе они обнимают персонажа, а не лежат на нём плашкой.
export function drawAbilitySparks(ctx, { radius, color, phase, layer }) {
  const count = 8;
  ctx.save();
  for (let i = 0; i < count; i++) {
    // Чётные — за героем, нечётные — перед ним.
    if ((i % 2 === 0) !== (layer === 'back')) continue;

    // Своя зацикленная траектория: снизу вверх, покачиваясь и угасая.
    const t = ((phase * 0.35 + i / count) % 1);
    const x = Math.sin(phase * 1.6 + i * 2.1) * radius * (1 + t * 0.5);
    const y = radius * 0.9 - t * radius * 2.4;
    // Размер щедрый: в бою герой мелкий (радиус 20 px), и звёздочка, которая
    // на превью кажется крупной, на поле еле видна.
    const size = radius * 0.4 * (1 - t * 0.35);

    ctx.globalAlpha = Math.sin(t * Math.PI); // плавно зажглась и погасла
    ctx.fillStyle = color;
    drawStarShape(ctx, x, y, size, 4);
    ctx.fillStyle = '#ffffff';
    drawStarShape(ctx, x, y, size * 0.42, 4);
  }
  ctx.restore();
}

// Способность работает. У каждой своя анимация — так же, как ярость у боссов:
// один общий эффект на всех читается как заглушка.
// style — это id способности из CONFIG.abilities.
export function drawAbilityEffect(ctx, { style, radius, color, phase, facing, layer }) {
  ctx.save();
  switch (style) {
    case 'turbo': drawTurboEffect(ctx, radius, color, phase, layer); break;
    case 'meow': drawMeowEffect(ctx, radius, color, phase, layer); break;
    case 'spindash': drawSpinDashEffect(ctx, radius, color, phase, facing, layer); break;
    case 'rage': drawRageEffect(ctx, radius, color, phase, layer); break;
    // 'shockwave' мгновенна, а 'portal' и 'swarm' живут в мире, а не на
    // герое: у первой нет длительности, вторые рисуют себя сами.
    default: break;
  }
  ctx.restore();
}

// 💨 Спин-дэш: смазанное кольцо вокруг катящегося и шлейф позади.
function drawSpinDashEffect(ctx, r, color, phase, facing, layer) {
  if (layer === 'back') {
    // Шлейф тянется назад — туда, откуда прикатился.
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = 0.45 - i * 0.09;
      ctx.lineWidth = r * (0.3 - i * 0.05);
      ctx.beginPath();
      ctx.moveTo(-facing * r * (0.9 + i * 0.5), -r * 0.3 + i * r * 0.25);
      ctx.lineTo(-facing * r * (2.2 + i * 0.6), -r * 0.3 + i * r * 0.25);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return;
  }
  // Смазанное кольцо: три дуги, вращающиеся быстрее глаза.
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.16;
  for (let i = 0; i < 3; i++) {
    const spin = phase * 9 + (i * Math.PI * 2) / 3;
    ctx.globalAlpha = 0.7 - i * 0.15;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.15, spin, spin + Math.PI * 0.7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// 👊 Ярость: зелёное марево вокруг раздувшегося героя и злые искры.
function drawRageEffect(ctx, r, color, phase, layer) {
  if (layer === 'back') {
    // Марево пульсирует — иначе на статичном кадре его не отличить от тени.
    const pulse = 1 + Math.sin(phase * 6) * 0.08;
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = color;
    circle(ctx, 0, 0, r * 1.35 * pulse);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.fillStyle = color;
  for (let i = 0; i < 6; i++) {
    const t = (phase * 0.8 + i / 6) % 1;
    const angle = i * 1.9 - phase * 1.4;
    ctx.globalAlpha = (1 - t) * 0.9;
    circle(ctx, Math.cos(angle) * r * (1.1 + t * 0.8),
      Math.sin(angle) * r * (1.1 + t * 0.8) - t * r * 0.5, r * 0.16 * (1 - t));
  }
  ctx.globalAlpha = 1;
}

// ⚡ Турбо: вокруг героя потрескивают короткие молнии.
function drawTurboEffect(ctx, r, color, phase, layer) {
  if (layer === 'back') return;

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < 3; i++) {
    // Каждая молния живёт треть цикла: вспыхнула — погасла — вспыхнула
    // в другом месте. Всё детерминированно от фазы, случайности в кадре нет.
    const t = (phase * 0.8 + i / 3) % 1;
    if (t > 0.45) continue;

    ctx.globalAlpha = 1 - t / 0.45;
    const angle = i * 2.4 + Math.floor(phase * 0.8 + i / 3) * 1.7;
    const dist = r * 1.25;
    const cx = Math.cos(angle) * dist;
    const cy = Math.sin(angle) * dist * 0.7 - r * 0.2;

    ctx.beginPath();
    ctx.moveTo(cx - r * 0.3, cy - r * 0.35);
    ctx.lineTo(cx + r * 0.05, cy - r * 0.05);
    ctx.lineTo(cx - r * 0.12, cy + r * 0.08);
    ctx.lineTo(cx + r * 0.28, cy + r * 0.4);
    ctx.stroke();
  }
}

// 🐾 Мяу: пока зомби стоят, вокруг героя всплывают кошачьи лапки.
function drawMeowEffect(ctx, r, color, phase, layer) {
  if (layer === 'back') return;

  for (let i = 0; i < 4; i++) {
    const t = ((phase * 0.3 + i / 4) % 1);
    const x = Math.sin(phase * 1.2 + i * 1.9) * r * 1.3;
    const y = r * 0.8 - t * r * 2.4;

    ctx.globalAlpha = Math.sin(t * Math.PI);
    drawPaw(ctx, x, y, r * 0.62, color);
  }
  ctx.globalAlpha = 1;
}

// Лапка: подушечка и три пальчика. Белая обводка обязательна — розовое
// на зелёной траве без неё сливается, а лапка и так мелкая.
function drawPaw(ctx, x, y, size, color) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.5, size * 0.12);
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.2, size * 0.5, size * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (let i = -1; i <= 1; i++) {
    const px = x + i * size * 0.45;
    const py = y - size * 0.42 + Math.abs(i) * size * 0.12;
    ctx.beginPath();
    ctx.arc(px, py, size * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// Кольцо цвета игрока под ногами — единственный способ различить двух
// одинаковых героев. Разрешать одинаковых важнее, чем запрещать: дети оба
// захотят Котика, и запрет кончится слезами.
export function drawPlayerMarker(ctx, radius, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, radius * 0.16);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(0, radius * 1.05, radius * 0.85, radius * 0.32, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Круговой отсчёт над павшим героем: ребёнок должен видеть, что скоро встанет,
// а не решить, что его выкинули из игры.
export function drawDownedTimer(ctx, radius, progress) {
  const r = radius * 0.9;
  const y = -radius * 2.1;
  ctx.save();
  ctx.lineWidth = Math.max(3, radius * 0.22);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(0, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ffd93d';
  ctx.beginPath();
  ctx.arc(0, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  ctx.stroke();
  ctx.restore();
}

export function drawShadow(ctx, radius) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, radius * 1.05, radius * 0.8, radius * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 💀 Ярость костяного: косточки дребезжат вокруг и прыгают из-под ног.
function drawRattleRage(ctx, r, phase, layer) {
  ctx.fillStyle = '#fff6d8';
  if (layer === 'back') {
    for (let i = 0; i < 7; i++) {
      const a = phase * 1.4 + (i / 7) * Math.PI * 2;
      const d = r * (1.3 + Math.sin(phase * 3 + i) * 0.12);
      ctx.save();
      ctx.translate(Math.cos(a) * d, Math.sin(a) * d * 0.6);
      ctx.rotate(a * 2);
      roundRect(ctx, -r * 0.14, -r * 0.04, r * 0.28, r * 0.08, r * 0.04);
      ctx.restore();
    }
    return;
  }
  for (let i = 0; i < 3; i++) {
    const t = (phase * 0.9 + i * 0.33) % 1;
    ctx.globalAlpha = 1 - t;
    circle(ctx, (i - 1) * r * 0.4, r * (1 - t * 1.5), r * 0.09);
  }
  ctx.globalAlpha = 1;
}

// 🎪 Ярость клоуна: торты по орбите и брызги крема.
function drawJuggleRage(ctx, r, phase, layer) {
  if (layer === 'back') {
    for (let i = 0; i < 3; i++) {
      const a = phase * 2 + (i / 3) * Math.PI * 2;
      ctx.fillStyle = '#ffd7e6';
      circle(ctx, Math.cos(a) * r * 1.5, -r * 0.5 + Math.sin(a) * r * 0.55, r * 0.18);
    }
    return;
  }
  for (let i = 0; i < 5; i++) {
    const t = (phase * 0.8 + i * 0.2) % 1;
    ctx.fillStyle = i % 2 ? '#4fb3ff' : '#ffd93d';
    ctx.globalAlpha = 1 - t;
    circle(ctx, (i - 2) * r * 0.3, -r * (1.2 + t * 0.8), r * 0.08);
  }
  ctx.globalAlpha = 1;
}

// 🎭 Ярость охранника: кольца приказа и восклицательные знаки.
function drawCommandRage(ctx, r, phase, layer) {
  if (layer === 'back') {
    ctx.strokeStyle = 'rgba(255,90,90,0.65)';
    ctx.lineWidth = Math.max(2, r * 0.07);
    for (let i = 0; i < 3; i++) {
      const t = (phase * 0.7 + i * 0.33) % 1;
      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.9, r * (0.5 + t * 1.4), r * (0.2 + t * 0.55), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return;
  }
  ctx.fillStyle = '#ff5a5a';
  [-1, 1].forEach((side) => {
    const bob = Math.sin(phase * 4 + side) * r * 0.08;
    roundRect(ctx, side * r * 0.55 - r * 0.05, -r * 1.6 + bob, r * 0.1, r * 0.24, r * 0.04);
    circle(ctx, side * r * 0.55, -r * 1.28 + bob, r * 0.06);
  });
}

// 🕷 Ярость паука: нити к земле и паучата по кругу.
function drawWebsRage(ctx, r, phase, layer) {
  if (layer === 'back') {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.8;
    [-1, 1].forEach((side) => {
      [0.3, 0.6, 0.9].forEach((k) => {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.5, -r * 0.2);
        ctx.quadraticCurveTo(
          side * r * (1 + k), r * 0.3 + Math.sin(phase * 2 + k * 6) * r * 0.1,
          side * r * (0.9 + k), r * 1.1,
        );
        ctx.stroke();
      });
    });
    return;
  }
  ctx.fillStyle = '#2b2b3d';
  for (let i = 0; i < 2; i++) {
    const a = phase * 2.2 + i * Math.PI;
    circle(ctx, Math.cos(a) * r * 1.2, -r * 0.4 + Math.sin(a) * r * 0.4, r * 0.1);
  }
}

// ⚡ Ярость электрического: дуги по контуру и искры вверх.
function drawSparksRage(ctx, r, phase, layer) {
  if (layer === 'back') {
    ctx.strokeStyle = 'rgba(255,243,107,0.8)';
    ctx.lineWidth = Math.max(2, r * 0.06);
    for (let i = 0; i < 5; i++) {
      const a = phase * 3 + (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.25, a, a + 0.5);
      ctx.stroke();
    }
    return;
  }
  ctx.fillStyle = '#fff36b';
  for (let i = 0; i < 5; i++) {
    const t = (phase * 1.2 + i * 0.2) % 1;
    ctx.globalAlpha = 1 - t;
    drawStarShape(ctx, (i - 2) * r * 0.32, -r * (1.3 + t * 0.7), r * 0.1, 4);
  }
  ctx.globalAlpha = 1;
}
