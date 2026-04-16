# Reportify — 标准发布与测试说明

## 服务器与域名（避免混淆）

| 资源 | 用途 |
|------|------|
| **68.183.162.193** | 产品 API / 后端（`server.js`、PM2）。**`api.goreportify.com` 应解析到此 IP。** |
| **206.189.151.206** | OpenClaw / 运营维护，**不是**产品 API；不要在这里部署 `server.js`。 |
| **Namecheap** | 域名注册与 DNS（A/CNAME 记录）。 |
| **MongoDB Atlas** | 用户与业务数据。 |

---

## 一、后端 API（DigitalOcean `68.183.162.193`）

**代码目录（示例）：** `/root/ai-report-generator/`

### 1. 推荐流程（以 GitHub 为准）

```bash
ssh root@68.183.162.193
cd /root/ai-report-generator
git pull origin main
npm install --omit=dev
pm2 restart all
pm2 logs --lines 50
```

（分支若不是 `main`，改成你的分支名。）

若 `npm install` 报 `patch-package: not found`，请 `git pull` 到包含将 `patch-package` 列入 `dependencies` 的版本后再装。

`npm WARN EBADENGINE`（例如 `@capacitor/cli` 要求 Node ≥22）在仅运行 `server.js` 时一般为**警告**，不阻止安装；若要消除可日后将服务器 Node 升到 22+。

### 2. PM2 启动命令必须是全功能后端

进程应执行 **`node server.js`**（不是 `index.js`）。若 PM2 里仍是 `node index.js`，请改成：

```bash
pm2 delete all   # 或只删旧进程名
cd /root/ai-report-generator
pm2 start server.js --name reportify-api
pm2 save
```

### 3. 环境变量（`.env` 或与 PM2 注入）

至少确认：`MONGO_URI`、`JWT_SECRET`、`GEMINI_API_KEY`（或 `GOOGLE_API_KEY`）、`DEEPSEEK_API_KEY`（Basic 用）、`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`（Google Play 验单）。

可选：`GEMINI_MODEL`、`GEMINI_FALLBACK_MODEL`（例如预览模型不可用时兜底）。

修改环境变量后需 **`pm2 restart all`**。

---

## 二、前端网站

存在两条可能路径，请团队约定**以哪一条为线上真源**：

| 路径 | 说明 |
|------|------|
| **Netlify** | GitHub 连接后自动构建/发布静态站。 |
| **服务器 `/var/www/html/`** | Nginx 直接提供静态文件；用 `nano` 改 `script.js` 等后**无需** PM2，但需避免与 Netlify 内容长期不一致。 |

**Netlify 欠费 / 站点打不开：** 只影响**通过 Netlify 访问的网站**；**不影响** `api.goreportify.com` 上的 Node，也不影响 **App**（App 若请求 `https://api.goreportify.com`）。

---

## 三、Android App（Capacitor 套壳）

- **仅更新 `server.js`（API）时：** 一般 **不需要** 重新打 APK、**不需要** 在 Google Play 发新版本即可测试报告生成。
- **需要重新打包并上传 Play 的情况：** 改了原生插件、Android 工程、`www` 打进包里的资源且未从远程加载等。
- 测试步骤：在 **68.183.162.193** 上部署最新 `server.js` 并 `pm2 restart` → 手机打开 **已安装的测试 App** → 登录 → **Generate** 再试一次。

---

## 四、内测「通过」的判断（建议）

1. **API 健康：** `GET https://api.goreportify.com/`（或你们健康检查路径）正常。  
2. **生成报告：** App 内登录后能成功生成，无「AI Service Currently Unavailable」类错误。  
3. **Google Play（业务侧）：** 登录状态下完成购买/验单后，服务端写入用户与 `payments`（若仍为空，查日志与 `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`）。  
4. **沙盒邮件频繁续订/取消：** 属 Google 测试环境正常表现，**不作为**产品 bug 判据。

---

## 五、快速检查清单（每次发版后）

- [ ] 只在 **193** 上更新了 `/root/ai-report-generator` 并 `pm2 restart`  
- [ ] PM2 进程为 **`node server.js`**  
- [ ] `pm2 logs` 无 Mongo / Gemini / 验单持续报错  
- [ ] App 指向 **`https://api.goreportify.com`**（未误指向 206）
