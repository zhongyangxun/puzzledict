import { detectDarkMode, initThemeObserver } from '../../lib/theme';
import logoButtonHtml from './index.html';
import { calculateShowPosition } from '../selection-rect.js';

export default class LogoButton {
  static #instance = null;
  #host = null;
  #logoButtonEl = null;

  constructor(host, shadow) {
    this.#host = host;
    this.#logoButtonEl = shadow.querySelector('.logo-button');

    initThemeObserver(() => this.updateTheme());

    this.hide();
  }

  static create() {
    if (LogoButton.#instance) {
      return LogoButton.#instance;
    }

    const host = document.createElement('div');
    host.id = 'select-to-translate-logo-button';
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = logoButtonHtml;

    document.body.appendChild(host);

    LogoButton.#instance = new LogoButton(host, shadow);
    return LogoButton.#instance;
  }

  show() {
    this.#host.style.display = 'block';
  }

  hide(callback) {
    this.#host.style.display = 'none';
    if (callback) {
      callback();
    }
    return this;
  }

  isShown() {
    return this.#host.style.display !== 'none';
  }

  contains(target) {
    return this.#host === target || this.#host.contains(target);
  }

  setPosition(selectActionInfo) {
    const { x, y } = calculateShowPosition(
      this.#logoButtonEl,
      selectActionInfo,
    );

    this.#logoButtonEl.style.left = `${x}px`;
    this.#logoButtonEl.style.top = `${y}px`;
    return this;
  }

  updateTheme() {
    const isDark = detectDarkMode();
    this.#host.classList.toggle('dark', isDark);
  }

  addEventListener(type, callback) {
    this.#logoButtonEl.addEventListener(type, callback);
    return this;
  }

  removeEventListener(type, callback) {
    this.#logoButtonEl.removeEventListener(type, callback);
    return this;
  }
}
