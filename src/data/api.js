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
 * @param {{
 *   seedPosts?: Array<{text: string, author?: string}>,
 *   latencyMs?: number,
 *   snapshot?: { posts: Array<{id: string, text: string, author?: string, createdAt: string}>, nextId: number },
 * }} [options]
 * snapshot 用于持久化恢复：由 createPersistedMockAdapter 传入，结构非法时忽略。
 */
export function createMockAdapter({ seedPosts = [], latencyMs = 0, snapshot = null } = {}) {
  let nextId = 0;
  const clock = () => new Date().toISOString();

  const isValidSnapshot = snapshot !== null &&
    typeof snapshot === 'object' &&
    Number.isInteger(snapshot.nextId) && snapshot.nextId > 0 &&
    Array.isArray(snapshot.posts) &&
    snapshot.posts.every(
      (p) => p !== null && typeof p === 'object' &&
        typeof p.id === 'string' && p.id.length > 0 &&
        typeof p.text === 'string'
    );

  /** @type {Array<{id: string, text: string, author: string, createdAt: string}>} */
  const store = isValidSnapshot
    ? snapshot.posts.map((p) => ({
        id: p.id,
        text: p.text,
        author: typeof p.author === 'string' && p.author.length > 0 ? p.author : '匿名星友',
        createdAt: typeof p.createdAt === 'string' && p.createdAt.length > 0 ? p.createdAt : clock(),
      }))
    : seedPosts.map((p) => ({
        id: `p${++nextId}`,
        text: p.text,
        author: p.author ?? '匿名星友',
        createdAt: clock(),
      }));

  if (isValidSnapshot) nextId = snapshot.nextId;

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

    /** 供持久化层导出完整快照（深拷贝，防止外部篡改内部 store） */
    __snapshot() {
      return { posts: store.map((p) => ({ ...p })), nextId };
    },
  };
}

/**
 * 响应契约校验：适配器返回畸形数据时快速失败，
 * 避免 UI 层拿到非法结构后静默乱渲染（与 adapter 方法级校验同一哲学）。
 */
function assertPageShape(page) {
  const ok =
    page !== null && typeof page === 'object' &&
    Array.isArray(page.posts) &&
    typeof page.hasMore === 'boolean' &&
    (page.nextCursor === null || (typeof page.nextCursor === 'string' && page.nextCursor.length > 0)) &&
    page.posts.every(
      (p) => p !== null && typeof p === 'object' &&
        typeof p.id === 'string' && p.id.length > 0 &&
        typeof p.text === 'string'
    );
  if (!ok) {
    throw new TypeError('fetchPosts 返回结构不满足契约 { posts: Post[], nextCursor: string|null, hasMore: boolean }');
  }
}

function assertPostShape(post) {
  const ok =
    post !== null && typeof post === 'object' &&
    typeof post.id === 'string' && post.id.length > 0 &&
    typeof post.text === 'string' &&
    typeof post.createdAt === 'string' && post.createdAt.length > 0;
  if (!ok) {
    throw new TypeError('postMessage 返回结构不满足契约 Post { id, text, author, createdAt }');
  }
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
    async fetchPosts(options) {
      const page = await adapter.fetchPosts(options);
      assertPageShape(page);
      return page;
    },
    async postMessage(payload) {
      const post = await adapter.postMessage(payload);
      assertPostShape(post);
      return post;
    },
  };
}
