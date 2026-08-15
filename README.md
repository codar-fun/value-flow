# 社区货币 /「流动圈」

> 当前状态：前端接在 **loop-backend** 上运行，登录、圈子、互助记账、需要/提供、好人卡与邀请都已打通。
> 当前用途：产品验证与小范围测试，不是可直接面向真实社区开放的正式生产系统。
> “流动圈”仍是暂名。

线上地址：<https://flow.sola.day>

## 架构：与 loop 共享一个后端

这个前端不再有自己的数据库。**loop-backend**（Phoenix + Postgres，`https://loop-api.sola.day/api`）是唯一的数据源与身份来源，
Cloudflare D1 与 drizzle 已经全部移除。

- 页面只请求同源的 `/api/*`；这些 route handler 在服务端代理 loop-backend，因此没有 CORS，
  access / refresh token 也只存在 httpOnly cookie 里（`loop_rt` / `loop_at` / `loop_at_exp`），不进 localStorage。
- 登录用 loop 的**邮箱 OTP**：`/api/auth/request` → `/api/auth/verify` →（首次）`/api/auth/profile`。
  没有匿名回退，没有共享的示例账号。
- 页面启动时拉一次 `GET /api/bootstrap`（loop 的聚合端点），`db/runtime.ts` 把它转成界面用的 `AppDatabase`。
- 界面上的每个字段都对应一个 loop 字段。唯一派生的是头像脸型与配色，按 id 稳定哈希得出。

端点对照表见 `../loop-backend/docs/community-currency-api-map.md`。

## 现在能做什么

- 邮箱验证码登录 / 注册 / 退出；
- 从 loop-backend 加载成员、圈子、账户、动态与个人设置；
- 编辑自己的资料：显示名称、一句话介绍、联系方式（只对同圈成员显示）；
- 记录已经完成的互助（提供者 `+`、接收者 `−`），可选圈内公开 / 神秘记录 / 仅当事人；
- 待确认的记录由另一方确认入账（圈子开启「需要确认」时）；
- 拒绝或撤销一笔记录，额度立刻恢复；提议更正后由**另一方**接受才生效（圈子开启「允许拒绝 / 更正」时）；
- 发布“我想要 / 我可以给”，可多圈可见、可跨圈公开，并暂停或重新发布；
- 发送好人卡（不产生余额，默认跨圈公开）；
- 创建圈子，设定额度名称、加入方式、三个记账开关、协商参考物与圈子约定；
- 圈主随时在「圈子设置」里修改上述规则；
- 发现并加入公开的圈子；加入方式为「需审批」的圈子会先挂起，圈主在成员页放行；
- 生成 7 天有效、单次使用的邀请链接，邀请落地页登录后自动加入；
- 申请入圈后能看到「等圈主放行」，并随时撤回申请；
- 退出圈子（还欠着额度、或身为圈主还有其他成员时会说明原因并拦下），圈主可把圈子转让给其他成员；
- 查看通知：入圈申请、待确认的记录、好人卡；
- 保存跨圈公开设置；
- 调用系统分享。

## 暂时不做的

- **泡泡助手（AI）**。loop-backend 侧留了 `POST /circles/:id/assistant/draft`，但前端不调用它，
  也没有任何 LLM 依赖：四种记录都用普通表单填写，填完先看草稿再确认发布。
- 语音转写、聊天截图识别。
- 跨圈额度兑换、贡献排名、信用分——这些是产品上明确不做的。

## 下一步

1. **多人真实测试**：A 创建圈子并邀请 B → B 发布需要 → 线下完成互助 → 任一方记录 → 另一方确认或纠正 → 双方核对余额与可见范围。
2. **补齐还只有接口的流程**：数据导出 / 账号删除、真实分享图或小程序码。
3. 小范围验证后再决定是否微信化。

## 文档权威顺序

1. [`docs/开发交付说明.md`](docs/开发交付说明.md)：当前运行事实、已实现能力、风险与接手入口；
2. [`docs/产品需求文档：运营流程.md`](docs/产品需求文档：运营流程.md)：已经确认的产品与运营要求；
3. [`docs/替代货币的设计理念.md`](docs/替代货币的设计理念.md)：机制与价值边界；
4. [`docs/references/补充调研：制度缺口、试验边界与下一轮搜索.md`](docs/references/补充调研：制度缺口、试验边界与下一轮搜索.md)：隐私、安全、治理、退出和合规边界；
5. `docs/静态演示数据库.md`、`docs/静态演示设计系统.md`、`docs/后端与泡泡助手配置.md`：静态原型与 D1 阶段的历史资料，**已不反映当前架构**。

若文档与代码冲突，以当前代码和 loop-backend 的实际接口为工程事实；若代码与产品原则冲突，应先讨论，不要把现状自动视为产品决定。

## 本地运行

需要 Node.js 22 或更新版本。

```bash
pnpm install
pnpm dev
```

默认连生产 loop-backend。要连本地后端，设置 `LOOP_API_BASE`：

```bash
LOOP_API_BASE=http://localhost:4000/api pnpm dev
```

检查：

```bash
pnpm lint
pnpm build
```

## 项目结构

```text
community-currency/
├─ app/page.tsx                 全部界面与交互（单文件）
├─ app/types.ts                 领域类型（每个字段都对应一个 loop 字段）
├─ app/lib/loop.ts              loop-backend 服务端客户端 + cookie 会话
├─ app/api/                     同源接口：全部代理 loop-backend
├─ app/join/[token]/            邀请落地页
├─ db/runtime.ts                loop bootstrap → AppDatabase 适配层
├─ worker/                      Cloudflare Worker 入口
├─ docs/                        产品、技术与历史原型文档
└─ tests/                       构建与关键能力检查
```
