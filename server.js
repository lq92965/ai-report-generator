import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai"; 
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer'; 

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 核心配置
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// 2. 数据库连接
const client = new MongoClient(MONGO_URI);
let db;
async function connectDB() {
  try {
    await client.connect();
    db = client.db('ReportifyAI');
    console.log("✅ MongoDB Connected");
  } catch (error) { console.error("❌ DB Error", error); }
}
connectDB();

// 3. 🟢 [急救修复] CORS 跨域配置 - 允许所有来源
// 这可以解决你在截图里遇到的 Access to fetch has been blocked 错误
app.use(cors({
  origin: true, // 🟢 设置为 true 表示接受任何请求来源 (自动反射)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json());

// ==========================================
// 📧 邮件系统配置 (尝试 587 端口 + STARTTLS)
// ==========================================
let transporter = null;
try {
    transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587, // 🟢 改用 587 端口 (云服务器推荐端口)
        secure: false, // 587 必须设为 false
        requireTLS: true, // 强制加密
        auth: {
            user: 'lq92965@gmail.com', 
            pass: 'cqgkrldvgybewvhi' // 🔴 必填：去掉空格！
        },
        connectionTimeout: 10000 // 10秒超时
    });
} catch (err) {
    console.error("⚠️ 邮件配置错误:", err);
}

// 辅助发送函数
async function sendEmail(to, subject, text) {
    if (!transporter) return false;
    try {
        await transporter.sendMail({
            from: '"Reportify Support" <lq92965@gmail.com>',
            to, subject, text
        });
        console.log(`✅ Email sent to ${to}`);
        return true;
    } catch (error) {
        console.error("❌ Email failed:", error);
        return false;
    }
}

// ==========================================
// 鉴权中间件
// ==========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid Token' });
    req.user = user;
    next();
  });
};

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
            res.status(403).json({ message: 'Admin Access Required' });
        }
    } catch (err) { res.status(403).json({ message: 'Token Invalid' }); }
};

// ==========================================
// 路由接口
// ==========================================

app.get('/', (req, res) => res.send('Backend Online'));

// 注册
app.post('/api/register', async (req, res) => {
    try {
        const { displayName, email, password } = req.body;
        const existing = await db.collection('users').findOne({ email });
        if (existing) return res.status(400).json({ message: "Email exists" });
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.collection('users').insertOne({ 
            name: displayName, email, password: hashedPassword, 
            plan: 'basic', role: 'user', createdAt: new Date() 
        });
        res.status(201).json({ message: "Success" });
    } catch (e) { res.status(500).json({ message: "Error" }); }
});

// 登录
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await db.collection('users').findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ message: "Invalid credentials" });
        const token = jwt.sign({ userId: user._id, plan: user.plan }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, message: "Login successful" });
    } catch (e) { res.status(500).json({ message: "Error" }); }
});

// 用户信息
app.get('/api/me', authenticateToken, async (req, res) => {
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) }, { projection: { password: 0 } });
    res.json(user);
});

// 生成报告
const genAI = new GoogleGenerativeAI(API_KEY);
app.post('/api/generate', authenticateToken, async (req, res) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
        const result = await model.generateContent(req.body.userPrompt || "Hello");
        const text = result.response.text();
        
        await db.collection('reports').insertOne({
            userId: req.user.userId, title: "Generated Report", content: text, createdAt: new Date()
        });
        res.json({ generatedText: text });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "AI Error" }); 
    }
});

// 历史记录
app.get('/api/reports/history', authenticateToken, async (req, res) => {
    const reports = await db.collection('reports').find({ userId: req.user.userId }).sort({ createdAt: -1 }).toArray();
    res.json(reports);
});

// 🟢 [Contact] 联系与自动回复
app.post('/api/contact', async (req, res) => {
    const { name, email, message, type } = req.body;
    await db.collection('feedbacks').insertOne({
        name, email, type: type || 'General', message,
        submittedAt: new Date(), status: 'unread', isVIP: (type === 'Priority')
    });
    
    // 自动回复
    sendEmail(email, "We received your message | Reportify", `Hi ${name},\n\nWe have received your message regarding ${type || 'General'}. We will get back to you soon.\n\nReportify Team`);
    
    res.json({ message: "Sent" });
});

// 🟢 [Admin] 统计数据
app.get('/api/admin/stats', verifyAdmin, async (req, res) => {
    try {
        const [users, basic, pro, feedbacks, unread] = await Promise.all([
            db.collection('users').countDocuments(),
            db.collection('users').countDocuments({ plan: 'basic' }),
            db.collection('users').countDocuments({ plan: 'pro' }),
            db.collection('feedbacks').countDocuments(),
            db.collection('feedbacks').countDocuments({ status: 'unread' })
        ]);
        res.json({ users, basic, pros: pro, feedbacks, unread });
    } catch (e) { res.status(500).json({ message: "Error" }); }
});

// 🟢 [Admin] 消息列表
app.get('/api/admin/feedbacks', verifyAdmin, async (req, res) => {
    const msgs = await db.collection('feedbacks').find({}).sort({ submittedAt: -1 }).limit(50).toArray();
    res.json(msgs);
});

// 🟢 [Admin] 用户列表
app.get('/api/admin/users', verifyAdmin, async (req, res) => {
    const users = await db.collection('users').find({}, { projection: { password: 0 } }).sort({ createdAt: -1 }).limit(20).toArray();
    res.json(users);
});

// 🟢 [Admin] 手动回复
app.post('/api/admin/reply', verifyAdmin, async (req, res) => {
    const { feedbackId, replyContent } = req.body;
    const feedback = await db.collection('feedbacks').findOne({ _id: new ObjectId(feedbackId) });
    
    if (feedback) {
        const sent = await sendEmail(feedback.email, "Re: Reportify Support", replyContent);
        if (sent) {
            await db.collection('feedbacks').updateOne({ _id: new ObjectId(feedbackId) }, { $set: { status: 'replied' } });
            return res.json({ message: "Replied" });
        }
    }
    res.status(500).json({ message: "Failed" });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
