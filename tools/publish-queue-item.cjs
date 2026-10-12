#!/usr/bin/env node
/**
 * publish-queue-item.cjs
 * 队列发布工具 — platform: website 路径
 *
 * 用法:
 *   node tools/publish-queue-item.cjs <item.md> <slug> [title] [type] [author]
 *
 * 与 Amber 的区别:
 *   - 文件名用 slug（人类可读 kebab-case），不是数字 timestamp ID
 *   - 不调用 AI，不抓取新闻 — 内容完全来自队列文件
 *   - 幂等：同名 slug 文件已存在则覆盖（可重复跑）
 *
 * 输出: article-pages/<slug>.html  + 更新 data/posts.json
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
// marked 是 ESM-only，动态 import（与 amber_engine.cjs 一致）

const REPO_DIR = path.join(__dirname, '..');
const ARTICLE_PAGES_DIR = path.join(REPO_DIR, 'article-pages');
const TEMPLATE_PATH = path.join(REPO_DIR, 'article.html');
const POSTS_JSON_PATH = path.join(REPO_DIR, 'data/posts.json');

function parseFrontMatter(raw) {
    const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (!m) return { meta: {}, body: raw };
    const meta = {};
    for (const line of m[1].split('\n')) {
        if (!line.trim()) continue;
        const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
        if (kv) {
            let v = kv[2].trim().replace(/^["']|["']$/g, '');
            meta[kv[1].trim()] = v;
        }
    }
    return { meta, body: m[2] };
}

// 把逗号分隔的单行字段拆成数组（secondary_keywords / internal_links）
function csvList(v) {
    if (!v) return [];
    return String(v).split(',').map(s => s.trim()).filter(Boolean);
}

function stripMdTitle(body) {
    // 去掉正文开头的 "# 标题" 行（标题会单独渲染到 header）
    return body.replace(/^\s*#\s+.*(\n|$)/, '');
}

async function main() {
    const { marked } = await import('marked');
    const args = process.argv.slice(2);
    const itemPath = args[0];
    const slug = (args[1] || '').trim();
    if (!itemPath || !slug) {
        console.error('用法: node tools/publish-queue-item.cjs <item.md> <slug> [title] [type] [author]');
        process.exit(2);
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
        console.error(`❌ slug 必须是 kebab-case（小写字母/数字/连字符），收到: "${slug}"`);
        process.exit(2);
    }

    const raw = fs.readFileSync(itemPath, 'utf8');
    const { meta, body } = parseFrontMatter(raw);

    // ---- 必填字段校验：platform 为空就报错退出，绝不静默跳过 ----
    const platform = (meta.platform || '').trim().toLowerCase();
    if (!platform) {
        console.error('❌ front-matter 缺少 platform 字段（或解析失败，例如误用了 YAML 多行列表）。');
        console.error('   必须写成单行: platform: "website"  （不要写成 platform:\\n  - website）');
        process.exit(3);
    }
    if (!['website', 'visora', 'social'].includes(platform)) {
        console.error(`❌ 未知 platform: "${platform}"（只接受 website / visora / social）`);
        process.exit(3);
    }
    if (platform !== 'website') {
        console.error(`❌ 本工具只处理 platform=website，收到 platform="${platform}"。`);
        process.exit(3);
    }

    const title = args[2] || meta.title || slug.replace(/-/g, ' ');
    const type = args[3] || meta.type || 'blog';            // blog | news
    const author = args[4] || meta.author || 'Reportify AI Editorial';
    const dateStr = meta.date || new Date().toISOString().slice(0, 10);
    const category = type === 'news' ? 'Tech Radar' : 'Deep Insights';

    // 关键词 / 内链（用于 SEO meta）
    const targetKeyword = (meta.target_keyword || '').trim();
    const secondaryKeywords = csvList(meta.secondary_keywords);
    const internalLinks = csvList(meta.internal_links);

    const md = stripMdTitle(body).trim();
    // 第一段作为 excerpt
    const firstPara = md.split(/\n\s*\n/).find(p => p.trim() && !p.trim().startsWith('#')) || '';
    const excerpt = firstPara.replace(/[#*_>`\[\]]/g, '').trim().slice(0, 200);

    // ---- internal_links 目标校验（WARN，不阻断发布）----
    // 内链是优化项，不是发布前提：目标不存在只打 WARN，照常发布。
    // （硬失败只留给会导致错误结果的字段，如 platform / slug。）
    if (internalLinks.length) {
        const missing = internalLinks.filter(s => !fs.existsSync(path.join(ARTICLE_PAGES_DIR, `${s}.html`)));
        if (missing.length) {
            console.warn(`⚠️  WARN: internal_links 有 ${missing.length} 个目标页不存在（照常发布，仅提示）:`);
            for (const s of missing) console.warn(`     - ${s}.html  (article-pages/${s}.html 不存在)`);
        } else {
            console.log(`✅ internal_links 校验通过：${internalLinks.length} 个目标页均存在`);
        }
    }

    const articleUrl = `https://goreportify.com/article-pages/${slug}.html`;

    const templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const $ = cheerio.load(templateHtml);

    // ---- SEO meta ----
    $('title').text(`${title} | Reportify AI`);
    const ogDesc = excerpt;
    if ($('meta[name="description"]').length) $('meta[name="description"]').attr('content', ogDesc);
    else $('head').append(`<meta name="description" content="${ogDesc.replace(/"/g, '&quot;')}">`);
    if ($('meta[property="og:title"]').length) $('meta[property="og:title"]').attr('content', title);
    if ($('meta[property="og:description"]').length) $('meta[property="og:description"]').attr('content', ogDesc);
    if ($('meta[property="og:url"]').length) $('meta[property="og:url"]').attr('content', articleUrl);
    if ($('meta[property="og:type"]').length) $('meta[property="og:type"]').attr('content', 'article');
    if ($('link[rel="canonical"]').length) $('link[rel="canonical"]').attr('href', articleUrl);

    // ---- 关键词 meta（target_keyword 为核心） ----
    const kwSet = [targetKeyword, ...secondaryKeywords].filter(Boolean);
    if (kwSet.length) {
        if ($('meta[name="keywords"]').length) {
            $('meta[name="keywords"]').attr('content', kwSet.join(', '));
        } else {
            $('head').append(`<meta name="keywords" content="${kwSet.join(', ').replace(/"/g, '&quot;')}">`);
        }
    }

    // ---- JSON-LD ----
    const articleType = type === 'blog' ? 'BlogPosting' : 'NewsArticle';
    const jsonld = {
        '@context': 'https://schema.org',
        '@type': articleType,
        headline: title,
        description: ogDesc,
        datePublished: dateStr,
        author: { '@type': 'Person', name: author },
        publisher: {
            '@type': 'Organization',
            name: 'Reportify AI',
            logo: { '@type': 'ImageObject', url: 'https://goreportify.com/logo-3d.png.png' }
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
        image: 'https://goreportify.com/images/og-default.png'
    };
    const jsonldScript = $('script[type="application/ld+json"]');
    if (jsonldScript.length) jsonldScript.html(JSON.stringify(jsonld, null, 2));
    else $('head').append(`<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`);

    // ---- Header + content ----
    const backLink = type === 'news' ? 'news.html' : 'blog.html';
    const backInner = `<span class="back-arrow">←</span><span class="back-text">Back to ${type === 'news' ? 'News' : 'Blog'}</span>`;
    $('.unified-back-btn').attr('href', backLink).html(backInner);
    $('#dynamic-back-btn').remove();
    $('.pwa-page-back-link').not('.unified-back-btn').remove();

    const headerHtml = `<div class="flex items-center gap-3 text-sm font-bold text-blue-600 uppercase tracking-wider mb-4"><span>${category}</span><span class="text-gray-300">|</span><span class="text-gray-500"><i class="far fa-calendar-alt"></i> ${dateStr}</span></div><h1 class="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">${title}</h1><div class="flex items-center gap-4 text-gray-600 font-medium"><div class="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg"><i class="fas fa-user-edit"></i></div><div class="text-gray-900 font-bold">${author}<div class="text-xs text-gray-400">Staff Writer</div></div></div>`;
    $('#article-header').html(headerHtml);
    $('#article-content').removeClass('text-center text-gray-400 py-10').html(marked.parse(md));

    $('#article-content').append(`
      <div class="pt-8 mt-8 border-t border-gray-200 text-center">
        <p class="text-sm text-gray-400">
          Generated by <a href="https://goreportify.com" class="text-blue-600 hover:underline font-medium" target="_blank" rel="noopener">Reportify AI</a> —
          Automate your team's status reports, standups, and weekly updates.
          <a href="https://goreportify.com/generate.html" class="text-blue-600 hover:underline" target="_blank" rel="noopener">Try free →</a>
        </p>
      </div>
    `);

    // 移除模板里的动态拉取脚本
    $('script').each((i, el) => {
        const t = $(el).html();
        if (t && t.includes('获取并渲染文章正文的逻辑')) {
            $(el).html(t.split('// 获取并渲染文章正文的逻辑')[0]);
        }
    });

    if (!fs.existsSync(ARTICLE_PAGES_DIR)) fs.mkdirSync(ARTICLE_PAGES_DIR, { recursive: true });
    const outPath = path.join(ARTICLE_PAGES_DIR, `${slug}.html`);
    fs.writeFileSync(outPath, $.html(), 'utf8');

    // ---- 更新 posts.json（供 blog.html / news.html 列表）----
    let posts = [];
    if (fs.existsSync(POSTS_JSON_PATH)) {
        try { posts = JSON.parse(fs.readFileSync(POSTS_JSON_PATH, 'utf8')); } catch (e) { posts = []; }
    }
    posts = posts.filter(p => p.id !== slug);   // 幂等
    posts.unshift({
        id: slug,
        type,
        title,
        category,
        date: dateStr,
        author,
        excerpt,
        contentFile: `${slug}.html`,
        url: `/article-pages/${slug}.html`,
        targetKeyword: targetKeyword || undefined,
        secondaryKeywords: secondaryKeywords.length ? secondaryKeywords : undefined,
        internalLinks: internalLinks.length ? internalLinks : undefined,
        platform: 'website'
    });
    fs.writeFileSync(POSTS_JSON_PATH, JSON.stringify(posts, null, 4), 'utf8');

    console.log(`✅ 已发布: ${articleUrl}`);
    console.log(`   文件: article-pages/${slug}.html`);
}

main().catch(e => { console.error('❌ 发布失败:', e.message); process.exit(1); });
