# lia-til 需求文档 v0.2（Confirmed）

> v0.1 (draft, 2026-08-06) → **v0.2 (confirmed, 2026-08-06)**：合并 Lia 对 §5 全部 10 个问题的答复。
> 本版本是 Phase 1 的开发依据。v0.1 保留作历史参考。

---

## 1. 目标（定稿）

- **产品**：全网公开的 "Today I Learn" 网页。Lia 每天通过 Cowork 告知 Claude 学习内容 → Claude 更新并发布 → Mentor 打开固定 URL 即可看到当日学习成果。
- **学习**：走通网页部署 + 前后端交互全流程。
- **时间**：**今天 ~5 小时上线第一版**（Phase 1a），后端部分放到 Phase 1b。

---

## 2. 决策记录（v0.1 §5 的 10 个问题 → 全部关闭）

| # | 问题 | 决策 |
|---|---|---|
| A | Source of truth | **本地电脑（Obsidian 文件夹）为 SSOT**；GitHub 是发布镜像，需与本地保持同步（分钟级即可）。Notion ❌ 不做 |
| B | 实时性 | 不需要高频实时，**~1 分钟同步生效即可** |
| C | 学习资料 | 外部链接 + markdown 笔记；文件资料留本地 |
| D | GRE 进度粒度 | 两个子 track：**(a) 单词进度；(b) 学习 topic checklist**（Quant 按 topic，Verbal 后续按题型如六选二）。当前优先 Quant + Vocab |
| E | 公开范围 | **直接全网公开**。PhD 内容完全不进 TIL。附加要求：**敏感内容 warning check**（见 §5.2） |
| F | Claude 写通道 | **方案 (a)：改内容文件 → git push → 自动部署** |
| G | LeetCode 数据 | Phase 1 **手动口述**，Claude 更新；自动拉取延后 |
| H | 敏感文件机制 | **机制化**：`private/` 目录 + `.gitignore`，永不上传 |
| I | 时间预期 | **今天 ~5h 上线一版** |
| J | 部署平台 | **GitHub Pages**（最小 effort，分析见 §6） |

其他决策：PhD 申请整体延后，**不进 TIL**；数据库只存学习进度（LC 勾选、已学内容），**不存每日 Diary**（Diary 留本地）；Notion 同步不做。

---

## 3. Phase 1 追踪范围（定稿）

### SWE Track
| 子项 | 内容 | Phase 1 形态 |
|---|---|---|
| LeetCode | 刷题进度 | 沿用现有 checklist；数据源改造见 §6.2 |
| System Design | Obsidian 已有 markdown | 知识脉络（topic 清单 + check 状态）；笔记按需选择性发布到 `content/` |
| 项目 | 当前重点：AI + Backend 项目 | 项目列表 + 状态（planned / in-progress / done）+ 一句话进展 |

### GRE Track（整体状态：筹备中）
| 子项 | Phase 1 形态 |
|---|---|
| 单词进度 | x / y 计数（数据手动报，Claude 更新） |
| Topic checklist | Quant 按 topic 勾选；Verbal（六选二等题型）与 AW 等 Vocab 达线后再启用 |

### ❌ 不在范围
PhD 申请（完全不进 TIL）；历史资料回溯 / documentary 类内容；文件上传。

---

## 4. Warehouse 定位（Phase 1）

- 功能 = **知识框架（Framework）**：追踪每日学习内容 + 查看学习清单（List）。
- 内容 = 知识脉络（各 track 的 topic 树 + check 状态）+ **当天的 markdown 笔记**。
- 不做：文档库、历史资料追溯、全文搜索。
- 数据库：只存进度类结构化数据；Diary 存本地，永不进 repo。

---

## 5. 数据流与隐私（定稿）

### 5.1 数据流

```
Lia（口述 via Cowork / Obsidian 笔记）
   │
   ▼
Claude ──① 更新本地 lia-til 文件夹（保持本地 SSOT 同步）
        ──② git push 到 GitHub（镜像）
                │
                ▼（~1 分钟）
        GitHub Pages 自动发布 ──► Mentor / 公众
```

- 内容文件：`content/` 下 markdown + JSON（可发布区）。
- 进度数据：Phase 1a 存 `content/data/progress.json`（随 repo 发布）；Phase 1b 起 LC 勾选恢复走 Neon Postgres（见 §6.2）。
- 本地 ↔ GitHub 同步责任在 Claude：每次更新同时写本地文件夹和推送远端，保证两边一致。

### 5.2 隐私机制（三层）

1. **目录隔离**：`private/` 进 `.gitignore`，永不上传（Diary、简历相关、GRE 资料原文件都放这里或本地任意位置）。
2. **公开前提**：repo 是 **public** 的——凡进入 repo 的内容（含 git 历史）即全网可见。删除 ≠ 消失（历史里还在），所以宁可先放 `private/` 再挑着发布。
3. **敏感内容 warning check**（Lia 指定）：Claude 在把任何内容写入可发布区 / push 之前，扫描疑似敏感信息（真实姓名之外的身份信息、联系方式、地址、账号密钥、简历内容、PhD 申请信息、公司内部信息等）；发现即**提醒并等待确认**。这是 **warning 不是 error**——Lia 确认后仍可发布。

