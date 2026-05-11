import Panel from './panel';
import { getSelectionClientRect } from './selection-rect';

console.log('content script load');

const panel = Panel.create();

const isSingleWord = (text) => {
  const trimmedText = text.trim();
  if (trimmedText.length < 2 || trimmedText.length > 5000) return false;
  const singleWordRegex = /^[a-zA-Z]+(?:[''-][a-zA-Z]+)?$/;
  return singleWordRegex.test(trimmedText);
};

const isPhrase = (text) => {
  const trimmed = text.trim();

  // 1. 排除单字（已经由 isSingleWord 处理）
  // 2. 必须包含空格
  const hasSpace = /\s+/.test(trimmed);

  // 3. 统计单词数：通常短语在 2-6 个单词之间
  const wordCount = trimmed.split(/\s+/).length;

  // 4. 排除含有明显句子特征的标点
  const hasSentenceEnd = /[.!?。！？\n]/.test(trimmed);

  // 逻辑：有空格 且 单词数在 2-10 之间 且 没有句尾标点
  return hasSpace && wordCount > 1 && wordCount <= 10 && !hasSentenceEnd;
};

const queryDictionary = async (text) => {
  const response = await chrome.runtime.sendMessage({
    type: 'translate',
    text,
  });

  console.log('response', response);

  return response;
};

document.addEventListener('mouseup', async (e) => {
  if (panel.contains(e.target)) {
    return;
  }

  const selection = document.getSelection();
  const trimed = selection.toString().trim();

  if (isSingleWord(trimed) || isPhrase(trimed)) {
    const rect = getSelectionClientRect(selection, e);
    panel.resetPanel().setLoading().setPosition(rect).show();

    const response = await queryDictionary(trimed);
    const { data, message } = response;

    const {
      lookupKey = trimed,
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
  }
});

document.addEventListener('mousedown', (e) => {
  if (panel.isShown() && !panel.contains(e.target)) {
    panel.hide().resetPanel();
  }
});
