# lia-til 需求文档 v2.0 — Phase 2（Backend）

> **2026-08-19。** Phase 1（前端 + 部署，`v0.2.x`）已完成。本版定义 **Phase 2**：把散落各处的
> 数据集中到一个云端后端，成为**唯一数据源**；网站每天从它自动更新；私有内容登录后可见。

---

## 1. 一句话目标

一个云端 **FastAPI + PostgreSQL** 后端做**唯一数据源**（投递 / LeetCode / 学习日志）。
我只在一处录入（经 Claude API，或经后台管理界面手动改），网站每天由**云端定时任务**自动同步；
公开访客看策展/聚合版，**我登录后看全量**。

---

## 2. 需求整理

### 2.1 数据源迁移（全部进后端）

| 数据 | 现状 | 迁移目标 |
|---|---|---|
| **投递 Applications** | 本地 ledger markdown | `applications` 表（+ `application_events` 状态变更）；写一次性 importer 导入，之后只从后端改 |
| **LeetCode** | 0x3f 进度（现 `leetcode.json`） | `leetcode_problems` 表（沿用 id/topics/status/date/solution） |
| **学习日志 Daily Log** | Obsidian 每日文件 | `daily_logs` 表（date/week/weekday + markdown body）。可弃用 Obsidian |

### 2.2 访问与权限

- **公开访客（无登录）**：策展/聚合版 —— 投递只给聚合计数、日志只给公开时间线。（维持现状 + §6 红线）
- **我（登录）**：全量 —— 完整投递（公司/薪资/签证/notes）+ 完整日志（含 Success Diary 等私有段）。
- 认证：**GitHub OAuth（Auth.js）**，只放行 `patelinadev` 一个账号。
- 🔒 **红线**：私有数据必须**服务端鉴权后才返回**，绝不只在前端隐藏。

### 2.3 编辑模型（两条路，写同一数据源）

- **主路 — Claude 经 API 录入/修改**：我跟你对话，背后调后端写端点（API token 保护）。体验同现在。
- **备路（buffer）— 后台管理界面**：我自己手动改，不 100% 依赖 Claude/云。
  - **学习日志：Markdown 编辑器 + 实时预览**（上编辑、下渲染）。
  - **投递**：表格/表单式改状态、补 notes。
- 两条路调的是同一套写端点、同一个 DB —— 真正的单一数据源。

### 2.4 自动化

- **云端定时任务**（cron / Claude scheduled agent）每天经 Connector 打后端 API，触发网站更新。
  因数据在云端，**任何地方都能跑，不碰本地文件** —— 这是本 Phase 的核心动机。

### 2.5 约束 / 红线

- 公开侧只出**匿名聚合**；全量仅登录可见（服务端鉴权）。
- 认证**代码我可以写**；**创建 OAuth app / 填密钥 / 输账号密码**这些**你自己做**（我不碰凭据）。
- 现 `daily-planner` / `learning-log` skill 绑在 Obsidian 上 → 迁后端后这些 skill 要改成读写后端
  （真实的工作流改动，不是搬数据那么简单，单独规划）。
- 网站从**纯静态 → 部分动态**（私有页按请求渲染 + 鉴权；公开页仍可静态/ISR）。

---

## 3. 架构

```
录入： 你 → Claude → 后端 API      |      你 → 后台管理界面(Markdown 编辑器) → 后端 API
                              ↓
        [ FastAPI @ Render (免费) + PostgreSQL @ Neon (免费) ]   ← 唯一数据源
                ├─ 公开端点（聚合 / 策展，无鉴权）
                └─ 私有端点（全量，GitHub OAuth 鉴权）
                              ↓
     公开站（静态/ISR，读公开端点）    +    私有页（动态，登录后读私有端点）
                              ↑
          云端定时任务每天抓 API → 触发更新（任何地方可跑，不碰本地文件）
```

---

## 4. 开发计划（walking skeleton，逐 Stage）

**排序原则：先有数据源 + 读路径（S1）→ 全内容即时同步（S2）→ 鉴权（S3）→ 手动编辑（S4）→ 退休本地源头（S5）。先拿 80% 的价值，最硬的留最后。**

| Stage | 做什么 | 点亮 |
|---|---|---|
| **P2·S1 — 后端骨架 + 投递** ✅ | Render 起 FastAPI + Neon 建 Postgres；`applications` 表 + importer；公开聚合端点；网站 Applications 读它（dynamic） | Python 后端 + DB 简历线（已完成 `v0.3.0`） |
| **P2·S2 — 全内容即时同步** | LeetCode + Daily Log + System Design 各建一张表 + importer 灌现有内容 + **公开端点** + 页面改 dynamic；机制照搬 applications。更新 = 我跑 importer/写后端 → 即时可见，不 push/rebuild | 网站永远是最新的 |
| **P2·S3 — 登录 + 私有查看** | GitHub OAuth（只放行 patelinadev）；私有端点 + 私有页（全量投递 + 全量日志）；服务端鉴权 | 私有需求 + auth 基座 |
| **P2·S4 — 后台 buffer** | 私有 `/admin`：学习日志 **Markdown 实时预览编辑器** + 各表编辑表单；你能自己手动改 | 不 100% 依赖 Claude |
| **P2·S5 — 本地源头退休** | 加写 API；改造 daily-planner / learning-log / 简历 ledger 工作流直接读写后端；Obsidian + `jd-based-resume` 文件退休 | 彻底单一源头、无本地文件、可云端定时同步 |

（S2 三个内容里 **System Design 最复杂**：deck→slide 嵌套 + 图；文字进库、diagram key 进库、图的组件留代码。先做 daily log，再 LeetCode，再 SD。）

---

## 5. 关键决策

**✅ 已定（2026-08-19）：**
- **网站读后端 = 运行时抓取（dynamic / SSR）** —— 数据页每次打开从后端现取最新，「打开即最新、写完刷新即见」，**不再靠 push/重建**。
- **后台管理 = Next.js 私有路由页** —— 同一个 app，登录后才可见的 `/admin` 页（不做独立 admin 应用）。
- **「简历」= 投递里的 `Resume` 字段** —— 随 applications 在 **S1 一起迁**，不单独排。
- **即时同步优先，login 往后放**（2026-08-19 改）：S2 先把 LeetCode + Daily Log + System Design 全做成即时同步（照搬 applications），login 挪到 S3。
- **S2 只开公开端点**：没有 login 之前，公开端点只给**策展/聚合版**（daily log 只给勾选项 + 一句话总结，不含 Success Diary / PhD 等私有段）；全量私有内容等 S3 login 后再放。
- **"不动 Obsidian 工作流" 的代价 = Claude 每天多做一步**（curate → 写后端）；Lia 照常写 Obsidian，不写两遍。真正的"只写一处、Obsidian 退休" = S5。

- **Host = Render（免费 web service）+ DB = Neon（免费 serverless Postgres）** —— 不用 Railway（已砍免费额度，付费对简历无增益）。平台名字不上简历，值钱的是 FastAPI + Postgres + API + auth 这些技能，且应用可移植（Phase 3 再搬 AWS）。

**⏳ 待定（后面单独聊）：**
- `daily-planner` / `learning-log` skill 迁后端的具体改法。
- Markdown 编辑器选型（如 CodeMirror / textarea + markdown 渲染）。
