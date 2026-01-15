import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai"; 
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// ❌ 移除了 nodemailer，不再尝试发邮件，彻底杜绝崩溃风险

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 核心配置
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID; // 确保 .env 里有这个

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

// 3. CORS 配置 (保持你的急救版配置，确保登录无忧)
app.use(cors({
  origin: true, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json());

// ==========================================
// 鉴权中间件 (保持不变)
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
// 🟢 路由接口
// ==========================================

app.get('/', (req, res) => res.send('Backend Online'));

// 1. 🟢 [修复] Google 登录跳转接口 (之前缺失导致 404)
app.get('/auth/google', (req, res) => {
    // 构建 Google 官方授权链接
    const redirectUri = 'https://goreportify.com'; // 登录成功后回跳的地址
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=token&scope=email profile openid`;
    res.json({ url: url });
});

// 2. 注册
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

// 3. 登录
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await db.collection('users').findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ message: "Invalid credentials" });
        const token = jwt.sign({ userId: user._id, plan: user.plan }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, message: "Login successful" });
    } catch (e) { res.status(500).json({ message: "Error" }); }
});

// 4. 用户信息
app.get('/api/me', authenticateToken, async (req, res) => {
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) }, { projection: { password: 0 } });
    res.json(user);
});

// 5. 生成报告
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

// 6. 历史记录
app.get('/api/reports/history', authenticateToken, async (req, res) => {
    const reports = await db.collection('reports').find({ userId: req.user.userId }).sort({ createdAt: -1 }).toArray();
    res.json(reports);
});

// 🟢 [Contact] 联系我们 (只存库，不发邮件，速度极快)
app.post('/api/contact', async (req, res) => {
    const { name, email, message, type } = req.body;
    await db.collection('feedbacks').insertOne({
        name, email, type: type || 'General', message,
        submittedAt: new Date(), 
        status: 'unread', 
        isVIP: (type === 'Priority'),
        reply: null // 初始化回复为空
    });
    res.json({ message: "Sent" });
});

// 🟢 [User Message] 用户获取站内信 (新功能)
app.get('/api/my-messages', authenticateToken, async (req, res) => {
    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
        // 查找该邮箱下，所有已有回复的消息
        const messages = await db.collection('feedbacks').find({ 
            email: user.email,
            status: 'replied'
        }).sort({ repliedAt: -1 }).toArray();
        
        res.json(messages);
    } catch (e) { res.status(500).json({ message: "Error" }); }
});

// ==========================================
// 👑 Admin API (后台管理)
// ==========================================

// 统计数据
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

// 反馈列表
app.get('/api/admin/feedbacks', verifyAdmin, async (req, res) => {
    const msgs = await db.collection('feedbacks').find({}).sort({ submittedAt: -1 }).limit(50).toArray();
    res.json(msgs);
});

// 用户列表
app.get('/api/admin/users', verifyAdmin, async (req, res) => {
    const users = await db.collection('users').find({}, { projection: { password: 0 } }).sort({ createdAt: -1 }).limit(20).toArray();
    res.json(users);
});

// 🟢 [Admin Reply] 站内信回复 (存入数据库，不发邮件)
app.post('/api/admin/reply', verifyAdmin, async (req, res) => {
    const { feedbackId, replyContent } = req.body;
    
    // 更新数据库：写入回复内容，标记为已回复
    const result = await db.collection('feedbacks').updateOne(
        { _id: new ObjectId(feedbackId) },
        { 
            $set: { 
                status: 'replied', 
                reply: replyContent, 
                repliedAt: new Date() 
            } 
        }
    );

    if (result.modifiedCount > 0) {
        return res.json({ message: "Reply saved to database" });
    }
    res.status(500).json({ message: "Failed to save reply" });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
