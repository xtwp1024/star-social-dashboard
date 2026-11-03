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
    'placeholder', 'value', 'disabled', 'hidden', 'role', 'data-id',
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
