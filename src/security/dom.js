/**
 * 安全 DOM 渲染工具。
 * 原则：任何用户数据只允许通过 textContent 进入 DOM，
 * 禁止 innerHTML / insertAdjacentHTML / document.write。
 */

import { validateUrl } from './validate.js';

/**
 * 创建元素并安全填充文本内容。
 * @param {string} tag 合法 HTML 标签名
 * @param {object} [attrs] 属性映射（仅白名单属性，值一律为字符串）
 * @param {string} [text] 文本内容（经 textContent 写入，天然免疫 XSS）
 * @returns {HTMLElement}
 */
export function createEl(tag, attrs = {}, text = '') {
  if (!/^[a-z][a-z0-9-]*$/i.test(tag)) {
    throw new Error(`非法标签名: ${tag}`);
  }
  const el = document.createElement(tag);
  const ALLOWED_ATTRS = new Set([
    'class', 'id', 'href', 'src', 'alt', 'title', 'type', 'name',
    'placeholder', 'value', 'disabled', 'hidden', 'role', 'data-id', 'datetime',
    // aria-hidden：装饰性占位元素（骨架屏等）对屏幕阅读器隐藏；固定字符串值，无注入面
    'aria-hidden',
  ]);
  for (const [key, value] of Object.entries(attrs)) {
    if (!ALLOWED_ATTRS.has(key)) continue;
    // href/src 统一走 validateUrl 白名单（仅 http(s) 与站内相对路径），
    // 阻断 javascript:/vbscript:/data: 等全部伪协议与协议相对/反斜杠技巧。
    if (key === 'href' || key === 'src') {
      const check = validateUrl(String(value));
      if (!check.ok) continue;
      el.setAttribute(key, check.value);
      continue;
    }
    el.setAttribute(key, String(value));
  }
  if (text) el.textContent = text;
  return el;
}

/**
 * 清空容器子节点（不使用 innerHTML = ''，避免残留事件监听器引用）。
 * @param {Element} container
 */
export function clearChildren(container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

/**
 * 带消失动画的移除：给节点加 leaving 类播放淡出动画，animationend 后移除节点。
 * 一致性保证：prefers-reduced-motion 下 CSS 把动画压到 0.01ms，animationend 仍会触发；
 * 超时兜底确保节点最迟在 duration + 100ms 内移除，任何异常下都不会残留。
 * 监听器为一次性（{ once: true }）且挂在待移除节点上，节点移除即随之回收，无泄漏。
 * @param {HTMLElement} el
 * @param {{ duration?: number }} [options] duration 与 CSS sink-out 动画时长（180ms）对应
 */
export function removeAnimated(el, { duration = 180 } = {}) {
  if (!el || !el.isConnected || el.dataset.leaving === '1') return;
  el.dataset.leaving = '1';
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    el.remove();
  };
  el.classList.add('leaving');
  el.addEventListener('animationend', finish, { once: true });
  setTimeout(finish, duration + 100);
}
