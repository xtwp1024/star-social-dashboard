import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { API_ORIGINS, buildConnectSrc } from '../src/security/csp.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 从 index.html 解析 meta CSP 的 content 值 */
function parseMetaCsp() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
  assert.ok(m, 'index.html 必须包含 meta CSP');
  return m[1];
}

/** 取某指令（如 connect-src）的值 */
function directive(csp, name) {
  const m = csp.match(new RegExp(`(?:^|;)\\s*${name}\\s+([^;]+)`, 'i'));
  return m ? m[1].trim() : null;
}

test('meta CSP 的 connect-src 与白名单产物逐字一致（防止加数据源后忘了同步收紧）', () => {
  const csp = parseMetaCsp();
  assert.equal(directive(csp, 'connect-src'), buildConnectSrc());
});

test('meta CSP 其他指令保持严格基线（无 unsafe-*/object-src none/frame-ancestors none）', () => {
  const csp = parseMetaCsp();
  assert.equal(directive(csp, 'object-src'), "'none'");
  assert.equal(directive(csp, 'frame-ancestors'), "'none'");
  assert.ok(!csp.includes('unsafe-inline'), '不应出现 unsafe-inline');
  assert.ok(!csp.includes('unsafe-eval'), '不应出现 unsafe-eval');
  assert.ok(!csp.includes('data:'), 'CSP 不应放行 data: 源');
});

test('connect-src 白名单不含通配符与宽松来源', () => {
  const value = buildConnectSrc();
  for (const bad of ['*', 'unsafe-', 'data:', 'blob:']) {
    assert.ok(!value.includes(bad), `connect-src 不应包含 ${bad}`);
  }
  for (const token of value.split(' ')) {
    if (token === "'self'") continue;
    assert.match(token, /^https?:\/\//, `白名单项 ${token} 必须是精确 origin`);
  }
});

test('白名单当前为空（无真实数据源时 connect-src 仅 self）', () => {
  assert.deepEqual(API_ORIGINS, []);
  assert.equal(buildConnectSrc(), "'self'");
});

test('buildConnectSrc 拒绝非法 origin（通配符/路径/伪协议/协议相对）', () => {
  const bads = [
    'https://*.example.com', // 通配符
    'https://a.com/path',    // 带路径
    'https://a.com/',        // 尾斜杠
    'data:text/plain',       // 伪协议
    '//evil.com',            // 协议相对
    'ftp://files.example.com', // 非 http(s) scheme
    'evil.com',              // 裸域名（等价放行任意 scheme）
  ];
  for (const bad of bads) {
    API_ORIGINS.push(bad);
    try {
      assert.throws(() => buildConnectSrc(), /非法的 connect-src origin/, bad);
    } finally {
      API_ORIGINS.pop();
    }
  }
  assert.deepEqual(API_ORIGINS, [], '测试后白名单必须恢复原状');
});
