// ==============================================================
// 🟢 history.js - 无冲突修复版 (已修复 API_BASE_URL 报错)
// ==============================================================

// 🟢 [关键修改] 改名，避免与 script.js 里的 API_BASE_URL 冲突
const HISTORY_API_URL = ''; 
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

    const list = document.getElementById('history-list');
    if(list) list.innerHTML = '<div style="text-align:center; padding: 40px; color:#666;">Loading Reports...</div>';

    try {
        // 🟢 使用新变量名 HISTORY_API_URL
        const response = await fetch(`${HISTORY_API_URL}/api/reports/history`, {
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

// 2. 渲染列表 (按钮组：PPT Draft / Word / Markdown / Email)
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
                        style="background: #2563eb; color: white; border: none; height: 36px; padding: 0 15px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: background 0.2s;" 
                        title="Download Word">
                    <i class="fas fa-file-word"></i> <span style="font-size:13px;">Word</span>
                </button>

                <button onclick="downloadHistoryItem('${report._id}', 'ppt')" 
                        style="background: #e05242; color: white; border: none; height: 36px; padding: 0 15px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: background 0.2s;" 
                        title="Download PPT Draft">
                    <i class="fas fa-file-powerpoint"></i> <span style="font-size:13px;">PPT Draft</span>
                </button>

                <button onclick="downloadHistoryItem('${report._id}', 'md')" 
                        style="background: #374151; color: white; border: none; height: 36px; padding: 0 15px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: background 0.2s;" 
                        title="Download Markdown">
                    <i class="fab fa-markdown"></i> <span style="font-size:13px;">Markdown</span>
                </button>

                <button onclick="emailReport('${report._id}')" 
                        style="background: #f3f4f6; color: #4b5563; border: 1px solid #d1d5db; height: 36px; padding: 0 15px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: background 0.2s;" 
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
        // 🟢 使用新变量名
        await fetch(`${HISTORY_API_URL}/api/history/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        fetchHistory();
        if(window.showToast) window.showToast("Deleted", "success");
    } catch(e) { if(window.showToast) window.showToast("Error", "error"); }
};

// ==============================================================
// 🟢 [下载路由]
// ==============================================================
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

// ==============================================================
// 🟢 [Word 引擎] 无封面
// ==============================================================
function exportToWord(content, filename) {
    if(window.showToast) window.showToast("Generating Word Doc...", "info");

    let htmlBody = content;
    if (typeof marked !== 'undefined' && !content.trim().startsWith('<')) {
        htmlBody = marked.parse(content);
    }

    const docXml = `<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml>`;
    const css = `
        <style>
            @page { size: 21cm 29.7cm; margin: 2.5cm; mso-page-orientation: portrait; mso-header: url("header_footer_ref") h1; mso-footer: url("header_footer_ref") f1; }
            body { font-family: "SimSun", "宋体", serif; font-size: 12pt; line-height: 1.5; text-align: justify; }
            h1, h2, h3 { font-family: "SimHei", "黑体", sans-serif; color: #000; }
            h1 { font-size: 22pt; text-align: center; border-bottom: 2px solid #2563EB; padding-bottom: 10px; margin-bottom: 20px; }
            h2 { font-size: 16pt; border-left: 6px solid #2563EB; background: #f5f5f5; padding: 5px 10px; margin-top: 20px; }
            table { border-collapse: collapse; width: 100%; border: 1px solid #000; }
            td, th { border: 1px solid #000; padding: 8px; }
            p.MsoHeader, p.MsoFooter { font-size: 9pt; border-bottom: 1px solid #ddd; }
        </style>
    `;

    const wordHTML = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
        <head><meta charset='utf-8'><title>${filename}</title>${docXml}${css}</head>
        <body>
            <div class="Section1">
                ${htmlBody}
                <table id='header_footer_ref' style='display:none'>
                    <tr><td><div style='mso-element:header' id=h1><p class=MsoHeader><span style='float:left'>${filename}</span><span style='float:right'>Reportify AI</span><span style='clear:both'></span></p></div></td></tr>
                    <tr><td><div style='mso-element:footer' id=f1><p class=MsoFooter><span style='mso-field-code:" PAGE "'></span> / <span style='mso-field-code:" NUMPAGES "'></span></p></div></td></tr>
                </table>
            </div>
        </body>
        </html>
    `;

    const blob = new Blob([wordHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ==============================================================
// 🟢 [PPT 引擎] V5.0 蓝色商务版
// ==============================================================
function exportToPPT(content, filename) {
    if (typeof PptxGenJS === 'undefined') {
        if(window.showToast) window.showToast('PPT Engine Loading...', 'error');
        return;
    }
    if(window.showToast) window.showToast("Generating PPT Draft...", "info");

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9'; 
    pptx.title = filename;

    const themeDark = '1E3A8A'; 
    const themeLight = '3B82F6'; 
    const textDark = '374151'; 

    let slide = pptx.addSlide();
    slide.background = { color: 'F8FAFC' };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '35%', h: '100%', fill: { color: themeDark } });
    slide.addShape(pptx.ShapeType.rect, { x: '35%', y: 0.5, w: '65%', h: 0.15, fill: { color: themeLight } });
    slide.addText(filename.replace(/_/g, ' '), { 
        x: 0.2, y: 2.5, w: '31%', h: 3, fontSize: 32, fontFace: 'Arial Black', color: 'FFFFFF', align: 'left', bold: true, valign: 'middle'
    });
    slide.addText("PROFESSIONAL REPORT DRAFT", { x: '38%', y: 3.5, fontSize: 14, color: themeLight, bold: true, charSpacing: 3 });
    slide.addText(`Date: ${new Date().toLocaleDateString()}`, { x: '38%', y: 4.0, fontSize: 12, color: textDark });

    const sections = content.split(/\n(?=#+ )/); 
    sections.forEach(section => {
        if (!section.trim()) return;
        let lines = section.trim().split('\n');
        let firstLine = lines[0].trim();
        let rawTitle = "", bodyText = "";

        if (firstLine.startsWith('#')) {
            rawTitle = firstLine.replace(/#+\s*/, '').trim();
            bodyText = lines.slice(1).join('\n').trim();
        } else {
            rawTitle = "Executive Summary";
            bodyText = section.trim();
        }
        bodyText = bodyText.replace(/[*_~`]/g, ''); 

        let isTruncated = false;
        if (bodyText.length > 700) { bodyText = bodyText.substring(0, 700) + "..."; isTruncated = true; }
        let fontSize = 16; 
        if (bodyText.length > 300) fontSize = 14;
        if (bodyText.length > 500) fontSize = 12;

        let s = pptx.addSlide();
        s.background = { color: 'F8FAFC' };
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: themeDark } });
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.8, w: '100%', h: 0.05, fill: { color: themeLight } });
        s.addText(rawTitle, { x: 0.5, y: 0.1, w: '90%', h: 0.6, fontSize: 24, fontFace: 'Arial', color: 'FFFFFF', bold: true, valign: 'middle' });
        s.addText(bodyText, { x: 0.5, y: 1.3, w: '90%', h: 5.0, fontSize: fontSize, fontFace: 'Arial', color: textDark, valign: 'top', lineSpacing: fontSize * 1.4 });

        if (isTruncated) {
            s.addText("[ Content truncated. Refer to full report. ]", { x: 0.5, y: 6.3, w: '90%', fontSize: 10, color: '9CA3AF', italic: true, align: 'center' });
        }
        s.addShape(pptx.ShapeType.line, { x: 0.5, y: 6.8, w: '90%', h:0, line: {color: 'E5E7EB', width: 1} });
        s.addText("Reportify AI - Confidential Draft", { x: 0.5, y: 6.9, fontSize: 9, color: '9CA3AF' });
    });

    pptx.writeFile({ fileName: `Draft_${filename}.pptx` });
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
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast("Markdown Downloaded", "success");
}

function emailReport(id) {
    if (id) {
        if(window.showToast) window.showToast("Downloading Word attachment...", "info");
        downloadHistoryItem(id, 'word');
    }
    setTimeout(() => {
        const subject = encodeURIComponent("Sharing an AI-generated report");
        const body = encodeURIComponent("Hello,\n\nPlease find the attached report.\n\n[Note]: I have downloaded the Word document for you. Please attach it manually.\n\nGenerated by Reportify AI");
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }, 1000);
}

// 详情弹窗
function showReportDetail(report) {
    const existing = document.getElementById('dm-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dm-overlay';
    Object.assign(overlay.style, {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10000,
        display: 'flex', justifyContent: 'center', alignItems: 'center'
    });

    const htmlContent = (typeof marked !== 'undefined') ? marked.parse(report.content) : report.content;

    overlay.innerHTML = `
        <div class="bg-white w-11/12 max-w-4xl h-5/6 rounded-xl shadow-2xl flex flex-col overflow-hidden" id="dm-modal">
            <div class="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 class="text-xl font-bold text-gray-800">${report.title || 'Report Detail'}</h3>
                <button id="btn-close-x" class="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <div class="flex-1 p-10 overflow-y-auto prose max-w-none">
                ${htmlContent}
            </div>
            <div class="px-8 py-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button id="btn-close" class="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    const closeFunc = () => overlay.remove();
    document.getElementById('btn-close-x').onclick = closeFunc;
    document.getElementById('btn-close').onclick = closeFunc;
}
