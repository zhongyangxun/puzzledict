// 划词选区的文本预处理与拉丁文字判定，纯函数，不依赖 DOM 与扩展 API

// 从 PDF 复制的文本常带连字（ligature），不展开会导致查词必然落空
const LIGATURES = {
  '\uFB00': 'ff',
  '\uFB01': 'fi',
  '\uFB02': 'fl',
  '\uFB03': 'ffi',
  '\uFB04': 'ffl',
};

// 划词选区规范化：统一空白与排版字符，再交给拉丁文字判定 / 查词 / 翻译
// 只折叠有 ASCII 等价物的排版变体；° £ é 等承载语义的字符原样保留
export const normalizeEnglishText = (text) =>
  text
    // 零宽字符与软连字符：两端对齐的排版会插入它们，留着会静默切断单词
    .replace(/[\u200B\u200C\u200D\u00AD]/g, '')
    // 连字 → 普通字母
    .replace(/[\uFB00-\uFB04]/g, (ligature) => LIGATURES[ligature])
    // 去掉首尾空白
    .trim()
    // 换行、制表等连续空白压成单个空格（跨行选中可通过拉丁文字判定）
    // `\s` 已覆盖 NBSP(U+00A0)、窄空格(U+202F)、全角空格(U+3000) 等
    .replace(/\s+/g, ' ')
    // 弯单引号、撇号 → ASCII 单引号 '
    .replace(/[\u2018\u2019\u201A\u2032\u02BC]/g, "'")
    // 弯双引号、双撇号 → ASCII 双引号 "
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    // 各类破折号、减号 → ASCII 连字符 -
    .replace(/[\u2012\u2013\u2014\u2015\u2212]/g, '-')
    // 省略号 → ...
    .replace(/\u2026/g, '...')
    // 度符号的各种写法 → U+00B0，如误用 ring above 的 ˚C、合字 ℃
    .replace(/\u02DA/g, '\u00B0')
    .replace(/\u2103/g, '\u00B0C')
    .replace(/\u2109/g, '\u00B0F');

const LATIN_LETTER = /\p{Script=Latin}/u;
const ANY_LETTER = /\p{L}/u;

// 非拉丁字母占比上限：留有余量，容忍英文句子里夹带个别汉字（如 The character 好 means good）
const NON_LATIN_LETTER_RATIO_LIMIT = 0.2;

// 只按字母比例判定：非拉丁字母一律计入另一侧；标点、数字与符号不参与统计
// 这里只能识别拉丁文字，无法区分英语、法语、德语等具体语言
export const isMainlyLatinText = (text) => {
  let latinCount = 0;
  let nonLatinCount = 0;

  // 逐码点遍历，避免把代理对拆成两个半字符
  for (const char of text) {
    if (LATIN_LETTER.test(char)) {
      latinCount += 1;
    } else if (ANY_LETTER.test(char)) {
      nonLatinCount += 1;
    }
  }

  // 一个拉丁字母都没有时（纯数字、纯符号、纯表情）不值得弹窗
  if (latinCount === 0) return false;

  return (
    nonLatinCount / (latinCount + nonLatinCount) <= NON_LATIN_LETTER_RATIO_LIMIT
  );
};
