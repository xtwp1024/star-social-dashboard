import { createEl, removeAnimated } from './security/dom.js';
import { validateMessage } from './security/validate.js';
import { createListenerTracker } from './security/listeners.js';
import { createFeedApi, createMockAdapter } from './data/api.js';
import { createPersistedMockAdapter } from './data/persist.js';
import { charCountState } from './ui/charcount.js';
import { formatRelativeTime } from './ui/timeago.js';
import { createTimeRefresher } from './ui/timerefresh.js';
import { createInfiniteScroll } from './ui/infinite-scroll.js';

/**
 * 星社仪表盘入口。
 * 安全基线：用户输入永远经 textContent 渲染，绝不走 innerHTML。
 * 所有监听器统一经 tracker 登记，页面卸载时 removeAll 防内存泄漏。
 * 数据访问统一走 createFeedApi——真实数据源确定后仅需替换 adapter，UI 零改动。
 */

/** @type {ReturnType<typeof createListenerTracker> | null} */
let pageTracker = null;

/** 相对时间周期刷新器（bootstrap 创建，页面卸载时停止） */
let timeRefresher = null;

/** 无限滚动观察器（bootstrap 创建，页面卸载时断开） */
let autoLoader = null;

/** localStorage 可用性探测（隐私模式/被禁用时访问即抛错），不可用返回 null */
function getStorage() {
  try {
    const s = globalThis.localStorage;
    s.setItem('__star_probe__', '1');
    s.removeItem('__star_probe__');
    return s;
  } catch {
    return null;
  }
}

const seedPosts = [
  { text: '星社仪表盘已接入数据层，这条来自 Mock 适配器。', author: '星社机器人' },
  { text: '分页采用游标模式，点击「加载更多」拉取下一页。', author: '星社机器人' },
];
const mockOptions = { seedPosts, latencyMs: 120 };

