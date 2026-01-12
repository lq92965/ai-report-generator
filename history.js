/* history.js - 管理历史记录 */

const API_URL = 'https://api.goreportify.com';
let currentReportText = "";
let currentReportDate = "";

document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
});

async function loadHistory() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const listContainer = document.getElementById('history-list');

    try {
        const res = await fetch(`${API_URL}/api/reports`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load history');

        const reports = await res.json();

        if (reports.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align:center; padding:40px; background:white; border-radius:12px; border:1px solid #eee;">
                    <i class="fas fa-folder-open" style="font-size:40px; color:#ddd; margin-bottom:15px;"></i>
                    <p>No reports found. Go generate one!</p>
                    <a href="index.html" class="btn btn-primary" style="margin-top:10px;">Create Report</a>
                </div>`;
            return;
        }

        listContainer.innerHTML = ''; // 清空加载动画

        reports.forEach(report => {
            // 格式化日期
            const date = new Date(report.createdAt).toLocaleDateString() + ' ' + new Date(report.createdAt).toLocaleTimeString();
            const preview = report.content.substring(0, 100) + '...';

            const item = document.createElement('div');
            item.className = 'history-item';
            // 简单的卡片样式
            item.style.cssText = `
                background: white; 
                padding: 20px; 
                border-radius: 12px; 
                border: 1px solid #eee; 
                margin-bottom: 15px; 
                display: flex; 
                justify-content: space-between; 
                align-items: center;
                transition: transform 0.2s;
            `;
            item.onmouseover = () => item.style.transform = 'translateY(-2px)';
            item.onmouseout = () => item.style.transform = 'translateY(0)';

            item.innerHTML = `
                <div>
                    <h4 style="margin:0 0 5px 0; color:#333;">${report.title || 'Untitled Report'}</h4>
                    <div style="font-size:12px; color:#888; margin-bottom:8px;">
                        <span style="background:#eef2ff; color:#4f46e5; padding:2px 8px; border-radius:4px; margin-right:10px;">${report.templateId || 'Custom'}</span>
                        <i class="far fa-clock"></i> ${date}
                    </div>
                    <p style="font-size:13px; color:#666; margin:0;">${preview}</p>
                </div>
                <button class="btn btn-secondary" onclick="viewReport('${report._id}')">View & Download</button>
            `;
            listContainer.appendChild(item);
        });

    } catch (err) {
        console.error(err);
        listContainer.innerHTML = `<div style="color:red; text-align:center;">Error loading history. Please try again.</div>`;
    }
}

// 打开弹窗查看详情
window.viewReport = async (id) => {
    const token = localStorage.getItem('token');
    const modal = document.getElementById('report-modal');
    const contentBox = document.getElementById('modal-content');
    
    contentBox.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading content...';
    modal.classList.remove('hidden');

    try {
        const res = await fetch(`${API_URL}/api/reports/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const report = await res.json();
        
        currentReportText = report.content;
        currentReportDate = new Date(report.createdAt).toISOString().slice(0,10);

        // 渲染 Markdown
        contentBox.innerHTML = marked.parse(report.content);

    } catch (err) {
        contentBox.innerHTML = 'Error loading content.';
    }
};

window.closeReportModal = () => {
    document.getElementById('report-modal').classList.add('hidden');
};

// 复用下载逻辑
window.downloadReport = (type) => {
    if (!currentReportText) return;
    const filename = `Report_${currentReportDate}`;

    if (type === 'md') {
        const blob = new Blob([currentReportText], {type: 'text/markdown;charset=utf-8'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename + '.md';
        a.click();
    } else if (type === 'pdf') {
        const element = document.getElementById('modal-content');
        const opt = {
            margin: 10,
            filename: filename + '.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    }
};
