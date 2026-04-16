# 自托管静态站（Nginx on DigitalOcean）与 Amber 引擎

## 你想用 Nginx 摆脱 Netlify — 是否「更好」？

**Nginx** 不是一家公司，是装在你自己 VPS 上的**免费开源软件**。  
**更好**取决于你是否愿意自己维护：证书续期、安全更新、备份。

### 优势

| 优势 | 说明 |
|------|------|
| **无 Netlify 构建分钟 / 套餐限制** | 站点文件就在磁盘上，改完即生效，不触发云端「构建」。 |
| **费用** | 只占用已有 DO 机器；无额外托管费（SSL 可用 Let’s Encrypt 免费证书）。 |
| **与 API 同机** | `api.goreportify.com` 与主站可都在 DO，运维路径统一。 |
| **Amber 不写 Git** | 见下文 `AMBER_NO_GIT_PUSH`，每日生成 news/blog 不再 `git push`，自然也不依赖 Netlify 构建。 |

### 风险与成本

| 风险 | 说明 |
|------|------|
| **安全** | 若把 `root` 指到整个 Git 仓库，必须像 `deploy/nginx-goreportify.conf.example` 一样 **禁止** `.env`、`server.js` 等被 URL 下载。 |
| **运维** | 证书续期、Nginx 配置、磁盘满、被扫漏洞 — 都归你；Netlify 则替你挡一部分。 |
| **DNS** | 需把 `goreportify.com` 从指向 Netlify 改为指向 **DO 的 IP**（与 `api` 可同 IP，不同 `server_name`）。 |

### 「每小时抓取 news/blog」

当前 **`amber_engine.cjs` 设计是「每日一批」**（美东 9:00）：一篇 news + 一篇 blog。  
若改成 **每小时**跑同一批逻辑，会 **约 24 倍** 增加大模型与抓取调用，**成本和被封风险**都会明显上升。建议：

- **继续每日一次**（最省、最稳）；或  
- **例如每 6～12 小时** 若确有运营需求，再酌情调 `cron` 表达式。

技术路径：用 **系统 crontab** 调用 `tools/run-amber-daily-once.cjs`，不要用 Netlify 定时。

### 推荐环境变量（自托管、不推 Git）

在跑 Amber 的机器上（可与 `server.js` 同一台）：

```bash
export AMBER_NO_GIT_PUSH=1
```

- **长期进程**：`pm2 start amber_engine.cjs --name amber`（内置仍为美东 9:00 每日 cron）。  
- **或**：`AMBER_DISABLE_CRON=1` + crontab 只跑 `node tools/run-amber-daily-once.cjs`（完全由系统控制时间）。

---

## 1. 更细对比：Netlify 花钱 vs 自己 Nginx「不花托管费」

| 项目 | Netlify | 自己 Nginx（DO） |
|------|---------|------------------|
| **托管费** | 按套餐/构建分钟等可能产生费用 | **无额外托管费**（只算你已付的 VPS） |
| **部署方式** | 通常 **Git push → 云端构建 → 发布** | **没有** Netlify 那种「自动构建」；等价物是你在服务器上 **更新磁盘上的文件** |
| **适合谁** | 不想管服务器、要 PR 预览 | 要省 SaaS 费、已会 SSH |

结论：**摆脱 Netlify = 不再为「静态托管」向 Netlify 付费**；**不是** magically 少干活，而是 **部署动作从「推 Git 触发 Netlify」变成「服务器上更新文件」**。

---

## 2. 「自己抓取 GitHub 更新」能不能做？怎么做？

Nginx **只负责读磁盘上的 HTML/CSS/JS**，它**不会**自己去拉 Git。要实现「类似 Netlify：代码合并到 main 后网站自动更新」，常见有三种（任选一种即可）：

### 方案 A：服务器定时 `git pull`（最简单）

在 **193** 上 `crontab -e` 增加（示例：每 15 分钟拉一次；可按需改）：

```cron
*/15 * * * * cd /root/ai-report-generator && git pull origin main >> /var/log/reportify-git-pull.log 2>&1
```

- **优点**：实现快，不依赖 GitHub Actions。  
- **注意**：仓库目录要有 **deploy key 或 token** 能 `git pull`；**不要**把私钥提交到公开仓库。

### 方案 B：GitHub Actions SSH 到服务器执行 `git pull`

- 在 GitHub 仓库 **Actions** 里建 workflow：`on: push branches: [main]` → SSH 到 DO → `cd` 到目录 → `git pull`。  
- **优点**：**推送即部署**，和 Netlify 体验接近。  
- **注意**：要配 **SSH 密钥** 存 GitHub Secrets，服务器开对应公钥。

### 方案 C：Webhook + 本机脚本

- 自建或用小服务接收 GitHub webhook，触发服务器上的 `git pull` 脚本。  
- 与 B 类似，略重，小公司一般用 **A 或 B** 即可。

**和你们 Amber 的关系**：若已设 `AMBER_NO_GIT_PUSH=1`，新闻/博客**不再**靠 push 触发 Netlify；站点更新仍可用 **A/B** 拉最新 HTML/`data/posts.json`。

---

## 3. 安全问题怎么控？操作会不会很麻烦？

**麻烦程度**：中等 —— 一次配好 Nginx 拒绝规则 + HTTPS + 防火墙，之后主要是 **更新系统** 与 **证书自动续期**（certbot 一般已配 cron）。

**必做清单**：

1. **HTTPS**：Let’s Encrypt（certbot），勿长期 HTTP 明文传登录态。  
2. **禁止下载敏感文件**：见 `deploy/nginx-goreportify.conf.example`（`server.js`、`.env`、`package.json` 等）。  
3. **`.env` 权限**：`chmod 600 .env`，仅 root 或跑 Node 的用户可读。  
4. **防火墙**：只开放 **22（SSH，建议改端口或限 IP）**、**80/443**；**不要把 MongoDB、Redis 端口暴露公网**。  
5. **SSH**：密钥登录优于纯密码；可装 `fail2ban`。  
6. **Node / PM2**：API 监听 **127.0.0.1:3000**，由 Nginx **反代** `api.goreportify.com` → `https://127.0.0.1:3000`（或仅内网），避免外网直连 Node 端口（若目前用防火墙只放行 Nginx 也可）。

**常见误区**：把 Nginx `root` 指到整个 Git 仓库、却**没**配 `deny`，则攻击者可能直接请求下载 `.env` —— **必须按示例配 location**。

---

## 4. 前后端放在同一台服务器会怎样？

**你们现状**：API（Node）已在 **193**；若再把**静态站**用 Nginx 也放在 **193**，就是「同机前后端」。

| 方面 | 说明 |
|------|------|
| **优点** | 一张账单、延迟低、运维集中、证书可一张覆盖多域名（配好 `server_name`）。 |
| **缺点（风险面）** | 若机器被入侵，**站 + API 同时受影响**（**爆炸半径**更大）；资源争抢（磁盘/CPU 满时站与 API 一起抖）。 |
| **缓解** | 最小权限、防火墙、分离系统用户、重要密钥不进仓库、定期备份 MongoDB Atlas。 |
| **何时要拆机** | 流量很大或合规要求隔离时，再考虑静态与 API 分两台；**小产品阶段同机完全常见**。 |

---

## 与 Google Play 上架的关系

自托管网站 **不影响** Play 审核；商店包与 API、隐私政策链接有关，与 Netlify/Nginx 无强制绑定。
