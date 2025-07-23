import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    let parsedBody;
    try {
        // 尝试解析请求体。如果 event.body 为空或不是有效JSON，这里会抛出错误
        parsedBody = JSON.parse(event.body || '{}'); // 如果 event.body 为空，解析为空对象
    } catch (parseError) {
        console.error('Error parsing request body:', parseError);
        return {
            statusCode: 400, // Bad Request，因为请求体格式不正确
            body: JSON.stringify({ error: `Invalid request body format: ${parseError.message}` }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    // 从解析后的请求体中解构出 workContent, style, length
    const { workContent, style, length } = parsedBody; 

    // 检查必要的字段是否存在
    if (!workContent || !style || !length) {
        return {
            statusCode: 400, // Bad Request，因为缺少必要字段
            body: JSON.stringify({ error: 'Missing required fields: workContent, style, or length.' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    try {
        const API_KEY = process.env.GEMINI_API_KEY; 

        if (!API_KEY) {
            console.error('GEMINI_API_KEY is not set in environment variables.');
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'API Key not configured on the server. Please check Netlify environment variables.' }),
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

        return {
            statusCode: 200,
            body: JSON.stringify({ report: text }),
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error) {
        console.error('Error during Gemini API call or function execution:', error);
        // 捕获并返回更详细的错误信息
        // 检查是否是 API Key 无效的错误
        let errorMessage = `Serverless Function Error: ${error.message || 'Unknown error'}. Please check Netlify logs.`;
        if (error.message && error.message.includes('API key not valid')) {
            errorMessage = 'API Key not valid. Please check your GEMINI_API_KEY in Netlify environment variables.';
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: errorMessage }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
}