require('dotenv').config();
const axios = require('axios');

if (!process.env.MAKE_WEBHOOK_URL) {
    console.error("❌ 错误：在 .env 文件中没有找到 MAKE_WEBHOOK_URL！");
    process.exit(1);
}

console.log("🚀 正在向 Make.com 发送带有 text 字段的测试信号...");
axios.post(process.env.MAKE_WEBHOOK_URL, {
    title: "🚀 Reportify AI Integration Test (Fixed)",
    text: "This is a test post to confirm that our Make.com webhook is perfectly receiving the required 'text' parameter from the Ubuntu server. \n\n Read more: https://www.goreportify.com",
    excerpt: "Test excerpt.",
    url: "https://www.goreportify.com"
}).then(() => {
    console.log("✅ Webhook 触发成功！Make.com 已经接收到数据！");
    console.log("👉 请立刻去您的 Reddit 主页看看有没有出现这条测试贴！");
}).catch(e => console.error("❌ 触发失败:", e.message));
