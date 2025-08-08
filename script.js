// 获取 HTML 元素
const workInput = document.getElementById('workInput');
const styleSelect = document.getElementById('styleSelect');
const lengthSelect = document.getElementById('lengthSelect');
const languageSelect = document.getElementById('languageSelect'); // 新增
const generateBtn = document.getElementById('generateBtn');
const resultOutput = document.getElementById('resultOutput');
const copyBtn = document.getElementById('copyBtn');

// 你的 Render 后端服务的完整 URL
const API_URL = 'https://ai-report-generator-wlcr.onrender.com/generate-report';

// “生成”按钮点击事件监听
generateBtn.addEventListener('click', async () => {
    const workContent = workInput.value.trim();
    const style = styleSelect.value;
    const length = lengthSelect.value;
    const language = languageSelect.value; // 新增

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
                language: language // 新增
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