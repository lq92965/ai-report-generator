const express = require('express');
const fetch = require('node-fetch');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// 处理生成报告的 API 请求
app.post('/generate-report', async (req, res) => {
  const { prompt } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;

  const response = await fetch('https://api.openai.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      max_tokens: 1000,
      temperature: 0.7,
      model: 'text-davinci-003',
    }),
  });

  const data = await response.json();
  res.json(data); // 返回生成的报告内容
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
