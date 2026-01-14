import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai"; // ✅ 引入官方 SDK
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 配置读取 (支持双模型 + 兼容旧 Key)
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const MODEL_PRIMARY = process.env.GEMINI_MODEL_PRIMARY || 'gemini-3-flash-preview';
const MODEL_BACKUP = process.env.GEMINI_MODEL_BACKUP || 'gemini-2.5-flash';
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// 2. 检查环境变量
if (!API_KEY || !MONGO_URI || !JWT_SECRET) {
  console.error("❌ 错误：环境变量未完全设置！请检查 .env 文件");
  process.exit(1);
}

// 初始化 AI SDK
const genAI = new GoogleGenerativeAI(API_KEY);

// 3. 数据库连接
const client = new MongoClient(MONGO_URI);
let db;
async function connectDB() {
  try {
    await client.connect();
    db = client.db('ReportifyAI');
    console.log("✅ 成功连接到 MongoDB Atlas");
  } catch (error) {
    console.error("❌ 连接数据库失败", error);
    process.exit(1);
  }
}
connectDB();

// 4. 中间件配置
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

// 5. 鉴权中间件
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

// --- 6. 核心功能函数 ---

/**
 * 🟢 AI 生成核心逻辑 (包含降级重试)
 */
async function generateAIContent(promptText) {
    // 尝试主力模型
    try {
        console.log(`🚀 [尝试] 使用主力模型: ${MODEL_PRIMARY}`);
        const model = genAI.getGenerativeModel({ model: MODEL_PRIMARY });
        const result = await model.generateContent(promptText);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error(`❌ 主力模型 ${MODEL_PRIMARY} 失败:`, error.message);
        console.log(`⚠️ [切换] 正在尝试备用模型: ${MODEL_BACKUP}`);
        
        // 尝试备用模型
        try {
            const backupModel = genAI.getGenerativeModel({ model: MODEL_BACKUP });
            const backupResult = await backupModel.generateContent(promptText);
            const backupResponse = await backupResult.response;
            return backupResponse.text();
        } catch (backupError) {
            console.error(`❌ 备用模型 ${MODEL_BACKUP} 也失败了:`, backupError.message);
            throw new Error('AI 服务暂时不可用，请稍后再试');
        }
    }
}

// --- 7. 路由定义 ---

app.get('/', (req, res) => res.status(200).send('Backend is running healthy!'));

// 注册
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

// 登录
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

// 获取用户信息
app.get(['/api/me', '/me'], authenticateToken, async (req, res) => {
    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) }, { projection: { password: 0 } });
        if (!user) return res.status(404).json({ message: "用户不存在" });
        res.json(user);
    } catch (error) { res.status(500).json({ message: "服务器错误" }); }
});

// 🟢 [修复] 必须添加这个接口，前端 History 页面才能加载数据
app.get(['/api/reports/history', '/reports/history'], authenticateToken, async (req, res) => {
    try {
        // 查找属于当前用户的报告，按时间倒序排列
        const reports = await db.collection('reports')
            .find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .toArray();
        res.json(reports);
    } catch (error) {
        console.error("获取历史记录失败:", error);
        res.status(500).json({ message: "无法加载历史记录" });
    }
});

// 获取模板
app.get(['/api/templates', '/templates'], async (req, res) => {
    const templates = [
        { _id: 'daily_summary', title: 'Daily Work Summary', category: 'General', isPro: false },
        { _id: 'project_proposal', title: 'Project Proposal', category: 'Management', isPro: true },
        { _id: 'marketing_copy', title: 'Marketing Copy', category: 'Marketing', isPro: true },
    ];
    res.json(templates);
});

// 🟢 [修复] 生成报告接口 (不仅生成，还要存入数据库)
app.post(['/api/generate', '/generate'], authenticateToken, async (req, res) => {
  const { userPrompt, role, templateId, inputs } = req.body;
  const finalPrompt = `Role: ${role}. Task: Report for ${templateId}. Context: ${userPrompt}. Inputs: ${JSON.stringify(inputs)}`;
  
  try {
    // 1. 调用 AI 生成 (使用上面的双保险函数)
    const generatedText = await generateAIContent(finalPrompt);

    // 2. 🟢 关键修复：将生成的报告存入 MongoDB
    const newReport = {
        userId: req.user.userId,      // 关联用户 ID
        title: `${templateId} - ${new Date().toLocaleDateString()}`, // 自动生成标题
        content: generatedText,       // AI 生成的内容
        templateId: templateId,
        createdAt: new Date()         // 创建时间
    };

    await db.collection('reports').insertOne(newReport);
    console.log("✅ 报告已生成并保存到数据库");

    // 3. 返回结果给前端
    res.json({ generatedText: generatedText });

  } catch (error) { 
      console.error("生成失败:", error);
      res.status(500).json({ error: error.message || 'AI Error' }); 
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
