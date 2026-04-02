require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const { execSync } = require('child_process');
const imageDownloader = require('image-downloader');
const cheerio = require('cheerio');
const { marked } = require('marked');

const REPO_DIR = __dirname;
const DATA_DIR = path.join(REPO_DIR, 'data');
const CONTENT_DIR = path.join(REPO_DIR, 'content');
const IMAGES_DIR = path.join(REPO_DIR, 'images');
const POSTS_JSON_PATH = path.join(DATA_DIR, 'posts.json');
const TEMPLATE_PATH = path.join(REPO_DIR, 'article.html');
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true }); 

const FAKE_AUTHORS = ["Alex Mercer", "Sarah Jenkins", "Michael Chen", "Emily Rostova", "David Sterling", "Jessica Tran", "Marcus Webb", "Olivia Thorne"];

async function generateArticle(type) {
    const useGemini = (type === 'blog');
    const apiUrl = useGemini ? process.env.GEMINI_API_URL : process.env.DEEPSEEK_API_URL;
    const apiKey = useGemini ? process.env.GEMINI_API_KEY : process.env.DEEPSEEK_API_KEY;
    const aiModel = useGemini ? process.env.GEMINI_MODEL : process.env.DEEPSEEK_MODEL;

    console.log(`\n[Amber V8] 🧠 正在撰写 ${type}...`);
    const systemPrompt = type === 'news' ? "You are an elite Tech Journalist. Write a news analysis. Format in standard Markdown." : "You are a PM expert. Write a blog post about workplace efficiency. Format in standard Markdown.";
    const userPrompt = type === 'news' ? "Write a tech news article about AI. First line must be '# Title'. Output ONLY raw markdown." : "Write a deep-dive post about overcoming reporting fatigue. First line must be '# Title'. Output ONLY raw markdown.";

    try {
        const response = await axios.post(apiUrl, { model: aiModel, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], temperature: 0.7, max_tokens: 2500 }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
        let rawMarkdown = response.data.choices[0].message.content.trim();
        let titleMatch = rawMarkdown.match(/^#\s+(.+)$/m);
        let title = titleMatch ? titleMatch[1].trim() : `Reportify ${type.toUpperCase()} Insights`;
        let contentMarkdown = rawMarkdown.replace(/^#\s+(.+)$/m, '').trim();
        const safePrompt = title.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 40);
        const excerpt = contentMarkdown.replace(/<[^>]*>?/gm, '').replace(/[#*`>\[\]]/g, '').substring(0, 150).trim() + "...";
        
        const remoteUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt)}?width=1200&height=600&nologo=true`;
        const timestamp = Date.now();
        const imageFileName = `cover-${timestamp}.png`;
        let localImageRelPath = `images/${imageFileName}`;
        try {
            await imageDownloader.image({ url: remoteUrl, dest: path.join(IMAGES_DIR, imageFileName) });
        } catch(e) { localImageRelPath = "https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=1200&auto=format&fit=crop"; }

        return { timestamp, type, title, contentMarkdown, excerpt, author: FAKE_AUTHORS[Math.floor(Math.random() * FAKE_AUTHORS.length)], localImageRelPath, dateStr: new Date().toISOString().split('T')[0] };
    } catch (e) { console.error(`[Amber V8] ❌ 大脑生成失败`); return null; }
}

async function generateSocialCopies(title, excerpt) {
    return { redditCopy: `Dealing with this exact issue today: ${title}`, linkedinCopy: `New enterprise workflow insights: ${title}`, twitterCopy: `Just published: ${title} #AI #SaaS` };
}

function buildStaticPage(postData) {
    console.log(`[Amber V8] ⚡ 正在为谷歌爬虫焊装纯静态独立网页...`);
    const fileName = `${postData.type}-${postData.timestamp}.md`;
    const mdWithImg = `<img src="${postData.localImageRelPath}" alt="${postData.title.replace(/"/g, "'")}" style="width:100%; border-radius:12px; margin-bottom:2rem; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">\n\n` + postData.contentMarkdown;
    fs.writeFileSync(path.join(CONTENT_DIR, fileName), mdWithImg, 'utf8');

    const templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const $ = cheerio.load(templateHtml);

    $('title').text(`${postData.title} - Reportify AI`);
    $('meta[name="description"]').attr('content', postData.excerpt);
    
    const backLink = postData.type === 'news' ? 'news.html' : 'blog.html';
    const backInner = '<i data-lucide="arrow-left" class="pwa-page-back-icon" aria-hidden="true"></i><span>Previous Page</span>';
    $('#dynamic-back-btn').attr('href', backLink).html(backInner);

    const categoryName = postData.type === 'news' ? 'Tech Radar' : 'Deep Insights';
    const headerHtml = `<div class="flex items-center gap-3 text-sm font-bold text-blue-600 uppercase tracking-wider mb-4"><span>${categoryName}</span><span class="text-gray-300">|</span><span class="text-gray-500"><i class="far fa-calendar-alt"></i> ${postData.dateStr}</span></div><h1 class="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">${postData.title}</h1><div class="flex items-center gap-4 text-gray-600 font-medium"><div class="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg"><i class="fas fa-user-edit"></i></div><div><div class="text-gray-900 font-bold">${postData.author}</div><div class="text-xs text-gray-400">Staff Writer</div></div></div>`;
    $('#article-header').html(headerHtml);

    $('#article-content').removeClass('text-center text-gray-400 py-10').html(marked.parse(mdWithImg));

    $('script').each((i, el) => {
        const scriptText = $(el).html();
        if (scriptText && scriptText.includes('获取并渲染文章正文的逻辑')) {
            $(el).html(scriptText.split('// 获取并渲染文章正文的逻辑')[0]);
        }
    });

    const staticFileName = `${postData.type}-${postData.timestamp}.html`;
    fs.writeFileSync(path.join(REPO_DIR, staticFileName), $.html(), 'utf8');
    console.log(`[Amber V8] ✅ 静态网页装配成功: ${staticFileName}`);
    
    return { ...postData, id: postData.timestamp.toString(), category: categoryName, contentFile: fileName, staticHtmlFile: staticFileName };
}

function publishAndSEO(postMeta) {
    let posts = [];
    if (fs.existsSync(POSTS_JSON_PATH)) try { posts = JSON.parse(fs.readFileSync(POSTS_JSON_PATH, 'utf8')); } catch(e){}
    posts.unshift({ id: postMeta.id, type: postMeta.type, title: postMeta.title, category: postMeta.category, date: postMeta.dateStr, author: postMeta.author, excerpt: postMeta.excerpt, contentFile: postMeta.contentFile });
    fs.writeFileSync(POSTS_JSON_PATH, JSON.stringify(posts, null, 4), 'utf8');

    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://www.goreportify.com/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
    posts.forEach(p => {
        sitemap += `  <url>\n    <loc>https://www.goreportify.com/${p.type}-${p.id}.html</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });
    sitemap += '</urlset>';
    fs.writeFileSync(path.join(REPO_DIR, 'sitemap.xml'), sitemap, 'utf8');
    
    const robots = `User-agent: *\nAllow: /\nAllow: /images/\nAllow: /content/\n\nSitemap: https://www.goreportify.com/sitemap.xml\n`;
    fs.writeFileSync(path.join(REPO_DIR, 'robots.txt'), robots, 'utf8');
}

async function runEngine(type) {
    const rawData = await generateArticle(type);
    if (!rawData) return;
    const postMeta = buildStaticPage(rawData); 
    publishAndSEO(postMeta); 
    const socialCopies = await generateSocialCopies(postMeta.title, postMeta.excerpt);
    
    try {
        execSync('git add . && git commit -m "feat(UX): V8 engine perfect back button mapping" && git pull origin main --rebase && git push origin main', { cwd: REPO_DIR });
        if (MAKE_WEBHOOK_URL) {
            const staticArticleUrl = `https://www.goreportify.com/${postMeta.staticHtmlFile}`;
            await axios.post(MAKE_WEBHOOK_URL, {
                title: postMeta.title, url: staticArticleUrl, text: `${socialCopies.redditCopy}\n\n👉 Read more: ${staticArticleUrl}`, redditText: `${socialCopies.redditCopy}\n\nFound this breakdown: ${staticArticleUrl}`, linkedinText: `${socialCopies.linkedinCopy}\n\nRead the insight: ${staticArticleUrl}`, twitterText: `${socialCopies.twitterCopy.substring(0, 197)}... ${staticArticleUrl}`
            });
        }
    } catch (e) { console.error("[Amber V8] ❌ GitHub 推送失败"); }
}

console.log("🚀 Reportify AI - 终极 UX 修复版 V8 引擎已激活！");
cron.schedule('0 0,12 * * *', () => runEngine('blog')); 
cron.schedule('0 6,18 * * *', () => runEngine('news'));
