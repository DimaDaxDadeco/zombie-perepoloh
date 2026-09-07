// Кадры истории: завязка кампании и финал.
//
// Один кадр за раз — крупная картинка, фраза, кнопка «дальше». Кадр может
// нести и несколько строк (frame.lines): у голоса есть очередь, и следующая
// строка начинается, когда договорена предыдущая. Раньше это было невозможно —
// speak обрывал предыдущую реплику, и две фразы подряд ребёнок услышал бы как
// одну оборванную.
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
  constructor(rootId, { onSpeak, onNarrate }) {
    super(rootId);
    this.onSpeak = onSpeak;
    // Рассказ идёт объявлениями, а не подписями: подпись отбрасывается, если
    // в этот момент говорит что-то важнее, и кадр остался бы немым.
    this.onNarrate = onNarrate;
    this.frames = [];
    this.at = 0;
    this.onDone = () => {};

    this.bindNavigation({
      onMove: () => {},
      onConfirm: () => this.next(),
    });
  }

  // frames — [{ icon, line }] либо [{ icon, lines: [...] }].
  // onDone зовётся после последнего кадра.
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
    const lines = frame.lines || [frame.line];
    const last = this.at === this.frames.length - 1;
    this.setContent(`
      <div class="panel panel--end panel--story">
        ${Overlay.speakButton(lines.join(' '))}
        <div class="menu-hero story-art">${icon(frame.icon)}</div>
        ${lines.map((line) => `<p class="big-line story-line">${line}</p>`).join('')}
        <button class="btn btn--big" data-action="next">${last ? 'В ПУТЬ!' : 'ДАЛЬШЕ'} ${icon('ui-play')}</button>
      </div>
    `);
    this.on('[data-action="next"]', () => this.next());
    this.bindSpeakButtons(this.onSpeak);
    this.show();
    this.onNarrate(lines);
  }

  next() {
    this.at += 1;
    this.showFrame();
  }
}
