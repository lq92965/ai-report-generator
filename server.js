// server.js
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const port = process.env.PORT || 3000;

// 允许跨域请求 (CORS)
app.use(express.json());
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 核心的周报生成逻辑
async function generateReportLogic(workContent, style, length) {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `请根据以下工作要点，生成一份${length}的${style}风格的周报或日报，要求结构清晰、条理分明，语言流畅。
    工作要点：${workContent}`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Error generating report:', error);
        throw new Error('Error generating report from AI.');
    }
}

// 设置 API 路由
app.post('/generate-report', async (req, res) => {
    try {
        const { workContent, style, length } = req.body;
        if (!workContent) {
            return res.status(400).json({ error: 'Work content is required.' });
        }
        const report = await generateReportLogic(workContent, style, length);
        res.status(200).json({ report });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'API Error: ' + error.message });
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});