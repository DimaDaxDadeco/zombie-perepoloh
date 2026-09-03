// Оболочка страницы стендов: панель вкладок и монтирование активного стенда.
//
// Каждый стенд — модуль с mount(root), рисующий свою разметку внутрь общего
// корня и возвращающий функцию остановки. Оболочка про их устройство не знает
// ничего: ни про canvas, ни про кнопки, ни про циклы анимации.
//
// Остановка обязательна. Стенды героев, зомби, боссов и локаций крутят
// requestAnimationFrame, и без остановки каждый переход по вкладкам оставлял
// бы позади ещё один живой цикл — через десяток переключений страница
// начинает тормозить, а причину видно только в профайлере.
//
// Активная вкладка живёт в адресе (#zombies): ссылку на нужный стенд можно
// дать другому человеку, а перезагрузка после правки спрайта возвращает туда
// же, где смотрел. Это не удобство, а рабочий цикл — правишь sprites.js,
// жмёшь обновление, смотришь.

import { STANDS, TAB_NAMES } from './registry.js';

const tabsEl = document.getElementById('tabs');
const aboutEl = document.getElementById('about');
const standEl = document.getElementById('stand');

let stopCurrent = null;
let currentId = null;

tabsEl.innerHTML = STANDS
  .map(({ id }) => `<button class="tab" data-id="${id}">${TAB_NAMES[id]}</button>`)
  .join('');

tabsEl.addEventListener('click', (event) => {
  const id = event.target.closest('.tab')?.dataset.id;
  if (id) location.hash = id;
});

async function show(id) {
  const stand = STANDS.find((s) => s.id === id) || STANDS[0];
  if (stand.id === currentId) return;

  stopCurrent?.();
  stopCurrent = null;
  currentId = stand.id;

  tabsEl.querySelectorAll('.tab').forEach((el) => {
    el.classList.toggle('tab--on', el.dataset.id === stand.id);
  });
  // Фон страницы задаётся стендом: персонажей смотрим на траве, значки и
  // локации — на тёмном. Правила лежат в css/preview.css по data-атрибуту.
  document.body.dataset.stand = stand.id;
  aboutEl.textContent = 'Загружаю…';
  standEl.innerHTML = '';

  const module = await stand.load();
  // Пока модуль грузился, могли переключить вкладку — тогда монтировать уже
  // нечего, иначе два стенда окажутся в одном корне.
  if (currentId !== stand.id) return;

  aboutEl.textContent = module.about;
  document.title = `Стенды: ${module.title}`;
  stopCurrent = module.mount(standEl) || null;
}

window.addEventListener('hashchange', () => show(location.hash.slice(1)));
show(location.hash.slice(1));
