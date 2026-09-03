// Магазин между раундами: постоянные улучшения за монетки.
// Купленные уровни показываются точками, цена — крупно, чтобы было понятно без чтения.

import { CONFIG } from '../config.js';
import { Overlay } from './overlay.js';
import { icon } from '../render/icons.js';

export class ShopScreen extends Overlay {
  constructor(rootId, { onBuy, onClose, onSpeak }) {
    super(rootId);
    this.onBuy = onBuy;
    this.onClose = onClose;
    this.onSpeak = onSpeak;
    this.selected = 0;

    // Последний товар в списке — «ГОТОВО»: с геймпада из магазина надо
    // как-то выйти, а отдельной кнопки «назад» у ребёнка нет.
    this.bindNavigation({
      onMove: (d) => this.move(d),
      onConfirm: () => this.confirm(),
      onCancel: () => this.onClose(),
    });
  }

  get ids() {
    return Object.keys(CONFIG.shop);
  }

  move(delta) {
    const count = this.ids.length + 1;   // +1 — кнопка «ГОТОВО»
    this.selected = (this.selected + delta + count) % count;
    this.highlight();
    const id = this.ids[this.selected];
    this.onSpeak(id ? this.root.querySelector(`[data-id="${id}"] .speak`)?.dataset.speak : 'Готово');
  }

  highlight() {
    this.root.querySelectorAll('.shop-item').forEach((el, i) => {
      el.classList.toggle('shop-item--selected', i === this.selected);
    });
    const done = this.root.querySelector('[data-action="close"]');
    done?.classList.toggle('btn--selected', this.selected === this.ids.length);
  }

  confirm() {
    const id = this.ids[this.selected];
    if (!id) return this.onClose();
    const el = this.root.querySelector(`[data-id="${id}"]`);
    if (el && !el.classList.contains('shop-item--locked')) this.onBuy(id);
  }

  render(save) {
    const items = Object.entries(CONFIG.shop)
      .map(([id, spec]) => this.renderItem(id, spec, save))
      .join('');

    // Прокрутку сохраняем: экран перерисовывается после КАЖДОЙ покупки, и без
    // этого список отскакивал бы к началу — заметнее всего на телефоне.
    this.setContentKeepingScroll(`
      <div class="panel panel--shop">
        <h2 class="title title--small">МАГАЗИН</h2>
        <div class="stats-row"><span class="stat">${icon('ui-money')} ${save.coins}</span></div>
        <div class="shop-items">${items}</div>
        <button class="btn btn--big" data-action="close">ГОТОВО ${icon('ui-check')}</button>
        <p class="hint">Нажми ${icon('ui-speak')}, чтобы послушать название и цену</p>
      </div>
    `);

    this.onAll('.shop-item[data-id]', (el) => {
      if (el.classList.contains('shop-item--locked')) return;
      this.onBuy(el.dataset.id);
    });
    this.on('[data-action="close"]', this.onClose);
    this.bindSpeakButtons(this.onSpeak);
    this.show();
    this.highlight();
  }

  renderItem(id, spec, save) {
    const level = save.shop[id] || 0;
    const maxLevel = spec.prices.length;
    const isMaxed = level >= maxLevel;
    const price = isMaxed ? null : spec.prices[level];
    const affordable = !isMaxed && save.coins >= price;
    const dots = icon('ui-dot').repeat(level) + icon('ui-dot-empty').repeat(maxLevel - level);

    return `
      <div class="shop-item ${affordable ? '' : 'shop-item--locked'}" data-id="${id}">
        ${Overlay.speakButton(describeItem(spec, price, isMaxed, affordable))}
        <span class="shop-item__emoji">${icon(spec.icon)}</span>
        <span class="shop-item__name">${spec.name}</span>
        <span class="shop-item__about">${spec.about}</span>
        <span class="shop-item__dots">${dots}</span>
        <span class="shop-item__price">${isMaxed ? 'МАКС' : `${icon('ui-money')} ${price}`}</span>
      </div>
    `;
  }
}

// Фраза для голоса: что это, сколько стоит и хватает ли денег.
function describeItem(spec, price, isMaxed, affordable) {
  if (isMaxed) return `${spec.name}. ${spec.about}. Уже куплено полностью`;
  const cost = `${price} ${dollarWord(price)}`;
  return affordable
    ? `${spec.name}. ${spec.about}. Стоит ${cost}`
    : `${spec.name}. ${spec.about}. Стоит ${cost}. Пока не хватает`;
}

function dollarWord(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'долларов';
  if (last === 1) return 'доллар';
  if (last >= 2 && last <= 4) return 'доллара';
  return 'долларов';
}
