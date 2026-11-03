import { createEl, clearChildren } from './security/dom.js';
import { validateMessage } from './security/validate.js';

/**
 * 星社仪表盘入口。
 * 演示安全基线：用户输入永远经 textContent 渲染，绝不走 innerHTML。
 */
function bootstrap() {
  const app = document.getElementById('app');
  if (!app) return;

  const panel = createEl('section', { class: 'panel' });
  panel.appendChild(createEl('h2', {}, '留言板（安全渲染演示）'));

  const feed = createEl('ul', { class: 'feed', id: 'feed' });
  const input = createEl('input', {
    type: 'text', name: 'message', placeholder: '输入消息（试试 <img onerror> 这类载荷）', maxlength: '500',
  });
  const btn = createEl('button', { type: 'button' }, '发送');

  btn.addEventListener('click', () => {
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
