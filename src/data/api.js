/**
 * 数据访问层：统一的数据源抽象。
 *
 * 设计目标（深化阶段·数据源项）：
 * - UI 只依赖 createFeedApi 暴露的 fetchPosts / postMessage 两个方法；
 * - 真实数据源确定后，仅需实现新适配器并替换传入的 adapter，UI 层零改动；
 * - 本层不做输入净化/验证——那是 UI 层 validateMessage 的职责（单一职责）。
 */

/**
 * 适配器契约：
 *   fetchPosts({ limit, cursor }) -> Promise<{ posts, nextCursor, hasMore }>
 *   postMessage({ text, author }) -> Promise<Post>
 * Post 结构：{ id, text, author, createdAt }
 */

/**
 * Mock 适配器：内存存储 + 游标分页，模拟真实后端行为。
 * @param {{ seedPosts?: Array<{text: string, author?: string}>, latencyMs?: number }} [options]
 */
export function createMockAdapter({ seedPosts = [], latencyMs = 0 } = {}) {
  let nextId = 0;
  const clock = () => new Date().toISOString();

  /** @type {Array<{id: string, text: string, author: string, createdAt: string}>} */
  const store = seedPosts.map((p) => ({
    id: `p${++nextId}`,
    text: p.text,
    author: p.author ?? '匿名星友',
    createdAt: clock(),
  }));

  const delay = () =>
    latencyMs > 0 ? new Promise((r) => setTimeout(r, latencyMs)) : Promise.resolve();

  return {
    async fetchPosts({ limit = 20, cursor = null } = {}) {
      await delay();
      // store 按 id 升序存储；返回按 createdAt（即 id）倒序的最新在前
      const ordered = [...store].reverse();
      const startIdx = cursor ? ordered.findIndex((p) => p.id === cursor) + 1 : 0;
      const page = ordered.slice(startIdx, startIdx + limit);
      const hasMore = startIdx + limit < ordered.length;
      return {
        posts: page,
        nextCursor: hasMore ? page[page.length - 1].id : null,
        hasMore,
      };
    },

    async postMessage({ text, author = '匿名星友' }) {
      await delay();
      const post = { id: `p${++nextId}`, text, author, createdAt: clock() };
      store.push(post);
      return post;
    },

    /** 仅供测试：当前存储条数 */
    __size() {
      return store.length;
    },
  };
}

/**
 * 创建 feed API。adapter 不满足契约时立即抛错（快速失败，避免静默降级）。
 * @param {{ adapter: { fetchPosts: Function, postMessage: Function } }} options
 */
export function createFeedApi({ adapter }) {
  if (!adapter || typeof adapter.fetchPosts !== 'function' || typeof adapter.postMessage !== 'function') {
    throw new TypeError('adapter 必须实现 fetchPosts 与 postMessage');
  }
  return {
    fetchPosts: (options) => adapter.fetchPosts(options),
    postMessage: (payload) => adapter.postMessage(payload),
  };
}
