import express from 'express';
import cors from 'cors';
import requestIp from 'request-ip';
import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai"; 
import { MongoClient, ObjectId } from 'mongodb'; 
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';
import crypto from 'crypto';

// Path definitions
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
// Commercial HTTP Email Engine
const resend = new Resend(process.env.RESEND_API_KEY);

// 1. Core Config
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY; // 🟢 引入 DeepSeek 秘钥
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID; 
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
/** PWA shell: never hardcode production domain — set FRONTEND_URL for local/dev (e.g. http://localhost:8080) */
const FRONTEND_BASE = (process.env.FRONTEND_URL || 'https://goreportify.com').replace(/\/$/, '');

// 2. Database Connection
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

// --- 底层通用站内信发送引擎 ---
async function sendSystemMessage(email, type, message) {
    try {
        await db.collection('feedbacks').insertOne({
            email: email,
            name: 'System', 
            type: type, 
            message: 'System Notification', 
            status: 'replied', 
            reply: message, 
            submittedAt: new Date(),
            repliedAt: new Date()
        });
    } catch (error) {
        console.error("Failed to send system message:", error);
    }
}
// ----------------------------------------

// 3. CORS Config
app.use(cors({ 
    origin: true, 
    credentials: true, 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'] 
}));
app.use(express.json());

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Absolute path for multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'uploads')); 
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Auth Middleware
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

// ======================= Routes =======================

app.get('/', (req, res) => res.send('Backend Online'));

// Templates API
app.get('/api/templates', async (req, res) => {
    const templates = [
        { _id: 'daily_standup', title: 'Daily Standup ', category: 'Routine', isPro: false },
        { _id: 'weekly_pulse', title: 'Weekly Pulse ', category: 'Routine', isPro: false },
        { _id: 'monthly_review', title: 'Monthly Review ', category: 'Routine', isPro: true },
        { _id: 'quarterly_report', title: 'Quarterly Analysis ', category: 'Strategic', isPro: true },
        { _id: 'annual_summary', title: 'Annual Report', category: 'Strategic', isPro: true },
        { _id: 'project_proposal', title: 'Project Proposal ', category: 'Strategic', isPro: true },
        { _id: 'meeting_minutes', title: 'Meeting Minutes ', category: 'Professional', isPro: false },
        { _id: 'research_summary', title: 'Research Summary ', category: 'Professional', isPro: true },
        { _id: 'incident_report', title: 'Incident Report ', category: 'Professional', isPro: true },
        { _id: 'marketing_copy', title: 'Marketing Copy ', category: 'Marketing', isPro: true },
        { _id: 'social_media', title: 'Social Media Post ', category: 'Marketing', isPro: false }
    ];
    res.json(templates);
});

/** OAuth state: native Capacitor app must finish on custom URL scheme (see oauth-native-bridge.html + App.addListener('appUrlOpen')). */
const GOOGLE_OAUTH_STATE_WEB = 'web';
const GOOGLE_OAUTH_STATE_CAPACITOR = 'capacitor_native_v1';

/** Short-lived bridge id → JWT so intent:// URLs stay small (Chrome often fails on very long custom-scheme links). */
const oauthBridgeStore = new Map();
function createOAuthBridgeEntry(jwt) {
    const id = crypto.randomBytes(16).toString('base64url');
    const exp = Date.now() + 5 * 60 * 1000;
    oauthBridgeStore.set(id, { token: jwt, exp });
    setTimeout(() => oauthBridgeStore.delete(id), 5 * 60 * 1000);
    return id;
}

// Google Auth Redirect
app.get('/auth/google', (req, res) => {
    const redirectUri = 'https://api.goreportify.com/api/auth/google/callback';
    const nativeApp =
        req.query.native_app === '1' ||
        req.query.app === '1' ||
        req.query.capacitor === '1';
    const state = nativeApp ? GOOGLE_OAUTH_STATE_CAPACITOR : GOOGLE_OAUTH_STATE_WEB;
    const url =
        `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code&scope=${encodeURIComponent('email profile openid')}` +
        `&state=${encodeURIComponent(state)}`;
    res.redirect(url);
});

/** App exchanges bridge id (from deep link) for JWT once; id is removed after use. */
app.get('/api/oauth/bridge-token', (req, res) => {
    const id = req.query.bridge;
    if (!id || typeof id !== 'string' || id.length > 128) {
        return res.status(400).json({ message: 'invalid' });
    }
    const rec = oauthBridgeStore.get(id);
    if (!rec || rec.exp < Date.now()) {
        return res.status(400).json({ message: 'expired' });
    }
    oauthBridgeStore.delete(id);
    res.json({ token: rec.token });
});

