import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(event, context) { // Netlify 函数的参数是 event 和 context
    // Netlify 函数的请求方法通过 event.httpMethod 获取
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    try {
        // 从 event.body 中解析 JSON 数据
        const { workContent, style, length } = JSON.parse(event.body); 

        // 从环境变量中获取 Gemini API Key
        const API_KEY = process.env.GEMINI_API_KEY; 

        // 检查 API Key 是否已设置
        if (!API_KEY) {
            console.error('GEMINI_API_KEY is not set in environment variables.');
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'API Key not configured on the server. Please check Netlify environment variables.' }),
                headers: { 'Content-Type': 'application/json' },
            };
        }

        // 初始化 Gemini AI 客户端
        const genAI = new GoogleGenerativeAI(API_KEY);
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
        return {
            statusCode: 200,
            body: JSON.stringify({ report: text }),
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error) {
        console.error('Error generating report in Serverless Function:', error);
        // **** 关键修改：确保这里也返回 Netlify 期望的 Response 对象格式 ****
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Serverless Function Error: ${error.message || 'Unknown error'}. Please check Netlify logs.` }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
}