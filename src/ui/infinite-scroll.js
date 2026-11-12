/**
 * 无限滚动辅助：IntersectionObserver 观察「加载更多」按钮，进入视口自动触发加载。
 *
 * 渐进增强：不支持 IntersectionObserver 时返回 supported=false，点击按钮兜底不受影响。
 * 防循环约定：onVisible 的重复触发由调用方的 loading/hasMore 守卫兜住（loadPage 双守卫）；
 * recheck 仅供「加载成功后按钮仍在视口内」的连续加载场景，失败路径不得 recheck，
 * 否则持续失败的请求会形成错误风暴。
 * 页面隐藏时暂停触发，回到前台由 IntersectionObserver 重新计算交点自然恢复。
 */

/**
 * @param {Element} target 被观察元素（加载更多按钮）
 * @param {{ onVisible: () => void, rootMargin?: string }} opts
 * @returns {{ supported: boolean, recheck: () => void, disconnect: () => void }}
 */
export function createInfiniteScroll(target, { onVisible, rootMargin = '200px 0px' } = {}) {
  if (!target || typeof target !== 'object') {
    throw new TypeError('target must be an Element');
  }
  if (typeof onVisible !== 'function') {
    throw new TypeError('onVisible must be a function');
  }

  const IO = globalThis.IntersectionObserver;
  if (typeof IO !== 'function') {
    return { supported: false, recheck() {}, disconnect() {} };
  }

  let intersecting = false;
  const notify = () => {
    if (intersecting && globalThis.document?.visibilityState !== 'hidden') {
      onVisible();
    }
  };

  const observer = new IO((entries) => {
    const last = entries[entries.length - 1];
    intersecting = Boolean(last && last.isIntersecting);
    notify();
  }, { rootMargin });
  observer.observe(target);

  return {
    supported: true,
    /** 加载成功后调用：若按钮仍在视口内则再触发一次（首屏较短时的连续补页） */
    recheck() {
      notify();
    },
    disconnect() {
      observer.disconnect();
    },
  };
}