// Usage Stats API
app.get('/api/usage', authenticateToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) return res.status(401).json({ message: "Invalid Token" });

        let user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (!user.referralCode) {
            const rawName = user.name || user.email.split('@')[0];
            const cleanName = rawName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 3);
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            const newCode = `${cleanName}${randomNum}`;
            
            await db.collection('users').updateOne(
                { _id: user._id },
                { $set: { referralCode: newCode } }
            );
            user.referralCode = newCode;
        }

        const now = new Date();
        const joinDate = user.createdAt ? new Date(user.createdAt) : user._id.getTimestamp();
        const activeDays = Math.ceil(Math.abs(now - joinDate) / (86400000)) || 1;

        if (user.plan !== 'free' && user.planExpiresAt && now > new Date(user.planExpiresAt)) {
            await db.collection('users').updateOne({ _id: user._id }, { $set: { plan: 'free', planExpiresAt: null, usageCount: 0 } });
            user.plan = 'free'; 
            user.usageCount = 0;
        }

        let daysLeft = 0;
        const currentPlan = user.plan || 'free';

        let displayPlan = currentPlan; 
        if (currentPlan === 'free') {
            const trialDays = 7;
            const daysPassed = Math.floor((now - joinDate) / 86400000);
            daysLeft = Math.max(0, trialDays - daysPassed);
            if (daysLeft === 0) displayPlan = 'expired';
        } else if (user.planExpiresAt) {
            daysLeft = Math.ceil((new Date(user.planExpiresAt) - now) / 86400000);
            daysLeft = Math.max(0, daysLeft);
        } else {
            daysLeft = 30;
        }

        let baseLimit = currentPlan === 'free' ? 21 : (currentPlan === 'basic' ? 45 : '∞');
        let finalTotalLimit = baseLimit === '∞' ? '∞' : baseLimit + (user.bonusCredits || 0);
        let finalRemaining = baseLimit === '∞' ? '∞' : Math.max(0, finalTotalLimit - (user.usageCount || 0));

        res.json({
            plan: displayPlan === 'expired' ? 'EXPIRED' : displayPlan.toUpperCase(),
            used: user.usageCount || 0,
            limit: finalTotalLimit,
            remaining: finalRemaining,
            daysLeft: daysLeft > 0 ? daysLeft : 0,
            activeDays: activeDays,
            bonusCredits: user.bonusCredits || 0,
            invitedCount: user.invitedCount || 0, 
            referralCode: user.referralCode
        });

    } catch (error) {
        console.error("Usage API Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

// Google Callback
app.get('/api/auth/google/callback', async (req, res) => {
    const state = req.query.state || '';
    const useNativeReturn = state === GOOGLE_OAUTH_STATE_CAPACITOR;

    if (req.query.error) {
        const msg = req.query.error_description || req.query.error || 'access_denied';
        if (useNativeReturn) {
            return res.redirect(
                `${FRONTEND_BASE}/oauth-native-bridge.html?error=${encodeURIComponent(msg)}`
            );
        }
        return res.redirect(`${FRONTEND_BASE}/?error=google_login_failed`);
    }

    const code = req.query.code;
    if (!code) {
        if (useNativeReturn) {
            return res.redirect(
                `${FRONTEND_BASE}/oauth-native-bridge.html?error=${encodeURIComponent('missing_code')}`
            );
        }
        return res.redirect(`${FRONTEND_BASE}/?error=google_login_failed`);
    }

    try {
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
            code: code, grant_type: 'authorization_code',
            redirect_uri: 'https://api.goreportify.com/api/auth/google/callback'
        });
        const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });
        
        const { email, name, picture } = userRes.data; 
        const cleanEmail = email.toLowerCase().trim();
        
        let user = await db.collection('users').findOne({ email: cleanEmail });
        if (!user) {
            const isBlacklisted = await db.collection('used_trials').findOne({ email: cleanEmail });
            const startingPlan = isBlacklisted ? 'expired' : 'free';

            const result = await db.collection('users').insertOne({ 
                name, email: cleanEmail, picture,
                password: null, authProvider: 'google', plan: startingPlan, createdAt: new Date() 
            });
            user = { _id: result.insertedId, plan: startingPlan };
        } else {
            await db.collection('users').updateOne({ email: cleanEmail }, { $set: { picture: picture } });
        }

        const token = jwt.sign({ userId: user._id, plan: user.plan }, JWT_SECRET, { expiresIn: '7d' });
        if (useNativeReturn) {
            const bridgeId = createOAuthBridgeEntry(token);
            return res.redirect(
                `${FRONTEND_BASE}/oauth-native-bridge.html?bridge=${encodeURIComponent(bridgeId)}`
            );
        }
        res.redirect(`${FRONTEND_BASE}/?token=${encodeURIComponent(token)}`);
    } catch (error) { 
        console.error("Google Login Error:", error);
        if (useNativeReturn) {
            return res.redirect(
                `${FRONTEND_BASE}/oauth-native-bridge.html?error=${encodeURIComponent('google_login_failed')}`
            );
        }
        res.redirect(`${FRONTEND_BASE}/?error=google_login_failed`); 
    }
});

