# Amber（news/blog）从 206 迁回 193 — 操作手册

目标：**在 68.183.162.193 上运行 `amber_engine.cjs`**，与现有 **`server.js`（PM2 `server`）** 同机；**206 上停止并清空 Amber / 重复部署**，仅保留你重新定义后的 OpenClaw 职责。

当前线上逻辑（迁前）：**206** 生成并 **`git push`** → GitHub `main` → **193** 上 **`/var/www/html` 每 5 分钟 `git pull`** 更新站点。  
迁回后：**193** 上 **`/root/ai-report-generator`** 跑 Amber 并 **push**（与迁前一致），**`/var/www/html` 的 pull 可保留**，两目录继续跟同一远程同步。

---

## 一、迁之前（必做）

### 1. 在 206 上备份（不会命令行也可以）

**你要备份的是两类东西：**

| 备份什么 | 路径 | 用途 |
|----------|------|------|
| Amber / 站点生成用的密钥 | `/root/ai-report-generator/.env` | 迁到 193 后要合并进同一仓库的 `.env` |
| OpenClaw 机器人等（若还要用） | 整个 **`/opt/openclaw/`** 目录 | 清空 206 前打包带走 |

下面任选一种方式即可。

---

#### 方式 A：最简单 —— 在网页控制台里「复制粘贴」

1. 用浏览器打开 **DigitalOcean → 206 那台机 → Launch Droplet Console**（网页终端）。  
2. 登录后执行：

   ```bash
   cat /root/ai-report-generator/.env
   ```

3. 鼠标**从第一行拖到最后一行**，选中全部输出，**复制**。  
4. 在你本机电脑上新建一个文本文件，例如 **`reportify-env-backup-206.txt`**，**粘贴保存**，放到**不公开**的文件夹（不要发进公开 Git 仓库）。  
5. （可选）若还要保留 OpenClaw 配置，再执行：

   ```bash
   ls -la /opt/openclaw/
   ```

   若目录存在且你要整包备份，可再执行 **`方式 B`** 打成压缩包，或让会 SSH 的同事用 **`方式 C`** 下载。

---

#### 方式 B：在 206 上打包成一个压缩文件，再下载

在 **206 的网页终端**里执行：

```bash
cd /root
tar czvf /tmp/reportify-backup-206.tgz \
  ai-report-generator/.env \
  ai-report-generator/amber_engine.cjs \
  2>/dev/null

# 若存在 OpenClaw，一并打进包（可选）
tar -czvf /tmp/openclaw-backup-206.tgz -C / opt/openclaw 2>/dev/null || echo "无 /opt/openclaw 则忽略"
ls -lh /tmp/*.tgz
```

然后你需要把 **`/tmp/reportify-backup-206.tgz`**（以及 `openclaw` 那个）**下载到本机**。  
DigitalOcean 网页控制台**没有**直接「下载文件」按钮时，用下面 **方式 C**。

---

#### 方式 C：在你本机 Windows 上用 PowerShell 把文件拉下来（需本机已能 SSH）

在你本机打开 **PowerShell**，把下面里的 `你的用户名` 改成你本机路径（例如 `C:\Users\lq929\Documents`）：

```powershell
cd $HOME\Documents
mkdir reportify-backup-206 -ErrorAction SilentlyContinue
scp root@206.189.151.206:/root/ai-report-generator/.env .\reportify-backup-206.env.txt
scp root@206.189.151.206:/tmp/reportify-backup-206.tgz .\reportify-backup-206\ 2>$null
```

若提示找不到 `scp`，可安装 **Git for Windows**（自带 OpenSSH），或用 **WinSCP** 图形界面连接 `206.189.151.206`，用 `root` 登录后，把 **`/root/ai-report-generator/.env`** 拖到本地文件夹。

---

#### 合并到 193 时要用哪些键？

打开你备份的 `.env` 文本，**至少**确认里面有（名称以你实际文件为准，没有就跳过）：

- `GEMINI_API_KEY`（或 `GOOGLE_API_KEY`）、`GEMINI_API_URL`、`GEMINI_MODEL`  
- `DEEPSEEK_API_KEY`、`DEEPSEEK_API_URL`、`DEEPSEEK_MODEL`  

在 **193** 上编辑 **`/root/ai-report-generator/.env`**，把**上面这些行**合并进去（**不要**覆盖 193 里已有的 `MONGO_URI`、`JWT_SECRET` 等 API 专用键；若同一键两边都有，以**不破坏现有登录与支付**为准，拿不准时先**只追加 Amber 缺的键**）。

---

### 2. 在 193 上确认 Git 能 push（与迁前 206 一样，否则 Amber 跑完会报 push 失败）

