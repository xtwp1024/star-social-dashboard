import { test } from 'node:test';
import assert from 'node:assert/strict';

const FIXED_NOW = new Date('2026-11-12T08:00:00Z').getTime();

/** time 元素桩：getAttribute + textContent，行为对齐真实 <time> */
function makeTimeEl(datetime, text) {
  return {
    textContent: text,
    getAttribute(name) {
      return name === 'datetime' ? datetime : null;
    },
  };
}

/** 根容器桩：querySelectorAll 返回给定元素 */
function makeRoot(els) {
  return {
    querySelectorAll(sel) {
      return sel === 'time[datetime]' ? els : [];
    },
  };
}

function minutesAgoIso(min) {
  return new Date(FIXED_NOW - min * 60_000).toISOString();
}

test('refresh 更新陈旧的相对时间文案', async () => {
  const { createTimeRefresher } = await import('../src/ui/timerefresh.js');
  // 渲染于 2 分钟前，文案停留在「刚刚」
  const el = makeTimeEl(minutesAgoIso(2), '刚刚');
  const r = createTimeRefresher(makeRoot([el]), { now: () => FIXED_NOW });
  const n = r.refresh();
  assert.equal(el.textContent, '2 分钟前');
  assert.equal(n, 1);
});

test('refresh 文案未变化时不写入', async () => {
  const { createTimeRefresher } = await import('../src/ui/timerefresh.js');
  const el = makeTimeEl(minutesAgoIso(2), '2 分钟前');
  const r = createTimeRefresher(makeRoot([el]), { now: () => FIXED_NOW });
  assert.equal(r.refresh(), 0);
  assert.equal(el.textContent, '2 分钟前');
});

test('超过 7 天：有 fallback 回退绝对时间，无 fallback 保持现状', async () => {
  const { createTimeRefresher } = await import('../src/ui/timerefresh.js');
  const iso = new Date(FIXED_NOW - 8 * 86_400_000).toISOString();
  const withFallback = makeTimeEl(iso, '8 天前');
  const noFallback = makeTimeEl(iso, '8 天前');
  const r1 = createTimeRefresher(makeRoot([withFallback]), {
    now: () => FIXED_NOW,
    fallback: () => '2026-11-04 16:00',
  });
  r1.refresh();
  assert.equal(withFallback.textContent, '2026-11-04 16:00');

  const r2 = createTimeRefresher(makeRoot([noFallback]), { now: () => FIXED_NOW });
  r2.refresh();
  assert.equal(noFallback.textContent, '8 天前');
});

test('datetime 缺失或不可解析时跳过，绝不覆盖成空文案', async () => {
  const { createTimeRefresher } = await import('../src/ui/timerefresh.js');
  const broken = makeTimeEl('not-a-date', '原始文案');
  const noAttr = makeTimeEl('', '另一条');
  noAttr.getAttribute = () => null;
  const r = createTimeRefresher(makeRoot([broken, noAttr]), { now: () => FIXED_NOW });
  assert.equal(r.refresh(), 0);
  assert.equal(broken.textContent, '原始文案');
  assert.equal(noAttr.textContent, '另一条');
});

test('tick 在页面不可见时跳过刷新', async () => {
  const { createTimeRefresher } = await import('../src/ui/timerefresh.js');
  const el = makeTimeEl(minutesAgoIso(2), '刚刚');
  const r = createTimeRefresher(makeRoot([el]), {
    now: () => FIXED_NOW,
    doc: { visibilityState: 'hidden' },
  });
  r.tick();
  assert.equal(el.textContent, '刚刚');
});

test('tick 在页面可见时正常刷新', async () => {
  const { createTimeRefresher } = await import('../src/ui/timerefresh.js');
  const el = makeTimeEl(minutesAgoIso(2), '刚刚');
  const r = createTimeRefresher(makeRoot([el]), {
    now: () => FIXED_NOW,
    doc: { visibilityState: 'visible' },
  });
  r.tick();
  assert.equal(el.textContent, '2 分钟前');
});

test('start/stop 生命周期：stop 后 running 归 false 且可安全重复 stop', async () => {
  const { mock } = await import('node:test');
  const { createTimeRefresher } = await import('../src/ui/timerefresh.js');
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const el = makeTimeEl(minutesAgoIso(2), '刚刚');
    const r = createTimeRefresher(makeRoot([el]), {
      now: () => FIXED_NOW,
      doc: { visibilityState: 'visible' },
      intervalMs: 60_000,
    });
    r.start();
    assert.equal(r.running, true);
    // 推进一个周期，文案应被 tick 更新
    mock.timers.tick(60_000);
    assert.equal(el.textContent, '2 分钟前');
    r.stop();
    assert.equal(r.running, false);
    r.stop(); // 幂等
  } finally {
    mock.timers.reset();
  }
});
