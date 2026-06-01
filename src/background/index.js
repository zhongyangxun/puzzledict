import { IS_DEV } from '../lib/build-env.js';
import { QUERY_DICT, TRANSLATE_SENTENCE } from '../lib/message-types.js';
import { EXCHANGES } from '../lib/exchanges.js';
import { PRONUNCIATION_FIX_MAP } from '../lib/pronunciation.js';
import { queryDictionary } from '../service/dict-api/dictionary-api.js';
import { initLogger } from './remote-log-client.js';
import { translateText } from '../service/translate/translate.js';

// 仅在开发模式下激活远程日志（initLogger 内部会判断 IS_DEV）
if (IS_DEV) {
  initLogger();
  console.log('🚀 Remote Log Client 已激活');
}

let dict = null;
let wordRoots = null;
let reverseIndex = null;
let clientId = null;
// TODO(rate-limit): dedupe concurrent getClientId() calls to avoid racing multiple UUID writes
// (can cause the same user to be treated as multiple clients briefly, affecting rate limiting metrics).

async function getClientId() {
  if (clientId) return clientId;

  try {
    const { clientId: storedClientId } = await chrome.storage.local.get({
      clientId: null,
    });
    if (storedClientId) {
      clientId = storedClientId;
      return clientId;
    }
  } catch (err) {
    console.log('getClientId error', err);
  }

  clientId = crypto.randomUUID();
  // TODO(rate-limit): wrap storage.set in try/catch and gracefully fall back to in-memory clientId
  // so lookup doesn't fail/hang if storage is temporarily unavailable.
  await chrome.storage.local.set({ clientId });
  return clientId;
}

async function loadDict() {
  if (dict) return dict;

  const url = chrome.runtime.getURL('data/high_freq_words.json');
  const response = await fetch(url);
  dict = await response.json();
  console.log('高频词库已加载，词条数:', Object.keys(dict).length);
  return dict;
}

async function loadWordRoots() {
  if (wordRoots) return wordRoots;

  const url = chrome.runtime.getURL('data/word_roots.json');
  const response = await fetch(url);
  wordRoots = (await response.json()).words;
  console.log('词根库已加载，词条数:', Object.keys(wordRoots).length);
  return wordRoots;
}

async function loadReverseIndex() {
  if (reverseIndex) return reverseIndex;

  const url = chrome.runtime.getURL('data/reverse_index.json');
  const response = await fetch(url);
  reverseIndex = await response.json();

  console.log('反向索引数据已加载，词条数:', Object.keys(reverseIndex).length);

  return reverseIndex;
}

function cleanVariantInfo(translation) {
  const variants = [
    ...new Set([...Object.values(EXCHANGES).map((x) => x.name), '复数']),
  ];
  // 匹配变体信息释义行
  // 例如释义行："say的过去式和过去分词"
  const variantLineReg = new RegExp(
    `^[a-zA-Z]+的(${variants.join('|')})(和(${variants.join('|')}))?$`,
  );
  // 匹配变体信息在释义行中的情况
  // 例如释义行："v. 承认；认出；辨别（recognise的过去分词）"
  const variantWithBracketReg = new RegExp(
    `（[a-zA-Z]+的[^）]*[${variants.join('|')}].*?）`,
  );

  const result = [];
  translation.split('\n').forEach((line) => {
    const variant = line.match(variantLineReg)?.[0];
    const variantWithBracket = line.match(variantWithBracketReg)?.[0];
    if (variant) {
      // 滤去变体信息释义行
      return;
    }

    let newLine = line;

    if (variantWithBracket) {
      // 滤去变体信息
      newLine = line.replace(variantWithBracket, '');
    }

    result.push(newLine);
  });
  return result.join('\n');
}

