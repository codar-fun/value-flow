# 社区货币 /「流动圈」

> 当前状态：前端已接入 **loop-backend**，处于产品验证和小范围多人测试阶段。
> “流动圈”仍是暂名。

线上地址：<https://flow.sola.day>

## 产品边界

流动圈为社区、微信和线下关系中已经发生的互助提供一层轻量记忆。数字是关系留下的痕迹，不是人的评分。

- 不做贡献排行榜、信用分或跨圈额度兑换；
- “需要 / 提供”帮助人开口，不承担站内撮合和履约；
- 用户可以提出请求，也始终可以拒绝；
- 没有被记录的帮助依然成立；
- 不把产品逐渐做成复杂的社区管理后台。

## 当前架构

`loop-backend`（Phoenix + PostgreSQL，`https://loop-api.sola.day/api`）是唯一的业务数据和身份来源。当前前端没有自己的业务数据库，也不会在浏览器端重新计算余额。

- 页面请求同源 `/api/*`，由服务端代理 loop-backend；
- access / refresh token 只保存在 httpOnly cookie（`loop_at`、`loop_rt`、`loop_at_exp`），不进入 localStorage；
- 登录使用邮箱 OTP：申请验证码 → 验证 → 首次注册完善资料；
- 页面通过 `GET /api/bootstrap` 获取当前用户可见的成员、圈子、账户、动态、通知和设置；
- `db/runtime.ts` 只负责把 loop 数据转换成界面模型；
- 正式域名由 `ginger.yml` 描述的现有生产服务发布，`LOOP_API_BASE` 指向生产 loop-backend。

端点对照表见 loop-backend 仓库中的 `docs/community-currency-api-map.md`。

## 当前已实现

- 邮箱 OTP 登录、注册、退出和资料编辑；
- 8 个系统彩色抽象头像作为默认头像，编辑资料时可切换系统图案或定制人物头像；
- 多圈账户、圈子切换、成员档案和同圈联系方式；
- 创建圈子、圈子主题图标、规则设置、参考物、加入方式和圈主转让；
- 公开圈发现、入圈申请、审批、撤回申请和退出圈子；
- 7 天有效、单次使用的邀请链接、二维码海报和图片保存；
- 发布“我想要 / 我可以给”，设置多圈或跨圈可见并暂停、恢复或关闭；
- 记录已完成的互助、待另一方确认、拒绝、撤销和双方接受的更正流程；
- 好人卡、通知、通知直达处理入口；
- 个人档案、动态和邀请分享页，生成真实二维码并保存为 PNG；
- `?profile=` 与 `?post=` 深链接；
- 桌面与竖屏布局、等宽底部导航、顶部入口和站内确认弹窗。

## 已知阻塞问题

### P1：更正后的记录撤销时余额未回滚

已确认记录从 4 更正为 6 并由另一方接受后，再撤销该记录：接口返回成功，记录消失，但双方余额仍为 `+6/-6`。普通“确认后直接撤销”可以正确回滚，因此问题集中在：

```text
pending → confirmed → corrected → rejected
```

前端只转发撤销请求并展示 `/bootstrap` 返回的账户值；账本冲销需要 loop-backend 修复。完整复现和验收标准见 [`docs/后端问题：已更正记录撤销后余额未回滚.md`](docs/后端问题：已更正记录撤销后余额未回滚.md)。在修复前，不应把涉及更正与撤销的余额视为可信账本。

## 暂未实现／不纳入本轮测试

- AI 图片识别、聊天截图识别和语音转写；
- 前端泡泡助手或任何 LLM 依赖；
- 数据导出和账号删除；
- 第三位测试用户 C 的完整跨圈权限回归；
- 真机微信扫码、系统分享面板和 OTP 后自动恢复深链接的完整端到端验证。

## 本地运行

需要 Node.js 22 或更新版本。

```bash
pnpm install
pnpm dev
```

默认连接生产 loop-backend。连接本地后端时，把 `.dev.vars.example` 复制为被忽略的 `.dev.vars` 并修改 `LOOP_API_BASE`。

### 本地测试环境：允许跳过邮箱登录

仓库也可在本地运行。为降低人工 A/B/C 多用户测试的摩擦，允许在 **local/test** 环境跳过邮箱 OTP，但不得改变生产登录行为。

- 优先采用最小、可逆的本地 test auth、测试用户切换器或本地测试登录 route / session helper；
- 只绕过 Authentication，不绕过 Authorization；
- A/B/C 必须是后端真实的不同身份，继续拥有各自的 membership、圈子权限、余额、可见性、通知和交易权限；
- 不得只替换前端显示身份，而让后端 session 仍属于另一个用户；
- `NODE_ENV=production` 或连接非本地 loop-backend 时，测试入口必须不可用，生产 OTP 保持完整；
- 检查 cookie、并发、旧数据和权限时，应使用不同浏览器 profile 或无痕会话分别登录 A/B/C；
- 如果可行，为不同 Agent / 测试批次增加本地数据 namespace 或 reset，避免互相污染。

当前实现要求 `.dev.vars` 同时满足：`LOOP_API_BASE` 指向 localhost、`LOCAL_TEST_AUTH=true`，并配置由该本地后端真实签发的 A/B/C token。它不会接受任意验证码，也不会为生产环境建立后门。

## 验证

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm test
```

## 项目结构

```text
community-currency/
├─ app/page.tsx                 主应用与业务交互
├─ app/components/              Logo、系统头像与定制头像等视觉组件
├─ app/lib/                     loop 客户端、头像序列化和本地测试认证
├─ app/api/                     同源代理接口
├─ app/join/[token]/            邀请落地页
├─ db/runtime.ts                loop bootstrap → 前端模型适配层
├─ worker/                      Vinext / Cloudflare Worker 入口
├─ docs/                        当前交付、产品原则、测试与历史资料
└─ tests/                       构建与关键能力检查
```

## 文档权威顺序

1. [`docs/开发交付说明.md`](docs/开发交付说明.md)：当前工程事实、能力、验证结果和接手入口；
2. [`docs/后端与前端集成.md`](docs/后端与前端集成.md)：loop-backend 边界、接口约定和已知后端问题；
3. [`docs/产品需求文档：运营流程.md`](docs/产品需求文档：运营流程.md)：已确认的产品与运营要求；
4. [`docs/替代货币的设计理念.md`](docs/替代货币的设计理念.md)：机制与价值边界；
5. `docs/静态演示数据库.md`、`docs/静态演示设计系统.md`、`docs/后端与泡泡助手配置.md`：旧静态原型 / D1 阶段历史资料，不再反映当前架构。

工程事实以当前分支代码、实际 API 和线上行为为准；产品原则仍需独立判断，不能因为某个功能已经存在就自动视为最终产品决定。
