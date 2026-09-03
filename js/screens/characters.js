// Экран выбора персонажа. Каждый герой нарисован своим спрайтом на маленьком
// canvas — ребёнок выбирает картинкой, а не по названию.

import { CONFIG } from '../config.js';
import { Overlay, playerTitle } from './overlay.js';
import { icon } from '../render/icons.js';
const PREVIEW_SIZE = 150;

export class CharactersScreen extends Overlay {
  constructor(rootId, { onPick, onSpeak }) {
    super(rootId);
    this.onPick = onPick;
    this.onSpeak = onSpeak;
    // Вдвоём оба выбирают одновременно, каждый в своей колонке — отсюда
    // perPlayer и индекс игрока в обработчиках.
    this.bindNavigation({
      perPlayer: true,
      onMove: (d, i) => this.move(d, i),
      onConfirm: (i) => this.confirm(i),
    });
  }

  // currentIds — по сохранённому герою на игрока. Одному игроку это массив
  // из одного элемента, и экран выглядит ровно как раньше.
  render(currentIds, { total = 1 } = {}) {
    const ids = Array.isArray(currentIds) ? currentIds : [currentIds];
    this.startPicking(total, (i) => {
      const index = CONFIG.characters.findIndex((c) => c.id === ids[i]);
      return index >= 0 ? index : 0;
    });

    this.setContent(`
      <div class="panel panel--characters${total > 1 ? ' panel--duo' : ''}">
        <h2 class="title title--small">ВЫБЕРИ ГЕРОЯ</h2>
        ${this.pickerColumns((i) => `
          <div class="heroes">
            ${CONFIG.characters.map((c, k) => this.renderCard(c, k)).join('')}
          </div>
          <button class="btn btn--big" data-confirm="${i}">
            ${total > 1 ? 'ГОТОВ' : 'ИГРАТЬ'} ${icon('ui-play')}
          </button>`)}
        <p class="hint">Кликни героя или выбери стрелками и нажми Enter.
           Нажми ${icon('ui-speak')}, чтобы послушать имя</p>
      </div>
    `);

    this.onCards('.hero-card', (owner, i) => {
      this.picks[owner].selected = i;
      this.highlight(owner);
      this.confirm(owner);
    });
    this.onAll('[data-confirm]', (el) => this.confirm(Number(el.dataset.confirm)));
    this.bindSpeakButtons(this.onSpeak);

    this.show();
    this.drawPreviews();
    this.picks.forEach((_, i) => this.highlight(i));
  }

  renderCard(character, index) {
    return `
      <div class="hero-card" data-index="${index}">
        ${Overlay.speakButton(describeCharacter(character))}
        <canvas class="hero-card__canvas" width="${PREVIEW_SIZE}" height="${PREVIEW_SIZE}"
                data-hero="${character.id}"></canvas>
        <span class="hero-card__name">${character.name}</span>
        <span class="hero-card__perk">${character.about}</span>
        <span class="hero-card__ability">${describeAbility(character)}</span>
      </div>
    `;
  }

  // Рисуем каждого героя тем же кодом, что и в игре — превью не разъедется
  // с настоящим персонажем при правках спрайтов.
  drawPreviews() {
    for (const canvas of this.root.querySelectorAll('.hero-card__canvas')) {
      const character = CONFIG.characters.find((c) => c.id === canvas.dataset.hero);
      Overlay.paintHero(canvas, character?.look);
    }
  }

  move(delta, playerIndex = 0) {
    const at = this.movePick(playerIndex, delta, CONFIG.characters.length);
    if (at === null) return;
    this.highlight(playerIndex);
    this.onSpeak(describeCharacter(CONFIG.characters[at]));
  }

  highlight(playerIndex = 0) {
    this.highlightIn(playerIndex, '.hero-card', 'hero-card--selected');
  }

  // Отдаём выбор наверх только когда готовы все: ждать напарника — забота
  // экрана, а не Game.
  confirm(playerIndex = 0) {
    const chosen = this.confirmPick(playerIndex);
    if (chosen) this.onPick(chosen.map((i) => CONFIG.characters[i].id));
  }
}

// Фраза для голоса: имя героя и его бонус.
function describeCharacter(character) {
  return `${character.name}. ${character.about}. Способность: ${describeAbility(character)}`;
}

// Название способности с эмодзи — и на карточке, и в озвучке: ребёнок не
// читает, а выбор героя теперь решает не только внешность.
function describeAbility(character) {
  const ability = CONFIG.abilities[character.ability];
  return ability ? `${icon(ability.icon)} ${ability.name}` : '';
}
