import panelHtml from './index.html';
import { detectDarkMode, initThemeObserver } from '../../lib/theme.js';
import {
  clearSelection,
  calculateShowPosition,
  getSelectionEndPointRect,
} from '../selection-rect.js';
import {
  TRANSLATE_FAILED_MESSAGE,
  NOT_FOUND_MESSAGE,
} from '../../lib/result-messages.js';
// POS tags sourced from ECDICT
const VALID_POS_TAGS = new Set([
  'n.', // noun
  'v.', // verb
  'a.', // adjective
  'adv.', // adverb
  'prep.', // preposition
  'conj.', // conjunction
  'pron.', // pronoun
  'int.', // interjection (short)
  'interj.', // interjection
  'art.', // article
  'vi.', // intransitive verb
  'vt.', // transitive verb
  'vi.vt.', // intransitive & transitive verb
  'vt.vi.', // transitive & intransitive verb
  'aux.', // auxiliary verb
  'abbr.', // abbreviation
  'num.', // numeral
  'pl.', // plural
]);

const ATTR_PRONUNCIATION = 'data-pronunciation';

export const PANEL_MODE = {
  DICT: 'dict',
  TRANSLATE: 'translate',
};

function isValidPOS(pos) {
  return VALID_POS_TAGS.has(pos);
}

export default class Panel {
  static #instance = null;
  #host = null;
  #panel = null;
  #shadow = null;
  #sessionId = null;
  #mode = null; // 'dict' or 'translate'
  #utterance = null;

  // dict section
  #wordEl = null;
  #variantInfoEl = null;
  #definitionSectionEl = null;
  #phoneticEl = null;
  #rootListEl = null;
  #compositionEl = null;
  #selectActionInfo = null;
  #notFoundTextEl = null;

  // translate section
  #sourceTextEl = null;
  #translationEl = null;
  #failedTextEl = null;
  #expandBtnEl = null;
  #copyTranslationBtnEl = null;
  #copyResetTimer = null;

  // pin / drag
  #pinned = false;
  #pinnedPosition = null; // { left, top }
  #dragOffset = null; // { dx, dy }

  constructor(host, shadow) {
    this.#host = host;
    this.#shadow = shadow;
    this.#panel = shadow.querySelector('.panel');
    this.#sessionId = 0;
    this.initUtterance();

    // dict section
    this.#wordEl = shadow.querySelector('.word');
    this.#variantInfoEl = shadow.querySelector('.variant-info');
    this.#definitionSectionEl = shadow.querySelector('.definition-section');
    this.#phoneticEl = shadow.querySelector('.phonetic');
    this.#rootListEl = shadow.querySelector('.root-list');
    this.#compositionEl = shadow.querySelector('.composition');
    this.#notFoundTextEl = shadow.querySelector('.not-found-text-content');
    // translate section
    this.#sourceTextEl = shadow.querySelector('.source-text');
    this.#translationEl = shadow.querySelector('.translation');
    this.#failedTextEl = shadow.querySelector('.failed-text-content');
    this.#expandBtnEl = shadow.querySelector('.expand-btn');
    this.#copyTranslationBtnEl = shadow.querySelector('.copy-btn');

    shadow.querySelectorAll('.close-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.handleCloseBtnClick());
    });

