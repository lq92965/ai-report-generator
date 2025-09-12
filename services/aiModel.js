// services/aiModel.js
// 浏览器可直接 import 的 ES module。
// 作用：统一封装前端到后端（或直接模型服务）的调用与错误/超时处理。
// 使用：import { callAIModel } from './services/aiModel.js'

export async function callAIModel({ inputText, language, tone, length }) {
  // 基本参数校验
  if (!inputText || !inputText.trim()) {
    throw new Error("empty_input");
  }

  // 请求超时控制：60 秒
  const controller = new AbortController();
  const timeoutMs = 60000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 我们默认调用后端服务路径：/api/generate-report
    // 如果你的后端在 Netlify Functions 下，确认路径是否为 /.netlify/functions/generate-report
    const res = await fetch('/api/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        input: inputText,
        language: language || 'English',
        tone: tone || 'Formal',
        length: length || 'Standard'
      })
    });

    clearTimeout(timeout);

    if (!res.ok) {
      // 读取后端返回的错误信息（若有）
      let txt = await res.text().catch(() => '');
      throw new Error(`http_${res.status}_${txt}`);
    }

    const data = await res.json();

    // 后端返回的格式约定为 { result: '...', error: null }
    if (data.error) {
      throw new Error(data.error);
    }
    if (!data.result) {
      throw new Error("no_result");
    }

    return data.result;
  } catch (err) {
    // 友好化常见错误
    if (err.name === 'AbortError') {
      throw new Error('timeout');
    }
    throw err;
  }
}
