# 发版前检查清单（Android / API / 运维）

上线或发 AAB 前建议逐项核对；第 4 天封闭测试若未做，可在此补做。

## Google Play Console

1. **版本与渠道**：确认上传的 **AAB** 对应本次 `**versionCode` / `versionName`**，封闭测试 / 内测轨道成员与**许可测试**账号一致。
2. **崩溃与 ANR**：**Play Console → 质量 → Android vitals（或发布前报告）**，查看与本版本相关的 **崩溃率、ANR**；若有堆栈，对照 `symbol`/`mapping`（若已上传）。
3. **订阅与订单**：在 **订单管理 / 订阅** 中抽查测试账号的 **purchaseToken、状态、到期时间**，与后台 Mongo 用户 `**planExpiresAt`** 对照（尤其 Google Play 加速测试周期时）。

## API 与域名

1. **客户端 `API_BASE_URL`**（`script.js` 等）是否指向 `**https://api.goreportify.com**`，而非旧 IP 或已废弃环境。
2. **服务器** `.env` 中 `**FRONTEND_URL`**、OAuth 回调、`**OAUTH_BRIDGE_BASE**` 等与当前主站 / API 域名一致。
3. **Nginx**：`api.goreportify.com` **443** 正常；主站 `**data/posts.json`** 可被公网访问（App 内会拉主站 JSON）。

## 应用包与静态资源

1. 修改过 `**www/` 或 `script.js**` 后执行：
  `npm run build:www && npx cap sync android`  
   再打 **AAB**，否则 App 仍可能使用**旧打包的 `data/posts.json`**。
2. **Amber**：若依赖每日新闻，确认 **PM2 `amber` 或 crontab** 在跑（见 `docs/SELF_HOST_WEB.md`、`tools/run-amber-daily-once.cjs`）。

## 本次版本已覆盖的产品问题（代码侧）

- **头像**：`referrerpolicy`、预连接、失败重试；登录/回到前台刷新资料。
- **新闻日期**：原生/WebView 下从主站拉 `**posts.json`**（含 `localhost` + Capacitor）。
- **Google Play 会员**：验单后以 **lineItems 最晚到期** 为准；**未来到期即视为有效**（除 **REVOKED**）。
- **报告日期**：生成接口注入 **当前报告日期（沪深/A 股用 Asia/Shanghai）**，禁止模型默认写成 2023 年等陈旧日期。

---

*随项目迭代可增删条目；与 `docs/PENDING_POST_TEST_COMMIT.md` 配合使用。*