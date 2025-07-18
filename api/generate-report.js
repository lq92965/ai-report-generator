// api/generate-report.js
// 导入 Google Generative AI SDK
import { GoogleGenerativeAI } from '@google/generative-ai';

// 这是 Vercel Serverless Function 的入口点
export default async function handler(req, res) {
    // 确保只处理 POST 请求
    if (req.method !== 'POST') {
        // 返回 405 Method Not Allowed 错误
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // 从请求体中解析出 prompt（提示词）
    const { prompt } = req.body;

    // 检查 prompt 是否存在
    if (!prompt) {
        // 返回 400 Bad Request 错误
        return res.status(400).json({ message: 'Prompt is required' });
    }

    try {
        // 从 Vercel 环境变量中获取 API Key
        // Vercel 会将你在设置中添加的环境变量注入到 process.env 对象中
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // 选择 Gemini 1.5 Flash 模型
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // 调用 Gemini API 生成内容
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text(); // 获取生成的文本内容

        // 返回成功响应，包含生成的文本
        res.status(200).json({ generatedText: text });
    } catch (error) {
        // 捕获并记录错误
        console.error('Gemini API Error:', error);
        // 返回 500 Internal Server Error 错误
        res.status(500).json({ message: 'Error generating report', error: error.message });
    }
}