import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import axios from 'axios';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// --- 初始化应用和常量 ---
const app = express();
const port = process.env.PORT || 3000;
const API_KEY = process.env.GOOGLE_API_KEY;
const MODEL_NAME = 'gemini-1.5-flash';
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// --- 检查环境变量 ---
if (!API_KEY || !MONGO_URI || !JWT_SECRET) {
  console.error("错误：请确保 .env 文件中已设置 GOOGLE_API_KEY, MONGO_URI, 和 JWT_SECRET");
  process.exit(1);
}

// --- 数据库连接 ---
const client = new MongoClient(MONGO_URI);
let db;
async function connectDB() {
  try {
    await client.connect();
    db = client.db('ReportifyAI');
    console.log("成功连接到 MongoDB Atlas");
  } catch (error) {
    console.error("连接数据库失败", error);
    process.exit(1);
  }
}
connectDB();

// --- 中间件设置 ---
app.use(cors());
app.use(express.json());

// --- 新增：终极诊断接口 ---
app.get('/api/test-google-connection', async (req, res) => {
    console.log("收到 Google 连接测试请求...");
    const testApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
    try {
        await axios.post(testApiUrl, {
            contents: [{ parts: [{ text: "Hello" }] }]
        });
        console.log("Google 连接测试成功！");
        res.status(200).send('Google Connection Test: SUCCESS');
    } catch (error) {
        // **打印最详细的错误对象**
        console.error("Google 连接测试失败! 详细错误对象:", JSON.stringify(error, null, 2));
        res.status(500).json({ 
            message: 'Google Connection Test: FAILED',
            error_details: error.response ? error.response.data : error.message
        });
    }
});

// --- 用户认证 API ---
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "所有字段都是必填的" });
    }
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "该邮箱已被注册" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.collection('users').insertOne({ name, email, password: hashedPassword });
    res.status(201).json({ message: "用户注册成功" });
  } catch (error) {
    res.status(500).json({ message: "服务器内部错误" });
  }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "邮箱和密码是必填的" });
        }
        const user = await db.collection('users').findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "无效的邮箱或密码" });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "无效的邮箱或密码" });
        }
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, message: "登录成功" });
    } catch (error) {
        res.status(500).json({ message: "服务器内部错误" });
    }
});

// --- AI 生成接口 ---
app.post('/api/generate', async (req, res) => {
  const { userPrompt, template, detailLevel, role, tone, language } = req.body;
  if (!userPrompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }
  const finalPrompt = `
    You are an expert in writing professional business reports. Your task is to act as a ${role} and create a complete, detailed, and ready-to-submit report.
    **CRITICAL INSTRUCTION: You must not generate only a framework or an outline.** Your main goal is to expand the user's key points into fluent, detailed paragraphs. Based on your assigned role, you should add relevant details, analysis, or suggestions to make the report look highly professional and insightful. The final deliverable should be a complete document that the user can use after minor edits like changing the name and date.
    Here are the report criteria:
    - **Report Type**: ${template}
    - **Detail Level**: ${detailLevel}.
    - **Tone and Style**: ${tone}
    - **Output Language**: ${language}
    Here are the user's key points that you must expand upon:
    ---
    ${userPrompt}
    ---
  `;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
  
  try {
    const response = await axios.post(apiUrl, {
      contents: [{ parts: [{ text: finalPrompt }] }]
    });
    const generatedText = response.data.candidates[0].content.parts[0].text;
    res.json({ generatedText: generatedText });
  } catch (error) {
    console.error("详细错误信息:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate content.' });
  }
});

// --- 启动服务器 ---
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});