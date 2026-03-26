require('dotenv').config();
const axios = require('axios');

async function testApis() {
    console.log("\n[Amber V6 诊断] 🛡️ 开始全面诊断 AI 大模型接口状态...\n");

    // --- 测试 Gemini (用于 Blog，相对可靠) ---
    console.log("[诊断] 🌐 正在尝试握手 Gemini Pro (用于 Blog 长文)...");
    try {
        await axios.post(process.env.GEMINI_API_URL, {
            model: process.env.GEMINI_MODEL,
            messages: [{ role: "user", content: "hi" }]
        }, { headers: { 'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`, 'Content-Type': 'application/json' } });
        console.log("✅ [Gemini] 握手成功！大脑状态：完美健康。");
    } catch (e) {
        console.error(`❌ [Gemini] 握手失败:`, e.message);
        if (e.message.includes('403') || e.message.includes('401')) console.log("   👉 可能是 API Key 错误或欠费。");
        if (e.message.includes('429')) console.log("   👉 触发频率限制 (Rate Limit)，请稍后再试。");
    }

    console.log("\n------------------------------------------------\n");

    // --- 测试 DeepSeek (用于 News，很不稳定) ---
    console.log("[诊断] 🌐 正在尝试握手 DeepSeek (用于 Tech News)...");
    try {
        // 给 DeepSeek 一个短超时，防止无限 hang 住
        await axios.post(process.env.DEEPSEEK_API_URL, {
            model: process.env.DEEPSEEK_MODEL,
            messages: [{ role: "user", content: "hi" }],
            timeout: 20000 // 20秒超时
        }, { headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' } });
        console.log("✅ [DeepSeek] 握手成功！大脑状态：完美健康。");
    } catch (e) {
        console.error(`❌ [DeepSeek] 握手失败:`, e.message);
        if (e.message.includes('timeout')) console.log("   👉 服务器卡顿/挂了。我们将把所有内容切换至 Gemini。");
        if (e.message.includes('503') || e.message.includes('502')) console.log("   👉 DeepSeek 崩了，战略性放弃。");
    }
}

testApis();
