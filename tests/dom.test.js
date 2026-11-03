import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// 极简 DOM 桩：仅覆盖 createEl / clearChildren 所需接口
function makeStub() {
  function El(tag) {
    return {
      tagName: tag.toUpperCase(),
      attrs: {},
      textContent: '',
      children: [],
      firstChild: null,
      setAttribute(k, v) { this.attrs[k] = String(v); },
      appendChild(c) { this.children.push(c); this.firstChild = this.children[0]; },
      removeChild(c) {
        this.children = this.children.filter((x) => x !== c);
        this.firstChild = this.children[0] || null;
      },
    };
  }
  globalThis.document = { createElement: (tag) => El(tag) };
}

beforeEach(makeStub);

test('createEl 通过 textContent 写入内容（免疫 XSS）', async () => {
  const { createEl } = await import('../src/security/dom.js');
  const el = createEl('li', { class: 'feed-item' }, '<img src=x onerror=alert(1)>');
  assert.equal(el.textContent, '<img src=x onerror=alert(1)>');
  // 内容不在属性或 HTML 里，只是纯文本
  assert.ok(!JSON.stringify(el.attrs).includes('onerror'));
});

test('createEl 拒绝非法标签名', async () => {
  const { createEl } = await import('../src/security/dom.js');
  assert.throws(() => createEl('img onerror=x'), /非法标签名/);
  assert.throws(() => createEl('<script>'), /非法标签名/);
});

test('createEl 白名单外属性被丢弃', async () => {
  const { createEl } = await import('../src/security/dom.js');
  const el = createEl('div', { onclick: 'alert(1)', class: 'ok' });
  assert.equal(el.attrs.onclick, undefined);
  assert.equal(el.attrs.class, 'ok');
});

test('createEl 阻断 javascript: 伪协议 href', async () => {
  const { createEl } = await import('../src/security/dom.js');
  const el = createEl('a', { href: 'javascript:alert(1)' });
  assert.equal(el.attrs.href, undefined);
});

test('createEl href/src 统一走 validateUrl 白名单（伪协议/协议相对/反斜杠全拒）', async () => {
  const { createEl } = await import('../src/security/dom.js');
  const bad = [
    'vbscript:msgbox(1)',            // 旧正则漏掉的伪协议
    'data:text/html,<script>',       // data: 伪协议（含旧版放行的 image 分支一律收紧）
    'data:image/png;base64,AAAA',    // data:image 也不再放行
    '//evil.com',                    // 协议相对，实为跳外站
    '/\\evil.com',                   // 反斜杠技巧
    '  javascript:alert(1)',         // 前导空白绕过尝试
  ];
  for (const url of bad) {
    const a = createEl('a', { href: url });
    assert.equal(a.attrs.href, undefined, `href 应拒绝: ${url}`);
    const img = createEl('img', { src: url });
    assert.equal(img.attrs.src, undefined, `src 应拒绝: ${url}`);
  }
});

test('createEl 合法 http(s) 与站内相对路径 href/src 放行', async () => {
  const { createEl } = await import('../src/security/dom.js');
  assert.equal(createEl('a', { href: 'https://example.com/x' }).attrs.href, 'https://example.com/x');
  assert.equal(createEl('a', { href: '/feed/latest' }).attrs.href, '/feed/latest');
  assert.equal(createEl('img', { src: '/assets/logo.png' }).attrs.src, '/assets/logo.png');
});

test('clearChildren 清空容器', async () => {
  const { createEl, clearChildren } = await import('../src/security/dom.js');
  const box = createEl('ul');
  box.appendChild(createEl('li', {}, 'a'));
  box.appendChild(createEl('li', {}, 'b'));
  assert.equal(box.children.length, 2);
  clearChildren(box);
  assert.equal(box.children.length, 0);
  assert.equal(box.firstChild, null);
});
