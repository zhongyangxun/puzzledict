import { initLogger } from './remote-log-client.js';
import { FORCE_API } from '../lib/build-env.js';
import { EXCHANGES } from '../lib/exchanges.js';
import {
  PRECONNECT,
  QUERY_DICT,
  TRANSLATE_SENTENCE,
} from '../lib/message-types.js';
import { logMarks, markTiming } from '../lib/perf.js';
import { PRONUNCIATION_FIX_MAP } from '../lib/pronunciation.js';
import {
  DICT_FAILED_MESSAGE,
  TRANSLATE_FAILED_MESSAGE,
  TRANSLATE_SUCCESS_MESSAGE,
} from '../lib/result-messages.js';
import { queryDictionary } from '../service/dict-api/dictionary-api.js';
import { preconnect } from '../service/preconnect.js';
import {
  getTranslateCache,
  setTranslateCache,
} from '../service/translate/cache.js';
import { translateText } from '../service/translate/translate.js';

markTiming('sw-eval');

// 仅在开发模式或性能分析模式下激活远程日志（initLogger 内部会判断 IS_DEV 和 PERF）
initLogger();

let dict = null;
let dictPromise = null;
let wordRoots = null;
let wordRootsPromise = null;
let reverseIndex = null;
let reverseIndexPromise = null;
let clientId = null;
let clientIdPromise = null;

async function getClientId() {
  if (clientId) return clientId;
  if (!clientIdPromise) {
    clientIdPromise = initClientId();
  }
  return clientIdPromise;
}

async function initClientId() {
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

  try {
    await chrome.storage.local.set({ clientId });
  } catch (err) {
    console.log('setClientId error', err);
  }

  return clientId;
}

// * must keep `async` to ensure returning a promise
async function loadDict() {
  if (dict) return dict;
  if (!dictPromise) {
    dictPromise = loadDictImpl().catch((err) => {
      dictPromise = null;
      throw err;
    });
  }
  return dictPromise;
}

async function loadDictImpl() {
  const url = chrome.runtime.getURL('data/high_freq_words.json');
  const response = await fetch(url);
  dict = await response.json();

  if (FORCE_API) {
    const proxyDict = new Proxy(dict, {
      get() {
        console.warn('FORCE_API is enabled, dict is not available');
        return null;
      },
    });
    dict = proxyDict;
  }

  markTiming('dict.ready');
  console.log('高频词库已加载，词条数:', Object.keys(dict).length);
  return dict;
}

async function loadWordRoots() {
  if (wordRoots) return wordRoots;
  if (!wordRootsPromise) {
    wordRootsPromise = loadWordRootsImpl().catch((err) => {
      wordRootsPromise = null;
      throw err;
    });
  }
  return wordRootsPromise;
}

async function loadWordRootsImpl() {
  const url = chrome.runtime.getURL('data/word_roots.json');
  const response = await fetch(url);
  wordRoots = (await response.json()).words;
  markTiming('wordRoots.ready');
  console.log('词根库已加载，词条数:', Object.keys(wordRoots).length);
  return wordRoots;
}

async function loadReverseIndex() {
  if (reverseIndex) return reverseIndex;
  if (!reverseIndexPromise) {
    reverseIndexPromise = loadReverseIndexImpl().catch((err) => {
      reverseIndexPromise = null;
      throw err;
    });
  }
  return reverseIndexPromise;
}

