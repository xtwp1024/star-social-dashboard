import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockAdapter, createFeedApi } from '../src/data/api.js';

test('mock 适配器：postMessage 存入并可通过 fetchPosts 倒序取回', async () => {
  const adapter = createMockAdapter();
  const api = createFeedApi({ adapter });

  const saved = await api.postMessage({ text: '第一条', author: '小明' });
  assert.equal(saved.id, 'p1');
  assert.equal(saved.text, '第一条');
  assert.equal(saved.author, '小明');
  assert.ok(saved.createdAt.length > 0);

  await api.postMessage({ text: '第二条' });
  const { posts, hasMore } = await api.fetchPosts();
  assert.equal(hasMore, false);
  assert.equal(posts.length, 2);
  assert.deepEqual(posts.map((p) => p.text), ['第二条', '第一条']);
  assert.equal(posts[0].author, '匿名星友'); // 缺省 author（最新在前）
});

test('mock 适配器：游标分页逐页取回且 nextCursor 正确', async () => {
  const adapter = createMockAdapter();
  const api = createFeedApi({ adapter });
  for (let i = 1; i <= 5; i++) {
    await api.postMessage({ text: `m${i}` });
  }

  const page1 = await api.fetchPosts({ limit: 2 });
  assert.equal(page1.hasMore, true);
  assert.deepEqual(page1.posts.map((p) => p.text), ['m5', 'm4']);
  assert.equal(page1.nextCursor, 'p4');

  const page2 = await api.fetchPosts({ limit: 2, cursor: page1.nextCursor });
  assert.deepEqual(page2.posts.map((p) => p.text), ['m3', 'm2']);
  assert.equal(page2.hasMore, true);

  const page3 = await api.fetchPosts({ limit: 2, cursor: page2.nextCursor });
  assert.deepEqual(page3.posts.map((p) => p.text), ['m1']);
  assert.equal(page3.hasMore, false);
  assert.equal(page3.nextCursor, null);
});

test('mock 适配器：seedPosts 初始化数据可被读取', async () => {
  const api = createFeedApi({
    adapter: createMockAdapter({
      seedPosts: [
        { text: '种子一', author: 'seed-a' },
        { text: '种子二' },
      ],
    }),
  });
  const { posts, hasMore } = await api.fetchPosts();
  assert.equal(posts.length, 2);
  assert.equal(hasMore, false);
  assert.deepEqual(posts.map((p) => p.text), ['种子二', '种子一']);
});

test('createFeedApi：adapter 缺契约时快速失败', () => {
  assert.throws(() => createFeedApi({ adapter: {} }), TypeError);
  assert.throws(() => createFeedApi({ adapter: { fetchPosts() {} } }), TypeError);
  assert.throws(() => createFeedApi({}), TypeError);
});

test('createFeedApi：fetchPosts 返回畸形结构时快速失败', async () => {
  const badPages = [
    null,
    undefined,
    {},                                   // 缺全部字段
    { posts: 'not-array', hasMore: false, nextCursor: null },
    { posts: [], hasMore: 'yes', nextCursor: null },   // hasMore 非布尔
    { posts: [], hasMore: true, nextCursor: '' },      // 空串 cursor
    { posts: [null], hasMore: false, nextCursor: null },
    { posts: [{ text: '缺 id' }], hasMore: false, nextCursor: null },
    { posts: [{ id: 'x', text: 42 }], hasMore: false, nextCursor: null },
  ];
  for (const page of badPages) {
    const api = createFeedApi({ adapter: { fetchPosts: async () => page, postMessage: async () => ({ id: 'x', text: 't', createdAt: 'now' }) } });
    await assert.rejects(() => api.fetchPosts(), TypeError);
  }
});

test('createFeedApi：postMessage 返回畸形结构时快速失败', async () => {
  const badPosts = [null, {}, { id: '', text: 't', createdAt: 'now' }, { id: 'x', createdAt: 'now' }, { id: 'x', text: 't' }];
  for (const post of badPosts) {
    const api = createFeedApi({ adapter: { fetchPosts: async () => ({ posts: [], hasMore: false, nextCursor: null }), postMessage: async () => post } });
    await assert.rejects(() => api.postMessage({ text: 'hi' }), TypeError);
  }
});

test('createFeedApi：尊重自定义适配器（真实数据源替换点）', async () => {
  const calls = [];
  const custom = {
    fetchPosts: async (opts) => {
      calls.push(['fetchPosts', opts]);
      return { posts: [{ id: 'x1', text: 't', author: 'a', createdAt: 'now' }], nextCursor: null, hasMore: false };
    },
    postMessage: async (payload) => {
      calls.push(['postMessage', payload]);
      return { id: 'x2', ...payload, createdAt: 'now' };
    },
  };
  const api = createFeedApi({ adapter: custom });
  const r1 = await api.fetchPosts({ limit: 3 });
  assert.equal(r1.posts[0].id, 'x1');
  const r2 = await api.postMessage({ text: 'hi' });
  assert.equal(r2.id, 'x2');
  assert.deepEqual(calls, [['fetchPosts', { limit: 3 }], ['postMessage', { text: 'hi' }]]);
});
