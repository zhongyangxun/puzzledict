// 将一个批次的词根标注合并进 data/word_roots.json
//
// 用法：
//   node scripts/merge-word-roots.js <batchFile> [--force]
//
// 批次文件格式（JSON）：
//   {
//     "words":   { "<word>": { "roots": [...], "composition"?: "..." }, ... },
//     "noRoots": ["<word>", ...]
//   }
//
// 行为：
//   - words 合并进 word_roots.json 的 words（默认拒绝覆盖已存在的键，除非 --force）
//   - noRoots 追加进 _meta.checkedNoRoots（去重）
//   - 重算 _meta.annotatedWords / _meta.totalWords（= 已标注 + checkedNoRoots）
//   - 保持既有插入顺序，新词按批次给出的顺序追加在末尾

import fs from 'fs';
import { resolve } from 'path';
import { REPO_ROOT } from './constans.js';

const batchArg = process.argv[2];
const force = process.argv.includes('--force');

if (!batchArg) {
  console.error('用法: node scripts/merge-word-roots.js <batchFile> [--force]');
  process.exit(1);
}

const WORD_ROOTS_FILE = resolve(REPO_ROOT, 'data/word_roots.json');
const BATCH_FILE = resolve(REPO_ROOT, batchArg);

const data = JSON.parse(fs.readFileSync(WORD_ROOTS_FILE, 'utf8'));
const batch = JSON.parse(fs.readFileSync(BATCH_FILE, 'utf8'));

const words = data.words || {};
const noRoots = data._meta.checkedNoRoots || [];

const existingKeys = new Set([...Object.keys(words), ...noRoots]);

// 1. 合并有词根的标注
const batchWords = batch.words || {};
const conflicts = [];
let addedWords = 0;

for (const [word, entry] of Object.entries(batchWords)) {
  if (existingKeys.has(word) && !force) {
    conflicts.push(word);
    continue;
  }
  words[word] = entry;
  existingKeys.add(word);
  addedWords += 1;
}

// 2. 合并无词根的词（去重）
const batchNoRoots = batch.noRoots || [];
let addedNoRoots = 0;

for (const word of batchNoRoots) {
  if (existingKeys.has(word) && !force) {
    if (!noRoots.includes(word)) conflicts.push(word);
    continue;
  }
  if (!noRoots.includes(word)) {
    noRoots.push(word);
    existingKeys.add(word);
    addedNoRoots += 1;
  }
}

if (conflicts.length > 0) {
  console.warn(
    `⚠️  ${conflicts.length} 个词已存在，已跳过（用 --force 可覆盖）:\n   ${conflicts
      .slice(0, 30)
      .join(', ')}${conflicts.length > 30 ? ' ...' : ''}`,
  );
}

// 3. 重算 _meta
data._meta.checkedNoRoots = noRoots;
data._meta.annotatedWords = Object.keys(words).length;
data._meta.totalWords = data._meta.annotatedWords + noRoots.length;
data.words = words;

fs.writeFileSync(WORD_ROOTS_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

console.log('✅ 合并完成');
console.log(`   新增已标注词: ${addedWords}`);
console.log(`   新增无词根词: ${addedNoRoots}`);
console.log(`   当前 annotatedWords: ${data._meta.annotatedWords}`);
console.log(`   当前 checkedNoRoots: ${noRoots.length}`);
console.log(`   当前 totalWords: ${data._meta.totalWords}`);
