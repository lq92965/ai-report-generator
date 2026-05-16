# Reportify AI - GEO (Generative Engine Optimization) 方案

> 目标：让 ChatGPT、Gemini、Claude、Perplexity 等 AI 搜索引擎更好地理解、引用和推荐我们的网站。

---

## 当前状态审计 ✅

| 项目 | 状态 | 说明 |
|------|------|------|
| robots.txt | ✅ 正常 | 允许所有爬虫，sitemap 已链接 |
| sitemap.xml | ✅ 正常 | 含核心页面和文章 |
| JSON-LD (WebSite + SoftwareApplication) | ✅ 首页有 | 但缺少 FAQ、HowTo、Breadcrumb 等 |
| OG / Twitter Cards | ✅ 正常 | 首页和文章页都有 |
| **llms.txt** | ❌ **不存在** | 返回 index.html 内容，AI 爬虫无法解析 |
| **FAQPage 结构化数据** | ❌ **缺失** | AI 特别喜欢引用 FAQ |
| **HowTo 结构化数据** | ❌ **缺失** | 产品使用步骤未结构化 |
| **BreadcrumbList** | ❌ **缺失** | 文章页无面包屑导航 |
| **meta description** | ⚠️ 偏短 | 170 字符，建议 150-160 |

---

## Phase 1: 基础 GEO 基础设施（高优先级）

### 1.1 创建 llms.txt

`llms.txt` 是 AI 爬虫的标准入口文件，告诉 AI 你的网站结构和关键页面。

**位置**: 网站根目录 `/root/ai-report-generator/llms.txt`

```txt
# Reportify AI - AI-Powered Report Generator
> Turn messy meeting notes, chat logs, and quick thoughts into executive-level reports, PPT decks, and professional emails in seconds.

## Core Pages

- Home: https://www.goreportify.com/
- Generate Report: https://www.goreportify.com/generate.html
- Pricing: https://www.goreportify.com/index.html#pricing
- Blog: https://www.goreportify.com/blog.html
- News: https://www.goreportify.com/news.html

## Features

- AI Report Generation: Turn fragments into structured Word reports
- One-Click PPT Generation: Convert reports to presentation-ready slide decks
- Email Drafts: Generate concise stakeholder-ready email summaries
- Daily/Weekly/Monthly Reports: Automate recurring report writing
- RIE Engine (Reportify Intelligence Engine): Understands corporate hierarchy and professional communication

## FAQ

- What is Reportify AI? AI-powered tool that transforms meeting notes, chat logs, and ideas into professional reports, PPTs, and emails.
- How much does it cost? Free 7-day Elite Trial, then Basic $9.90/month or Professional $19.90/month.
- What report types are supported? General Summary, Daily Standup, Weekly Pulse, Project Status, Monthly Review, Quarterly Report.
- Can I export to PPT? Yes, one-click PPT generation is included in all plans.
- What languages are supported? English, Chinese, Japanese, Korean, Spanish, German, French, Portuguese.
```

### 1.2 Nginx 让 llms.txt 不被 SPA 拦截

因为 Nginx 配置有 `try_files $uri $uri/ /index.html`，需要给 `llms.txt` 加一条例外。

在 `/etc/nginx/sites-enabled/goreportify.conf` 的 `location /` 块前加上：

```nginx
# llms.txt - AI crawler entry point
location = /llms.txt {
    try_files $uri =404;
}
```

---

## Phase 2: 结构化数据增强（中优先级）

### 2.1 FAQPage Schema

在首页底部加入 FAQ 结构化数据。直接在 `index.html` 的 `</head>` 前添加：

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is Reportify AI?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Reportify AI is an AI-powered report generator that transforms messy meeting notes, chat logs, and quick thoughts into professional reports, PPT decks, and email summaries. It uses the RIE (Reportify Intelligence Engine) to understand corporate hierarchy and professional communication."
      }
    },
    {
      "@type": "Question",
      "name": "How much does Reportify AI cost?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Reportify AI offers a free 7-day Elite Trial with full access. After that, plans start at $9.90/month for Basic and $19.90/month for Professional, which includes unlimited generation and strategic depth analysis."
      }
    },
    {
      "@type": "Question",
      "name": "What types of reports can I generate?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You can generate General Summaries, Daily Standups, Weekly Pulse Reports, Project Status Updates, Monthly Reviews, and Quarterly Reports. Each can be exported as Word documents, PPT decks, Markdown, or email drafts."
      }
    },
    {
      "@type": "Question",
      "name": "Can Reportify AI generate PowerPoint presentations?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, Reportify AI can convert any report into a presentation-ready slide deck with one click. This feature is available in all plans, with Professional plans offering full-scene PPT generation."
      }
    }
  ]
}
</script>
```

### 2.2 BreadcrumbList Schema（文章页）

在 `buildStaticPage()`（`amber_engine.cjs`）的 JSON-LD 部分加入面包屑：

```javascript
// 在现有的 JSON-LD 后追加
const breadcrumbJson = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.goreportify.com/" },
        { "@type": "ListItem", "position": 2, "name": sectionName, "item": `https://www.goreportify.com/${postData.type}.html` },
        { "@type": "ListItem", "position": 3, "name": postData.title, "item": articleUrl }
    ]
};
```

### 2.3 HowTo Schema（产品核心流程）

在 `index.html` 或 `generate.html` 中加入 HowTo 结构化数据：

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Generate a Professional Report with Reportify AI",
  "description": "Turn your messy notes into an executive-ready report in 30 seconds.",
  "step": [
    { "@type": "HowToStep", "position": 1, "name": "Select Report Type", "text": "Choose from General Summary, Daily Standup, Weekly Pulse, Project Status, or more." },
    { "@type": "HowToStep", "position": 2, "name": "Paste Your Notes", "text": "Enter your meeting notes, chat logs, or bullet points into the text area." },
    { "@type": "HowToStep", "position": 3, "name": "Choose Style and Language", "text": "Select detail level, tone, and output language." },
    { "@type": "HowToStep", "position": 4, "name": "Generate and Export", "text": "Click Generate and export as Word, PPT, Markdown, or email draft." }
  ]
}
</script>
```

