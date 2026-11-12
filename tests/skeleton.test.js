import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// 极简 DOM 桩：仅覆盖 createEl 所需接口（与 dom.test.js 同款）
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
    };
  }
  globalThis.document = { createElement: (tag) => El(tag) };
}

beforeEach(makeStub);

test('契约错误：count 非 1-12 整数抛 TypeError', async () => {
  const { createSkeletonItems } = await import('../src/ui/skeleton.js');
  for (const bad of [0, -1, 1.5, 13, NaN, '3', null]) {
    assert.throws(() => createSkeletonItems(bad), TypeError, `应拒绝: ${String(bad)}`);
  }
});

test('count=3 生成 3 条骨架，类名与 aria-hidden 正确', async () => {
  const { createSkeletonItems } = await import('../src/ui/skeleton.js');
  const items = createSkeletonItems(3);
  assert.equal(items.length, 3);
  for (const item of items) {
    assert.equal(item.attrs.class, 'feed-skeleton');
    assert.equal(item.attrs['aria-hidden'], 'true');
    // meta + text 两根微光条
    assert.equal(item.children.length, 2);
    assert.equal(item.children[0].attrs.class, 'skel-line skel-meta');
    assert.equal(item.children[1].attrs.class, 'skel-line skel-text');
  }
});

test('骨架条无文本内容（纯装饰，避免屏幕阅读器朗读）', async () => {
  const { createSkeletonItems } = await import('../src/ui/skeleton.js');
  for (const item of createSkeletonItems(2)) {
    assert.equal(item.textContent, '');
    for (const child of item.children) {
      assert.equal(child.textContent, '');
    }
  }
});

test('count=1 下界与 count=12 上界可用', async () => {
  const { createSkeletonItems, SKELETON_MIN, SKELETON_MAX } = await import('../src/ui/skeleton.js');
  assert.equal(createSkeletonItems(SKELETON_MIN).length, 1);
  assert.equal(createSkeletonItems(SKELETON_MAX).length, 12);
});
