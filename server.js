import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai"; 
// ⬇️ 关键修改：必须引入 ObjectId，否则下面会报错
import { MongoClient, ObjectId } from 'mongodb'; 
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

// 修复路径定义
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
// --- 修改开始：让浏览器能访问 uploads 里的图片 ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// --- 修改结束 ---
// ... 保留上面的 app.use ...

// --- 关键修复：使用绝对路径保存文件 ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 使用 path.join 确保一定能找到这个文件夹
        cb(null, path.join(__dirname, 'uploads')); 
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

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

// 🟢 [修正版] Google 回调 (增加保存头像 picture 逻辑)
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
        
        // 🟢 获取 Google 头像
        const { email, name, picture } = userRes.data; 
        
        let user = await db.collection('users').findOne({ email });
        if (!user) {
            // 注册新用户 (存入 picture)
            const result = await db.collection('users').insertOne({ 
                name, email, picture, // ✅ 存入头像
                password: null, authProvider: 'google', plan: 'basic', createdAt: new Date() 
            });
            user = { _id: result.insertedId, plan: 'basic' };
        } else {
            // 老用户登录，顺便更新一下头像 (防止头像过期)
            await db.collection('users').updateOne({ email }, { $set: { picture: picture } });
        }

        const token = jwt.sign({ userId: user._id, plan: user.plan }, JWT_SECRET, { expiresIn: '7d' });
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

// --- 修改：获取用户信息 + 统计用量 ---
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(req.user.userId) }, 
            { projection: { password: 0 } }
        );
        
        if (!user) return res.status(404).json({ message: "User not found" });

        // 统计 reports 集合中，该用户的报告数量
        const usageCount = await db.collection('reports').countDocuments({ userId: req.user.userId });

        // 合并数据返回
        res.json({ ...user, usageCount });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Error" });
    }
});

// --- 新增：头像上传接口 ---
app.post('/api/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: '请上传文件' });
        
        // 注意：这里返回给前端的 URL 依然是相对的，方便浏览器访问
        const avatarUrl = `/uploads/${req.file.filename}`;
        
        await db.collection('users').updateOne(
            { _id: new ObjectId(req.user.userId) },
            { $set: { picture: avatarUrl } } 
        );
        
        res.json({ message: '上传成功', avatarUrl });
    } catch (e) {
        // --- 关键：在终端打印具体错误，方便排查 ---
        console.error("上传失败详情:", e); 
        res.status(500).json({ message: "服务器内部错误" });
    }
});

// --- 新增：更新个人资料 (名字、职位、简介) ---
app.post('/api/update-profile', authenticateToken, async (req, res) => {
    try {
        const { name, job, bio } = req.body;
        
        // 构建要更新的数据对象
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (job !== undefined) updateData.job = job; // 确保数据库里想存这个字段
        if (bio !== undefined) updateData.bio = bio;

        await db.collection('users').updateOne(
            { _id: new ObjectId(req.user.userId) },
            { $set: updateData }
        );

        res.json({ message: 'Profile updated successfully', user: updateData });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server Error" });
    }
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
// 🟢 [升级版] 管理员回复 (支持无限追加对话模式)
app.post('/api/admin/reply', verifyAdmin, async (req, res) => {
    const { feedbackId, replyContent } = req.body;
    
    // 构造一条新的回复记录
    const newReplyItem = {
        role: 'admin',       // 标记是管理员说的
        message: replyContent,
        createdAt: new Date()
    };

    try {
        const result = await db.collection('feedbacks').updateOne(
            { _id: new ObjectId(feedbackId) },
            { 
                $set: { 
                    status: 'replied',      // 标记为已回复
                    repliedAt: new Date(),  // 更新最后回复时间
                    // 如果是旧数据没有 reply，把它转存到历史里 (可选优化，这里直接由前端兼容显示)
                },
                $push: { 
                    conversation: newReplyItem // 🟢 关键：追加到对话数组中
                } 
            }
        );

        if (result.modifiedCount > 0) res.json({ message: "Reply Sent" });
        else res.status(500).json({ message: "Failed" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Error" });
    }
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

// ==========================================
// 🟢 [新增] 获取用户历史报告接口
// ==========================================
app.get('/api/history', authenticateToken, async (req, res) => {
    try {
        // 1. 获取当前登录用户的邮箱 (从 Token 里解密出来的)
        const userEmail = req.user.email; 
        console.log("正在查询历史记录，用户:", userEmail);

        // 2. 去数据库 'reports' 集合里查找该用户的报告
        // (注意：如果你生成报告时存的集合名不是 'reports'，请修改这里)
        const reports = await db.collection('reports')
            .find({ userEmail: userEmail }) 
            .sort({ createdAt: -1 }) // 按时间倒序排列（最新的在前面）
            .toArray();

        // 3. 返回数据给前端
        res.json(reports);
        
    } catch (error) {
        console.error("历史记录获取失败:", error);
        res.status(500).json({ message: "Failed to fetch history" });
    }
});

// ==========================================
// 🟢 [新增] 删除单条报告接口
// ==========================================
app.delete('/api/history/:id', authenticateToken, async (req, res) => {
    try {
        const reportId = req.params.id;
        const userEmail = req.user.email;

        const result = await db.collection('reports').deleteOne({
            _id: new ObjectId(reportId),
            userEmail: userEmail // 确保只能删除自己的
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Report not found or unauthorized" });
        }

        res.json({ message: "Report deleted successfully" });
    } catch (error) {
        console.error("删除失败:", error);
        res.status(500).json({ message: "Delete failed" });
    }
});

// ==========================================
// 🟢 [新增] 用量统计专用接口
// ==========================================
app.get('/api/usage', authenticateToken, async (req, res) => {
    try {
        const userEmail = req.user.email;
        // 1. 获取最新用户数据
        const user = await db.collection('users').findOne({ email: userEmail });
        if (!user) return res.status(404).json({ message: "User not found" });

        // 2. 计算基础数据
        const plan = user.plan || 'basic';
        const usageCount = user.usageCount || 0;
        const totalLimit = plan === 'pro' ? 1000 : 10; // Pro给1000次，Basic给10次
        const remaining = totalLimit - usageCount;

        // 3. 计算时间数据
        const now = new Date();
        const joinDate = new Date(user.createdAt || new Date()); // 如果没有注册时间，就按今天算
        
        // 计算活跃天数 (今天 - 注册那天)
        const diffTime = Math.abs(now - joinDate);
        const activeDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        // 计算剩余天数 (假设每月1号重置，或者简单的30天周期)
        // 这里简单处理：假设每个月30天，计算距离下个月1号还有几天
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysLeft = daysInMonth - now.getDate();

        res.json({
            plan: plan.toUpperCase(),
            used: usageCount,
            limit: plan === 'pro' ? 'Unlimited' : totalLimit,
            remaining: remaining < 0 ? 0 : remaining,
            daysLeft: daysLeft,
            activeDays: activeDays
        });

    } catch (error) {
        console.error("Usage Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
