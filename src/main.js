import { createEl, clearChildren } from './security/dom.js';
import { validateMessage } from './security/validate.js';
import { createListenerTracker } from './security/listeners.js';

/**
 * 星社仪表盘入口。
 * 演示安全基线：用户输入永远经 textContent 渲染，绝不走 innerHTML。
 * 所有监听器统一经 tracker 登记，页面卸载时 removeAll 防内存泄漏。
 */

/** @type {ReturnType<typeof createListenerTracker> | null} */
let pageTracker = null;

function bootstrap() {
  const app = document.getElementById('app');
  if (!app) return;

  // 页面级监听器注册表：卸载页面（SPA 路由切换等）时统一解除
  pageTracker = createListenerTracker();

  const panel = createEl('section', { class: 'panel' });
  panel.appendChild(createEl('h2', {}, '留言板（安全渲染演示）'));

  const feed = createEl('ul', { class: 'feed', id: 'feed' });
  const input = createEl('input', {
    type: 'text', name: 'message', placeholder: '输入消息（试试 <img onerror> 这类载荷）', maxlength: '500',
  });
  const btn = createEl('button', { type: 'button' }, '发送');

  pageTracker.add(btn, 'click', () => {
    const result = validateMessage(input.value);
    if (!result.ok) {
      renderNotice(panel, result.reason);
      return;
    }
    feed.appendChild(createEl('li', { class: 'feed-item' }, result.value));
    input.value = '';
    clearNotice(panel);
  });

  panel.appendChild(feed);
  panel.appendChild(input);
  panel.appendChild(btn);
  app.appendChild(panel);
}

function renderNotice(panel, text) {
  clearNotice(panel);
  panel.appendChild(createEl('p', { class: 'notice', id: 'notice', role: 'alert' }, text));
}

function clearNotice(panel) {
  const n = panel.querySelector('#notice');
  if (n) n.remove();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// 页面卸载时统一解除所有监听器，防止 detached 节点泄漏
window.addEventListener('pagehide', () => {
  pageTracker?.removeAll();
}, { once: true });
