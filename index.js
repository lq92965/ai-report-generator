import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import axios from 'axios';
import { MongoClient, ObjectId } from 'mongodb'; // Import ObjectId
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// --- 初始化應用和常量 ---
const app = express();
const port = process.env.PORT || 3000;
const API_KEY = process.env.GOOGLE_API_KEY;
const MODEL_NAME = 'gemini-1.0-pro'; // 使用我們確認可用的模型
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// --- 檢查環境變量 ---
if (!API_KEY || !MONGO_URI || !JWT_SECRET) {
  console.error("錯誤：請確保 .env 文件中已設置 GOOGLE_API_KEY, MONGO_URI, 和 JWT_SECRET");
  process.exit(1);
}

// --- 數據庫連接 ---
const client = new MongoClient(MONGO_URI);
let db;
let templatesCollection; // 定義 templates 集合變量
let usersCollection;     // 定義 users 集合變量

async function connectDB() {
  try {
    await client.connect();
    db = client.db('ReportifyAI'); // 使用您的數據庫名稱
    usersCollection = db.collection('users'); // 初始化 users 集合
    templatesCollection = db.collection('templates'); // 初始化 templates 集合
    // 為 userId 創建索引以加速模板查找
    await templatesCollection.createIndex({ userId: 1 });
    // 可選：為每個用戶的模板名稱創建唯一索引
    // await templatesCollection.createIndex({ userId: 1, templateName: 1 }, { unique: true });
    console.log("成功連接到 MongoDB Atlas 並初始化 Collections");
  } catch (error) {
    console.error("連接數據庫或創建索引失敗", error);
    process.exit(1);
  }
}
connectDB();

// --- 中間件設置 ---
// 允許來自您的前端域名的請求
app.use(cors({
  origin: 'https://goreportify.com' 
}));
app.use(express.json());

// --- JWT 驗證中間件 ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {
        console.log('驗證失敗：缺少 Token');
        return res.sendStatus(401); // 如果沒有 token
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT 驗證錯誤:", err.message); // 記錄驗證錯誤
            return res.sendStatus(403); // 如果 token 無效或密鑰錯誤
        }
        // 將驗證後的 userId (應該是 JWT 創建時的字符串) 附加到請求對象上
        req.userId = user.userId; 
        console.log(`Token 驗證成功，用戶 ID: ${req.userId}`); // 添加日誌
        next(); // 將執行權交給下一個請求處理程序
    });
};


// --- 健康檢查路由 ---
app.get('/', (req, res) => {
  res.status(200).send('Backend is running healthy!');
});

// --- 用戶認證 API ---
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "所有字段都是必填的" });
    if (!usersCollection) return res.status(500).json({ message: "數據庫連接未就緒" });

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "該郵箱已被註冊" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await usersCollection.insertOne({ name, email, password: hashedPassword, createdAt: new Date() }); 
    res.status(201).json({ message: "用戶註冊成功" });
  } catch (error) {
    console.error("註冊失敗:", error);
    res.status(500).json({ message: "伺服器內部錯誤" });
  }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "郵箱和密碼是必填的" });
         if (!usersCollection) return res.status(500).json({ message: "數據庫連接未就緒" });

        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(400).json({ message: "無效的郵箱或密碼" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "無效的郵箱或密碼" });

        // 確保 user._id 在簽發 token 前轉換為字符串
        const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '1d' }); 
        res.json({ token, message: "登錄成功" });
    } catch (error) {
        console.error("登錄失敗:", error);
        res.status(500).json({ message: "伺服器內部錯誤" });
    }
});


// --- **新增：模板管理 API (需要驗證)** ---

