// script.js
import { callAIModel } from './services/aiModel.js';

document.addEventListener('DOMContentLoaded', () => {
  // DOM 元素映射
  const generateBtn = document.getElementById('generateBtn');
  const loadingMsg = document.getElementById('loadingMsg');
  const copyBtn = document.getElementById('copyBtn');
  const copyMsg = document.getElementById('copyMsg');
  const resultEl = document.getElementById('result');
  const inputEl = document.getElementById('inputText');
  const errorMsg = document.getElementById('errorMsg');

  const feedbackForm = document.getElementById('feedbackForm');
  const nameInput = document.getElementById('nameInput');
  const emailInput = document.getElementById('emailInput');
  const feedbackInput = document.getElementById('feedbackInput');
  const feedbackMsg = document.getElementById('feedbackMsg');

  const languageSelect = document.getElementById('languageSelect');
  const toneSelect = document.getElementById('toneSelect');
  const lengthSelect = document.getElementById('lengthSelect');

  // 公共 UI helper
  function setLoading(isLoading) {
    generateBtn.disabled = isLoading;
    loadingMsg.style.display = isLoading ? 'inline' : 'none';
  }

  function showError(text) {
    errorMsg.textContent = text;
    errorMsg.style.display = 'block';
  }
  function clearError() {
    errorMsg.textContent = '';
    errorMsg.style.display = 'none';
  }

  // 生成报告（按钮事件）
  generateBtn.addEventListener('click', async () => {
    clearError();
    const prompt = inputEl.value || '';
    if (!prompt.trim()) {
      showError('Please enter some input to generate the report.');
      inputEl.focus();
      return;
    }

    setLoading(true);
    resultEl.value = ''; // 清空旧结果
    try {
      const payload = {
        inputText: prompt,
        language: languageSelect?.value,
        tone: toneSelect?.value,
        length: lengthSelect?.value
      };

      const report = await callAIModel(payload);
      resultEl.value = report;
      // 可选：将生成的结果存历史（localStorage）
      try {
        const histKey = 'hb_reports_v1';
        const existing = JSON.parse(localStorage.getItem(histKey) || '[]');
        existing.unshift({
          timestamp: Date.now(),
          input: prompt,
          result: report
        });
        // 仅保留最近 10 条
        localStorage.setItem(histKey, JSON.stringify(existing.slice(0, 10)));
      } catch (e) {
        // 无需中断主流程
        console.warn('save history failed', e);
      }
    } catch (err) {
      console.error(err);
      if (err.message === 'timeout') {
        showError('Request timed out. Please try again later.');
      } else if (err.message === 'empty_input') {
        showError('Input is empty.');
      } else {
        showError('Failed to generate report. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  });

  // 复制结果
  copyBtn.addEventListener('click', async () => {
    const text = resultEl.value || '';
    if (!text.trim()) {
      // 没内容就不给复制
      copyMsg.textContent = 'No content to copy';
      copyMsg.style.display = 'inline';
      setTimeout(() => (copyMsg.style.display = 'none'), 1500);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      copyMsg.textContent = 'Copied!';
      copyMsg.style.display = 'inline';
      setTimeout(() => (copyMsg.style.display = 'none'), 2000);
    } catch (e) {
      console.error('clipboard error', e);
      copyMsg.textContent = 'Copy failed';
      copyMsg.style.display = 'inline';
      setTimeout(() => (copyMsg.style.display = 'none'), 2000);
    }
  });

  // 反馈表单提交（前端校验 + 本地保存回退）
  feedbackForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const feedback = feedbackInput.value.trim();

    if (!feedback) {
      alert('Feedback cannot be empty.');
      feedbackInput.focus();
      return;
    }

    // 如果填写了邮箱，则校验格式；如果不填写则不强制
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alert('Please enter a valid email address.');
        emailInput.focus();
        return;
      }
    }

    // 优先尝试提交到后端 /api/feedback（如果你提供这个接口）
    let submitted = false;
    try {
      const resp = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, feedback, time: Date.now() })
      });
      if (resp.ok) {
        submitted = true;
      } else {
        console.warn('feedback endpoint returned', resp.status);
      }
    } catch (e) {
      console.warn('feedback post failed, saving locally', e);
    }

    if (!submitted) {
      try {
        const fbKey = 'hb_feedbacks_v1';
        const existing = JSON.parse(localStorage.getItem(fbKey) || '[]');
        existing.unshift({ name, email, feedback, time: Date.now() });
        localStorage.setItem(fbKey, JSON.stringify(existing.slice(0, 50)));
        submitted = true;
      } catch (e) {
        console.error('local save failed', e);
      }
    }

    if (submitted) {
      feedbackMsg.style.display = 'inline';
      setTimeout(() => (feedbackMsg.style.display = 'none'), 3000);
      feedbackForm.reset();
    } else {
      alert('Failed to submit feedback. Please try later.');
    }
  });
});
