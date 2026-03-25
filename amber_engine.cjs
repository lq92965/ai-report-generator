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

const FAKE_AUTHORS = [
    "Alex Mercer", "Sarah Jenkins", "Michael Chen", "Emily Rostova", 
    "David Sterling", "Jessica Tran", "Marcus Webb", "Olivia Thorne"
];

// --- 阶段 1：撰写深度长文 ---
async function generateArticle(type) {
    const useGemini = (type === 'blog');
    const apiUrl = useGemini ? process.env.GEMINI_API_URL : process.env.DEEPSEEK_API_URL;
    const apiKey = useGemini ? process.env.GEMINI_API_KEY : process.env.DEEPSEEK_API_KEY;
    const aiModel = useGemini ? process.env.GEMINI_MODEL : process.env.DEEPSEEK_MODEL;
    const modelNameDisplay = useGemini ? "Gemini 2.5 Pro" : "DeepSeek";

    console.log(`\n[Amber] 🧠 正在唤醒 ${modelNameDisplay} 撰写 ${type} 长文...`);
    
    const systemPrompt = type === 'news' 
        ? "You are an elite Silicon Valley tech journalist. Write a breaking news analysis about AI, SaaS, or tech finance. Format in standard Markdown."
        : "You are a top-tier Project Management expert. Write an actionable blog post about workplace efficiency and PM tools. Format in standard Markdown.";
    
    const userPrompt = type === 'news'
        ? "Write a tech news article about enterprise AI adoption. First line must be the title starting with '# '. Output ONLY raw markdown."
        : "Write a deep-dive blog post about overcoming reporting fatigue using AI. First line must be the title starting with '# '. Output ONLY raw markdown.";

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
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });

        let rawMarkdown = response.data.choices[0].message.content.trim();
        let titleMatch = rawMarkdown.match(/^#\s+(.+)$/m);
        let title = titleMatch ? titleMatch[1].trim() : `Reportify ${type.toUpperCase()} Insights`;
        let contentMarkdown = rawMarkdown.replace(/^#\s+(.+)$/m, '').trim();

        // 修复图片不显示的 Bug：严格过滤特殊字符，并改用 HTML 强行植入
        const safePrompt = title.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 40);
        const imagePrompt = encodeURIComponent(`Professional abstract tech business concept, high quality, ${safePrompt}`);
        const aiImageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?width=1200&height=600&nologo=true`;
        
        contentMarkdown = `<img src="${aiImageUrl}" alt="${safePrompt}" style="width:100%; border-radius:8px; margin-bottom:20px;">\n\n` + contentMarkdown;
        
        let excerpt = contentMarkdown.replace(/<[^>]*>?/gm, '').replace(/[#*`>\[\]]/g, '').substring(0, 150).trim() + "...";
        let author = FAKE_AUTHORS[Math.floor(Math.random() * FAKE_AUTHORS.length)];

        return { title, contentMarkdown, excerpt, author };
    } catch (error) {
        console.error(`[Amber] ❌ 长文生成失败:`, error.message);
        return null;
    }
}

// --- 阶段 2：社媒大脑 (生成多平台定制文案) ---
async function generateSocialCopies(title, excerpt) {
    console.log(`[Amber] 🎭 正在为多平台(Reddit/X/LinkedIn)定制不同人设的专属文案...`);
    const apiUrl = process.env.GEMINI_API_URL; 
    const apiKey = process.env.GEMINI_API_KEY;
    
    const prompt = `Based on this article title: "${title}" and excerpt: "${excerpt}", generate 3 social media posts tailored to different platforms.
    1. Reddit: Casual, frustrating personal story about work/meetings, complaining tone, no corporate buzzwords.
    2. LinkedIn: Highly professional, thought-provoking, uses bullet points, targeting PMs and executives.
    3. Twitter: Short, punchy, engaging hook, max 280 characters, with 2 hashtags.
    
    Respond ONLY with a valid JSON object strictly matching this format:
    {
      "redditCopy": "...",
      "linkedinCopy": "...",
      "twitterCopy": "..."
    }`;

    try {
        const response = await axios.post(apiUrl, {
            model: process.env.GEMINI_MODEL,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.8
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });

        const rawText = response.data.choices[0].message.content.trim();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (error) {
        console.error(`[Amber] ⚠️ 社媒文案定制失败，将降级使用默认摘要。`);
    }
    
    // 如果生成失败的降级方案
    return {
        redditCopy: `Man, dealing with this exact issue today. Thought this was an interesting read on how to fix it: ${title}`,
        linkedinCopy: `New insights on enterprise workflow: ${title}. We dive deep into the mechanics of productivity. Thoughts?`,
        twitterCopy: `Just published: ${title}. A must-read for PMs looking to scale efficiency! 🚀 #AI #SaaS`
    };
}

// --- 阶段 3：保存与推送逻辑 ---
function publishPost(type, title, contentMarkdown, excerpt, author) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });

    const timestamp = Date.now();
    const dateObj = new Date();
    const dateStr = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
    
    const fileName = `${type}-${timestamp}.md`;
    fs.writeFileSync(path.join(CONTENT_DIR, fileName), contentMarkdown, 'utf8');

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

function pushToGitHub() {
    try {
        execSync('git add . && git commit -m "feat(content): Auto-publish" && git pull origin main --rebase && git push origin main', { cwd: REPO_DIR });
        return true;
    } catch (e) {
        console.error("[Amber] ❌ 推送失败");
        return false;
    }
}

// --- 阶段 4：触发 Make.com 携带所有定制文案 ---
async function triggerMakeWebhook(postData, socialCopies) {
    if (!MAKE_WEBHOOK_URL) return;
    try {
        const articleUrl = `https://www.goreportify.com/article.html?id=${postData.timestamp}`;
        await axios.post(MAKE_WEBHOOK_URL, {
            title: postData.title,
            url: articleUrl,
            // 默认通用文本防错
            text: `${socialCopies.redditCopy}\n\n👉 Read more: ${articleUrl}`,
            // 极其强大的细分平台专属文案
            redditText: `${socialCopies.redditCopy}\n\nAnyway, found this detailed breakdown here if anyone is in the same boat: ${articleUrl}`,
            linkedinText: `${socialCopies.linkedinCopy}\n\nRead the full insight here: ${articleUrl}`,
            twitterText: `${socialCopies.twitterCopy} ${articleUrl}`
        });
        console.log("[Amber] ✅ 多重人格社媒包已发射至 Make.com！");
    } catch (error) {
        console.error("[Amber] ❌ 触发 Make.com 失败");
    }
}

async function runEngine(type) {
    const data = await generateArticle(type);
    if (data) {
        const socialCopies = await generateSocialCopies(data.title, data.excerpt);
        const postMeta = publishPost(type, data.title, data.contentMarkdown, data.excerpt, data.author);
        if (pushToGitHub()) {
            await triggerMakeWebhook(postMeta, socialCopies);
        }
    }
}

console.log("🚀 Reportify AI - V3 多重人格增长引擎已挂载！");
cron.schedule('0 * * * *', () => runEngine('blog'));
cron.schedule('30 * * * *', () => runEngine('news'));
