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
    const listContainer = document.getElementById('history-list');
    if (!listContainer) return;
    listContainer.innerHTML = ''; 

    if (reports.length === 0) {
        listContainer.innerHTML = `<div class="text-center py-16 text-gray-500">No reports found.</div>`;
        return;
    }

    reports.forEach((report, index) => {
        const dateStr = new Date(report.createdAt).toLocaleDateString();
        const typeLabel = report.templateId || 'Report';
        
        const card = document.createElement('div');
        card.className = 'group bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all duration-200 mb-4';
        
        card.innerHTML = `
            <div class="flex justify-between items-start cursor-pointer" onclick="showReportDetailById('${report._id}')">
                <div class="flex items-center gap-4">
                    <div class="hidden md:flex flex-col items-center justify-center w-10 h-10 bg-gray-50 rounded text-gray-400 font-bold">
                        #${reports.length - index}
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="font-bold text-gray-800 text-lg hover:text-blue-600 transition">${report.title || 'Untitled Report'}</h3>
                            <span class="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">${typeLabel}</span>
                        </div>
                        <div class="text-sm text-gray-400 mt-1">
                            <i class="far fa-calendar-alt mr-1"></i> ${dateStr}
                        </div>
                    </div>
                </div>
                <div class="text-gray-300"><i class="fas fa-expand-alt"></i></div>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 15px; border-top: 1px solid #f3f4f6; padding-top: 15px;">
                
                <button onclick="downloadHistoryItem('${report._id}', 'word')" 
                        style="background: #2563eb; color: white; border: none; height: 36px; padding: 0 15px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;" 
                        title="Download Word">
                    <i class="fas fa-file-word"></i> Word
                </button>

                <button onclick="downloadHistoryItem('${report._id}', 'ppt')" 
                        style="background: #ef4444; color: white; border: none; height: 36px; padding: 0 15px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;" 
                        title="Download PPT Draft">
                    <i class="fas fa-file-powerpoint"></i> PPT Draft
                </button>

                <button onclick="downloadHistoryItem('${report._id}', 'md')" 
                        style="background: #374151; color: white; border: none; height: 36px; padding: 0 15px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;" 
                        title="Download Markdown">
                    <i class="fab fa-markdown"></i> Markdown
                </button>

                <button onclick="emailReport('${report._id}')" 
                        style="background: #f3f4f6; color: #4b5563; border: 1px solid #d1d5db; height: 36px; padding: 0 15px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;" 
                        title="Email Report">
                    <i class="fas fa-envelope"></i>
                </button>

                <button onclick="deleteReport('${report._id}')" style="margin-left: auto; color: #ef4444; background: none; border: none; cursor: pointer;">
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
