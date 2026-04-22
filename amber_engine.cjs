// amber_engine.cjs
// 完整文件：Reportify AI V8.6 极速引擎 (内置实时热点 + 每日美国东部 9:00 发文 + 标准 RSS 引擎)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const { execSync } = require('child_process');
const imageDownloader = require('image-downloader');
const cheerio = require('cheerio');
const crypto = require('crypto');

const REPO_DIR = __dirname;
const DATA_DIR = path.join(REPO_DIR, 'data');
const CONTENT_DIR = path.join(REPO_DIR, 'content');
const IMAGES_DIR = path.join(REPO_DIR, 'images');
/** Standalone SEO HTML for each post (keeps repo root clean). */
const ARTICLE_PAGES_DIR = path.join(REPO_DIR, 'article-pages');
const POSTS_JSON_PATH = path.join(DATA_DIR, 'posts.json');
const TEMPLATE_PATH = path.join(REPO_DIR, 'article.html');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
if (!fs.existsSync(ARTICLE_PAGES_DIR)) fs.mkdirSync(ARTICLE_PAGES_DIR, { recursive: true });

const FAKE_AUTHORS = ["Alex Mercer", "Sarah Jenkins", "Michael Chen", "Emily Rostova", "David Sterling", "Jessica Tran", "Marcus Webb", "Olivia Thorne"];

/** Calendar date shown in posts.json / article header (YYYY-MM-DD). Override for catch-up runs: AMBER_ARTICLE_DATE=2026-04-18 */
function articleDateStr() {
    const raw = process.env.AMBER_ARTICLE_DATE;
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(String(raw).trim())) {
        return String(raw).trim();
    }
    return new Date().toISOString().split('T')[0];
}

/** Rotate visual style so Pollinations images are less same-y (title-only prompts were repetitive). */
const COVER_VISUAL_STYLES = [
    'editorial photo soft natural light shallow depth of field',
    'clean tech illustration blue white minimal flat',
    'cinematic wide shot single subject atmospheric',
    'isometric 3d soft lighting professional',
    'abstract geometric calm colors productivity theme',
    'modern workspace hero no readable text on screen',
    'conceptual still life muted professional tones',
    'bold editorial illustration high contrast magazine'
];

/** When Pollinations download fails — pick by timestamp so fallback is not always the same Unsplash ID. */
/** Load recent titles + image URLs so new articles avoid repeating them. */
function loadExistingCorpusHints(type) {
    let titles = [];
    const imageUrls = new Set();
    try {
        if (fs.existsSync(POSTS_JSON_PATH)) {
            const posts = JSON.parse(fs.readFileSync(POSTS_JSON_PATH, 'utf8'));
            titles = posts
                .filter((p) => p.type === type && p.title)
                .map((p) => String(p.title).trim())
                .slice(0, 80);
        }
    } catch (e) {}
    try {
        if (fs.existsSync(CONTENT_DIR)) {
            const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md') && f.startsWith(`${type}-`));
            for (const f of files.slice(0, 200)) {
                const raw = fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8');
                const m = raw.match(/src="([^"]+cover[^"]+)"/i);
                if (m) imageUrls.add(m[1]);
            }
        }
    } catch (e) {}
    return { titles, imageUrls: [...imageUrls].slice(0, 24) };
}

const UNSPLASH_FALLBACKS = [
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1200&auto=format&fit=crop'
];

const ANTI_AI_VOICE = `Writing rules (mandatory):
- Sound human: concrete scenes, specific details, one clear opinion. No filler.
- Do NOT use these phrases or close variants: "in today's fast-paced", "in the ever-evolving landscape", "delve into", "leverage", "it's important to note", "game-changer", "robust", "unlock", "synergy", "paradigm", "in conclusion", "in summary", "as we have seen".
- Vary sentence length; avoid three parallel rhetorical questions in a row.
- No meta disclaimers ("as an AI", "this article will explore").
- First line must be exactly one H1: # Your Title`;

const TITLE_BANNED_PREFIXES = {
    news: [
        'the silent shift',
        'ai regulation reaches',
        'the unseen labor',
        'the unseen cost'
    ],
    blog: [
        'beyond the dashboard',
        'the silent killer',
        'from drudgery to',
        'beyond the status update',
        'taming the reporting beast'
    ]
};

function normalizeTitle(s) {
    return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function titleStemWords(s, n = 4) {
    return normalizeTitle(s)
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, n)
        .join(' ');
}

