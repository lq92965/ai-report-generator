// 获取 HTML 元素
const workInput = document.getElementById('workInput');
const styleSelect = document.getElementById('styleSelect');
const lengthSelect = document.getElementById('lengthSelect');
const generateBtn = document.getElementById('generateBtn');
const resultOutput = document.getElementById('resultOutput');
const copyBtn = document.getElementById('copyBtn');

// “生成”按钮点击事件监听
generateBtn.addEventListener('click', async () => {
    const workContent = workInput.value.trim(); // 获取输入框内容并去除首尾空格
    const style = styleSelect.value;           // 获取风格选择
    const length = lengthSelect.value;         // 获取篇幅选择

    if (!workContent) {
        // 如果输入内容为空，给出提示
        alert('请输入您的工作要点！');
        return; // 停止执行后续代码
    }

    // 暂时显示一个占位符，模拟生成过程
    resultOutput.value = "正在智能分析并生成您的周报/日报，请稍候...";

    // 构建发送给 Serverless Function 的实际 Prompt
    // 这个 Prompt 是 AI 真正会“理解”的指令
    let promptForAI = `你是一位专业的职场助理，请根据以下工作要点，生成一份`;
    if (style === 'formal') {
        promptForAI += `正式`;
    } else if (style === 'concise') { // 确保与 HTML 的 option value 匹配
        promptForAI += `口语化`;
    }
    promptForAI += `风格的`;
    if (length === 'standard') { // 确保与 HTML 的 option value 匹配
        promptForAI += `标准篇幅`;
    } else if (length === 'detailed') { // 确保与 HTML 的 option value 匹配
        promptForAI += `详细篇幅`;
    }
    promptForAI += `的周报或日报：\n\n${workContent}\n\n`;
    promptForAI += `请确保内容条理清晰，表达专业，语气恰当。`; // 增加更多指令来引导AI生成更好的内容

    try {
        // 调用 Vercel 部署的 Serverless Function
        // 路径是 /api/文件名（不含.js），所以是 /api/generate-report
        const response = await fetch('/api/generate-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // 将 promptForAI 作为 JSON 数据发送给后端
            body: JSON.stringify({ prompt: promptForAI })
        });

        // 检查响应状态码
        if (!response.ok) {
            // 如果不是 2xx 状态码，抛出错误
            const errorData = await response.json(); // 尝试解析错误信息
            throw new Error(`API 请求失败: ${response.status} - ${errorData.message || '未知错误'}`);
        }

        // 解析 JSON 响应
        const data = await response.json();
        // 将 AI 生成的文本显示到结果区域
        resultOutput.value = data.generatedText;

    } catch (error) {
        console.error('生成失败:', error);
        // 显示更详细的错误信息给用户
        resultOutput.value = `生成失败，请稍后重试。错误信息：${error.message}\n请检查您的网络连接或稍后重试。`;
    }
});

// “复制”按钮点击事件监听
copyBtn.addEventListener('click', () => {
    // 选中结果文本框中的所有文本
    resultOutput.select();
    // 尝试执行复制命令
    try {
        document.execCommand('copy');
        alert('生成结果已成功复制到剪贴板！');
    } catch (err) {
        console.error('复制失败:', err);
        alert('复制失败，请手动复制。');
    }
});