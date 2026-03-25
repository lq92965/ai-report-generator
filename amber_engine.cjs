require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const { execSync } = require('child_process');

const REPO_DIR = __dirname;
const DATA_DIR = path.join(REPO_DIR, 'data');
const CONTENT_DIR = path.join(REPO_DIR, 'content');
const POSTS_JSON_PATH = path.join(DATA_DIR, 'posts.json');
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;

// --- 虚拟编辑部：逼真的英文记者/PM名字 ---
const FAKE_AUTHORS = [
    "Alex Mercer", "Sarah Jenkins", "Michael Chen", "Emily Rostova", 
    "David Sterling", "Jessica Tran", "Marcus Webb", "Olivia Thorne",
    "Julian Vance", "Chloe Bennett"
];

// --- 步骤 1：让琥珀构思并生成文章 ---
async function generateArticle(type) {
    const useGemini = (type === 'blog');
    const apiUrl = useGemini ? process.env.GEMINI_API_URL : process.env.DEEPSEEK_API_URL;
    const apiKey = useGemini ? process.env.GEMINI_API_KEY : process.env.DEEPSEEK_API_KEY;
    const aiModel = useGemini ? process.env.GEMINI_MODEL : process.env.DEEPSEEK_MODEL;
    const modelNameDisplay = useGemini ? "Gemini 2.5 Pro" : "DeepSeek";

    console.log(`\n[Amber] 🧠 正在唤醒 ${modelNameDisplay} 构思 ${type} 内容...`);
    
    const systemPrompt = type === 'news' 
        ? "You are an elite Silicon Valley tech journalist. Write a breaking news analysis about AI, SaaS, or tech finance. Format in standard Markdown. Ensure paragraphs are detailed and well-spaced. Use professional headings."
        : "You are a top-tier Project Management expert and Productivity Coach. Write a highly actionable blog post about workplace efficiency, PM tools, or leadership. Format in standard Markdown. Use professional headings and bullet points.";
    
    const userPrompt = type === 'news'
        ? "Write a fresh tech news article about enterprise AI adoption or recent tech funding. Include a catchy title starting with a single '#' on the first line. Output ONLY the raw markdown text."
        : "Write a deep-dive blog post about overcoming reporting fatigue using structured thinking. Include a catchy title starting with a single '#' on the first line. Output ONLY the raw markdown text.";

    try {
        const response = await axios.post(apiUrl, {
            model: aiModel,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 2500
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        let rawMarkdown = response.data.choices[0].message.content.trim();
        
        let titleMatch = rawMarkdown.match(/^#\s+(.+)$/m);
        let title = titleMatch ? titleMatch[1].trim() : `Reportify ${type.toUpperCase()} Insights`;
        let contentMarkdown = rawMarkdown.replace(/^#\s+(.+)$/m, '').trim();

        const imagePrompt = encodeURIComponent(`Professional abstract tech business concept, high quality, modern, ${title.substring(0, 50)}`);
        const aiImageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?width=1200&height=600&nologo=true`;
        
        contentMarkdown = `![Article Cover](${aiImageUrl})\n\n` + contentMarkdown;
        let excerpt = contentMarkdown.replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*`>]/g, '').substring(0, 160).trim() + "...";
        let author = FAKE_AUTHORS[Math.floor(Math.random() * FAKE_AUTHORS.length)];

        return { title, contentMarkdown, excerpt, author };
    } catch (error) {
        console.error(`[Amber] ❌ ${modelNameDisplay} 生成失败:`, error.message);
        return null;
    }
}

// --- 步骤 2：写入文件系统 ---
function publishPost(type, title, contentMarkdown, excerpt, author) {
    console.log(`[Amber] 📝 正在保存文件...`);
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });

    const timestamp = Date.now();
    const dateObj = new Date();
    const dateStr = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
    
    const fileName = `${type}-${timestamp}.md`;
    const filePath = path.join(CONTENT_DIR, fileName);

    fs.writeFileSync(filePath, contentMarkdown, 'utf8');

    let posts = [];
    if (fs.existsSync(POSTS_JSON_PATH)) {
        try {
            const rawData = fs.readFileSync(POSTS_JSON_PATH, 'utf8');
            if(rawData.trim() !== '') posts = JSON.parse(rawData);
        } catch (e) {}
    }

    const newPost = {
        id: timestamp.toString(),
        type: type,
        title: title,
        category: type === 'news' ? 'Tech Radar' : 'Deep Insights',
        date: dateStr,
        author: author,
        excerpt: excerpt,
        contentFile: fileName
    };

    posts.unshift(newPost);
    fs.writeFileSync(POSTS_JSON_PATH, JSON.stringify(posts, null, 4), 'utf8');
    console.log(`[Amber] ✅ 保存成功: ${fileName} (作者: ${author})`);
    
    return { timestamp, title, excerpt };
}

// --- 步骤 3：推送 GitHub ---
function pushToGitHub() {
    try {
        console.log("[Amber] 🚀 正在推送 GitHub...");
        execSync('git add .', { cwd: REPO_DIR });
        execSync(`git commit -m "feat(content): Auto-publish ${new Date().toISOString()}"`, { cwd: REPO_DIR });
        execSync('git pull origin main --rebase', { cwd: REPO_DIR });
        execSync('git push origin main', { cwd: REPO_DIR });
        console.log("[Amber] 🎉 推送成功！");
        return true;
    } catch (error) {
        console.error("[Amber] ❌ 推送失败，系统底层报错信息如下:");
        console.error(error.message);
        return false;
    }
}

// --- 步骤 4：触发 Make.com 自动发 Reddit (完美修复参数) ---
async function triggerMakeWebhook(postData) {
    if (!MAKE_WEBHOOK_URL) {
        console.log("[Amber] ⚠️ 未检测到 MAKE_WEBHOOK_URL，跳过 Reddit 同步。");
        return;
    }
    try {
        console.log("[Amber] 📡 正在触发 Make.com 推送 Reddit...");
        const articleUrl = `https://www.goreportify.com/article.html?id=${postData.timestamp}`;
        await axios.post(MAKE_WEBHOOK_URL, {
            title: postData.title,
            // 完美解决 "缺少 text 参数" 的报错，同时附加上官网链接实现引流
            text: `${postData.excerpt}\n\n👉 Read the full insight at: ${articleUrl}`,
            excerpt: postData.excerpt, 
            url: articleUrl
        });
        console.log("[Amber] ✅ Make.com Webhook 触发成功！");
    } catch (error) {
        console.error("[Amber] ❌ 触发 Make.com 失败:", error.message);
    }
}

async function runEngine(type) {
    const data = await generateArticle(type);
    if (data) {
        const postMeta = publishPost(type, data.title, data.contentMarkdown, data.excerpt, data.author);
        const pushed = pushToGitHub();
        if (pushed) {
            await triggerMakeWebhook(postMeta);
        }
    }
}

console.log("🚀 Reportify AI - 琥珀双核发稿引擎 (含 Make.com 联动) 已挂载！");
console.log("🧠 策略: News -> DeepSeek | Blog -> Gemini 2.5 Pro");
console.log("⏳ 调度: Blog (每小时 0 分) | News (每小时 30 分)");
console.log("==================================================");

cron.schedule('0 * * * *', () => runEngine('blog'));
cron.schedule('30 * * * *', () => runEngine('news'));
