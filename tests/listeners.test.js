import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// EventTarget 桩：记录 add/remove 调用，可统计「表面存活」的监听器
function makeTargetStub() {
  return {
    listeners: new Map(), // type -> Set<handler>
    removed: [],
    addEventListener(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      this.removed.push([type, handler]);
      this.listeners.get(type)?.delete(handler);
    },
    surfaceCount() {
      let n = 0;
      for (const s of this.listeners.values()) n += s.size;
      return n;
    },
  };
}

let target;
beforeEach(() => {
  target = makeTargetStub();
});

test('tracker.add 登记监听器并真实绑定', async () => {
  const { createListenerTracker } = await import('../src/security/listeners.js');
  const t = createListenerTracker();
  const h = () => {};
  t.add(target, 'click', h);
  assert.equal(t.count(), 1);
  assert.equal(target.surfaceCount(), 1);
});

test('remove 单独反注册，计数与真实绑定同步归零', async () => {
  const { createListenerTracker } = await import('../src/security/listeners.js');
  const t = createListenerTracker();
  const h = () => {};
  const off = t.add(target, 'click', h);
  off();
  assert.equal(t.count(), 0);
  assert.equal(target.surfaceCount(), 0);
});

test('removeAll 一次性清理全部监听器（泄漏回归核心断言）', async () => {
  const { createListenerTracker } = await import('../src/security/listeners.js');
  const t = createListenerTracker();
  const a = makeTargetStub();
  const b = makeTargetStub();
  t.add(a, 'click', () => {});
  t.add(a, 'input', () => {});
  t.add(b, 'scroll', () => {});
  assert.equal(t.count(), 3);
  const removed = t.removeAll();
  assert.equal(removed, 3);
  assert.equal(t.count(), 0);
  // 关键：不仅 tracker 内部计数归零，目标上的真实绑定也必须被解除
  assert.equal(a.surfaceCount(), 0);
  assert.equal(b.surfaceCount(), 0);
  assert.equal(a.removed.length, 2);
  assert.equal(b.removed.length, 1);
});

test('countFor 按目标统计', async () => {
  const { createListenerTracker } = await import('../src/security/listeners.js');
  const t = createListenerTracker();
  const other = makeTargetStub();
  t.add(target, 'click', () => {});
  t.add(target, 'keydown', () => {});
  t.add(other, 'click', () => {});
  assert.equal(t.countFor(target), 2);
  assert.equal(t.countFor(other), 1);
});

test('拒绝非法参数（非 EventTarget / 非 handler）', async () => {
  const { createListenerTracker } = await import('../src/security/listeners.js');
  const t = createListenerTracker();
  assert.throws(() => t.add(null, 'click', () => {}), /EventTarget/);
  assert.throws(() => t.add(target, 'click', 'not-a-fn'), /handler/);
});

test('remove 未登记的监听器返回 false 而不抛错', async () => {
  const { createListenerTracker } = await import('../src/security/listeners.js');
  const t = createListenerTracker();
  assert.equal(t.remove(target, 'click', () => {}), false);
});
