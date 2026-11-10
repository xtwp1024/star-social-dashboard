/**
 * 事件监听器生命周期管理（内存泄漏防护核心）。
 *
 * 泄漏场景：元素从 DOM 移除后，其上的监听器仍持有闭包引用，
 * 导致 GC 无法回收整棵 detached 子树。
 * 对策：所有 addEventListener 统一走 tracker 登记，页面/组件
 * 销毁时一次性 removeAll，保证监听器计数归零。
 */

export function createListenerTracker() {
  /** @type {Array<{target: EventTarget, type: string, handler: Function, options: any}>} */
  const registry = [];

  return {
    /**
     * 登记并添加监听器。
     * @param {EventTarget} target
     * @param {string} type
     * @param {Function} handler
     * @param {object} [options]
     * @returns {Function} 反注册函数（可单独移除该监听器）
     */
    add(target, type, handler, options) {
      if (!target || typeof target.addEventListener !== 'function') {
        throw new Error('tracker.add: 目标不是 EventTarget');
      }
      if (typeof handler !== 'function') {
        throw new Error('tracker.add: handler 必须是函数');
      }
      target.addEventListener(type, handler, options);
      const entry = { target, type, handler, options };
      registry.push(entry);
      return () => this.remove(target, type, handler);
    },

    /**
     * 移除单个监听器。
     * @returns {boolean} 是否找到并移除
     */
    remove(target, type, handler) {
      const idx = registry.findIndex(
        (e) => e.target === target && e.type === type && e.handler === handler,
      );
      if (idx === -1) return false;
      const [entry] = registry.splice(idx, 1);
      if (typeof entry.target.removeEventListener === 'function') {
        entry.target.removeEventListener(entry.type, entry.handler, entry.options);
      }
      return true;
    },

    /**
     * 当前存活监听器总数（泄漏回归测试的断言依据）。
     * @returns {number}
     */
    count() {
      return registry.length;
    },

    /**
     * 按目标统计。
     * @param {EventTarget} target
     * @returns {number}
     */
    countFor(target) {
      return registry.filter((e) => e.target === target).length;
    },

    /**
     * 移除全部监听器（组件销毁 / 页面卸载时调用）。
     * @returns {number} 移除的数量
     */
    removeAll() {
      const n = registry.length;
      // 倒序移除，避免 splice 干扰
      for (let i = registry.length - 1; i >= 0; i--) {
        // eslint-disable-next-line security/detect-object-injection -- i 为受控循环下标，非外部输入
        const entry = registry[i];
        if (typeof entry.target.removeEventListener === 'function') {
          entry.target.removeEventListener(entry.type, entry.handler, entry.options);
        }
      }
      registry.length = 0;
      return n;
    },
  };
}
