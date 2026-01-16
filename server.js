import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai"; 
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 核心配置
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID; 
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

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

// 3. CORS 配置
app.use(cors({ origin: true, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

// 鉴权中间件
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
        if (user && user.role === 'admin') { req.user = user; next(); } 
        else { res.status(403).json({ message: 'Admin Only' }); }
    } catch (err) { res.status(403).json({ message: 'Token Invalid' }); }
};

// ======================= 路由 =======================

app.get('/', (req, res) => res.send('Backend Online'));

// 🟢 [补回] 模板列表接口
app.get('/api/templates', async (req, res) => {
    const templates = [
        { _id: 'daily_summary', title: 'Daily Work Summary', category: 'General', isPro: false },
        { _id: 'project_proposal', title: 'Project Proposal', category: 'Management', isPro: true },
        { _id: 'marketing_copy', title: 'Marketing Copy', category: 'Marketing', isPro: true },
    ];
    res.json(templates);
});

// 🟢 [核心修复] Google 登录跳转
app.get('/auth/google', (req, res) => {
    const redirectUri = 'https://api.goreportify.com/api/auth/google/callback'; 
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email profile openid`;
    
    // ❌ 之前是 res.json({url}) 导致你看到乱码
    // ✅ 现在改成直接跳转
    res.redirect(url);
});

// Google 回调
app.get('/api/auth/google/callback', async (req, res) => {
    const code = req.query.code;
    try {
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
            code: code, grant_type: 'authorization_code',
            redirect_uri: 'https://api.goreportify.com/api/auth/google/callback'
        });
        const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });
        const { email, name } = userRes.data;
        
        let user = await db.collection('users').findOne({ email });
        if (!user) {
            const result = await db.collection('users').insertOne({ name, email, password: null, authProvider: 'google', plan: 'basic', createdAt: new Date() });
            user = { _id: result.insertedId, plan: 'basic' };
        }
        const token = jwt.sign({ userId: user._id, plan: user.plan }, JWT_SECRET, { expiresIn: '7d' });
        
        // 带着 token 跳回首页
        res.redirect(`https://goreportify.com?token=${token}`);
    } catch (error) { 
        console.error("Google Login Error:", error);
        res.redirect('https://goreportify.com?error=google_login_failed'); 
    }
});

// --- 常规业务 ---
app.post('/api/register', async (req, res) => {
    try {
        const { displayName, email, password } = req.body;
        const existing = await db.collection('users').findOne({ email });
        if (existing) return res.status(400).json({ message: "Email exists" });
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.collection('users').insertOne({ name: displayName, email, password: hashedPassword, plan: 'basic', role: 'user', createdAt: new Date() });
        res.status(201).json({ message: "Success" });
    } catch (e) { res.status(500).json({ message: "Error" }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await db.collection('users').findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ message: "Invalid credentials" });
        const token = jwt.sign({ userId: user._id, plan: user.plan }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, message: "Login successful" });
    } catch (e) { res.status(500).json({ message: "Error" }); }
});

app.get('/api/me', authenticateToken, async (req, res) => {
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) }, { projection: { password: 0 } });
    res.json(user);
});

// --- AI 生成 ---
const genAI = new GoogleGenerativeAI(API_KEY);
app.post('/api/generate', authenticateToken, async (req, res) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
        const result = await model.generateContent(req.body.userPrompt || "Hello");
        const text = result.response.text();
        await db.collection('reports').insertOne({ userId: req.user.userId, title: "Generated Report", content: text, createdAt: new Date() });
        res.json({ generatedText: text });
    } catch (e) { res.status(500).json({ error: "AI Error" }); }
});

app.get('/api/reports/history', authenticateToken, async (req, res) => {
    const reports = await db.collection('reports').find({ userId: req.user.userId }).sort({ createdAt: -1 }).toArray();
    res.json(reports);
});

// --- 站内信 ---
app.post('/api/contact', async (req, res) => {
    const { name, email, message, type } = req.body;
    await db.collection('feedbacks').insertOne({
        name, email, type: type || 'General', message,
        submittedAt: new Date(), status: 'unread', isVIP: (type === 'Priority'), reply: null
    });
    res.json({ message: "Saved to Database" });
});

app.get('/api/my-messages', authenticateToken, async (req, res) => {
    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
        const messages = await db.collection('feedbacks')
            .find({ email: user.email, status: 'replied' }) 
            .sort({ repliedAt: -1 })
            .toArray();
        res.json(messages);
    } catch (e) { res.status(500).json({ message: "Error" }); }
});

// Admin
app.post('/api/admin/reply', verifyAdmin, async (req, res) => {
    const { feedbackId, replyContent } = req.body;
    const result = await db.collection('feedbacks').updateOne(
        { _id: new ObjectId(feedbackId) },
        { $set: { status: 'replied', reply: replyContent, repliedAt: new Date() } }
    );
    if (result.modifiedCount > 0) res.json({ message: "Reply Saved" });
    else res.status(500).json({ message: "Failed" });
});

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

app.get('/api/admin/feedbacks', verifyAdmin, async (req, res) => {
    const msgs = await db.collection('feedbacks').find({}).sort({ submittedAt: -1 }).limit(50).toArray();
    res.json(msgs);
});

app.get('/api/admin/users', verifyAdmin, async (req, res) => {
    const users = await db.collection('users').find({}, { projection: { password: 0 } }).sort({ createdAt: -1 }).limit(20).toArray();
    res.json(users);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
