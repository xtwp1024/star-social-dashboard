import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * IntersectionObserver 桩：捕获回调与配置，手动模拟交点变化。
 * 对齐真实 IO 语义：observe() 后异步触发一次初始回调。
 */
function makeMockIO() {
  const instances = [];
  class MockIntersectionObserver {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.observed = [];
      this.disconnected = false;
      instances.push(this);
    }
    observe(el) {
      this.observed.push(el);
      // 真实 IO 会在 observe 后异步派发初始状态
      queueMicrotask(() => this.callback([{ isIntersecting: false, target: el }], this));
    }
    disconnect() {
      this.disconnected = true;
    }
    /** 测试辅助：模拟交点变化（真实 IO 在 disconnect 后不再派发条目，保持一致） */
    emit(isIntersecting) {
      if (this.disconnected) return;
      this.callback([{ isIntersecting, target: this.observed[0] }], this);
    }
  }
  return { MockIntersectionObserver, instances };
}

/** document 桩：控制 visibilityState，异步体执行期间保持，结束后恢复 */
async function withDocument(state, fn) {
  const had = 'document' in globalThis;
  const original = globalThis.document;
  globalThis.document = { visibilityState: state };
  try {
    return await fn();
  } finally {
    if (had) globalThis.document = original;
    else delete globalThis.document;
  }
}

const makeTarget = () => ({ addEventListener() {} });

async function setup() {
  const { MockIntersectionObserver, instances } = makeMockIO();
  globalThis.IntersectionObserver = MockIntersectionObserver;
  const { createInfiniteScroll } = await import('../src/ui/infinite-scroll.js');
  return { createInfiniteScroll, instances };
}

function cleanup() {
  delete globalThis.IntersectionObserver;
}

const flush = () => new Promise((res) => setTimeout(res, 0));

test('契约错误：target 缺失或 onVisible 非函数抛 TypeError', async () => {
  const { createInfiniteScroll } = await setup();
  try {
    assert.throws(() => createInfiniteScroll(null, { onVisible() {} }), TypeError);
    assert.throws(() => createInfiniteScroll(makeTarget(), {}), TypeError);
    assert.throws(() => createInfiniteScroll(makeTarget(), { onVisible: 'no' }), TypeError);
  } finally {
    cleanup();
  }
});

test('不支持 IntersectionObserver 时优雅降级：supported=false 且方法安全空转', async () => {
  delete globalThis.IntersectionObserver;
  const { createInfiniteScroll } = await import('../src/ui/infinite-scroll.js');
  let fired = 0;
  const r = createInfiniteScroll(makeTarget(), { onVisible: () => fired++ });
  assert.equal(r.supported, false);
  r.recheck();
  r.disconnect();
  assert.equal(fired, 0);
});

test('observe 目标正确、rootMargin 配置透传', async () => {
  const { createInfiniteScroll, instances } = await setup();
  try {
    const target = makeTarget();
    createInfiniteScroll(target, { onVisible() {}, rootMargin: '80px 0px' });
    const io = instances[0];
    assert.deepEqual(io.observed, [target]);
    assert.equal(io.options.rootMargin, '80px 0px');
  } finally {
    cleanup();
  }
});

test('进入视口触发 onVisible，离开视口与未相交时均不触发', async () => {
  await withDocument('visible', async () => {
    const { createInfiniteScroll, instances } = await setup();
    try {
      let fired = 0;
      const r = createInfiniteScroll(makeTarget(), { onVisible: () => fired++ });
      await flush();
      assert.equal(fired, 0); // 初始未相交不触发

      r.recheck();
      assert.equal(fired, 0); // 未相交时 recheck 也不触发

      instances[0].emit(true);
      assert.equal(fired, 1); // 相交触发

      instances[0].emit(false);
      instances[0].emit(false);
      assert.equal(fired, 1); // 离开视口不触发
    } finally {
      cleanup();
    }
  });
});

test('页面隐藏时不触发，recheck 同样被门控', async () => {
  await withDocument('hidden', async () => {
    const { createInfiniteScroll, instances } = await setup();
    try {
      let fired = 0;
      const r = createInfiniteScroll(makeTarget(), { onVisible: () => fired++ });
      await flush();
      instances[0].emit(true);
      r.recheck();
      assert.equal(fired, 0);
    } finally {
      cleanup();
    }
  });
});

test('recheck 在相交状态下再次触发（连续补页场景）', async () => {
  await withDocument('visible', async () => {
    const { createInfiniteScroll, instances } = await setup();
    try {
      let fired = 0;
      const r = createInfiniteScroll(makeTarget(), { onVisible: () => fired++ });
      await flush();
      instances[0].emit(true);
      assert.equal(fired, 1);
      r.recheck();
      assert.equal(fired, 2);
      r.recheck();
      assert.equal(fired, 3);
    } finally {
      cleanup();
    }
  });
});

test('disconnect 后不再响应交点变化', async () => {
  await withDocument('visible', async () => {
    const { createInfiniteScroll, instances } = await setup();
    try {
      let fired = 0;
      const r = createInfiniteScroll(makeTarget(), { onVisible: () => fired++ });
      await flush();
      r.disconnect();
      assert.equal(instances[0].disconnected, true);
      instances[0].emit(true);
      r.recheck();
      assert.equal(fired, 0);
    } finally {
      cleanup();
    }
  });
});
