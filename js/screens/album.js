// Альбом наклеек: все виды зомби и все боссы из конфига. Неоткрытые —
// силуэтом. Числа тут намеренно не пишутся: состав растёт, а комментарий
// с цифрой устаревает молча.
//
// Цель за пределами одного раунда: собрать всех. Карточки рисуются настоящим
// игровым кодом (drawZombie/drawBoss), поэтому наклейка физически не может
// разъехаться со зверем в бою.

import { CONFIG } from '../config.js';
import { Overlay } from './overlay.js';
import { albumProgress } from '../core/album.js';

const CARD_SIZE = 110;

export class AlbumScreen extends Overlay {
  constructor(rootId, { onClose, onSpeak }) {
    super(rootId);
    this.onClose = onClose;
    this.onSpeak = onSpeak;
    this.selected = 0;
    this.stickers = [];

    // Листаем стрелками и слушаем — для нечитающего ребёнка альбом это
    // буквально «листать и слушать». Выбирать тут нечего, поэтому confirm
    // закрывает экран.
    this.bindNavigation({
      onMove: (d) => this.move(d),
      onConfirm: () => this.onClose(),
      onCancel: () => this.onClose(),
    });
  }

  render(save) {
    const album = save.album;
    this.stickers = [
      ...CONFIG.zombieTypes.map((t) => ({ kind: 'zombies', spec: t })),
      ...CONFIG.bossTypes.map((t) => ({ kind: 'bosses', spec: t })),
    ].map((s) => ({ ...s, open: album[s.kind].includes(s.spec.id) }));
    this.selected = 0;

    const progress = albumProgress(save);
    const zombies = this.stickers.filter((s) => s.kind === 'zombies');
    const bosses = this.stickers.filter((s) => s.kind === 'bosses');

    this.setContent(`
      <div class="panel panel--album">
        <h2 class="title title--small">📖 АЛЬБОМ</h2>
        <div class="stats-row">
          <span class="stat">🧟 ${progress.zombies.open}/${progress.zombies.total}</span>
          <span class="stat">👑 ${progress.bosses.open}/${progress.bosses.total}</span>
        </div>
        <div class="album-grid">${zombies.map((s, i) => this.renderCard(s, i)).join('')}</div>
        <div class="album-grid">
          ${bosses.map((s, i) => this.renderCard(s, i + zombies.length)).join('')}
        </div>
        <button class="btn btn--big" data-action="close">ГОТОВО ✓</button>
        <p class="hint">Кого встретишь в игре — тот появится в альбоме.
           Нажми 🔈, чтобы послушать</p>
      </div>
    `);

    // Клик по всей карточке тоже озвучивает: выбирать в альбоме нечего, а
    // ребёнок будет тыкать в картинку, а не в маленький динамик.
    this.onAll('.album-card', (_el, i) => {
      this.selected = i;
      this.highlight();
      this.speakCurrent();
    });
    this.on('[data-action="close"]', this.onClose);
    this.bindSpeakButtons(this.onSpeak);

    this.show();
    this.drawStickers();
    this.highlight();
  }

  renderCard(sticker, index) {
    const size = sticker.kind === 'bosses' ? CARD_SIZE + 20 : CARD_SIZE;
    return `
      <div class="album-card ${sticker.open ? '' : 'album-card--locked'}" data-index="${index}">
        ${Overlay.speakButton(describeSticker(sticker))}
        <canvas class="album-card__canvas" width="${size}" height="${size}"
                data-index="${index}"></canvas>
        <span class="album-card__name">${sticker.open ? sticker.spec.name : '???'}</span>
        ${sticker.open ? '' : '<span class="album-card__lock">❓</span>'}
      </div>
    `;
  }

  drawStickers() {
    for (const canvas of this.root.querySelectorAll('.album-card__canvas')) {
      const sticker = this.stickers[Number(canvas.dataset.index)];
      const paint = sticker.kind === 'bosses' ? Overlay.paintBoss : Overlay.paintZombie;
      paint(canvas, sticker.spec.look, { locked: !sticker.open });
    }
  }

  move(delta) {
    const count = this.stickers.length;
    this.selected = (this.selected + delta + count) % count;
    this.highlight();
    this.speakCurrent();
  }

  speakCurrent() {
    this.onSpeak(describeSticker(this.stickers[this.selected]));
  }

  highlight() {
    this.root.querySelectorAll('.album-card').forEach((el, i) => {
      el.classList.toggle('album-card--selected', i === this.selected);
    });
  }
}

function describeSticker(sticker) {
  // Закрытая карточка тоже говорит: иначе ребёнок нажимает динамик, и ничего
  // не происходит.
  if (!sticker.open) return 'Этого зомби ты ещё не встречал. Найди его в игре!';
  return `${sticker.spec.name}. ${sticker.spec.about}`;
}