    shadow.querySelectorAll('.pin-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePin();
      });
    });

    this.#setupDrag();
    this.#loadPinState();

    shadow
      .querySelector('.dict-audio-btn')
      .addEventListener('click', () => this.handleDictAudioBtnClick());

    shadow
      .querySelector('.translate-audio-btn')
      .addEventListener('click', () => this.handleTranslateAudioBtnClick());

    shadow
      .querySelector('.translate-pause-btn')
      .addEventListener('click', () => this.stopAudio());

    this.#expandBtnEl.addEventListener('click', () =>
      this.handleExpandBtnClick(),
    );

    this.#copyTranslationBtnEl.addEventListener('click', () =>
      this.handleCopyTranslationBtnClick(),
    );

    initThemeObserver(() => this.updateTheme());

    this.setMode(PANEL_MODE.DICT);
    this.hide();
  }

  static create() {
    if (Panel.#instance) {
      return Panel.#instance;
    }

    const host = document.createElement('div');
    host.id = 'puzzledict-host';
    const shadow = host.attachShadow({ mode: 'closed' });

    shadow.innerHTML = panelHtml;

    document.body.appendChild(host);

    Panel.#instance = new Panel(host, shadow);
    return Panel.#instance;
  }

  get host() {
    return this.#host;
  }

  initUtterance() {
    this.#utterance = new SpeechSynthesisUtterance();
    this.#utterance.lang = 'en-US';
    return this;
  }

  setPosition(selectActionInfo) {
    this.#selectActionInfo = selectActionInfo;
    return this.updatePosition();
  }

  updatePosition() {
    if (this.#pinned && this.#pinnedPosition) {
      this.#panel.style.left = `${this.#pinnedPosition.left}px`;
      this.#panel.style.top = `${this.#pinnedPosition.top}px`;
      return this;
    }

    if (!this.#selectActionInfo) {
      console.warn('selectActionInfo is not set');
      return this;
    }
    const { x, y } = calculateShowPosition(this.#panel, this.#selectActionInfo);

    this.#panel.style.left = `${x}px`;
    this.#panel.style.top = `${y}px`;

    const selectionEndPointRect = getSelectionEndPointRect(
      this.#selectActionInfo.selection,
      this.#selectActionInfo.mousePosition,
    );
    const isSelectionAbovePanel = y < selectionEndPointRect.bottom + 8;
    this.#panel.classList.toggle('enter-from-above', isSelectionAbovePanel);
    this.#panel.classList.toggle('enter-from-below', !isSelectionAbovePanel);
    return this;
  }

  handleDictAudioBtnClick() {
    this.playAudio(this.#wordEl.getAttribute(ATTR_PRONUNCIATION));
  }

  handleTranslateAudioBtnClick() {
    this.playAudio(this.#sourceTextEl.textContent);
  }

  playAudio(text) {
    if (!text?.trim()) {
      return this;
    }

    if (!this.#utterance) {
      this.initUtterance();
    }

    this.stopAudio();

    this.#utterance.onend = () => {
      this.stopAudio();
    };

    this.#utterance.onerror = () => {
      this.stopAudio();
    };

    this.#utterance.text = text;
    speechSynthesis.speak(this.#utterance);
    this.#panel.classList.add('playing');

    return this;
  }

  stopAudio() {
    if (this.#utterance) {
      this.#utterance.onend = null;
      this.#utterance.onerror = null;
    }

    speechSynthesis.cancel();
    this.#panel.classList.remove('playing');

    return this;
  }

  processTranslation(translation, lineLimit = 3) {
    const lines = translation.split('\n');

    return lines.slice(0, lineLimit).map((line) => {
      const spaceIndex = line.indexOf(' ');

      if (spaceIndex === -1) {
        return { pos: '', text: line };
      }

      const pos = line.slice(0, spaceIndex);
      const text = line.slice(spaceIndex + 1);

      if (!isValidPOS(pos)) {
        return { pos: '', text: line };
      }

      return { pos, text };
    });
  }

  generateDefSectionHTML(translations) {
    return translations
      .map(
        ({ pos, text }) => `
      <div class="def-row">
        ${pos && `<div class="pos-label">${pos}</div>`}
        <div class="def-text">${text}</div>
      </div>
    `,
      )
      .join('');
  }

  setRootList(roots) {
    const compact = roots.length > 4;
    this.#rootListEl.classList.toggle('compact', compact);

    this.#rootListEl.innerHTML = roots
      .map(({ root, meaning }) => {
        const isPrefix = root.endsWith('-');
        const isSuffix = root.startsWith('-');
        const rootClass = isPrefix
          ? 'prefix'
          : isSuffix
            ? 'suffix'
            : 'root-word';
        const noteText = isPrefix ? 'PREFIX' : isSuffix ? 'SUFFIX' : 'ROOT';

        return `
        <div class="root-item">
          <span class="root ${rootClass}">${root}</span>
          <span class="note">${noteText}</span>
          <span class="meaning">${meaning}</span>
        </div>
      `;
      })
      .join('');

    return this;
  }

  setMode(mode = PANEL_MODE.DICT) {
    const prevMode = this.#mode;
    if (prevMode === mode) {
      return this;
    }

    this.#panel.classList.remove(`mode-${prevMode}`);
    this.#panel.classList.add(`mode-${mode}`);

    this.#mode = mode;
    return this;
  }

  setDictContent({
    word,
    definition,
    root,
    variantInfo,
    pronunciationText,
    message,
  }) {
    this.#wordEl.textContent = word;
    if (definition) {
      const { phonetic, translation } = definition;
      const translations = this.processTranslation(translation);
      const phoneticText = phonetic ? `/${phonetic}/` : '发音:';

      this.#definitionSectionEl.innerHTML =
        this.generateDefSectionHTML(translations);
      this.#phoneticEl.textContent = phoneticText;

      if (variantInfo) {
        const { exchangeWord, typeNames } = variantInfo;
        this.#variantInfoEl.textContent = `${exchangeWord} 的${typeNames.join('/')}`;
      } else {
        this.#variantInfoEl.textContent = '';
      }

      if (root) {
        const { roots, composition } = root;
        this.setRootList(roots);

        this.#compositionEl.textContent = composition;
      } else {
        this.#panel.classList.add('no-root');
      }

      if (pronunciationText) {
        this.#wordEl.setAttribute(ATTR_PRONUNCIATION, pronunciationText);
      } else {
        this.#panel.classList.add('no-pronunciation');
        this.#wordEl.removeAttribute(ATTR_PRONUNCIATION);
      }
    } else {
      this.#panel.classList.add('not-found');
      this.#notFoundTextEl.textContent = message || NOT_FOUND_MESSAGE;
    }

    // 渲染完内容后，实际高度可能发生变化，需要更新位置
    this.updatePosition();

    return this;
  }

  setTranslateContent({ query, translation, message }) {
    // 无论翻译成功与否，都渲染查询文本
    if (query) {
      const sourceTextEl = this.#sourceTextEl;

      sourceTextEl.textContent = query;

      if (sourceTextEl.scrollHeight > sourceTextEl.clientHeight) {
        this.#expandBtnEl.classList.add('show');
      } else {
        this.#expandBtnEl.classList.remove('show');
      }
    }

    if (translation) {
      this.#panel.classList.remove('translate-failed');

      this.#translationEl.textContent = translation;
    } else {
      this.#failedTextEl.textContent = message || TRANSLATE_FAILED_MESSAGE;
      this.#panel.classList.add('translate-failed');
    }

    // 渲染完内容后，实际高度可能发生变化，需要更新位置
    this.updatePosition();

    return this;
  }

  setLoading() {
    this.#panel.classList.add('loading');
    return this;
  }

  stopLoading() {
    this.#panel.classList.remove('loading');
    return this;
  }

  resetPanel() {
    // both dict and translate mode
    this.stopAudio();

    // dict mode
    this.#panel.classList.remove(
      'loading',
      'not-found',
      'no-root',
      'no-pronunciation',
      'enter-from-above',
      'enter-from-below',
    );
    this.#selectActionInfo = null;

    this.#wordEl.textContent = '';
    this.#variantInfoEl.textContent = '';
    this.#phoneticEl.textContent = '';

    this.#definitionSectionEl.innerHTML = `
      <div class="def-row">
        <div class="pos-label"></div>
        <div class="def-text"></div>
      </div>`
      .trim()
      .repeat(2);

    this.#shadow.querySelectorAll('.root').forEach((item) => {
      item.textContent = '';
    });
    this.#shadow.querySelectorAll('.meaning').forEach((item) => {
      item.textContent = '';
    });
    this.#compositionEl.textContent = '';
    this.#notFoundTextEl.textContent = NOT_FOUND_MESSAGE;

    // translate mode
    this.#panel.classList.remove('translate-failed');

    this.#sourceTextEl.textContent = '';
    this.#sourceTextEl.classList.add('line-clamp-3');

    this.#translationEl.textContent = '';
    this.#failedTextEl.textContent = TRANSLATE_FAILED_MESSAGE;

    this.#expandBtnEl.classList.remove('show', 'expanded');

    if (this.#copyResetTimer) {
      clearTimeout(this.#copyResetTimer);
      this.#copyResetTimer = null;
    }
    this.#copyTranslationBtnEl.classList.remove('copied');

    return this;
  }

  handleExpandBtnClick() {
    this.#sourceTextEl.classList.toggle('line-clamp-3');
    this.#expandBtnEl.classList.toggle('expanded');
  }

  handleCloseBtnClick() {
    clearSelection();
    this.setPinned(false);
    this.hide(null, true);
  }

  isPinned() {
    return this.#pinned;
  }

  setPinned(pinned) {
    this.#pinned = !!pinned;
    this.#panel.classList.toggle('pinned', this.#pinned);

    this.#shadow.querySelectorAll('.pin-btn').forEach((btn) => {
      btn.classList.toggle('pinned', this.#pinned);
      btn.setAttribute('aria-pressed', this.#pinned ? 'true' : 'false');
      btn.setAttribute(
        'title',
        this.#pinned ? '取消钉住' : '钉住面板（可拖动）',
      );
      btn.setAttribute('aria-label', this.#pinned ? '取消钉住' : '钉住面板');
    });

    if (this.#pinned) {
      this.#pinnedPosition = this.#pinnedPosition || {
        left: parseFloat(this.#panel.style.left) || 24,
        top: parseFloat(this.#panel.style.top) || 24,
      };
    }

    this.#savePinState();
    return this;
  }

  togglePin() {
    this.setPinned(!this.#pinned);
    if (this.#pinned) {
      this.show();
    }
    return this;
  }

  #savePinState() {
    try {
      chrome.storage?.local?.set({
        puzzledictPin: {
          pinned: this.#pinned,
          pos: this.#pinnedPosition,
        },
      });
    } catch {
      // ignore storage errors in restricted contexts
    }
    return this;
  }

  #loadPinState() {
    try {
      chrome.storage?.local?.get({ puzzledictPin: null }, (result) => {
        const saved = result?.puzzledictPin;
        if (saved?.pos) {
          this.#pinnedPosition = saved.pos;
        }
        if (!saved?.pinned) {
          return;
        }

        this.#pinned = true;
        this.#panel.classList.add('pinned');
        this.#shadow.querySelectorAll('.pin-btn').forEach((btn) => {
          btn.classList.add('pinned');
          btn.setAttribute('aria-pressed', 'true');
          btn.setAttribute('title', '取消钉住');
          btn.setAttribute('aria-label', '取消钉住');
        });

        if (this.#pinnedPosition) {
          this.#panel.style.left = `${this.#pinnedPosition.left}px`;
          this.#panel.style.top = `${this.#pinnedPosition.top}px`;
        }
      });
    } catch {
      // ignore storage errors in restricted contexts
    }
    return this;
  }

  #setupDrag() {
    const onHeaderMouseDown = (e) => {
      const target = e.target;
      if (target.closest('button') || target.closest('a')) {
        return;
      }
      if (!this.#pinned) {
        return;
      }

      const rect = this.#panel.getBoundingClientRect();
      this.#dragOffset = {
        dx: e.clientX - rect.left,
        dy: e.clientY - rect.top,
      };
      this.#panel.classList.add('dragging');
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!this.#dragOffset) {
        return;
      }

      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const panelWidth = this.#panel.offsetWidth;
      const panelHeight = this.#panel.offsetHeight;

      let left = e.clientX - this.#dragOffset.dx;
      let top = e.clientY - this.#dragOffset.dy;

      left = Math.max(8, Math.min(left, viewportWidth - panelWidth - 8));
      top = Math.max(8, Math.min(top, viewportHeight - panelHeight - 8));

      this.#panel.style.left = `${left}px`;
      this.#panel.style.top = `${top}px`;
      this.#pinnedPosition = { left, top };
    };

    const onMouseUp = () => {
      if (!this.#dragOffset) {
        return;
      }
      this.#dragOffset = null;
      this.#panel.classList.remove('dragging');
      this.#savePinState();
    };

    this.#shadow.querySelectorAll('.header').forEach((header) => {
      header.addEventListener('mousedown', onHeaderMouseDown);
    });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return this;
  }

  async handleCopyTranslationBtnClick() {
    if (this.#copyResetTimer) {
      return this;
    }

    const translation = this.#translationEl.textContent;
    if (translation) {
      try {
        await navigator.clipboard.writeText(translation);
        this.#copyTranslationBtnEl.classList.add('copied');

        this.#copyResetTimer = setTimeout(() => {
          this.#copyTranslationBtnEl.classList.remove('copied');
          this.#copyResetTimer = null;
        }, 1000);
      } catch (error) {
        console.error('复制译文失败:', error);
      }
    }
  }

  hide(callback, force = false) {
    if (!force && this.#pinned) {
      return this;
    }

    this.#host.classList.remove('is-open');
    this.#host.style.display = 'none';
    this.stopAudio();
    this.#sessionId++;
    if (callback) {
      callback(this.#sessionId);
    }
    return this;
  }

  show(callback) {
    this.#host.style.display = 'block';
    requestAnimationFrame(() => {
      // 确保面板已经显示
      // 假如 `show` 之后在此处之前快速 `hide`, 不应添加 `is-open` 类
      if (this.isShown()) {
        this.#host.classList.add('is-open');
      }
    });

    this.#sessionId++;
    if (callback) {
      callback(this.#sessionId);
    }
    return this;
  }

  isCurrentSession(sessionId) {
    return this.#sessionId === sessionId;
  }

  isShown() {
    return this.#host.style.display !== 'none';
  }

  contains(target) {
    return this.#host === target || this.#host.contains(target);
  }

  updateTheme() {
    const isDark = detectDarkMode();
    this.#host.classList.toggle('dark', isDark);
  }
}
