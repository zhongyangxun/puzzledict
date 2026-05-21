import fs from 'fs';
import { PRIORITY_TEST_WORDS_FILE, REPO_ROOT } from './constans.js';
import { resolve } from 'path';

const TEST_HTML_FILE = resolve(REPO_ROOT, 'test/index.html');

console.log('同步重点测试词到测试页面...');

const priorityTestWords = JSON.parse(
  fs.readFileSync(PRIORITY_TEST_WORDS_FILE, 'utf8'),
);
const testWords = Object.keys(priorityTestWords);
const testHtml = fs.readFileSync(TEST_HTML_FILE, 'utf8');

const newHtml = testHtml.replace(
  /<ul class="words" aria-label="测试用单词">[\s\S]*?<\/ul>/,
  `<ul class="words" aria-label="测试用单词">${testWords.map((word) => `<li>${word}</li>`).join('')}</ul>`,
);

fs.writeFileSync(TEST_HTML_FILE, newHtml);

console.log('同步完成');
console.log(`同步了 ${testWords.length} 个词条`);