// Registration API
app.post('/api/register', async (req, res) => {
    try {
        const { displayName, email, password, code, inviteCode } = req.body;
        const clientIp = requestIp.getClientIp(req);
        const cleanEmail = email.toLowerCase().trim();

        if (!code) return res.status(400).json({ message: "Verification code is required." });
        
        const codeRecord = await db.collection('signup_codes').findOne({ email: cleanEmail, code: code, used: false });
        if (!codeRecord) return res.status(400).json({ message: "Invalid or incorrect verification code." });
        if (new Date() > codeRecord.expiresAt) return res.status(400).json({ message: "Code expired. Please request a new one." });

        await db.collection('signup_codes').updateOne({ _id: codeRecord._id }, { $set: { used: true } });

        const isBlacklisted = await db.collection('used_trials').findOne({ email: cleanEmail });
        const startingPlan = isBlacklisted ? 'expired' : 'free'; 
        
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const ipCount = await db.collection('users').countDocuments({
            registrationIp: clientIp,
            createdAt: { $gt: oneHourAgo }
        });
        if (ipCount >= 5) return res.status(429).json({ message: "Too many registrations from this IP." });

        const existing = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
        if (existing) return res.status(400).json({ message: "Email exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const rawName = displayName || email.split('@')[0];
        const cleanName = rawName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 3);
        const myReferralCode = `${cleanName}${Math.floor(1000 + Math.random() * 9000)}`;

        let initialBonus = 0;
        let validReferredBy = null;

        if (inviteCode) {
            const referrer = await db.collection('users').findOne({ referralCode: inviteCode });
            if (referrer && referrer.registrationIp !== clientIp) {
                if ((referrer.invitedCount || 0) < 5) { 
                    validReferredBy = referrer._id;
                    initialBonus = 5; 

                    let adminMessage = '';
                    if (referrer.plan === 'pro') {
                        if (referrer.planExpiresAt) {
                            const newExpiry = new Date(referrer.planExpiresAt);
                            newExpiry.setDate(newExpiry.getDate() + 1);
                            await db.collection('users').updateOne({ _id: referrer._id }, { $set: { planExpiresAt: newExpiry }, $inc: { invitedCount: 1 } });
                        }
                        adminMessage = `Awesome! Someone joined using your invite link. As a Pro user, we've extended your membership by +1 Day!`;
                    } else {
                        await db.collection('users').updateOne({ _id: referrer._id }, { $inc: { bonusCredits: 5, invitedCount: 1 } });
                        adminMessage = `Awesome! Someone joined using your invite link. We've added +5 Free Reports to your account!`;
                    }

                    await db.collection('feedbacks').insertOne({
                        email: referrer.email,
                        name: 'System',
                        type: 'Reward Notification',
                        message: `Invitation Successful`,
                        status: 'replied',
                        reply: adminMessage,
                        submittedAt: new Date(),
                        repliedAt: new Date()
                    });
                }
            }
        }

        await db.collection('users').insertOne({ 
            name: displayName, email: email.toLowerCase().trim(), password: hashedPassword, 
            plan: startingPlan, 
            role: 'user', usageCount: 0, bonusCredits: initialBonus, 
            referralCode: myReferralCode, referredBy: validReferredBy,
            registrationIp: clientIp, createdAt: new Date() 
        });

        let welcomeMessage = `Welcome aboard! Your account is successfully created, and your trial access is now active. You can start turning your rough notes into executive-ready Word reports and PPT decks immediately. If you need any help or have suggestions, our support team is just a click away in this Message Center. Let’s boost your productivity!`;
        
        if (validReferredBy) {
            welcomeMessage += `\n\n🎁 Bonus: Because you joined via a referral link, we've instantly credited your account with exclusive bonus credits! Enjoy your upgraded trial!`;
        }
        
        await sendSystemMessage(cleanEmail.toLowerCase(), '🎉 Welcome to Reportify AI!', welcomeMessage);

        res.status(201).json({ message: "Success", referralCode: myReferralCode });
    } catch (e) { 
        console.error(e); res.status(500).json({ message: "Error" }); 
    }
});

// Login API
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "Please fill in all fields" });

        const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
        
        if (!user) return res.status(400).json({ message: "Account does not exist" });
        
        if (!user.password && user.authProvider === 'google') {
            return res.status(400).json({ message: "Account created via Google. Please use Google Login." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Incorrect password" });

        const token = jwt.sign({ userId: user._id, email: user.email, plan: user.plan }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, message: "Login successful" });
    } catch (e) { 
        console.error("Login Error:", e);
        res.status(500).json({ error: "Internal Server Error" }); 
    }
});

