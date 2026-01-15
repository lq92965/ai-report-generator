// history.js - 修复版 (增加 Markdown 下载 + 修复 PDF 空白)

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
        if(list) list.innerHTML = '<div class="text-center py-10 text-gray-500">无法加载历史记录，请检查网络。</div>';
    }
}

// 渲染列表 (保持你现在的漂亮样式)
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
        card.className = 'group bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-blue-300 transition-all duration-200 cursor-pointer flex items-center justify-between mb-4';
        
        card.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="hidden md:flex flex-col items-center justify-center w-10 h-10 bg-gray-50 rounded text-gray-400 font-bold">
                    #${reports.length - index}
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <h3 class="font-bold text-gray-800 text-lg">${report.title || '未命名报告'}</h3>
                        <span class="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">${typeLabel}</span>
                    </div>
                    <div class="text-sm text-gray-400 mt-1">
                        <i class="far fa-calendar-alt mr-1"></i> ${dateStr} &nbsp;|&nbsp; 
                        <i class="far fa-user mr-1"></i> AI 助手
                    </div>
                </div>
            </div>
            <div class="text-gray-300 group-hover:text-blue-500">
                <i class="fas fa-chevron-right"></i>
            </div>
        `;
        
        card.onclick = () => showReportDetail(report);
        listContainer.appendChild(card);
    });
}

// ==========================================
// 🟢 核心修复区：下载逻辑与弹窗
// ==========================================

// 1. Markdown 导出 (新增)
function exportHistoryToMD(content, filename) {
    if (!content) return alert("内容为空");
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = (filename || 'report') + '.md';
    link.click();
    URL.revokeObjectURL(url);
}

// 2. Word 导出
function exportHistoryToWord(content, filename) {
    if (!content) return alert("内容为空");
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title></head><body>";
    const footer = "</body></html>";
    // 简单处理换行，Markdown 转 HTML
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

// ==========================================
// 🟢 PDF 导出 (移植自首页的成功逻辑：可见渲染 + 延时截图)
// ==========================================
function exportHistoryToPDF(content, filename) {
    if (!content) {
        if(window.showToast) window.showToast("内容为空，无法生成 PDF", "error");
        else alert("内容为空");
        return;
    }

    // 1. 提示开始 (给用户反馈)
    if(window.showToast) window.showToast("正在准备 PDF 生成...", "info");

    // 2. 转换 Markdown 为 HTML
    const htmlContent = (typeof marked !== 'undefined') ? marked.parse(content) : content;
    const dateStr = new Date().toLocaleDateString();

    // 3. 创建容器 (采用首页策略：覆盖在屏幕最上方，确保绝对可见)
    const container = document.createElement('div');
    container.style.position = 'fixed'; // 使用 fixed 覆盖视口
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '9999999'; // 确保在最顶层
    container.style.backgroundColor = '#ffffff'; // 白底
    container.style.overflowY = 'auto'; 
    container.style.padding = '0'; // 内部控制 padding
    
    // 添加一个临时的“生成中”提示层，以免用户以为死机
    const loadingMask = document.createElement('div');
    loadingMask.innerHTML = `<div style="position:fixed; top:20px; right:20px; background:rgba(0,0,0,0.8); color:white; padding:10px 20px; border-radius:5px; z-index:10000000;">⏳ 正在生成 PDF，请稍候...</div>`;
    document.body.appendChild(loadingMask);

    // 4. 填充内容 (包含打印专用 CSS)
    container.innerHTML = `
        <div id="pdf-print-source" style="max-width: 800px; margin: 0 auto; padding: 40px; background: white; color: #333; font-family: 'Helvetica', 'Arial', sans-serif;">
            <style>
                /* 强制样式，防止被网页其他 CSS 干扰 */
                h1 { color: #2563EB; font-size: 24px; border-bottom: 2px solid #2563EB; padding-bottom: 15px; margin-bottom: 25px; }
                h2 { color: #1F2937; font-size: 18px; margin-top: 25px; margin-bottom: 10px; border-left: 4px solid #2563EB; padding-left: 12px; }
                h3 { color: #374151; font-size: 16px; margin-top: 20px; font-weight: bold; }
                p, li { line-height: 1.8; margin-bottom: 12px; font-size: 14px; text-align: justify; }
                strong { color: #111; font-weight: 700; }
                code { background: #f3f4f6; padding: 2px 5px; border-radius: 4px; font-family: monospace; color: #DC2626; }
                pre { background: #1f2937; color: #fff; padding: 15px; border-radius: 8px; overflow-x: auto; margin: 15px 0; }
                blockquote { border-left: 4px solid #e5e7eb; padding-left: 15px; color: #6b7280; font-style: italic; }
                
                /* 🔴 核心：智能分页控制，防止文字被腰斩 */
                p, h2, h3, li, div, blockquote, pre { 
                    page-break-inside: avoid; 
                    break-inside: avoid; 
                }
            </style>
            
            <div style="text-align:center; margin-bottom:40px;">
                <h1>${filename}</h1>
                <p style="color:#6b7280; font-size:12px; margin-top:5px;">
                    Generated by Reportify AI • ${dateStr}
                </p>
            </div>
            
            <div class="markdown-body">
                ${htmlContent}
            </div>

            <div style="margin-top:60px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:20px;">
                © 2026 Reportify AI. All Rights Reserved.
            </div>
        </div>
    `;

    // 5. 加入 Body
    document.body.appendChild(container);

    // 6. 🟢 关键步骤：延时截图 (等待浏览器渲染 DOM)
    // 既然是 fixed 覆盖，我们需要给浏览器一点时间把内容画出来
    setTimeout(() => {
        if (typeof html2pdf !== 'undefined') {
            const opt = {
                margin:       10, // mm
                filename:     (filename || 'Report') + '.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { 
                    scale: 2, 
                    useCORS: true, 
                    logging: false,
                    scrollY: 0,
                    windowWidth: document.body.scrollWidth
                },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
            };

            // 选中内部的容器进行打印，而不是整个宽屏容器
            const elementToPrint = container.querySelector('#pdf-print-source');

            html2pdf().set(opt).from(elementToPrint).save()
                .then(() => {
                    // 成功后清理
                    document.body.removeChild(container);
                    document.body.removeChild(loadingMask);
                    if(window.showToast) window.showToast("PDF 下载成功!", "success");
                })
                .catch(err => {
                    console.error(err);
                    document.body.removeChild(container);
                    document.body.removeChild(loadingMask);
                    alert("PDF 生成出错，请重试。");
                });
        } else {
            alert("PDF 组件未加载，请刷新页面。");
            document.body.removeChild(container);
            document.body.removeChild(loadingMask);
        }
    }, 500); // 🟢 延时 500ms，确保内容绝对渲染完成
}

// 4. 弹窗显示逻辑 (新增 Markdown 按钮)
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
    const dateStr = new Date(report.createdAt).toLocaleDateString();

    overlay.innerHTML = `
        <div class="bg-white w-11/12 max-w-4xl h-5/6 rounded-xl shadow-2xl flex flex-col overflow-hidden transform scale-95 transition-transform duration-300" id="dm-modal">
            <div class="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                    <h3 class="text-xl font-bold text-gray-800">${report.title || '报告详情'}</h3>
                    <p class="text-sm text-gray-500 mt-1">${dateStr}</p>
                </div>
                <button id="btn-close-x" class="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            
            <div class="flex-1 p-10 overflow-y-auto prose max-w-none">
                ${htmlContent}
            </div>
            
            <div class="px-8 py-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 flex-wrap">
                <button id="btn-word" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center transition">
                    <i class="fas fa-file-word mr-2"></i> Word
                </button>
                
                <button id="btn-md" class="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg shadow-sm flex items-center transition">
                    <i class="fab fa-markdown mr-2"></i> Markdown
                </button>

                <button id="btn-pdf" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm flex items-center transition">
                    <i class="fas fa-file-pdf mr-2"></i> PDF
                </button>
                
                <button id="btn-close" class="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg transition">
                    关闭
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);

    // 动画效果
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        overlay.querySelector('#dm-modal').classList.replace('scale-95', 'scale-100');
    });

    // 绑定事件
    const closeFunc = () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    };

    document.getElementById('btn-close-x').onclick = closeFunc;
    document.getElementById('btn-close').onclick = closeFunc;
    
    // 绑定下载
    document.getElementById('btn-word').onclick = () => exportHistoryToWord(report.content, report.title);
    document.getElementById('btn-md').onclick = () => exportHistoryToMD(report.content, report.title);
    document.getElementById('btn-pdf').onclick = () => exportHistoryToPDF(report.content, report.title);
}
