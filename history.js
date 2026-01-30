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

// ==============================================================
// 🟢 [黄金标准] 导出引擎 (复用于 History，保持全站体验一致)
// ==============================================================

// ==============================================================
// 🟢 [History] 商业级 Word 导出引擎 (带页眉页脚+完美排版)
// ==============================================================
function exportToWord(content, filename) {
    if(window.showToast) window.showToast("正在生成专业 Word 文档...", "info");

    // 1. 准备内容
    let htmlBody = content;
    if (typeof marked !== 'undefined' && !content.trim().startsWith('<')) {
        htmlBody = marked.parse(content);
    }

    // 2. Word 专用 XML 头 (定义视图和缩放)
    const docXml = `
        <xml>
            <w:WordDocument>
                <w:View>Print</w:View>
                <w:Zoom>100</w:Zoom>
                <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
        </xml>
    `;

    // 3. 专业的 CSS 样式 (宋体、页边距、标题色)
    const css = `
        <style>
            @page {
                size: 21cm 29.7cm; margin: 2.5cm;
                mso-page-orientation: portrait;
                mso-header: url("header_footer_ref") h1;
                mso-footer: url("header_footer_ref") f1;
            }
            @page Section1 { }
            div.Section1 { page: Section1; }

            body { font-family: "SimSun", "宋体", serif; font-size: 12pt; line-height: 1.5; text-align: justify; }
            h1, h2, h3 { font-family: "SimHei", "黑体", sans-serif; color: #000; }
            h1 { font-size: 22pt; text-align: center; border-bottom: 2px solid #2563EB; padding-bottom: 10px; margin-bottom: 20px; }
            h2 { font-size: 16pt; border-left: 6px solid #2563EB; background: #f5f5f5; padding: 5px 10px; margin-top: 20px; }
            h3 { font-size: 14pt; font-weight: bold; margin-top: 15px; }
            blockquote { border-left: 4px solid #999; background: #f9f9f9; padding: 10px; font-family: "KaiTi", "楷体"; }

            /* 页眉页脚样式 */
            p.MsoHeader, p.MsoFooter { font-size: 9pt; font-family: "Calibri", sans-serif; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
            p.MsoFooter { border-bottom: none; border-top: 1px solid #ddd; padding-top: 5px; text-align: center; }
        </style>
    `;

    // 4. 组装 HTML (含封面和页眉页脚定义)
    const wordHTML = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
        <head><meta charset='utf-8'><title>${filename}</title>${docXml}${css}</head>
        <body>
            <div class="Section1">
                <div style="text-align:center; margin-top:100px; margin-bottom:200px;">
                    <h1 style="font-size:36pt; border:none; color:#2563EB;">${filename.replace(/_/g, ' ')}</h1>
                    <p style="font-size:14pt; margin-top:20px;">Created by Reportify AI</p>
                    <p style="font-size:12pt; color:#666;">${new Date().toLocaleDateString()}</p>
                </div>
                <br clear=all style='mso-special-character:line-break; page-break-before:always'>

                ${htmlBody}

                <table id='header_footer_ref' style='display:none'>
                    <tr><td><div style='mso-element:header' id=h1><p class=MsoHeader><span style='float:left'>Reportify AI Professional Report</span><span style='float:right'>${new Date().toLocaleDateString()}</span><span style='clear:both'></span></p></div></td></tr>
                    <tr><td><div style='mso-element:footer' id=f1><p class=MsoFooter><span style='mso-field-code:" PAGE "'></span> / <span style='mso-field-code:" NUMPAGES "'></span></p></div></td></tr>
                </table>
            </div>
        </body>
        </html>
    `;

    // 5. 触发下载
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

// 2. [通用] PDF 导出：系统字体 + 0.8秒极速 + 无限高度
function exportToPDF(content, filename) {
    if (typeof html2pdf === 'undefined') {
        alert('PDF 引擎未加载，请刷新页面');
        return;
    }

    // 启动遮罩
    const loadingMask = document.createElement('div');
    Object.assign(loadingMask.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: '#ffffff', 
        zIndex: '999999999', 
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center'
    });
    loadingMask.innerHTML = `
        <div style="text-align: center;">
            <i class="fas fa-bolt fa-spin fa-3x" style="color:#2563eb; margin-bottom:20px;"></i>
            <h3 style="font-family:sans-serif; color:#333; font-size:18px; font-weight:bold;">正在极速生成 PDF...</h3>
            <p style="color:#999; font-size:12px; margin-top:5px;">History 专属通道</p>
        </div>
    `;
    document.body.appendChild(loadingMask);

    // 准备内容
    let htmlContent = content;
    if (typeof marked !== 'undefined' && !content.trim().startsWith('<')) {
        htmlContent = marked.parse(content);
    }

    // 创建容器 (absolute 防止截断)
    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'absolute', top: '0', left: '0', width: '100%',
        zIndex: '99999', backgroundColor: 'white', padding: '0', margin: '0'
    });

    // 填充内容 (使用系统字体 stack)
    container.innerHTML = `
        <div id="pdf-print-source" style="max-width: 800px; margin: 0 auto; padding: 50px 40px; background: white; color: #111;">
            <style>
                /* 系统原生字体，速度最快，最稳 */
                body, h1, h2, h3, p, li, div {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Microsoft YaHei", sans-serif !important;
                }
                html, body { height: auto !important; overflow: visible !important; }
                
                h1 { color: #2563EB; font-size: 26px; border-bottom: 2px solid #2563EB; padding-bottom: 15px; margin-bottom: 25px; line-height: 1.3; }
                h2 { color: #1F2937; font-size: 20px; margin-top: 30px; margin-bottom: 12px; font-weight: bold; }
                h3 { color: #374151; font-size: 16px; margin-top: 20px; font-weight: bold; }
                p, li { line-height: 1.8; margin-bottom: 10px; font-size: 14px; text-align: justify; color: #333; }
                strong { color: #000; font-weight: 700; }
                blockquote { border-left: 4px solid #e5e7eb; padding-left: 15px; color: #555; font-style: italic; background: #f9fafb; padding: 12px; margin: 15px 0; }
                code { background: #f3f4f6; padding: 2px 5px; border-radius: 4px; font-family: monospace; color: #d63384; font-size: 0.9em; }
                
                p, h2, h3, li, div, blockquote, pre { page-break-inside: avoid; }
            </style>
            
            <div class="markdown-body">
                ${htmlContent}
            </div>
        </div>
    `;

    document.body.appendChild(container);

    // 启动生成 (0.5秒)
    setTimeout(() => {
        window.scrollTo(0, 0); // 强制回顶

        const element = container.querySelector('#pdf-print-source');
        const totalHeight = element.scrollHeight;

        const opt = {
            margin:       [15, 15, 15, 15],
            filename:     `${filename}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true, 
                logging: false,
                scrollY: 0,
                windowWidth: 1024,
                height: totalHeight + 50, // 强制全高度
                windowHeight: totalHeight + 100
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
        };

        html2pdf().set(opt).from(element).save()
            .then(() => {
                document.body.removeChild(container);
                document.body.removeChild(loadingMask);
                if (typeof showToast === 'function') showToast("PDF 下载成功!", "success");
            })
            .catch(err => {
                console.error("PDF Error:", err);
                document.body.removeChild(container);
                document.body.removeChild(loadingMask);
                alert("PDF 生成出错");
            });
    }, 500); 
}
// 3. [通用] Markdown 导出：纯文本，原汁原味
function exportToMD(content, filename) {
    if (!content) return;

    // 创建 Blob 对象 (纯文本类型)
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.md`;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    
    // 清理内存
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (typeof showToast === 'function') showToast("Markdown 下载成功!", "success");
}

// 4. [路由中心] 统一处理 History 页面的下载请求
window.downloadHistoryItem = function(id, type) {
    // 1. 从全局缓存中找到那条历史记录
    const item = window.currentHistoryData ? window.currentHistoryData.find(r => r._id === id) : null;
    
    if (!item || !item.content) {
        if(window.showToast) window.showToast("未找到报告内容", "error");
        return;
    }

    // 2. 生成文件名 (去除特殊字符)
    const safeTitle = (item.title || "Report").replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    const filename = `${safeTitle}_${new Date().toISOString().slice(0,10)}`;

    // 3. 分发给对应的专业引擎
    if (type === 'md') {
        exportToMD(item.content, filename); // 👈 现在调用封装好的函数
    } 
    else if (type === 'word') {
        exportToWord(item.content, filename);
    } 
    else if (type === 'pdf') {
        exportToPDF(item.content, filename);
    }
};


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
