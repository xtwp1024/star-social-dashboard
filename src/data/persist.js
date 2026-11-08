/**
 * 持久化层：给 Mock 适配器加上 storage（localStorage）持久化。
 *
 * 设计（深化阶段·数据源项）：
 * - 刷新页面后用户发送的帖子不丢失；
 * - 快照结构非法 / JSON 损坏时静默丢弃、从种子重建（ fail-safe，不阻塞 UI）；
 * - 写入失败（隐私模式、配额满）时快速失败向上抛——UI 已有「发送失败」notice 兜底；
 * - 真实后端就绪后整层替换，UI 零改动。
 */

import { createMockAdapter } from './api.js';

export const FEED_STORAGE_KEY = 'star-social-feed:v1';

function isStorage(storage) {
  return storage !== null && typeof storage === 'object' &&
    typeof storage.getItem === 'function' && typeof storage.setItem === 'function';
}

/**
 * 从 storage 读取并校验快照。任何异常（无数据、JSON 损坏、结构非法）都返回 null。
 */
function loadSnapshot(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (typeof raw !== 'string' || raw.length === 0) return null;
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.posts)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 创建带 localStorage 持久化的 Mock feed 适配器。
 * @param {{
 *   storage: { getItem: Function, setItem: Function },
 *   key?: string,
 *   seedPosts?: Array<{text: string, author?: string}>,
 *   latencyMs?: number,
 * }} options storage 必传（浏览器传 localStorage，测试传内存桩）。
 */
export function createPersistedMockAdapter({ storage, key = FEED_STORAGE_KEY, ...mockOptions }) {
  if (!isStorage(storage)) {
    throw new TypeError('storage 必须实现 getItem 与 setItem（浏览器传 localStorage）');
  }

  const adapter = createMockAdapter({ ...mockOptions, snapshot: loadSnapshot(storage, key) });

  const persist = () => storage.setItem(key, JSON.stringify(adapter.__snapshot()));
  // 恢复出的快照回写一次，让种子数据在首次访问后也落盘
  try {
    persist();
  } catch {
    // 初始回写失败不阻塞首屏，后续 postMessage 失败会正常向上抛
  }

  return {
    async fetchPosts(options) {
      return adapter.fetchPosts(options);
    },
    async postMessage(payload) {
      const post = await adapter.postMessage(payload);
      persist(); // 写失败向上抛，UI 显示发送失败；帖子仍在内存中，下次拉取可见
      return post;
    },
  };
}
