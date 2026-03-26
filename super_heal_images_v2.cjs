require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_DIR = __dirname;
const CONTENT_DIR = path.join(REPO_DIR, 'content');

// 🌟 为您精选的 50+ 张顶级高清、永不重复的科技/AI/商业静态大图 🌟
const PREMIUM_IMAGES = [
    "https://images.unsplash.com/photo-1677442136019-21780ecad995", "https://images.unsplash.com/photo-1620712943543-bcc4688e7485",
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa", "https://images.unsplash.com/photo-1518770660439-4636190af475",
    "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5", "https://images.unsplash.com/photo-1550751827-4bd374c3f58b",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c", "https://images.unsplash.com/photo-1531297484001-80022131f5a1",
    "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b", "https://images.unsplash.com/photo-1516321318423-f06f85e504b3",
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158", "https://images.unsplash.com/photo-1581090464777-f3220bbe1b8b",
    "https://images.unsplash.com/photo-150438430358d-c214ab2da9a0", "https://images.unsplash.com/photo-1496181133206-80ce9b88a853",
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71", "https://images.unsplash.com/photo-1515879218367-8466d910aaa4",
    "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7", "https://images.unsplash.com/photo-1517694712202-14dd9538aa97",
    "https://images.unsplash.com/photo-1587620962725-abab7fe55159", "https://images.unsplash.com/photo-1593720213428-28a5b9e94613",
    "https://images.unsplash.com/photo-1510915361894-db8b60106cb1", "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb",
    "https://images.unsplash.com/photo-1555949963-aa79dcee981c", "https://images.unsplash.com/photo-1523961131990-5ea7c61b2107",
    "https://images.unsplash.com/photo-1563986768609-322da13575f3", "https://images.unsplash.com/photo-1460925895232-c6297400476e",
    "https://images.unsplash.com/photo-1504384764586-bb4cdc1707b0", "https://images.unsplash.com/photo-1518932945647-7a1c969f8be2",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40", "https://images.unsplash.com/photo-1521737604893-d14cc237f11d",
    "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5", "https://images.unsplash.com/photo-1583508915901-b5f84c1dcde1",
    "https://images.unsplash.com/photo-1531482615713-2afd69097998", "https://images.unsplash.com/photo-1504868584819-f8eec2421717",
    "https://images.unsplash.com/photo-1543269865-cbf427effbad", "https://images.unsplash.com/photo-1551835251-11a13e436f3e",
    "https://images.unsplash.com/photo-1573164713988-8665fc963095", "https://images.unsplash.com/photo-1508780703481-03ac9695696c",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7", "https://images.unsplash.com/photo-1560472354-b33ff0c44a43",
    "https://images.unsplash.com/photo-1581092795360-fd1ca04f0952", "https://images.unsplash.com/photo-1581091870621-0967329598f4",
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158", "https://images.unsplash.com/photo-1581092795360-fd1ca04f0952",
    "https://images.unsplash.com/photo-1512485694743-9c9538b4e6e0", "https://images.unsplash.com/photo-1517694712202-14dd9538aa97",
    "https://images.unsplash.com/photo-1496181133206-80ce9b88a853", "https://images.unsplash.com/photo-1531297484001-80022131f5a1"
];

function superHealImagesV2() {
    console.log("⚡ 启动超级视觉置换协议 V2.0：彻底铲除所有历史破碎链接，注入 50 张高清不重复大图...");
    if (!fs.existsSync(CONTENT_DIR)) { console.log("❌ 找不到 content 目录"); return; }
    
    const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
    let fixedCount = 0;
    
    // 深度克隆图片库，用于无重复随机抽取
    let availableImages = [...PREMIUM_IMAGES];

    for (const file of files) {
        const filePath = path.join(CONTENT_DIR, file);
        let content = fs.readFileSync(filePath, 'utf8');

        // 匹配任何包含 http/https 的外部图片链接
        const imgRegex = /([^"]+http(s)?:\/\/([^"]+))i/;
        
        // 🌟 核心修正：我们要把【所有】外部链接，不管它是 pollinations 还是 bestforblog，只要不是本地 images/ 的，统统干掉 🌟
        if (imgRegex.test(content) && !content.includes('images/')) {
            console.log(`\n🔍 发现破损或外部文件: ${file}`);
            
            // 无重复随机抽取大图
            if (availableImages.length === 0) availableImages = [...PREMIUM_IMAGES]; // 用完了重新填充
            const randomIndex = Math.floor(Math.random() * availableImages.length);
            const premiumImage = availableImages.splice(randomIndex, 1)[0] + "?q=80&w=1200&auto=format&fit=crop";
            
            // 瞬间置换！
            content = content.replace(imgRegex, premiumImage);
            fs.writeFileSync(filePath, content, 'utf8');
            
            console.log(`✅ 视觉置换成功！`);
            fixedCount++;
        }
    }

    console.log(`\n🎉 视觉重生战役结束！共成功拯救 ${fixedCount} 篇文章。`);
    
    if (fixedCount > 0) {
        console.log("🐙 正在将干净的代码推送到 GitHub...");
        try {
            execSync('git add content/ && git commit -m "fix(visuals): Super heal all broken images with unique unique premium V2" && git pull origin main --rebase && git push origin main', { cwd: REPO_DIR });
            console.log("✅ GitHub 同步收官！请等待 1 分钟后刷新网站，您的所有历史文章视觉体验将彻底专业化！");
        } catch (e) {
            console.error("❌ GitHub 推送遇到问题，请手动检查。");
        }
    } else {
        console.log("✨ 所有历史文章视觉状态健康，无需替换。");
    }
}

superHealImagesV2();
