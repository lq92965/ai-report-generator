require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const { execSync } = require('child_process');
const imageDownloader = require('image-downloader');

const REPO_DIR = __dirname;
const DATA_DIR = path.join(REPO_DIR, 'data');
const CONTENT_DIR = path.join(REPO_DIR, 'content');
const IMAGES_DIR = path.join(REPO_DIR, 'images'); // 存放静态图片
const POSTS_JSON_PATH = path.join(DATA_DIR, 'posts.json');
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true }); 

const FAKE_AUTHORS = [
    "Alex Mercer", "Sarah Jenkins", "Michael Chen", "Emily Rostova", 
    "David Sterling", "Jessica Tran", "Marcus Webb", "Olivia Thorne"
];

// --- 阶段 1：生成长文 ---
async function generateArticle(type) {
    const useGemini = (type === 'blog');
    const apiUrl = useGemini ? process.env.GEMINI_API_URL : process.env.DEEPSEEK_API_URL;
    const apiKey = useGemini ? process.env.GEMINI_API_KEY : process.env.DEEPSEEK_API_KEY;
    const aiModel = useGemini ? process.env.GEMINI_MODEL : process.env.DEEPSEEK_MODEL;

    console.log(`\n[Amber V6] 🧠 唤醒大模型撰写 ${type}...`);
    
    const systemPrompt = type === 'news' 
        ? "You are an elite Silicon Valley tech journalist. Write a breaking news analysis about AI, SaaS, or tech finance. Format in standard Markdown."
        : "You are a top-tier Project Management expert. Write an actionable blog post about workplace efficiency and PM tools. Format in standard Markdown.";
    
    const userPrompt = type === 'news'
        ? "Write a tech news article about enterprise AI adoption. First line must be the title starting with '# '. Output ONLY raw markdown."
        : "Write a deep-dive blog post about overcoming reporting fatigue using AI. First line must be the title starting with '# '. Output ONLY raw markdown.";

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

        const safePromptForImage = title.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 40);
        const excerpt = contentMarkdown.replace(/<[^>]*>?/gm, '').replace(/[#*`>\[\]]/g, '').substring(0, 150).trim() + "...";
        const author = FAKE_AUTHORS[Math.floor(Math.random() * FAKE_AUTHORS.length)];

        return { title, contentMarkdown, excerpt, author, safePromptForImage };
    } catch (error) {
        console.error(`[Amber V6] ❌ 生成失败:`, error.message);
        return null;
    }
}

// --- 阶段 1.5：静态图片下载 ---
async function generateAndDownloadImage(timestamp, safePromptForImage) {
    const imagePrompt = encodeURIComponent(`Professional abstract tech business concept, high quality, ${safePromptForImage}`);
    const remoteImageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?width=1200&height=600&nologo=true`;
    const imageFileName = `cover-${timestamp}.png`;
    const localImagePath = path.join(IMAGES_DIR, imageFileName);

    console.log(`[Amber V6] 🌐 下载静态图片至服务器...`);
    try {
        await imageDownloader.image({ url: remoteImageUrl, dest: localImagePath });
        return `images/${imageFileName}`; 
    } catch (e) {
        console.error('[Amber V6] ⚠️ 图片下载失败，使用占位图。');
        return "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop"; 
    }
}

// --- 阶段 2：社媒文案 ---
async function generateSocialCopies(title, excerpt) {
    const apiUrl = process.env.GEMINI_API_URL; 
    const apiKey = process.env.GEMINI_API_KEY;
    const prompt = `Based on this article title: "${title}" and excerpt: "${excerpt}", generate 3 social media posts.
    1. Reddit: Casual, complaining tone about work.
    2. LinkedIn: Professional, uses bullet points.
    3. Twitter: Short, STRICTLY UNDER 200 characters, 2 hashtags.
    Respond ONLY with a valid JSON: { "redditCopy": "...", "linkedinCopy": "...", "twitterCopy": "..." }`;

    try {
        const response = await axios.post(apiUrl, {
            model: process.env.GEMINI_MODEL,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.8
        }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });

        const jsonMatch = response.data.choices[0].message.content.trim().match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (error) {}
    
    return {
        redditCopy: `Man, dealing with this issue: ${title}`,
        linkedinCopy: `New insights on enterprise workflow: ${title}`,
        twitterCopy: `Just published: ${title} #AI #SaaS`
    };
}

