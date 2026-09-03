// Стенд значков: каждый из реестра в четырёх размерах, на девяти фонах, и
// рядом он же нарисованный на canvas. Два рендерера из одного определения
// расходятся молча, и увидеть это можно только бок о бок.
//
// Живёт вкладкой на общей странице стендов (preview.html). mount() рисует
// свою разметку внутрь переданного корня и возвращает функцию остановки —
// без неё циклы анимации копились бы с каждым переключением вкладки.

import { icon, drawIcon, ICON_NAMES, hasIcon } from '../js/render/icons.js';
import { CONFIG } from '../js/config.js';

export const title = 'Значки';
export const about = 'Каждый значок в четырёх размерах и он же на canvas — два рендерера видно бок о бок';

export function mount(root) {
  root.innerHTML = `
    <div id="bgs" class="bgs"></div>
    <div id="report" class="report"></div>
    <div id="out"></div>
  `;
  const $ = (sel) => root.querySelector(sel);

  // Фоны: панель меню, светлый лист и все грунты тем — контраст значка на
  // космосе и на катке разный, а проверять надо оба.
  const BACKGROUNDS = [
    { name: 'панель', bg: '#242145', ink: '#ffffff' },
    { name: 'светлый', bg: '#f2ecdd', ink: '#2a2750' },
    ...CONFIG.themes.map((t) => ({ name: t.name, bg: t.ground, ink: '#ffffff' })),
  ];
  let current = 0;

  const bgs = $('#bgs');
  BACKGROUNDS.forEach((b, i) => {
    const btn = document.createElement('button');
    btn.textContent = b.name;
    btn.onclick = () => { current = i; render(); };
    bgs.appendChild(btn);
  });

  // Сузить показ, когда правишь один набор: ?only=weapon покажет только
  // оружия, ?per=12&page=2 — по двенадцать штук страницами. По умолчанию
  // видно всё: иконок сто с лишним, но это одна прокрутка, а искать нужную
  // по страницам — лишняя работа.
  const params = new URLSearchParams(location.search);
  const ONLY = params.get('only');
  const PER_PAGE = Number(params.get('per') || ICON_NAMES.length);
  const PAGE = Number(params.get('page') || 1);

  function visibleNames() {
    const all = ONLY ? ICON_NAMES.filter((n) => n.startsWith(ONLY)) : ICON_NAMES;
    return all.slice((PAGE - 1) * PER_PAGE, PAGE * PER_PAGE);
  }

  // Группировка по префиксу имени: ui-, weapon-, ability-… Так стенд сам
  // раскладывается по доменам и не требует ручного списка — забытая иконка
  // не может тихо выпасть из просмотра.
  function groups() {
    const map = new Map();
    for (const name of visibleNames()) {
      const key = name.split('-')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(name);
    }
    return map;
  }

  function render() {
    const theme = BACKGROUNDS[current];
    root.querySelectorAll('#bgs button').forEach((b, i) =>
      b.classList.toggle('on', i === current));

    const out = $('#out');
    out.innerHTML = [...groups()].map(([key, names]) => `
      <h2>${key} — ${names.length}</h2>
      <div class="grid">
        ${names.map((n) => `
          <div class="cell" style="--bg:${theme.bg};--ink:${theme.ink}">
            <div class="row">
              <span class="s16">${icon(n)}</span>
              <span class="s24">${icon(n)}</span>
              <span class="s48">${icon(n)}</span>
              <span class="s96">${icon(n)}</span>
            </div>
            <div class="pair">
              <span>canvas &nbsp;»</span>
              <canvas data-icon="${n}" width="48" height="48"></canvas>
              <canvas data-icon="${n}" width="16" height="16"></canvas>
            </div>
            <div class="name" data-copy="${n}">${n}</div>
          </div>
        `).join('')}
      </div>
    `).join('');

    // Правая половина карточки — та же иконка, нарисованная на canvas. Два
    // рендерера из одного определения разъезжаются молча, и увидеть это можно
    // только рядом.
    for (const canvas of out.querySelectorAll('canvas[data-icon]')) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawIcon(ctx, canvas.dataset.icon, canvas.width / 2, canvas.height / 2,
        canvas.width, { color: theme.ink });
    }

    out.querySelectorAll('.name').forEach((el) => {
      el.onclick = () => navigator.clipboard?.writeText(el.dataset.copy);
    });
  }

  // Покрытие: что в конфиге уже переведено на иконки, а чего в реестре нет.
  function checkCoverage() {
    const wanted = [];
    const add = (where, list) => list.forEach((v) => v && wanted.push([where, v]));
    add('оружия', Object.values(CONFIG.weapons).map((w) => w.icon));
    add('способности', Object.values(CONFIG.abilities || {}).map((a) => a && a.icon));
    add('магазин', Object.values(CONFIG.shop).map((s) => s.icon));
    add('медали', CONFIG.achievements.map((a) => a.icon));
    add('сложности', CONFIG.difficulties.map((d) => d.icon));
    const missing = wanted.filter(([, name]) => !hasIcon(name));
    const el = $('#report');
    el.textContent = missing.length
      ? `Нет в реестре (${missing.length}): ` + missing.map(([w, n]) => `${w}/${n}`).join(', ')
      : `Иконок в реестре: ${ICON_NAMES.length}. Все имена из конфига найдены.`;
    const total = ONLY ? ICON_NAMES.filter((n) => n.startsWith(ONLY)).length : ICON_NAMES.length;
    const pages = Math.ceil(total / PER_PAGE);
    if (pages > 1 || ONLY) {
      el.textContent += `  |  показано ${visibleNames().length} из ${total}`
        + `${pages > 1 ? `, страница ${PAGE} из ${pages}` : ''}`;
    }
  }

  render();
  checkCoverage();

  return () => { };
}
