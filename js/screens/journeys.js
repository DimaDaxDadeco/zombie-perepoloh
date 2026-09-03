// Выбор путешествия: с какой историей играть.
//
// Отдельным экраном, а не вкладками на карте. Вкладки были первой попыткой и
// работали, но прятали главное: у ребёнка есть ВЫБОР из двух историй, и
// увидеть его он должен до того, как окажется внутри одной из них. Экран
// выбора — тот же приём, что у «Кто играет?» и «Выбери, как играть»: две
// крупные карточки, у каждой картинка, имя и счёт пройденного.
//
// Пока путешествие одно, экран не показывается вовсе — Game уводит прямо на
// карту. Выбор из одного варианта это лишнее нажатие, а их в этой игре
// считают.

import { Overlay } from './overlay.js';
import { icon } from '../render/icons.js';
import { journeyProgress } from '../core/campaign.js';

export class JourneysScreen extends Overlay {
  constructor(rootId, { onPick, onClose, onSpeak }) {
    super(rootId);
    this.onPick = onPick;
    this.onClose = onClose;
    this.onSpeak = onSpeak;
    this.journeys = [];
    this.selected = 0;

    this.bindNavigation({
      onMove: (d) => this.move(d),
      onConfirm: () => this.confirm(),
      onCancel: () => this.onClose(),
    });
  }

  render(journeys, currentId) {
    this.journeys = journeys;
    // Курсор встаёт на то, где ребёнок был в прошлый раз.
    const index = journeys.findIndex((j) => j.id === currentId);
    this.selected = index >= 0 ? index : 0;

    this.setContent(`
      <div class="panel panel--characters panel--journeys">
        <h2 class="title title--small">КУДА ПОЙДЁМ?</h2>
        <div class="heroes">
          ${journeys.map((journey, i) => this.renderCard(journey, i)).join('')}
        </div>
        <button class="btn btn--secondary" data-action="close">${icon('ui-home')} В меню</button>
        <p class="hint">Выбирай стрелками, нажимай пробел.
           Нажми ${icon('ui-speak')}, чтобы послушать</p>
      </div>
    `);

    this.onAll('.hero-card', (_el, i) => {
      this.selected = i;
      this.highlight();
      this.confirm();
    });
    this.on('[data-action="close"]', this.onClose);
    this.bindSpeakButtons(this.onSpeak);

    this.show();
    this.highlight();
  }

  renderCard(journey, index) {
    const progress = journeyProgress(journey);
    const done = progress.open >= progress.total;
    return `
      <div class="hero-card" data-index="${index}">
        ${Overlay.speakButton(describeJourney(journey))}
        <span class="weapon-choice__emoji">${icon(journey.spec.icon)}</span>
        <span class="hero-card__name">${journey.spec.title}</span>
        <span class="hero-card__perk">
          ${done ? icon('ui-done') : icon(journey.spec.reward.icon)}
          ${progress.open}/${progress.total}
        </span>
      </div>
    `;
  }

  move(delta) {
    const count = this.journeys.length;
    if (!count) return;
    this.selected = (this.selected + delta + count) % count;
    this.highlight();
    this.onSpeak(describeJourney(this.journeys[this.selected]));
  }

  highlight() {
    this.root.querySelectorAll('.hero-card').forEach((el, i) => {
      el.classList.toggle('hero-card--selected', i === this.selected);
    });
  }

  confirm() {
    const journey = this.journeys[this.selected];
    if (journey) this.onPick(journey.id);
  }
}

// Что скажет голос. Счёт словами, а не «семь из двенадцати»: цифры на слух
// пятилетний не удержит, а «осталось пять» — вполне.
function describeJourney(journey) {
  const { open, total } = journeyProgress(journey);
  if (open >= total) return `${journey.spec.title}. Пройдено целиком!`;
  if (open === 0) return `${journey.spec.title}. Новое путешествие.`;
  return `${journey.spec.title}. Осталось глав: ${total - open}.`;
}