// Send Registration Verification Code
app.post('/api/auth/send-signup-code', async (req, res) => {
    try {
        const { email } = req.body;
        const cleanEmail = email.toLowerCase().trim();

        const existingUser = await db.collection('users').findOne({ email: cleanEmail });
        if (existingUser) return res.status(400).json({ message: "Email already registered." });

        const signupCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); 

        await db.collection('signup_codes').updateOne(
            { email: cleanEmail },
            { $set: { code: signupCode, expiresAt, used: false } },
            { upsert: true }
        );

        const { error } = await resend.emails.send({
            from: 'Reportify AI Welcome <noreply@goreportify.com>', 
            to: cleanEmail,
            subject: 'Reportify AI - Your Registration Code',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-w: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #2563eb;">Welcome to Reportify AI</h2>
                    <p>Hello,</p>
                    <p>Thank you for signing up. Your 6-digit registration verification code is:</p>
                    <div style="background: #f3f4f6; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                        <h1 style="color: #1f2937; letter-spacing: 8px; margin: 0; font-size: 32px;">${signupCode}</h1>
                    </div>
                    <p style="font-size: 14px; color: #666;">⚠️ This code will expire in <strong>10 minutes</strong>.</p>
                </div>
            `
        });

        if (error) {
            console.error("Resend API Error:", error);
            return res.status(500).json({ message: "Failed to send email via API." });
        }

        res.json({ message: "Verification code sent." });
    } catch (e) {
        console.error("Send Signup Code Error:", e);
        res.status(500).json({ message: "Server error." });
    }
});

// Password Reset: Send Code
app.post('/api/auth/send-reset-code', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
        if (!user) return res.status(404).json({ message: "Account not found with this email." });
        if (user.authProvider === 'google' && !user.password) return res.status(400).json({ message: "Google users do not need a password." });

        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); 

        await db.collection('password_resets').updateOne(
            { email: user.email },
            { $set: { code: resetCode, expiresAt, used: false } },
            { upsert: true }
        );

        const { data, error } = await resend.emails.send({
            from: 'Reportify AI Security <noreply@goreportify.com>', 
            to: user.email,
            subject: 'Reportify AI - Password Reset Code',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-w: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #2563eb;">Reset Your Password</h2>
                    <p>Hello,</p>
                    <p>We received a request to reset your Reportify AI password. Your 6-digit verification code is:</p>
                    <div style="background: #f3f4f6; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                        <h1 style="color: #1f2937; letter-spacing: 8px; margin: 0; font-size: 32px;">${resetCode}</h1>
                    </div>
                    <p style="font-size: 14px; color: #666;">⚠️ This code will expire in <strong>10 minutes</strong>.</p>
                    <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">If you did not request this, please ignore this email. Your account is safe.</p>
                </div>
            `
        });

        if (error) {
            console.error("Resend API Error:", error);
            return res.status(500).json({ message: "Failed to send email via API." });
        }

        res.json({ message: "Verification code sent." });
    } catch (e) {
        console.error("Send Reset Code Error:", e);
        res.status(500).json({ message: "Failed to process request." });
    }
});

// Password Reset: Verify & Update
app.post('/api/auth/verify-and-reset', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        const resetRecord = await db.collection('password_resets').findOne({ email: email.toLowerCase().trim(), code: code, used: false });

        if (!resetRecord) return res.status(400).json({ message: "Invalid verification code." });
        if (new Date() > resetRecord.expiresAt) return res.status(400).json({ message: "Code expired. Please request a new one." });

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.collection('users').updateOne({ email: email.toLowerCase().trim() }, { $set: { password: hashedNewPassword } });
        await db.collection('password_resets').updateOne({ _id: resetRecord._id }, { $set: { used: true } });

        res.json({ message: "Password reset successful." });
    } catch (e) { res.status(500).json({ message: "Reset failed. Please try again." }); }
});

// Get Current User Profile
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(req.user.userId) }, 
            { projection: { password: 0 } }
        );
        
        if (!user) return res.status(404).json({ message: "User not found" });

        const usageCount = await db.collection('reports').countDocuments({ userId: req.user.userId });

        res.json({ ...user, usageCount });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Error" });
    }
});