### 5.3 安全检查结果（2026-08-06）

- ✅ `backend/.env`（Neon 连接串）从未进入 git 历史，`.gitignore` 已覆盖 —— 无需换密码。
- ⚠️ 遗留：`POST /progress/toggle` 无鉴权。Phase 1a 不部署后端所以无风险；Phase 1b 部署前必须加 token。

---

## 6. 部署方案：GitHub Pages（§J 的回答）

### 6.1 结论：可行，且是当前最小 effort 的正确选择

- 你的 repo 已经是 **public**，GitHub Pages 免费可用（private repo 才需要付费计划）。
- push 后约 1 分钟自动发布 —— 正好满足你的同步要求（§2-B）。
- 零新账号、零新平台：部署配置就在 GitHub 仓库设置里，push 即发布，顺便学 Pages/Actions。
- 不用 Jekyll 模板也行：仓库根目录放 `.nojekyll`，纯静态 `index.html` 直接原样发布（我们现有 index.html 就是这个形态）。

### 6.2 唯一的限制：Pages 只能托管静态文件，跑不了你的 Express 后端

这影响的是「LC checklist 跨设备勾选同步」（v1 后端存在的原因）。处理方式：

- **Phase 1a（今天）**：LC 进度存 `content/data/progress.json`，页面从 JSON 读取渲染。这与你定的更新流程完全一致——反正更新走「你告诉我 → 我改文件 → push」，进度就是文件的一部分。代价：今天这版页面上的勾选框**只读展示**，不能在手机上直接点。
- **Phase 1b（本周内）**：把现有 Express 后端部署到 Render 免费层（+ API token 鉴权），页面恢复可点击、跨设备同步。前端继续留在 Pages，只是多调一个 API——这正好补上「后端部署」的学习目标。
- 已排除的替代项：Vercel/Netlify（能力更强但今天用不上，多一个平台）；GitHub Pages + 无鉴权后端（危险）。

### 6.3 发布地址

默认 `https://patelinadev.github.io/lia-til/`。自定义域名 Phase 2 再说（可选，非必需）。

---

## 7. Phase 计划（定稿）

### Phase 1a — 今天，预算 ~5h：上线可给 Mentor 的第一版

| # | 任务 | 预估 |
|---|---|---|
| 1 | repo 结构整理：`content/til/`（每日笔记 `YYYY-MM-DD.md`）、`content/data/progress.json`（LC + GRE + 项目状态）、`private/` + `.gitignore`、`.nojekyll` | 0.5h |
| 2 | 改造 `index.html` → TIL 首页：**今日 TIL**（markdown 渲染，marked.js CDN）+ 三块 track 概览（LC 总进度 / GRE vocab & topics / 项目状态）+ 历史日期列表；LC checklist 改为从 progress.json 读取 | 2.5–3h |
| 3 | 开启 GitHub Pages，push，验证公开 URL 可访问 | 0.5h |
| 4 | 完整跑一遍每日流程（§8）作为 demo：口述 → 更新 → push → 刷新可见 | 0.5h |
| 5 | 把 URL 发给 Mentor 🎉 | — |

**依赖（开工前需要）**：Claude 需要 push 权限 —— 一个 GitHub **fine-grained PAT**（仅授权 `lia-til` 仓库、仅 Contents: Read & Write）。或者每次由 Lia 手动 push（不推荐，违背「不想反复操作 GitHub」的初衷）。

**验收**：Mentor 拿到 URL；页面含今日 TIL + 各 track 进度；repo 无任何敏感内容。

### Phase 1b — 本周内：恢复后端（学习目标补全）

- Express 后端部署到 Render 免费层，`toggle` 接口加 API token。
- 页面 LC checklist 恢复可点击 + 跨设备同步（progress.json 退役或降级为备份导出）。
- 本地 Obsidian ↔ GitHub 自动同步调研（如 obsidian-git 插件自动 pull），减少对 Claude 会话的依赖。

### Phase 2 — 之后
LC 自动拉取（非官方 API + cron 容错）；进度图表 / heatmap；Verbal & AW track 启用；全文搜索；自定义域名。

---

## 8. 每日流程（定稿）

1. Lia 在 Cowork 里说今天学了什么（LC 几道、GRE 单词多少、SD topic、项目进展、想放上去的笔记）。
2. Claude 生成/更新 `content/til/YYYY-MM-DD.md` + `progress.json`，同步写本地文件夹。
3. Claude 执行敏感内容 check（§5.2），有疑似项先提醒。
4. Claude commit + push → Pages 约 1 分钟后生效。
5. Mentor 刷新页面即见当日内容。

---

## 9. 开放项（不阻塞今天上线）

- 本地 Obsidian vault 与 `lia-til` repo 的关系（同一文件夹？分开的？）——影响 Phase 1b 的自动同步方案，今天先按「Claude 双写保持一致」处理。
- GRE topic 清单的具体条目（Quant 有哪些 topic）——今天可先放占位，Lia 随时口述补充。
- System Design 知识脉络的 topic 树——同上，可从 Obsidian 已有笔记标题生成初版。
