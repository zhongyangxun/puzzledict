export const detectDarkMode = () => {
  const isSystemDark = window.matchMedia(
    '(prefers-color-scheme: dark)',
  ).matches;
  const html = document.documentElement;
  const body = document.body;

  // 1. 检查 color-scheme
  const cs = getComputedStyle(html).colorScheme;
  if (cs.includes('dark') && !cs.includes('light')) return true;

  // 2. 检查常见暗色模式标志
  const darkIndicators = [
    html.classList.contains('dark'),
    html.dataset.theme === 'dark',
    html.dataset.colorMode === 'dark',
    body?.classList.contains('dark'),
    body?.dataset.theme === 'dark',
  ];
  if (darkIndicators.some(Boolean)) return true;

  // 3. 系统保底
  return isSystemDark;
};

let mediaQueryListened = false;
let themeObserver = null;

const callbacks = [];
const mainCallback = () => {
  callbacks.forEach((callback) => callback());
};

export const initThemeObserver = (callback) => {
  callbacks.push(callback);
  callback();

  // 监听系统主题变化
  if (!mediaQueryListened) {
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', mainCallback);
    mediaQueryListened = true;
  }

  // 监听宿主页面 class/attribute 变化
  if (!themeObserver) {
    themeObserver = new MutationObserver(mainCallback);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-color-mode'],
    });

    if (document.body) {
      themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'data-color-mode'],
      });
    }
  }
};
