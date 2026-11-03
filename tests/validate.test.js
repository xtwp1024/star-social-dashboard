import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeText,
  validateUsername,
  validateMessage,
  validateUrl,
} from '../src/security/validate.js';

test('sanitizeText 剥离控制字符', () => {
  assert.equal(sanitizeText('ab\u0000cd\u001f'), 'abcd');
});

test('sanitizeText 截断超长输入', () => {
  assert.equal(sanitizeText('a'.repeat(300), 200).length, 200);
});

test('sanitizeText 非字符串返回空串', () => {
  assert.equal(sanitizeText(null), '');
  assert.equal(sanitizeText(123), '');
});

test('validateUsername 拒绝过短用户名', () => {
  const r = validateUsername('ab');
  assert.equal(r.ok, false);
  assert.match(r.reason, /至少 3/);
});

test('validateUsername 拒绝非法字符', () => {
  assert.equal(validateUsername('bad name!').ok, false);
});

test('validateUsername 接受合法中英文用户名', () => {
  assert.deepEqual(validateUsername('星社_user01'), { ok: true, value: '星社_user01' });
});

test('validateMessage 拒绝空消息', () => {
  assert.equal(validateMessage('   ').ok, false);
});

test('validateMessage 接受普通消息并保留原文', () => {
  assert.deepEqual(validateMessage('  hello <b>world</b> '), { ok: true, value: 'hello <b>world</b>' });
});

test('validateUrl 阻断 javascript: 伪协议', () => {
  assert.equal(validateUrl('javascript:alert(1)').ok, false);
  assert.equal(validateUrl('JaVaScRiPt:alert(1)').ok, false);
});

test('validateUrl 允许 https 与相对路径', () => {
  assert.equal(validateUrl('https://example.com/a').ok, true);
  assert.equal(validateUrl('/dashboard/main').ok, true);
});
