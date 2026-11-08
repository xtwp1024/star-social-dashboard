import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPersistedMockAdapter, FEED_STORAGE_KEY } from '../src/data/persist.js';

/** 内存版 Storage 桩（模拟 localStorage 行为） */
function memStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    __raw: map,
  };
}

/** setItem 恒抛错的故障桩 */
function brokenStorage() {
  return { getItem: () => null, setItem: () => { throw new Error('quota exceeded'); } };
}

test('persisted：postMessage 成功后快照落盘', async () => {
  const storage = memStorage();
  const api = createPersistedMockAdapter({ storage });

  await api.postMessage({ text: '持久化这条', author: '小明' });
  const saved = JSON.parse(storage.getItem(FEED_STORAGE_KEY));
  assert.ok(Array.isArray(saved.posts));
  assert.equal(saved.posts.length, 1);
  assert.equal(saved.posts[0].text, '持久化这条');
  assert.equal(saved.posts[0].author, '小明');
  assert.equal(saved.posts[0].id, 'p1');
  assert.equal(saved.nextId, 1);
});

test('persisted：创建实例时即回写种子快照', () => {
  const storage = memStorage();
  createPersistedMockAdapter({
    storage,
    seedPosts: [{ text: '种子一', author: '机器人' }],
  });
  const saved = JSON.parse(storage.getItem(FEED_STORAGE_KEY));
  assert.equal(saved.posts.length, 1);
  assert.equal(saved.posts[0].text, '种子一');
});

test('persisted：跨实例恢复——新实例能看到旧实例发的帖子且 id 不冲突', async () => {
  const storage = memStorage();
  const first = createPersistedMockAdapter({ storage });
  await first.postMessage({ text: '刷新前发的', author: '老张' });

  const second = createPersistedMockAdapter({ storage });
  const { posts } = await second.fetchPosts();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].text, '刷新前发的');
  assert.equal(posts[0].author, '老张');

  // 新帖 id 续号不冲突
  const fresh = await second.postMessage({ text: '刷新后发的' });
  assert.notEqual(fresh.id, posts[0].id);
  const again = await second.fetchPosts();
  assert.equal(again.posts.length, 2);
  assert.deepEqual(again.posts.map((p) => p.text), ['刷新后发的', '刷新前发的']);
});

test('persisted：storage 内 JSON 损坏时丢弃快照从种子重建，不抛错', async () => {
  const storage = memStorage();
  storage.setItem(FEED_STORAGE_KEY, '{not valid json!!');
  const api = createPersistedMockAdapter({
    storage,
    seedPosts: [{ text: '重建种子' }],
  });
  const { posts } = await api.fetchPosts();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].text, '重建种子');
});

test('persisted：快照结构非法（缺 id / posts 非数组 / nextId 非法）一律丢弃重建', async () => {
  const cases = [
    JSON.stringify({ posts: [{ text: '缺 id' }], nextId: 2 }),
    JSON.stringify({ posts: '不是数组', nextId: 2 }),
    JSON.stringify({ posts: [], nextId: 0 }),
    JSON.stringify({ posts: [], nextId: 'p9' }),
    'null',
    '42',
  ];
  for (const raw of cases) {
    const storage = memStorage();
    storage.setItem(FEED_STORAGE_KEY, raw);
    const api = createPersistedMockAdapter({
      storage,
      seedPosts: [{ text: '回退种子' }],
    });
    const { posts } = await api.fetchPosts();
    assert.equal(posts.length, 1);
    assert.equal(posts[0].text, '回退种子');
  }
});

test('persisted：setItem 失败时 postMessage 快速失败向上抛', async () => {
  const api = createPersistedMockAdapter({ storage: brokenStorage() });
  await assert.rejects(() => api.postMessage({ text: '写不进去' }), /quota exceeded/);
});

test('persisted：storage 不满足契约时立即 TypeError（快速失败）', () => {
  assert.throws(() => createPersistedMockAdapter({ storage: null }), TypeError);
  assert.throws(() => createPersistedMockAdapter({ storage: {} }), TypeError);
  assert.throws(
    () => createPersistedMockAdapter({ storage: { getItem: () => null } }),
    TypeError
  );
});
