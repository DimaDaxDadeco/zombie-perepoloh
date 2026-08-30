// Альбом: наклейки зверей и медали за умения. Неоткрытые — силуэтом. Числа
// тут намеренно не пишутся: состав растёт, а комментарий с цифрой устаревает
// молча.
//
// Медали живут третьей сеткой ЗДЕСЬ, а не отдельным экраном. Пятая кнопка в
// меню для нечитающего пятилетнего — перебор, а прятать их вкладкой внутри
// экрана ещё хуже: скрытый режим он не найдёт. Плюс не появляется ни нового
// состояния в Game, ни нового <div> в index.html, а стрелки листают всё
// подряд сами — достаточно дописать медали в конец this.stickers.
//
// Цель за пределами одного раунда: собрать всех. Карточки рисуются настоящим
// игровым кодом (drawZombie/drawBoss), поэтому наклейка физически не может
// разъехаться со зверем в бою.

import { CONFIG } from '../config.js';
import { Overlay } from './overlay.js';
import { albumProgress } from '../core/album.js';
import { achievementsProgress } from '../core/achievements.js';

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
    const medalsOwned = save.achievements || [];
    this.stickers = [
      ...CONFIG.zombieTypes.map((t) => ({ kind: 'zombies', spec: t, open: album.zombies.includes(t.id) })),
      ...CONFIG.bossTypes.map((t) => ({ kind: 'bosses', spec: t, open: album.bosses.includes(t.id) })),
      ...CONFIG.achievements.map((a) => ({ kind: 'medals', spec: a, open: medalsOwned.includes(a.id) })),
    ];
    this.selected = 0;

    const progress = albumProgress(save);
    const medals = achievementsProgress(save);
    const zombieCards = this.stickers.filter((s) => s.kind === 'zombies');
    const bossCards = this.stickers.filter((s) => s.kind === 'bosses');
    const medalCards = this.stickers.filter((s) => s.kind === 'medals');
    const bossOffset = zombieCards.length;
    const medalOffset = bossOffset + bossCards.length;

    this.setContent(`
      <div class="panel panel--album">
        <h2 class="title title--small">📖 АЛЬБОМ</h2>
        <div class="stats-row">
          <span class="stat">🧟 ${progress.zombies.open}/${progress.zombies.total}</span>
          <span class="stat">👑 ${progress.bosses.open}/${progress.bosses.total}</span>
          <span class="stat">🏅 ${medals.open}/${medals.total}</span>
        </div>
        <div class="album-grid">${zombieCards.map((s, i) => this.renderCard(s, i)).join('')}</div>
        <div class="album-grid">
          ${bossCards.map((s, i) => this.renderCard(s, i + bossOffset)).join('')}
        </div>
        <div class="album-grid">
          ${medalCards.map((s, i) => this.renderCard(s, i + medalOffset)).join('')}
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
    // Медаль — эмодзи, а не спрайт: рисовать «не получил урона» процедурно
    // нечем, а sprites.js и без того самый большой модуль в проекте. Игра уже
    // ходит этим путём — магазин, способности, сложности тоже на эмодзи.
    //
    // И имя у закрытой медали НЕ прячется, в отличие от наклейки: у зверя под
    // «???» есть интрига, а медаль без подсказки для нечитающего ребёнка
    // просто не существует — он не узнает, что её можно получить.
    if (sticker.kind === 'medals') {
      return `
        <div class="album-card ${sticker.open ? '' : 'album-card--locked'}" data-index="${index}">
          ${Overlay.speakButton(describeSticker(sticker))}
          <span class="album-card__emoji">${sticker.spec.emoji}</span>
          <span class="album-card__name">${sticker.spec.name}</span>
        </div>
      `;
    }
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

  // Идём по canvas'ам и берём индекс из dataset, а НЕ по порядку итерации: у
  // карточек-медалей canvas'а нет вовсе, и нумерация forEach разъехалась бы
  // с this.stickers.
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
  if (sticker.kind === 'medals') {
    // Закрытая медаль говорит УСЛОВИЕ, а не «???»: иначе для нечитающего
    // ребёнка её попросту нет.
    return sticker.open
      ? `${sticker.spec.name}. ${sticker.spec.about}`
      : `${sticker.spec.name}. ${sticker.spec.hint}`;
  }
  // Закрытая карточка тоже говорит: иначе ребёнок нажимает динамик, и ничего
  // не происходит.
  if (!sticker.open) return 'Этого зомби ты ещё не встречал. Найди его в игре!';
  return `${sticker.spec.name}. ${sticker.spec.about}`;
}