---

## Phase 3: AI-Friendly 内容优化（中优先级）

### 3.1 Amber Prompt 升级 — 加入 AI 可摘要性指导

在 `amber_engine.cjs` 的 blog/news prompt 中加入：

```
Write with high "answerability" — structure content so AI assistants can easily extract:
1. A clear one-sentence takeaway (for AI summaries)
2. 3-5 bullet-point key insights (for AI lists)
3. A practical action item (for AI recommendations)
```

### 3.2 文章 meta description 优化

确保每篇文章的 excerpt 在 **150-160 字符**之间（当前 170 偏长）。

在 `buildStaticPage()` 中加入截断逻辑：

```javascript
const ogDesc = postData.excerpt.length > 155 
    ? postData.excerpt.substring(0, 152) + '...' 
    : postData.excerpt;
```

### 3.3 关键词密度建议

Amber 生成时提示文章核心关键词出现 2-3 次：
- blog: "AI report generator", "professional report writing", "meeting notes to report"
- news: 根据具体新闻内容自然融入 "reporting automation", "AI productivity" 

---

## Phase 4: 技术优化（低优先级）

### 4.1 页面加载速度

- [ ] 图片使用 WebP 格式（Nginx 自动转码或构建时转换）
- [ ] 启用 Brotli 压缩（比 gzip 好 20-30%）
- [ ] CSS/JS 合并和最小化
- [ ] 启用 HTTP/2 Server Push（已启用 HTTP/2，但可优化）

### 4.2 移动端体验

- [ ] Core Web Vitals 检查
- [ ] LCP (Largest Contentful Paint) 优化
- [ ] CLS (Cumulative Layout Shift) 修复

---

## Phase 5: AI 爬虫监控（低优先级）

### 5.1 在 robots.txt 中添加 AI 爬虫指令

```txt
# AI crawlers
User-agent: GPTBot
Allow: /
Allow: /article-pages/
Disallow: /api/

User-agent: Google-Extended
Allow: /
Allow: /article-pages/
Disallow: /api/

User-agent: Claude-Web
Allow: /
Allow: /article-pages/
Disallow: /api/

User-agent: PerplexityBot
Allow: /
Allow: /article-pages/
Disallow: /api/
```

### 5.2 监控 AI 引用

- 在 Google Search Console 监控 "AI Overviews" 来源
- 定期搜索 `site:goreportify.com` 在 ChatGPT/Perplexity 中的表现

---

## 实施优先级

| 优先级 | 任务 | 预估时间 | 影响 |
|--------|------|----------|------|
| 🔴 P0 | 创建 llms.txt | 10 分钟 | AI 爬虫入口 |
| 🔴 P0 | Nginx 放行 llms.txt | 5 分钟 | 配合上一条 |
| 🟡 P1 | FAQPage 结构化数据 | 15 分钟 | AI 摘要高频引用 |
| 🟡 P1 | BreadcrumbList | 10 分钟 | 文章页上下文 |
| 🟢 P2 | Amber prompt 升级 | 20 分钟 | 长期内容质量 |
| 🟢 P2 | HowTo 结构化数据 | 15 分钟 | 产品页面收录 |
| 🔵 P3 | 图片压缩 / WebP | 30 分钟 | 加载速度 |
| 🔵 P3 | Brotli 压缩 | 10 分钟 | 带宽优化 |

---

## 关键文件

| 文件 | 路径 | 说明 |
|------|------|------|
| llms.txt | `/root/ai-report-generator/llms.txt` | AI 爬虫入口 |
| Amber Engine | `/root/ai-report-generator/amber_engine.cjs` | 文章生成 + SEO 注入 |
| Nginx 配置 | `/etc/nginx/sites-enabled/goreportify.conf` | llms.txt 例外规则 |
| SEO 文档 | `/root/ai-report-generator/docs/SEO_IMPLEMENTATION.md` | 已完成的技术 SEO |
