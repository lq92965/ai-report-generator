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

    try {
        // 调用 Vercel 部署的 Serverless Function
        // 路径是 /api/文件名（不含.js），所以是 /api/generate-report
        // 重要：确保这里发送的字段名 (workContent, style, length) 与后端 generate-report.js 期望接收的字段名完全一致
        const response = await fetch('/api/generate-report', {
            method: 'POST',
            headers: {
             'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                workContent: workContent, 
                style: style,             
                length: length            
            })
        });

        // 检查响应状态码
        if (!response.ok) {
            // 如果不是 2xx 状态码，尝试解析错误信息并抛出
            const errorData = await response.json(); 
            // 确保这里从 errorData.error 获取错误信息，因为后端是 { error: ... }
            throw new Error(`API 请求失败: ${response.status} - ${errorData.error || '未知错误'}`);
        }

        // 解析 JSON 响应
        const data = await response.json();
        // 重要：确保这里接收的字段名 (data.report) 与后端 generate-report.js 返回的字段名完全一致
        resultOutput.value = data.report; // 后端返回的是 { report: text }

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