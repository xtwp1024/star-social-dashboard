/**
 * 首屏加载骨架屏。
 * 数据拉取期间给 feed 渲染占位条，避免首屏空白无反馈；
 * 加载完成/失败后由调用方经 removeAnimated 淡出移除（对称消失动画）。
 * 纯 DOM 构造（不触碰 innerHTML），结构上无文本节点，装饰性占位对屏幕阅读器隐藏。
 */

import { createEl } from '../security/dom.js';

export const SKELETON_MIN = 1;
export const SKELETON_MAX = 12;

/**
 * 生成一组骨架占位条。
 * @param {number} count 条数（1-12 整数，契约外快速失败）
 * @returns {HTMLElement[]} li 骨架条数组，每条含 meta/text 两根微光条
 */
export function createSkeletonItems(count) {
  if (!Number.isInteger(count) || count < SKELETON_MIN || count > SKELETON_MAX) {
    throw new TypeError(`骨架条数必须为 ${SKELETON_MIN}-${SKELETON_MAX} 的整数，收到: ${count}`);
  }
  const items = [];
  for (let i = 0; i < count; i++) {
    const item = createEl('li', { class: 'feed-skeleton', 'aria-hidden': 'true' });
    item.appendChild(createEl('span', { class: 'skel-line skel-meta' }));
    item.appendChild(createEl('span', { class: 'skel-line skel-text' }));
    items.push(item);
  }
  return items;
}
