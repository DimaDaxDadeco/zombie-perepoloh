// Экран выбора персонажа. Каждый герой нарисован своим спрайтом на маленьком
// canvas — ребёнок выбирает картинкой, а не по названию.

import { CONFIG } from '../config.js';
import { Overlay } from './overlay.js';
const PREVIEW_SIZE = 150;

export class CharactersScreen extends Overlay {
  constructor(rootId, { onPick, onSpeak }) {
    super(rootId);
    this.onPick = onPick;
    this.onSpeak = onSpeak;
    this.selected = 0;

    // Управление такое же, как на экране прокачки: стрелки + Enter.
    this.bindNavigation({
      onMove: (d) => this.move(d),
      onConfirm: () => this.confirm(),
    });
  }

  render(currentId, { playerIndex = 0, total = 1 } = {}) {
    this.playerIndex = playerIndex;
    this.total = total;
    const index = CONFIG.characters.findIndex((c) => c.id === currentId);
    this.selected = index >= 0 ? index : 0;

    this.setContent(`
      <div class="panel panel--characters">
        <h2 class="title title--small">${playerTitle(playerIndex, total)}ВЫБЕРИ ГЕРОЯ</h2>
        <div class="heroes">
          ${CONFIG.characters.map((c, i) => this.renderCard(c, i)).join('')}
        </div>
        <button class="btn btn--big" data-action="play">${total > 1 ? 'ДАЛЬШЕ ▶' : 'ИГРАТЬ ▶'}</button>
        <p class="hint">Кликни героя или выбери стрелками и нажми Enter.
           Нажми 🔈, чтобы послушать имя</p>
      </div>
    `);

    this.onAll('.hero-card', (_el, i) => {
      this.selected = i;
      this.highlight();
      this.confirm();
    });
    this.on('[data-action="play"]', () => this.confirm());
    this.bindSpeakButtons(this.onSpeak);

    this.show();
    this.drawPreviews();
    this.highlight();
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

  move(delta) {
    const count = CONFIG.characters.length;
    this.selected = (this.selected + delta + count) % count;
    this.highlight();
    this.onSpeak(describeCharacter(CONFIG.characters[this.selected]));
  }

  highlight() {
    this.root.querySelectorAll('.hero-card').forEach((el, i) => {
      el.classList.toggle('hero-card--selected', i === this.selected);
    });
  }

  confirm() {
    this.onPick(CONFIG.characters[this.selected].id);
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
  return ability ? `${ability.emoji} ${ability.name}` : '';
}

// Чья очередь выбирать. Цвет — тот же, что кольцо у ног героя в бою.
export function playerTitle(index, total) {
  if (total < 2) return '';
  const color = CONFIG.coop.colors[index % CONFIG.coop.colors.length];
  return `<span style="color:${color}">ИГРОК ${index + 1}</span> — `;
}
