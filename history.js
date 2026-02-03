// ==============================================================
// 🟢 history.js - 修复连接问题 + Word/PPT 引擎
// ==============================================================

// 🔴 修复点：如果你没有专门配置 api.goreportify.com，请留空。
// 留空 '' 代表使用当前域名的 /api 路径 (例如 https://goreportify.com/api)
const API_BASE_URL = ''; 
// 如果你是在本地测试，可能需要改为 'http://localhost:3000'

// 全局变量存储数据
window.currentHistoryData = [];

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

    // 显示加载状态（如果页面上有 spinner）
    const list = document.getElementById('history-list');
    if(list) list.innerHTML = '<div style="text-align:center; padding: 40px; color:#666;">正在加载您的报告...</div>';

    try {
        // 发送请求
        const response = await fetch(`${API_BASE_URL}/api/reports/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch history');

        const reports = await response.json();
        window.currentHistoryData = reports; // 存入全局变量
        renderHistoryList(reports);
    } catch (error) {
        console.error('API Error:', error);
        if(list) list.innerHTML = `
            <div class="text-center py-10 text-gray-500">
                <p>⚠️ 无法连接到服务器</p>
                <button onclick="location.reload()" class="mt-2 text-blue-600 underline">重试</button>
            </div>`;
    }
}

// ==============================================================
// 🎨 渲染列表 (Word / PPT / 分享 / 邮件)
// ==============================================================
function renderHistoryList(reports) {
    const listContainer = document.getElementById('history-list');
    if (!listContainer) return;
    listContainer.innerHTML = ''; 

    if (reports.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                <p class="text-gray-500 text-lg">📭 暂无历史记录</p>
                <a href="index.html" class="text-blue-600 hover:underline mt-2 inline-block">去生成第一份报告 &rarr;</a>
            </div>
        `;
        return;
    }

    reports.forEach((report, index) => {
        const dateStr = new Date(report.createdAt).toLocaleDateString();
        const typeLabel = report.templateId || '通用报告';
        
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
                            <h3 class="font-bold text-gray-800 text-lg hover:text-blue-600 transition">${report.title || '未命名报告'}</h3>
                            <span class="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">${typeLabel}</span>
                        </div>
                        <div class="text-sm text-gray-400 mt-1">
                            <i class="far fa-calendar-alt mr-1"></i> ${dateStr}
                        </div>
                    </div>
                </div>
                <div class="text-gray-300">
                    <i class="fas fa-expand-alt"></i>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 15px; border-top: 1px solid #f3f4f6; padding-top: 15px;">
                
                <button onclick="downloadHistoryItem('${report._id}', 'word')" 
                        style="background: #2563eb; color: white; border: none; height: 36px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" 
                        title="Word">
                    <i class="fas fa-file-word"></i>
                </button>

                <button onclick="downloadHistoryItem('${report._id}', 'ppt')" 
                        style="background: #e05242; color: white; border: none; height: 36px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" 
                        title="PPT Draft">
                    <i class="fas fa-file-powerpoint"></i>
                </button>

                <button onclick="downloadHistoryItem('${report._id}', 'md')" 
                        style="background: #374151; color: white; border: none; height: 36px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" 
                        title="Markdown">
                    <i class="fab fa-markdown"></i>
                </button>

                <button onclick="emailReport('${report._id}')" ... > 
                        style="background: #f3f4f6; color: #4b5563; border: 1px solid #d1d5db; height: 36px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" 
                        title="Email">
                    <i class="fas fa-envelope"></i>
                </button>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

// 辅助：打开详情
window.showReportDetailById = function(id) {
    const item = window.currentHistoryData.find(r => r._id === id);
    if (item) showReportDetail(item);
}


// ==============================================================
// 🟢 1. [Word 引擎]：专业版 (宋体/封面/页眉页脚)
// ==============================================================
function exportToWord(content, filename) {
    if(window.showToast) window.showToast("正在生成专业 Word 文档...", "info");

    let htmlBody = content;
    if (typeof marked !== 'undefined' && !content.trim().startsWith('<')) {
        htmlBody = marked.parse(content);
    }

    const docXml = `
        <xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml>
    `;

    const css = `
        <style>
            @page { size: 21cm 29.7cm; margin: 2.5cm; mso-page-orientation: portrait; mso-header: url("header_footer_ref") h1; mso-footer: url("header_footer_ref") f1; }
            @page Section1 { }
            div.Section1 { page: Section1; }
            body { font-family: "SimSun", "宋体", serif; font-size: 12pt; line-height: 1.5; text-align: justify; }
            h1, h2, h3 { font-family: "SimHei", "黑体", sans-serif; color: #000; }
            h1 { font-size: 22pt; text-align: center; border-bottom: 2px solid #2563EB; padding-bottom: 10px; margin-bottom: 20px; }
            h2 { font-size: 16pt; border-left: 6px solid #2563EB; background: #f5f5f5; padding: 5px 10px; margin-top: 20px; }
            h3 { font-size: 14pt; font-weight: bold; margin-top: 15px; }
            blockquote { border-left: 4px solid #999; background: #f9f9f9; padding: 10px; font-family: "KaiTi", "楷体"; }
            table { border-collapse: collapse; width: 100%; margin: 15px 0; border: 1px solid #000; }
            td, th { border: 1px solid #000; padding: 8px; vertical-align: top; }
            th { background: #f0f0f0; font-weight: bold; }
            p.MsoHeader, p.MsoFooter { font-size: 9pt; font-family: "Calibri", sans-serif; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
            p.MsoFooter { border-bottom: none; border-top: 1px solid #ddd; padding-top: 5px; text-align: center; }
        </style>
    `;

    const wordHTML = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
        <head><meta charset='utf-8'><title>${filename}</title>${docXml}${css}</head>
        <body>
            <div class="Section1">
                ${htmlBody}
                <table id='header_footer_ref' style='display:none'>
                    <tr><td><div style='mso-element:header' id=h1><p class=MsoHeader><span style='float:left'>Reportify AI Professional Report</span><span style='float:right'>${new Date().toLocaleDateString()}</span><span style='clear:both'></span></p></div></td></tr>
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
    if(window.showToast) window.showToast("Word 文档下载成功!", "success");
}

// ==============================================================
// 🟢 [V5.0 修复版] PPT 引擎：智能识别首屏 + 英文提示 + 样式分离
// ==============================================================
function exportToPPT(content, filename) {
    if (typeof PptxGenJS === 'undefined') {
        if(window.showToast) window.showToast('PPT Engine Loading...', 'error');
        return;
    }
    if(window.showToast) window.showToast("Generating Professional PPT Draft...", "info");

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9'; 
    pptx.title = filename;

    // 颜色配置
    const themeDark = '1E3A8A'; 
    const themeLight = '3B82F6'; 
    const textDark = '374151'; 

    // --- 1. 封面页 (保持不变) ---
    let slide = pptx.addSlide();
    slide.background = { color: 'F8FAFC' };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '35%', h: '100%', fill: { color: themeDark } });
    slide.addShape(pptx.ShapeType.rect, { x: '35%', y: 0.5, w: '65%', h: 0.15, fill: { color: themeLight } });
    slide.addText(filename.replace(/_/g, ' '), { 
        x: 0.2, y: 2.5, w: '31%', h: 3,
        fontSize: 32, fontFace: 'Arial Black', color: 'FFFFFF', align: 'left', bold: true, valign: 'middle'
    });
    slide.addText("PROFESSIONAL REPORT DRAFT", { x: '38%', y: 3.5, fontSize: 14, color: themeLight, bold: true, charSpacing: 3 });
    slide.addText(`Date: ${new Date().toLocaleDateString()}`, { x: '38%', y: 4.0, fontSize: 12, color: textDark });

    // --- 2. 内容页 (智能逻辑修复) ---
    // 按 Markdown 标题切分
    const sections = content.split(/\n(?=#+ )/); 

    sections.forEach(section => {
        if (!section.trim()) return;

        let lines = section.trim().split('\n');
        let firstLine = lines[0].trim();
        let rawTitle = "";
        let bodyText = "";

        // 🟢 [核心修复] 判断第一行是不是标题 (以 # 开头)
        // 如果不是 # 开头，说明这是引言/摘要，手动给它加个标题
        if (firstLine.startsWith('#')) {
            rawTitle = firstLine.replace(/#+\s*/, '').trim();
            bodyText = lines.slice(1).join('\n').trim();
        } else {
            rawTitle = "Executive Summary"; // 默认标题，防止爆版
            bodyText = section.trim();
        }

        // 清洗 Markdown 符号
        bodyText = bodyText.replace(/[*_~`]/g, ''); 

        // 🟢 [样式修复] 截断逻辑优化：英文 + 独立样式
        let isTruncated = false;
        if (bodyText.length > 700) {
            bodyText = bodyText.substring(0, 700) + "...";
            isTruncated = true;
        }

        // 智能字号
        let fontSize = 16; 
        if (bodyText.length > 300) fontSize = 14;
        if (bodyText.length > 500) fontSize = 12;

        let s = pptx.addSlide();
        s.background = { color: 'F8FAFC' };
        
        // 顶部导航条
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: themeDark } });
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.8, w: '100%', h: 0.05, fill: { color: themeLight } });

        // 页面标题
        s.addText(rawTitle, { 
            x: 0.5, y: 0.1, w: '90%', h: 0.6, 
            fontSize: 24, fontFace: 'Arial', color: 'FFFFFF', bold: true, valign: 'middle'
        });

        // 页面正文
        s.addText(bodyText, { 
            x: 0.5, y: 1.3, w: '90%', h: 5.0, 
            fontSize: fontSize, fontFace: 'Arial', color: textDark, 
            valign: 'top', lineSpacing: fontSize * 1.4
        });

        // 🟢 [样式修复] 独立的截断提示 (底部、灰色、斜体、英文)
        if (isTruncated) {
            s.addText("[ Content truncated. Please refer to the full Word report for details. ]", {
                x: 0.5, y: 6.3, w: '90%', h: 0.5,
                fontSize: 10, color: '9CA3AF', italic: true, align: 'center'
            });
        }

        // 页脚
        s.addShape(pptx.ShapeType.line, { x: 0.5, y: 6.8, w: '90%', h:0, line: {color: 'E5E7EB', width: 1} });
        s.addText("Reportify AI - Confidential Draft", { x: 0.5, y: 6.9, fontSize: 9, color: '9CA3AF' });
    });

    pptx.writeFile({ fileName: `Draft_${filename}.pptx` })
        .then(() => { if(window.showToast) window.showToast("PPT Draft Downloaded!", "success"); });
}

// ==============================================================
// 🟢 3. [其他]：Markdown / Share / Email
// ==============================================================
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
    if (typeof showToast === 'function') showToast("Markdown 下载成功!", "success");
}

function shareReportLink() {
    const mockLink = `https://goreportify.com/share/${Math.random().toString(36).substr(2, 9)}`;
    navigator.clipboard.writeText(mockLink).then(() => {
        if(window.showToast) showToast(`分享链接已复制: ${mockLink}`, "success");
    });
}

// 🟢 [优化版] 历史记录邮件发送：支持根据 ID 自动下载
function emailReport(id) {
    // 1. 如果传入了 ID，先触发下载
    if (id) {
        showToast("正在下载文档以供附件...", "info");
        // 调用已有的下载逻辑，类型为 'word'
        downloadHistoryItem(id, 'word');
    }

    // 2. 延时唤起邮件
    setTimeout(() => {
        const subject = encodeURIComponent("Sharing an AI-generated report");
        const body = encodeURIComponent("Hello，\n\nThis is a professional report I generated using Reportify AI.\n\n[Attachment Instructions]: The system has automatically downloaded a Word document for you. Please manually drag and drop this file into the attachment.\n\nGenerated by Reportify AI");
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        
        const msg = id ? "The email has been opened. Please manually add the attachment you just downloaded." : "The email client has been activated";
        showToast(msg, "success");
    }, 1000);
}

// 下载路由
window.downloadHistoryItem = function(id, type) {
    const item = window.currentHistoryData ? window.currentHistoryData.find(r => r._id === id) : null;
    if (!item || !item.content) {
        if(window.showToast) window.showToast("未找到报告内容", "error");
        return;
    }
    const safeTitle = (item.title || "Report").replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    const filename = `${safeTitle}_${new Date().toISOString().slice(0,10)}`;

    if (type === 'word') exportToWord(item.content, filename);
    else if (type === 'ppt') exportToPPT(item.content, filename);
    else if (type === 'md') exportToMD(item.content, filename);
};

// 详情弹窗 (去掉了 PDF 按钮)
function showReportDetail(report) {
    const existing = document.getElementById('dm-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dm-overlay';
    Object.assign(overlay.style, {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10000,
        display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 0, transition: 'opacity 0.3s'
    });

    const htmlContent = (typeof marked !== 'undefined') ? marked.parse(report.content) : report.content;

    overlay.innerHTML = `
        <div class="bg-white w-11/12 max-w-4xl h-5/6 rounded-xl shadow-2xl flex flex-col overflow-hidden transform scale-95 transition-transform duration-300" id="dm-modal">
            <div class="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 class="text-xl font-bold text-gray-800">${report.title || '报告详情'}</h3>
                <button id="btn-close-x" class="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <div class="flex-1 p-10 overflow-y-auto prose max-w-none">
                ${htmlContent}
            </div>
            <div class="px-8 py-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 flex-wrap">
                <button id="btn-word" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center transition">
                    <i class="fas fa-file-word mr-2"></i> Word
                </button>
                <button id="btn-ppt" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-sm flex items-center transition">
                    <i class="fas fa-file-powerpoint mr-2"></i> PPT
                </button>
                <button id="btn-md" class="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg shadow-sm flex items-center transition">
                    <i class="fab fa-markdown mr-2"></i> Markdown
                </button>
                <button id="btn-close" class="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg transition">关闭</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        overlay.querySelector('#dm-modal').classList.replace('scale-95', 'scale-100');
    });

    const closeFunc = () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    };

    document.getElementById('btn-close-x').onclick = closeFunc;
    document.getElementById('btn-close').onclick = closeFunc;
    
    document.getElementById('btn-word').onclick = () => exportToWord(report.content, report.title);
    document.getElementById('btn-ppt').onclick = () => exportToPPT(report.content, report.title);
    document.getElementById('btn-md').onclick = () => exportToMD(report.content, report.title);
}
