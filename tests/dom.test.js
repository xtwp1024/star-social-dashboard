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
      // eslint-disable-next-line security/detect-object-injection -- k 为测试用例自造的属性名，非外部输入
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

// removeAnimated 专用桩：带 classList / dataset / isConnected / 事件捕获 / remove
function makeAnimStub() {
  const el = {
    isConnected: true,
    removed: false,
    dataset: {},
    classList: { add(c) { (el.classes ??= new Set()).add(c); } },
    handlers: new Map(),
    addEventListener(type, handler) {
      if (!el.handlers.has(type)) el.handlers.set(type, []);
      el.handlers.get(type).push(handler);
    },
    remove() { el.removed = true; el.isConnected = false; },
    fire(type) {
      for (const h of el.handlers.get(type) ?? []) h({});
      el.handlers.set(type, []);
    },
  };
  return el;
}

test('removeAnimated 加 leaving 类，animationend 后移除节点', async () => {
  const { removeAnimated } = await import('../src/security/dom.js');
  const el = makeAnimStub();
  removeAnimated(el);
  assert.ok(el.classes.has('leaving'));
  assert.equal(el.dataset.leaving, '1');
  assert.equal(el.removed, false, '动画结束前不应移除');
  el.fire('animationend');
  assert.equal(el.removed, true);
});

test('removeAnimated 超时兜底：animationend 不触发也会移除', async () => {
  const { removeAnimated } = await import('../src/security/dom.js');
  const el = makeAnimStub();
  removeAnimated(el, { duration: 10 });
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(el.removed, true, '最迟 duration+100ms 内必须移除');
});

test('removeAnimated 重复调用防抖：第二次不再注册监听器', async () => {
  const { removeAnimated } = await import('../src/security/dom.js');
  const el = makeAnimStub();
  removeAnimated(el);
  const countBefore = el.handlers.get('animationend').length;
  removeAnimated(el);
  assert.equal(el.handlers.get('animationend').length, countBefore);
});

test('removeAnimated 已断连节点直接返回', async () => {
  const { removeAnimated } = await import('../src/security/dom.js');
  const el = makeAnimStub();
  el.isConnected = false;
  removeAnimated(el);
  assert.equal(el.removed, false);
  assert.ok(!el.classes?.has('leaving'));
});
