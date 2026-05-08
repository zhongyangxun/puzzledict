import Panel from './panel';
import { getSelectionClientRect } from './selection-rect';

console.log('content script load');

const panel = Panel.create();

const shouldTranslate = (text) => {
  const trimmedText = text.trim();
  if (trimmedText.length < 2 || trimmedText.length > 5000) return false;
  const singleWordRegex = /^[a-zA-Z]+(?:[''-][a-zA-Z]+)?$/;
  return singleWordRegex.test(trimmedText);
};

document.addEventListener('mouseup', async (e) => {
  if (panel.contains(e.target)) {
    return;
  }

  const selection = document.getSelection();
  const text = selection.toString().trim();

  if (!shouldTranslate(text)) {
    return;
  }

  const rect = getSelectionClientRect(selection, e);

  panel.resetPanel().setLoading().setPosition(rect).show();

  const response = await chrome.runtime.sendMessage({
    type: 'translate',
    text,
  });

  console.log('response', response);

  const { data, message } = response;

  const {
    lookupKey = text,
    definition,
    root,
    variantInfo,
    pronunciationText,
  } = data || {};

  panel.stopLoading().setContent({
    word: lookupKey,
    definition,
    root,
    variantInfo,
    pronunciationText,
    message,
  });
});

document.addEventListener('mousedown', (e) => {
  if (panel.isShown() && !panel.contains(e.target)) {
    panel.hide().resetPanel();
  }
});
