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
    const listContainer = document.getElementById('history-container') || document.getElementById('history-list');
    if (!listContainer) return;
    listContainer.innerHTML = ''; 

    if (reports.length === 0) {
        listContainer.innerHTML = `<div class="text-center py-16 text-gray-500">No reports found.</div>`;
        return;
    }

    reports.forEach((report, index) => {
        const dateObj = new Date(report.createdAt);
        const dateShort = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
        
        // 动态预览：取第二行或截取正文
        const rawContent = report.content || "";
        const lines = rawContent.split('\n').filter(l => l.trim() !== "");
        const previewText = lines[1] ? lines[1].replace(/[#*`]/g, '').substring(0, 120) + "..." : "No additional content available.";

        const card = document.createElement('div');
        // 🟢 核心样式：白色背景、大圆角、柔和阴影、底部间距
        card.style = "background: white; border: 1px solid #eef2f6; border-radius: 12px; padding: 25px; margin-bottom: 25px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);";
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #f8fafc; padding-bottom: 10px;">
                <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b;">- ${dateShort}</h3>
                <span style="font-size: 12px; color: #cbd5e1;">${dateObj.toLocaleDateString()}</span>
            </div>

            <div style="margin-bottom: 20px;">
                <p style="color: #475569; font-weight: 600; margin-bottom: 8px; font-size: 15px;">${report.title || 'Report Analysis'}</p>
                <p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">${previewText}</p>
            </div>

            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px;">
                <button onclick="downloadHistoryItem('${report._id}', 'md')" style="background: #f1f5f9; color: #64748b; border: none; width: 34px; height: 34px; border-radius: 6px; cursor: pointer;" title="Markdown"><i class="fab fa-markdown"></i></button>
                <button onclick="downloadHistoryItem('${report._id}', 'word')" style="background: #eff6ff; color: #2563eb; border: none; width: 34px; height: 34px; border-radius: 6px; cursor: pointer;" title="Word"><i class="fas fa-file-word"></i></button>
                <button onclick="downloadHistoryItem('${report._id}', 'ppt')" style="background: #fef2f2; color: #ef4444; border: none; width: 34px; height: 34px; border-radius: 6px; cursor: pointer;" title="PPT Draft"><i class="fas fa-file-powerpoint"></i></button>
                
                <div style="width: 1px; height: 18px; background: #e2e8f0; margin: 0 5px;"></div>

                <button onclick="showReportDetailById('${report._id}')" style="background: none; border: none; color: #2563eb; font-weight: 600; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 4px;">view <i class="fas fa-expand-alt" style="font-size: 12px;"></i></button>
                <button onclick="deleteReport('${report._id}')" style="background: none; border: none; color: #fca5a5; cursor: pointer; margin-left: 5px;"><i class="fas fa-trash-alt"></i></button>
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
    // 1. 创建美化的自定义确认弹窗
    const confirmOverlay = document.createElement('div');
    confirmOverlay.style = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10001; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); animation: fadeIn 0.2s ease;";
    
    confirmOverlay.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); text-align: center; max-width: 350px; width: 90%;">
            <div style="color: #ef4444; font-size: 40px; margin-bottom: 15px;"><i class="fas fa-exclamation-circle"></i></div>
            <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 18px;">Are you sure?</h3>
            <p style="color: #64748b; font-size: 14px; margin-bottom: 25px; line-height: 1.5;">This action cannot be undone. This report will be permanently deleted.</p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="cancel-delete" style="padding: 10px 20px; background: #f3f4f6; color: #666; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; flex: 1;">Cancel</button>
                <button id="confirm-delete" style="padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; flex: 1;">Delete</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(confirmOverlay);

    // 2. 绑定按钮逻辑
    return new Promise((resolve) => {
        document.getElementById('cancel-delete').onclick = () => {
            confirmOverlay.remove();
        };

        document.getElementById('confirm-delete').onclick = async () => {
            confirmOverlay.innerHTML = '<div style="color: white; font-weight: bold;">Deleting...</div>'; // 加载状态反馈
            try {
                const token = localStorage.getItem('token');
                const baseUrl = window.API_BASE_URL || ''; 
                const res = await fetch(`${baseUrl}/api/history/${id}`, { 
                    method: 'DELETE', 
                    headers: { 'Authorization': `Bearer ${token}` } 
                });
                
                if (res.ok) {
                    if(window.showToast) window.showToast("Report deleted successfully", "success");
                    confirmOverlay.remove();
                    // 如果在详情预览页删除，关闭预览
                    const modal = document.getElementById('report-view-modal');
                    if(modal) modal.style.display = 'none';
                    document.body.style.overflow = '';
                    fetchHistory(); // 刷新列表
                } else {
                    throw new Error();
                }
            } catch(e) {
                if(window.showToast) window.showToast("Failed to delete report", "error");
                confirmOverlay.remove();
            }
        };
    });
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

// ==============================================================
// 🟢 1. [Word 引擎 2.0]：精益求精版 (优化字体回退、行距、封面)
// ==============================================================
function exportToWord(content, filename) {
    if (!content) { showToast("暂无内容可导出", "error"); return; }
    showToast("正在生成专业 Word 文档...", "info");

    let htmlBody = content;
    if (typeof marked !== 'undefined' && !content.trim().startsWith('<')) {
        htmlBody = marked.parse(content);
    }

    // Word 专用 XML 头部
    const docXml = `
        <xml>
            <w:WordDocument>
                <w:View>Print</w:View>
                <w:Zoom>100</w:Zoom>
                <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
        </xml>
    `;

    // 优化后的 CSS：增加宋体优先，优化表格边框
    const css = `
        <style>
            @page {
                size: 21cm 29.7cm; margin: 2.54cm;
                mso-page-orientation: portrait;
                mso-header: url("header_footer_ref") h1;
                mso-footer: url("header_footer_ref") f1;
            }
            @page Section1 { }
            div.Section1 { page: Section1; }
            
            body { font-family: "SimSun", "宋体", "Times New Roman", serif; font-size: 12pt; line-height: 1.6; text-align: justify; }
            h1, h2, h3, h4 { font-family: "SimHei", "黑体", "Arial", sans-serif; color: #000; font-weight: bold; }
            h1 { font-size: 22pt; text-align: center; border-bottom: 2px solid #2563EB; padding-bottom: 12px; margin-bottom: 24px; }
            h2 { font-size: 16pt; border-left: 5px solid #2563EB; background: #F3F4F6; padding: 6px 12px; margin-top: 24px; margin-bottom: 12px; }
            h3 { font-size: 14pt; margin-top: 18px; margin-bottom: 10px; color: #333; }
            p { margin-bottom: 10px; }
            
            /* 表格优化 */
            table { border-collapse: collapse; width: 100%; margin: 15px 0; border: 1px solid #000; }
            td, th { border: 1px solid #000; padding: 8px; vertical-align: top; }
            th { background: #f0f0f0; font-weight: bold; }
            
            /* 引用块 */
            blockquote { border-left: 4px solid #666; background: #f9f9f9; padding: 10px 15px; font-family: "KaiTi", "楷体"; color: #444; margin: 15px 0; }

            /* 页眉页脚 */
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
    showToast("Word 文档下载成功!", "success");
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

// 🟢 [优化版] 邮件发送：先下载文档，再打开邮件
function emailReport(reportId) {
    // 从缓存中获取当前报告数据
    const item = window.currentHistoryData.find(r => r._id === reportId);
    if (!item) return;
    const safeTitle = (item.title || "Report").replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    const filename = `${safeTitle}_${new Date().toISOString().slice(0,10)}`;

    // 自动触发 Word 下载
    exportToWord(item.content, filename);

    // 延时打开邮件客户端
    setTimeout(() => {
        const subject = encodeURIComponent("Sharing an AI-generated report");
        const body = encodeURIComponent("Hello,\n\nThis is a report generated using Reportify AI.\n\n[Attachment]: Please manually attach the downloaded Word file.");
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }, 1000);
}

// 🟢 [新增] Markdown 下载功能
function exportToMD(content, filename) { 
    if (!content) {
        if(window.showToast) window.showToast("No content", "warning");
        return;
    }
    // 🟢 修复：删除重复声明的 filename，直接使用参数中的 content 和 filename
    const reportBlob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(reportBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.md`; // 🟢 统一使用 .md 后缀
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if(window.showToast) window.showToast("Markdown 源码已下载", "success");
}

function showReportDetail(report) {
    const modal = document.getElementById('report-view-modal');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const copyBtn = document.getElementById('modal-copy-btn');
    
    if (!modal || !report) return;

    titleEl.innerText = report.title || "Report Detail";
    
    // 1. 渲染内容（解析 Markdown）
    if (typeof marked !== 'undefined') {
        bodyEl.innerHTML = marked.parse(report.content || "");
    } else {
        bodyEl.innerText = report.content || "";
    }

    // 2. 修复复制功能
    if (copyBtn) {
        // 先移除旧的监听器防止叠加
        const newCopyBtn = copyBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
        
        newCopyBtn.onclick = () => {
            navigator.clipboard.writeText(report.content).then(() => {
                const originalText = newCopyBtn.innerText;
                newCopyBtn.innerText = 'Copied!';
                newCopyBtn.style.background = '#059669'; // 变绿反馈
                setTimeout(() => {
                    newCopyBtn.innerText = originalText;
                    newCopyBtn.style.background = '#2563eb';
                }, 2000);
            });
        };
    }

    // 3. 重组底部按钮排成一排
    // 定位到弹窗底部的按钮容器（根据你的HTML结构，它是 modal-body 的下一个兄弟节点）
    const footer = modal.querySelector('div[style*="text-align: right"]');
    if (footer) {
        footer.style = "padding: 15px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; align-items: center; gap: 8px; background: white;";
        footer.innerHTML = `
            <button onclick="downloadHistoryItem('${report._id}', 'word')" style="padding: 6px 12px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">Word</button>
            <button onclick="downloadHistoryItem('${report._id}', 'ppt')" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">PPT</button>
            <button onclick="downloadHistoryItem('${report._id}', 'md')" style="padding: 6px 12px; background: #374151; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">MD</button>
            <button id="modal-copy-btn-new" style="padding: 6px 12px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">Copy Text</button>
            <button onclick="deleteReport('${report._id}')" style="padding: 6px 12px; background: #fff; color: #f87171; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer; font-size: 13px;">Delete</button>
            <div style="width: 1px; height: 20px; background: #eee; margin: 0 4px;"></div>
            <button onclick="closeViewModal()" style="padding: 6px 12px; background: #f3f4f6; color: #666; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 13px;">Close</button>
        `;

        // 重新绑定新复制按钮逻辑
        const btn = document.getElementById('modal-copy-btn-new');
        btn.onclick = () => {
            navigator.clipboard.writeText(report.content).then(() => {
                btn.innerText = 'Copied!';
                setTimeout(() => btn.innerText = 'Copy Text', 2000);
            });
        };
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}
