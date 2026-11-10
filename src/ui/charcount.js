/**
 * 输入字数计数状态（纯函数，便于回归测试）。
 * 与 <input maxlength> 的计数口径一致：按 UTF-16 code unit 计数。
 */

/** 接近上限的预警阈值：剩余不足 50 字时变色提醒 */
const WARN_REMAINING = 50;

/**
 * @param {string} value 当前输入值
 * @param {number} max 上限（与 maxlength 一致）
 * @returns {{ text: string, warn: boolean }} 展示文本与是否预警
 */
export function charCountState(value, max) {
  if (typeof value !== 'string') value = '';
  if (!Number.isFinite(max) || max <= 0) return { text: '', warn: false };
  const len = Math.min(value.length, max); // 超限（如程序赋值）按上限封顶，不展示负余量
  return {
    text: `${len}/${max}`,
    warn: max - len < WARN_REMAINING,
  };
}