// --- 阶段 3：保存 Markdown ---
function publishPost(type, title, contentMarkdown, excerpt, author, localImageRelPath) {
    const timestamp = Date.now();
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `${type}-${timestamp}.md`;

    // 写入静态图片路径
    const mdContentWithImage = `<img src="${localImageRelPath}" alt="${title.replace(/"/g, "'")}" style="width:100%; border-radius:8px; margin-bottom:20px;">\n\n` + contentMarkdown;
    fs.writeFileSync(path.join(CONTENT_DIR, fileName), mdContentWithImage, 'utf8');

    let posts = [];
    if (fs.existsSync(POSTS_JSON_PATH)) {
        try { posts = JSON.parse(fs.readFileSync(POSTS_JSON_PATH, 'utf8')); } catch (e) {}
    }
    posts.unshift({
        id: timestamp.toString(), type: type, title: title, category: type === 'news' ? 'Tech Radar' : 'Deep Insights',
        date: dateStr, author: author, excerpt: excerpt, contentFile: fileName
    });
    fs.writeFileSync(POSTS_JSON_PATH, JSON.stringify(posts, null, 4), 'utf8');
    return { timestamp, title, excerpt };
}

// --- 阶段 3.5：生成 SEO Sitemap ---
function generateSEOFiles() {
    console.log(`[Amber V6] 🗺️ 生成谷歌 Sitemap 和 Robots.txt...`);
    if (!fs.existsSync(POSTS_JSON_PATH)) return;
    const posts = JSON.parse(fs.readFileSync(POSTS_JSON_PATH, 'utf8'));
    const baseUrl = 'https://www.goreportify.com';
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    sitemap += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
    posts.forEach(post => {
        sitemap += `  <url>\n    <loc>${baseUrl}/article.html?id=${post.id}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });
    sitemap += '</urlset>';
    fs.writeFileSync(path.join(REPO_DIR, 'sitemap.xml'), sitemap, 'utf8');

    const robots = `User-agent: *\nAllow: /\nAllow: /images/\nAllow: /content/\n\nSitemap: ${baseUrl}/sitemap.xml\n`;
    fs.writeFileSync(path.join(REPO_DIR, 'robots.txt'), robots, 'utf8');
}

// --- 推送 GitHub ---
function pushToGitHub() {
    try {
        console.log(`[Amber V6] 🐙 推送静态资源至 GitHub...`);
        execSync('git add images/ *.xml *.txt data/ content/ && git commit -m "feat(SEO): Auto-publish static images & sitemap" && git pull origin main --rebase && git push origin main', { cwd: REPO_DIR });
        return true;
    } catch (e) {
        console.error("[Amber V6] ❌ GitHub 推送失败");
        return false;
    }
}

// --- 阶段 4：触发 Make ---
async function triggerMakeWebhook(postData, socialCopies) {
    if (!MAKE_WEBHOOK_URL) return;
    try {
        const articleUrl = `https://www.goreportify.com/article.html?id=${postData.timestamp}`;
        let safeTwitterText = socialCopies.twitterCopy;
        if (safeTwitterText.length > 200) safeTwitterText = safeTwitterText.substring(0, 197) + "...";

        await axios.post(MAKE_WEBHOOK_URL, {
            title: postData.title, url: articleUrl,
            text: `${socialCopies.redditCopy}\n\n👉 Read more: ${articleUrl}`,
            redditText: `${socialCopies.redditCopy}\n\nFound this breakdown: ${articleUrl}`,
            linkedinText: `${socialCopies.linkedinCopy}\n\nRead the insight: ${articleUrl}`,
            twitterText: `${safeTwitterText} ${articleUrl}`
        });
        console.log("[Amber V6] ✅ 发射至 Make.com 完毕！");
    } catch (error) { console.error("[Amber V6] ❌ Make.com 触发失败"); }
}

// --- 引擎启动 ---
async function runEngine(type) {
    const data = await generateArticle(type);
    if (!data) return;
    const localImageRelPath = await generateAndDownloadImage(Date.now(), data.safePromptForImage);
    const socialCopies = await generateSocialCopies(data.title, data.excerpt);
    const postMeta = publishPost(type, data.title, data.contentMarkdown, data.excerpt, data.author, localImageRelPath);
    generateSEOFiles();
    if (pushToGitHub()) await triggerMakeWebhook(postMeta, socialCopies);
}

console.log("🚀 Reportify AI - 首席 V6 引擎 (静态图片防破碎 + SEO 强收录) 已激活！");
cron.schedule('0 0,12 * * *', () => runEngine('blog')); 
cron.schedule('0 6,18 * * *', () => runEngine('news'));
