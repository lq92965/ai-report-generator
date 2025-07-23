import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function (req, res) {
    // 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        // 从请求体中解构出 workContent, style, length
        // 重要：确保这里接收的字段名与前端 script.js 发送的字段名完全一致
        const { workContent, style, length } = req.body; 

        // 从 Vercel 环境变量中获取 Gemini API Key
        const API_KEY = process.env.GEMINI_API_KEY; 

        // 检查 API Key 是否已设置
        if (!API_KEY) {
            console.error('GEMINI_API_KEY is not set in environment variables.');
            // 返回一个包含 'error' 字段的 JSON 响应
            return res.status(500).json({ error: 'API Key not configured on the server. Please check Vercel environment variables.' });
        }

        // 初始化 Gemini AI 客户端
        const genAI = new GoogleGenerativeAI(API_KEY);
        // 使用 gemini-1.5-flash 模型，因为它通常更快且成本效益更高
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 

        // 根据前端传入的 style 和 length 构建 AI Prompt
        let promptForAI = `你是一位专业的职场助理，请根据以下工作要点，生成一份`;
        if (style === 'formal') {
            promptForAI += `正式`;
        } else if (style === 'concise') {
            promptForAI += `口语化`;
        }
        promptForAI += `风格的`;
        if (length === 'standard') {
            promptForAI += `标准篇幅`;
        } else if (length === 'detailed') {
            promptForAI += `详细篇幅`;
        }
        promptForAI += `的周报或日报：\n\n${workContent}\n\n`;
        promptForAI += `请确保内容条理清晰，表达专业，语气恰当。`;

        // 调用 Gemini API 生成内容
        const result = await model.generateContent(promptForAI);
        const response = await result.response;
        const text = response.text();

        // 成功时返回 AI 生成的文本
        // 重要：确保这里返回的字段名 (report) 与前端 script.js 期望接收的字段名完全一致
        res.status(200).json({ report: text });

    } catch (error) {
        console.error('Error generating report in Serverless Function:', error);
        // 捕获并返回更详细的错误信息
        res.status(500).json({ error: `Serverless Function Error: ${error.message || 'Unknown error'}. Please check Vercel logs.` });
    }
}