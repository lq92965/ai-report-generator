// history.js - 最终修复版
const API_BASE_URL = 'https://api.goreportify.com'; 

// 页面加载时获取历史记录
document.addEventListener('DOMContentLoaded', () => {
    fetchHistory();
});

// 获取历史记录
async function fetchHistory() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html'; 
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/reports/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch history');

        const reports = await response.json();
        renderHistoryList(reports);
    } catch (error) {
        console.error('Error:', error);
        const list = document.getElementById('history-list');
        if(list) list.innerHTML = '<p style="color:white; text-align:center;">无法加载历史记录，请稍后重试。</p>';
    }
}

// 渲染列表
function renderHistoryList(reports) {
    const listContainer = document.getElementById('history-list');
    if (!listContainer) return;
    listContainer.innerHTML = ''; 

    if (reports.length === 0) {
        listContainer.innerHTML = '<p style="color:white; text-align:center;">暂无历史报告。</p>';
        return;
    }

    reports.forEach(report => {
        const card = document.createElement('div');
        // 保持你原有的卡片样式或使用内联样式确保显示
        card.className = 'history-card p-4 mb-4 bg-gray-800 rounded cursor-pointer hover:bg-gray-700 transition';
        card.style.border = '1px solid #444';
        card.style.padding = '15px';
        card.style.marginBottom = '10px';
        card.style.borderRadius = '8px';
        card.style.cursor = 'pointer';
        
        const date = new Date(report.createdAt).toLocaleDateString();
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="color:white; margin:0; font-size:18px;">${report.title || '未命名报告'}</h3>
                <small style="color:#aaa;">${date}</small>
            </div>
        `;
        
        card.onclick = () => showReportDetail(report);
        listContainer.appendChild(card);
    });
}

// ==========================================
// 🟢 核心修复：弹窗与导出逻辑
// ==========================================

// 1. Word 导出函数 (修复乱码)
function exportHistoryToWord(content, filename) {
    if (!content) return alert("内容为空");
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title></head><body>";
    const footer = "</body></html>";
    // 简单处理换行
    let htmlBody = (typeof marked !== 'undefined') ? marked.parse(content) : content.replace(/\n/g, "<br>");
    const sourceHTML = header + htmlBody + footer;
    
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const link = document.createElement("a");
    document.body.appendChild(link);
    link.href = source;
    link.download = (filename || 'report') + '.doc';
    link.click();
    document.body.removeChild(link);
}

// 2. PDF 导出函数 (快照法 - 修复空白)
function exportHistoryToPDF(content, filename) {
    if (!content) return alert("内容为空");
    
    // 创建白色背景的临时容器
    const element = document.createElement('div');
    element.style.width = '800px';
    element.style.padding = '40px';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.background = '#fff';
    element.style.color = '#000';
    element.style.position = 'absolute';
    element.style.left = '-9999px'; // 移出屏幕
    
    const htmlContent = (typeof marked !== 'undefined') ? marked.parse(content) : content;
    element.innerHTML = `
        <h1 style="text-align:center; color:#333; margin-bottom:20px;">${filename}</h1>
        <hr style="border:0; border-top:1px solid #ccc;">
        <div style="line-height:1.6; margin-top:20px;">${htmlContent}</div>
    `;
    
    document.body.appendChild(element);

    if (typeof html2pdf !== 'undefined') {
        const opt = {
            margin: 10,
            filename: (filename || 'report') + '.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(element).save().then(() => {
             document.body.removeChild(element); // 下载后移除
        });
    } else {
        alert("PDF 组件未加载，请刷新页面。");
        document.body.removeChild(element);
    }
}

// 3. 弹窗显示逻辑
function showReportDetail(report) {
    // 移除可能存在的旧弹窗
    const existing = document.getElementById('dm-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dm-overlay';
    // 强制全屏遮罩样式
    Object.assign(overlay.style, {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10000,
        display: 'flex', justifyContent: 'center', alignItems: 'center'
    });

    const htmlContent = (typeof marked !== 'undefined') ? marked.parse(report.content) : report.content;

    overlay.innerHTML = `
        <div style="background:white; width:90%; max-width:800px; height:85%; display:flex; flex-direction:column; border-radius:10px; overflow:hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
            <div style="padding:20px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; background:#f8f9fa;">
                <h3 style="margin:0; font-size:20px; color:#333; font-weight:bold;">${report.title || 'Report Details'}</h3>
                <button id="btn-close-x" style="background:none; border:none; font-size:28px; cursor:pointer; color:#666;">&times;</button>
            </div>
            
            <div style="flex:1; padding:30px; overflow-y:auto; color:#333; line-height:1.6;" class="markdown-body">
                ${htmlContent}
            </div>
            
            <div style="padding:20px; background:#f8f9fa; border-top:1px solid #eee; display:flex; justify-content:flex-end; gap:15px;">
                <button id="btn-word" style="padding:10px 20px; background:#2563EB; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">📄 Word</button>
                <button id="btn-pdf" style="padding:10px 20px; background:#DC2626; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">📕 PDF</button>
                <button id="btn-close" style="padding:10px 20px; background:#E5E7EB; color:#374151; border:none; border-radius:6px; cursor:pointer;">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);

    // 绑定事件
    document.getElementById('btn-close-x').onclick = () => overlay.remove();
    document.getElementById('btn-close').onclick = () => overlay.remove();
    
    // 绑定下载事件 (传入当前报告的内容和标题)
    document.getElementById('btn-word').onclick = () => exportHistoryToWord(report.content, report.title);
    document.getElementById('btn-pdf').onclick = () => exportHistoryToPDF(report.content, report.title);
}
