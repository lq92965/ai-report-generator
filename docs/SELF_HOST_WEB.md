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

## 与 Google Play 上架的关系

自托管网站 **不影响** Play 审核；商店包与 API、隐私政策链接有关，与 Netlify/Nginx 无强制绑定。