function buildStemCount(titles) {
    const m = new Map();
    for (const t of titles || []) {
        const k = titleStemWords(t, 4);
        if (!k) continue;
        m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
}

function extractKeywordFromMarkdown(md) {
    const STOP = new Set([
        'this', 'that', 'with', 'from', 'into', 'about', 'have', 'will', 'your', 'you', 'they', 'their',
        'what', 'when', 'where', 'which', 'while', 'there', 'these', 'those', 'been', 'being', 'over',
        'under', 'after', 'before', 'more', 'less', 'than', 'then', 'them', 'onto', 'across', 'through',
        'report', 'reporting', 'project', 'projects', 'team', 'teams', 'work', 'data', 'analysis'
    ]);
    const text = String(md || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/[`#*_>\[\]\(\)]/g, ' ')
        .toLowerCase();
    const parts = text.split(/[^a-z0-9]+/).filter((w) => w.length >= 5 && !STOP.has(w));
    const freq = new Map();
    for (const w of parts) freq.set(w, (freq.get(w) || 0) + 1);
    const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]);
    return ranked.length ? ranked[0][0] : '';
}

function diversifyTitle(type, title, contentMarkdown, existingTitles) {
    let t = String(title || '').replace(/·.*$/g, '').replace(/\s+/g, ' ').trim();
    const low = normalizeTitle(t);
    const stemMap = buildStemCount(existingTitles || []);
    const stem = titleStemWords(t, 4);
    const repeatedStem = stem && (stemMap.get(stem) || 0) >= 3;
    const banned = (TITLE_BANNED_PREFIXES[type] || []).some((p) => low.startsWith(p));
    const weak = /…|\.\.\./.test(t) || t.length < 24;

    if (!banned && !repeatedStem && !weak) return t;

    const key = extractKeywordFromMarkdown(contentMarkdown);
    const capKey = key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Execution';
    const templates = type === 'news'
        ? [
            `What Changes Now in ${capKey} Markets`,
            `${capKey} Becomes a Competitive Battleground`,
            `The Next Phase of ${capKey} Adoption`
        ]
        : [
            `A Practical Playbook for ${capKey} Decisions`,
            `How PM Teams Can Improve ${capKey} Outcomes`,
            `Fixing Reporting Workflows with Better ${capKey}`
        ];
    const seed = Math.abs(
        Array.from((t || '') + '|' + capKey).reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7)
    );
    return templates[seed % templates.length];
}

async function generateArticle(type) {
    const useGemini = (type === 'blog');
    const apiUrl = useGemini ? process.env.GEMINI_API_URL : process.env.DEEPSEEK_API_URL;
    const apiKey = useGemini ? process.env.GEMINI_API_KEY : process.env.DEEPSEEK_API_KEY;
    const aiModel = useGemini ? process.env.GEMINI_MODEL : process.env.DEEPSEEK_MODEL;

    console.log(`\n[Amber V8] 🧠 正在撰写 ${type}...`);

    const { titles: existingTitles, imageUrls: existingImages } = loadExistingCorpusHints(type);
    const titleBlock =
        existingTitles.length > 0
            ? `\n\nALREADY-PUBLISHED TITLES (must not reuse, paraphrase, or closely mimic — pick a different angle and wording):\n${existingTitles
                  .slice(0, 50)
                  .map((t) => `- ${t}`)
                  .join('\n')}\n`
            : '';
    const imgBlock =
        existingImages.length > 0
            ? `\n\nExisting cover image URLs (your article will get a new cover; do not echo the same visual theme as a single headline repeated in the past): ${existingImages.join(', ')}\n`
            : '';

    let systemPrompt =
        type === 'news'
            ? `You are an experienced tech editor for a serious publication. Write a sharp news analysis with real stakes. Format in standard Markdown.\n${ANTI_AI_VOICE}`
            : `You are a senior product manager who writes for peers. Practical, direct, no corporate fluff. Format in standard Markdown.\n${ANTI_AI_VOICE}`;
    let userPrompt =
        type === 'news'
            ? `Write a tech news analysis. ${titleBlock}${imgBlock} First line must be '# Title'. Output ONLY raw markdown.`
            : `Write a deep-dive post about reporting / PM communication (not generic self-help). ${titleBlock}${imgBlock} First line must be '# Title'. Output ONLY raw markdown.`;

    if (type === 'news') {
        try {
            console.log("[Amber V8] 📡 正在启动爬虫抓取全球最新科技热点...");
            execSync('node tech_radar_crawler.cjs', { cwd: REPO_DIR, stdio: 'pipe' });
            
            const trendingPath = path.join(REPO_DIR, 'trending_news_raw.json');
            if (fs.existsSync(trendingPath)) {
                const rawNews = fs.readFileSync(trendingPath, 'utf8');
                const newsData = JSON.parse(rawNews);
                
                let newsContext = "以下是刚刚抓取的全球科技头条：\n\n";
                newsData.forEach((item, index) => {
                    newsContext += `${index + 1}. 标题：${item.title}\n摘要：${item.snippet}\n\n`;
                });
                
                userPrompt = `Please write a highly engaging tech news analysis article based on the following real-time trending news. \n\n${newsContext}\nCombine these points into a cohesive, insightful article. Emphasize how AI/Tech is changing the landscape, and subtly mention how Reportify AI helps professionals save time to stay updated with such fast-paced tech. Avoid generic AI-ish phrasing. ${titleBlock}${imgBlock} First line must be '# Title'. Output ONLY raw markdown.`;
                console.log("[Amber V8] 🎯 已成功将全球实时热点注入 AI 大脑！");
            }
        } catch (err) {
            console.error("[Amber V8] ⚠️ 雷达信号弱，降级使用默认提示词:", err.message);
        }
    }

    try {
        const response = await axios.post(apiUrl, { 
            model: aiModel, 
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], 
            temperature: 0.7, 
            max_tokens: 2500 
        }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
        
        let rawMarkdown = response.data.choices[0].message.content.trim();
        let titleMatch = rawMarkdown.match(/^#\s+(.+)$/m);
        let title = titleMatch ? titleMatch[1].trim() : `Reportify ${type.toUpperCase()} Insights`;
        let contentMarkdown = rawMarkdown.replace(/^#\s+(.+)$/m, '').trim();

        let postsExisting = [];
        if (fs.existsSync(POSTS_JSON_PATH)) try { postsExisting = JSON.parse(fs.readFileSync(POSTS_JSON_PATH, 'utf8')); } catch (e) {}
        const sameTypeTitles = postsExisting.filter((p) => p.type === type).map((p) => p.title);
        title = diversifyTitle(type, title, contentMarkdown, sameTypeTitles);
        let suffixTry = 0;
        while (postsExisting.some((p) => p.type === type && normalizeTitle(p.title) === normalizeTitle(title))) {
            suffixTry += 1;
            title = `${title} ${new Date().getUTCMonth() + 1}/${new Date().getUTCDate()}-${suffixTry}`;
        }
        rawMarkdown = `# ${title}\n\n${contentMarkdown}`;
        contentMarkdown = rawMarkdown.replace(/^#\s+(.+)$/m, '').trim();

        const safePrompt = title.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 48);
        const excerpt = contentMarkdown.replace(/<[^>]*>?/gm, '').replace(/[#*`>\[\]]/g, '').substring(0, 150).trim() + "...";

        const timestamp = Date.now();
        const dateStr = articleDateStr();
        const hashSeed = crypto
            .createHash('sha256')
            .update(`${type}|${title}|${dateStr}|${timestamp}|${contentMarkdown.slice(0, 400)}`)
            .digest('hex');
        const styleHint = COVER_VISUAL_STYLES[parseInt(hashSeed.slice(0, 8), 16) % COVER_VISUAL_STYLES.length];
        let imagePrompt = `${safePrompt}. ${styleHint}. no text no letters no watermark no logo.`;
        if (imagePrompt.length > 400) imagePrompt = imagePrompt.substring(0, 400);
        const seed = parseInt(hashSeed.slice(8, 16), 16) % 2147483647;
        const imgW = 1024;
        const imgH = 576;
        const remoteUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=${imgW}&height=${imgH}&nologo=true&seed=${seed}`;

        const imageFileName = `cover-${timestamp}.png`;
        let localImageRelPath = `images/${imageFileName}`;
        
        try {
            await imageDownloader.image({ url: remoteUrl, dest: path.join(IMAGES_DIR, imageFileName) });
        } catch (e) {
            localImageRelPath = UNSPLASH_FALLBACKS[parseInt(hashSeed.slice(16, 24), 16) % UNSPLASH_FALLBACKS.length];
        }

        return { timestamp, type, title, contentMarkdown, excerpt, author: FAKE_AUTHORS[Math.floor(Math.random() * FAKE_AUTHORS.length)], localImageRelPath, dateStr };
    } catch (e) { console.error(`[Amber V8] ❌大脑生成失败\n`, e); return null; }
}

async function buildStaticPage(postData) {
    const { marked } = await import('marked');
    console.log(`[Amber V8] ⚡ 正在为谷歌爬虫焊装纯静态独立网页...`);
    const fileName = `${postData.type}-${postData.timestamp}.md`;
    const altEsc = postData.title.replace(/"/g, '');
    const srcEsc = String(postData.localImageRelPath).replace(/&/g, '&amp;');
    const hero = `<figure class="article-cover"><img class="article-cover-img" src="${srcEsc}" alt="${altEsc}" loading="lazy" decoding="async"></figure>\n\n`;
    const mdWithImg = hero + postData.contentMarkdown;
    fs.writeFileSync(path.join(CONTENT_DIR, fileName), mdWithImg, 'utf8');

    const templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const $ = cheerio.load(templateHtml);

    $('title').text(`${postData.title} - Reportify AI`);
    $('meta[name="description"]').attr('content', postData.excerpt);

    const backLink = postData.type === 'news' ? 'news.html' : 'blog.html';
    const sectionName = postData.type === 'news' ? 'News' : 'Blog';
    const backInner = `<span class="back-arrow">←</span><span class="back-text">Back to ${sectionName}</span>`;
    // Use the template's single unified back button; never emit multiple.
    $('.unified-back-btn').attr('href', backLink).html(backInner);
    $('#dynamic-back-btn').remove();
    $('.pwa-page-back-link').not('.unified-back-btn').remove();

    const categoryName = postData.type === 'news' ? 'Tech Radar' : 'Deep Insights';
    const headerHtml = `<div class="flex items-center gap-3 text-sm font-bold text-blue-600 uppercase tracking-wider mb-4"><span>${categoryName}</span><span class="text-gray-300">|</span><span class="text-gray-500"><i class="far fa-calendar-alt"></i> ${postData.dateStr}</span></div><h1 class="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">${postData.title}</h1><div class="flex items-center gap-4 text-gray-600 font-medium"><div class="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg"><i class="fas fa-user-edit"></i></div><div class="text-gray-900 font-bold">${postData.author}<div class="text-xs text-gray-400">Staff Writer</div></div></div>`;
    $('#article-header').html(headerHtml);

    $('#article-content').removeClass('text-center text-gray-400 py-10').html(marked.parse(mdWithImg));

    $('script').each((i, el) => {
        const scriptText = $(el).html();
        if (scriptText && scriptText.includes('获取并渲染文章正文的逻辑')) {
            $(el).html(scriptText.split('// 获取并渲染文章正文的逻辑')[0]);
        }
    });

    const staticFileName = `${postData.type}-${postData.timestamp}.html`;
    const staticPath = path.join(ARTICLE_PAGES_DIR, staticFileName);
    fs.writeFileSync(staticPath, $.html(), 'utf8');
    console.log(`[Amber V8] ✅ 静态网页装配成功: article-pages/${staticFileName}`);

    return {
        ...postData,
        id: postData.timestamp.toString(),
        category: categoryName,
        contentFile: fileName,
        staticHtmlFile: `article-pages/${staticFileName}`
    };
}

function publishAndSEO(postMeta) {
    let posts = [];
    if (fs.existsSync(POSTS_JSON_PATH)) try { posts = JSON.parse(fs.readFileSync(POSTS_JSON_PATH, 'utf8')); } catch(e){}
    posts.unshift({ id: postMeta.id, type: postMeta.type, title: postMeta.title, category: postMeta.category, date: postMeta.dateStr, author: postMeta.author, excerpt: postMeta.excerpt, contentFile: postMeta.contentFile });
    fs.writeFileSync(POSTS_JSON_PATH, JSON.stringify(posts, null, 4), 'utf8');

    // 1. 生成 Sitemap (供 Google SEO)
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://www.goreportify.com/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
    
    // 2. 🚀 新增：生成标准 RSS 订阅源 (供 Make.com 和 Substack 分发)
    let rss = `<?xml version="1.0" encoding="UTF-8" ?>\n<rss version="2.0">\n<channel>\n  <title>Reportify AI Insights</title>\n  <link>https://www.goreportify.com</link>\n  <description>Latest tech insights and PM strategies</description>\n`;

    posts.forEach(p => {
        sitemap += `  <url>\n    <loc>https://www.goreportify.com/article-pages/${p.type}-${p.id}.html</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
        
        // 转换时间格式以符合 RSS 标准
        const pubDate = new Date(parseInt(p.id)).toUTCString();
        rss += `  <item>\n    <title><![CDATA[${p.title}]]></title>\n    <link>https://www.goreportify.com/article-pages/${p.type}-${p.id}.html</link>\n    <description><![CDATA[${p.excerpt}]]></description>\n    <pubDate>${pubDate}</pubDate>\n  </item>\n`;
    });
    
    sitemap += '</urlset>';
    rss += `</channel>\n</rss>`;
    
    fs.writeFileSync(path.join(REPO_DIR, 'sitemap.xml'), sitemap, 'utf8');
    fs.writeFileSync(path.join(REPO_DIR, 'rss.xml'), rss, 'utf8'); // 保存 RSS 文件

    const robots = `User-agent: *\nAllow: /\nAllow: /images/\nAllow: /content/\nAllow: /article-pages/\nSitemap: https://www.goreportify.com/sitemap.xml\n`;
    fs.writeFileSync(path.join(REPO_DIR, 'robots.txt'), robots, 'utf8');
}

/**
 * @param {'news'|'blog'} type
 * @param {{ skipPush?: boolean }} [options] skipPush=true：只生成文件并更新 posts.json，不 git push（供每日批处理一次推送）
 */
async function runEngine(type, options = {}) {
    const skipPush = options.skipPush === true;
    const rawData = await generateArticle(type);
    if (!rawData) return;
    const postMeta = await buildStaticPage(rawData);
    publishAndSEO(postMeta);

    if (skipPush) return;

    try {
        execSync(`git add . && git commit -m "feat(UX): Auto-gen ${type} - ${postMeta.id}" && git pull origin main --rebase && git push origin main`, { cwd: REPO_DIR });
        console.log(`[Amber V8] 🚀 物理文件已推送 GitHub，Netlify 即刻开始构建全站！`);
    } catch (e) { console.error("[Amber V8] ❌ GitHub 推送失败: ", e.message); }
}

/** 每日一篇新闻 + 一篇博客，最后只 push 一次 → Netlify 每日约一次构建 */
async function runDailyBatch() {
    const noGitPush = process.env.AMBER_NO_GIT_PUSH === '1' || process.env.AMBER_NO_GIT_PUSH === 'true';
    console.log('[Amber V8] 📅 Daily batch: news → blog' + (noGitPush ? ' (no git push — self-host / Nginx)' : ' (single git push)'));
    await runEngine('news', { skipPush: true });
    await runEngine('blog', { skipPush: true });
    if (noGitPush) {
        console.log('[Amber V8] ✅ Files written under repo; Nginx serves this directory — no Netlify build.');
        return;
    }
    try {
        const stamp = Date.now();
        execSync(
            `git add . && git commit -m "feat(UX): Auto-gen daily news+blog - ${stamp}" && git pull origin main --rebase && git push origin main`,
            { cwd: REPO_DIR }
        );
        console.log('[Amber V8] 🚀 Daily batch pushed once; Netlify builds once.');
    } catch (e) {
        console.error('[Amber V8] ❌ GitHub 推送失败 (daily batch): ', e.message);
    }
}

console.log('🚀 Reportify AI - 终极版 V8.6 引擎已激活 (每日美国东部 9:00 新闻+博客 & RSS) !');
if (process.env.AMBER_DISABLE_CRON !== '1' && process.env.AMBER_DISABLE_CRON !== 'true') {
    cron.schedule(
        '0 9 * * *',
        () => {
            runDailyBatch().catch((err) => console.error('[Amber V8] ❌ Daily batch:', err));
        },
        { timezone: 'America/New_York' }
    );
    console.log('[Amber V8] ⏰ Built-in cron ON: `0 9 * * *` timezone=America/New_York (one news + one blog per trigger).');
} else {
    console.log('[Amber V8] ⏸ Built-in cron disabled (AMBER_DISABLE_CRON=1). Use systemd/crontab + tools/run-amber-daily-once.cjs');
}
module.exports = { runEngine, runDailyBatch };
