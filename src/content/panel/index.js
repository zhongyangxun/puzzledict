import panelHtml from './index.html';
import {
  TRANSLATE_FAILED_MESSAGE,
  NOT_FOUND_MESSAGE,
} from '../../lib/result-messages.js';
import { createShadowHost } from '../../lib/shadow-host.js';
import { detectDarkMode, initThemeObserver } from '../../lib/theme.js';
import {
  clearSelection,
  calculateShowPosition,
  getSelectionEndPointRect,
  SELECTION_GAP,
} from '../selection-rect.js';

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

// 内容区至少保留约 3 行文本（padding-top 12 + 3 × 22.75）
const MIN_CONTENT_HEIGHT = 80;

// Common English voices: Chrome / Edge / macOS.
const PREFERRED_ENGLISH_VOICES = [
  'google us english',
  'microsoft aria',
  'samantha',
];

export const PANEL_MODE = {
  DICT: 'dict',
  TRANSLATE: 'translate',
};

function pickEnglishVoice(voices) {
  for (const preferred of PREFERRED_ENGLISH_VOICES) {
    const match = voices.find((voice) =>
      voice.name.toLowerCase().includes(preferred),
    );
    if (match) {
      return match;
    }
  }
  return null;
}

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
  #voice = null;
  #speakTimer = null;

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

    // 内容渲染、展开原文、骨架屏切换等都会改变面板尺寸，统一在此重新定位
    const resizeObserver = new ResizeObserver(() => {
      if (this.isShown() && this.#selectActionInfo) {
        this.updatePosition();
      }
    });
    // 只观察高度由内容决定、不受 --panel-max-height 影响的元素，
    // 否则 updatePosition 收紧上限会再次触发自身，形成反馈环
    shadow
      .querySelectorAll('.header, .content > *, .footer')
      .forEach((el) => resizeObserver.observe(el));

    this.setMode(PANEL_MODE.DICT);
    this.hide();
  }

  static create() {
    if (Panel.#instance) {
      return Panel.#instance;
    }

    const { host, shadow } = createShadowHost({
      id: 'puzzledict-panel',
      html: panelHtml,
    });

    Panel.#instance = new Panel(host, shadow);
    return Panel.#instance;
  }

  get host() {
    return this.#host;
  }

  initUtterance() {
    this.resolveVoice();

    // Voices often load asynchronously; refresh when the list becomes available.
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.addEventListener('voiceschanged', () => {
        this.resolveVoice();
      });
    }

    return this;
  }

  resolveVoice() {
    if (typeof speechSynthesis === 'undefined') {
      return this;
    }

    this.#voice = pickEnglishVoice(speechSynthesis.getVoices());
    return this;
  }

  setPosition(selectActionInfo) {
    this.#selectActionInfo = selectActionInfo;
    return this.updatePosition();
  }

  updatePosition() {
    if (!this.#selectActionInfo) {
      console.warn('selectActionInfo is not set');
      return this;
    }
    // 先移除上次按可用空间收紧的上限，才能测到内容的自然高度
    this.#panel.style.removeProperty('--panel-max-height');
    const { x, y, maxHeight } = calculateShowPosition(
      this.#panel,
      this.#selectActionInfo,
      { minHeight: this.getMinHeight() },
    );

    this.#panel.style.left = `${x}px`;
    this.#panel.style.top = `${y}px`;
    this.#panel.style.setProperty('--panel-max-height', `${maxHeight}px`);

    const selectionEndPointRect = getSelectionEndPointRect(
      this.#selectActionInfo.selection,
      this.#selectActionInfo.mousePosition,
    );
    const isSelectionAbovePanel =
      y < selectionEndPointRect.bottom + SELECTION_GAP;
    this.#panel.classList.toggle('enter-from-above', isSelectionAbovePanel);
    this.#panel.classList.toggle('enter-from-below', !isSelectionAbovePanel);
    return this;
  }

  getMinHeight() {
    const content = this.#panel.querySelector(
      `.${this.#mode}-section > .content`,
    );
    // 面板高度减去内容区可视高度，即内边距 + 头部 + 底部
    const chromeHeight = this.#panel.offsetHeight - content.clientHeight;
    return chromeHeight + Math.min(content.scrollHeight, MIN_CONTENT_HEIGHT);
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

    if (!this.#voice) {
      this.resolveVoice();
    }

    this.stopAudio();

    // Chrome may drop speech if speak() runs immediately after cancel().
    this.#speakTimer = setTimeout(() => {
      this.#speakTimer = null;

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = this.#voice?.lang || 'en-US';
      utterance.rate = text.trim().split(/\s+/).length <= 2 ? 0.88 : 0.95;
      utterance.pitch = 1;
      if (this.#voice) {
        utterance.voice = this.#voice;
      }

      utterance.onend = () => {
        this.stopAudio();
      };
      utterance.onerror = () => {
        this.stopAudio();
      };

      this.#utterance = utterance;
      speechSynthesis.speak(utterance);
      this.#panel.classList.add('playing');
    }, 20);

    return this;
  }

  stopAudio() {
    if (this.#speakTimer != null) {
      clearTimeout(this.#speakTimer);
      this.#speakTimer = null;
    }

    if (this.#utterance) {
      this.#utterance.onend = null;
      this.#utterance.onerror = null;
      this.#utterance = null;
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

  getPhoneticText(phonetic) {
    if (!phonetic) return '发音:';

    let phoneticText = phonetic;

    // only pick the first one if there are multiple phonetic symbols (separated by ';')
    if (phoneticText.includes(';')) {
      [phoneticText] = phoneticText.split(';');
    }

    return `/${phoneticText}/`;
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
      const phoneticText = this.getPhoneticText(phonetic);

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
    this.#panel.style.removeProperty('--panel-max-height');
    this.#shadow.querySelectorAll('.content, .source-text').forEach((el) => {
      el.scrollTop = 0;
    });

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
    this.hide();
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

  hide(callback) {
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
