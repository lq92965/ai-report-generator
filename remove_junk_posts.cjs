require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_DIR = __dirname;
const DATA_DIR = path.join(REPO_DIR, 'data');
const CONTENT_DIR = path.join(REPO_DIR, 'content');
const POSTS_JSON_PATH = path.join(DATA_DIR, 'posts.json');

// 🌟 极其精准的打击目标：最早期的测试垃圾 🌟
const JUNK_POST_IDS = ["1", "2", "3"]; 

function removeJunkPosts() {
    console.log(`\n[琥珀清理] 🛡️ 正在强行剥离早期测试乱码文章 (ID: 1, 2, 3)...`);

    if (!fs.existsSync(POSTS_JSON_PATH)) return;
    let posts = JSON.parse(fs.readFileSync(POSTS_JSON_PATH, 'utf8'));
    let originalCount = posts.length;
    
    // 1. 揪出要删除的物理文件名
    const postsToDelete = posts.filter(post => JUNK_POST_IDS.includes(post.id));
    const filesToDelete = postsToDelete.map(post => post.contentFile);
    
    // 2. 从数据索引中过滤掉垃圾 ID
    posts = posts.filter(post => !JUNK_POST_IDS.includes(post.id));
    
    if (posts.length !== originalCount) {
        // 3. 将干净的数据写回 posts.json
        fs.writeFileSync(POSTS_JSON_PATH, JSON.stringify(posts, null, 4), 'utf8');
        console.log("✅ data/posts.json 数据索引清理完毕。");

        // 4. 强行删除 content 目录下的对应物理文件
        filesToDelete.forEach(filename => {
            if (filename) {
                const filePath = path.join(CONTENT_DIR, filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`✅ 物理垃圾文件已铲除: ${filename}`);
                }
            }
        });

        // 5. 将清理后的干净版本同步提交 GitHub
        console.log("🐙 正在将干净的代码推送到 GitHub，请稍候...");
        try {
            execSync('git add data/ content/ && git commit -m "fix(cleanup): Remove initial test junk posts (ID: 1,2,3)" && git pull origin main --rebase && git push origin main', { cwd: REPO_DIR });
            console.log("✅ GitHub 清理完毕！乱码文章彻底从您的网站消失！(请等待 1 分钟后刷新网页)");
        } catch (e) {
            console.error("❌ GitHub 推送遇到问题，请手动检查。");
        }
    } else {
        console.log("✨ 找不到匹配的垃圾 ID，可能已经被清理过了。");
    }
}

removeJunkPosts();
