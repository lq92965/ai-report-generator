require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_DIR = __dirname;
const CONTENT_DIR = path.join(REPO_DIR, 'content');

// 🌟 为您精选的 5 张顶级高清硅谷风/AI/数据可视化永久图片 🌟
const PREMIUM_IMAGES = [
    "https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=1200&auto=format&fit=crop", // 绝美 AI 大脑发光图
    "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1200&auto=format&fit=crop", // 高级科技主板/芯片
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop", // 全球化商业网络/地球
    "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop", // 核心处理器/极客风
    "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1200&auto=format&fit=crop"  // 矩阵代码瀑布/黑客风
];

function healOldImagesLightning() {
    console.log("⚡ 启动闪电置换协议：丢弃破损链接，注入顶级高清静态大图...");
    const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
    let fixedCount = 0;

    for (const file of files) {
        const filePath = path.join(CONTENT_DIR, file);
        let content = fs.readFileSync(filePath, 'utf8');

        // 匹配那个该死的被封杀的网址
        const imgRegex = /([^"]+pollinations\.ai[^"]+)/i;
        
        if (imgRegex.test(content)) {
            console.log(`\n🔍 发现破损文件: ${file}`);
            
            // 随机抽取一张顶级图片
            const randomPremiumImage = PREMIUM_IMAGES[Math.floor(Math.random() * PREMIUM_IMAGES.length)];
            
            // 瞬间替换！
            content = content.replace(imgRegex, randomPremiumImage);
            fs.writeFileSync(filePath, content, 'utf8');
            
            console.log(`✅ 瞬间置换成功！已注入顶级科技插图。`);
            fixedCount++;
        }
    }

    console.log(`\n🎉 闪电修复结束！共成功拯救 ${fixedCount} 篇文章。`);
    
    if (fixedCount > 0) {
        console.log("🐙 正在将干净的代码推送到 GitHub，请稍候...");
        try {
            execSync('git add content/ && git commit -m "fix(images): Replace broken dynamic links with premium static URLs" && git pull origin main --rebase && git push origin main', { cwd: REPO_DIR });
            console.log("✅ GitHub 同步收官！请等待 1 分钟后刷新您的网站，所有旧文章将焕然一新！");
        } catch (e) {
            console.error("❌ GitHub 推送遇到问题，请手动检查。");
        }
    } else {
        console.log("✨ 扫描完毕，没有发现破损链接。");
    }
}

healOldImagesLightning();
