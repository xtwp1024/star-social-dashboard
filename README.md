# 星社仪表盘 (star-social-dashboard)

前端项目，当前阶段：**技术债修复基线（XSS 防护 / 输入验证 / 内存泄漏防线）**。

## 快速开始

```bash
npm install
npm run dev      # 开发
npm test         # 单元测试（node:test，零额外依赖）
npm run build    # 构建
```

## 安全基线约定

1. **XSS**：所有用户数据只经 `textContent` 进 DOM；禁止 `innerHTML` / `insertAdjacentHTML`。
   属性写入走白名单（见 `src/security/dom.js`）；URL 一律经 `validateUrl` 阻断伪协议。
2. **CSP**：`index.html` 内置严格 Content-Security-Policy（无内联脚本/样式，object-src none）。
3. **输入验证**：白名单校验 + 控制字符剥离 + 长度上限（见 `src/security/validate.js`），拒绝先于清洗。
4. **内存泄漏**：清空容器用 `clearChildren`（不用 `innerHTML = ''`）；事件监听器只挂在长生命周期节点上。

## 后续（修复 → 深化）

- [ ] 接入真实数据源后补充 `connect-src` 白名单
- [ ] 引入 DOMPurify 作为富文本场景兜底（当前纯文本场景不依赖）
- [ ] 增加内存泄漏回归测试（监听器计数 / Detached DOM）
