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
