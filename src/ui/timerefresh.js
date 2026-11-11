/**
 * 相对时间周期刷新器。
 *
 * 问题：帖子渲染时计算一次相对时间，页面长开后文案陈旧——
 * 「刚刚」永远是「刚刚」，用户无法感知时间流逝。
 *
 * 方案：定时扫描容器内所有 time[datetime]，按当前时间重算文案。
 * - 相对时间可用 → 更新 textContent（仅在实际变化时写入，避免无谓 DOM 写）；
 * - 超过 7 天相对档耗尽 → 若提供 fallback 则回退绝对时间，否则保持现状
 *   （渲染时已是绝对时间的元素自然不动）；
 * - datetime 缺失或不可解析 → 跳过，绝不覆盖成空文案。
 *
 * 可见性约束：页面不可见时 tick 直接跳过，后台标签页不做无谓计算；
 * 回到前台由 visibilitychange 监听（main.js 经 tracker 登记）立即补偿刷新。
 */

import { formatRelativeTime } from './timeago.js';

/**
 * @param {Element | {
 *   querySelectorAll: (sel: string) => Iterable<Element & { getAttribute?: (n: string) => string | null, textContent: string }>
 * }} root 扫描容器（通常为 feed 列表）
 * @param {{
 *   intervalMs?: number,
 *   now?: () => number,
 *   doc?: { visibilityState?: string } | null,
 *   fallback?: ((iso: string) => string) | null,
 * }} [options]
 * @returns {{
 *   refresh: () => number,
 *   tick: () => void,
 *   start: () => void,
 *   stop: () => void,
 *   running: boolean,
 * }}
 */
export function createTimeRefresher(root, options = {}) {
  const {
    intervalMs = 60_000,
    now = () => Date.now(),
    doc = typeof document !== 'undefined' ? document : null,
    fallback = null,
  } = options;

  /** @type {ReturnType<typeof setInterval> | null} */
  let timer = null;
  let stopped = false;

  /** 无条件刷新一遍，返回实际更新文案的元素数 */
  function refresh() {
    if (!root || typeof root.querySelectorAll !== 'function') return 0;
    let updated = 0;
    for (const el of root.querySelectorAll('time[datetime]')) {
      const iso = typeof el.getAttribute === 'function' ? el.getAttribute('datetime') : null;
      if (!iso) continue;
      const rel = formatRelativeTime(iso, now());
      if (rel !== null) {
        if (el.textContent !== rel) {
          el.textContent = rel;
          updated += 1;
        }
      } else if (typeof fallback === 'function') {
        const abs = fallback(iso);
        if (abs && el.textContent !== abs) {
          el.textContent = abs;
          updated += 1;
        }
      }
      // rel 为 null 且无 fallback：保持现状（渲染时已是绝对时间文案）
    }
    return updated;
  }

  /** 可见性门控的刷新：后台标签页跳过 */
  function tick() {
    if (doc && doc.visibilityState !== 'visible') return;
    refresh();
  }

  function start() {
    if (stopped || timer !== null) return;
    timer = setInterval(tick, intervalMs);
  }

  function stop() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    stopped = true;
  }

  return {
    refresh,
    tick,
    start,
    stop,
    get running() {
      return timer !== null;
    },
  };
}
