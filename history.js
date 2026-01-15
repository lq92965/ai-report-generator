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

// 渲染美化后的列表
function renderHistoryList(reports) {
    const listContainer = document.getElementById('history-list');
    if (!listContainer) return;
    listContainer.innerHTML = ''; 

    if (reports.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                <p class="text-gray-500 text-lg">📭 暂无历史记录</p>
                <a href="/" class="text-blue-600 hover:underline mt-2 inline-block">去生成第一份报告 &rarr;</a>
            </div>
        `;
        return;
    }

    reports.forEach((report, index) => {
        // 1. 处理数据，生成标签颜色
        const dateStr = new Date(report.createdAt).toLocaleDateString() + ' ' + new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const typeLabel = formatReportType(report.templateId); // 获取中文类型
        const orderNum = reports.length - index; // 倒序编号 (最新的显示为最大的数字) 或者 index + 1
        
        // 2. 创建卡片容器
        const card = document.createElement('div');
        // 使用 Tailwind 创建宽幅、阴影、悬停效果的卡片
        card.className = 'group bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-blue-300 transition-all duration-200 cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-4';
        
        // 3. 填充 HTML 内容
        card.innerHTML = `
            <div class="flex items-start gap-5 w-full">
                <div class="hidden md:flex flex-col items-center justify-center w-12 h-12 bg-gray-50 rounded-lg text-gray-400 font-bold text-xl">
                    #${index + 1}
                </div>

                <div class="flex-1">
                    <div class="flex items-center gap-3 flex-wrap">
                        <h3 class="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                            ${report.title || '未命名报告'}
                        </h3>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            ${typeLabel}
                        </span>
                    </div>

                    <div class="mt-2 flex items-center gap-4 text-sm text-gray-500">
                        <span class="flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            ${dateStr}
                        </span>
                        <span class="flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                            AI 助手
                        </span>
                    </div>
                </div>
            </div>

            <div class="text-gray-300 group-hover:text-blue-500 transition-colors self-center pr-2">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            </div>
        `;
        
        // 绑定点击事件
        card.onclick = () => showReportDetail(report);
        listContainer.appendChild(card);
    });
}

// 辅助函数：将英文 ID 转为中文显示
function formatReportType(id) {
    const map = {
        'daily_summary': '日报总结',
        'project_proposal': '项目提案',
        'marketing_copy': '营销文案'
    };
    return map[id] || '通用报告';
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
