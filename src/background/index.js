import { EXCHANGES } from '../lib/exchanges.js';
import { PRONUNCIATION_FIX_MAP } from '../lib/pronunciation.js';

let dict = null;
let wordRoots = null;
let reverseIndex = null;

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

async function handleTranslation(text) {
  const dict = await loadDict();
  const wordRoots = await loadWordRoots();

  let lookupKey = text;
  let definition = dict[lookupKey];
  let variantInfo = null;

  if (!definition) {
    lookupKey = text.toLowerCase();
    definition = dict[lookupKey];
  }

  // 查询变体信息
  const reverseIndex = await loadReverseIndex();
  variantInfo = reverseIndex[lookupKey];

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
  // 如果没有 `definition`，则尝试使用变体信息查询原型词的 `definition`
  // 原型词的 `translation` 不用清洗变体信息，因为它不会包含 "xx的复数", "xx的过去式", "xx的过去分词" 等内容
  else if (variantInfo) {
    const { exchangeWord } = variantInfo;
    definition = dict[exchangeWord];
  }

  const root = wordRoots[lookupKey];
  const pronunciationText = PRONUNCIATION_FIX_MAP.has(lookupKey)
    ? PRONUNCIATION_FIX_MAP.get(lookupKey)
    : lookupKey;

  if (definition) {
    return {
      lookupKey,
      definition,
      root,
      variantInfo,
      pronunciationText,
    };
  } else {
    // TODO: 请求 API 查词
    return {
      definition: null,
      root: null,
    };
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
  if (message.type === 'translate') {
    const { text } = message;
    handleTranslation(text).then(sendResponse);
    // sendResponse 将异步调用，需同步返回 true 以保持消息通道开放（否则 service worker 唤醒后端口会提前关闭）
    return true;
  }
});
