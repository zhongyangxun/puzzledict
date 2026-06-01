import { QUERY_DICT, TRANSLATE_SENTENCE } from '../lib/message-types';
import {
  DICT_FAILED_MESSAGE,
  TRANSLATE_FAILED_MESSAGE,
} from '../lib/result-messages.js';
import Panel, { PANEL_MODE } from './panel';
import LogoButton from './logo-button/index.js';
import { clearSelection, getSelectionClientRect } from './selection-rect';

console.log('content script load');

const logoButton = LogoButton.create();

const panel = Panel.create();

// 划词选区规范化：统一空白与排版字符，再交给 isMainlyEnglish / 查词 / 翻译
const normalizeEnglishText = (text) =>
  text
    // 去掉首尾空白
    .trim()
    // 换行、制表等连续空白压成单个空格（跨行选中可通过 isMainlyEnglish）
    .replace(/\s+/g, ' ')
    // 弯单引号、撇号 → ASCII 单引号 '
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    // 弯双引号 → ASCII 双引号 "
    .replace(/[\u201C\u201D\u201E]/g, '"')
    // 短破折号、长破折号 → ASCII 连字符 -
    .replace(/[\u2013\u2014]/g, '-');

const isMainlyEnglish = (text) => /^[\x20-\x7E]+$/.test(text);

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

  const errorMessage =
    type === QUERY_DICT ? DICT_FAILED_MESSAGE : TRANSLATE_FAILED_MESSAGE;

  try {
    const response = await chrome.runtime.sendMessage({
      type,
      text,
    });

    console.log('response', response);

    if (!response) {
      return {
        data: null,
        message: errorMessage,
      };
    }

    return response;
  } catch (error) {
    console.error('translate error', error);

    return {
      data: null,
      message: errorMessage,
    };
  }
};

const handlePanelQuery = async (trimed, mode, sessionId) => {
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
      message: DICT_FAILED_MESSAGE,
    };

    // 有道兜底，切换为翻译面板展示
    if (response?.fallbackTranslation) {
      const { query, translation } = response.data || {};

      panel
        .stopLoading()
        .setMode(PANEL_MODE.TRANSLATE)
        .setTranslateContent({
          query: query || trimed,
          translation,
        });
      return;
    }

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
      message: TRANSLATE_FAILED_MESSAGE,
    };
    const { query = trimed, translation } = data || {};

    panel.stopLoading().setTranslateContent({ query, translation, message });
  }
};

const queryInfo = {
  rect: null,
  trimed: null,
  mode: null,
};

const resetQueryInfo = () => {
  Object.keys(queryInfo).forEach((key) => {
    queryInfo[key] = null;
  });
};

const panelShow = () => {
  const { rect } = queryInfo;
  if (!rect) return;

  const { trimed, mode } = queryInfo;

  panel
    .resetPanel()
    .setMode(mode)
    .setLoading()
    .setPosition(rect)
    .show((id) => {
      handlePanelQuery(trimed, mode, id);
    });
};

logoButton.addEventListener('click', () => {
  panelShow();

  logoButton.hide();
});

const logoButtonShow = () => {
  const { rect } = queryInfo;
  if (!rect) return;
  logoButton.setPosition(rect).show();
};

document.addEventListener('mouseup', (e) => {
  if (panel.contains(e.target) || logoButton.contains(e.target)) {
    return;
  }

  const selection = document.getSelection();
  const trimed = normalizeEnglishText(selection.toString());

  if (!trimed || !isMainlyEnglish(trimed)) {
    return;
  }

  if (isSingleWord(trimed) || isPhrase(trimed) || isSentence(trimed)) {
    const rect = getSelectionClientRect(selection, e);
    const mode =
      isSingleWord(trimed) || isPhrase(trimed)
        ? PANEL_MODE.DICT
        : PANEL_MODE.TRANSLATE;

    queryInfo.trimed = trimed;
    queryInfo.mode = mode;
    queryInfo.rect = rect;

    logoButtonShow();
  }
});

document.addEventListener('mousedown', (e) => {
  if (panel.isShown() && !panel.contains(e.target)) {
    clearSelection();
    panel.hide(() => resetQueryInfo()).resetPanel();
  }
  if (logoButton.isShown() && !logoButton.contains(e.target)) {
    clearSelection();
    logoButton.hide(() => resetQueryInfo());
  }
});