// Avatar Upload
app.post('/api/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        
        const avatarUrl = `/uploads/${req.file.filename}`;
        
        await db.collection('users').updateOne(
            { _id: new ObjectId(req.user.userId) },
            { $set: { picture: avatarUrl } } 
        );
        
        res.json({ message: 'Upload successful', avatarUrl });
    } catch (e) {
        console.error("Upload failed details:", e); 
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Update Profile Data
app.post('/api/update-profile', authenticateToken, async (req, res) => {
    try {
        const { name, job, bio } = req.body;
        
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (job !== undefined) updateData.job = job; 
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

// --- AI Generation Engine ---
const genAI = new GoogleGenerativeAI(API_KEY);

app.post('/api/generate', authenticateToken, async (req, res) => {
    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
        if (!user) return res.status(404).json({ error: "User not found" });

        const now = new Date();
        let userPlan = (user.plan || 'free').toLowerCase().trim();

        // 🔒 Time Limit Check
        let isTimeExpired = false;

        if (userPlan === 'pro' || userPlan === 'basic') {
            if (user.planExpiresAt && now > new Date(user.planExpiresAt)) {
                isTimeExpired = true;
                await db.collection('users').updateOne({ _id: user._id }, { $set: { plan: 'free', planExpiresAt: null, usageCount: 0 } });
                userPlan = 'free';
                user.usageCount = 0;
            }
        }

        if (userPlan === 'free') {
            const joinDate = user.createdAt ? new Date(user.createdAt) : user._id.getTimestamp();
            const daysPassed = (now - joinDate) / (1000 * 60 * 60 * 24); 
            if (daysPassed >= 7) {
                isTimeExpired = true;
            }
        }

        if (isTimeExpired) {
            return res.status(403).json({ error: "Your plan or trial has expired! Please upgrade to continue." });
        }

        // 🔒 Count Limit Check
        let allowGen = false;
        const isPro = userPlan === 'pro';
        
        let baseLimit = userPlan === 'free' ? 21 : (userPlan === 'basic' ? 45 : Infinity);
        let bonus = parseInt(user.bonusCredits) || 0;
        let finalTotalLimit = baseLimit === Infinity ? Infinity : baseLimit + bonus;
        let usedCount = parseInt(user.usageCount) || 0;

        if (isPro) {
            allowGen = true; 
        } else {
            if (usedCount < finalTotalLimit) {
                allowGen = true;
            }
        }

        if (!allowGen) {
            return res.status(403).json({ error: "Usage limit reached! Invite friends to get more credits or upgrade to Pro." });
        }

        // 🔒 字符截断防爆闸门 (防止黑客提交百万字导致破产)
        const rawUserPrompt = req.body.userPrompt || "";
        const safeUserPrompt = rawUserPrompt.substring(0, 2000); 

        const { role, templateId, tone, detailLevel, language } = req.body;

        const roleMapping = {
            "General": "Standard corporate professional. Focus on task execution details, collaboration progress, and timely delivery.",
            "Administrative": "Administrative/Operations manager. Focus on process compliance, team support, resource coordination, and daily efficiency.",
            "Freelancer": "Independent creator/Freelancer. Showcase personal delivery value, client feedback, project milestones, and innovations.",
            "Tech": "Senior Developer/Engineer. MUST include deep technical details, system architecture evolution, code refactoring, bug fixes, and overcoming technical difficulties.",
            "Marketing": "Marketing Expert. Focus on brand exposure, channel conversion rates, ROI/CAC data analysis, and market trend insights.",
            "Sales": "Elite Sales/Business Director. Core focus on sales funnel, Key Account (KA) follow-ups, lead conversion, performance achievement rates, and profit growth.",
            "Management": "Team Leader/Project Manager. Stand at a management perspective, focusing on team efficiency, project milestones, cross-departmental collaboration, and risk warnings.",
            "Executive": "Company Executive (CEO/CTO). Possess a macro-strategic height, focusing on business models, industry barriers, Profit & Loss (P&L), and strategic layout."
        };

        const typeMapping = {
            "general": "Comprehensive general report: Summarize core matters with clear structure and priorities.",
            "daily_standup": "Daily Standup: Compact format, strictly following 'Completed yesterday, Planned today, Blockers'.",
            "weekly_pulse": "Weekly Pulse: Extract this week's core achievements, data metric changes, deep-seated issues exposed, and next week's plan.",
            "project_update": "Project Status Update: Clarify project phases, milestone achievements, budget/time consumption, and Next Steps.",
            "monthly_review": "Monthly Deep Review: Systematic induction, comparing monthly goals with actual achievements (OKRs/KPIs), including deep insights and improvement strategies.",
            "quarterly_report": "Quarterly/Annual Strategic Report: Extremely deep, including macro market environment analysis, strategic execution results, and core financial/business data inventory."
        };

        const toneMapping = {
            "Grounded": "Grounded and practical. No nonsense, matter-of-fact, directly addressing pain points and solutions.",
            "Professional": "Highly professional and rigorous. Use industry-standard terminology, tight structural logic, reflecting high professionalism, suitable for reporting to top management.",
            "Conversational": "Conversational and casual. Approachable, highly engaging, suitable for internal team syncs and building cohesion.",
            "Persuasive": "Highly persuasive and bold. Emphasize outcome value, speak with data, with a strong intent to drive decisions and secure resources."
        };

        const detailMapping = {
            "Brief": "Concise and brief. Focus on core conclusions and bullet points. Discard lengthy background descriptions. Total length: 300-500 words.",
            "Standard": "Balanced detail. Expand on important matters with background and results, gloss over minor ones. Balanced structure. Total length: 600-800 words.",
            "Detailed": "CRITICAL INSTRUCTION: You MUST perform an EXTREMELY DEEP and exhaustive expansion. For EVERY single point provided by the user, you MUST generate comprehensive paragraphs covering: [1. Strategic Background & Pain Points] -> [2. Detailed Execution Steps & Methodologies] -> [3. Quantitative Outcomes & Data Metrics] -> [4. Deep Reflection & Future Roadmap]. NEVER just list bullet points. Use highly professional vocabulary and fabricate reasonable logical details to make it full. Total length MUST strictly exceed 1500 words!"
        };

        const formatInstructions = isPro 
            ? `[OUTPUT FORMAT REQUIREMENTS]\nDO NOT use JSON formatting. You MUST return pure text using EXACTLY these boundaries. Do not add markdown code blocks around them:\n\n===WORD_CONTENT_START===\n[Insert full, deeply expanded markdown report here based on the instructions]\n===WORD_CONTENT_END===\n\n===PPT_OUTLINE_START===\n[Extract a 5-8 slides PPT outline from the report. Use Markdown format with Slide titles and bullet points]\n===PPT_OUTLINE_END===\n\n===EMAIL_SUMMARY_START===\n[Extract a 3-5 lines executive summary. CRITICAL: This must be PURELY OBJECTIVE conclusions and strategic outlook. DO NOT include ANY letter salutations or sign-offs (e.g., NO "Dear Team", NO "尊敬的领导"). Just the core insights.]\n===EMAIL_SUMMARY_END===`
            : `[OUTPUT FORMAT REQUIREMENTS]\nDO NOT use JSON formatting. You MUST return pure text using EXACTLY these boundaries. Do not add markdown code blocks around them:\n\n===WORD_CONTENT_START===\n[Insert full, deeply expanded markdown report here based on the instructions]\n===WORD_CONTENT_END===`;

        let finalSystemInstructions = `You are RIE (Reportify Intelligence Engine) Flagship Edition - the world's top workplace report generation brain.
        Your task is to take the user's extremely brief, fragmented prompts and [Deeply Expand] them into a highly professional document through strong logical reasoning and workplace experience.

        [Core Generation Dimensions]
        1. Your Workplace Persona: ${roleMapping[role] || roleMapping["General"]}
        2. Current Report Context: ${typeMapping[templateId] || typeMapping["general"]}
        3. Tone & Style to Maintain: ${toneMapping[tone] || toneMapping["Professional"]}
        4. Report Length & Expansion Requirement: ${detailMapping[detailLevel] || detailMapping["Standard"]}
        5. Output Language: Strictly use ${language || "English"} for all output content.

        [Unbreakable Iron Rules]
        - STRICTLY FORBIDDEN to simply repeat the user's prompts! You MUST actively imagine reasonable details and invent logical data metrics (e.g., increased by 15%, decreased by 20%) based on the set [Persona] and [Context], making the report look like a real, content-rich work summary.
        - The main body MUST use high-quality Markdown formatting (#, ##, **, blockquotes, etc.) to make it visually clear and readable.

        ${formatInstructions}`;

        const expandedUserPrompt = `Here are the rough bullet points of my work/thoughts today:\n"${safeUserPrompt}"\n\nPlease immediately deeply reconstruct and significantly expand this into a final professional report based on your system instructions, persona, and style settings.`;

        let rawText = "";

        // ==========================================
        // 💎 智能算力分层路由 (Tier-Based Routing)
        // ==========================================
        if (userPlan === 'basic' && DEEPSEEK_KEY) {
            // ⚡ 梯队 B：Basic 用户调用 DeepSeek V3 (性价比无敌)
            console.log("⚡ [Basic] Routing to DeepSeek V3 API...");
            try {
                const dsResponse = await axios.post(
                    'https://api.deepseek.com/chat/completions',
                    {
                        model: 'deepseek-chat',
                        messages: [
                            { role: 'system', content: finalSystemInstructions },
                            { role: 'user', content: expandedUserPrompt }
                        ],
                        max_tokens: 2048,
                        temperature: 0.7
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${DEEPSEEK_KEY}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                rawText = dsResponse.data.choices[0].message.content;
            } catch (dsError) {
                console.error("❌ DeepSeek API Failed:", dsError.response?.data || dsError.message);
                throw new Error("AI Service Currently Unavailable");
            }

        } else {
            // 💎 梯队 A：Pro / 7天试用新用户调用 Gemini 3 Flash Preview (旗舰品质)
            console.log(`💎 [${userPlan.toUpperCase()}] Routing to Google Gemini 3 Flash Preview...`);
            try {
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-3-flash-preview",
                    systemInstruction: finalSystemInstructions 
                });
                const result = await model.generateContent({ 
                    contents: [{ role: 'user', parts: [{ text: expandedUserPrompt }] }],
                    generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }
                });
                rawText = result.response.text();
            } catch (geminiError) {
                console.error("❌ Gemini API Failed:", geminiError.message);
                throw new Error("AI Service Currently Unavailable");
            }
        }

        let wordContent = rawText;
        let pptOutline = "";
        let emailSummary = "";

        if (rawText.includes("===WORD_CONTENT_START===")) {
            const extractSection = (text, tag) => {
                const startMarker = `===${tag}_START===`;
                const endMarker = `===${tag}_END===`;
                const sIdx = text.indexOf(startMarker);
                const eIdx = text.indexOf(endMarker);
                if (sIdx !== -1 && eIdx !== -1 && eIdx > sIdx) {
                    return text.substring(sIdx + startMarker.length, eIdx).trim();
                }
                return "";
            };

            const extractedWord = extractSection(rawText, "WORD_CONTENT");
            if (extractedWord) wordContent = extractedWord;
            pptOutline = extractSection(rawText, "PPT_OUTLINE");
            emailSummary = extractSection(rawText, "EMAIL_SUMMARY");
        }

        await db.collection('reports').insertOne({ 
            userId: req.user.userId, 
            title: "Generated Report", 
            content: wordContent, 
            templateId: templateId || 'general',
            emailSummary: emailSummary || "",
            createdAt: new Date() 
        });

        if (!isPro) {
            await db.collection('users').updateOne({ _id: user._id }, { $inc: { usageCount: 1 } });
        }

        if (usedCount === 0) {
            const networkMessage = `Dear user, congratulations on generating your first professional report! \n\nA quick tip: if you ever experience a network fluctuation, accidentally close the page, or feel it's taking too long while a report is generating, don't worry! Our AI engine completes the task safely in the background.\n\nYou can always click on "My Account -> History" to view and securely download your generated Word or PPT files. We never let your credits go to waste!`;
            
            await sendSystemMessage(user.email, '📝 Tip: Report Saved & Network Protection', networkMessage);
        }

        if (isPro) {
            res.json({ generatedText: wordContent, pptOutline: pptOutline, emailSummary: emailSummary });
        } else {
            res.json({ generatedText: wordContent });
        }

    } catch (e) { 
        console.error("AI Generation Error:", e.message);
        res.status(500).json({ error: "System Error: " + e.message }); 
    }
}); 

// Legacy history endpoint
app.get('/api/reports/history', authenticateToken, async (req, res) => {
    const reports = await db.collection('reports').find({ userId: req.user.userId }).sort({ createdAt: -1 }).toArray();
    res.json(reports);
});

// Contact Messages
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

// Admin Reply
app.post('/api/admin/reply', authenticateToken, async (req, res) => {
    try {
        const adminUser = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ error: "Access denied" });
        }

        const { feedbackId, replyContent } = req.body;
        
        if (!feedbackId || !replyContent) {
            return res.status(400).json({ error: "Missing ID or content" });
        }

        const possibleCollections = ['contact_messages', 'feedbacks', 'messages', 'contacts'];
        let feedback = null;
        let targetCollection = '';

        for (const colName of possibleCollections) {
            const found = await db.collection(colName).findOne({ _id: new ObjectId(feedbackId) });
            if (found) {
                feedback = found;
                targetCollection = colName;
                break; 
            }
        }

        if (!feedback) {
            return res.status(404).json({ error: "Message not found (Check DB collection name)" });
        }

        const newReply = {
            role: 'admin',
            message: replyContent,
            createdAt: new Date()
        };

        await db.collection(targetCollection).updateOne(
            { _id: new ObjectId(feedbackId) },
            { 
                $push: { conversation: newReply },
                $set: { status: 'replied', reply: replyContent, repliedAt: new Date() }
            }
        );

        try {
            await resend.emails.send({
                from: 'Reportify Support <noreply@goreportify.com>',
                to: feedback.email,
                subject: 'New Reply from Reportify AI',
                text: `Hello ${feedback.name},\n\nAdmin has replied:\n\n"${replyContent}"\n\nLogin to view full history in your Message Center.\n\nBest,\nReportify Team`
            });
        } catch (emailErr) {
            console.error("Email sending skipped/failed:", emailErr.message);
        }

        res.json({ message: "Reply sent successfully" });

    } catch (error) {
        console.error("Reply API Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Admin Stats
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

// Admin Feedbacks
app.get('/api/admin/feedbacks', verifyAdmin, async (req, res) => {
    const msgs = await db.collection('feedbacks').find({}).sort({ submittedAt: -1 }).limit(50).toArray();
    res.json(msgs);
});

// Admin Users
app.get('/api/admin/users', verifyAdmin, async (req, res) => {
    const users = await db.collection('users').find({}, { projection: { password: 0 } }).sort({ createdAt: -1 }).limit(20).toArray();
    res.json(users);
});

// Get User History
app.get('/api/history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId; 
        const reports = await db.collection('reports')
            .find({ userId: userId }) 
            .sort({ createdAt: -1 }) 
            .toArray();

        res.json(reports);
        
    } catch (error) {
        console.error("History fetch failed:", error);
        res.status(500).json({ message: "Failed to fetch history" });
    }
});

// Delete History Item
app.delete('/api/history/:id', authenticateToken, async (req, res) => {
    try {
        const reportId = req.params.id;
        const userId = req.user.userId;

        const result = await db.collection('reports').deleteOne({
            _id: new ObjectId(reportId),
            userId: userId 
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Report not found or unauthorized" });
        }

        res.json({ message: "Report deleted successfully" });
    } catch (error) {
        console.error("Delete failed:", error);
        res.status(500).json({ message: "Delete failed" });
    }
});

// Upgrade Plan
app.post('/api/upgrade-plan', authenticateToken, async (req, res) => {
    try {
        const actualPlanId = req.body.planId || req.body.plan; 
        const paymentId = req.body.paymentId; 
        const userId = req.user.userId;

        if (!actualPlanId || !paymentId) {
            return res.status(400).json({ success: false, message: "Missing payment info. Please hard refresh (Ctrl+F5) and try again." });
        }

        try {
            const baseUrl = process.env.PAYPAL_MODE === 'sandbox' 
                ? 'https://api-m.sandbox.paypal.com' 
                : 'https://api-m.paypal.com';

            const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64');
            const tokenRes = await axios.post(`${baseUrl}/v1/oauth2/token`, 
                'grant_type=client_credentials', 
                { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            const accessToken = tokenRes.data.access_token;

            const orderRes = await axios.get(`${baseUrl}/v2/checkout/orders/${paymentId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (orderRes.data.status !== 'COMPLETED' && orderRes.data.status !== 'APPROVED') {
                return res.status(400).json({ success: false, message: "Payment not verified" });
            }
        } catch (verifyErr) {
            console.error("PayPal Verify Error (Check .env keys):", verifyErr.message);
            return res.status(400).json({ success: false, message: "Payment verification failed" });
        }

        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (user.plan === 'pro' && actualPlanId === 'basic') {
            return res.status(400).json({ success: false, message: "您当前是 Pro 专业版，享有最高权益。若需更换为 Basic 计划，请在当前 Pro 计划到期后再操作。" });
        }

        const expiryDate = new Date();
        const addDays = actualPlanId.includes('annual') ? 365 : 30; 
        const realPlanId = actualPlanId.replace('_annual', '');

        expiryDate.setDate(expiryDate.getDate() + addDays); 
        
        let updateFields = { plan: realPlanId, planExpiresAt: expiryDate, usageCount: 0 };
        
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateFields }
        );

        let logAmount = 9.90;
        if (actualPlanId === 'pro') logAmount = 19.90;
        else if (actualPlanId === 'basic_annual') logAmount = 99.00; 
        else if (actualPlanId === 'pro_annual') logAmount = 199.00;

        await db.collection('payments').insertOne({
            userId: new ObjectId(userId),
            planId: actualPlanId,
            paymentId: paymentId, 
            amount: logAmount,
            date: new Date(),
            status: 'completed'
        });

        const upgradeMessage = `Thank you for your purchase! Your account has been successfully upgraded. You now have unlocked the full power of the RIE Flagship Engine, including advanced features and priority processing. Dive in and experience the ultimate workflow automation!`;
        
        await sendSystemMessage(user.email, '💎 Upgrade Successful: Welcome to Premium!', upgradeMessage);

        res.json({ success: true, message: "Plan upgraded successfully" });
    } catch (error) {
        console.error("Upgrade Error:", error);
        res.status(500).json({ success: false, message: "Server error during upgrade" });
    }
});

// Change Password
app.post('/api/change-password', authenticateToken, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ message: "Please provide old and new password" });
        }

        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.authProvider === 'google' && !user.password) {
            return res.status(400).json({ message: "Google account does not require a password update." });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Incorrect old password!" }); 
        }

        const isSameAsOld = await bcrypt.compare(newPassword, user.password);
        if (isSameAsOld) {
            return res.status(400).json({ message: "New password cannot be the same as the old one!" });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.collection('users').updateOne(
            { _id: new ObjectId(req.user.userId) },
            { $set: { password: hashedNewPassword } }
        );

        res.json({ message: "Password updated successfully! Please log in again." });
    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Delete Account
app.delete('/api/delete-account', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        
        if (user) {
            await db.collection('used_trials').insertOne({ email: user.email, deletedAt: new Date() });
            await db.collection('reports').deleteMany({ userId: userId });
            const result = await db.collection('users').deleteOne({ _id: new ObjectId(userId) });
            
            if (result.deletedCount === 1) {
                return res.json({ message: "Account and data deleted successfully." });
            }
        }
        res.status(404).json({ message: "Account not found." });
    } catch (error) {
        console.error("Delete Account Error:", error);
        res.status(500).json({ message: "Failed to delete account." });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
