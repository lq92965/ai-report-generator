require('dotenv').config();
const axios = require('axios');

if (!process.env.MAKE_WEBHOOK_URL) {
    console.error("❌ 错误：在 .env 文件中没有找到 MAKE_WEBHOOK_URL！");
    process.exit(1);
}

console.log("🚀 正在向 Make.com 发送多平台(V3)测试信号...");
axios.post(process.env.MAKE_WEBHOOK_URL, {
    title: "🚀 Reportify AI Multi-Platform Test",
    url: "https://www.goreportify.com",
    text: "Default fallback text",
    redditText: "Ugh, another day, another pointless meeting. Wrote this to save my sanity: https://www.goreportify.com",
    linkedinText: "Excited to share our latest insights on PM efficiency and AI automation. Read more: https://www.goreportify.com",
    twitterText: "Tired of useless meetings? 🤯 Let AI write your reports. 🚀 #AI #Productivity https://www.goreportify.com"
}).then(() => console.log("✅ Webhook 触发成功！")).catch(e => console.error("❌ 触发失败:", e.message));
