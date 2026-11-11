import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRelativeTime } from '../src/ui/timeago.js';

const NOW = Date.parse('2026-11-11T12:00:00Z');

test('1 分钟内显示「刚刚」', () => {
  assert.equal(formatRelativeTime('2026-11-11T11:59:30Z', NOW), '刚刚');
});

test('边界：恰好 60 秒进入分钟档', () => {
  assert.equal(formatRelativeTime('2026-11-11T11:59:00Z', NOW), '1 分钟前');
});

test('小时内精确到分钟', () => {
  assert.equal(formatRelativeTime('2026-11-11T11:30:00Z', NOW), '30 分钟前');
});

test('边界：恰好 60 分钟进入小时档', () => {
  assert.equal(formatRelativeTime('2026-11-11T11:00:00Z', NOW), '1 小时前');
});

test('天内精确到小时', () => {
  assert.equal(formatRelativeTime('2026-11-11T02:00:00Z', NOW), '10 小时前');
});

test('边界：恰好 24 小时进入天档', () => {
  assert.equal(formatRelativeTime('2026-11-10T12:00:00Z', NOW), '1 天前');
});

test('7 天内精确到天', () => {
  assert.equal(formatRelativeTime('2026-11-05T00:00:00Z', NOW), '6 天前');
});

test('边界：恰好 7 天返回 null（回退绝对时间）', () => {
  assert.equal(formatRelativeTime('2026-11-04T12:00:00Z', NOW), null);
});

test('未来时间（时钟偏差）按「刚刚」处理，不出现负数', () => {
  assert.equal(formatRelativeTime('2026-11-11T12:00:30Z', NOW), '刚刚');
});

test('无法解析的时间返回 null', () => {
  assert.equal(formatRelativeTime('not-a-date', NOW), null);
  assert.equal(formatRelativeTime('', NOW), null);
});

test('省略 now 参数时使用当前时间（冒烟）', () => {
  const result = formatRelativeTime(new Date(Date.now() - 30_000).toISOString());
  assert.equal(result, '刚刚');
});
