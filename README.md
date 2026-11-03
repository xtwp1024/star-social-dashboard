# 星社仪表盘 (star-social-dashboard)

前端项目。**技术债修复阶段已完成**（2026-11-03），下一阶段：功能深化。

## 快速开始

```bash
npm install
npm run dev      # 开发
npm test         # 单元测试（node:test，零额外依赖）
npm run build    # 构建
```

## 安全基线约定

1. **XSS**：所有用户数据只经 `textContent` 进 DOM；禁止 `innerHTML` / `insertAdjacentHTML`。
   属性写入走白名单（见 `src/security/dom.js`）；URL 一律经 `validateUrl` 阻断伪协议（含 `data:` / `vbscript:` / 协议相对 / 反斜杠跨站 / 超长 / 含空白）。
2. **CSP**：`index.html` 内置严格 Content-Security-Policy（无内联脚本/样式，object-src none，form-action none，upgrade-insecure-requests）。
   `connect-src` 白名单单一事实来源在 `src/security/csp.js` 的 `API_ORIGINS`，`tests/csp.test.js` 强制与 meta CSP 逐字一致。
3. **输入验证**：白名单校验 + 控制字符剥离 + 长度上限（见 `src/security/validate.js`），拒绝先于清洗。
4. **内存泄漏**：清空容器用 `clearChildren`（不用 `innerHTML = ''`）；监听器统一经 `src/security/listeners.js` 的 tracker 登记，页面卸载时 `removeAll`。

## 修复阶段成果（已完成）

- [x] XSS：textContent 渲染 + createEl 属性白名单 + href/src 走 validateUrl（含伪协议、协议相对、反斜杠、超长、空白等边界回归测试）
- [x] CSP：严格策略 + connect-src 白名单单一来源 + 构建/源码逐字一致性强制测试
- [x] 输入验证：validate.js 白名单 + 40+ 边界用例
- [x] 内存泄漏：listenerTracker + removeAll + 6 项回归测试（含双重断言）

## 深化阶段：待定义需求（需用户确认）

在开始功能深化前，以下问题需要明确。未确认前不在基线上空转加固。

1. **数据源**：仪表盘展示什么数据？来自哪个 API / 后端（决定 `API_ORIGINS` 白名单内容与数据层设计）？
2. **页面结构**：除当前留言板演示外，需要哪些页面/视图？SPA 路由还是多页？
3. **用户体系**：是否需要登录（邮箱/手机/微信）？决定认证方案与 CSP 调整。
4. **部署方式**：静态托管 / 带后端服务？决定构建与发布流程。
5. **富文本需求**：是否有用户富文本场景（决定是否引入 DOMPurify）？

## 后续已知事项

- [ ] 上述需求确认后接入真实数据源，并在 `API_ORIGINS` 追加精确 origin（scheme://host[:port]，禁止通配符 / `unsafe-*` / 裸域名）
- [ ] 富文本场景出现时引入 DOMPurify 兜底（当前纯文本场景不依赖）
- [ ] 远端仓库：https://github.com/xtwp1024/star-social-dashboard
