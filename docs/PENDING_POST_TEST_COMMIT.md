# 封闭测试结束后 — 提交前核对清单（勿丢）

> 用途：记录「工作区已改哪些、为何改、上线前要做什么」。  
> 另见：`**docs/RELEASE_CHECKLIST.md**`（Play 控制台、API 域名、发版步骤）。

---

## 一、当前仓库内已改动的文件（代码）


| 文件                                                        | 摘要                                                                                                                                                                                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `google-play-billing.js`                                  | `**lineItems` 取最晚 `expiryTime**`；验单结果：**只要未来 `expiryTime` 即视为有效**（`REVOKED` 除外），避免「刚买显示过期 / 再买一笔才恢复」。                                                                                                                                    |
| `server.js`                                               | `**/api/generate`**：**统一时间规则**（与语言/模板无关）：默认 **UTC 当前时刻** 为 as-of；用户若指定历史/具体时点则按用户；禁止把旧训练截止年当「今天」；无法核实实时数据时一句说明 + 标明示例数据。                                                                                                                 |
| `script.js`                                               | ① `**reportifyPostsJsonUrl`**：原生 / `getPlatform` android·ios + **localhost+Capacitor** 时从主站拉 `posts.json`。② **头像**：`referrerpolicy`、`preconnect`、`applyAvatarElementHints`、**失败重试**、**验单后 `fetchUserProfile`**、**App `resume` 刷新会员与头像**。 |
| `index.html` / `news.html` / `blog.html` / `article.html` | 列表用 `reportifyPostsJsonUrl()` + 缓存戳。                                                                                                                                                                                                     |
| `amber_engine.cjs`                                        | `AMBER_ARTICLE_DATE`、cron 日志。                                                                                                                                                                                                            |
| `tools/amber-catchup-days.cjs`                            | 补跑 N 天 news+blog。                                                                                                                                                                                                                        |
| `package.json`                                            | `amber:catchup`。                                                                                                                                                                                                                         |
| `docs/RELEASE_CHECKLIST.md`                               | **新增**：Play vitals/ANR、API 域名、build:www、Amber 等发版前检查。                                                                                                                                                                                    |


---

## 二、新闻「每天推进」— 运维（代码不能替代）

- 193 上 `**pm2 list`** 是否有 `**amber` online**，或 `**crontab`** 是否调 `run-amber-daily-once.cjs`。  
- 补跑：`npm run amber:once` / `npm run amber:catchup -- N`。

---

## 三、提交 / 发布顺序（建议）

1. `git status` 核对。
2. 服务器：`git pull` → `**pm2 restart`**（API 进程名以你机子为准）。
3. Android：`**npm run build:www && npx cap sync android**` → 打 **AAB**。
4. 按 `**docs/RELEASE_CHECKLIST.md`** 过一遍 Play Console / API。

---

## 四、不在本仓库

- **Nginx** 仅服务器 `/etc/nginx/` 的修改请自行备份。

