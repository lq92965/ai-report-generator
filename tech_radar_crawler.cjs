// tech_radar_crawler.js
// 完整文件：Reportify AI 实时科技热点狙击脚本
const Parser = require('rss-parser');
const parser = new Parser();
const fs = require('fs');
const path = require('path');

// CTO 配置：这里是我们狙击全球科技热点的坐标
const RSS_FEEDS = [
    'https://hnrss.org/frontpage', 
    'https://techcrunch.com/feed/'
];

async function fetchTrendingNews() {
    console.log("📡 [科技雷达] 开启全球科技热点雷达扫描...");
    let trendingArticles = [];

    for (const feedUrl of RSS_FEEDS) {
        try {
            const feed = await parser.parseURL(feedUrl);
            console.log(`✅ 成功锁定信号源: ${feed.title}`);

            const topItems = feed.items.slice(0, 3);
            topItems.forEach(item => {
                trendingArticles.push({
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    snippet: item.contentSnippet || item.content || "无详细摘要，请根据标题发散"
                });
            });
        } catch (error) {
            console.error(`❌ 信号源拦截失败 (${feedUrl}):`, error.message);
        }
    }

    trendingArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    const finalHotNews = trendingArticles.slice(0, 5);

    // 将热点弹药库打包为 JSON 物理文件，存放在当前目录
    const outputPath = path.join(__dirname, 'trending_news_raw.json');
    fs.writeFileSync(outputPath, JSON.stringify(finalHotNews, null, 2));
    
    console.log(`🎯 扫描完毕！共锁定 ${finalHotNews.length} 条超级热点。`);
    console.log(`📦 数据已封装至 ${outputPath}。`);
}

fetchTrendingNews();
