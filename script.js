// script.js
import { callAIModel } from './services/aiModel.js';

document.addEventListener('DOMContentLoaded', () => {
  // DOM
  const generateBtn = document.getElementById('generateBtn');
  const loadingMsg = document.getElementById('loadingMsg');
  const copyBtn = document.getElementById('copyBtn');
  const copyMsg = document.getElementById('copyMsg');
  const resultEl = document.getElementById('result');
  const inputEl = document.getElementById('inputText');
  const errorMsg = document.getElementById('errorMsg');

  const feedbackForm = document.getElementById('feedbackForm');
  const nameInput = document.getElementById('nameInput') || null;
  const emailInput = document.getElementById('emailInput') || document.getElementById('email') || null;
  const feedbackInput = document.getElementById('feedbackInput') || document.getElementById('feedback') || null;
  const feedbackMsg = document.getElementById('feedbackMsg');

  const languageSelect = document.getElementById('languageSelect');
  const toneSelect = document.getElementById('toneSelect');
  const lengthSelect = document.getElementById('lengthSelect');

  // helpers
  function setLoading(flag) {
    generateBtn.disabled = !!flag;
    loadingMsg.style.display = flag ? 'inline' : 'none';
  }
  function showError(text) {
    if (!errorMsg) return alert(text);
    errorMsg.textContent = text;
    errorMsg.style.display = 'block';
  }
  function clearError() {
    if (!errorMsg) return;
    errorMsg.textContent = '';
    errorMsg.style.display = 'none';
  }

  // 尝试调用 callAIModel：先用 object 签名，失败回退到 string 签名
  async function invokeModel(prompt) {
    const payloadObj = {
      inputText: prompt,
      language: languageSelect?.value,
      tone: toneSelect?.value,
      length: lengthSelect?.value
    };

    // 优先尝试对象签名（更现代、更灵活）
    try {
      const r = await callAIModel(payloadObj);
      return r;
    } catch (errObj) {
      console.warn('callAIModel with object failed:', errObj?.message || errObj);
      // 回退：尝试字符串签名（旧版）
      try {
        const r2 = await callAIModel(prompt);
        return r2;
      } catch (errStr) {
        console.error('callAIModel with string also failed:', errStr?.message || errStr);
        // 最终抛出字符串签名的错误信息（或对象签名的）
        const message = errStr?.message || errObj?.message || 'AI call failed';
        throw new Error(message);
      }
    }
  }

  // 生成按钮
  generateBtn?.addEventListener('click', async () => {
    clearError();
    const prompt = inputEl?.value || '';
    if (!prompt.trim()) {
      showError('请输入用于生成报告的内容。');
      inputEl?.focus();
      return;
    }

    setLoading(true);
    resultEl.value = '';

    try {
      const report = await invokeModel(prompt);
      // 若后端返回对象（{result: "..."}），尽量兼容
      let text = report;
      if (report && typeof report === 'object' && ('result' in report)) {
        text = report.result;
      }
      resultEl.value = String(text || '');
      // 保存历史（最近 10 条）
      try {
        const key = 'hb_reports_v1';
        const hist = JSON.parse(localStorage.getItem(key) || '[]');
        hist.unshift({ time: Date.now(), input: prompt, result: text });
        localStorage.setItem(key, JSON.stringify(hist.slice(0, 10)));
      } catch (e) {
        console.warn('save history failed', e);
      }
    } catch (err) {
      console.error('Generate error:', err);
      // 根据错误信息给用户更友好的提示
      if (err.message && err.message.toLowerCase().includes('timeout')) {
        showError('请求超时，请稍后再试。');
      } else if (err.message && err.message.toLowerCase().includes('empty')) {
        showError('输入为空，请提供内容。');
      } else {
        showError('生成失败，请稍后重试。');
      }
    } finally {
      setLoading(false);
    }
  });

  // 复制按钮
  copyBtn?.addEventListener('click', async () => {
    const text = resultEl?.value || '';
    if (!text.trim()) {
      copyMsg.textContent = '没有可复制的内容';
      copyMsg.style.display = 'inline';
      setTimeout(() => (copyMsg.style.display = 'none'), 1500);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      copyMsg.textContent = '已复制!';
      copyMsg.style.display = 'inline';
      setTimeout(() => (copyMsg.style.display = 'none'), 2000);
    } catch (e) {
      console.error('copy failed', e);
      copyMsg.textContent = '复制失败';
      copyMsg.style.display = 'inline';
      setTimeout(() => (copyMsg.style.display = 'none'), 2000);
    }
  });

  // 反馈表单提交
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const name = nameInput?.value?.trim() || '';
      const email = emailInput?.value?.trim() || '';
      const feedback = feedbackInput?.value?.trim() || '';

      if (!feedback) {
        alert('反馈内容不能为空。');
        feedbackInput?.focus();
        return;
      }
      if (email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!re.test(email)) {
          alert('请输入有效的邮箱地址，或留空。');
          emailInput?.focus();
          return;
        }
      }

      // 优先尝试 POST 到后端 /api/feedback（如果你有后端）；失败则保存 localStorage
      let ok = false;
      try {
        const resp = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, feedback, time: Date.now() })
        });
        if (resp.ok) ok = true;
      } catch (e) {
        console.warn('posting feedback failed, will save locally', e);
      }

      if (!ok) {
        try {
          const key = 'hb_feedbacks_v1';
          const arr = JSON.parse(localStorage.getItem(key) || '[]');
          arr.unshift({ name, email, feedback, time: Date.now() });
          localStorage.setItem(key, JSON.stringify(arr.slice(0, 50)));
          ok = true;
        } catch (e) {
          console.error('save feedback local failed', e);
        }
      }

      if (ok) {
        feedbackMsg.style.display = 'inline';
        setTimeout(() => (feedbackMsg.style.display = 'none'), 3000);
        feedbackForm.reset();
      } else {
        alert('提交失败，请稍后重试。');
      }
    });
  }

});