**若你已经在 DigitalOcean 网页控制台里登录了 193**，不要执行 `ssh root@68.183.162.193`，直接：

```bash
cd /root/ai-report-generator
git remote -v
git status
git pull origin main
```

下面两种做法**二选一**即可。**推荐服务器用「做法 3：SSH + Deploy Key」**（无人值守、不把 token 明文长期放在 `~/.git-credentials`）。**做法 2** 适合想尽快试通、或暂时不想动 SSH 的情况。

---

#### 怎么选？

| | **做法 2：HTTPS + PAT + credential store** | **做法 3：SSH + Deploy Key（推荐）** |
|---|---------------------------------------------|----------------------------------------|
| **优点** | 步骤少，和浏览器里 GitHub 习惯一致 | 适合服务器；密钥只给这个仓库；Amber 定时 push 稳定 |
| **缺点** | PAT 会以明文形式存在 `~/.git-credentials`（root 可读） | 同一仓库在 GitHub **只能绑一个 Deploy Key**；若 206 已占用，要先删掉旧 key 或改用「账户 SSH 多机共用」（见文末说明） |
| **适合** | 快速验证、单人小项目 | **生产机 193 长期跑 Amber** |

---

#### 做法 2：HTTPS + Personal Access Token + 凭据存储

**2a. 在 GitHub 网页上创建 Token**

1. 登录 GitHub → 右上角头像 → **Settings** → **Developer settings** → **Personal access tokens**。  
2. 选 **Fine-grained** 或 **Tokens (classic)** 均可。  
3. 权限至少能访问仓库 **`lq92965/ai-report-generator`**，并允许 **Contents: Read and write**（classic 里勾 `repo` 即可）。  
4. 生成后**复制 token**（只显示一次），先粘贴到本机记事本备用。

**2b. 在 193 上配置并测试**

```bash
cd /root/ai-report-generator

# 让 Git 记住 HTTPS 用户名和密码（密码处填 token）
git config --global credential.helper store

# 确认远程仍是 HTTPS（若不是，见做法 3）
git remote -v
# 应类似：https://github.com/lq92965/ai-report-generator.git

# 触发一次推送（会提示输入）
git push origin main
```

提示 **Username** 时：填你的 **GitHub 用户名**（如 `lq92965`）。  
提示 **Password** 时：粘贴 **token**（不是登录密码）。

成功后应看到 **`Everything up-to-date`** 或推送成功。此后凭据会写入 **`~/.git-credentials`**，**Amber / cron 无人值守 push** 可用。

**安全：** 限制 root 外其他人读该文件；不要将 `.git-credentials` 提交到仓库。

---

#### 做法 3：SSH + Deploy Key（推荐在 193 上使用）

**3a. 在 193 上生成专用密钥（不要设密码，方便无人值守）**

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh

ssh-keygen -t ed25519 -C "reportify-193-deploy" -f ~/.ssh/id_ed25519_reportify -N ""

# 显示公钥，整段复制到剪贴板
cat ~/.ssh/id_ed25519_reportify.pub
```

**3b. 把公钥加到 GitHub 仓库**

1. 浏览器打开：`https://github.com/lq92965/ai-report-generator` → **Settings** → **Deploy keys** → **Add deploy key**。  
2. **Title** 填：`193-reportify`（随意）。  
3. **Key** 粘贴上一步的**整行**公钥。  
4. 勾选 **Allow write access**（必须勾选，否则无法 `git push`）。  
5. 点 **Add key**。

**说明：** 一个仓库**只能有一个** Deploy Key。若以前给 **206** 加过 Deploy Key，GitHub 会拒绝重复；请先在 **Deploy keys** 里**删除旧 key**（或改用下面「账户 SSH」方式），再添加 193 的公钥。

**3c. 指定连接 GitHub 时用这把钥匙**

```bash
cat >> ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_reportify
  IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config
```

**3d. 把仓库远程地址改成 SSH，并测试**

```bash
cd /root/ai-report-generator

git remote set-url origin git@github.com:lq92965/ai-report-generator.git
git remote -v

# 首次会问是否信任 github.com，输入 yes
ssh -T git@github.com

git pull origin main
git push origin main
```

期望：`git push` 不再要用户名密码，且提示 **`Everything up-to-date`** 或成功推送。

---

#### 若 Deploy Key 已被占用：用「账户 SSH 密钥」（多机共用同一 GitHub 账户）

在 GitHub 网页：**Settings → SSH and GPG keys → New SSH key**，粘贴 **`id_ed25519_reportify.pub`**（同一公钥不要同时在 Deploy key 和账户 key 重复加同一仓库会冲突——Deploy key 与仓库绑定；账户 key 是用户级）。  
一般流程：**删掉仓库 Deploy key**，改用**用户账户**上的 SSH key，或**只保留 193 一把 Deploy Key**。

