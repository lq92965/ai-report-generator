import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai"; 
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer'; // ✅ 新增邮件库

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 配置读取
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

// ============================================================
// 📧 5. 智能邮件系统 (英文版 + 关键词匹配) - 新增模块
// ============================================================

// 5.1 配置发件人 (Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'lq92965@gmail.com', // 你的邮箱
        pass: 'cqgk rldv gybe wvhi'  // 🔴 必填：请在此处填入你的 16 位 Google 应用密码
    }
});

// 5.2 英文语料库 (Smart Library)
const EMAIL_TEMPLATES = {
    // --- 场景 A: 关键词触发 (Keywords) ---
    'refund': {
        subject: 'Regarding Your Refund Request - Reportify AI',
        body: 'Hi there,\n\nWe received your inquiry regarding a refund. Our billing team will review your transaction within 24 hours.\n\nPlease note: If you are on a "Free Trial", you will not be charged if you cancel before the trial ends.\n\nBest Regards,\nReportify Billing Team'
    },
    'login': {
        subject: 'Login/Account Access Support - Reportify AI',
        body: 'Hi there,\n\nIt seems you are having trouble accessing your account. \n\n1. If you forgot your password, please use the "Forgot Password" link on the login page.\n2. If you signed up via Google, please ensure you are clicking the "Google Login" button.\n\nIf the issue persists, reply to this email.\n\nBest,\nReportify Support'
    },
    'api': {
        subject: 'Reportify API Documentation & Access',
        body: 'Hi Developer,\n\nThanks for your interest in our API. Currently, API access is available for Enterprise plans. \n\nOur team will contact you shortly to discuss your integration needs.\n\nHappy Coding,\nReportify Dev Team'
    },

    // --- 场景 B: 类型触发 (Categories) ---
    'Bug': {
        subject: 'Bug Report Received - Ticket Created',
        body: 'Hi there,\n\nThank you for reporting this issue. We have logged this bug in our system.\n\nOur engineering team will investigate it. We might reach out to you if we need more details to reproduce the error.\n\nThanks for helping us improve!\nReportify Tech Team'
    },
    'Suggestion': {
        subject: 'Thanks for Your Feature Request!',
        body: 'Hi there,\n\nWe love hearing ideas from our users! Your suggestion has been forwarded to our Product Manager.\n\nMany of our best features came from users like you. Stay tuned for future updates!\n\nBest,\nReportify Product Team'
    },
    'Billing': {
        subject: 'Billing Inquiry Received',
        body: 'Hi there,\n\nWe have received your billing question. Our finance support team will get back to you within 24-48 hours.\n\nThank you for your patience.\nReportify Support'
    },
    'Priority': {
        subject: '【VIP】Priority Support Confirmation',
        body: 'Dear Pro Member,\n\nWe have received your priority support request. As a valued Pro user, your ticket has been moved to the front of the queue.\n\nA dedicated support agent will contact you within 4 hours.\n\nWarm Regards,\nReportify VIP Support'
    },
    // --- 兜底回复 ---
    'General': {
        subject: 'We Received Your Message - Reportify AI',
        body: 'Hi there,\n\nThanks for reaching out to us. We have received your message and will get back to you as soon as possible (usually within 24 hours).\n\nBest Regards,\nReportify Team'
    }
};

// 5.3 智能匹配函数
function matchTemplate(message, type) {
    const msgLower = message.toLowerCase();

    // 优先：关键词匹配
    if (msgLower.includes('refund') || msgLower.includes('money') || msgLower.includes('charge')) return EMAIL_TEMPLATES['refund'];
    if (msgLower.includes('password') || msgLower.includes('login') || msgLower.includes('sign in')) return EMAIL_TEMPLATES['login'];
    if (msgLower.includes('api') || msgLower.includes('sdk')) return EMAIL_TEMPLATES['api'];

    // 其次：根据下拉菜单类型匹配
    return EMAIL_TEMPLATES[type] || EMAIL_TEMPLATES['General'];
}

// 5.4 发送函数
async function sendEmail(to, subject, text) {
    try {
        await transporter.sendMail({
            from: '"Reportify AI Support" <lq92965@gmail.com>',
            to: to,
            subject: subject,
            text: text
        });
        console.log(`✅ Email sent to ${to}`);
    } catch (error) {
        console.error("❌ Email failed:", error);
    }
}

// ============================================================

// 6. 鉴权中间件
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

// 7. 管理员验证中间件
const verifyAdmin = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
        
        if (user && user.role === 'admin') {
            req.user = user;
            next();
        } else {
            res.status(403).json({ message: '仅限管理员访问' });
        }
    } catch (err) {
        res.status(403).json({ message: 'Token Invalid' });
    }
};

// --- 核心功能函数 ---

