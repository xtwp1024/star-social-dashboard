import { createEl, clearChildren } from './security/dom.js';
import { validateMessage } from './security/validate.js';
import { createListenerTracker } from './security/listeners.js';
import { createFeedApi, createMockAdapter } from './data/api.js';

/**
 * 星社仪表盘入口。
 * 安全基线：用户输入永远经 textContent 渲染，绝不走 innerHTML。
 * 所有监听器统一经 tracker 登记，页面卸载时 removeAll 防内存泄漏。
 * 数据访问统一走 createFeedApi——真实数据源确定后仅需替换 adapter，UI 零改动。
 */

/** @type {ReturnType<typeof createListenerTracker> | null} */
let pageTracker = null;

/** 深化阶段（数据源项）当前使用 Mock 适配器，真实后端就绪后替换此行即可 */
const api = createFeedApi({
  adapter: createMockAdapter({
    seedPosts: [
      { text: '星社仪表盘已接入数据层，这条来自 Mock 适配器。', author: '星社机器人' },
      { text: '分页采用游标模式，点击「加载更多」拉取下一页。', author: '星社机器人' },
    ],
    latencyMs: 120,
  }),
});

/** 分页游标状态 */
const feedState = { nextCursor: null, hasMore: true, loading: false };

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return '';
  }
}

/**
 * 渲染一条帖子（textContent 安全渲染）。
 * @param {HTMLElement} feed
 * @param {{ id: string, text: string, author: string, createdAt: string }} post
 * @param {boolean} [prepend] 新发送的帖子插到最前
 */
function renderPost(feed, post, prepend = false) {
  const item = createEl('li', { class: 'feed-item' });
  item.appendChild(
    createEl('span', { class: 'feed-meta' }, `${post.author} · ${formatTime(post.createdAt)}`)
  );
  item.appendChild(createEl('p', { class: 'feed-text' }, post.text));
  if (prepend && feed.firstChild) {
    feed.insertBefore(item, feed.firstChild);
  } else {
    feed.appendChild(item);
  }
  return item;
}

function renderNotice(panel, text) {
  clearNotice(panel);
  panel.appendChild(createEl('p', { class: 'notice', id: 'notice', role: 'alert' }, text));
}

function clearNotice(panel) {
  const n = panel.querySelector('#notice');
  if (n) n.remove();
}

/**
 * 拉取一页帖子并渲染。出错时展示 notice，不静默吞掉。
 * @param {ReturnType<typeof createFeedApi>} api
 * @param {HTMLElement} feed
 * @param {HTMLElement} panel
 * @param {HTMLButtonElement} loadMoreBtn
 */
async function loadPage(api, feed, panel, loadMoreBtn) {
  if (feedState.loading || !feedState.hasMore) return;
  feedState.loading = true;
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = '加载中…';
  try {
    const page = await api.fetchPosts({ limit: 10, cursor: feedState.nextCursor });
    for (const post of page.posts) renderPost(feed, post);
    feedState.nextCursor = page.nextCursor;
    feedState.hasMore = page.hasMore;
    clearNotice(panel);
  } catch {
    renderNotice(panel, '加载失败，请稍后重试');
  } finally {
    feedState.loading = false;
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = '加载更多';
    loadMoreBtn.hidden = !feedState.hasMore;
  }
}

function bootstrap() {
  const app = document.getElementById('app');
  if (!app) return;

  // 页面级监听器注册表：卸载页面（SPA 路由切换等）时统一解除
  pageTracker = createListenerTracker();

  const panel = createEl('section', { class: 'panel' });
  panel.appendChild(createEl('h2', {}, '留言板'));

  const feed = createEl('ul', { class: 'feed', id: 'feed' });
  const loadMoreBtn = createEl('button', { type: 'button', class: 'load-more' }, '加载更多');
  loadMoreBtn.hidden = true;
  pageTracker.add(loadMoreBtn, 'click', () => {
    loadPage(api, feed, panel, loadMoreBtn);
  });

  const input = createEl('input', {
    type: 'text', name: 'message', placeholder: '输入消息（试试 <img onerror> 这类载荷）', maxlength: '500',
  });
  const btn = createEl('button', { type: 'button' }, '发送');

  pageTracker.add(btn, 'click', async () => {
    const result = validateMessage(input.value);
    if (!result.ok) {
      renderNotice(panel, result.reason);
      return;
    }
    btn.disabled = true; // 防重复提交
    try {
      const post = await api.postMessage({ text: result.value });
      clearNotice(panel);
      input.value = '';
      renderPost(feed, post, true);
    } catch {
      renderNotice(panel, '发送失败，请重试');
    } finally {
      btn.disabled = false;
    }
  });

  panel.appendChild(feed);
  panel.appendChild(loadMoreBtn);
  panel.appendChild(input);
  panel.appendChild(btn);
  app.appendChild(panel);

  // 首屏数据
  loadPage(api, feed, panel, loadMoreBtn);
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
