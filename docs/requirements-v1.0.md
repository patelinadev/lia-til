# lia-til 需求文档 v1.0（Fresh Restart）

> **2026-08-15 · 推倒重来版。** 作废 v0.1 / v0.2（GitHub Pages + Express/Neon 那套思路）。
> 本版是全新起点，只定义"第一个能跑的版本"，其余一律延后。

---

## 1. 一句话目标

> 一个**公开网址**。任何人打开都能看到 Lia 当前的学习进度。
> Lia 更新的唯一方式：告诉 Claude → Claude 改内容文件 → git push → 网站自动重新部署 → 刷新即见。

---

## 2. Phase 1 · Stage 1 — 第一个能跑的版本（唯一当前目标）

**做什么**

- 一个 Next.js 页面，展示 Lia 的学习进度（LeetCode 进度 / 学习 topic / 一句话项目状态——先放什么由 Lia 口述）。
- 部署在 Vercel，拿到一个固定公开 URL。
- 内容来自 repo 里的文件（Markdown + JSON），**没有后端、没有数据库**。

**权限模型（第一步的核心，就这么简单）**

- **读**：网页 public，谁打开都能看，无需登录、无需任何 access。
- **写**：只有 Lia 能改——因为"改"= 改 repo 里的文件并 `git push`，而只有 Lia（通过 Claude）有 push 权限。写权限 = git 权限，不需要在应用里做任何登录/鉴权。

**不做（Stage 1 明确排除）**

- ❌ 登录 / 鉴权 / 用户系统
- ❌ 后端 API、数据库
- ❌ 访客在页面上点勾并持久化（那是运行时写入，属 Phase 2）
- ❌ 自动拉 LeetCode 数据、图表 heatmap、全文搜索、自定义域名

**验收标准**

1. 把 URL 发给任何人（如 Mentor），对方无需任何权限即可打开看到进度。
2. Lia 让 Claude 改一处内容并 push，约 1 分钟后对方刷新能看到变化。
3. repo 里无任何敏感内容（见 §6）。

---

## 3. 技术栈（简历高频 ∩ 项目实际需要）

选型原则：**不一次全用上**。从 Lia 简历里真正高频的技术中，挑当前 Stage 真正需要的；其余按 Phase 逐块挂进来，每块都对应一个真实需求（面试才讲得通"为什么用它"）。

### Stage 1 用到的

| 层 | 选型 | 理由 |
|---|---|---|
| 前端框架 | **Next.js + React + TypeScript** | 简历第一行的主力组合，真实做过；对 Stage 1 也不比裸 HTML 难多少 |
| 样式 | **Tailwind CSS**（可选，Next 标配） | 简历有 HTML/CSS；Tailwind 是 Next 生态标配 |
| 内容/数据源 | repo 里的 **Markdown + JSON 文件** | Stage 1 的"写"是 Claude 改文件 + push，不是运行时 API，所以此刻不需要 DB |
| 部署 | **Vercel** | Next.js 零配置官配；push 自动部署；默认公开，天然满足权限模型 |
| 版本控制 | **Git + GitHub**（现有 `lia-til` 仓库，public） | 这就是"只有我能改"的机制本身 |

### 后续 Phase 才挂进来（现在明确不用）

| 技术（均来自简历） | 挂进来的 Phase | 触发它的真实需求 |
|---|---|---|
| **FastAPI + PostgreSQL** | Phase 2 | 访客要在页面上直接点勾、跨设备持久化 → 需要运行时后端 + 库。届时把现有 Express+Neon 后端改造/替换为 FastAPI 版（对上简历的 Python 后端）。 |
| **Docker + GitHub Actions CI/CD** | Phase 3 | 后端要标准化打包 + 自动化测试/部署 → 补 DevOps 简历线 |
| **AWS**（如 ECS/S3） | Phase 3+ | 把后端放到"真·云"上，补云部署简历线 |
| Redis / Kafka 等 | 暂无计划 | 本项目暂无真实高并发/事件流需求，不硬凑 |

> 现有的 `backend/`（Express + Neon Postgres）**先封存**，不删除，留待 Phase 2 参考/改造。

---

## 4. Phase 路线图（每 Phase 对应一块简历技术）

- **Phase 1 · Stage 1（当前）**：Next.js/TS 前端 + Vercel 部署，静态展示进度。→ 前端 + 部署简历线。
- **Phase 2**：加 FastAPI + PostgreSQL 后端，页面进度可交互写入、持久化。→ Python 后端 + DB 简历线。
- **Phase 3**：Docker 化 + GitHub Actions CI/CD + 上云（AWS）。→ DevOps 简历线。
- **Phase 4+（可选）**：LeetCode 自动拉取、图表/heatmap、自定义域名、GRE Verbal track 等。

---

## 5. 每日更新流程（Stage 1 版）

1. Lia 告诉 Claude 今天学了什么（LeetCode 几道 / topic / 项目进展 / 想放的笔记）。
2. Claude 更新 repo 内容文件（`content/…` 下的 Markdown / JSON）。
3. Claude 做敏感内容 check（§6），有疑似项先提醒等确认。
4. Claude commit + push → Vercel 约 1 分钟后自动上线。
5. 任何人刷新页面即见当日内容。

---

## 6. 隐私 / 安全（贯穿始终）

- repo 是 **public**：凡进入 repo 的内容（含 git 历史）即全网可见，删除 ≠ 消失。
- **敏感内容一律不进 repo**：Diary、简历原文、PhD 申请、联系方式/地址、账号密钥、公司内部信息等 → 放本地或 `private/`（进 `.gitignore`），永不上传。
- **Warning check**：Claude 在把任何内容写入可发布区 / push 前，扫描疑似敏感信息，发现即提醒并等 Lia 确认（warning 不是 error，确认后仍可发布）。
- 密钥（如未来后端 `.env`）永不进 git。

---

## 7. 待确认 / 开放项（不阻塞 Stage 1 开工）

- 仓库策略：复用现有 `lia-til` repo（已 public、已连 GitHub），在其中放全新 Next.js 结构；现有 `index.html` 和 `backend/` 保留不删。（默认按此执行，除非 Lia 另有意见。）
- Stage 1 首页具体展示哪些块、每块放什么初始内容——Lia 口述，Claude 填。
- Claude 的 push 权限方式：现有 git 凭据是否够用，还是需要一个仅限 `lia-til` 的 fine-grained PAT。
