import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charCountState } from '../src/ui/charcount.js';

test('空输入计数为 0/max，不预警', () => {
  const s = charCountState('', 500);
  assert.equal(s.text, '0/500');
  assert.equal(s.warn, false);
});

test('正常输入计数正确且不预警', () => {
  const s = charCountState('你好星社', 500);
  assert.equal(s.text, '4/500');
  assert.equal(s.warn, false);
});

test('恰好 450 字不预警（剩余 50 未低于阈值）', () => {
  const s = charCountState('x'.repeat(450), 500);
  assert.equal(s.text, '450/500');
  assert.equal(s.warn, false);
});

test('451 字起预警（剩余不足 50）', () => {
  const s = charCountState('x'.repeat(451), 500);
  assert.equal(s.warn, true);
  const s2 = charCountState('x'.repeat(500), 500);
  assert.equal(s2.text, '500/500');
  assert.equal(s2.warn, true);
});

test('超限输入按上限封顶，不产生负余量展示', () => {
  const s = charCountState('x'.repeat(520), 500);
  assert.equal(s.text, '500/500');
  assert.equal(s.warn, true);
});

test('非法参数 fail-safe：非字符串/非法 max 返回空文本不预警', () => {
  assert.deepEqual(charCountState(null, 500), { text: '0/500', warn: false });
  assert.deepEqual(charCountState('abc', 0), { text: '', warn: false });
  assert.deepEqual(charCountState('abc', NaN), { text: '', warn: false });
  assert.deepEqual(charCountState(undefined, -1), { text: '', warn: false });
});