/** 深化阶段（数据源项）：localStorage 可用时带持久化（刷新不丢帖），否则退回纯内存 Mock */
const storage = getStorage();
const api = createFeedApi({
  adapter: storage
    ? createPersistedMockAdapter({ storage, ...mockOptions })
    : createMockAdapter(mockOptions),
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

/** 优先相对时间（刚刚/N 分钟前/…），超过 7 天或解析失败回退绝对时间 */
function formatPostTime(iso) {
  return formatRelativeTime(iso) ?? formatTime(iso);
}

/**
 * 渲染一条帖子（textContent 安全渲染）。
 * @param {HTMLElement} feed
 * @param {{ id: string, text: string, author: string, createdAt: string }} post
 * @param {boolean} [prepend] 新发送的帖子插到最前
 */
function renderPost(feed, post, prepend = false) {
  const item = createEl('li', { class: 'feed-item' });
  const meta = createEl('span', { class: 'feed-meta' }, `${post.author} · `);
  meta.appendChild(createEl('time', { datetime: post.createdAt }, formatPostTime(post.createdAt)));
  item.appendChild(meta);
  item.appendChild(createEl('p', { class: 'feed-text' }, post.text));
  if (prepend && feed.firstChild) {
    feed.insertBefore(item, feed.firstChild);
  } else {
    feed.appendChild(item);
  }
  return item;
}

/**
 * 渲染顶部提示。error 用 role=alert 立即播报；success 用 role=status 温和播报。
 */
function renderNotice(panel, text, tone = 'error') {
  clearNotice(panel);
  panel.appendChild(createEl('p', {
    class: `notice notice-${tone}`,
    id: 'notice',
    role: tone === 'error' ? 'alert' : 'status',
  }, text));
}

/** 成功提示自动消失的定时器（模块级单例，重复发送前先清旧，避免旧定时器误清新提示） */
let successNoticeTimer = null;

/**
 * 发送成功反馈：短暂显示「已发送」后自动淡出（走 removeAnimated 消失动画）。
 * 定时器回调里校验当前 notice 仍是成功态才清除——期间若被错误提示替换则不误删。
 */
function renderSuccessNotice(panel) {
  renderNotice(panel, '已发送', 'success');
  if (successNoticeTimer) clearTimeout(successNoticeTimer);
  successNoticeTimer = setTimeout(() => {
    successNoticeTimer = null;
    const current = panel.querySelector('#notice');
    if (current && current.classList.contains('notice-success')) {
      clearNotice(panel);
    }
  }, 2000);
}

function clearNotice(panel) {
  const n = panel.querySelector('#notice');
  if (!n) return;
  n.removeAttribute('id'); // 动画淡出期间避免与新 notice 的 id 重复
  removeAnimated(n);
}

function clearEmptyState(feed) {
  const e = feed.querySelector('.feed-empty:not(.leaving)');
  if (e) removeAnimated(e);
}

function renderEmptyState(feed) {
  if (feed.querySelector('.feed-empty:not(.leaving)')) return;
  feed.appendChild(createEl('li', { class: 'feed-empty', role: 'status' }, '暂无内容，来发第一条吧'));
}

function clearErrorState(feed) {
  const e = feed.querySelector('.feed-error:not(.leaving)');
  if (e) removeAnimated(e);
}

/**
 * 加载失败且列表为空时的错误态：原因说明 + 重试按钮（点击后清除自身并重发请求）。
 * 重试按钮监听器同样经 tracker 登记，保持「所有监听器统一登记」的约定。
 */
function renderErrorState(feed, tracker, retry) {
  if (feed.querySelector('.feed-error:not(.leaving)')) return;
  const item = createEl('li', { class: 'feed-error' });
  item.appendChild(createEl('span', { class: 'feed-error-text', role: 'alert' }, '加载失败，网络或数据源异常'));
  const retryBtn = createEl('button', { type: 'button', class: 'feed-retry' }, '重试');
  tracker.add(retryBtn, 'click', () => {
    clearErrorState(feed);
    retry();
  });
  item.appendChild(retryBtn);
  feed.appendChild(item);
}

/**
 * 拉取一页帖子并渲染。出错时展示 notice，不静默吞掉。
 * @returns {Promise<boolean>} 本页是否加载成功（供无限滚动判断是否继续连续补页）
 */
async function loadPage(api, feed, panel, loadMoreBtn, tracker) {
  if (feedState.loading || !feedState.hasMore) return false;
  feedState.loading = true;
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = '加载中…';
  try {
    const page = await api.fetchPosts({ limit: 10, cursor: feedState.nextCursor });
    clearEmptyState(feed);
    clearErrorState(feed);
    for (const post of page.posts) renderPost(feed, post);
    feedState.nextCursor = page.nextCursor;
    feedState.hasMore = page.hasMore;
    if (feed.querySelectorAll('.feed-item').length === 0 && !page.hasMore) {
      renderEmptyState(feed);
    }
    clearNotice(panel);
    return true;
  } catch {
    // 列表已有内容（翻页失败）→ 顶部 notice 提示即可，保留已渲染数据；
    // 列表为空（首屏失败）→ 列表区错误态 + 重试按钮，避免用户面对空白无反馈
    if (feed.querySelectorAll('.feed-item').length === 0) {
      renderErrorState(feed, tracker, () => loadPage(api, feed, panel, loadMoreBtn, tracker));
    } else {
      renderNotice(panel, '加载失败，请稍后重试');
    }
    return false;
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

  // 无限滚动：按钮进入视口自动加载（渐进增强，不支持 IO 时点击按钮兜底）。
  // 加载成功且按钮仍在视口内则连续补页；失败路径不 recheck，防止错误风暴。
  const loadMore = async () => {
    const ok = await loadPage(api, feed, panel, loadMoreBtn, pageTracker);
    if (ok) autoLoader?.recheck();
  };
  pageTracker.add(loadMoreBtn, 'click', loadMore);
  autoLoader = createInfiniteScroll(loadMoreBtn, { onVisible: () => { loadMore(); } });

  const input = createEl('input', {
    type: 'text', name: 'message', placeholder: '输入消息（试试 <img onerror> 这类载荷）', maxlength: '500',
  });
  const btn = createEl('button', { type: 'button' }, '发送');

  // 字数计数：与 maxlength 同口径，接近上限红色预警；
  // aria-live 仅在进入预警态时启用，避免正常打字时屏幕阅读器逐键播报
  const charCount = createEl('span', { class: 'char-count' });
  const updateCharCount = () => {
    const s = charCountState(input.value, 500);
    charCount.textContent = s.text;
    charCount.classList.toggle('char-count-warn', s.warn);
    if (s.warn) charCount.setAttribute('aria-live', 'polite');
    else charCount.removeAttribute('aria-live');
  };
  updateCharCount();
  pageTracker.add(input, 'input', updateCharCount);

  // Enter 直接发送（Shift+Enter 不拦截，为将来多行输入留余地）
  pageTracker.add(input, 'keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !btn.disabled) btn.click();
  });

  pageTracker.add(btn, 'click', async () => {
    const result = validateMessage(input.value);
    if (!result.ok) {
      renderNotice(panel, result.reason);
      return;
    }
    btn.disabled = true; // 防重复提交
    try {
      const post = await api.postMessage({ text: result.value });
      input.value = '';
      updateCharCount(); // 发送成功清空后同步计数
      clearEmptyState(feed);
      renderPost(feed, post, true);
      renderSuccessNotice(panel);
      input.focus(); // 连续输入体验：发送后光标回到输入框
    } catch {
      renderNotice(panel, '发送失败，请重试');
    } finally {
      btn.disabled = false;
    }
  });

  panel.appendChild(feed);
  panel.appendChild(loadMoreBtn);
  const composer = createEl('div', { class: 'composer' });
  composer.appendChild(input);
  composer.appendChild(charCount);
  composer.appendChild(btn);
  panel.appendChild(composer);
  app.appendChild(panel);

  // 相对时间周期刷新：页面长开时「刚刚」等文案会陈旧。
  // 定时刷新走可见性门控；回到前台由 visibilitychange 立即补偿（监听器经 tracker 登记）。
  timeRefresher = createTimeRefresher(feed, { fallback: formatTime });
  pageTracker.add(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible') timeRefresher?.tick();
  });
  timeRefresher.start();

  // 首屏数据
  loadPage(api, feed, panel, loadMoreBtn, pageTracker);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// 页面卸载时统一解除所有监听器并停止定时器/观察器，防止 detached 节点泄漏
window.addEventListener('pagehide', () => {
  timeRefresher?.stop();
  autoLoader?.disconnect();
  pageTracker?.removeAll();
}, { once: true });
