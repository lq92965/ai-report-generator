import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import axios from 'axios';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.GOOGLE_API_KEY;
const MODEL_NAME = 'gemini-1.5-flash';
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// 1. 检查环境变量
if (!API_KEY || !MONGO_URI || !JWT_SECRET) {
  console.error("错误：环境变量未完全设置！");
  process.exit(1);
}

// 2. 数据库连接
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

// 3. 中间件配置 (包含 CORS 白名单)
app.use(cors({
  origin: [
      'https://goreportify.com', 
      'https://www.goreportify.com', 
      'http://localhost:3000',
      'http://127.0.0.1:5500' 
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json());

// --- 调试日志 ---
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.path}`);
    next();
});

// 4. 鉴权中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: '未授权：请先登录' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token 无效或已过期' });
    req.user = user;
    next();
  });
};

// --- 5. 路由定义 (兼容 /api 前缀和无前缀) ---

app.get('/', (req, res) => res.status(200).send('Backend is running healthy!'));

app.post(['/api/register', '/register'], async (req, res) => {
  try {
    const { displayName, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "缺少必要字段" });
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) return res.status(400).json({ message: "邮箱已存在" });
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.collection('users').insertOne({ name: displayName || 'User', email, password: hashedPassword, plan: 'basic', createdAt: new Date() });
    res.status(201).json({ message: "注册成功" });
  } catch (error) { console.error(error); res.status(500).json({ message: "服务器错误" }); }
});

app.post(['/api/login', '/login'], async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await db.collection('users').findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: "账号或密码错误" });
        }
        const token = jwt.sign({ userId: user._id, plan: user.plan || 'basic' }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, message: "登录成功" });
    } catch (error) { console.error(error); res.status(500).json({ message: "服务器错误" }); }
});

app.get(['/api/me', '/me'], authenticateToken, async (req, res) => {
    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) }, { projection: { password: 0 } });
        if (!user) return res.status(404).json({ message: "用户不存在" });
        res.json(user);
    } catch (error) { res.status(500).json({ message: "服务器错误" }); }
});

app.get(['/api/templates', '/templates'], async (req, res) => {
    const templates = [
        { _id: 'daily_summary', title: 'Daily Work Summary', category: 'General', isPro: false },
        { _id: 'project_proposal', title: 'Project Proposal', category: 'Management', isPro: true },
        { _id: 'marketing_copy', title: 'Marketing Copy', category: 'Marketing', isPro: true },
    ];
    res.json(templates);
});

app.post(['/api/generate', '/generate'], authenticateToken, async (req, res) => {
  const { userPrompt, role, templateId, inputs } = req.body;
  const finalPrompt = `Role: ${role}. Task: Report for ${templateId}. Context: ${userPrompt}. Inputs: ${JSON.stringify(inputs)}`;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
  try {
    const response = await axios.post(apiUrl, { contents: [{ parts: [{ text: finalPrompt }] }] });
    res.json({ generatedText: response.data.candidates[0].content.parts[0].text });
  } catch (error) { res.status(500).json({ error: 'AI Error' }); }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
