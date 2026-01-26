import express from 'express';
import cors from 'cors';
import requestIp from 'request-ip';
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

// ==========================================
// 🟢 [完美版] 用量统计 (自动补全邀请码)
// ==========================================
app.get('/api/usage', authenticateToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) return res.status(401).json({ message: "Invalid Token" });

        // 1. 查找用户
        let user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
        if (!user) return res.status(404).json({ message: "User not found" });

        // 🟢 [核心修复]：如果是老用户(没有邀请码)，立刻生成一个并保存！
        if (!user.referralCode) {
            const rawName = user.name || user.email.split('@')[0];
            const cleanName = rawName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 3);
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            const newCode = `${cleanName}${randomNum}`;
            
            // 更新数据库
            await db.collection('users').updateOne(
                { _id: user._id },
                { $set: { referralCode: newCode } }
            );
            // 更新内存里的 user 对象，以便下面返回
            user.referralCode = newCode;
        }

        // 2. 计算限额逻辑 (保持不变)
        const plan = user.plan || 'basic';
        const usageCount = user.usageCount || 0;
        let totalLimit = 0;
        if (plan === 'free') totalLimit = 3;
        if (plan === 'basic') totalLimit = 45;

        const now = new Date();
        const joinDate = new Date(user.createdAt || now);
        const activeDays = Math.ceil(Math.abs(now - joinDate) / (86400000)) || 1;
        const daysLeft = 30 - now.getDate();

        // 3. 返回数据
        res.json({
            plan: plan.toUpperCase(),
            used: usageCount,
            limit: plan === 'pro' ? 'Unlimited' : totalLimit,
            remaining: plan === 'pro' ? 9999 : Math.max(0, totalLimit - usageCount),
            daysLeft: daysLeft > 0 ? daysLeft : 1,
            activeDays: activeDays,
            bonusCredits: user.bonusCredits || 0,
            referralCode: user.referralCode // 现在绝对会有值了！
        });

    } catch (error) {
        console.error("Usage API Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
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

// ==========================================
// 🟢 [升级版] 注册接口 (IP防刷 + 邀请奖励)
// ==========================================
app.post('/api/register', async (req, res) => {
    try {
        // 注意：你原代码用的是 displayName，这里保持一致，并增加了 inviteCode
        const { displayName, email, password, inviteCode } = req.body;
        
        // 1. 获取客户端 IP
        const clientIp = requestIp.getClientIp(req);

        // 2. 检查 1 小时内同 IP 注册频率 (防脚本)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const ipCount = await db.collection('users').countDocuments({
            registrationIp: clientIp,
            createdAt: { $gt: oneHourAgo }
        });
        if (ipCount >= 5) {
            return res.status(429).json({ message: "Too many registrations from this IP." });
        }

        // 3. 检查邮箱是否存在
        const existing = await db.collection('users').findOne({ email });
        if (existing) return res.status(400).json({ message: "Email exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 4. 生成邀请码 (使用 displayName 或 email 前缀)
        const rawName = displayName || email.split('@')[0];
        const cleanName = rawName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 3);
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const myReferralCode = `${cleanName}${randomNum}`;

        let initialBonus = 0;
        let validReferredBy = null;

        // 5. 处理邀请逻辑
        if (inviteCode) {
            const referrer = await db.collection('users').findOne({ referralCode: inviteCode });
            if (referrer) {
                // 防刷：如果注册IP和邀请人IP相同，不给奖励
                if (referrer.registrationIp === clientIp) {
                    console.log(`Fraud Risk: Referrer IP matches New IP ${clientIp}`);
                } else {
                    validReferredBy = referrer._id;
                    initialBonus = 5; // 新人奖励 5 次

                    // 给邀请人 +5 次 (封顶 50)
                    if ((referrer.bonusCredits || 0) < 50) {
                        await db.collection('users').updateOne(
                            { _id: referrer._id },
                            { $inc: { bonusCredits: 5 } } 
                        );
                    }
                }
            }
        }

        // 6. 写入数据库 (保留原有的 plan: basic 和 role: user)
        await db.collection('users').insertOne({ 
            name: displayName, // 保持你原有的字段名 name
            email, 
            password: hashedPassword, 
            plan: 'basic', 
            role: 'user', 
            
            // 新增字段
            usageCount: 0,
            bonusCredits: initialBonus, 
            referralCode: myReferralCode,
            referredBy: validReferredBy,
            registrationIp: clientIp,
            createdAt: new Date() 
        });

        res.status(201).json({ message: "Success", referralCode: myReferralCode });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ message: "Error" }); 
    }
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
// ==========================================
// 🟢 [升级版] 生成接口 (含自动扣费逻辑)
// ==========================================
app.post('/api/generate', authenticateToken, async (req, res) => {
    try {
        // 1. 获取用户
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
        if (!user) return res.status(404).json({ error: "User not found" });

        // 2. 🟢 核心检查：够不够扣？
        let allowGen = false;
        let deductSource = ''; // 'main' 或 'bonus'

        if (user.plan === 'pro') {
            allowGen = true; // Pro 无限
        } else {
            let limit = (user.plan === 'free') ? 3 : 45; 
            if (user.plan === 'basic') limit = 45; 

            // 先查主油箱
            if ((user.usageCount || 0) < limit) {
                allowGen = true;
                deductSource = 'main';
            } 
            // 再查备用油箱
            else if ((user.bonusCredits || 0) > 0) {
                allowGen = true;
                deductSource = 'bonus';
            }
        }

        if (!allowGen) {
            return res.status(403).json({ error: "Limit reached! Invite friends to get more credits." });
        }

        // 3. 调用 AI (你原本的逻辑)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
        const result = await model.generateContent(req.body.userPrompt || "Hello");
        const text = result.response.text();

        // 4. 保存报告 (保留)
        await db.collection('reports').insertOne({ 
            userId: req.user.userId, 
            title: "Generated Report", 
            content: text, 
            createdAt: new Date() 
        });

        // 5. 🟢 扣费 (生成成功才扣)
        if (deductSource === 'main') {
            await db.collection('users').updateOne({ _id: user._id }, { $inc: { usageCount: 1 } });
        } else if (deductSource === 'bonus') {
            await db.collection('users').updateOne({ _id: user._id }, { $inc: { bonusCredits: -1 } });
        }

        res.json({ generatedText: text });

    } catch (e) { 
        console.error("AI Error:", e);
        res.status(500).json({ error: "AI Error" }); 
    }
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
