const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  // 1. 捕获并处理错误，返回合理的错误信息
  try {
    // 2. 确保请求是 POST 方法
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,  // 方法不允许
        body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' }),
      };
    }

    // 3. 解析请求体中的参数
    const { prompt } = JSON.parse(event.body);

    // 4. 检查传入的参数是否有效
    if (!prompt || prompt.trim().length === 0) {
      return {
        statusCode: 400,  // 请求错误
        body: JSON.stringify({ error: 'Prompt is required and cannot be empty.' }),
      };
    }

    // 5. 获取 OpenAI API 密钥，确保环境变量存在
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,  // 服务器错误
        body: JSON.stringify({ error: 'Missing OpenAI API key in environment variables.' }),
      };
    }

    // 6. 调用 OpenAI API 生成报告
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

    // 7. 如果 OpenAI API 响应失败，返回错误
    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);  // 日志记录 OpenAI 错误
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Failed to generate report. ' + errorData.error.message }),
      };
    }

    // 8. 处理成功响应，返回生成的报告
    const data = await response.json();
    console.log('Generated report:', data);  // 日志记录成功的返回

    // 9. 返回生成的报告数据
    return {
      statusCode: 200,
      body: JSON.stringify(data),  // 返回 OpenAI API 的响应内容
    };
  } catch (error) {
    // 10. 处理任何其他错误
    console.error('Error in generateReport function:', error);  // 日志记录捕获的错误
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error. Please try again later.' }),
    };
  }
};
