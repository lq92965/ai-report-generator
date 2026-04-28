#!/usr/bin/env node
/**
 * SEO Enhancement Script — Reportify AI
 * 
 * 修改内容：
 * 1. 所有 HTML 页面加 Open Graph 标签
 * 2. 所有 HTML 页面加 Twitter Cards
 * 3. 所有 HTML 页面加 canonical 标签
 * 4. 首页加 JSON-LD (WebSite + SoftwareApplication)
 * 5. 所有文章页加 JSON-LD (Article)
 * 6. 修复 sitemap.xml — 补上产品页面
 * 7. 修复文章 title 格式（去重）
 * 8. 补全空 alt 的图片
 * 
 * 使用：node tools/seo-enhance.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SITE_URL = 'https://www.goreportify.com';
const OG_IMAGE = `${SITE_URL}/images/og-default.png`;

// ============================================================
// Step 1 — 生成 OG 默认图片（已存在，这里只确认）
// ============================================================
function ensureOGImage() {
  const ogPath = path.join(ROOT, 'images', 'og-default.png');
  if (!fs.existsSync(ogPath)) {
    console.error('⚠️  OG image not found at images/og-default.png — skipping');
    return false;
  }
  console.log('✅  OG image found:', ogPath);
  return true;
}

// ============================================================
// Step 2 — 给所有 HTML 页面加 OG/Twitter/Canonical
// ============================================================

function injectMetaTags(html, pageName) {
  const url = `${SITE_URL}/${pageName}`;

  // 根据页面生成不同 title/description
  let title = '';
  let description = '';

  switch (pageName) {
    case 'index.html':
      title = 'Reportify AI - AI-Powered Report Generator';
      description = 'Generate professional daily and weekly reports in seconds with AI. Save hours on meetings, standups, and stakeholder updates. Free AI report generator.';
      break;
    case 'blog.html':
      title = 'Deep Insights - Reportify AI Blog';
      description = 'Expert insights on AI, productivity, and modern report writing. Learn how AI can transform your workflow.';
      break;
    case 'news.html':
      title = 'Global Tech Radar - Reportify AI';
      description = 'Curated AI and tech news with actionable impact analysis for product managers and teams.';
      break;
    case 'generate.html':
      title = 'Generate Report - Reportify AI';
      description = 'Create AI-powered daily, weekly, and monthly reports instantly. Choose from multiple templates and formats.';
      break;
    case 'article.html':
      title = 'Reportify AI - Article';
      description = 'Read the latest insights from Reportify AI.';
      break;
    case 'contact.html':
      title = 'Contact Support - Reportify AI';
      description = 'Get help with Reportify AI. Contact our support team for assistance with reports, billing, or account issues.';
      break;
    case 'privacy.html':
      title = 'Privacy Policy - Reportify AI';
      description = 'Reportify AI privacy policy. Learn how we collect, use, and protect your data.';
      break;
    case 'terms.html':
      title = 'Terms of Service - Reportify AI';
      description = 'Reportify AI terms of service. Please read these terms carefully before using our service.';
      break;
    case 'account.html':
      title = 'My Account - Reportify AI';
      description = 'Manage your Reportify AI account, subscription, and preferences.';
      break;
    case 'security.html':
      title = 'Security Settings - Reportify AI';
      description = 'Manage your Reportify AI security settings, password, and authentication.';
      break;
    default:
      // 提取 <title> 内容
      const titleMatch = html.match(/<title>(.*?)<\/title>/);
      title = titleMatch ? titleMatch[1] : 'Reportify AI';
      const descMatch = html.match(/<meta name="description" content="(.*?)"/);
      description = descMatch ? descMatch[1] : 'Reportify AI - AI-powered report generation';
  }

  // 构建要注入的 meta 标签
  const metaTags = `
    <!-- Open Graph / Social -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:site_name" content="Reportify AI" />
    <meta property="og:locale" content="en_US" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />

    <!-- Canonical -->
    <link rel="canonical" href="${url}" />
`;

  // 注入到 </head> 前面
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${metaTags}\n</head>`);
  }

  return html;
}

function escapeAttr(s) {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
// Step 3 — 首页加 JSON-LD
// ============================================================

function injectIndexJsonLD(html) {
  const jsonld = `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "${SITE_URL}/#website",
        "url": "${SITE_URL}/",
        "name": "Reportify AI",
        "description": "AI-powered report generator. Create daily, weekly, and monthly reports instantly.",
        "potentialAction": {
          "@type": "SearchAction",
          "target": "${SITE_URL}/?s={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "SoftwareApplication",
        "@id": "${SITE_URL}/#software",
        "name": "Reportify AI",
        "applicationCategory": "ProductivityApplication",
        "operatingSystem": "Android, Web",
        "description": "AI-powered daily and weekly report generator for professionals.",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      }
    ]
  }
  </script>
`;
  if (html.includes('</head>') && html.includes('<title>Reportify AI - AI Report Generator</title>')) {
    html = html.replace('</head>', `${jsonld}\n</head>`);
  }
  return html;
}

// ============================================================
// Step 4 — 文章页加 JSON-LD (Article)
// ============================================================

function injectArticleJsonLD(html, filePath) {
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const descMatch = html.match(/<meta name="description" content="(.*?)"/);
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
  const dateMatch = html.match(/(\d{4}-\d{2}-\d{2})/);

  const title = titleMatch ? titleMatch[1].replace(' - Reportify AI', '') : 'Article';
  const description = descMatch ? descMatch[1] : '';
  const headline = h1Match ? h1Match[1].replace(/<[^>]*>/g, '').trim() : title;
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
  const articleType = filePath.includes('blog-') ? 'BlogPosting' : 'NewsArticle';

  const relPath = path.relative(ROOT, filePath);
  const articleUrl = `${SITE_URL}/${relPath}`;
  const fileName = path.basename(filePath);

  const jsonld = `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "${articleType}",
    "@id": "${articleUrl}#article",
    "headline": "${escapeAttr(headline)}",
    "description": "${escapeAttr(description)}",
    "datePublished": "${date}T00:00:00Z",
    "dateModified": "${date}T00:00:00Z",
    "author": {
      "@type": "Organization",
      "name": "Reportify AI"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Reportify AI",
      "logo": {
        "@type": "ImageObject",
        "url": "${SITE_URL}/logo-3d.png.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "${articleUrl}"
    },
    "image": {
      "@type": "ImageObject",
      "url": "${OG_IMAGE}"
    }
  }
  </script>
`;

  if (html.includes('</head>')) {
    html = html.replace('</head>', `${jsonld}\n</head>`);
  }
  return html;
}

// ============================================================
// Step 5 — 修复文章 title（去重问题）
// ============================================================

function fixArticleTitle(html, filePath) {
  const fileName = path.basename(filePath);
  // Amber 产生的 title 模式： "A: B: A Details: B - Reportify AI"
  // 取完整 h1 作为 title
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
  if (!h1Match) return html;

  const h1Text = h1Match[1].replace(/<[^>]*>/g, '').trim();
  
  // 检查 title 是否被 Amber 重复拼接
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  if (!titleMatch) return html;

  const currentTitle = titleMatch[1];
  
  // 如果 H1 以 " - Reportify AI" 结尾，用它做 title
  let newTitle = h1Text;
  if (!newTitle.includes('Reportify AI') && !fileName.includes('article.html')) {
    newTitle = `${h1Text} - Reportify AI`;
  }

  // 只有当前 title 明显不正常（冒号重复、太长）时才替换
  const colonCount = (currentTitle.match(/:/g) || []).length;
  if (colonCount >= 3 || currentTitle.length > 150) {
    html = html.replace(`<title>${currentTitle}</title>`, `<title>${escapeHtml(newTitle)}</title>`);
    console.log(`  🛠  Fixed title: "${currentTitle}" → "${newTitle}"`);
  }

  return html;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// Step 6 — 补全空 alt
// ============================================================

function fixEmptyAlt(html) {
  // 替换 alt="" 为描述性 alt
  // 文章中的图片
  html = html.replace(/alt=""(?=[^>]*src=)/g, 'alt="Reportify AI article illustration"');
  // 其他无 alt 的 img 标签
  html = html.replace(/<img(?![^>]*alt=)([^>]*)>/g, '<img$1 alt="Reportify AI">');
  return html;
}

// ============================================================
// Step 7 — 修复 sitemap.xml
// ============================================================

function fixSitemap() {
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    console.error('⚠️  sitemap.xml not found');
    return;
  }

  let sitemap = fs.readFileSync(sitemapPath, 'utf-8');

  // 检查是否已有核心产品页面
  const corePages = [
    { loc: '/', freq: 'daily', priority: '1.0' },
    { loc: '/blog.html', freq: 'daily', priority: '0.9' },
    { loc: '/news.html', freq: 'daily', priority: '0.9' },
    { loc: '/generate.html', freq: 'weekly', priority: '0.8' },
    { loc: '/contact.html', freq: 'monthly', priority: '0.5' },
    { loc: '/privacy.html', freq: 'monthly', priority: '0.3' },
    { loc: '/terms.html', freq: 'monthly', priority: '0.3' },
  ];

  for (const page of corePages) {
    const pageUrl = `${SITE_URL}${page.loc}`;
    // 如果 sitemap 里还没有这个 URL
    if (!sitemap.includes(pageUrl)) {
      const entry = `
  <url>
    <loc>${pageUrl}</loc>
    <changefreq>${page.freq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
      sitemap = sitemap.replace('</urlset>', `${entry}\n</urlset>`);
      console.log(`  📄 Added to sitemap: ${pageUrl}`);
    }
  }

  // 更新 lastmod
  const now = new Date().toISOString();
  sitemap = sitemap.replace(/<\/urlset>/g, `${now.substring(0,10)}\n</urlset>`);

  fs.writeFileSync(sitemapPath, sitemap, 'utf-8');
  console.log('✅  sitemap.xml updated');

  // 也更新 rss.xml 的 lastBuildDate
  const rssPath = path.join(ROOT, 'rss.xml');
  if (fs.existsSync(rssPath)) {
    let rss = fs.readFileSync(rssPath, 'utf-8');
    const rssDate = new Date().toUTCString();
    if (rss.includes('<lastBuildDate>')) {
      rss = rss.replace(/<lastBuildDate>[^<]*<\/lastBuildDate>/, `<lastBuildDate>${rssDate}</lastBuildDate>`);
    } else {
      rss = rss.replace('</channel>', `  <lastBuildDate>${rssDate}</lastBuildDate>\n</channel>`);
    }
    fs.writeFileSync(rssPath, rss, 'utf-8');
    console.log('✅  rss.xml lastBuildDate updated');
  }
}

// ============================================================
// Step 8 — 处理所有 HTML 文件
// ============================================================

function processAllHtml() {
  const files = [];
  
  // 根目录 HTML
  const rootFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
  for (const f of rootFiles) {
    files.push(path.join(ROOT, f));
  }

  // article-pages 目录
  const articleDir = path.join(ROOT, 'article-pages');
  if (fs.existsSync(articleDir)) {
    const articleFiles = fs.readdirSync(articleDir).filter(f => f.endsWith('.html'));
    for (const f of articleFiles) {
      files.push(path.join(articleDir, f));
    }
  }

  let count = 0;
  for (const filePath of files) {
    let html = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    const fileName = path.basename(filePath);

    // 跳过明显不需要改的
    if (!html.includes('<html') && !html.includes('<!DOCTYPE')) continue;

    // Step: fix empty alt
    const htmlAfterAlt = fixEmptyAlt(html);
    if (htmlAfterAlt !== html) { modified = true; html = htmlAfterAlt; }

    // Step: inject meta tags
    let pageName; 
    if (filePath.startsWith(path.join(ROOT, 'article-pages'))) {
      pageName = `article-pages/${fileName}`;
    } else {
      pageName = fileName;
    }

    // 对 article.html 模板页特殊处理（它不直接是文章）
    if (fileName === 'article.html') {
      // 只加基本 meta
    }

    const htmlAfterMeta = injectMetaTags(html, pageName);
    if (htmlAfterMeta !== html) { modified = true; html = htmlAfterMeta; }

    // Step: fix article title (only for article-pages)
    if (filePath.startsWith(articleDir)) {
      const htmlAfterTitle = fixArticleTitle(html, filePath);
      if (htmlAfterTitle !== html) { modified = true; html = htmlAfterTitle; }
    }

    // Step: inject JSON-LD for article pages
    if (filePath.startsWith(articleDir)) {
      const htmlAfterJSON = injectArticleJsonLD(html, filePath);
      if (htmlAfterJSON !== html) { modified = true; html = htmlAfterJSON; }
    }

    // Step: inject JSON-LD for index
    if (fileName === 'index.html') {
      const htmlAfterIndexJSON = injectIndexJsonLD(html);
      if (htmlAfterIndexJSON !== html) { modified = true; html = htmlAfterIndexJSON; }
    }

    if (modified) {
      fs.writeFileSync(filePath, html, 'utf-8');
      count++;
      console.log(`✅  Updated: ${path.relative(ROOT, filePath)}`);
    }
  }
  console.log(`\n📊  Total files modified: ${count}`);
}

// ============================================================
// Main
// ============================================================

console.log('🚀  Reportify AI SEO Enhancement\n');
console.log('=' .repeat(50));

console.log('\n📦  Step 1: Check OG image...');
ensureOGImage();

console.log('\n📝  Step 2-5: Processing all HTML files...');
processAllHtml();

console.log('\n🗺️   Step 6: Fixing sitemap...');
fixSitemap();

console.log('\n✅  SEO Enhancement Complete!');
console.log('🔄  Commit and push to deploy:');
console.log('   git add -A');
console.log('   git commit -m "SEO: add OG tags, JSON-LD, canonical, fix sitemap & titles"');
console.log('   git push');
