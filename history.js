// ==============================================================
// 🟢 history.js - 最终纯净版 (无冲突 + V5.0 PPT引擎)
// ==============================================================

// 🟢 这里绝对不要定义 API_BASE_URL，直接使用 script.js 里的！
window.currentHistoryData = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchHistory();
});

// 1. 获取历史记录
async function fetchHistory() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html'; 
        return;
    }

    const list = document.getElementById('history-list') || document.getElementById('history-container');
    if(list) list.innerHTML = '<div style="text-align:center; padding: 40px; color:#666;">Loading Reports...</div>';

    try {
        // 智能获取 Base URL
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : '';
        
        const response = await fetch(`${baseUrl}/api/history`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch history');

        const reports = await response.json();
        window.currentHistoryData = reports; 
        renderHistoryList(reports);
    } catch (error) {
        console.error('API Error:', error);
        if(list) list.innerHTML = `<div style="text-align:center; py-10">⚠️ Connection Failed <br><a href="#" onclick="location.reload()">Retry</a></div>`;
    }
}

// 2. 渲染列表 (无 PDF，PPT 为红色 Draft 版)
function renderHistoryList(reports) {
    const listContainer = document.getElementById('history-list') || document.getElementById('history-container');
    if (!listContainer) return;
    listContainer.innerHTML = ''; 

    if (reports.length === 0) {
        listContainer.innerHTML = `<div class="text-center py-16 text-gray-500">No reports found.</div>`;
        return;
    }

    reports.forEach((report, index) => {
        const dateStr = new Date(report.createdAt).toLocaleDateString();
        const rawTitle = report.title || `${report.templateId || 'Report'}_${reports.length - index}`;
        const displayTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
        
        const card = document.createElement('div');
        // 关键修改：移除 rounded-xl 和过重的边框，改为横向宽屏布局
        card.style = "display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 1px solid #f1f5f9; gap: 20px; width: 100%;";        
        card.innerHTML = `
            <div class="flex-1 w-full">
                <div class="flex items-center gap-3">
                    <h3 class="text-gray-700 font-medium text-lg">${report.title || 'Untitled Report'}</h3>
                    <span class="text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded">${typeLabel}</span>
                </div>
                <div class="text-xs text-gray-400 mt-1">
                    <i class="far fa-calendar-alt mr-1"></i> ${dateStr}
                </div>
            </div>

            <div class="flex items-center gap-2 flex-wrap md:flex-nowrap">
                <button onclick="showReportDetailById('${report._id}')" class="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded text-sm transition font-medium">
                    <i class="fas fa-eye mr-1"></i> View
                </button>
                
                <button onclick="downloadHistoryItem('${report._id}', 'word')" class="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition">
                    Word
                </button>
                
                <button onclick="downloadHistoryItem('${report._id}', 'ppt')" class="px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition">
                    PPT Draft
                </button>
                
                <button onclick="downloadHistoryItem('${report._id}', 'md')" class="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-800 transition">
                    Markdown
                </button>

                <button onclick="emailReport('${report._id}')" class="p-2 text-gray-400 hover:text-blue-500 transition">
                    <i class="fas fa-envelope"></i>
                </button>

                <button onclick="deleteReport('${report._id}')" class="p-2 text-gray-300 hover:text-red-500 transition ml-2">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

// 3. 辅助函数
window.showReportDetailById = function(id) {
    const item = window.currentHistoryData.find(r => r._id === id);
    if (item) showReportDetail(item);
}

window.deleteReport = async function(id) {
    if(!confirm("Are you sure you want to delete this report?")) return;
    try {
        const token = localStorage.getItem('token');
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ''; 
        await fetch(`${baseUrl}/api/history/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        fetchHistory();
        if(window.showToast) window.showToast("Deleted", "success");
    } catch(e) { if(window.showToast) window.showToast("Error", "error"); }
};

window.downloadHistoryItem = function(id, type) {
    const item = window.currentHistoryData ? window.currentHistoryData.find(r => r._id === id) : null;
    if (!item || !item.content) {
        if(window.showToast) window.showToast("Content not found", "error");
        return;
    }
    const safeTitle = (item.title || "Report").replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    const filename = `${safeTitle}_${new Date().toISOString().slice(0,10)}`;

    if (type === 'word') exportToWord(item.content, filename);
    else if (type === 'ppt') exportToPPT(item.content, filename);
    else if (type === 'md') exportToMD(item.content, filename);
};

// 4. 引擎部分 (Word/PPT)
function exportToWord(content, filename) {
    if(window.showToast) window.showToast("Generating Word Doc...", "info");
    let htmlBody = content;
    if (typeof marked !== 'undefined' && !content.trim().startsWith('<')) {
        htmlBody = marked.parse(content);
    }
    const docXml = `<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>`;
    const wordHTML = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'><title>${filename}</title>${docXml}</head><body>${htmlBody}</body></html>`;
    const blob = new Blob([wordHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToMD(content, filename) {
    if (!content) return;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function emailReport(id) {
    if (id) {
        if(window.showToast) window.showToast("Downloading Word attachment...", "info");
        downloadHistoryItem(id, 'word');
    }
    setTimeout(() => {
        const subject = encodeURIComponent("Sharing an AI-generated report");
        const body = encodeURIComponent("Please find the attached report.");
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }, 1000);
}

function exportToPPT(content, filename) {
    if (typeof PptxGenJS === 'undefined') return;
    if(window.showToast) window.showToast("Generating PPT Draft...", "info");
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9'; 
    let slide = pptx.addSlide();
    slide.background = { color: 'F8FAFC' };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '35%', h: '100%', fill: { color: '1E3A8A' } });
    slide.addText(filename, { x: 0.2, y: 2.5, w: '31%', fontSize: 24, color: 'FFFFFF', bold: true });
    
    const sections = content.split(/\n(?=#+ )/); 
    sections.forEach(section => {
        if (!section.trim()) return;
        let s = pptx.addSlide();
        s.background = { color: 'F8FAFC' };
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: '1E3A8A' } });
        s.addText(section.substring(0,800).replace(/[*#]/g,''), { x: 0.5, y: 1.3, w: '90%', fontSize: 14, color: '333333' });
    });
    pptx.writeFile({ fileName: `Draft_${filename}.pptx` });
}

function showReportDetail(report) {
    const overlay = document.createElement('div');
    overlay.id = 'dm-overlay';
    Object.assign(overlay.style, {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10000,
        display: 'flex', justifyContent: 'center', alignItems: 'center'
    });
    overlay.innerHTML = `<div class="bg-white p-10 rounded"><h3>${report.title}</h3><button onclick="this.parentElement.parentElement.remove()">Close</button></div>`;
    document.body.appendChild(overlay);
}
