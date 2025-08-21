// 获取 HTML 元素
const workInput = document.getElementById('workInput');
const styleSelect = document.getElementById('styleSelect');
const lengthSelect = document.getElementById('lengthSelect');
const languageSelect = document.getElementById('languageSelect');
const generateBtn = document.getElementById('generateBtn');
const resultOutput = document.getElementById('resultOutput');
const copyBtn = document.getElementById('copyBtn');

const feedbackLink = document.getElementById('feedbackLink');
const feedbackModal = document.getElementById('feedbackModal');
const closeBtn = document.querySelector('.close-btn');
const feedbackForm = document.getElementById('feedbackForm');
const submitFeedbackBtn = document.getElementById('submitFeedbackBtn');

// 你的 Render 后端服务的完整 URL
const API_URL = 'https://ai-report-generator-wlcr.onrender.com/generate-report';
// 新增的反馈API路由
const FEEDBACK_API_URL = 'https://ai-report-generator-wlcr.onrender.com/submit-feedback';


// “生成”按钮点击事件监听
generateBtn.addEventListener('click', async () => {
    const workContent = workInput.value.trim();
    const style = styleSelect.value;
    const length = lengthSelect.value;
    const language = languageSelect.value;

    if (!workContent) {
        alert('Please enter your work details!');
        return;
    }

    resultOutput.value = "Analyzing work details and generating your report, please wait...";

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                workContent: workContent, 
                style: style, 
                length: length,
                language: language
            })
        });

        if (!response.ok) {
            const errorData = await response.json(); 
            throw new Error(`API request failed: ${response.status} - ${errorData.error || 'Unknown Error'}`);
        }

        const data = await response.json();
        resultOutput.value = data.report;

    } catch (error) {
        console.error('Generation failed:', error);
        resultOutput.value = `Generation failed, please try again later. Error: ${error.message}\nCheck your network connection or try again later.`;
    }
});

// “复制”按钮点击事件监听
copyBtn.addEventListener('click', () => {
    resultOutput.select();
    try {
        document.execCommand('copy');
        alert('Generated result has been copied to clipboard!');
    } catch (err) {
        console.error('Copy failed:', err);
        alert('Copy failed, please copy manually.');
    }
});

// 显示反馈模态框
feedbackLink.addEventListener('click', (event) => {
    event.preventDefault();
    feedbackModal.style.display = 'flex';
});

// 关闭反馈模态框
closeBtn.addEventListener('click', () => {
    feedbackModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === feedbackModal) {
        feedbackModal.style.display = 'none';
    }
});

// 提交反馈表单
feedbackForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('feedbackName').value;
    const email = document.getElementById('feedbackEmail').value;
    const message = document.getElementById('feedbackMessage').value;

    try {
        const response = await fetch(FEEDBACK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, message })
        });

        if (response.ok) {
            alert('Feedback submitted successfully!');
            feedbackForm.reset();
            feedbackModal.style.display = 'none';
        } else {
            alert('Failed to submit feedback. Please try again.');
        }
    } catch (error) {
        console.error('Feedback submission error:', error);
        alert('An error occurred. Please try again later.');
    }
});