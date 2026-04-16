# Nginx 自托管 + GitHub Actions 自动部署 — 操作手册（请保存到本地）

> 本文与仓库内 `deploy/nginx-goreportify.conf.example`、`.github/workflows/deploy-digitalocean.yml` 配套使用。  
> **本次变更未修改** `server.js` 业务逻辑、**未改** Amber **每日一次** 的抓取策略。

---

## 一、架构说明（完成后长什么样）

| 组件 | 位置 |
|------|------|
| **静态网站** | Nginx `root` → `/root/ai-report-generator`（与 `git clone` 目录一致） |
| **API** | `api.goreportify.com` → Nginx 反代 → `127.0.0.1:3000`（PM2 跑 `server.js`） |
| **代码更新** | 本地 `push` 到 `main` → GitHub Actions SSH 到 **193** → `git pull` + `npm install` + `pm2 restart` |
| **Netlify** | 停用（不再指向 Netlify DNS） |

---

## 二、一次性准备（在服务器 193 上）

### 1. 安装 Nginx 与 Certbot

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. 部署站点配置

```bash
cd /root/ai-report-generator
git pull origin main
sudo cp deploy/nginx-goreportify.conf.example /etc/nginx/sites-available/goreportify.conf
sudo ln -sf /etc/nginx/sites-available/goreportify.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 3. HTTPS（Let’s Encrypt）

```bash
sudo certbot --nginx -d goreportify.com -d www.goreportify.com -d api.goreportify.com
```

按提示选 **Redirect HTTP to HTTPS**。证书会自动续期。

### 4. DNS（Namecheap）

- **`@`（根域）** A 记录 → `68.183.162.193`  
- **`www`** A 记录 → `68.183.162.193`（或 CNAME 到根域，按你习惯）  
- **`api`** A 记录 → `68.183.162.193`  

**停用 Netlify**：删除或修改原先指向 Netlify 的 **A/CNAME**，避免同一域名解析到两处。

### 5. 验证

- 浏览器打开 `https://goreportify.com` → 应出现站点。  
- `https://api.goreportify.com/` → 若后端有根路径响应（如 `Backend Online`），应能访问。  
- App / 前端里 **`REPORTIFY_API_BASE` 或等价配置** 须为 `https://api.goreportify.com`（与现有一致即可）。

---

## 三、GitHub Actions：推送即部署

### 1. 在服务器生成「仅用于部署」的 SSH 密钥（不要用你的个人主密钥）

在 **193** 上：

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy_ed25519 -N "" -C "github-actions-deploy"
cat ~/.ssh/github_deploy_ed25519.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

把 **私钥** 内容拷出（整段含 `BEGIN` / `END`），准备粘贴到 GitHub Secret：

```bash
cat ~/.ssh/github_deploy_ed25519
```

### 2. 在 GitHub 仓库配置 Secrets

打开：**仓库 → Settings → Secrets and variables → Actions → New repository secret**

| Name | 示例值 |
|------|--------|
| `DEPLOY_HOST` | `68.183.162.193` |
| `DEPLOY_USER` | `root` |
| `DEPLOY_SSH_KEY` | 上一步私钥**全文** |

### 3. 触发方式

- 任意 **`push` 到 `main`** 会自动执行部署。  
- 也可在 **Actions** 里手动 **Run workflow**（`workflow_dispatch`）。

### 4. 部署脚本实际执行内容

见 `.github/workflows/deploy-digitalocean.yml`：

```text
cd /root/ai-report-generator
git pull
npm install --omit=dev
pm2 restart all
```

**注意**：若有人在服务器上 **手动改 tracked 文件** 且未提交，`git pull` 可能冲突 —— 日常以 GitHub 为准，避免在服务器直接改业务代码。

---

## 四、与 Amber（每日新闻/博客）的关系

- **仍为每日一次**（未改为每小时）。  
- 若使用 `AMBER_NO_GIT_PUSH=1`，生成内容只写本机目录，**不推 Git**；网站已由 Nginx 读同一目录，**无需 Netlify 构建**。  
- GitHub Actions 只负责 **拉最新代码**；若 Amber 在服务器本机定时跑，与 Actions **互不冲突**。

---

## 五、常见问题排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 网站 502 / 打不开 | Nginx 未 reload、证书未签好 | `sudo nginx -t`；`sudo certbot certificates` |
| API 502 | PM2 未运行或端口不是 3000 | `pm2 list`；`ss -tlnp \| grep 3000` |
| `git pull` 在 Actions 里失败 | 服务器 Git 远程、权限、分支 | SSH 手动登录执行同样命令看报错 |
| SSH 连不上 | 防火墙、22 端口、密钥错 | `ufw status`；核对 `DEPLOY_SSH_KEY` |
| 静态页能开、接口跨域 | 后端 CORS 已 `origin: true` 一般可过 | 看浏览器 Network 与 `server.js` CORS |

---

## 六、回滚思路

- **代码**：在 GitHub 上 **revert 某次提交** 再 push，或 `git reset` 后强推（慎用）。  
- **DNS**：临时把域名指回 Netlify（**仅应急**，双源易乱）。  
- **Nginx**：`sudo systemctl stop nginx` 会整站挂 —— 一般改用回滚配置而非停 Nginx。

---

## 附录 A：用 Gmail 设置多个「测试身份」（封闭式测试用）

不必注册十几个独立邮箱。一个 Gmail 可用 **加号别名**：

- 格式：`你的邮箱用户名` + `+任意标签` + `@gmail.com`  
- 例：`lq92965+ct01@gmail.com`、`lq92965+ct02@gmail.com`  
- **收件**：都会进你**同一个 Gmail 收件箱**。  
- **Play 封闭测试列表**：通常可把上述地址**逐个添加**为测试员（若某条无效再换独立邮箱）。

在 Google Play 里添加测试用户时，填这些地址即可。

---

## 附录 B：封闭式测试详细步骤

完整步骤与材料清单见 **`docs/PLAY_CLOSED_TESTING.md`**。需要时打开该文件按清单操作即可。

---

**保存建议**：把本文件复制到本地 `Reportify-运维手册.md`，并与 `deploy/nginx-goreportify.conf.example` 放在同一备份目录。
