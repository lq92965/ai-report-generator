import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(event, context) {
    // 1. 检查请求方法
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    let parsedBody;
    // 2. 安全解析请求体
    try {
        if (!event.body) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Request body is empty.' }),
                headers: { 'Content-Type': 'application/json' },
            };
        }
        parsedBody = JSON.parse(event.body); 
    } catch (parseError) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: `Invalid request body.` }), // 简化错误信息
            headers: { 'Content-Type': 'application/json' },
        };
    }

    // 3. 检查必要字段
    const { workContent, style, length } = parsedBody; 
    if (!workContent || !style || !length) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing required fields.' }), // 简化错误信息
            headers: { 'Content-Type': 'application/json' },
        };
    }

    // 4. 执行核心业务逻辑
    try {
        const API_KEY = process.env.GEMINI_API_KEY; 

        if (!API_KEY) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'API Key not configured.' }), // 简化错误信息
                headers: { 'Content-Type': 'application/json' },
            };
        }

        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 

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

        const result = await model.generateContent(promptForAI);
        const response = await result.response;
        const text = response.text();

        // 成功时返回
        return {
            statusCode: 200,
            body: JSON.stringify({ report: text }),
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error) {
        // 5. 统一错误处理和返回
        let errorMessage = `Serverless Function Error.`; // 极度简化错误信息
        if (error.message && error.message.includes('API key not valid')) {
            errorMessage = 'API Key not valid.'; // 极度简化错误信息
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: errorMessage }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
}