---

### 3. **顺序**

先 **停 206 上的 Amber**，再 **启 193 上的 Amber**，避免两台同时 `push` 抢提交。

---

## 二、在 206 上停止 Amber（先执行）

SSH 到 **206**，按需执行（名称以你 `pm2 list` 为准）：

```bash
ssh root@206.189.151.206

# 停掉与站点生成相关的进程（名称请按实际调整）
pm2 stop AmberBlogger AmberRadar 2>/dev/null || true
pm2 delete AmberBlogger AmberRadar 2>/dev/null || true

# 若 amber_engine 由 PM2 管，也删掉；若是裸进程，用下面 ps 找 PID 后 kill
pm2 delete amber 2>/dev/null || true
pm2 delete amber_engine 2>/dev/null || true

ps aux | grep -E '[a]mber_engine|[a]mber'
# 对仍存在的 node /root/ai-report-generator/amber_engine.cjs 执行: kill <PID>

pm2 save
```

确认 **不再有** `amber_engine.cjs` 在跑：

```bash
ps aux | grep -E '[a]mber_engine'
```

OpenClaw（Discord / Telegram 等）若仍要保留，**不要**删 `/opt/openclaw/`，除非你已决定整台清空；**清空 206 前请自行确认**无业务依赖。

---

## 三、在 193 上启用 Amber

### 1. 代码与依赖

```bash
ssh root@68.183.162.193
cd /root/ai-report-generator
git pull origin main
npm install --omit=dev
```

### 2. 环境变量

将 **206 备份的 `.env` 片段**合并进 **`/root/ai-report-generator/.env`**（与现有 `server.js` 共用同一文件即可，注意勿泄露）。

**不要**设置 `AMBER_NO_GIT_PUSH=1`（保持未设置或显式关闭），以便 **每日批处理后仍 `git push`**，与迁前行为一致，`/var/www/html` 靠 **cron `git pull`** 对齐。

若你希望 **只写盘、不推 Git**（自托管单目录），再改用 `AMBER_NO_GIT_PUSH=1` 并只在一个目录跑 Amber；那是另一种模式，需与 Nginx 根目录一致，本文按 **继续 push** 写。

### 3. 用 PM2 常驻 `amber_engine.cjs`

仓库内提供示例配置 **`deploy/ecosystem.amber.config.cjs`**（请把其中 **`cwd`** 改成你机器上的真实路径，默认 `/root/ai-report-generator`）。

```bash
cd /root/ai-report-generator
pm2 start deploy/ecosystem.amber.config.cjs
pm2 save
```

说明：

- 内置定时仍为 **美国东部 9:00** 每日一篇 news + 一篇 blog（见 `amber_engine.cjs`）。  
- **不要**与旧进程重名；若已有名为 `amber` 的 PM2 应用，先 `pm2 delete amber` 再启。

### 4. 验证

```bash
pm2 list
pm2 logs amber --lines 80
```

可选：手动跑一次每日批（会真实调 API、写文件并尝试 push，慎用）：

```bash
cd /root/ai-report-generator
node -e "require('./amber_engine.cjs').runDailyBatch().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})"
```

（若只想测「不写远程」，可临时 `export AMBER_NO_GIT_PUSH=1` 再测，测完 `unset`。）

---

## 四、与 `server` 进程的关系

- **API**：`pm2 restart server` / `reportify-api` 等 **不要**因 Amber 而改命令；Amber 是 **第二个 PM2 应用**（名如 `amber`）。  
- **端口**：Amber **不监听 HTTP**，只写文件 + `git`，与 `server.js` 无端口冲突。

---

## 五、迁完后你清空 206 时的检查清单

- [ ] `pm2 list` 无 Amber / amber_engine 相关项（若整机清空可忽略）。  
- [ ] `ps` 无 `/root/ai-report-generator/amber_engine.cjs`。  
- [ ] 193 上 **`pm2 logs amber`** 次日美东 9:00 后有生成日志；GitHub 上出现新的 `feat(UX): Auto-gen daily news+blog` 或单篇提交。  
- [ ] 网站 `news`/`blog` 列表仍更新（`/var/www/html` 的 `git pull` 若保留，应能拉到新提交）。

---

## 六、回滚

若 193 异常，可暂时在 **有 `.env` 与仓库** 的机器上恢复跑 `amber_engine.cjs`（不推荐长期双机同时 push）。优先修 193 的 push 权限与 PM2。

---

## 七、和封闭式测试 App 的关系

仅迁移 Amber **不需要**重新打 APK、不需要重新邀请测试员；**除非**你改 API 域名或动了 `server.js` 行为。详见团队内测说明。
