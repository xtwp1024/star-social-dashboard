// 校验构建产物保留严格 CSP（CI 与本地 verify 共用）
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const distHtml = resolve(process.cwd(), 'dist/index.html');
if (!existsSync(distHtml)) {
  console.error('[verify-csp] dist/index.html 不存在，请先运行 build');
  process.exit(1);
}

const html = readFileSync(distHtml, 'utf8');
const m = html.match(/<meta[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/i);
if (!m) {
  console.error('[verify-csp] 构建产物缺少 CSP meta 标签');
  process.exit(1);
}
const csp = m[1];

const required = [
  "default-src 'self'",
  "script-src 'self'",
  "object-src 'none'",
  "form-action 'none'",
  'upgrade-insecure-requests',
];
const missing = required.filter((d) => !csp.includes(d));

if (missing.length > 0) {
  console.error('[verify-csp] CSP 缺少关键指令:', missing.join('; '));
  process.exit(1);
}

console.log('[verify-csp] OK:', csp);