// 創建新模板
app.post('/api/templates', authenticateToken, async (req, res) => {
    try {
        const { templateName, templateContent } = req.body;
        // userId 來自 authenticateToken 中間件
        if (!req.userId) return res.status(401).json({ message: "用戶未認證" }); 
        
        let userIdObjectId;
        try {
            userIdObjectId = new ObjectId(req.userId); // 將字符串 userId 轉回 ObjectId
        } catch (e) {
            console.error("創建模板時無效的 userId 格式:", req.userId);
            return res.status(400).json({ message: "無效的用戶ID格式" });
        }

        if (!templateName || !templateContent) {
            return res.status(400).json({ message: "模板名稱和內容是必填的" });
        }
        if (!templatesCollection) return res.status(500).json({ message: "數據庫連接未就緒" });

        const newTemplate = {
            userId: userIdObjectId,
            templateName,
            templateContent,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await templatesCollection.insertOne(newTemplate);
        res.status(201).json({ message: "模板創建成功", templateId: result.insertedId });

    } catch (error) {
        console.error("創建模板失敗:", error);
        res.status(500).json({ message: "伺服器內部錯誤" });
    }
});

// 獲取用戶的所有模板
app.get('/api/templates', authenticateToken, async (req, res) => {
    try {
        if (!req.userId) return res.status(401).json({ message: "用戶未認證" });
        
        let userIdObjectId;
         try {
            userIdObjectId = new ObjectId(req.userId);
        } catch (e) {
            console.error("獲取模板時無效的 userId 格式:", req.userId);
            return res.status(400).json({ message: "無效的用戶ID格式" });
        }
        
        if (!templatesCollection) return res.status(500).json({ message: "數據庫連接未就緒" });

        // 按創建時間降序排序
        const templates = await templatesCollection.find({ userId: userIdObjectId }).sort({ createdAt: -1 }).toArray(); 
        res.json(templates); // 返回模板數組

    } catch (error) {
        console.error("獲取模板失敗:", error);
        res.status(500).json({ message: "伺服器內部錯誤" });
    }
});

// 更新指定模板
app.put('/api/templates/:id', authenticateToken, async (req, res) => {
    try {
        if (!req.userId) return res.status(401).json({ message: "用戶未認證" });

        let templateIdObjectId;
        let userIdObjectId;
        try {
             templateIdObjectId = new ObjectId(req.params.id); // 從 URL 獲取模板 ID
             userIdObjectId = new ObjectId(req.userId);
        } catch(e) {
             console.error("更新模板時無效的 ID 格式:", e);
             return res.status(400).json({ message: "無效的ID格式" });
        }

        const { templateName, templateContent } = req.body;

        if (!templateName || !templateContent) {
            return res.status(400).json({ message: "模板名稱和內容是必填的" });
        }
         if (!templatesCollection) return res.status(500).json({ message: "數據庫連接未就緒" });

        const result = await templatesCollection.updateOne(
            // 確保用戶只能修改自己的模板
            { _id: templateIdObjectId, userId: userIdObjectId }, 
            { $set: { templateName, templateContent, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "找不到模板或無權限修改" });
        }
        res.json({ message: "模板更新成功" });

    } catch (error) {
        console.error("更新模板失敗:", error);
        res.status(500).json({ message: "伺服器內部錯誤" });
    }
});

// 刪除指定模板
app.delete('/api/templates/:id', authenticateToken, async (req, res) => {
    try {
        if (!req.userId) return res.status(401).json({ message: "用戶未認證" });
        
        let templateIdObjectId;
        let userIdObjectId;
         try {
             templateIdObjectId = new ObjectId(req.params.id);
             userIdObjectId = new ObjectId(req.userId);
        } catch(e) {
             console.error("刪除模板時無效的 ID 格式:", e);
             return res.status(400).json({ message: "無效的ID格式" });
        }
        
         if (!templatesCollection) return res.status(500).json({ message: "數據庫連接未就緒" });

        // 確保用戶只能刪除自己的模板
        const result = await templatesCollection.deleteOne({ _id: templateIdObjectId, userId: userIdObjectId }); 

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "找不到模板或無權限刪除" });
        }
        res.json({ message: "模板刪除成功" });

    } catch (error) {
        console.error("刪除模板失敗:", error);
        res.status(500).json({ message: "伺服器內部錯誤" });
    }
});


