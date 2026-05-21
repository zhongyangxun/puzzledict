import fs from 'fs';
import { resolve } from 'path';
import { REPO_ROOT } from './constans.js';

const minRootsCount = process.argv[2];
if (!minRootsCount) {
  console.error('请输入最小词素数量');
  process.exit(1);
}

const WORD_ROOTS_FILE = resolve(REPO_ROOT, 'data/word_roots.json');

const fileContent = JSON.parse(fs.readFileSync(WORD_ROOTS_FILE, 'utf8'));

const { words } = fileContent;

const res = [];

Object.entries(words).forEach(([word, { roots }]) => {
  if (roots.length >= minRootsCount) {
    res.push(word);
  }
});

res.length > 0
  ? console.log(res)
  : console.log(`没有找到词素数量大于等于 ${minRootsCount} 的单词`);
