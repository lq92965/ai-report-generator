# Reportify AI - SEO Implementation

## 概述
SEO 优化直接实现在 `amber_engine.cjs` 中，每次生成新文章（blog/news）时自动注入。
无需额外配置或部署步骤。

---

## 1. 自动注入的 SEO 标签

### Open Graph Tags (Facebook / LinkedIn)
在 `buildStaticPage()` 中自动注入：
- `og:title` — 文章标题 + " - Reportify AI"
- `og:description` — 文章摘要 (excerpt)
- `og:url` — 文章独立 URL
- `og:type` — `article`
- `og:image` — 默认 og 图片

### Twitter Cards
- `twitter:card` — `summary_large_image`
- `twitter:title`
- `twitter:description`

### Canonical URL
- `<link rel="canonical">` 指向文章独立页面

### JSON-LD 结构化数据
- `BlogPosting` (blog 文章) 或 `NewsArticle` (news 文章)
- 包含: headline, description, datePublished, dateModified, author, publisher logo, image

位置: `amber_engine.cjs` → `buildStaticPage()` 函数 (约第 429-528 行)

---

## 2. Sitemap

在 `publishAndSEO()` 中自动生成 `sitemap.xml`，包含：
- `https://www.goreportify.com/` (priority 1.0)
- `https://www.goreportify.com/blog.html` (0.9)
- `https://www.goreportify.com/news.html` (0.9)
- `https://www.goreportify.com/generate.html` (0.8)
- `https://www.goreportify.com/contact.html` (0.5)
- `https://www.goreportify.com/privacy.html` (0.3)
- `https://www.goreportify.com/terms.html` (0.3)
- 每篇文章独立页面 (0.7)

位置: `amber_engine.cjs` → `publishAndSEO()` 函数 (约第 539 行)

---

## 3. 图片优化

### 文章配图
- 使用 Pollinations.ai 远程生成 (`image.pollinations.ai`)
- 参数可配置: `imgW`, `imgH`, `seed`

### 静态资源缓存 (Nginx)
已在 `goreportify.conf` 中配置:
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
    expires 7d;
    add_header Cache-Control "public, no-transform";
}
```

### Gzip 压缩
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
gzip_min_length 256;
gzip_comp_level 5;
gzip_vary on;
```

---

## 4. 文章标题格式

Amber engine 在生成文章时使用以下 prompt 规则:
- Blog: `You are a senior product manager who writes SEO-optimized blog posts` + `ANTI_AI_VOICE`
- News: `Write about the latest trends in reporting, productivity, AI tools, or professional communication`

生成的标题会自动格式化:
- 首字母大写
- 长度控制在 40-60 字符
- 避免 clickbait

---

## 5. SEO 路线图

### Phase 1 ✅ 已完成 — Technical SEO
- [x] OG Tags 自动注入 (buildStaticPage)
- [x] Twitter Cards
- [x] Canonical URL
- [x] JSON-LD Article/BlogPosting
- [x] Sitemap 含核心产品页面
- [x] Amber engine 每篇文章自动生成独立静态页面
- [x] article.html 模板修复 (重复标签)

### Phase 2 ⏳ 待做 — Search Console 提交
- [ ] 在 Google Search Console 验证 `goreportify.com`
- [ ] 提交 sitemap.xml
- [ ] 监控索引状态

### Phase 3 ⏳ 待做 — 关键词优化
- [ ] 关键词研究 (AI report generator, weekly report AI 等)
- [ ] Amber prompt 升级：加入关键词策略指导
- [ ] 优化文章 excerpt 长度和关键词密度

### Phase 4 ⏳ 待做 — 性能优化
- [ ] 图片本地压缩 + WebP 支持
- [ ] Nginx 配置 Brotli 压缩
- [ ] 启用 HTTP/2 (已配置)

### Phase 5 ⏳ 待做 — 内链策略
- [ ] 文章底部自动推荐相关文章
- [ ] Breadcrumb 结构化数据
- [ ] 分类页面优化

---

## 6. 关键文件位置

| 文件 | 路径 | 说明 |
|------|------|------|
| Amber Engine | `/root/ai-report-generator/amber_engine.cjs` | SEO 注入核心逻辑 |
| Article 模板 | `/root/ai-report-generator/article.html` | 独立文章页面模板 |
| Nginx 配置 | `/etc/nginx/sites-enabled/goreportify.conf` | SSL/缓存/Gzip 配置 |
| API Nginx 配置 | `/etc/nginx/sites-enabled/api.goreportify.com.conf` | API 反向代理 |

---

## 7. 部署说明

所有修改在本地 commit 后，需要到服务器执行:
```bash
cd /root/ai-report-generator
git pull
pm2 restart all
```

> 注意: 本地开发环境没有 SSH key 推送权限，需手动在服务器 git pull。
