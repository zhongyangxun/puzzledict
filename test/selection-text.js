import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isMainlyLatinText,
  normalizeEnglishText,
} from '../src/lib/selection-text.js';

describe('normalizeEnglishText', () => {
  it('压缩首尾与连续空白，含 NBSP、窄空格、全角空格', () => {
    assert.equal(
      normalizeEnglishText('  hello\n\tworld\u00A0again\u202Fand\u3000again '),
      'hello world again and again',
    );
  });

  it('删除零宽字符与软连字符，避免静默切断单词', () => {
    assert.equal(normalizeEnglishText('hyphen\u00ADation'), 'hyphenation');
    assert.equal(normalizeEnglishText('zero\u200Bwidth'), 'zerowidth');
  });

  it('展开 PDF 复制常见的连字', () => {
    assert.equal(
      normalizeEnglishText('the \uFB01nal con\uFB02ict'),
      'the final conflict',
    );
    assert.equal(
      normalizeEnglishText('o\uFB00er a\uFB03x sha\uFB04e'),
      'offer affix shaffle',
    );
  });

  it('引号与撇号折叠为 ASCII', () => {
    assert.equal(
      normalizeEnglishText('\u201Cit\u2019s\u201D 5\u2032 6\u2033 \u02BCem'),
      `"it's" 5' 6" 'em`,
    );
  });

  it('各类破折号与减号折叠为连字符', () => {
    assert.equal(
      normalizeEnglishText('a\u2012b\u2013c\u2014d\u2015e\u2212f'),
      'a-b-c-d-e-f',
    );
  });

  it('省略号展开为三个点', () => {
    assert.equal(
      normalizeEnglishText('she paused\u2026 then left'),
      'she paused... then left',
    );
  });

  it('度符号的各种写法统一为 U+00B0', () => {
    assert.equal(normalizeEnglishText('100 \u02DAC'), '100 \u00B0C');
    assert.equal(normalizeEnglishText('100 \u2103'), '100 \u00B0C');
    assert.equal(normalizeEnglishText('212 \u2109'), '212 \u00B0F');
  });

  it('保留承载语义的非 ASCII 字符', () => {
    const text = 'The caf\u00E9 cost \u00A320 \u00A9 2026';
    assert.equal(normalizeEnglishText(text), text);
  });
});

describe('isMainlyLatinText', () => {
  const pass = [
    ['普通英文句子', 'Hello world.'],
    ['含省略号', 'She paused... then left.'],
    ['含度符号', 'Water boils at 100 °C at sea level.'],
    ['含货币与商标符号', 'It cost £20 - about €23, © 2026 Foo™.'],
    ['含变音符的英文词', 'The café is naïve about résumé fraud.'],
    ['含希腊字母的科技文本', 'A 5 μm β-carotene crystal.'],
    ['单个带变音符的词', 'café'],
    ['数学符号夹英文词', '3 × 4 ≠ 11 ± 2 ≈ half (½).'],
    ['英文句中夹个别汉字', 'The character 好 means good'],
    ['含表情', 'Hello world 😀 Nice job! 👍🎉'],
    ['法语句子', 'Le renard brun rapide saute par-dessus le chien paresseux.'],
    ['德语句子', 'Der schnelle braune Fuchs springt über den faulen Hund.'],
  ];

  const skip = [
    ['空字符串', ''],
    ['纯数字', '12345'],
    ['纯符号', '±≈→'],
    ['纯表情', '😀😀'],
    ['中文为主', '这个 word 的意思'],
    ['纯中文', '这是一句中文'],
    ['日文', 'こんにちは'],
    ['西里尔文', 'Привет'],
    ['希腊文为主夹英文词', 'Καλημέρα κόσμε hello'],
  ];

  for (const [name, text] of pass) {
    it(`通过：${name}`, () => {
      assert.equal(isMainlyLatinText(normalizeEnglishText(text)), true);
    });
  }

  for (const [name, text] of skip) {
    it(`跳过：${name}`, () => {
      assert.equal(isMainlyLatinText(normalizeEnglishText(text)), false);
    });
  }

  it('按码点统计，不把代理对拆成半字符', () => {
    // U+20000 是 CJK 扩展 B 区汉字，UTF-16 下占两个码元
    assert.equal(isMainlyLatinText('\u{20000}\u{20000} ok'), false);
    assert.equal(
      isMainlyLatinText('a perfectly fine sentence \u{20000}'),
      true,
    );
  });
});
