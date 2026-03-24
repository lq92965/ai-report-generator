require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const { execSync } = require('child_process');

// 动态路径配置（指向当前仓库目录）
const REPO_DIR = __dirname;
const DATA_DIR = path.join(REPO_DIR, 'data');
const CONTENT_DIR = path.join(REPO_DIR, 'content');
const POSTS_JSON_PATH = path.join(DATA_DIR, 'posts.json');

// --- 步骤 1：让琥珀构思并生成文章 (双核大脑调度) ---
async function generateArticle(type) {
    // 智能调度：News 用 DeepSeek，Blog 用 Gemini 2.5 Pro
    const useGemini = (type === 'blog');
    const apiUrl = useGemini ? process.env.GEMINI_API_URL : process.env.DEEPSEEK_API_URL;
    const apiKey = useGemini ? process.env.GEMINI_API_KEY : process.env.DEEPSEEK_API_KEY;
    const aiModel = useGemini ? process.env.GEMINI_MODEL : process.env.DEEPSEEK_MODEL;
    const modelNameDisplay = useGemini ? "Gemini 2.5 Pro" : "DeepSeek";

    console.log(`\n[Amber] 🧠 正在唤醒 ${modelNameDisplay} 构思 ${type} 内容...`);
    
    // 设定角色和系统提示词 (强制输出全英文专业内容)
    const systemPrompt = type === 'news' 
        ? "You are an elite Silicon Valley tech journalist. Write a breaking news analysis about AI, SaaS, or tech finance. Format in standard Markdown. Be professional, objective, and highly insightful."
        : "You are a top-tier Project Management expert and Productivity Coach. Write a highly actionable blog post about workplace efficiency, PM tools, or leadership. Format in standard Markdown. Use a professional yet engaging tone.";
    
    const userPrompt = type === 'news'
        ? "Write a fresh, realistic tech news article about recent AI funding, a new model release, or enterprise AI adoption. Include a catchy title starting with a single '#' on the first line. Output ONLY the raw markdown text."
        : "Write a deep-dive blog post about overcoming daily reporting fatigue using AI automation or structured thinking. Include a catchy title starting with a single '#' on the first line. Output ONLY the raw markdown text.";

    try {
        const response = await axios.post(apiUrl, {
            model: aiModel,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        let rawMarkdown = response.data.choices[0].message.content.trim();
        
        // 提取标题 (匹配第一行的 # 标题)
        let titleMatch = rawMarkdown.match(/^#\s+(.+)$/m);
        let title = titleMatch ? titleMatch[1].trim() : `Reportify ${type.toUpperCase()} Update`;
        
        // 清除正文中的第一行 H1 标题，避免网页渲染重复
        let contentMarkdown = rawMarkdown.replace(/^#\s+(.+)$/m, '').trim();

        // 提取前 150 个字符作为外置卡片摘要 (去除 markdown 符号)
        let excerpt = contentMarkdown.replace(/[#*`>]/g, '').substring(0, 150).trim() + "...";

        return { title, contentMarkdown, excerpt };
    } catch (error) {
        console.error(`[Amber] ❌ ${modelNameDisplay} 生成接口调用失败:`, error.message);
        if (error.response) {
            console.error("错误详情:", error.response.data);
        }
        return null;
    }
}

// --- 步骤 2：生成 Markdown 文件并写入 posts.json 数据库 ---
function publishPost(type, title, contentMarkdown, excerpt) {
    console.log(`[Amber] 📝 正在将内容写入本地文件系统...`);
    
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
        } catch (e) {
            console.log("[Amber] posts.json 解析为空或错误，将创建新数组。");
        }
    }

    const newPost = {
        id: timestamp.toString(),
        type: type,
        title: title,
        category: type === 'news' ? 'Tech Radar' : 'PM Guide',
        date: dateStr,
        excerpt: excerpt,
        contentFile: fileName
    };

    posts.unshift(newPost);
    fs.writeFileSync(POSTS_JSON_PATH, JSON.stringify(posts, null, 4), 'utf8');

    console.log(`[Amber] ✅ 文件写入成功: ${fileName}`);
}

// --- 步骤 3：推送到 GitHub 以触发 Netlify 自动部署 ---
function pushToGitHub() {
    try {
        console.log("[Amber] 🚀 正在同步至 GitHub (触发 Netlify 发布)...");
        execSync('git pull origin main --rebase', { cwd: REPO_DIR, stdio: 'ignore' });
        execSync('git add .', { cwd: REPO_DIR, stdio: 'ignore' });
        execSync(`git commit -m "feat(content): Auto-publish ${new Date().toISOString()}"`, { cwd: REPO_DIR, stdio: 'ignore' });
        execSync('git push origin main', { cwd: REPO_DIR, stdio: 'ignore' });
        console.log("[Amber] 🎉 推送成功！前端页面即将在几十秒内更新。");
    } catch (error) {
        console.error("[Amber] ❌ 推送 GitHub 失败，请检查 Git 免密 Token 配置！");
    }
}

// --- 引擎总调度 ---
async function runEngine(type) {
    const articleData = await generateArticle(type);
    if (articleData) {
        publishPost(type, articleData.title, articleData.contentMarkdown, articleData.excerpt);
        pushToGitHub();
    }
}

// ==========================================
// 琥珀的生物钟 (Cron 定时任务)
// ==========================================

console.log("=================================================");
console.log("🚀 Reportify AI - 琥珀双核发稿引擎已挂载！");
console.log("🧠 策略：News -> DeepSeek | Blog -> Gemini 2.5 Pro");
console.log("⏳ 调度：Blog (每小时 0 分) | News (每小时 30 分)");
console.log("=================================================");

// Blog：每小时的第 0 分钟执行 (调用 Gemini)
cron.schedule('0 * * * *', () => {
    runEngine('blog');
});

// News：每小时的第 30 分钟执行 (调用 DeepSeek)
cron.schedule('30 * * * *', () => {
    runEngine('news');
});

// ==========================================
// 首次运行测试 (立即发一篇 News 测试连通性)
// ==========================================
console.log("\n[Amber] 执行首次唤醒自检测试...");
runEngine('news');
