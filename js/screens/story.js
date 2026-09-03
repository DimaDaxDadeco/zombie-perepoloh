// Кадры истории: завязка кампании и финал.
//
// Один кадр за раз — крупная картинка, одна фраза, кнопка «дальше». Так
// устроено не для простоты, а потому что иначе нельзя: Speech.speak обрывает
// предыдущую реплику, очереди у него нет и события «договорил» тоже. Две фразы
// подряд ребёнок услышал бы как одну оборванную.
//
// Фраза произносится САМА при показе кадра. Кнопка 🔈 — это повтор, а не
// единственный путь: ребёнок, который не читает, не должен догадываться, что
// надо куда-то нажать, иначе история пройдёт мимо него молча.
//
// Показывается только на завязке и в финале. Перед каждой главой кадр был бы
// лишним нажатием между ребёнком и игрой, а сказать про главу есть кому —
// карточка на карте и баннер с задачей в бою.

import { Overlay } from './overlay.js';
import { icon } from '../render/icons.js';

export class StoryScreen extends Overlay {
  constructor(rootId, { onSpeak }) {
    super(rootId);
    this.onSpeak = onSpeak;
    this.frames = [];
    this.at = 0;
    this.onDone = () => {};

    this.bindNavigation({
      onMove: () => {},
      onConfirm: () => this.next(),
    });
  }

  // frames — [{ emoji, line }]. onDone зовётся после последнего кадра.
  play(frames, onDone) {
    this.frames = frames;
    this.at = 0;
    this.onDone = onDone || (() => {});
    this.showFrame();
  }

  showFrame() {
    const frame = this.frames[this.at];
    if (!frame) {
      this.hide();
      this.onDone();
      return;
    }
    const last = this.at === this.frames.length - 1;
    this.setContent(`
      <div class="panel panel--end panel--story">
        ${Overlay.speakButton(frame.line)}
        <div class="menu-hero story-art">${icon(frame.icon)}</div>
        <p class="big-line story-line">${frame.line}</p>
        <button class="btn btn--big" data-action="next">${last ? 'В ПУТЬ!' : 'ДАЛЬШЕ'} ${icon('ui-play')}</button>
      </div>
    `);
    this.on('[data-action="next"]', () => this.next());
    this.bindSpeakButtons(this.onSpeak);
    this.show();
    this.onSpeak(frame.line);
  }

  next() {
    this.at += 1;
    this.showFrame();
  }
}
