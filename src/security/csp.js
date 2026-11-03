/**
 * CSP connect-src 白名单 —— 单一事实来源（Single Source of Truth）。
 *
 * 当前阶段：无真实数据源，白名单为空，connect-src 仅 'self'。
 * 接入真实数据源时的收紧流程：
 *   1. 在下方 API_ORIGINS 里追加精确 origin（scheme://host[:port]，不得带路径/尾斜杠/通配符）；
 *   2. 同步更新 index.html 的 meta CSP，使 connect-src 与 buildConnectSrc() 产物逐字一致；
 *   3. 运行 npm test —— tests/csp.test.js 会强制两者同步，并拒绝任何通配符或宽松来源。
 *
 * 永远禁止出现：`*`、`unsafe-*`、裸域名（等价于放行任意 scheme）、协议相对 `//host`。
 */

/** 精确 origin 白名单。接入真实数据源前保持为空数组。 */
export const API_ORIGINS = [];

/** origin 格式白名单：仅 http(s) 绝对 origin，主机名为字母数字点横线，可选端口。 */
const ORIGIN_RE = /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?(:\d{1,5})?$/;

/**
 * 校验单个 origin 格式，不合法直接抛错（配置错误必须在测试期暴露）。
 * @param {string} origin
 */
function assertOrigin(origin) {
  if (typeof origin !== 'string' || !ORIGIN_RE.test(origin)) {
    throw new Error(`非法的 connect-src origin：${String(origin)} —— 只允许精确的 http(s)://host[:port]`);
  }
}

/**
 * 生成 connect-src 指令值。'self' 恒在首位，API_ORIGINS 逐个校验后追加。
 * @returns {string}
 */
export function buildConnectSrc() {
  API_ORIGINS.forEach(assertOrigin);
  return ["'self'", ...API_ORIGINS].join(' ');
}
