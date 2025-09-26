import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import axios from 'axios';

const app = express();
const port = process.env.PORT || 3000;
const API_KEY = process.env.GOOGLE_API_KEY;
const MODEL_NAME = 'gemini-1.5-flash';

if (!API_KEY) {
  console.error("错误：GOOGLE_API_KEY 环境变量未设置！");
  process.exit(1);
}

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend is running!');
});

app.post('/api/generate', async (req, res) => {
  const { userPrompt } = req.body;
  if (!userPrompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
  
  try {
    const response = await axios.post(apiUrl, {
      contents: [{ parts: [{ text: userPrompt }] }]
    });
    res.json(response.data);
  } catch (error) {
    console.error("详细错误信息:", error.response ? error.response.data : error.message);
    res.status(500).json({ 
        message: 'Failed to generate content.',
        error_details: error.response ? error.response.data : error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});