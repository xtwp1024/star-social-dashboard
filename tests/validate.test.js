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

test('validateUrl 阻断 data:/vbscript: 伪协议', () => {
  assert.equal(validateUrl('data:text/html,<script>alert(1)</script>').ok, false);
  assert.equal(validateUrl('DATA:text/html;base64,PHNjcmlwdD4=').ok, false);
  assert.equal(validateUrl('vbscript:msgbox(1)').ok, false);
});

test('validateUrl 阻断协议相对地址（跨站跳转）', () => {
  assert.equal(validateUrl('//evil.com').ok, false);
  assert.equal(validateUrl('//evil.com/x').ok, false);
});

test('validateUrl 阻断反斜杠技巧（浏览器把 \\ 视作 /）', () => {
  assert.equal(validateUrl('/\\evil.com').ok, false);
  assert.equal(validateUrl('\\/evil.com').ok, false);
  assert.equal(validateUrl('\\\\evil.com').ok, false);
});

test('validateUrl 超长输入显式拒绝而非截断', () => {
  const long = 'https://example.com/' + 'a'.repeat(2048);
  const r = validateUrl(long);
  assert.equal(r.ok, false);
  assert.match(r.reason, /2048/);
});

test('validateUrl 拒绝含空白的 http URL', () => {
  assert.equal(validateUrl('https://example.com/a b').ok, false);
  assert.equal(validateUrl('https://evil.com\n/x').ok, false);
});

test('validateUrl 允许 https 与相对路径', () => {
  assert.equal(validateUrl('https://example.com/a').ok, true);
  assert.equal(validateUrl('/dashboard/main').ok, true);
});

// ---- data: 伪协议边界变体（sanitize 剥离/保留字符后仍必须拒绝）----

test('validateUrl 阻断内嵌控制字符后还原为 data: 的输入', () => {
  // \u0000/\u000B 会被剥离，剥完恰好拼回 data: —— 结果仍须拒绝
  assert.equal(validateUrl('da\u0000ta:text/html,<b>x</b>').ok, false);
  assert.equal(validateUrl('d\u000Bata:text/html').ok, false);
  assert.equal(validateUrl('\u0001data:text/html;base64,AAAA').ok, false);
});

test('validateUrl 阻断内嵌 tab/换行的伪协议（这些字符不被剥离）', () => {
  assert.equal(validateUrl('java\tscript:alert(1)').ok, false);
  assert.equal(validateUrl('da\tta:text/html').ok, false);
  assert.equal(validateUrl('data\r:\u0009text/html').ok, false);
});

test('validateUrl 阻断空白包裹与混合大小写的 data: 变体', () => {
  assert.equal(validateUrl('  data:text/html,<b>x</b>  ').ok, false);
  assert.equal(validateUrl('\nData: text/html').ok, false);
  assert.equal(validateUrl('DaTa:TeXt/HTML').ok, false);
});

test('validateUrl 阻断 data: 混入 query 的直接伪协议头', () => {
  // 伪协议伪装成带 query 的形态：仍不满足 http(s) 或相对路径白名单
  assert.equal(validateUrl('data:text/html;charset=utf-8,<script>y</script>?x=1').ok, false);
});

// ---- 超长输入边界 ----

test('validateUrl 2048 字符恰好通过（上边界含端点）', () => {
  const exact = 'https://a.com/' + 'a'.repeat(2048 - 'https://a.com/'.length);
  assert.equal(exact.length, 2048);
  const r = validateUrl(exact);
  assert.equal(r.ok, true);
  assert.equal(r.value, exact); // 恰好在上限内：原文通过，不发生截断
});

test('validateUrl 2049 字符拒绝（上边界外）', () => {
  const over = 'https://a.com/' + 'a'.repeat(2049 - 'https://a.com/'.length);
  const r = validateUrl(over);
  assert.equal(r.ok, false);
  assert.match(r.reason, /2048/);
});

test('validateUrl 拒绝后不返回 value（防误用未校验返回值）', () => {
  const r = validateUrl('javascript:alert(1)');
  assert.equal(r.ok, false);
  assert.equal('value' in r, false);
});

// ---- 类型与空值边界 ----

test('validateUrl 拒绝非字符串与空输入', () => {
  assert.equal(validateUrl(null).ok, false);
  assert.equal(validateUrl(undefined).ok, false);
  assert.equal(validateUrl(123).ok, false);
  assert.equal(validateUrl({}).ok, false);
  assert.equal(validateUrl('').ok, false);
  assert.equal(validateUrl('   ').ok, false);
});

test('validateUrl 仅放行以 / 开头的相对路径', () => {
  assert.equal(validateUrl('/').ok, true);
  assert.equal(validateUrl('/a/b?x=1').ok, true);
  // 不以 / 开头的相对名与 ./ ../ 形态不进白名单，防止未来语义漂移
  assert.equal(validateUrl('index.html').ok, false);
  assert.equal(validateUrl('./a').ok, false);
  assert.equal(validateUrl('../a').ok, false);
});
