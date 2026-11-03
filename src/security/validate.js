/**
 * 输入验证模块。
 * 原则：白名单校验 + 长度上限 + 控制字符剥离，拒绝先于清洗。
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * 剥离控制字符并裁剪长度（不转义 HTML —— 输出交给 textContent）。
 * @param {string} input
 * @param {number} maxLen 默认 200
 * @returns {string}
 */
export function sanitizeText(input, maxLen = 200) {
  if (typeof input !== 'string') return '';
  return input.replace(CONTROL_CHARS, '').slice(0, maxLen);
}

/**
 * 用户名校验：3-20 位，字母/数字/下划线/中文。
 * @param {string} input
 * @returns {{ok: boolean, value?: string, reason?: string}}
 */
export function validateUsername(input) {
  const s = sanitizeText(input, 20).trim();
  if (s.length < 3) return { ok: false, reason: '用户名至少 3 个字符' };
  if (!/^[\w\u4e00-\u9fa5]+$/u.test(s)) return { ok: false, reason: '仅允许字母、数字、下划线、中文' };
  return { ok: true, value: s };
}

/**
 * 消息校验：非空、长度 1-500。
 * @param {string} input
 * @returns {{ok: boolean, value?: string, reason?: string}}
 */
export function validateMessage(input) {
  const s = sanitizeText(input, 500).trim();
  if (!s) return { ok: false, reason: '消息不能为空' };
  return { ok: true, value: s };
}

/**
 * URL 校验：仅允许 http/https 相对路径，阻断 javascript: 等伪协议。
 * @param {string} input
 * @returns {{ok: boolean, value?: string, reason?: string}}
 */
export function validateUrl(input) {
  const s = sanitizeText(input, 2048).trim();
  if (/^(https?:\/\/|\/)/i.test(s)) return { ok: true, value: s };
  return { ok: false, reason: '仅允许 http(s) 或站内相对路径' };
}
