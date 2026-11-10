# 星社仪表盘 (star-social-dashboard)

前端项目。**技术债修复阶段已完成**（2026-11-03），当前处于功能深化阶段。

- 线上地址：https://xtwp1024.github.io/star-social-dashboard/
- 远端仓库：https://github.com/xtwp1024/star-social-dashboard
- CI：GitHub Actions（push 触发 lint + test + build + CSP 校验 + audit）；部署：Pages 工作流自动发布。

## 快速开始

```bash
npm install
npm run dev      # 开发
npm test         # 单元测试（node:test，零额外依赖）
npm run build    # 构建
npm run verify   # 单命令全量验证链：lint -> test -> build -> CSP 校验 -> npm audit
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

## 深化阶段：需求确认状态

1. **数据源**：已接入数据层抽象（`src/data/api.js`，createFeedApi + Mock 适配器 + localStorage 持久化 + 响应契约校验）。**真实数据源仍待用户确认**，确认后在 `API_ORIGINS`（`src/security/csp.js`）追加精确 origin。
2. **页面结构**：留言板演示已迭代（加载更多游标分页、空态/错误态+重试、出现/消失动画、a11y role/focus-visible、字数计数预警、Enter 发送、移动端响应式、favicon/meta）。**是否需要更多页面/路由待确认**。
3. **部署方式**：已上线 GitHub Pages（build_type=workflow，`base: './'`）。**如需后端服务/自托管待确认**。
4. **用户体系**：**待用户确认**——是否需要登录（邮箱/手机/微信），决定认证方案与 CSP 调整。
5. **富文本需求**：**待用户确认**——当前纯文本场景不依赖 DOMPurify；出现富文本场景时引入兜底。

## 后续已知事项

- [ ] **用户体系**方案待用户确认（深化仅剩此项与富文本）
- [ ] **富文本**需求待用户确认；出现场景时引入 DOMPurify 兜底
- [ ] 真实数据源确认后：在 `API_ORIGINS` 追加精确 origin（scheme://host[:port]，禁止通配符 / `unsafe-*` / 裸域名），Mock 适配器替换为真实 adapter
- [ ] 依赖基线：vite ^6（7/8 为破坏性跳迁，暂不升）、eslint ^9（v10 依赖链有漏洞，锁版本）