async function handleQueryDictionary(text) {
  const dict = await loadDict();
  const wordRoots = await loadWordRoots();

  let lookupKey = text;
  let definition = dict[lookupKey];
  let variantInfo = null;
  let errMessage = '';

  if (!definition) {
    lookupKey = text.toLowerCase();
    definition = dict[lookupKey];
  }

  // 查询变体信息
  const reverseIndex = await loadReverseIndex();
  variantInfo = reverseIndex[lookupKey];

  // 三层逐级降级查找（不用 else if，避免中间层失败时跳过后续降级路径）
  // 1. 本地词库直接命中
  // 2. 通过变体信息查原型词（免网络请求）
  // 3. 请求远程 API
  // 4. 有道翻译兜底
  if (definition) {
    // 清洗`translation` 中可能包含的变体信息（变体信息应只由 `variantInfo` 提供）
    const { translation } = definition;
    let newTranslation = cleanVariantInfo(translation);
    // 如果清洗后，`translation` 为空，则尝试使用原型词的 `translation`
    if (!newTranslation && variantInfo) {
      const { exchangeWord } = variantInfo;
      const exchangeWordDefinition = dict[exchangeWord];
      if (exchangeWordDefinition) {
        newTranslation = exchangeWordDefinition.translation;
      }
    }
    // `newTranslation` 不为空，且与原`translation` 不同，则更新`translation`
    if (newTranslation && newTranslation !== translation) {
      definition = {
        ...definition,
        translation: newTranslation,
      };
    }
  }

  // 本地词库未命中，尝试通过变体信息查原型词
  if (!definition && variantInfo) {
    const { exchangeWord } = variantInfo;
    definition = dict[exchangeWord];
  }

  // 仍然没有结果，请求 API
  if (!definition) {
    console.log('请求 API 查词', text);
    const clientId = await getClientId();
    console.log('clientId', clientId);
    const { status, message, data } = await queryDictionary(text, {
      clientId,
      timeoutMs: 2000,
    });
    console.log('response', {
      status,
      message,
      data,
    });

    if (status === 200) {
      definition = data;
      const { translation } = data;
      let newTranslation = cleanVariantInfo(translation);
      if (newTranslation && newTranslation !== translation) {
        definition = {
          ...definition,
          translation: newTranslation,
        };
      }
    } else {
      errMessage = message;
    }
  }

  // 兜底：有道翻译
  if (!definition) {
    try {
      const clientId = await getClientId();
      const { status, data } = await translateText(text, { clientId });
      const translation = data?.translation?.trim();
      const isEchoed = translation?.toLowerCase() === text.trim().toLowerCase();

      if (status === 200 && translation && !isEchoed) {
        return {
          isSuccess: true,
          fallbackTranslation: true,
          data: {
            query: text,
            translation,
          },
        };
      }
    } catch (err) {
      console.error('有道翻译兜底失败', err);
    }
  }

  const root = wordRoots[lookupKey];
  const pronunciationText = PRONUNCIATION_FIX_MAP.has(lookupKey)
    ? PRONUNCIATION_FIX_MAP.get(lookupKey)
    : lookupKey;

  if (definition) {
    return {
      isSuccess: true,
      data: {
        lookupKey,
        definition,
        root,
        variantInfo,
        pronunciationText,
      },
    };
  } else {
    return {
      isSuccess: false,
      message: errMessage,
    };
  }
}

async function handleTranslateSentence(text) {
  const clientId = await getClientId();
  const { status, message, data } = await translateText(text, { clientId });
  return {
    isSuccess: status === 200,
    message,
    data,
  };
}

// 插件安装或更新时触发
chrome.runtime.onInstalled.addListener(() => {
  console.log('插件已安装/更新');
  // 加载词典、反向索引和词根库
  loadDict();
  loadReverseIndex();
  loadWordRoots();
});

// 监听标签页更新（例如刷新页面）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    console.log(`标签页 ${tabId} 已刷新: ${tab.url}`);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === QUERY_DICT) {
    const { text } = message;
    handleQueryDictionary(text).then(sendResponse);
    // sendResponse 将异步调用，需同步返回 true 以保持消息通道开放（否则 service worker 唤醒后端口会提前关闭）
    return true;
  }
  if (message.type === TRANSLATE_SENTENCE) {
    const { text } = message;
    handleTranslateSentence(text).then(sendResponse);
    return true;
  }
});