async function generateAIContent(promptText) {
    try {
        console.log(`🚀 [尝试] 使用主力模型: ${MODEL_PRIMARY}`);
        const model = genAI.getGenerativeModel({ model: MODEL_PRIMARY });
        const result = await model.generateContent(promptText);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error(`❌ 主力模型失败:`, error.message);
        console.log(`⚠️ [切换] 备用模型: ${MODEL_BACKUP}`);
        try {
            const backupModel = genAI.getGenerativeModel({ model: MODEL_BACKUP });
            const backupResult = await backupModel.generateContent(promptText);
            const backupResponse = await backupResult.response;
            return backupResponse.text();
        } catch (backupError) {
            console.error(`❌ 备用模型也失败:`, backupError.message);
            throw new Error('AI 服务暂时不可用');
        }
    }
}

// --- 8. 路由定义 ---

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

// 历史记录
app.get(['/api/reports/history', '/reports/history'], authenticateToken, async (req, res) => {
    try {
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

// 生成报告
app.post(['/api/generate', '/generate'], authenticateToken, async (req, res) => {
  const { userPrompt, role, templateId, inputs } = req.body;
  const finalPrompt = `Role: ${role}. Task: Report for ${templateId}. Context: ${userPrompt}. Inputs: ${JSON.stringify(inputs)}`;
  
  try {
    const generatedText = await generateAIContent(finalPrompt);
    const newReport = {
        userId: req.user.userId,
        title: `${templateId} - ${new Date().toLocaleDateString()}`,
        content: generatedText,
        templateId: templateId,
        createdAt: new Date()
    };
    await db.collection('reports').insertOne(newReport);
    res.json({ generatedText: generatedText });
  } catch (error) { 
      console.error("生成失败:", error);
      res.status(500).json({ error: error.message || 'AI Error' }); 
  }
});

// 🟢 [Contact API] 智能反馈接口 (存数据库 + 自动发邮件)
app.post(['/api/contact', '/contact'], async (req, res) => {
    try {
        const { name, email, message, type } = req.body;
        
        if (!name || !email || !message) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // 1. 存入数据库
        const isVIP = (type === 'Priority');
        const feedbackId = await db.collection('feedbacks').insertOne({
            name, email, type: type || 'General', message,
            submittedAt: new Date(), status: 'unread', isVIP: isVIP
        });

        // 2. 匹配模板并发送自动回复
        const template = matchTemplate(message, type);
        sendEmail(email, template.subject, template.body);

        console.log(`📩 [${type}] Feedback saved & Auto-reply sent to ${email}`);
        res.status(201).json({ message: "Feedback received successfully" });

    } catch (error) {
        console.error("Feedback Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

// ==========================================
// 👑 Admin API Routes (后台管理接口)
// ==========================================

// 1. 仪表盘统计
app.get('/api/admin/stats', verifyAdmin, async (req, res) => {
    try {
        const [totalUsers, basicCount, proCount, feedbackCount, unreadFeedbacks] = await Promise.all([
            db.collection('users').countDocuments(),
            db.collection('users').countDocuments({ plan: 'basic' }),
            db.collection('users').countDocuments({ plan: 'pro' }),
            db.collection('feedbacks').countDocuments(),
            db.collection('feedbacks').countDocuments({ status: 'unread' })
        ]);
        res.json({ users: totalUsers, basic: basicCount, pros: proCount, feedbacks: feedbackCount, unread: unreadFeedbacks });
    } catch (err) { res.status(500).json({ message: "Error fetching stats" }); }
});

// 2. 反馈列表
app.get('/api/admin/feedbacks', verifyAdmin, async (req, res) => {
    try {
        const messages = await db.collection('feedbacks').find({}).sort({ submittedAt: -1 }).limit(50).toArray();
        res.json(messages);
    } catch (err) { res.status(500).json({ message: "Error fetching feedbacks" }); }
});

// 3. 用户列表
app.get('/api/admin/users', verifyAdmin, async (req, res) => {
    try {
        const users = await db.collection('users').find({}, { projection: { password: 0 } }).sort({ createdAt: -1 }).limit(20).toArray();
        res.json(users);
    } catch (err) { res.status(500).json({ message: "Error fetching users" }); }
});

// 4. 🟢 [Admin Reply] 管理员手动回复接口
app.post('/api/admin/reply', verifyAdmin, async (req, res) => {
    try {
        const { feedbackId, replyContent } = req.body;
        
        // 查找原始反馈以获取邮箱
        const feedback = await db.collection('feedbacks').findOne({ _id: new ObjectId(feedbackId) });
        if (!feedback) return res.status(404).json({ message: "Feedback not found" });

        // 发送人工回复
        await sendEmail(
            feedback.email, 
            `Re: ${feedback.type} - Response from Reportify AI`, 
            `Hi ${feedback.name},\n\n${replyContent}\n\n----------------\nBest Regards,\nReportify Admin Team`
        );

        // 更新状态
        await db.collection('feedbacks').updateOne(
            { _id: new ObjectId(feedbackId) },
            { $set: { status: 'replied', repliedAt: new Date() } }
        );

        res.json({ message: "Reply sent successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to send reply" });
    }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
