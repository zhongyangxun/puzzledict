# Data 文件夹说明

此文件夹用于存放词典数据和词根数据。

**文件一览**（按阅读顺序）

- **常用词** → [`high_freq_words.json`](./high_freq_words.json)（主词典）
- **重点测试词** → [`priority_test_words.json`](./priority_test_words.json)（由常用词按规则筛出，[说明](#priority_test_words)）
- **高频词词根标注** → [`word_roots.json`](./word_roots.json)
- **词根库** → [`roots/`](./roots/) / [`roots.json`](./roots.json)

<a id="high-freq-word-data"></a>

## 常用词数据

[high_freq_words.json](./high_freq_words.json)

数据来源：[Github: skywind3000/ECDICT](https://github.com/skywind3000/ECDICT)（MIT，许可全文见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md#ecdict)）

### 数据说明

数据示例：

```json
{
  "hello": {
    "phonetic": "hә'lәu",
    "translation": "interj. 喂, 嘿",
    "exchange": "s:hellos"
  }
}
```

**字段说明**
| 字段 | 含义 | 示例 |
|------|------|------|
| `phonetic` | 音标 | hә'lәu |
| `translation` | 中文释义 | 喂, 你好 |
| `exchange` | 词形变化 | p:ran/d:run/i:running |

#### `exchange` 字段格式解读

```
s:hellos
│  │
│  └── hellos = hello 的复数形式
└──── s = 复数 (plural)
```

**hello** 虽然是感叹词，但也可以当名词用（比如 "say your hellos"），所以有复数形式。

**完整的变体代码表**

| 代码 | 英文                | 含义         | 示例                    |
| ---- | ------------------- | ------------ | ----------------------- |
| `s`  | plural              | 复数         | cat → cats              |
| `p`  | past tense          | 过去式       | run → ran               |
| `d`  | past participle     | 过去分词     | run → run               |
| `i`  | present participle  | 现在分词     | run → running           |
| `3`  | 3rd person singular | 第三人称单数 | run → runs              |
| `r`  | comparative         | 比较级       | big → bigger            |
| `t`  | superlative         | 最高级       | big → biggest           |
| `0`  | lemma               | 原型词       | running → run           |
| `1`  | lemma variant       | 原型变体     | color → colour, colours |

<a id="priority_test_words"></a>

### 反向索引数据

由变体指向原型的索引

数据文件：[reverse-index.json](./reverse_index.json)

数据示例：

```json

"chapters": {
    "deals": {
    "exchangeWord": "deal",
    "types": [
      "s",
      "3"
    ],
    "typeNames": [
      "复数形式",
      "第三人称单数"
    ]
  },
}
```

**字段说明**
| 字段 | 含义 |
| --- | --- |
| `exchangeWord` | 原型词 |
| `types` | 变体类型数组（参考上文变体代码表） |
| `typeNames` | 变体类型名称数组（与 `types` 字段中的数据一一对应） |

### 重点测试数据

数据文件：[priority_test_words.json](./priority_test_words.json)

由上文 [常用词数据](#high-freq-word-data) 中的 `high_freq_words.json` 按规则筛出，用于扩展/手测时优先覆盖的词条子集。

**筛选标准**

- 释义中至少有一行同时满足：不含 `.`，且未同时包含 `[` 与 `]`（缺括号或只有半边即命中）

**筛选说明**

运行脚本 [extract-priority-test-words.js](/scripts/extract-priority-test-words.js)，即可筛选。
例如，在项目根目录执行如下命令：

```bash
node ./script/extract-priority_test_words.js
```

## 高频词词根词缀标注

数据：[word_roots.json](./word_roots.json)

对常用词数据中前 10000 个高频词进行 AI 词根词缀标注，记录每个词的构词成分及其语源含义。其中约 5700 个词有可拆解的词根词缀（收入 `words`），其余功能词、专有名词、基础日耳曼词等无明显词根的词收入 `_meta.checkedNoRoots`。

### 数据说明

数据分为两个顶层字段：

- `_meta`：元信息，包括版本号、总词数、已标注词数，以及已确认无词根（功能词、专有名词等）的词列表 `checkedNoRoots`。
- `words`：标注结果，以单词为键，值包含以下字段：

| 字段          | 含义                                                     | 是否必填 |
| ------------- | -------------------------------------------------------- | -------- |
| `roots`       | 词根/词缀列表，每项含 `root`（形式）和 `meaning`（含义） | 是       |
| `composition` | 构词拆解说明，解释各成分如何组合成当前词义               | 否       |

### 数据示例

```json
{
  "development": {
    "roots": [
      {
        "root": "de-",
        "meaning": "去除"
      },
      {
        "root": "velop",
        "meaning": "包裹"
      },
      {
        "root": "-ment",
        "meaning": "名词后缀"
      }
    ],
    "composition": "de-（去除）+ velop（包裹）+ -ment → 展开 → 发展"
  }
}
```

## 词根数据

CSV 数据：[roots](./roots/)

JSON 数据：[root.json](./roots.json)

数据来源：[Wikipedia: List of Greek and Latin roots in English](https://en.wikipedia.org/wiki/List_of_Greek_and_Latin_roots_in_English)（[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)，归属说明见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md#word-roots-wikipedia)）

数据处理方式：用 [Wikitable2CSV](https://wikitable2csv.ggor.de/) 将原数据表格导出为 CSV，再利用[脚本](../scripts/merge-roots.js)转成 JSON 数据。

Wikitable2CSV 页面会有多个 CSV 表格，可用下面的代码片段一次性触发所有表格的下载：

```javascript
document.querySelectorAll('a[download]').forEach((a) => {
  a.click();
});
```

## 许可与归属

本目录 JSON / CSV 所涉第三方数据及 `word_roots.json` 原创标注说明，见项目根目录 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。
