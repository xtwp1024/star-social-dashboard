/**
 * 回到顶部按钮：长 feed（无限滚动）滚过一屏后出现，点击平滑滚回顶部。
 *
 * 可见性约定：
 * - 模块全权管理 hidden 属性——隐藏态对键盘 Tab 与屏幕阅读器完全不可见；
 * - 出现走 rise-in 入场动画（btt-in 类），消失走 sink-out 退场动画（btt-leaving 类），
 *   动画结束（定时器兜底）后置 hidden，避免「看得见点不着」的中间态；
 * - 快速 show/hide 抖动安全：show 会取消未完成的隐藏定时器并清掉退场类。
 * 页面卸载必须调用 destroy()（解除 scroll 监听 + 清定时器），防 detached 泄漏。
 */

/**
 * 可见性判定（纯函数，便于回归测试）。
 * @param {number} scrollY 当前纵向滚动位置
 * @param {number} threshold 出现阈值（px），必须 >= 1
 * @returns {boolean}
 */
export function shouldShowBackToTop(scrollY, threshold) {
  if (!Number.isFinite(scrollY) || scrollY < 0) {
    throw new TypeError('scrollY must be a finite number >= 0');
  }
  if (!Number.isFinite(threshold) || threshold < 1) {
    throw new TypeError('threshold must be a number >= 1');
  }
  return scrollY >= threshold;
}

/** 退场动画时长（ms），与 CSS sink-out 0.18s 对应，定时器兜底略放宽 */
const LEAVE_MS = 220;

/**
 * @param {HTMLElement} button 回到顶部按钮（模块接管其 hidden 与动画类）
 * @param {{ threshold?: number, scrollTarget?: { scrollY: number, addEventListener: Function, removeEventListener: Function } }} [opts]
 *   scrollTarget 默认 window，测试可注入桩
 * @returns {{ destroy: () => void }}
 */
export function createBackToTop(button, { threshold = 400, scrollTarget } = {}) {
  if (!button || typeof button !== 'object') {
    throw new TypeError('button must be an Element');
  }
  shouldShowBackToTop(0, threshold); // 复用阈值契约校验
  const target = scrollTarget ?? globalThis.window;
  if (!target || typeof target.addEventListener !== 'function'
    || typeof target.removeEventListener !== 'function') {
    throw new TypeError('scrollTarget must support add/removeEventListener');
  }

  let visible = false;
  let hideTimer = null;

  const show = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    button.classList.remove('btt-leaving');
    if (!visible) {
      visible = true;
      button.hidden = false;
      button.classList.add('btt-in');
    }
  };

  const hide = () => {
    if (!visible) return;
    visible = false;
    button.classList.remove('btt-in');
    button.classList.add('btt-leaving');
    // 动画播放完再真正隐藏；reduced-motion（0.01ms）下同样由定时器兜底
    hideTimer = setTimeout(() => {
      hideTimer = null;
      button.hidden = true;
      button.classList.remove('btt-leaving');
    }, LEAVE_MS);
  };

  const onScroll = () => {
    const y = typeof target.scrollY === 'number' ? target.scrollY : 0;
    if (shouldShowBackToTop(y, threshold)) show();
    else hide();
  };

  button.hidden = true; // 初始不可见，由首次 scroll 同步刷新
  target.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // 深链接/刷新时已处于滚动位置的场景，初始同步一次

  return {
    destroy() {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      target.removeEventListener('scroll', onScroll);
      button.hidden = true;
      button.classList.remove('btt-in', 'btt-leaving');
      visible = false;
    },
  };
}
