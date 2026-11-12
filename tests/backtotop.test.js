import { test } from 'node:test';
import assert from 'node:assert/strict';

/** 滚动目标桩：记录监听器，测试手动 emit scroll 事件 */
function makeScrollTarget(initialY = 0) {
  const listeners = new Map();
  const target = {
    scrollY: initialY,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
    emit(type) { const fn = listeners.get(type); if (fn) fn(); },
    hasListener(type) { return listeners.has(type); },
  };
  return target;
}

/** 按钮桩：hidden 属性 + classList，行为对齐真实元素 */
function makeButton() {
  const classes = new Set();
  return {
    hidden: false,
    classList: {
      add(...names) { names.forEach((n) => classes.add(n)); },
      remove(...names) { names.forEach((n) => classes.delete(n)); },
      has(n) { return classes.has(n); },
    },
  };
}

test('shouldShowBackToTop 边界：threshold 处恰好出现，之下不出现', async () => {
  const { shouldShowBackToTop } = await import('../src/ui/backtotop.js');
  assert.equal(shouldShowBackToTop(399, 400), false);
  assert.equal(shouldShowBackToTop(400, 400), true);
  assert.equal(shouldShowBackToTop(0, 400), false);
  assert.equal(shouldShowBackToTop(100000, 400), true);
});

test('shouldShowBackToTop 契约错误抛 TypeError', async () => {
  const { shouldShowBackToTop } = await import('../src/ui/backtotop.js');
  for (const bad of [NaN, Infinity, -1, '400', null, undefined]) {
    assert.throws(() => shouldShowBackToTop(bad, 400), TypeError, `scrollY 应拒绝: ${String(bad)}`);
  }
  for (const bad of [0, -100, NaN, Infinity, '400', null]) {
    assert.throws(() => shouldShowBackToTop(100, bad), TypeError, `threshold 应拒绝: ${String(bad)}`);
  }
});

test('createBackToTop 契约错误抛 TypeError', async () => {
  const { createBackToTop } = await import('../src/ui/backtotop.js');
  assert.throws(() => createBackToTop(null), TypeError);
  assert.throws(() => createBackToTop('btn'), TypeError);
  assert.throws(() => createBackToTop(makeButton(), { threshold: 0 }), TypeError);
  assert.throws(() => createBackToTop(makeButton(), { threshold: '400' }), TypeError);
  // 缺少 add/removeEventListener 的 scrollTarget 拒绝
  assert.throws(() => createBackToTop(makeButton(), { scrollTarget: {} }), TypeError);
  assert.throws(() => createBackToTop(makeButton(), { scrollTarget: null, threshold: 400 }), TypeError);
});

test('初始低于阈值：按钮隐藏且无动画类', async () => {
  const { createBackToTop } = await import('../src/ui/backtotop.js');
  const btn = makeButton();
  createBackToTop(btn, { threshold: 400, scrollTarget: makeScrollTarget(100) });
  assert.equal(btn.hidden, true);
  assert.equal(btn.classList.has('btt-in'), false);
  assert.equal(btn.classList.has('btt-leaving'), false);
});

test('滚过阈值出现，滚回隐藏（退场动画后置 hidden）', async (t) => {
  const { createBackToTop } = await import('../src/ui/backtotop.js');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const target = makeScrollTarget(1000);
  const btn = makeButton();
  createBackToTop(btn, { threshold: 400, scrollTarget: target });
  assert.equal(btn.hidden, false);
  assert.equal(btn.classList.has('btt-in'), true);

  target.scrollY = 0;
  target.emit('scroll');
  assert.equal(btn.classList.has('btt-in'), false);
  assert.equal(btn.classList.has('btt-leaving'), true);
  assert.equal(btn.hidden, false); // 动画播放期间仍可见

  t.mock.timers.tick(250);
  assert.equal(btn.hidden, true);
  assert.equal(btn.classList.has('btt-leaving'), false);
});

test('退场动画中途滚回：show 取消隐藏定时器，按钮保持可见', async (t) => {
  const { createBackToTop } = await import('../src/ui/backtotop.js');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const target = makeScrollTarget(1000);
  const btn = makeButton();
  createBackToTop(btn, { threshold: 400, scrollTarget: target });

  target.scrollY = 0;
  target.emit('scroll'); // 进入退场动画，隐藏定时器待触发
  assert.equal(btn.classList.has('btt-leaving'), true);

  target.scrollY = 1000;
  target.emit('scroll'); // 中途拉回
  assert.equal(btn.hidden, false);
  assert.equal(btn.classList.has('btt-leaving'), false);
  assert.equal(btn.classList.has('btt-in'), true);

  t.mock.timers.tick(1000); // 若定时器未取消，此刻会误置 hidden
  assert.equal(btn.hidden, false);
});

test('destroy：解除 scroll 监听、清待触发的隐藏定时器、复位隐藏', async (t) => {
  const { createBackToTop } = await import('../src/ui/backtotop.js');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const target = makeScrollTarget(1000);
  const btn = makeButton();
  const ctl = createBackToTop(btn, { threshold: 400, scrollTarget: target });
  assert.equal(target.hasListener('scroll'), true);

  target.scrollY = 0;
  target.emit('scroll'); // 留一个待触发的隐藏定时器
  ctl.destroy();
  assert.equal(target.hasListener('scroll'), false);
  assert.equal(btn.hidden, true);

  t.mock.timers.tick(1000); // 定时器已清，不应抛错或改状态
  assert.equal(btn.hidden, true);
  // destroy 后再 emit 不产生任何效果（监听器已解除）
  target.scrollY = 1000;
  target.emit('scroll');
  assert.equal(btn.hidden, true);
  assert.equal(btn.classList.has('btt-in'), false);
});

test('destroy 可重复调用（幂等）', async () => {
  const { createBackToTop } = await import('../src/ui/backtotop.js');
  const ctl = createBackToTop(makeButton(), { scrollTarget: makeScrollTarget() });
  ctl.destroy();
  ctl.destroy();
});
