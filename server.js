// ==========================================
// 🟢 [修正版] 用量统计接口 (通过 userId 查找)
// ==========================================
app.get('/api/usage', authenticateToken, async (req, res) => {
    try {
        // 1. 调试日志：看看 Token 里到底有啥
        console.log("Current Token Payload:", req.user);

        // 2. 检查 userId (这是你 Token 里的真正字段)
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: "Invalid Token: Missing userId" });
        }

        // 3. 关键修正：用 _id 去数据库查找，而不是 email
        // 注意：必须使用 ObjectId 转换
        const user = await db.collection('users').findOne({ 
            _id: new ObjectId(req.user.userId) 
        });

        if (!user) return res.status(404).json({ message: "User not found in DB" });

        // 4. 计算基础数据
        const plan = user.plan || 'basic';
        const usageCount = user.usageCount || 0;
        const totalLimit = plan === 'pro' ? 1000 : 10;
        const remaining = totalLimit - usageCount;

        // 5. 计算时间
        const now = new Date();
        const joinDate = new Date(user.createdAt || now);
        // 计算活跃天数 (毫秒 -> 天)
        const activeDays = Math.ceil(Math.abs(now - joinDate) / (1000 * 60 * 60 * 24)) || 1;
        // 计算本月剩余天数
        const daysLeft = 30 - now.getDate();

        // 6. 返回数据
        res.json({
            plan: plan.toUpperCase(),
            used: usageCount,
            limit: plan === 'pro' ? 'Unlimited' : totalLimit,
            remaining: remaining < 0 ? 0 : remaining,
            daysLeft: daysLeft > 0 ? daysLeft : 1,
            activeDays: activeDays
        });

    } catch (error) {
        console.error("Usage API Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});