async function loadReverseIndexImpl() {
  const url = chrome.runtime.getURL('data/reverse_index.json');
  const response = await fetch(url);
  reverseIndex = await response.json();
  markTiming('reverseIndex.ready');
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
  const [dict, reverseIndex] = await Promise.all([
    loadDict(),
    loadReverseIndex(),
  ]);

  const rootsPromise = loadWordRoots().catch((err) => {
    console.error('loadWordRoots error', err);
    return {};
  });

  let lookupKey = text;
  let definition = dict[lookupKey];
  let variantInfo = null;
  let errMessage = '';

  if (!definition) {
    lookupKey = text.toLowerCase();
    definition = dict[lookupKey];
  }

  // 查询变体信息
  variantInfo = reverseIndex[lookupKey];

  // 获取原型词
  const exchangeWord = variantInfo?.exchangeWord ?? lookupKey;

  // 逐级降级查找（不用 else if，避免中间层失败时跳过后续降级路径）
  // 1. 本地词库直接命中
  // 2. 通过变体信息查原型词（免网络请求）
  // 3. 查询兜底翻译缓存
  // 4. 请求远程 API
  // 5. 有道翻译兜底
  if (definition) {
    // 清洗`translation` 中可能包含的变体信息（变体信息应只由 `variantInfo` 提供）
    const { translation } = definition;
    let newTranslation = cleanVariantInfo(translation);
    // 如果清洗后，`translation` 为空，则尝试使用原型词的 `translation`
    if (!newTranslation && variantInfo) {
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
    definition = dict[exchangeWord];
  }

  // 提前查询兜底翻译缓存，避免兜底翻译时才查到缓存，浪费一次失败的词典 API 查询
  if (!definition) {
    const cache = await readTranslateCache(text);
    if (cache) {
      return {
        isSuccess: true,
        fallbackTranslation: true,
        data: {
          query: text,
          translation: cache.translation,
        },
      };
    }
  }

  // 仍然没有结果，请求 API
  if (!definition) {
    markTiming('api.dict.start');
    let status = null;
    let message = null;
    let data = null;
    try {
      const clientId = await getClientId();
      ({ status, message, data } = await queryDictionary(text, { clientId }));
    } catch (err) {
      console.error('请求 API 查词失败', err);
      status = 500;
      message = DICT_FAILED_MESSAGE;
    }

    markTiming('api.dict.end');
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

  // 兜底：有道翻译。缓存与回声判断由 handleTranslateSentence 负责
  if (!definition) {
    const translated = await handleTranslateSentence(text);
    if (translated.isSuccess) {
      return {
        isSuccess: true,
        fallbackTranslation: true,
        data: {
          query: text,
          translation: translated.data.translation,
        },
      };
    }

    // 回声或空白译文保留词典阶段的错误信息
    if (translated.status !== 200) {
      errMessage = translated.message;
    }
  }

  let root = null;
  // lookup success, try to get root
  if (definition) {
    const wordRoots = await rootsPromise;
    root =
      wordRoots[lookupKey] ||
      // `wordRoots[lookupKey]` 不存在，则尝试查询原型词的词根
      wordRoots[exchangeWord];
  }

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

// 可用译文：去掉空白后仍有内容，并且不是原文回声（忽略大小写）
function usableTranslation(text, translation) {
  const trimmedTranslation = translation?.trim() ?? '';
  const hasContent = trimmedTranslation !== '';
  const isEcho = trimmedTranslation.toLowerCase() === text.trim().toLowerCase();

  if (hasContent && !isEcho) return trimmedTranslation;
  return '';
}

async function readTranslateCache(text) {
  if (FORCE_API) return null;
  try {
    const cache = await getTranslateCache(text.trim());
    const translation = usableTranslation(text, cache?.translation);
    return translation ? { ...cache, translation } : null;
  } catch (err) {
    // 缓存仅用于优化，读取失败时继续请求远程 API
    console.error('读取翻译缓存失败', err);
    return null;
  }
}

async function handleTranslateSentence(text) {
  markTiming('api.translate.start');
  try {
    const cache = await readTranslateCache(text);
    if (cache) {
      return {
        isSuccess: true,
        status: 200,
        message: TRANSLATE_SUCCESS_MESSAGE,
        data: cache,
      };
    }

    const clientId = await getClientId();
    const { status, message, data } = await translateText(text, { clientId });
    const translation = usableTranslation(text, data?.translation);

    if (status === 200 && translation) {
      const cached = { ...data, translation };
      if (!FORCE_API) {
        await setTranslateCache(text.trim(), cached);
      }
      return {
        isSuccess: true,
        status,
        message,
        data: cached,
      };
    }

    return {
      isSuccess: false,
      status,
      message: status === 200 ? TRANSLATE_FAILED_MESSAGE : message,
      data: null,
    };
  } catch (err) {
    console.error('有道翻译失败', err);
    return {
      isSuccess: false,
      status: 500,
      message: TRANSLATE_FAILED_MESSAGE,
      data: null,
    };
  } finally {
    markTiming('api.translate.end');
  }
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
  markTiming(`msg.received.${message.type}`);

  switch (message.type) {
    case QUERY_DICT: {
      const { text } = message;
      handleQueryDictionary(text).then((res) => {
        markTiming('response.sent');
        logMarks();
        sendResponse(res);
      });
      // sendResponse 将异步调用，需同步返回 true 以保持消息通道开放（否则 service worker 唤醒后端口会提前关闭）
      return true;
    }
    case TRANSLATE_SENTENCE: {
      const { text } = message;
      handleTranslateSentence(text).then((res) => {
        markTiming('response.sent');
        logMarks();
        sendResponse(res);
      });
      return true;
    }
    case PRECONNECT: {
      markTiming('preconnect.select-text.start');
      preconnect().finally(() => {
        markTiming('preconnect.select-text.end');
      });
    }
  }
});