// --- AI 生成接口 (已修改以支持模板) ---
app.post('/api/generate', authenticateToken, async (req, res) => { 
  const { userPrompt, template, detailLevel, role, tone, language, selectedTemplateId } = req.body; 
  if (!req.userId) return res.status(401).json({ message: "用戶未認證" });
  
  let userIdObjectId;
    try {
        userIdObjectId = new ObjectId(req.userId);
    } catch (e) {
        console.error("生成報告時無效的 userId 格式:", req.userId);
        return res.status(400).json({ message: "無效的用戶ID格式" });
    }

  if (!userPrompt) {
    return res.status(400).json({ error: '報告要點是必填的' });
  }

  let finalPrompt = '';

  try {
      // 根據 selectedTemplateId 獲取模板或使用默認 Prompt
      if (selectedTemplateId && selectedTemplateId !== 'default') {
          if (!templatesCollection) throw new Error("數據庫連接未就緒");
          
          let templateIdObjectId;
           try {
               templateIdObjectId = new ObjectId(selectedTemplateId);
           } catch(e) {
                console.error("生成報告時無效的模板 ID 格式:", selectedTemplateId);
                return res.status(400).json({ error: "無效的模板ID格式" });
           }
           
          const userTemplate = await templatesCollection.findOne({ _id: templateIdObjectId, userId: userIdObjectId });
          if (!userTemplate) {
              console.warn(`模板 ${selectedTemplateId} 未找到或用戶 ${req.userId} 無權限訪問`);
              return res.status(404).json({ error: "選擇的模板未找到或無權限使用" });
          }
          
          // **更健壯的 Prompt 組合方式：結合模板內容和生成選項**
           finalPrompt = `
            Please use the following template structure to generate the report.
            Act as a ${role}, maintain a ${tone} tone, provide a ${detailLevel} level of detail, and write in ${language}.
            Incorporate and expand upon the user's key points within the structure provided by the template.
            **CRITICAL: Fill in the details and produce a complete report, do not just output the template structure itself.**

            Template Content Structure:
            ---
            ${userTemplate.templateContent}
            ---

            User's Key Points (to be incorporated into the template structure):
            ---
            ${userPrompt}
            ---
            `;

      } else {
          // 使用默認 Prompt
          finalPrompt = `
            You are an expert in writing professional business reports. Your task is to act as a ${role} and create a complete, detailed, and ready-to-submit report.
            **CRITICAL INSTRUCTION: You must not generate only a framework or an outline.** Your main goal is to expand the user's key points into fluent, detailed paragraphs. Based on your assigned role, you should add relevant details, analysis, or suggestions to make the report look highly professional and insightful. The final deliverable should be a complete document that the user can use after minor edits like changing the name and date.
            Here are the report criteria:
            - **Report Type**: ${template}
            - **Detail Level**: ${detailLevel}.
            - **Tone and Style**: ${tone}
            - **Output Language**: ${language}
            Here are the user's key points that you must expand upon:
            ---
            ${userPrompt}
            ---
          `;
      }

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
      
      const response = await axios.post(apiUrl, {
        contents: [{ parts: [{ text: finalPrompt }] }]
      });

      // 安全地訪問生成的文本
      const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "AI response format error.";
      res.json({ generatedText: generatedText });

  } catch (error) {
    console.error("生成報告失敗:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    // 向前端返回更友好的錯誤信息
    let userErrorMessage = 'Failed to generate content due to an internal server error.';
    if(error.response && error.response.data && error.response.data.error && error.response.data.error.message){
        // 如果 Google AI 返回了具體錯誤，可以考慮是否要部分透露
        // userErrorMessage = `AI generation failed: ${error.response.data.error.message}`; 
    } else if (error.message.includes("選擇的模板未找到")) {
         userErrorMessage = error.message;
    }
    res.status(500).json({ error: userErrorMessage });
  }
});

// --- 啟動伺服器 ---
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}, listening on all interfaces.`);
});