import { QUERY_DICT, TRANSLATE_SENTENCE } from '../lib/message-types';
import Panel, { PANEL_MODE } from './panel';
import { getSelectionClientRect } from './selection-rect';

console.log('content script load');

const panel = Panel.create();
const FALLBACK_MESSAGE = '请求翻译失败，请稍后重试';

const isMainlyEnglish = (text) => /^[\x20-\x7E]+$/.test(text.trim());

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

const isSentence = (text) => {
  const trimmed = text.trim();
  if (trimmed.length < 2 || trimmed.length > 5000) return false;

  const wordCount = trimmed.split(/\s+/).length;
  const hasSentenceEnd = /[.!?。！？\n]/.test(trimmed);

  return wordCount > 10 || hasSentenceEnd;
};

const requestLookup = async (text, type) => {
  if (!chrome.runtime?.id) {
    return { data: null, message: '扩展已更新，请刷新页面后重试' };
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type,
      text,
    });

    console.log('response', response);

    if (!response) {
      return {
        data: null,
        message: FALLBACK_MESSAGE,
      };
    }

    return response;
  } catch (error) {
    console.error('translate error', error);

    return {
      data: null,
      message: FALLBACK_MESSAGE,
    };
  }
};

document.addEventListener('mouseup', async (e) => {
  if (panel.contains(e.target)) {
    return;
  }

  const selection = document.getSelection();
  const trimed = selection.toString().trim();

  if (!isMainlyEnglish(trimed)) {
    return;
  }

  if (isSingleWord(trimed) || isPhrase(trimed) || isSentence(trimed)) {
    const rect = getSelectionClientRect(selection, e);
    let sessionId = null;
    const mode =
      isSingleWord(trimed) || isPhrase(trimed)
        ? PANEL_MODE.DICT
        : PANEL_MODE.TRANSLATE;

    panel
      .resetPanel()
      .setMode(mode)
      .setLoading()
      .setPosition(rect)
      .show((id) => {
        sessionId = id;
      });

    let response = null;

    if (mode === PANEL_MODE.DICT) {
      response = await requestLookup(trimed, QUERY_DICT);
    } else {
      response = await requestLookup(trimed, TRANSLATE_SENTENCE);
    }

    // 若 sessionId 已变更（新查询或已关闭面板），则丢弃本次结果，避免竞态问题
    if (!panel.isCurrentSession(sessionId)) {
      console.log('sessionId mismatch, abort');
      return;
    }

    if (mode === PANEL_MODE.DICT) {
      const { data, message } = response || {
        data: null,
        message: FALLBACK_MESSAGE,
      };

      const {
        lookupKey = trimed,
        definition,
        root,
        variantInfo,
        pronunciationText,
      } = data || {};

      panel.stopLoading().setDictContent({
        word: lookupKey,
        definition,
        root,
        variantInfo,
        pronunciationText,
        message,
      });
    }

    if (mode === PANEL_MODE.TRANSLATE) {
      console.log('translate response', response);

      const { data, message } = response || {
        data: null,
        message: FALLBACK_MESSAGE,
      };
      const { query = trimed, translation } = data;

      panel.stopLoading().setTranslateContent({ query, translation, message });
    }
  }
});

document.addEventListener('mousedown', (e) => {
  if (panel.isShown() && !panel.contains(e.target)) {
    panel.hide().resetPanel();
  }
});
