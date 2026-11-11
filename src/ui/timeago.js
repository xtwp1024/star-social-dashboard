/**
 * 相对时间格式化（纯函数，无 DOM 依赖）。
 * 规则：1 分钟内「刚刚」，1 小时内精确到分钟，1 天内到小时，7 天内到天；
 * 超过 7 天返回 null，由调用方回退绝对时间（feed-meta 的 toLocaleString）。
 * 未来时间（时钟偏差等）统一按「刚刚」处理，不出现负数文案。
 */

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * @param {string} iso ISO 时间字符串
 * @param {number} [now] 当前时间戳（测试注入用，默认 Date.now()）
 * @returns {string | null} 相对时间文案；无法解析或超过 7 天时为 null
 */
export function formatRelativeTime(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const diff = Math.max(0, now - t);
  if (diff < MINUTE) return '刚刚';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  return null;
}
