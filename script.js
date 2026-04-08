// --- 1. 核心配置 (手动管理) ---
// 如果你在本地开发，请用 http://localhost:3000
// 如果上线，请改为 https://goreportify.com
const API_BASE_URL = 'https://api.goreportify.com';
/** Always relative — never assign window.location to an absolute production URL (preserves PWA shell). */
const HOME_REL = './index.html';

/** Google OAuth: native app uses ?native_app=1 + oauth-native-bridge.html → custom scheme (see server.js). */
window.getGoogleAuthStartUrl = function () {
    const base = `${API_BASE_URL}/auth/google`;
    try {
        if (
            window.Capacitor &&
            typeof window.Capacitor.isNativePlatform === 'function' &&
            window.Capacitor.isNativePlatform()
        ) {
            return `${base}?native_app=1`;
        }
    } catch (e) { /* noop */ }
    return base;
};


// 全局状态
let allTemplates = [];
let currentUser = null; 
let currentUserPlan = 'free'; 
window.currentReportContent = "";

// [新增] 图片地址处理工具 (必须加在这里，否则后面会报错)
function getFullImageUrl(path) {
    // 1. 定义默认头像 (Base64灰色圆底图)，防止图片裂开
    const DEFAULT_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2UzZTNlMyI+PHBhdGggZD0iTTAgMGgyNHYyNEgwVjB6IiBmaWxsPSJub25lIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSI4IiByPSI0IiBmaWxsPSIjOWNhM2FmIi8+PHBhdGggZD0iTTEyIDE0Yy02LjEgMC04IDQtOCA0djJoMTZ2LTJzLTEuOS00LTgtNHoiIGZpbGw9IiM5Y2EzYWYiLz48L3N2Zz4=';

    // 2. 拦截脏数据 (如果数据库存的是那个打不开的国外网站，强制用默认图)
    if (!path || path.includes('via.placeholder.com')) return DEFAULT_ICON;

    // 3. 如果已经是完整链接 (比如 Base64 或 http)，直接返回
    if (path.startsWith('data:') || path.startsWith('http')) return path;

    // 4. 如果是本地路径，拼接 API 地址
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return `${API_BASE_URL}${cleanPath}`;
}

// --- 2. 全局工具函数 ---

window.showToast = function(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.style.opacity = '1', 10);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

/** 清除底部栏上由移动端逻辑写入的 !important 内联样式（否则桌面 CSS 无法覆盖） */
function clearPwaShellInlineStyles() {
    const nav = document.getElementById('app-bottom-nav') || document.querySelector('.app-bottom-nav');
    if (nav) {
        ['display', 'visibility', 'position', 'bottom', 'z-index', 'background-color'].forEach((p) => {
            nav.style.removeProperty(p);
        });
    }
    document.body.style.removeProperty('padding-bottom');
}

/** 确保底部 Tab 栏与 PWA 壳层在登录/刷新后仍显示（修复被旧缓存或样式覆盖的情况） */
/** 确保底部 Tab 栏与 PWA 壳层在登录/刷新后仍显示 */
function ensurePwaShell() {
    if (window.innerWidth >= 768) {
        clearPwaShellInlineStyles();
        return;
    }
    document.body.classList.add('has-app-nav');
    // 强制给 body 底部留出空间，防止内容被遮挡
    document.body.style.setProperty('padding-bottom', '75px', 'important');

    let nav = document.getElementById('app-bottom-nav') || document.querySelector('.app-bottom-nav');
    
    // 核心修复：如果登录后由于 DOM 刷新导致导航栏不见了，强行用 JS 再画一个出来！
    if (!nav) {
        nav = document.createElement('nav');
        nav.id = 'app-bottom-nav';
        nav.className = 'app-bottom-nav flex justify-around items-center bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 z-[100000] h-[65px]';
        nav.innerHTML = `
            <a href="index.html" class="flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-blue-600" style="text-decoration:none;">
                <i data-lucide="home" class="w-6 h-6 mb-1"></i><span style="font-size:10px;">Home</span>
            </a>
            <a href="generate.html" class="flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-blue-600" style="text-decoration:none;">
                <i data-lucide="sparkles" class="w-6 h-6 mb-1"></i><span style="font-size:10px;">Generate</span>
            </a>
            <a href="news.html" class="flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-blue-600" style="text-decoration:none;">
                <i data-lucide="newspaper" class="w-6 h-6 mb-1"></i><span style="font-size:10px;">News</span>
            </a>
            <a href="blog.html" class="flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-blue-600" style="text-decoration:none;">
                <i data-lucide="book-open" class="w-6 h-6 mb-1"></i><span style="font-size:10px;">Blog</span>
            </a>
            <a href="account.html" class="flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-blue-600" style="text-decoration:none;">
                <i data-lucide="user" class="w-6 h-6 mb-1"></i><span style="font-size:10px;">Mine</span>
            </a>
        `;
        document.body.appendChild(nav);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // 强行锁死导航栏的 CSS 优先级
    nav.removeAttribute('hidden');
    nav.style.setProperty('display', 'flex', 'important');
    nav.style.setProperty('visibility', 'visible', 'important');
    nav.style.setProperty('position', 'fixed', 'important');
    nav.style.setProperty('bottom', '0', 'important');
    nav.style.setProperty('z-index', '100000', 'important');
    nav.style.setProperty('background-color', '#ffffff', 'important');
}

let pwaShellResizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(pwaShellResizeTimer);
    pwaShellResizeTimer = setTimeout(() => {
        if (window.innerWidth >= 768) clearPwaShellInlineStyles();
        else ensurePwaShell();
    }, 120);
});

window.ensurePwaShell = ensurePwaShell;
window.clearPwaShellInlineStyles = clearPwaShellInlineStyles;

function sanitizeDownloadFilename(name) {
    return String(name || 'download').replace(/[/\\?%*:|"<>]/g, '_').substring(0, 120);
}

function escapeHtmlForWordAttr(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

/**
 * WPS / 移动版 Word 常忽略 <head><style>；将版式写成行内 style，保留与 Word 引擎 2.0 一致的设计。
 */
function resolveWordThemePalette(themeClass) {
    const t = String(themeClass || '').toLowerCase();
    if (t.includes('theme-modern')) {
        return {
            h1Color: '#059669',
            h2Accent: '#059669',
            blockquoteBorder: '#059669',
            blockquoteBg: '#ECFDF5',
            blockquoteText: '#065F46',
        };
    }
    if (t.includes('theme-creative')) {
        return {
            h1Color: '#6366F1',
            h2Accent: '#7C3AED',
            blockquoteBorder: '#EC4899',
            blockquoteBg: '#FDF2F8',
            blockquoteText: '#BE185D',
        };
    }
    // corporate / default
    return {
        h1Color: '#1E3A8A',
        h2Accent: '#1E40AF',
        blockquoteBorder: '#3B82F6',
        blockquoteBg: '#EFF6FF',
        blockquoteText: '#1E40AF',
    };
}

/** 文档类型版式：日报偏紧凑清单感，周报偏节奏分段，长报告/分析偏版面呼吸感（新闻/公文混排思路）。 */
const WORD_LAYOUT_PRESETS = {
    general: {
        h1Size: '22.0pt',
        h1Mt: '6.0pt',
        h1Mb: '22.0pt',
        h1Pb: '12.0pt',
        h1Border: '2.25pt',
        h2Size: '16.0pt',
        h2Mt: '26.0pt',
        h2Mb: '14.0pt',
        h2Pad: '6.0pt 12.0pt',
        h3Size: '14.0pt',
        h3Mt: '20.0pt',
        h3Mb: '10.0pt',
        h4Size: '12.5pt',
        h4Mt: '14.0pt',
        h4Mb: '8.0pt',
        pSize: '12.0pt',
        pLh: '1.75',
        pMb: '12.0pt',
        ulMt: '14.0pt',
        ulMb: '14.0pt',
        ulMl: '22.0pt',
        ulPl: '10.0pt',
        ulType: 'disc',
        olType: 'decimal',
        liLh: '1.72',
        liMb: '8.0pt',
        liStrongSize: '12.0pt',
        liStrongColor: '#1F2937',
        pStrongColor: '#111827',
        blockPad: '10.0pt 15.0pt',
        ulNestedType: 'circle',
    },
    daily: {
        h1Size: '20.0pt',
        h1Mb: '16.0pt',
        h1Pb: '10.0pt',
        h2Size: '15.0pt',
        h2Mt: '18.0pt',
        h2Mb: '10.0pt',
        h2Pad: '5.0pt 10.0pt',
        h3Size: '13.5pt',
        h3Mt: '14.0pt',
        h3Mb: '8.0pt',
        pLh: '1.62',
        pMb: '9.0pt',
        ulMt: '10.0pt',
        ulMb: '10.0pt',
        ulMl: '20.0pt',
        ulType: 'square',
        liLh: '1.65',
        liMb: '7.0pt',
        liStrongSize: '12.0pt',
        liStrongColor: '#1E3A8A',
    },
    weekly: {
        h1Size: '21.0pt',
        h1Mb: '20.0pt',
        h2Size: '15.5pt',
        h2Mt: '22.0pt',
        h2Mb: '12.0pt',
        h3Size: '13.8pt',
        pLh: '1.7',
        pMb: '11.0pt',
        ulMt: '12.0pt',
        ulMb: '12.0pt',
        liLh: '1.68',
        liMb: '7.5pt',
        liStrongColor: '#1E40AF',
    },
    executive: {
        h1Size: '24.0pt',
        h1Mb: '26.0pt',
        h1Pb: '14.0pt',
        h1Border: '3.0pt',
        h2Size: '17.0pt',
        h2Mt: '28.0pt',
        h2Mb: '16.0pt',
        h2Pad: '7.0pt 14.0pt',
        h3Size: '14.5pt',
        h3Mt: '22.0pt',
        h3Mb: '11.0pt',
        pLh: '1.8',
        pMb: '12.0pt',
        ulMt: '16.0pt',
        ulMb: '16.0pt',
        ulPl: '12.0pt',
        liLh: '1.75',
        liMb: '9.0pt',
        liStrongSize: '12.5pt',
        liStrongColor: '#111827',
    },
};

/** Word/WPS 导出：勿与 mso-line-height-rule:exactly 搭配无单位 line-height（易被解析成 1.75pt 导致整页文字压成一条线）。 */
function wordExportLineHeightPercent(lhStr) {
    const n = parseFloat(String(lhStr || '1.65'), 10);
    if (isNaN(n) || n <= 0) return '165%';
    return Math.min(250, Math.round(n * 100)) + '%';
}

function resolveWordLayoutProfile(templateId, contentSnippet) {
    const base = { ...WORD_LAYOUT_PRESETS.general };
    let preset = 'general';
    const tid = String(templateId || '');
    const sn = String(contentSnippet || '').slice(0, 1800);
    if (/日报|晨报|今日工作|Daily\s+Work|Daily\s+Summary|stand\s*-?\s*up|晨间|当日/i.test(sn)) preset = 'daily';
    else if (/周报|本周|Weekly\s+(Report|Summary|Review)|Week\s+in\s+Review|周工作/i.test(sn)) preset = 'weekly';
    else if (/月报|季报|年报|Executive\s+Summary|Comprehensive|Analysis\s+Report|战略|深度分析|研判|白皮书/i.test(sn)) preset = 'executive';
    else if (!/^[a-f0-9]{24}$/i.test(tid)) {
        const L = tid.toLowerCase();
        if (/(daily|standup)/.test(L)) preset = 'daily';
        else if (/(weekly|pulse)/.test(L)) preset = 'weekly';
        else if (/(monthly|quarter|annual|executive|review)/.test(L)) preset = 'executive';
    }
    return { ...base, ...WORD_LAYOUT_PRESETS[preset], layoutPreset: preset };
}

function applyWordCompatibleInlineStyles(html, options = {}) {
    if (!html || typeof DOMParser === 'undefined') return html;
    try {
        const palette = resolveWordThemePalette(options.themeClass || '');
        const L = options.layoutProfile || resolveWordLayoutProfile(null, '');
        const d = new DOMParser().parseFromString('<div id="__word_export_root">' + html + '</div>', 'text/html');
        const root = d.getElementById('__word_export_root');
        if (!root) return html;

        const merge = (el, extra) => {
            const prev = (el.getAttribute('style') || '').trim();
            el.setAttribute('style', extra + (prev ? (prev.endsWith(';') ? ' ' : '; ') + prev : ''));
        };

        const fontBody =
            'font-family:Calibri,"Microsoft YaHei","Microsoft YaHei UI","SimSun",sans-serif;mso-ascii-font-family:Calibri;mso-fareast-font-family:"Microsoft YaHei";';
        const fontHead =
            'font-family:"Microsoft YaHei","Microsoft YaHei UI",Calibri,"Segoe UI",sans-serif;mso-ascii-font-family:Calibri;mso-fareast-font-family:"Microsoft YaHei";';

        root.querySelectorAll('h1').forEach((el) =>
            merge(
                el,
                fontHead +
                    `mso-outline-level:1;color:${palette.h1Color};font-weight:bold;font-size:${L.h1Size};text-align:center;border-bottom:1pt solid ${palette.h2Accent};padding-bottom:${L.h1Pb};margin-top:${L.h1Mt};margin-bottom:${L.h1Mb};line-height:125%;`
            )
        );
        root.querySelectorAll('h2').forEach((el) =>
            merge(
                el,
                fontHead +
                    `mso-outline-level:2;color:#1F2937;font-weight:bold;font-size:${L.h2Size};margin-top:${L.h2Mt};margin-bottom:${L.h2Mb};line-height:130%;padding-bottom:6pt;border-bottom:1pt solid #E5E7EB;`
            )
        );
        root.querySelectorAll('h3').forEach((el) =>
            merge(
                el,
                fontHead +
                    `mso-outline-level:3;color:#1F2937;font-weight:bold;font-size:${L.h3Size};margin-top:${L.h3Mt};margin-bottom:${L.h3Mb};line-height:135%;`
            )
        );
        root.querySelectorAll('h4').forEach((el) =>
            merge(
                el,
                fontHead +
                    `mso-outline-level:4;color:#111827;font-weight:bold;font-size:${L.h4Size};margin-top:${L.h4Mt};margin-bottom:${L.h4Mb};line-height:135%;`
            )
        );

        root.querySelectorAll('p').forEach((el) =>
            merge(
                el,
                fontBody +
                    `font-size:${L.pSize};line-height:${wordExportLineHeightPercent(L.pLh)};margin-top:0;margin-bottom:${L.pMb};text-align:justify;`
            )
        );

        root.querySelectorAll('ul').forEach((el) =>
            merge(
                el,
                fontBody +
                    `margin:${L.ulMt} 0 ${L.ulMb} ${L.ulMl};padding-left:${L.ulPl};list-style-type:${L.ulType};list-style-position:outside;font-size:${L.pSize};`
            )
        );
        root.querySelectorAll('ol').forEach((el) =>
            merge(
                el,
                fontBody +
                    `margin:${L.ulMt} 0 ${L.ulMb} ${L.ulMl};padding-left:${L.ulPl};list-style-type:${L.olType};list-style-position:outside;font-size:${L.pSize};`
            )
        );
        root.querySelectorAll('li').forEach((el) =>
            merge(
                el,
                fontBody +
                    `font-size:${L.pSize};line-height:${wordExportLineHeightPercent(L.liLh)};margin-bottom:${L.liMb};margin-left:4.0pt;`
            )
        );
        root.querySelectorAll('li p').forEach((el) =>
            merge(el, `margin:0 0 6.0pt 0;line-height:${wordExportLineHeightPercent(L.liLh)};`)
        );
        root.querySelectorAll('ul ul').forEach((el) =>
            merge(el, `list-style-type:${L.ulNestedType || 'circle'};margin-top:6.0pt;margin-bottom:6.0pt;`)
        );
        root.querySelectorAll('ol ol').forEach((el) =>
            merge(el, 'list-style-type:lower-alpha;margin-top:6.0pt;margin-bottom:6.0pt;')
        );
        root.querySelectorAll('hr').forEach((el) =>
            merge(el, 'border:none;border-top:1.0pt solid #D1D5DB;margin:18.0pt 0 18.0pt 0;height:0;')
        );

        root.querySelectorAll('blockquote').forEach((el) =>
            merge(
                el,
                `border-left:4.0pt solid ${palette.blockquoteBorder};background:${palette.blockquoteBg};padding:${L.blockPad};font-family:"KaiTi","楷体",serif;color:${palette.blockquoteText};margin:15.0pt 0;`
            )
        );

        root.querySelectorAll('table').forEach((el) =>
            merge(
                el,
                'border-collapse:collapse;width:100.0%;margin:15.0pt 0;mso-table-layout:fixed;border:1.0pt solid #000000;'
            )
        );
        root.querySelectorAll('td').forEach((el) =>
            merge(el, 'border:1.0pt solid #000000;padding:8.0pt;vertical-align:top;' + fontBody + `font-size:${L.pSize};`)
        );
        root.querySelectorAll('th').forEach((el) =>
            merge(
                el,
                'border:1.0pt solid #000000;padding:8.0pt;vertical-align:top;background:#F0F0F0;font-weight:bold;' +
                    fontHead +
                    `font-size:${L.pSize};`
            )
        );

        root.querySelectorAll('pre').forEach((el) =>
            merge(
                el,
                'font-family:Consolas,"Courier New",monospace;font-size:10.5pt;background:#F5F5F5;padding:10.0pt;white-space:pre-wrap;margin:10.0pt 0;'
            )
        );
        root.querySelectorAll('code').forEach((el) => {
            let p = el.parentElement;
            while (p) {
                if (p.tagName === 'PRE') return;
                p = p.parentElement;
            }
            merge(el, 'font-family:Consolas,"Courier New",monospace;font-size:10.5pt;background:#F5F5F5;padding:2.0pt 4.0pt;');
        });

        root.querySelectorAll('strong, b').forEach((el) =>
            merge(el, `font-weight:bold;color:${L.pStrongColor};mso-bidi-font-weight:bold;`)
        );
        root.querySelectorAll('li strong, li b').forEach((el) =>
            merge(
                el,
                `font-weight:bold;font-size:${L.liStrongSize};color:${L.liStrongColor};mso-bidi-font-weight:bold;`
            )
        );
        root.querySelectorAll('em, i').forEach((el) => merge(el, 'font-style:italic;'));

        return root.innerHTML;
    } catch (err) {
        console.warn('applyWordCompatibleInlineStyles', err);
        return html;
    }
}

function stripHtmlToPlainText(html) {
    if (!html || typeof document === 'undefined') return String(html || '').trim();
    try {
        const div = document.createElement('div');
        div.innerHTML = html;
        return (div.innerText || div.textContent || '').trim();
    } catch (_) {
        return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
}

/** 去掉末尾「Reportify AI」等推广行，避免出现在 Word 文末。 */
function stripTrailingBrandingMarkdown(md) {
    if (!md || typeof md !== 'string') return md;
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    while (lines.length > 0) {
        const t = lines[lines.length - 1].trim();
        if (!t) {
            lines.pop();
            continue;
        }
        if (
            t.length < 180 &&
            (/reportify\s*ai|generated\s*by|generated_report|^\/\s*$/i.test(t) ||
                (/reportify/i.test(t) && t.length < 60))
        ) {
            lines.pop();
            continue;
        }
        break;
    }
    return lines.join('\n');
}

/** 去掉 HTML 末尾推广行（按文本匹配），用于 App 端优先导出渲染后 HTML。 */
/** Word 导出：去掉 script/style，避免从预览 DOM 取 HTML 时带入不安全或无关片段。 */
function sanitizeHtmlFragmentForWord(html) {
    if (!html || typeof DOMParser === 'undefined') return html;
    try {
        const d = new DOMParser().parseFromString('<div id="__word_sanitize">' + html + '</div>', 'text/html');
        const root = d.getElementById('__word_sanitize');
        if (!root) return html;
        root.querySelectorAll('script, style, iframe').forEach((el) => el.remove());
        return root.innerHTML;
    } catch (_) {
        return html;
    }
}

/** 是否可用「与复制一致」的预览区 HTML 做 Word 导出（避免与 markdown 再解析不一致）。 */
function canUseRenderedReportHtml(reportBox) {
    if (!reportBox) return false;
    const text = reportBox.innerText || '';
    if (text.length < 30) return false;
    if (/appear here|Analyzing structure|AI 生成的精美报告|生成后将显示/i.test(text)) return false;
    const html = reportBox.innerHTML || '';
    return /<h[1-6][\s/>]|<ul[\s/>]|<ol[\s/>]|<strong[\s/>]|<li[\s/>]/i.test(html);
}

function stripTrailingBrandingHtml(html) {
    if (!html || typeof DOMParser === 'undefined') return html;
    try {
        const d = new DOMParser().parseFromString('<div id="__word_html_root">' + html + '</div>', 'text/html');
        const root = d.getElementById('__word_html_root');
        if (!root) return html;
        const children = Array.from(root.children || []);
        for (let i = children.length - 1; i >= 0; i--) {
            const el = children[i];
            const t = (el.innerText || el.textContent || '').trim();
            if (!t) {
                el.remove();
                continue;
            }
            if (
                t.length < 180 &&
                (/reportify\s*ai|generated\s*by|generated_report|^\/\s*$/i.test(t) ||
                    (/reportify/i.test(t) && t.length < 60))
            ) {
                el.remove();
                continue;
            }
            break;
        }
        return root.innerHTML;
    } catch (_) {
        return html;
    }
}

/** marked 偶发未解析的 **粗体**（尤其中英文混排），补成 <strong>（跳过 <pre> 块）。 */
function repairStrayMarkdownBold(html) {
    if (!html || typeof html !== 'string') return html;
    return html
        .split(/(<pre[\s\S]*?<\/pre>)/gi)
        .map((part) => (part.toLowerCase().startsWith('<pre') ? part : part.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')))
        .join('');
}

/**
 * 在已解析的 HTML 文本节点中把残留的 **…** 转为 <strong>（WPS/Word 对混排解析不稳时仍可见裸 **）。
 * 跳过 pre/code/script/style 及已有 strong 内的节点。
 */
function repairMarkdownBoldInTextNodes(html) {
    if (!html || typeof DOMParser === 'undefined') return html;
    try {
        const d = new DOMParser().parseFromString('<div id="__word_bold_root">' + html + '</div>', 'text/html');
        const root = d.getElementById('__word_bold_root');
        if (!root) return html;

        const skipAncestor = (el) => {
            let p = el;
            while (p && p !== root) {
                const tag = p.tagName;
                if (tag === 'PRE' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'STRONG' || tag === 'B') return true;
                p = p.parentElement;
            }
            return false;
        };

        const processTextNode = (textNode) => {
            const t = textNode.textContent;
            if (!t || !t.includes('**')) return;
            const frag = d.createDocumentFragment();
            let i = 0;
            while (i < t.length) {
                const start = t.indexOf('**', i);
                if (start === -1) {
                    frag.appendChild(d.createTextNode(t.slice(i)));
                    break;
                }
                if (start > i) frag.appendChild(d.createTextNode(t.slice(i, start)));
                const end = t.indexOf('**', start + 2);
                if (end === -1) {
                    frag.appendChild(d.createTextNode(t.slice(start)));
                    break;
                }
                const inner = t.slice(start + 2, end);
                const strong = d.createElement('strong');
                strong.textContent = inner;
                frag.appendChild(strong);
                i = end + 2;
            }
            textNode.parentNode.replaceChild(frag, textNode);
        };

        const walker = d.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (skipAncestor(node.parentElement)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            },
        });
        const batch = [];
        let n;
        while ((n = walker.nextNode())) batch.push(n);
        for (const tn of batch) processTextNode(tn);

        return root.innerHTML;
    } catch (err) {
        console.warn('repairMarkdownBoldInTextNodes', err);
        return html;
    }
}

/** Date:October、Report &QA 等粘连，轻量插入空格（避免破坏 URL）。 */
function fixMetadataSpacingMarkdown(md) {
    if (!md || typeof md !== 'string') return md;
    let s = md.replace(/\r\n/g, '\n');
    s = s.replace(/([A-Za-z])\s*&\s*([A-Za-z])/g, (m, a, b, offset) => {
        const before = s.slice(Math.max(0, offset - 8), offset);
        if (/&[a-z]+;$/i.test(before)) return m;
        return `${a} & ${b}`;
    });
    s = s.replace(/([A-Za-z])&([A-Za-z])/g, '$1 & $2');
    s = s.replace(/([A-Za-z])([:：])([A-Za-z0-9])/g, '$1$2 $3');
    return s;
}

/** 避免 # 标题紧跟上一段末尾时解析块边界不清。 */
function ensureBlankLinesAroundBlocks(md) {
    if (!md || typeof md !== 'string') return md;
    let s = md.replace(/\r\n/g, '\n');
    s = s.replace(/([^\n#])\n(#{1,6}\s+[^\n]+)/g, '$1\n\n$2');
    return s;
}

/** 单换行在标准 Markdown 中不会分段；补空行使「1. xxx」列表、英文小节成为独立块。 */
function expandMarkdownBlockSpacing(md) {
    if (!md || typeof md !== 'string') return md;
    let s = md.replace(/\r\n/g, '\n');
    s = s.replace(/([^\n])\n(\d{1,2}\.\s+\S)/g, '$1\n\n$2');
    s = s.replace(/([^\n])\n([•\-*]\s+\S)/g, '$1\n\n$2');
    s = s.replace(/([^\n])\n(\d{1,2}\.\s+[A-Z][^\n]{12,})/g, '$1\n\n$2');
    s = s.replace(/([a-z])(\d{1,2}\.\s+[A-Z])/g, '$1\n\n$2');
    return s;
}

/**
 * AI 报告常为「一、二、」「1.1」等中文结构但未写 # 标题，marked 会全部变成 <p>，Word 无层级。
 * 英文报告常见 Executive Summary 等单独成行，需补 ##。再配合 marked breaks:true 单换行变 <br>。
 */
function preprocessMarkdownForWordExport(md) {
    if (!md || typeof md !== 'string') return md;
    const lines = md.split(/\r?\n/);
    const out = [];
    let titleAssigned = false;

    const isMetaLine = (t) =>
        /^(报告生成日期|报告人|生成日期|日期[:：]|Date\s*[:：]|Reporter|Author|Report Prepared By|Prepared By)/i.test(t) ||
        (/[:：]/.test(t) && t.length < 40 && /日期|姓名|报告人/.test(t));

    const isEnglishSectionHeading = (t) => {
        const u = t.replace(/\*+/g, '').trim();
        if (u.length > 160) return false;
        return /^(Executive Summary|Detailed Activity Breakdown|Results\s*&\s*Metrics|Key Metrics(?:\s*&\s*Progress)?|Key Finding|Key Findings|Conclusions?|Conclusion\s*&\s*Forward Plan|Collaborative Actions\s*&\s*Blockers?|Immediate Priorities(?: for Tomorrow)?|Immediate Plan for Next Period|Next Steps|Findings|Blockers|Test Scenario|Integration Validation|Process|Outcome|Resolution|Functional Regression|Performance\s*&\s*Load Testing(?:\s+Analysis)?|New Feature Validation|Risk Assessment|Summary\s*&\s*Outlook|Recommendations|Appendix)/i.test(
            u
        );
    };

    const looksLikeNumberedSectionHeading = (t) => {
        const u = t.replace(/\*+/g, '').trim();
        if (u.length < 28 || u.length > 200) return false;
        if (!/^\d+\.\s+[A-Z]/.test(u) || /^\d+\.\d/.test(u)) return false;
        return /\b(?:Testing|Analysis|Module|Suite|Regression|Validation|Performance|Breakdown|Metrics|Summary|Planning|Assessment|Integration|Functional|Insights|Report|Activities|Core|Load|Phase|Scenario)\b/i.test(
            u
        );
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const t = line.trim();
        if (!t) {
            out.push(line);
            continue;
        }
        if (t.startsWith('#')) {
            titleAssigned = true;
            out.push(line);
            continue;
        }
        if (t.startsWith('|') || /^[-:|\s]+$/.test(t)) {
            titleAssigned = true;
            out.push(line);
            continue;
        }
        if (!titleAssigned) {
            if (isMetaLine(t)) {
                out.push(line);
                continue;
            }
            titleAssigned = true;
            if (t.length <= 200 && !/^#{1,6}\s/.test(t)) {
                out.push('# ' + t);
                continue;
            }
        }
        if (isEnglishSectionHeading(t)) {
            out.push('## ' + t);
            continue;
        }
        if (looksLikeNumberedSectionHeading(t)) {
            out.push('### ' + t);
            continue;
        }
        if (/^[一二三四五六七八九十百千万]+、/.test(t)) {
            out.push('## ' + t);
            continue;
        }
        if (/^（[一二三四五六七八九十]+）/.test(t)) {
            out.push('## ' + t);
            continue;
        }
        if (/^\d+\.\d+/.test(t)) {
            out.push('### ' + t);
            continue;
        }
        if (/^\d+\.\s+/.test(t) && t.length < 120 && /[\u4e00-\u9fff]/.test(t)) {
            out.push('### ' + t);
            continue;
        }
        out.push(line);
    }
    return out.join('\n');
}

/** Word 导出专用：单换行 → <br>，避免整篇被合成一个 <p>。 */
const MARKED_OPTIONS_WORD = { breaks: true, gfm: true };

/** 与 buildWordHtmlByRules 相同的 Markdown 结构化预处理，使「一、二、」等进入预览/复制 HTML。 */
function normalizeMarkdownForPreviewDisplay(rawInput) {
    let raw = String(rawInput || '').trim();
    if (!raw) return '';
    raw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (raw.startsWith('<')) raw = stripHtmlToPlainText(raw);
    raw = stripTrailingBrandingMarkdown(raw);
    raw = fixMetadataSpacingMarkdown(raw);
    raw = expandMarkdownBlockSpacing(raw);
    raw = ensureBlankLinesAroundBlocks(raw);
    return preprocessMarkdownForWordExport(raw);
}

function escapeHtmlBodyText(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * 网站 Word 规则层：先做预处理（标题识别、间距、去品牌），再用 marked 生成结构化 HTML。
 * 不读取预览区 DOM；marked 仅作「文本→语义标签」引擎，版式由 applyWordCompatibleInlineStyles 行内化。
 * 若 marked 不可用，降级为极简逐行解析。
 */
function buildWordHtmlByRules(rawInput) {
    let raw = String(rawInput || '').trim();
    if (!raw) return '';
    raw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (raw.startsWith('<')) raw = stripHtmlToPlainText(raw);
    raw = stripTrailingBrandingMarkdown(raw);
    raw = fixMetadataSpacingMarkdown(raw);
    raw = expandMarkdownBlockSpacing(raw);
    raw = ensureBlankLinesAroundBlocks(raw);
    raw = preprocessMarkdownForWordExport(raw);

    if (typeof marked !== 'undefined') {
        return marked.parse(raw, MARKED_OPTIONS_WORD);
    }

    const lines = raw.split(/\n/);
    const out = [];
    let listType = '';

    const closeList = () => {
        if (!listType) return;
        out.push(listType === 'ol' ? '</ol>' : '</ul>');
        listType = '';
    };
    const esc = (s) => escapeHtmlBodyText(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    for (let i = 0; i < lines.length; i++) {
        const t = (lines[i] || '').trim();
        if (!t) {
            closeList();
            continue;
        }
        let m;
        if ((m = t.match(/^#{1}\s+(.+)$/))) {
            closeList();
            out.push('<h1>' + esc(m[1]) + '</h1>');
            continue;
        }
        if ((m = t.match(/^#{2}\s+(.+)$/))) {
            closeList();
            out.push('<h2>' + esc(m[1]) + '</h2>');
            continue;
        }
        if ((m = t.match(/^#{3,6}\s+(.+)$/))) {
            closeList();
            out.push('<h3>' + esc(m[1]) + '</h3>');
            continue;
        }
        if ((m = t.match(/^[-*•]\s+(.+)$/))) {
            if (listType !== 'ul') {
                closeList();
                out.push('<ul>');
                listType = 'ul';
            }
            out.push('<li>' + esc(m[1]) + '</li>');
            continue;
        }
        if ((m = t.match(/^\d+\.\s+(.+)$/))) {
            if (listType !== 'ol') {
                closeList();
                out.push('<ol>');
                listType = 'ol';
            }
            out.push('<li>' + esc(m[1]) + '</li>');
            continue;
        }
        closeList();
        out.push('<p>' + esc(t) + '</p>');
    }
    closeList();
    return out.join('\n');
}

/** Capacitor 原生：仅用 Filesystem + Share（Android WebView 的 navigator.share(files) 不可靠）。调用方已保证仅在 isNativePlatform 下使用。 */
async function reportifySaveDownloadInNative(blob, filename, successToastMsg) {
    const pathSafe = sanitizeDownloadFilename(filename);

    try {
        const Filesystem = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
        const Share = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
        if (!Filesystem || !Share || typeof Filesystem.writeFile !== 'function') {
            throw new Error('Filesystem/Share unavailable');
        }
        /* CACHE 而非 DATA：Android FileProvider 默认常包含 cache-path；files 目录易触发
           “Failed to find configured root that contains …/files/…” */
        const exportDir = 'CACHE';
        const writeOpts = { path: pathSafe, directory: exportDir };
        const type = blob.type || '';
        /* 仅「HTML 伪装 .doc」为文本；真 .docx（OOXML）为二进制 ZIP，必须走 base64 写入。 */
        const isLegacyHtmlWord = type.includes('application/msword') && !type.includes('openxmlformats');
        const useUtf8 =
            typeof blob.text === 'function' &&
            (type.startsWith('text/') ||
                type.includes('markdown') ||
                type === 'application/json' ||
                isLegacyHtmlWord);
        if (useUtf8) {
            writeOpts.data = await blob.text();
            writeOpts.encoding = 'utf8';
        } else {
            writeOpts.data = await new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onloadend = () => resolve(r.result.split(',')[1]);
                r.onerror = reject;
                r.readAsDataURL(blob);
            });
        }
        const saved = await Filesystem.writeFile(writeOpts);
        let shareUri = saved && saved.uri;
        if (!shareUri && typeof Filesystem.getUri === 'function') {
            const gu = await Filesystem.getUri({ path: pathSafe, directory: exportDir });
            shareUri = gu && gu.uri;
        }
        if (!shareUri) {
            throw new Error('Filesystem write returned no uri');
        }
        // 文件已成功写入本地（这是“下载完成”的关键节点）。
        if (successToastMsg) showToast(successToastMsg, 'success');

        /* 部分安卓机型上 Share.share(files) 可能长时间不返回，导致“一直下载中”的体感。
           这里改为“尝试分享但不阻塞成功路径”：超时/失败仅提示，不影响已保存结果。 */
        const shareTask = Share.share({
            title: pathSafe,
            files: [shareUri],
            dialogTitle: 'Save or share file'
        });
        const shareTimeoutMs = 8000;
        const timeoutTask = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('share timeout')), shareTimeoutMs)
        );
        try {
            await Promise.race([shareTask, timeoutTask]);
        } catch (shareErr) {
            console.warn('Native share skipped', shareErr);
            showToast('文件已保存，可在系统文件/下载中查看', 'info');
        }
        return true;
    } catch (e) {
        console.error('Native save/share failed', e);
        const detail = e && (e.message || String(e));
        showToast(
            detail
                ? `Could not save file: ${detail.length > 140 ? detail.slice(0, 140) + '…' : detail}`
                : 'Could not save file. Check storage permission.',
            'error'
        );
        return false;
    }
}

window.saveAs = async function(blob, filename) {
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
        const ok = await reportifySaveDownloadInNative(blob, filename, null);
        if (!ok) throw new Error('native save failed');
        return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
};

// 🟢 智能弹窗控制：如果当前页面没有弹窗组件，自动跳回主页并触发弹窗
window.openModal = function(tabToShow = 'login') {
    const overlay = document.getElementById('auth-modal-overlay');
    
    // 如果当前页面找不到弹窗（说明在子页面）
    if (!overlay) {
        window.location.href = `${HOME_REL}?modal=${tabToShow}`;
        return;
    }

    // 如果在主页，正常执行弹窗逻辑
    overlay.classList.remove('hidden');
    document.querySelectorAll('.tab-link').forEach(btn => {
        if (btn.dataset.tab === tabToShow) {
            btn.classList.add('text-blue-600', 'border-blue-600', 'bg-white');
            btn.classList.remove('text-gray-500', 'border-transparent');
        } else {
            btn.classList.remove('text-blue-600', 'border-blue-600', 'bg-white');
            btn.classList.add('text-gray-500', 'border-transparent');
        }
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
        content.style.display = 'none';
    });
    const targetContent = document.getElementById(tabToShow);
    if (targetContent) {
        targetContent.classList.remove('hidden');
        targetContent.style.display = 'block';
    }
};

window.closeModal = function() {
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) overlay.classList.add('hidden');
};

// --- 4. 初始化流程 (Main Logic) ---
document.addEventListener('DOMContentLoaded', async () => {
    setupCapacitorOAuthBridge();
    handleGoogleCallback();
    await fetchUserProfile();
    
    setupAuthUI();          // 登录/注册/Google逻辑
    setupGenerator();       
    setupTemplates();       
    setupPayment();      
    setupCopyBtn();   
    setupContactForm();     
    //setupHistoryLoader();   
    setupMessageCenter();   
    setupUserDropdown();
    ensurePwaShell();
    setupAccountHubGuards();
    setupAvatarUpload();
    setupHistoryLoader(); // 🟢 核心修复：在这里调用历史加载器，让页面一打开就去拉取数据！
    console.log("Reportify AI v22.2 Initialized");

    // ... 现有的代码 ...
    if (window.location.pathname.includes('profile')) {
        loadProfilePageData();
        setupProfileForm();
    }

    // 修改：只要路径里包含 'account' 就执行
    if (window.location.pathname.includes('account')) {
        loadAccountPageAvatar();
    }
    
    // 同理，用量页也建议改一下，防止以后出问题
    if (window.location.pathname.includes('usage')) {
        loadRealUsageData(); // 假设你有这个函数
    }

    // --- [重写] 加载用量数据 (修复链接 + 补充底部数据) ---
    async function loadRealUsageData() {
        // 1. 获取页面上的元素 ID
        const usedEl = document.getElementById('usage-used');
        const limitEl = document.getElementById('usage-limit');
        
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            // 🟢 关键修复：必须使用 API_BASE_URL，不能直接写 '/api/...'
            const res = await fetch(`${API_BASE_URL}/api/usage`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();

                // 🟢 核心修复5：将后端传来的数据精准塞入新的 UI 结构中 (含进度条变色)
                
                // 1. 绑定身份状态
                const planCode = (data.plan || 'free').toLowerCase();
                const planNameEl = document.getElementById('plan-name');
                const upgradeHint = document.getElementById('upgrade-hint');
                
                if (planNameEl) {
                    if (planCode === 'pro') {
                        planNameEl.textContent = 'PRO';
                        planNameEl.style.color = '#10b981'; // 绿色
                        if(upgradeHint) upgradeHint.style.display = 'none';
                    } else if (planCode === 'basic') {
                        planNameEl.textContent = 'BASIC';
                        planNameEl.style.color = '#2563eb'; // 蓝色
                        if(upgradeHint) upgradeHint.style.display = 'block';
                    } else if (planCode === 'free') {
                        planNameEl.textContent = 'FREE';
                        planNameEl.style.color = '#f59e0b'; // 橙色
                        if(upgradeHint) upgradeHint.style.display = 'block';
                    } else {
                        planNameEl.textContent = 'EXPIRED';
                        planNameEl.style.color = '#ef4444'; // 红色
                        if(upgradeHint) upgradeHint.style.display = 'block';
                    }
                }

                // 2. 绑定大字号与底部卡片
                if (usedEl) usedEl.innerText = data.used;
                
                const progressEl = document.getElementById('usage-progress');
                const limitSpan = document.getElementById('usage-limit');
                const remainSpan = document.getElementById('stat-remaining');
                const daysSpan = document.getElementById('stat-daysleft');
                const activeSpan = document.getElementById('stat-activedays');

                // 🚨 终极防线：如果是过期用户，强制所有核心数据清零！
                if (planCode === 'expired') {
                    if(limitSpan) limitSpan.innerText = "0";
                    if(remainSpan) { remainSpan.innerText = "0"; remainSpan.style.fontSize = "2.2rem"; }
                    if(daysSpan) daysSpan.innerText = "0";
                    if(activeSpan) activeSpan.innerText = data.activeDays || 1; // 活跃天数可以保留
                    if(progressEl) {
                        progressEl.style.width = '100%';
                        progressEl.style.background = '#ef4444'; // 全红警告
                    }
                } else {
                    // 正常用户渲染逻辑
                    if (data.limit === '∞' || data.limit === 'Unlimited' || data.limit > 9000) {
                        // Pro 无限模式
                        if(limitSpan) limitSpan.innerText = "∞";
                        if(remainSpan) { remainSpan.innerText = "Unlimited"; remainSpan.style.fontSize = "1.8rem"; }
                        if (progressEl) {
                            progressEl.style.width = '100%';
                            progressEl.style.background = '#10b981'; // Pro是健康绿色
                        }
                    } else {
                        // Basic / Free 限量模式
                        if(limitSpan) limitSpan.innerText = data.limit;
                        if(remainSpan) {
                            remainSpan.innerText = data.remaining !== undefined ? data.remaining : Math.max(0, data.limit - data.used);
                            remainSpan.style.fontSize = "2.2rem";
                        }
                        if (progressEl) {
                            const percent = Math.min(100, (data.used / data.limit) * 100);
                            progressEl.style.width = percent + '%';
                            progressEl.style.background = percent > 90 ? '#ef4444' : '#2563eb'; // 快超标变红，否则正常蓝
                        }
                    }
                    
                    // 填充底部时间卡片 (仅限正常用户)
                    if(daysSpan) daysSpan.innerText = data.daysLeft !== undefined ? data.daysLeft : 0;
                    if(activeSpan) activeSpan.innerText = data.activeDays || 1;
                }

                // 绑定邀请奖励的值 (修复Bonus不显示的问题)
                const bonusVal = document.getElementById('bonus-val');
                if (bonusVal) {
                    bonusVal.innerText = data.bonusCredits || 0;
                }
                
                // 更新分享链接
                if (typeof updateShareLinks === 'function') {
                    updateShareLinks(data.referralCode || 'ERROR');
                }

                console.log("用量数据加载成功:", data);
            } else {
                console.error("加载用量失败，后端返回:", res.status);
            }
        } catch (e) {
            console.error("加载用量网络错误", e);
        }
    }

    // 🟢 监听跨页面传来的开窗指令与邀请链接
    const urlParams = new URLSearchParams(window.location.search);
    const modalAction = urlParams.get('modal');
    const refCode = urlParams.get('ref');

    // 如果发现邀请码，存入本地并提示用户
    if (refCode) {
        localStorage.setItem('inviteCode', refCode);
        showToast("🎁 Welcome! Register now to claim your +5 Free Reports bonus!", "success");
        setTimeout(() => openModal('signup'), 1500); // 自动打开注册框
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (modalAction && document.getElementById('auth-modal-overlay')) {
        openModal(modalAction);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}); // 初始化结束


// =================================================
//  模块详情 (Functions)
// =================================================

// --- 模块 A: Google 回调 ---
/** 登录成功后刷新顶栏头像/菜单（与密码登录里 setupUserDropdown 一致；深链接回 App 时不会自动跑 DOMContentLoaded） */
function finalizeLoginUiAfterToken() {
    setupUserDropdown();
    ensurePwaShell();
    if (typeof setupTemplates === 'function') void setupTemplates();
    if (typeof loadAccountPageAvatar === 'function') {
        void loadAccountPageAvatar();
    }
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }
}

/** Capacitor: bridge page → com.crickettechnology.reportifyai://oauth?bridge=… → exchange JWT via /api/oauth/bridge-token */
async function applyGoogleTokenFromDeepLink(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return false;
    if (urlStr.indexOf('com.crickettechnology.reportifyai://') !== 0) return false;
    let u;
    try {
        u = new URL(urlStr);
    } catch (e) {
        return false;
    }
    if (u.hostname !== 'oauth') return false;
    const err = u.searchParams.get('error');
    const token = u.searchParams.get('token');
    const bridge = u.searchParams.get('bridge');
    if (err) {
        showToast('Google Login Failed', 'error');
        return true;
    }
    if (bridge) {
        try {
            const res = await fetch(
                `${API_BASE_URL}/api/oauth/bridge-token?bridge=${encodeURIComponent(bridge)}`
            );
            const data = await res.json();
            if (data && data.token) {
                localStorage.setItem('token', data.token);
                window.history.replaceState({}, document.title, window.location.pathname);
                showToast('Login successful!', 'success');
                ensurePwaShell();
                await fetchUserProfile();
                if (typeof closeModal === 'function') closeModal();
                finalizeLoginUiAfterToken();
                return true;
            }
        } catch (e) {
            console.error('OAuth bridge exchange failed', e);
        }
        showToast('Google Login Failed', 'error');
        return true;
    }
    if (token) {
        localStorage.setItem('token', token);
        window.history.replaceState({}, document.title, window.location.pathname);
        showToast('Login successful!', 'success');
        ensurePwaShell();
        await fetchUserProfile();
        if (typeof closeModal === 'function') closeModal();
        finalizeLoginUiAfterToken();
        return true;
    }
    return false;
}

function setupCapacitorOAuthBridge() {
    if (typeof window.Capacitor === 'undefined' || !window.Capacitor.isNativePlatform()) return;
    let App = window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (!App && typeof window.CapacitorPlugins !== 'undefined') {
        App = window.CapacitorPlugins.App;
    }
    if (!App || typeof App.addListener !== 'function') {
        console.warn('[Reportify] Capacitor App plugin missing. Run: npx cap sync android');
        return;
    }
    App.addListener('appUrlOpen', (data) => {
        if (data && data.url) void applyGoogleTokenFromDeepLink(data.url);
    });
    App.getLaunchUrl()
        .then((res) => {
            if (res && res.url) void applyGoogleTokenFromDeepLink(res.url);
        })
        .catch(() => {});
    App.addListener('resume', () => {
        App.getLaunchUrl()
            .then((res) => {
                if (res && res.url) void applyGoogleTokenFromDeepLink(res.url);
            })
            .catch(() => {});
    });
}

function handleGoogleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const errorFromUrl = urlParams.get('error');

    if (tokenFromUrl) {
        localStorage.setItem('token', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
        showToast('Login successful!', 'success');
        ensurePwaShell();
        // Stay on current page; DOMContentLoaded will fetch profile and refresh header.
    }
    if (errorFromUrl) {
        showToast('Google Login Failed', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// --- 模块 B: 用户信息 ---
async function fetchUserProfile() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            currentUser = await res.json();
            currentUserPlan = currentUser.plan || 'free';
        } else if (res.status === 401) {
            localStorage.removeItem('token');
            currentUser = null;
            currentUserPlan = 'free';
        }
    } catch (e) { console.error(e); }
}

// --- 模块 C: 认证 UI ---
function setupAuthUI() {
    // 1. 绑定关闭按钮
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) closeModalBtn.addEventListener('click', window.closeModal);
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) window.closeModal(); });

    // 2. 绑定 Tab 切换
    document.querySelectorAll('.tab-link').forEach(t => {
        t.addEventListener('click', () => window.openModal(t.dataset.tab));
    });

    // 🟢 终极防弹设计：禁用所有表单的默认提交行为，彻底斩断 HTML 嵌套导致的“串台”
    document.querySelectorAll('form').forEach(f => {
        f.addEventListener('submit', e => e.preventDefault());
    });

    // 3. 登录按钮直接绑定 (绝对不会触发注册)
    const loginBtn = document.querySelector('#login-form button[type="submit"]') || document.querySelector('#login button');
    if (loginBtn) {
        loginBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            if(!email || !password) {
                showToast("Please enter your email and password.", "warning");
                return;
            }

            const originalText = loginBtn.textContent;
            loginBtn.disabled = true;
            loginBtn.textContent = 'Verifying...';

            try {
                const res = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Login failed');

                localStorage.setItem('token', data.token);
                showToast("Welcome back!", "success");
                window.closeModal();
                await fetchUserProfile();
                void setupTemplates();
                setupUserDropdown();
                ensurePwaShell();
                await loadAccountPageAvatar();
                if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
                    lucide.createIcons();
                }
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = originalText;
            }
        };
    }

    // 4. 注册按钮直接绑定 & 发送验证码逻辑
    const signupBtn = document.querySelector('#signup-form button[type="submit"]') || document.querySelector('#btn-signup-submit');
    const sendCodeBtn = document.getElementById('btn-send-signup-code');

    if (signupBtn && sendCodeBtn) {
        setupStrictValidation(); 

        // 🟢 A. 发送注册验证码逻辑
        sendCodeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('signup-email');
            const email = emailInput.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailRegex.test(email)) {
                showToast("Please enter a valid email address first.", "warning");
                return;
            }

            // 倒计时逻辑
            sendCodeBtn.disabled = true;
            let timeLeft = 60;
            const originalText = sendCodeBtn.innerText;
            
            const timer = setInterval(() => {
                timeLeft--;
                sendCodeBtn.innerText = `${timeLeft}s`;
                if (timeLeft <= 0) {
                    clearInterval(timer);
                    sendCodeBtn.innerText = "Resend";
                    sendCodeBtn.disabled = false;
                }
            }, 1000);

            try {
                const res = await fetch(`${API_BASE_URL}/api/auth/send-signup-code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email }),
                });
                const data = await res.json();
                
                if (res.ok) {
                    showToast("Verification code sent! Please check your inbox.", "success");
                } else {
                    throw new Error(data.message || "Failed to send code");
                }
            } catch (err) {
                showToast(err.message, "error");
                clearInterval(timer);
                sendCodeBtn.innerText = "Send Code";
                sendCodeBtn.disabled = false;
            }
        });

        // 🟢 B. 最终提交注册逻辑 (携带 Code)
        signupBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            
            if (!validateAllFields()) {
                showToast("Please fix the errors in the form.", "error");
                return;
            }

            const name = document.getElementById('signup-name').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value;
            const code = document.getElementById('signup-code').value.trim(); // 获取验证码

            if (!code || code.length !== 6) {
                showToast("Please enter the 6-digit verification code.", "warning");
                return;
            }

            const originalText = signupBtn.textContent;
            signupBtn.disabled = true;
            signupBtn.textContent = 'Creating...';

            try {
                const storedInvite = localStorage.getItem('inviteCode') || '';
                const res = await fetch(`${API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: name, email, password, code, inviteCode: storedInvite }),
                });
                const data = await res.json();
                
                if (!res.ok) throw new Error(data.message || 'Registration failed');

                if (res.ok) localStorage.removeItem('inviteCode');
                showToast('Account created successfully! Please log in.', 'success');
                window.openModal('login');
                const signupForm = document.getElementById('signup-form');
                if(signupForm) signupForm.reset();
                sendCodeBtn.innerText = "Send Code"; // 重置发送按钮
                sendCodeBtn.disabled = false;
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                signupBtn.disabled = false;
                signupBtn.textContent = originalText;
            }
        };
    }

    // 5. Google 登录按钮修复
    const googleBtns = document.querySelectorAll('button');
    googleBtns.forEach(btn => {
        if ((btn.textContent && btn.textContent.toLowerCase().includes('google')) || btn.classList.contains('google-btn')) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.type = 'button'; 
            newBtn.addEventListener('click', async (e) => {
                e.preventDefault(); 
                e.stopPropagation();
                const originalText = newBtn.innerHTML;
                newBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                window.location.href =
                    typeof window.getGoogleAuthStartUrl === 'function'
                        ? window.getGoogleAuthStartUrl()
                        : `${API_BASE_URL}/auth/google`;
            });
        }
    });

    // 6. Free 按钮逻辑
    document.querySelectorAll('button').forEach(btn => {
        if (btn.id === 'btn-select-free' || btn.textContent.includes('Start Free')) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.location.href.includes('subscription')) window.location.href = HOME_REL;
                else window.openModal('signup');
            });
        }
    });
}

// --- 模块 C-2: 严格验证逻辑 ---
function setupStrictValidation() {
    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('signup-email');
    const passInput = document.getElementById('signup-password');
    const submitBtn = document.querySelector('#signup-form button[type="submit"]');

    const getErrorSpan = (input) => {
        let span = input.nextElementSibling;
        if (!span || !span.classList.contains('validation-msg')) {
            span = document.createElement('div');
            span.className = 'validation-msg text-xs mt-1 text-left';
            input.parentNode.insertBefore(span, input.nextSibling);
        }
        return span;
    };

    const checkName = () => {
        const val = nameInput.value.trim();
        const span = getErrorSpan(nameInput);
        if (val.length === 0) { span.innerHTML = ''; return false; }
        if (val.length > 10) {
            span.innerHTML = '<span class="text-red-500">Max 10 characters.</span>';
            return false;
        }
        span.innerHTML = '<span class="text-green-600">OK</span>';
        return true;
    };

    const checkEmail = () => {
        const val = emailInput.value.trim();
        const span = getErrorSpan(emailInput);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (val.length === 0) { span.innerHTML = ''; return false; }
        if (!emailRegex.test(val)) {
            span.innerHTML = '<span class="text-red-500">Invalid email.</span>';
            return false;
        }
        span.innerHTML = '<span class="text-green-600">OK</span>';
        return true;
    };

    const checkPass = () => {
        const val = passInput.value;
        const box = document.getElementById('signup-pwd-feedback');
        const span = getErrorSpan(passInput); 
        span.innerHTML = ''; // 清除旧的纯文本提示

        if (!box) return false;
        return window.renderPasswordStrength(val, box);
    };

    const validateForm = () => {
        const isNameOk = checkName();
        const isEmailOk = checkEmail();
        const isPassOk = checkPass();
        
        if (submitBtn) {
            if (isNameOk && isEmailOk && isPassOk) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }
    };

    if (nameInput) nameInput.addEventListener('input', validateForm);
    if (emailInput) emailInput.addEventListener('input', validateForm);
    if (passInput) passInput.addEventListener('input', validateForm);
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

/** 缩小头像体积，减轻 Nginx/网关 413（手机相册原图常 > 服务端 body 限制） */
function compressImageFileForAvatar(file) {
    return new Promise((resolve) => {
        if (!file || !file.type || !file.type.startsWith('image/')) {
            resolve(file);
            return;
        }
        if (file.size <= 512 * 1024) {
            resolve(file);
            return;
        }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            let w = img.naturalWidth || img.width;
            let h = img.naturalHeight || img.height;
            const maxSide = 1280;
            if (w > maxSide || h > maxSide) {
                if (w >= h) {
                    h = Math.round((h * maxSide) / w);
                    w = maxSide;
                } else {
                    w = Math.round((w * maxSide) / h);
                    h = maxSide;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(file);
                return;
            }
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        resolve(file);
                        return;
                    }
                    const name = (file.name && file.name.replace(/\.[^.]+$/, '')) || 'avatar';
                    resolve(new File([blob], `${name}.jpg`, { type: 'image/jpeg' }));
                },
                'image/jpeg',
                0.82
            );
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file);
        };
        img.src = url;
    });
}

function validateAllFields() {
    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('signup-email');
    const passInput = document.getElementById('signup-password');
    if(!nameInput || !emailInput || !passInput) return false;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const pass = passInput.value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

    return (name.length > 0 && name.length <= 10) && 
           emailRegex.test(email) && 
           passRegex.test(pass);
}

// --- 修改点 B：头像上传逻辑 ---

function setupAvatarUpload() {
    const fileInput = document.getElementById('upload-avatar');
    const avatarImg = document.getElementById('profile-avatar');
    const triggerBtn = document.getElementById('btn-trigger-upload');

    if (!fileInput) return;

    const triggerUpload = (e) => { e.stopPropagation(); fileInput.click(); };
    if (avatarImg) avatarImg.onclick = triggerUpload;
    if (triggerBtn) triggerBtn.onclick = triggerUpload;

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // 使用 showToast 显示 "正在上传..."
        showToast('Uploading...', 'info');

        try {
            const toUpload = await compressImageFileForAvatar(file);
            const formData = new FormData();
            formData.append('avatar', toUpload);

            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/upload-avatar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            let data = {};
            const raw = await res.text();
            try {
                data = raw ? JSON.parse(raw) : {};
            } catch (_) {
                if (!res.ok) {
                    if (raw.includes('413') || /entity too large/i.test(raw)) {
                        showToast('图片仍过大，请选更小图片或稍后重试', 'error');
                    } else {
                        showToast(raw.slice(0, 120) || 'Upload failed', 'error');
                    }
                    return;
                }
            }

            if (res.ok) {
                showToast('Success!', 'success');
                if (data.avatarUrl && avatarImg) avatarImg.src = getFullImageUrl(data.avatarUrl);
                if (data.avatarUrl && currentUser) {
                    currentUser.picture = data.avatarUrl;
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    setupUserDropdown();
                }
            } else {
                if (res.status === 413) {
                    showToast('图片过大（413）。请选较小图片；若仍失败需服务端提高上传上限。', 'error');
                } else {
                    showToast(data.message || raw.slice(0, 120) || 'Upload failed', 'error');
                }
            }
        } catch (err) {
            console.error(err);
            const msg = (err && err.message) ? err.message : 'Network error';
            showToast(msg.length > 100 ? msg.slice(0, 100) + '…' : msg, 'error');
        } finally {
            fileInput.value = '';
        }
    });
}

// --- 新增：处理个人资料表单提交 ---
function setupProfileForm() {
    const saveBtn = document.querySelector('.save-btn');
    // 防止重复绑定，先克隆
    if(saveBtn) {
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        
        newBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('profile-name').value;
            const job = document.getElementById('profile-job').value; // 确保HTML有 id="profile-job"
            const bio = document.getElementById('profile-bio').value; // 确保HTML有 id="profile-bio"

            const originalText = newBtn.innerText;
            newBtn.innerText = 'Saving...';
            newBtn.disabled = true;

            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE_URL}/api/update-profile`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({ name, job, bio })
                });

                if (res.ok) {
                    showToast('Profile saved successfully!', 'success');
                    // 更新本地缓存
                    if(currentUser) {
                        currentUser.name = name;
                        currentUser.job = job;
                        currentUser.bio = bio;
                        localStorage.setItem('user', JSON.stringify(currentUser));
                        setupUserDropdown(); // 更新右上角名字
                    }
                } else {
                    showToast('Failed to save', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Network error', 'error');
            } finally {
                newBtn.innerText = originalText;
                newBtn.disabled = false;
            }
        });
    }
}

function canUsePremiumReportTemplates(plan) {
    const p = String(plan || 'free').toLowerCase().trim();
    return p === 'pro' || p === 'basic';
}

// --- 模块 D: 模板加载 ---
async function setupTemplates() {
    const templateSelect = document.getElementById('template');
    if (!templateSelect) return;
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/templates`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!response.ok) return;
        allTemplates = await response.json();
        if (allTemplates.length === 0) return;

        templateSelect.innerHTML = '<option value="" disabled selected>Select a Report Type...</option>';
        const groups = {};
        allTemplates.forEach(t => {
            const cat = t.category || 'Custom';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(t);
        });

        for (const [category, items] of Object.entries(groups)) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = category;
            items.forEach(t => {
                const option = document.createElement('option');
                option.value = t._id;
                const isLocked = t.isPro && !canUsePremiumReportTemplates(currentUserPlan);
                option.textContent = `${isLocked ? '🔒 ' : ''}${t.title}`;
                if (isLocked) option.disabled = true;
                optgroup.appendChild(option);
            });
            templateSelect.appendChild(optgroup);
        }
        setupDynamicInputs(templateSelect);
    } catch (error) { console.error('Template Load Error:', error); }
}

function setupDynamicInputs(templateSelect) {
    let dynamicContainer = document.getElementById('dynamic-inputs-container');
    if (!dynamicContainer) {
        dynamicContainer = document.createElement('div');
        dynamicContainer.id = 'dynamic-inputs-container';
        dynamicContainer.className = 'settings-grid';
        dynamicContainer.style.marginBottom = '20px';
        if (templateSelect.closest('.form-group')) templateSelect.closest('.form-group').after(dynamicContainer);
    }
    templateSelect.addEventListener('change', () => {
        const template = allTemplates.find(t => t._id === templateSelect.value);
        const promptTextarea = document.getElementById('key-points');
        dynamicContainer.innerHTML = '';
        if (promptTextarea) promptTextarea.value = '';
        if (!template) return;

        if (template.variables && template.variables.length > 0) {
            if (promptTextarea) promptTextarea.placeholder = "Additional notes...";
            template.variables.forEach(variable => {
                const wrapper = document.createElement('div');
                wrapper.className = 'input-wrapper mb-4';
                const label = document.createElement('label');
                label.className = 'block font-semibold mb-1 text-sm text-gray-700';
                label.textContent = variable.label || variable.id;
                let input;
                if (variable.type === 'textarea') {
                    input = document.createElement('textarea');
                    input.rows = 3;
                } else {
                    input = document.createElement('input');
                    input.type = 'text';
                }
                input.className = 'dynamic-input w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none';
                input.dataset.key = variable.id;
                input.placeholder = variable.placeholder || '';
                wrapper.appendChild(label);
                wrapper.appendChild(input);
                dynamicContainer.appendChild(wrapper);
            });
        } else {
            if (promptTextarea) promptTextarea.placeholder = "Enter key points here...";
        }
    });
}

// ========================================================
// 🟢 核心修复模块：生成器、渲染引擎、导出引擎
// ========================================================

// 1. 生成器逻辑 (含自动样式应用)
function setupGenerator() {
    const generateBtn = document.getElementById('generate-btn');
    if (!generateBtn) return;

    // 克隆按钮防止重复绑定
    const newGenerateBtn = generateBtn.cloneNode(true);
    generateBtn.parentNode.replaceChild(newGenerateBtn, generateBtn);

    newGenerateBtn.addEventListener('click', async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Please log in first.', 'error');
            window.openModal('login');
            return;
        }

        const promptEl = document.getElementById('key-points') || document.getElementById('prompt');
        const templateSelect = document.getElementById('template');
        const roleSelect = document.getElementById('role');
        const toneSelect = document.getElementById('tone');
        const resultBox = document.getElementById('generated-report');

        if (!promptEl || !promptEl.value.trim()) {
            showToast('Please enter report details.', 'warning');
            return;
        }

        // UI 进入加载状态
        const originalText = newGenerateBtn.innerHTML;
        newGenerateBtn.disabled = true;
        newGenerateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        
        // 预先清空并显示加载动画
        resultBox.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 text-gray-400">
                <i class="fas fa-magic fa-spin fa-2x mb-4 text-blue-500"></i>
                <p>Analyzing structure...</p>
            </div>
        `;

        try {
            const res = await fetch(`${API_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    userPrompt: promptEl.value.trim(),
                    role: roleSelect ? roleSelect.value : "General",
                    tone: toneSelect ? toneSelect.value : "Professional",
                    templateId: templateSelect ? templateSelect.value : "general",
                    language: document.getElementById('language')?.value || "English"
                }),
            });

            // 🟢 定位到 script.js 第 338 行附近的 .then(data => { ... })
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Generation failed');

            // 1. 分类存储 RIE 3.0 的多维数据
            window.currentReportContent = data.generatedText; // 主报告 (用于 Word)
            window.currentPPTOutline = data.pptOutline;       // PPT 大纲 (用于 PPT)
            window.currentEmailSummary = data.emailSummary;   // 邮件摘要 (用于 Email)

            // --- RIE 3.0 核心联动开始 ---  
            if (data.error) throw new Error(data.error || 'Generation failed');

            // 1. 存储主报告内容
            window.currentReportContent = data.generatedText;

            // 2. 存储 PPT 大纲和邮件摘要 (Pro 用户专属字段)
            if (data.pptOutline) {
                window.currentPPTOutline = data.pptOutline;
                console.log("✅ RIE 3.0: PPT Outline stored.");
            }

            if (data.emailSummary) {
                window.currentEmailSummary = data.emailSummary;
                console.log("✅ RIE 3.0: Email Summary stored.");
            }
            // --- RIE 3.0 核心联动结束 ---

            // 🟢 [核心优化]：渲染 Markdown + 应用专业皮肤（与 Word 导出同一套标题/分段规则）
            if (typeof marked !== 'undefined') {
                const mdPreview = normalizeMarkdownForPreviewDisplay(data.generatedText);
                const htmlContent = marked.parse(mdPreview, MARKED_OPTIONS_WORD);
                resultBox.innerHTML = htmlContent;
                
                // 根据角色/模板应用 CSS 皮肤
                resultBox.className = "w-full p-8 border border-gray-300 rounded-lg bg-white shadow-sm overflow-y-auto prose max-w-none text-gray-800"; // 重置基础类
                
                const role = roleSelect ? roleSelect.value : "";
                const template = templateSelect ? templateSelect.value : "";

                if (role === 'Management' || toneSelect.value === 'Professional') {
                    resultBox.classList.add('theme-corporate'); // 商务风
                } else if (role === 'Marketing' || toneSelect.value === 'Persuasive') {
                    resultBox.classList.add('theme-creative'); // 创意风
                } else {
                    resultBox.classList.add('theme-modern'); // 默认现代风
                }

            } else {
                resultBox.innerText = data.generatedText; // 降级处理
            }

            showToast("Report Generated Successfully!", "success");

        } catch (err) {
            console.error(err);
            resultBox.innerHTML = `<p class="text-red-500 text-center mt-10">Error: ${err.message}</p>`;
            showToast(err.message, 'error');
        } finally {
            newGenerateBtn.disabled = false;
            newGenerateBtn.innerHTML = originalText;
        }
    });
}



// 🟢 [升级版] 复制按钮 (支持复制 格式/Rich Text)
function setupCopyBtn() {
    const copyBtn = document.getElementById('copy-btn');
    const resultBox = document.getElementById('generated-report');

    if (copyBtn && resultBox) {
        // 克隆按钮防止重复绑定
        const newCopyBtn = copyBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);

        newCopyBtn.addEventListener('click', async () => {
            // 防空检查
            if (!resultBox.innerText || resultBox.innerText.includes('AI 生成的精美报告')) {
                showToast('没有什么可复制的', 'warning');
                return;
            }

            try {
                // 💎 核心升级：同时写入 纯文本 和 HTML
                // 这样粘贴到记事本是文本，粘贴到 Word/微信 就是带格式的
                const textPlain = new Blob([resultBox.innerText], { type: 'text/plain' });
                const textHtml = new Blob([resultBox.innerHTML], { type: 'text/html' });
                
                const clipboardItem = new ClipboardItem({
                    'text/plain': textPlain,
                    'text/html': textHtml
                });

                await navigator.clipboard.write([clipboardItem]);
                
                // 按钮反馈动画
                const originalText = newCopyBtn.innerHTML;
                newCopyBtn.innerHTML = '<i class="fas fa-check"></i> Copied';
                newCopyBtn.classList.add('bg-green-600', 'text-white');
                
                setTimeout(() => {
                    newCopyBtn.innerHTML = originalText;
                    newCopyBtn.classList.remove('bg-green-600', 'text-white');
                }, 2000);
                
                showToast('内容(含格式)已复制!', 'success');

            } catch (err) {
                console.error('高级复制失败，尝试普通复制:', err);
                // 降级处理：如果浏览器不支持高级复制，只复制文本
                navigator.clipboard.writeText(resultBox.innerText);
                showToast('已复制纯文本', 'success');
            }
        });
    }
}

// 🟢 [修复版] 统一导出处理函数
// 🟢 修改 doExport 函数
function doExport(type) {
    const reportBox = document.getElementById('generated-report');
    const themeClass = reportBox ? (reportBox.className || '') : '';
    if (!reportBox || reportBox.innerText.length < 5) {
        showToast('请先生成报告', 'warning');
        return;
    }

    const filename = `Report_${new Date().toISOString().slice(0,10)}`;

    if (type === 'word') {
        const md =
            window.currentReportContent && String(window.currentReportContent).trim().length > 5
                ? window.currentReportContent
                : reportBox.innerText;
        const tpl = document.getElementById('template');
        exportToWord(md, filename, tpl ? tpl.value : null);
    } 
    // ... markdown 和 pdf 保持不变 ...
}

/** OOXML .docx：Unicode 全语言；西文 Calibri + 东亚 Microsoft YaHei（中日韩等）。网站与 App 共用同一逻辑。 */
const DOCX_FONT = { ascii: 'Calibri', eastAsia: 'Microsoft YaHei', cs: 'Calibri', hAnsi: 'Calibri' };
const DOCX_FONT_CODE = { ascii: 'Consolas', eastAsia: 'Microsoft YaHei', cs: 'Consolas', hAnsi: 'Consolas' };

async function loadDocxModule() {
    if (window.__reportifyDocx) return window.__reportifyDocx;
    if (typeof window.docx !== 'undefined' && window.docx.Document && window.docx.Packer) {
        window.__reportifyDocx = window.docx;
        return window.__reportifyDocx;
    }
    try {
        const mod = await import('https://cdn.jsdelivr.net/npm/docx@8.5.0/+esm');
        window.__reportifyDocx = mod;
        return mod;
    } catch (e) {
        console.error('docx ESM import failed', e);
        throw new Error('docx library failed to load');
    }
}

function buildDocxNumberingConfig(docx) {
    const { LevelFormat, AlignmentType, convertInchesToTwip } = docx;
    return {
        config: [
            {
                reference: 'reportify-bullet',
                levels: [
                    {
                        level: 0,
                        format: LevelFormat.BULLET,
                        text: '\u2022',
                        alignment: AlignmentType.LEFT,
                        style: {
                            paragraph: {
                                indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
                            },
                        },
                    },
                    {
                        level: 1,
                        format: LevelFormat.BULLET,
                        text: '\u2022',
                        alignment: AlignmentType.LEFT,
                        style: {
                            paragraph: {
                                indent: { left: convertInchesToTwip(1), hanging: convertInchesToTwip(0.25) },
                            },
                        },
                    },
                    {
                        level: 2,
                        format: LevelFormat.BULLET,
                        text: '\u2022',
                        alignment: AlignmentType.LEFT,
                        style: {
                            paragraph: {
                                indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) },
                            },
                        },
                    },
                ],
            },
            {
                reference: 'reportify-numbered',
                levels: [
                    {
                        level: 0,
                        format: LevelFormat.DECIMAL,
                        text: '%1.',
                        alignment: AlignmentType.LEFT,
                        style: {
                            paragraph: {
                                indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
                            },
                        },
                    },
                    {
                        level: 1,
                        format: LevelFormat.DECIMAL,
                        text: '%2.',
                        alignment: AlignmentType.LEFT,
                        style: {
                            paragraph: {
                                indent: { left: convertInchesToTwip(1), hanging: convertInchesToTwip(0.25) },
                            },
                        },
                    },
                ],
            },
        ],
    };
}

function flattenInlineToDocxRuns(el, docx, inherited) {
    const { TextRun } = docx;
    const inh = inherited || {};
    const runs = [];
    function walk(node, bold, italics, mono) {
        if (node.nodeType === Node.TEXT_NODE) {
            const t = node.textContent;
            if (!t) return;
            runs.push(
                new TextRun({
                    text: t,
                    bold: !!bold || !!inh.bold,
                    italics: !!italics || !!inh.italics,
                    font: mono ? DOCX_FONT_CODE : DOCX_FONT,
                })
            );
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const tag = node.tagName.toLowerCase();
        if (tag === 'br') {
            runs.push(new TextRun({ break: 1, font: DOCX_FONT }));
            return;
        }
        let b = bold;
        let i = italics;
        let m = mono;
        if (tag === 'strong' || tag === 'b') b = true;
        if (tag === 'em' || tag === 'i') i = true;
        if (tag === 'code') m = true;
        if (tag === 'u') {
            for (const c of node.childNodes) walk(c, b, i, m);
            return;
        }
        if (tag === 'span' || tag === 'a' || tag === 'mark' || tag === 'small' || tag === 'sup' || tag === 'sub') {
            for (const c of node.childNodes) walk(c, b, i, m);
            return;
        }
        for (const c of node.childNodes) walk(c, b, i, m);
    }
    walk(el, false, false, false);
    if (runs.length === 0) runs.push(new TextRun({ text: (el.textContent || '').trim(), font: DOCX_FONT }));
    return runs;
}

function flattenNodeChildrenToRuns(el, docx) {
    const { TextRun } = docx;
    const runs = [];
    const kids = Array.from(el.childNodes);
    if (kids.length === 1 && kids[0].nodeType === Node.ELEMENT_NODE && kids[0].tagName.toLowerCase() === 'p') {
        return flattenInlineToDocxRuns(kids[0], docx, {});
    }
    for (const child of kids) {
        if (child.nodeType === Node.TEXT_NODE) {
            const t = child.textContent;
            if (t) runs.push(new TextRun({ text: t, font: DOCX_FONT }));
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            runs.push(...flattenInlineToDocxRuns(child, docx, {}));
        }
    }
    if (runs.length === 0) runs.push(new TextRun({ text: (el.textContent || '').trim(), font: DOCX_FONT }));
    return runs;
}

function elementToDocxBlocks(el, docx, layoutProfile, listDepth) {
    const {
        Paragraph,
        TextRun,
        HeadingLevel,
        Table,
        TableRow,
        TableCell,
        WidthType,
        convertInchesToTwip,
    } = docx;
    void layoutProfile;
    const out = [];
    const tag = el.tagName.toLowerCase();

    if (tag === 'script' || tag === 'style') return out;

    if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main' || tag === 'center') {
        for (const c of el.children) out.push(...elementToDocxBlocks(c, docx, layoutProfile, listDepth));
        return out;
    }

    if (/^h[1-6]$/.test(tag)) {
        const level = Math.min(6, parseInt(tag[1], 10));
        const hl = [
            HeadingLevel.HEADING_1,
            HeadingLevel.HEADING_2,
            HeadingLevel.HEADING_3,
            HeadingLevel.HEADING_4,
            HeadingLevel.HEADING_5,
            HeadingLevel.HEADING_6,
        ][level - 1];
        const runs = flattenNodeChildrenToRuns(el, docx);
        out.push(
            new Paragraph({
                heading: hl,
                spacing: { before: 160, after: 120 },
                children: runs,
            })
        );
        return out;
    }

    if (tag === 'p') {
        out.push(
            new Paragraph({
                spacing: { after: 120 },
                children: flattenInlineToDocxRuns(el, docx, {}),
            })
        );
        return out;
    }

    if (tag === 'blockquote') {
        const runs = flattenNodeChildrenToRuns(el, docx);
        out.push(
            new Paragraph({
                spacing: { before: 120, after: 120 },
                indent: { left: convertInchesToTwip(0.35) },
                children: runs,
            })
        );
        return out;
    }

    if (tag === 'hr') {
        out.push(
            new Paragraph({
                spacing: { before: 160, after: 160 },
                children: [new TextRun({ text: '— — —', font: DOCX_FONT })],
            })
        );
        return out;
    }

    if (tag === 'pre') {
        const txt = el.textContent || '';
        out.push(
            new Paragraph({
                spacing: { before: 120, after: 120 },
                children: [new TextRun({ text: txt, font: DOCX_FONT_CODE })],
            })
        );
        return out;
    }

    if (tag === 'ul' || tag === 'ol') {
        const ordered = tag === 'ol';
        const ref = ordered ? 'reportify-numbered' : 'reportify-bullet';
        for (const li of el.children) {
            if (li.tagName.toLowerCase() !== 'li') continue;
            const depth = Math.min(listDepth, 8);
            const clone = li.cloneNode(true);
            clone.querySelectorAll('ul, ol').forEach((n) => n.remove());
            const runs = [];
            const ps = clone.querySelectorAll('p');
            if (ps.length) ps.forEach((p) => runs.push(...flattenInlineToDocxRuns(p, docx, {})));
            else runs.push(...flattenInlineToDocxRuns(clone, docx, {}));
            out.push(
                new Paragraph({
                    children: runs,
                    numbering: { reference: ref, level: depth },
                })
            );
            for (const nested of li.querySelectorAll(':scope > ul, :scope > ol')) {
                out.push(...elementToDocxBlocks(nested, docx, layoutProfile, listDepth + 1));
            }
        }
        return out;
    }

    if (tag === 'table') {
        const rows = [];
        for (const tr of el.querySelectorAll('tr')) {
            const cells = [];
            for (const td of tr.querySelectorAll('th, td')) {
                const isTh = td.tagName.toLowerCase() === 'th';
                cells.push(
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: flattenInlineToDocxRuns(td, docx, isTh ? { bold: true } : {}),
                            }),
                        ],
                    })
                );
            }
            if (cells.length) rows.push(new TableRow({ children: cells }));
        }
        if (rows.length) {
            out.push(
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows,
                })
            );
        }
        return out;
    }

    if (el.children && el.children.length) {
        for (const c of el.children) out.push(...elementToDocxBlocks(c, docx, layoutProfile, listDepth));
        if (out.length) return out;
    }

    out.push(
        new Paragraph({
            spacing: { after: 80 },
            children: flattenInlineToDocxRuns(el, docx, {}),
        })
    );
    return out;
}

function htmlToDocxChildren(html, docx, layoutProfile) {
    const d = new DOMParser().parseFromString('<div id="__docx_root">' + html + '</div>', 'text/html');
    const root = d.getElementById('__docx_root');
    if (!root) return [];
    const blocks = [];
    for (const child of root.children) {
        blocks.push(...elementToDocxBlocks(child, docx, layoutProfile, 0));
    }
    return blocks;
}

async function buildDocxBlobFromHtml(htmlBody, layoutProfile, themeClass, docx) {
    const { Document, Packer, Paragraph } = docx;
    void themeClass;
    const numbering = buildDocxNumberingConfig(docx);
    let children = htmlToDocxChildren(htmlBody, docx, layoutProfile);
    if (!children.length) children = [new Paragraph({ text: '' })];
    let doc;
    try {
        doc = new Document({
            creator: 'Reportify AI',
            title: 'Report',
            description: 'Generated report',
            numbering,
            styles: {
                default: {
                    document: {
                        run: {
                            font: 'Calibri',
                            eastAsia: 'Microsoft YaHei',
                        },
                    },
                },
            },
            sections: [
                {
                    properties: {},
                    children,
                },
            ],
        });
    } catch (e) {
        console.warn('buildDocxBlobFromHtml styles fallback', e);
        doc = new Document({
            creator: 'Reportify AI',
            title: 'Report',
            numbering,
            sections: [{ properties: {}, children }],
        });
    }
    return Packer.toBlob(doc);
}

// ==============================================================
// 🟢 1. [Word 引擎 3.0]：原生 .docx（OOXML），网站与 App 一致
// ==============================================================
async function exportToWord(content, filename, passedTemplateId = null) {
    if (content == null || String(content).trim() === '') {
        showToast("暂无内容可导出", 'error');
        return;
    }
    showToast('正在生成 Word 文档 (.docx)...', 'info');

    try {
        const isNativeWord = window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();
        const reportBox = document.getElementById('generated-report');
        const themeClass = reportBox ? (reportBox.className || '') : '';
        const layoutProfile = resolveWordLayoutProfile(passedTemplateId, content);
        let htmlBody;
        if (canUseRenderedReportHtml(reportBox)) {
            htmlBody = sanitizeHtmlFragmentForWord(stripTrailingBrandingHtml(reportBox.innerHTML));
        } else {
            htmlBody = buildWordHtmlByRules(content);
        }
        if (!htmlBody) {
            showToast('暂无内容可导出', 'error');
            return;
        }
        htmlBody = repairMarkdownBoldInTextNodes(repairStrayMarkdownBold(htmlBody));

        const docxMod = await loadDocxModule();
        const blob = await buildDocxBlobFromHtml(htmlBody, layoutProfile, themeClass, docxMod);
        const docName = `${filename}.docx`;
        if (isNativeWord) {
            const ok = await reportifySaveDownloadInNative(blob, docName, 'Word 已生成（.docx），请保存或分享');
            if (!ok) return;
            return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = docName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Word 文档 (.docx) 下载成功!', 'success');
    } catch (err) {
        console.error('exportToWord', err);
        const msg = err && (err.message || String(err));
        showToast(msg ? `Word 导出失败：${msg.length > 120 ? msg.slice(0, 120) + '…' : msg}` : 'Word 导出失败', 'error');
    }
}

// ==============================================================
// 🟢 [V8.0 旗舰引擎] 动态主题 + 智能解析 + 完整结构 (目录/总结)
// ==============================================================
// 🟢 升级：允许传入第三个参数 templateType，用于决定颜色皮肤
// 🟢 统一引擎：接收数据库传来的专属摘要 (passedSummary)
function exportToPPT(content, filename, passedTemplate = null, passedSummary = null) {
    const rawData = content; 
    
    if (typeof PptxGenJS === 'undefined') {
        if(window.showToast) window.showToast('PPT Engine Loading...', 'error');
        return;
    }
    if(window.showToast) window.showToast("Generating Dynamic Theme PPT...", "info");

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9'; 
    pptx.title = filename;

    // --- 1. 动态嗅探用户选择的报告场景 (优先使用历史记录传来的参数) ---
    let reportType = passedTemplate;
    if (!reportType) {
        const templateSelect = document.getElementById('template');
        reportType = templateSelect ? templateSelect.value : 'general';
    }

    // --- 2. 动态颜色主题矩阵 (Dynamic Theme Engine) ---
    let theme = { name: "Corporate Standard" };
    let c = {}; // Colors object

    if (['monthly_review', 'quarterly_report', 'annual_summary'].includes(reportType)) {
        // 高管咨询风 (麦肯锡深空黑/曜石金)
        theme.name = "Executive Consulting";
        c = { primary: '0F172A', secondary: '1E293B', accent: 'D97706', bgLight: 'FAFAFA', textDark: '000000', textMuted: '475569' };
    } else if (['daily_standup', 'weekly_pulse', 'project_update'].includes(reportType)) {
        // 敏捷现代风 (硅谷翡翠绿)
        theme.name = "Agile Modern";
        c = { primary: '065F46', secondary: '047857', accent: '34D399', bgLight: 'FFFFFF', textDark: '064E3B', textMuted: '374151' };
    } else if (['marketing_copy', 'social_media'].includes(reportType)) {
        // 创意思维风 (霓虹紫)
        theme.name = "Creative Vibrant";
        c = { primary: '4C1D95', secondary: '5B21B6', accent: 'EC4899', bgLight: 'FDF2F8', textDark: '2E1065', textMuted: '4C1D95' };
    } else {
        // 经典商务蓝 (默认)
        c = { primary: '1E3A8A', secondary: '2563EB', accent: 'F59E0B', bgLight: 'FFFFFF', textDark: '1E293B', textMuted: '64748B' };
    }

    // 🟢 升级版智能多语言引擎：依靠字符频次判断，杜绝误判
    let lang = 'en';
    let fontTitle = 'Arial';
    let fontBody = 'Arial';
    
    // 统计各类字符出现的次数
    const zhMatches = rawData.match(/[\u4e00-\u9fa5]/g) || [];
    const jaMatches = rawData.match(/[\u3040-\u30ff]/g) || [];
    const koMatches = rawData.match(/[\uac00-\ud7af]/g) || [];

    // 1. 优先判断日文和韩文 (日文含有专属假名，韩文有谚文)
    if (jaMatches.length > 15) {
        lang = 'ja'; fontTitle = 'Meiryo'; fontBody = 'Meiryo';
    } else if (koMatches.length > 15) {
        lang = 'ko'; fontTitle = 'Malgun Gothic'; fontBody = 'Malgun Gothic';
    } 
    // 2. 然后判断中文 (汉字数量必须超过阈值，防止英文报告里混入几个中文被误判)
    else if (zhMatches.length > 15) {
        lang = 'zh'; fontTitle = 'Microsoft YaHei'; fontBody = 'Microsoft YaHei';
    } 
    // 3. 判断欧洲语言 (提高阈值，剔除极易与英文混淆的单字母词如 a, o, e, y)
    else {
        const countWords = (regex) => (rawData.match(regex) || []).length;
        if (countWords(/\b(der|die|das|und|ist|für|auf)\b/gi) > 6) lang = 'de';
        else if (countWords(/\b(les|est|dans|une|pour|avec|sur)\b/gi) > 6) lang = 'fr';
        else if (countWords(/\b(não|são|uma|com|para|dos|das|sobre)\b/gi) > 6) lang = 'pt';
        else if (countWords(/\b(los|las|por|con|una|del|para|como)\b/gi) > 6) lang = 'es';
    }

    // 准备全语种精准翻译字典
    const i18n = {
        en: { agenda: "Agenda Overview", summary: "Executive Summary & Outlook", fallbackSum: "Detailed structural optimization and implementation strategies have been thoroughly analyzed in the preceding sections.", thanks: "THANK YOU", thanksSub: "For your time and attention" },
        zh: { agenda: "目录概览", summary: "执行摘要 & 战略展望", fallbackSum: "前面的章节已经对结构优化和执行策略进行了详尽的分析与总结。", thanks: "感谢观看", thanksSub: "感谢您的时间与关注" },
        ja: { agenda: "アジェンダ概要", summary: "エグゼクティブサマリー", fallbackSum: "詳細な構造最適化と実装戦略については、前のセクションで徹底的に分析されています。", thanks: "ご清聴ありがとうございました", thanksSub: "お時間をいただきありがとうございます" },
        ko: { agenda: "아젠다 개요", summary: "요약 및 전망", fallbackSum: "자세한 구조 최적화 및 실행 전략은 이전 섹션에서 철저히 분석되었습니다.", thanks: "감사합니다", thanksSub: "시간을 내주셔서 감사합니다" },
        es: { agenda: "Resumen de la Agenda", summary: "Resumen Ejecutivo", fallbackSum: "Las estrategias de optimización e implementación estructural se han analizado exhaustivamente en las secciones anteriores.", thanks: "GRACIAS", thanksSub: "Por su tiempo y atención" },
        fr: { agenda: "Aperçu de l'Ordre du Jour", summary: "Résumé Analytique", fallbackSum: "L'optimisation structurelle détaillée et les stratégies de mise en œuvre ont été analysées dans les sections précédentes.", thanks: "MERCI", thanksSub: "Pour votre temps et votre attention" },
        de: { agenda: "Agenda Übersicht", summary: "Zusammenfassung", fallbackSum: "Detaillierte strukturelle Optimierungs- und Implementierungsstrategien wurden in den vorherigen Abschnitten gründlich analysiert.", thanks: "VIELEN DANK", thanksSub: "Für Ihre Zeit und Aufmerksamkeit" },
        pt: { agenda: "Visão Geral da Agenda", summary: "Resumo Executivo", fallbackSum: "Estratégias detalhadas de otimização estrutural e implementação foram analisadas exaustivamente nas seções anteriores.", thanks: "OBRIGADO", thanksSub: "Pelo seu tempo e atenção" }
    };
    
    const t = i18n[lang] || i18n['en'];

    // --- 3. 注册多级母版 ---
    pptx.defineSlideMaster({
        title: 'COVER',
        background: { color: c.primary },
        objects: [
            { rect: { x: '8%', y: '45%', w: '84%', h: 0.05, fill: { color: c.secondary } } },
            { rect: { x: '8%', y: '46%', w: '15%', h: 0.02, fill: { color: c.accent } } },
        ]
    });

    pptx.defineSlideMaster({
        title: 'TRANSITION',
        background: { color: c.secondary },
        objects: [
            { rect: { x: 0, y: 0, w: '3%', h: '100%', fill: { color: c.primary } } },
        ]
    });

    pptx.defineSlideMaster({
        title: 'CONTENT',
        background: { color: c.bgLight },
        objects: [
            // 顶栏背景
            { rect: { x: 0, y: 0, w: '100%', h: 0.9, fill: { color: c.primary } } },
            // 顶栏下方的彩色腰线
            { rect: { x: 0, y: 0.9, w: '100%', h: 0.04, fill: { color: c.accent } } },
            // 页脚分割线
            { rect: { x: '5%', y: '92%', w: '90%', h: 0.01, fill: { color: 'CBD5E1' } } },
            // 页脚文字
            { text: { text: "Reportify AI Proprietary", options: { x: '5%', y: '94%', w: '30%', color: c.textMuted, fontSize: 9, fontFace: fontBody } } }
        ],
        slideNumber: { x: '90%', y: '94%', color: c.textMuted, fontSize: 9, align: 'right', fontFace: fontBody }
    });

    // --- 4. 智能文本切分与解析 (解决内容不全的问题) ---
    // 清除 Markdown 代码块标记和奇怪的粗体标记
    let cleanText = rawData.replace(/```json/gi, '').replace(/```/g, '')
                           .replace(/\*\*Slide \d+[:\-]?\*\*/gi, '')
                           .replace(/Slide \d+[:\-]?/gi, '').trim();

    const blocks = [];
    const rawLines = cleanText.split('\n');
    let currentBlock = { title: "", content: [] };
    
    // 🟢 核心优化：移除数字 \d+\. 防止把普通列表项当成新幻灯片切分，增加“第X部分”的识别
    const headingRegex = /^(#{1,4}\s+|[一二三四五六七八九十]、|第[一二三四五六七八九十][部分章])/;

    rawLines.forEach(line => {
        let txt = line.trim();
        if (!txt) return;

        if (headingRegex.test(txt)) {
            // 保存旧区块
            if (currentBlock.title || currentBlock.content.length > 0) {
                blocks.push({...currentBlock});
            }
            // 清洗标题标记
            currentBlock = { 
                title: txt.replace(headingRegex, '').replace(/\*\*/g, '').trim(), 
                content: [] 
            };
        } else {
            currentBlock.content.push(txt.replace(/\*\*/g, '').replace(/__/g, ''));
        }
    });
    // 塞入最后一个区块
    if (currentBlock.title || currentBlock.content.length > 0) {
        blocks.push(currentBlock);
    }

    // 极端情况防御：大模型如果不分段，强制按句号切片
    if (blocks.length <= 1) {
        let forcedBlocks = [];
        let allTextArray = cleanText.split(/[\n。；]/); 
        let tempContent = [];
        allTextArray.forEach(t => {
            if(!t.trim()) return;
            tempContent.push(t.trim() + "。");
            if (tempContent.length >= 4) { 
                forcedBlocks.push({ title: "Key Section", content: [...tempContent] });
                tempContent = [];
            }
        });
        if (tempContent.length > 0) forcedBlocks.push({ title: "Final Insights", content: tempContent });
        blocks.splice(0, blocks.length, ...forcedBlocks);
    }

    // --- 5. 渲染封面页 ---
    let cover = pptx.addSlide({ masterName: 'COVER' });
    
    // 🟢 核心修复：彻底抛弃文件名，直接从 AI 报告正文中抓取真正的一级大标题 (# 标题)
    let docTitle = "Strategic Report"; 
    const titleMatch = rawData.match(/^#\s+(.+)$/m); // 正则探测第一个带有 # 的行
    
    if (titleMatch && titleMatch[1]) {
        // 如果抓到了，就剔除里面可能带有的 ** 加粗符号
        docTitle = titleMatch[1].replace(/\*\*/g, '').trim();
    } else {
        // 如果极少数情况下没抓到，兜底使用清理过日期的文件名
        let cleanFilename = filename.replace(/_\d{4}-\d{2}-\d{2}.*/, '');
        docTitle = cleanFilename.replace(/_/g, ' ').replace(/Report/i, 'Strategic Report').trim();
    }

    // 🟢 智能字号计算：根据标题长度动态缩小字号
    let titleFontSize = 40;
    if (docTitle.length > 30) {
        titleFontSize = 24; // 字数超过30字，缩小为24号
    } else if (docTitle.length > 15) {
        titleFontSize = 32; // 字数超过15字，缩小为32号
    }

    cover.addText(docTitle, {
        x: '8%', y: '18%', w: '84%', h: 2.5, 
        fontSize: titleFontSize, color: 'FFFFFF', bold: true, fontFace: fontTitle, breakLine: true
    });
    cover.addText("CONFIDENTIAL & PROPRIETARY", { 
        x: '8%', y: '50%', w: '84%', fontSize: 13, color: c.accent, letterSpacing: 2, fontFace: fontBody 
    });
    cover.addText(`Prepared: ${new Date().toLocaleDateString()}`, { 
        x: '8%', y: '55%', w: '84%', fontSize: 11, color: '9CA3AF', fontFace: fontBody 
    });

    // --- 6. 自动生成目录页 (Agenda) ---
    let agendaTitleList = blocks.filter(b => b.title).map(b => b.title).slice(0, 8); 
    if (agendaTitleList.length > 1) {
        let agenda = pptx.addSlide({ masterName: 'CONTENT' });
        agenda.addText(t.agenda, { 
            x: '5%', y: 0.15, w: '90%', h: 0.6, 
            fontSize: 24, color: 'FFFFFF', bold: true, fontFace: fontTitle 
        });
        
        let agendaBullets = agendaTitleList.map((t, idx) => ({ 
            text: `0${idx+1}.   ${t}`, 
            options: { fontSize: 16, color: c.textDark, breakLine: true, margin: [0,0,18,0], fontFace: fontBody, bold: true } 
        }));
        // 修正目录文字的绝对坐标
        agenda.addText(agendaBullets, { x: '10%', y: 1.5, w: '80%', h: 5.0, valign: 'top' });
    }

    // --- 7. 渲染正文内容页 (修复下坠 Bug) ---
    blocks.forEach((block, index) => {
        let slideTitle = block.title || `Section ${index + 1}`;
        let lines = block.content;

        if (lines.length === 0) return; // 忽略空块

        let s = pptx.addSlide({ masterName: 'CONTENT' });
        // 标题固定在蓝条内
        s.addText(slideTitle, { 
            x: '5%', y: 0.15, w: '90%', h: 0.6, 
            fontSize: 22, color: 'FFFFFF', bold: true, fontFace: fontTitle, valign: 'middle'
        });

        let slideBullets = [];
        let totalChars = 0;

        lines.forEach(txt => {
            totalChars += txt.length;
            // 🟢 核心优化：让数字列表 (1. 2. 3.) 作为同一个页面的项目符号，而不是新开一页
            if (txt.startsWith('- ') || txt.startsWith('* ') || /^\d+\.\s/.test(txt)) {
                let cleanTxt = txt.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
                slideBullets.push({ 
                    text: cleanTxt, 
                    options: { bullet: true, color: c.textDark, breakLine: true, fontFace: fontBody } 
                });
            } else {
                slideBullets.push({ 
                    text: txt.trim(), 
                    options: { color: c.textMuted, breakLine: true, fontFace: fontBody } 
                });
            }
        });

        // 动态字号防溢出
        let fSize = 15;
        if (totalChars > 350) fSize = 13;
        if (totalChars > 500) fSize = 11;

        slideBullets.forEach(b => { 
            b.options.fontSize = fSize; 
            b.options.margin = [0, 0, 12, 0]; 
        });

        if (slideBullets.length > 0) {
            // 🚨 核心修复：锁死 y: 1.2 和 valign: 'top'，防止内容下坠
            s.addText(slideBullets, { 
                x: '5%', y: 1.2, w: '90%', h: 4.8, 
                valign: 'top', margin: [0, 0, 0, 0], 
                lineSpacing: fSize * 1.5 
            });
        }
    });

    // --- 8. 生成总结与展望页 (Summary & Outlook) ---
    // 🟢 优先级：历史记录传入的摘要 > 主页全局缓存的摘要 > 兜底文案
    const summaryText = passedSummary || window.currentEmailSummary || t.fallbackSum;
    
    let summarySlide = pptx.addSlide({ masterName: 'CONTENT' });
    summarySlide.addText(t.summary, { 
        x: '5%', y: 0.15, w: '90%', h: 0.6, 
        fontSize: 22, color: 'FFFFFF', bold: true, fontFace: fontTitle 
    });
    
    summarySlide.addShape(pptx.ShapeType.rect, { x: '5%', y: 1.5, w: '90%', h: 4.0, fill: { color: c.bgLight }, line: { color: c.secondary, width: 2 } });
    summarySlide.addText(summaryText.replace(/```json/gi, '').replace(/```/g, ''), { 
        x: '8%', y: 1.8, w: '84%', h: 3.4, 
        valign: 'top', fontSize: 16, color: c.textDark, fontFace: fontBody, italic: true, lineSpacing: 28
    });

    // --- 9. 结尾感谢页 ---
    let endSlide = pptx.addSlide({ masterName: 'TRANSITION' });
    endSlide.addText(t.thanks, { 
        x: '0%', y: '40%', w: '100%', align: 'center', 
        fontSize: 48, color: 'FFFFFF', bold: true, fontFace: fontTitle 
    });
    endSlide.addText(t.thanksSub, { 
        x: '0%', y: '55%', w: '100%', align: 'center', 
        fontSize: 16, color: c.accent, fontFace: fontBody 
    });

    // --- 10. 触发下载 ---
    const pptName = `${theme.name}_Deck_${filename}.pptx`;
    const pptDone = () => {
        if (window.showToast) window.showToast('Professional PPT Downloaded!', 'success');
    };
    const pptErr = (err) => {
        console.error('PPT Generation Error:', err);
        if (window.showToast) window.showToast('Failed to generate PPT', 'error');
    };
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform() && typeof pptx.write === 'function') {
        pptx
            .write('blob')
            .then(async (blob) => {
                await reportifySaveDownloadInNative(blob, pptName, 'Professional PPT Downloaded!');
            })
            .catch(pptErr);
    } else {
        pptx.writeFile({ fileName: pptName }).then(pptDone).catch(pptErr);
    }
}

// ==============================================================
// 🟢 3. [在线分享]：模拟生成链接
// ==============================================================
function shareReportLink() {
    // 因为目前没有后端存储分享页，我们模拟一个
    // 在真实生产环境，这里会请求 API 生成短链
    const mockLink = `${window.location.origin}/share/${Math.random().toString(36).substr(2, 9)}`;
    
    // 复制到剪贴板
    navigator.clipboard.writeText(mockLink).then(() => {
        showToast(`分享链接已复制: ${mockLink}`, "success");
    }, () => {
        showToast("复制失败，请重试", "error");
    });
}

// 🟢 [优化版] 邮件发送：先下载文档，再打开邮件
function emailReport() {
    // 1. 获取当前内容
    const resultBox = document.getElementById('generated-report');
    if (!resultBox || resultBox.innerText.length < 5) {
        showToast('请先生成报告', 'warning');
        return;
    }
    
    // 2. 自动触发 Word 下载
    showToast("正在为您下载 Word 附件...", "info");
    const filename = `Report_${new Date().toISOString().slice(0,10)}`;
    const md =
        window.currentReportContent && String(window.currentReportContent).trim().length > 5
            ? window.currentReportContent
            : resultBox.innerText;
    const tpl = document.getElementById('template');
    exportToWord(md, filename, tpl ? tpl.value : null);

    // 3. 延时打开邮件客户端 (给下载留点时间)
    setTimeout(() => {
        const subject = encodeURIComponent("Sharing an AI-generated report");
        const body = encodeURIComponent("Hello，\n\nThis is a professional report I generated using Reportify AI.\n\n[Attachment Instructions]: The system has automatically downloaded a Word document for you. Please manually drag and drop this file into the attachment.\n\nGenerated by Reportify AI");
        
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        showToast("The email has been opened. Please manually add the attachment you just downloaded.", "success");
    }, 1000);
}

// 🟢 [新增] Markdown 下载功能
async function downloadMarkdown() {
    const content = window.currentReportContent; // 获取全局存储的 Markdown 原文
    if (!content) {
        showToast("没有可下载的内容", "warning");
        return;
    }
    
    const filename = `Report_${new Date().toISOString().slice(0,10)}.md`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
        const ok = await reportifySaveDownloadInNative(blob, filename, 'Markdown 已下载');
        if (!ok) return;
        return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Markdown 源码已下载", "success");
}

// --- 模块 G: 支付与卡片交互逻辑 (财务防弹版) ---
function waitForPayPal(onReady, onTimeout) {
    let tries = 0;
    const max = 160;
    function tick() {
        if (typeof window.paypal !== 'undefined' && window.paypal && typeof window.paypal.Buttons === 'function') {
            onReady();
            return;
        }
        if (++tries >= max) {
            if (typeof onTimeout === 'function') onTimeout();
            return;
        }
        setTimeout(tick, 100);
    }
    tick();
}

function setupPayment() {
    const cards = document.querySelectorAll('.pricing-card');
    const paymentModal = document.getElementById('payment-modal-overlay');
    const closePaymentBtn = document.getElementById('close-payment-btn');
    const paypalContainer = document.getElementById('paypal-button-container');

    // 1. 样式定义
    const activeCardClasses = ['border-blue-600', 'ring-2', 'ring-blue-500', 'shadow-xl', 'scale-105', 'z-10'];
    const inactiveCardClasses = ['border-gray-200', 'shadow-sm'];
    const activeBtnClasses = ['bg-blue-600', 'text-white', 'border-transparent', 'hover:bg-blue-700'];
    const inactiveBtnClasses = ['bg-white', 'text-blue-600', 'border-gray-200', 'hover:bg-gray-50'];

    const activateCard = (targetCard) => {
        cards.forEach(c => {
            c.classList.remove(...activeCardClasses);
            c.classList.add(...inactiveCardClasses);
            c.classList.remove('transform'); 
            const btn = c.querySelector('.choose-plan-btn');
            if (btn) {
                btn.classList.remove(...activeBtnClasses);
                btn.classList.add(...inactiveBtnClasses);
            }
        });
        targetCard.classList.remove(...inactiveCardClasses);
        targetCard.classList.add(...activeCardClasses);
        targetCard.classList.add('transform'); 
        const targetBtn = targetCard.querySelector('.choose-plan-btn');
        if (targetBtn) {
            targetBtn.classList.remove(...inactiveBtnClasses);
            targetBtn.classList.add(...activeBtnClasses);
        }
    };

    cards.forEach(card => {
        card.addEventListener('click', () => activateCard(card));
    });

    const payButtons = document.querySelectorAll('.choose-plan-btn');
    payButtons.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); 
            
            const card = newBtn.closest('.pricing-card');
            if(card) activateCard(card);

            const planType = newBtn.dataset.plan; // 获取 plan: free, basic, pro
            const token = localStorage.getItem('token');

            // --- 逻辑 A: 免费版 ---
            if (planType === 'free') {
                if (token) window.location.href = 'usage.html'; 
                else window.openModal('signup');
                return;
            }

            // --- 逻辑 B: 付费版 (Basic / Pro) ---
            if (!token) {
                showToast('Please login to upgrade.', 'info');
                window.openModal('login');
                return;
            }

            // 🟢 核心修复：根据全局的年费开关 (isYearlyBilling)，动态计算最终传给 PayPal 的金额和传给后端的套餐名！
            let finalPlanId = planType;
            let finalAmount = '0.00';

            if (window.isYearlyBilling) {
                // 如果是年付
                finalPlanId = planType + '_annual'; // 变成 basic_annual 或 pro_annual
                finalAmount = planType === 'basic' ? '99.00' : '199.00';
            } else {
                // 如果是月付
                finalAmount = planType === 'basic' ? '9.90' : '19.90';
            }

            const planNameEl = document.getElementById('payment-plan-name');
            if (planNameEl) {
                if (planType === 'basic') {
                    planNameEl.textContent = window.isYearlyBilling ? 'Basic — Annual ($99)' : 'Basic — Monthly ($9.90)';
                } else if (planType === 'pro') {
                    planNameEl.textContent = window.isYearlyBilling ? 'Professional — Annual ($199)' : 'Professional — Monthly ($19.90)';
                } else {
                    planNameEl.textContent = 'Reportify AI';
                }
            }

            if (!paypalContainer) {
                showToast('Payment UI missing on this page.', 'error');
                return;
            }

            if (paymentModal) paymentModal.style.display = 'flex';
            paypalContainer.innerHTML = '<p style="text-align:center;color:#64748b;font-size:13px;padding:12px;">Loading PayPal…</p>';

            waitForPayPal(() => {
                paypalContainer.innerHTML = '';
                try {
                    window.paypal.Buttons({
                        style: { layout: 'vertical', shape: 'rect', label: 'paypal' },
                        createOrder: (data, actions) => actions.order.create({
                            purchase_units: [{
                                description: `Reportify AI ${finalPlanId}`,
                                amount: { value: finalAmount }
                            }]
                        }),
                        onApprove: (data, actions) => actions.order.capture().then(async () => {
                            if (paymentModal) paymentModal.style.display = 'none';
                            showToast('Payment confirmed! Upgrading account...', 'info');
                            try {
                                const res = await fetch(`${API_BASE_URL}/api/upgrade-plan`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                    body: JSON.stringify({ planId: finalPlanId, paymentId: data.orderID })
                                });
                                const resultData = await res.json();
                                if (!res.ok) throw new Error(resultData.message || 'Upgrade failed');
                                showToast('Upgraded Successfully!', 'success');
                                setTimeout(() => window.location.reload(), 1500);
                            } catch (err) {
                                showToast(err.message || 'Upgrade failed, contact support.', 'error');
                            }
                        }),
                        onError: (err) => {
                            console.error('PayPal onError', err);
                            showToast('PayPal error. Try again or check your network.', 'error');
                        },
                        onCancel: () => {
                            if (paymentModal) paymentModal.style.display = 'none';
                        }
                    }).render('#paypal-button-container');
                } catch (e) {
                    console.error(e);
                    paypalContainer.innerHTML = '<p style="color:#b91c1c;font-size:13px;text-align:center;">PayPal failed to start.</p>';
                }
            }, () => {
                showToast('PayPal SDK did not load. Check network / VPN.', 'error');
                paypalContainer.innerHTML = '<p style="color:#b91c1c;font-size:13px;text-align:center;padding:12px;">PayPal could not load (blocked or offline). Open this page in a normal browser tab or allow paypal.com.</p>';
            });
        });
    });

    if (closePaymentBtn && paymentModal) {
        closePaymentBtn.addEventListener('click', () => paymentModal.style.display = 'none');
        paymentModal.addEventListener('click', (e) => { if (e.target === paymentModal) paymentModal.style.display = 'none'; });
    }
}

// --- 模块 H: 联系表单 ---
function setupContactForm() {
    const contactForm = document.getElementById('contact-form');
    if (currentUser) {
        const emailInput = document.getElementById('email');
        const nameInput = document.getElementById('name');
        if (emailInput) emailInput.value = currentUser.email || '';
        if (nameInput) nameInput.value = currentUser.name || '';
    }
    if (contactForm) {
        const newForm = contactForm.cloneNode(true);
        contactForm.parentNode.replaceChild(newForm, contactForm);
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = newForm.querySelector('button');
            const original = btn.textContent;
            btn.disabled = true; btn.textContent = 'Sending...';
            try {
                const data = {
                    name: document.getElementById('name').value,
                    email: document.getElementById('email').value,
                    message: document.getElementById('message').value,
                    type: document.getElementById('contact-type')?.value || 'General'
                };
                const res = await fetch(`${API_BASE_URL}/api/contact`, {
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
                });
                if (res.ok) { showToast("Sent!", "success"); newForm.reset(); }
            } catch(e) { showToast("Error", "error"); }
            finally { btn.disabled = false; btn.textContent = original; }
        });
    }
}

// --- 模块 I: 历史记录加载器 (增强版：带下载功能) ---
function setupHistoryLoader() {
    // 1. 只有在历史页才执行
    if (!window.location.pathname.includes('history')) return;

    // 定义一个全局变量存数据，方便下载时提取内容
    window.currentHistoryData = [];

    // 2. 加载数据的主函数
    window.loadHistoryData = async function() {
        const container = document.getElementById('history-container');
        if (!container) return;

        container.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #888;">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
                <p style="margin-top: 10px;">Loading...</p>
            </div>`;

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                container.innerHTML = `<div style="text-align:center; padding:40px;">Please login.</div>`;
                return;
            }

            const res = await fetch(`${API_BASE_URL}/api/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Failed to fetch history");

            const reports = await res.json();
            window.currentHistoryData = reports; // 保存数据供下载用

            if (reports.length === 0) {
                container.innerHTML = `<div style="text-align:center; padding:40px; color:#666;">No reports found.</div>`;
                return;
            }

            // 3. 渲染列表 (这里把下载按钮加回来！)
            container.innerHTML = reports.map(item => {
                const date = new Date(item.createdAt).toLocaleDateString();
                const preview = (item.content || "").substring(0, 120) + "...";
                
                return `
                <div style="background: white; border: 1px solid #eee; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); transition: transform 0.2s;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center;">
                        <span style="font-weight: bold; color: #333; font-size: 1.1em;">${item.title || 'Report'}</span>
                        <span style="font-size: 0.8em; color: #999;">${date}</span>
                    </div>
                    <div style="font-size: 0.9em; color: #666; line-height: 1.6; margin-bottom: 15px; height: 4.8em; overflow: hidden;">
                        ${preview}
                    </div>
                    
                    <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #f0f0f0; padding-top: 10px;">
                        <button type="button" class="history-export-icon-btn" onclick="downloadHistoryItem('${item._id}', 'md', '${item.templateId || 'general'}')" title="Markdown" style="color: #444; background: #f3f4f6; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            <i class="fab fa-markdown"></i>
                        </button>
                        <button type="button" class="history-export-icon-btn" onclick="downloadHistoryItem('${item._id}', 'word', '${item.templateId || 'general'}')" title="Word" style="color: #2b579a; background: #e8f0fe; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            <i class="fas fa-file-word"></i>
                        </button>
                        <button type="button" class="history-export-icon-btn" onclick="downloadHistoryItem('${item._id}', 'ppt', '${item.templateId || 'general'}')" title="PPT Draft" style="color: #ea4335; background: #fce8e6; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            <i class="fas fa-file-powerpoint"></i>
                        </button>
                        <button type="button" class="history-export-icon-btn" onclick="emailHistoryItem('${item._id}')" title="Email Report" style="color: #4b5563; background: #f3f4f6; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            <i class="fas fa-envelope"></i>
                        </button>
                        <div style="width: 1px; background: #ddd; margin: 0 5px;"></div>

                        <button onclick="viewReport('${item._id}')" style="color: #2563eb; background: none; border: none; cursor: pointer; font-weight: 500;">
                            View
                        </button>
                        <button onclick="deleteReport('${item._id}')" style="color: #ef4444; background: none; border: none; cursor: pointer;">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
                `;
            }).join('');

        } catch (err) {
            console.error(err);
            container.innerHTML = `<div style="text-align:center;">Load failed.</div>`;
        }
    };

    // 3. 实现下载功能的具体逻辑
    // 🟢 升级：接收第三个参数 passedTemplate
    window.downloadHistoryItem = async function(id, type, passedTemplate = 'general') {
        // 从缓存中找到这条报告
        const item = window.currentHistoryData.find(r => r._id === id);
        if (!item || !item.content) {
            showToast("Content not found", "error");
            return;
        }

        const filename = (item.title || "Report").replace(/[^a-z0-9]/gi, '_') + `_${new Date().toISOString().slice(0,10)}`;

        if (type === 'md') {
            const blob = new Blob([item.content], { type: 'text/markdown;charset=utf-8' });
            try {
                await saveAs(blob, `${filename}.md`);
                showToast("Markdown downloaded", "success");
            } catch (e) {
                /* native 失败时 reportifySaveDownloadInNative 已 toast */
            }
        } 
        // 🟢 Word：与主页相同的原生 .docx（OOXML）引擎
        else if (type === 'word') {
            exportToWord(item.content, filename, item.templateId || passedTemplate);
        }
        // 🟢 核心修复3：调用全新引擎，传入颜色参数，并把数据库里的专属摘要也传过去！
        else if (type === 'ppt') {
            if (typeof PptxGenJS === 'undefined') { showToast("PPT engine loading...", "info"); return; }
            exportToPPT(item.content, filename, passedTemplate, item.emailSummary);
        }
    };

    // 启动加载
    loadHistoryData();
}

// 🟢 核心修复4：历史记录专用的邮件发送逻辑 (完全复用主页 Word 附件方案)
    window.emailHistoryItem = function(id) {
        const item = window.currentHistoryData.find(r => r._id === id);
        if (!item || !item.content) {
            showToast("Content not found", "error");
            return;
        }
        
        showToast("正在为您下载 Word 附件...", "info");
        const filename = (item.title || "Report").replace(/[^a-z0-9]/gi, '_') + `_${new Date().toISOString().slice(0,10)}`;
        exportToWord(item.content, filename, item.templateId);

        setTimeout(() => {
            const subject = encodeURIComponent("Sharing an AI-generated report");
            const body = encodeURIComponent("Hello，\n\nThis is a professional report I generated using Reportify AI.\n\n[Attachment Instructions]: The system has automatically downloaded a Word document for you. Please manually drag and drop this file into the attachment.\n\nGenerated by Reportify AI");
            
            window.location.href = `mailto:?subject=${subject}&body=${body}`;
            showToast("The email has been opened. Please manually add the attachment you just downloaded.", "success");
        }, 1000);
    };

// 补充 View 和 Delete (保持你原来的，不用变，这里为了完整性列出)
window.deleteReport = async function(id) {
    if(!confirm("Delete this report?")) return;
    try {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_URL}/api/history/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        loadHistoryData();
        showToast("Deleted", "success");
    } catch(e) { showToast("Error", "error"); }
};

// --- 🟢 [重写] 漂亮的查看报告逻辑 ---
window.viewReport = function(id) {
    // 1. 找到数据
    const item = window.currentHistoryData.find(r => r._id === id);
    if (!item) return;

    // 2. 获取弹窗元素
    const modal = document.getElementById('report-view-modal');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const copyBtn = document.getElementById('modal-copy-btn');

    if (!modal) return;

    // 3. 填充内容
    titleEl.innerText = item.title || 'Generated Report';
    
    // 关键：使用 marked 库把 Markdown 变成漂亮的 HTML
    // 如果没有 marked 库，就退化成普通文本
    if (typeof marked !== 'undefined') {
        const mdPreview = normalizeMarkdownForPreviewDisplay(item.content);
        bodyEl.innerHTML = marked.parse(mdPreview, MARKED_OPTIONS_WORD);
    } else {
        bodyEl.innerHTML = item.content.replace(/\n/g, '<br>');
    }

    // 4. 绑定复制按钮功能
    copyBtn.onclick = function() {
        navigator.clipboard.writeText(item.content).then(() => {
            const originalText = copyBtn.innerText;
            copyBtn.innerText = 'Copied!';
            setTimeout(() => copyBtn.innerText = originalText, 2000);
        });
    };

    // 5. 显示弹窗 (使用 Flex 布局以保证居中)
    modal.style.display = 'flex';
    // 禁止背景滚动
    document.body.style.overflow = 'hidden';
};

// 关闭弹窗的函数
window.closeViewModal = function() {
    const modal = document.getElementById('report-view-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = ''; // 恢复滚动
    }
};

// 全局点击：历史报告弹窗遮罩 + 关闭用户菜单（仅保留这一处，避免后面的赋值覆盖导致行为丢失）
window.onclick = function (event) {
    const modal = document.getElementById('report-view-modal');
    if (modal && event.target === modal) {
        closeViewModal();
    }
    if (event.target && !event.target.closest('#auth-container')) {
        const m = document.getElementById('user-dropdown');
        if (m) m.classList.add('hidden');
    }
};

function setupMessageCenter() {
    const bellBtn = document.querySelector('button[title="My Messages"]');
    if(bellBtn) {
        const newBtn = bellBtn.cloneNode(true);
        bellBtn.parentNode.replaceChild(newBtn, bellBtn);
        newBtn.addEventListener('click', window.openMessageCenter);
    }
    checkNotifications();
    setInterval(checkNotifications, 30000);
}

window.openMessageCenter = function() {
    const token = localStorage.getItem('token');
    if (!token) { showToast("Please login first.", "warning"); return; }
    const modal = document.getElementById('message-modal');
    if(modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        loadMessages(true);
    }
};

window.closeMessageCenter = function() {
    const modal = document.getElementById('message-modal');
    if(modal) { modal.classList.add('hidden'); document.body.style.overflow = ''; }
};

window.checkNotifications = async function() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/my-messages`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const msgs = await res.json();
        const currentRepliedCount = msgs.filter(m => m.status === 'replied').length;
        const lastSeenCount = parseInt(localStorage.getItem('seen_reply_count') || '0');
        if (currentRepliedCount > lastSeenCount) {
            const badge = document.getElementById('notif-badge');
            if(badge) badge.classList.remove('hidden');
        }
    } catch (e) {}
};

async function loadMessages(markAsRead = false) {
    const container = document.getElementById('msg-list-container');
    const token = localStorage.getItem('token');
    
    container.innerHTML = '<div class="text-center text-gray-400 mt-10">Loading...</div>';

    try {
        const res = await fetch(`${API_BASE_URL}/api/my-messages`, { headers: { 'Authorization': `Bearer ${token}` } });
        const msgs = await res.json();

        if (markAsRead) {
            const repliedCount = msgs.filter(m => m.status === 'replied').length;
            localStorage.setItem('seen_reply_count', repliedCount);
            const badge = document.getElementById('notif-badge');
            if(badge) badge.classList.add('hidden');
        }

        container.innerHTML = '';
        if (msgs.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-400 mt-10">No messages found.</div>';
            return;
        }

        msgs.forEach(msg => {
            const dateStr = new Date(msg.submittedAt).toLocaleDateString();
            let replyHtml = msg.reply 
                ? `<div class="bg-blue-50 p-3 mt-3 rounded text-sm text-gray-800 border-l-4 border-blue-500">
                      <strong>Admin:</strong> ${msg.reply}
                   </div>` 
                : `<div class="text-xs text-gray-400 mt-2 italic">Pending reply...</div>`;
                
            if(msg.conversation && msg.conversation.length > 0) {
                 const adminMsgs = msg.conversation.filter(c => c.role === 'admin');
                 if(adminMsgs.length > 0) {
                    replyHtml = adminMsgs.map(c => 
                        `<div class="bg-blue-50 p-3 mt-3 rounded text-sm text-gray-800 border-l-4 border-blue-500">
                             <strong>Admin:</strong> ${c.message}
                         </div>`).join('');
                 }
            }

            container.innerHTML += `
                <div class="bg-white p-5 rounded-lg shadow-sm border border-gray-200 mb-4">
                    <div class="flex justify-between mb-2">
                        <span class="font-bold text-gray-700">${msg.type}</span>
                        <span class="text-xs text-gray-400">${dateStr}</span>
                    </div>
                    <p class="text-gray-600 text-sm">${msg.message}</p>
                    ${replyHtml}
                </div>
            `;
        });
    } catch (err) {
        container.innerHTML = '<p class="text-center text-red-400">Load failed.</p>';
    }
}

/** Account hub: block navigation to protected cards when logged out */
function setupAccountHubGuards() {
    if (!window.location.pathname.includes('account')) return;
    document.querySelectorAll('a.account-protected-link').forEach((a) => {
        a.addEventListener('click', (e) => {
            if (!localStorage.getItem('token')) {
                e.preventDefault();
                alert('Please log in to continue.');
                if (typeof window.openModal === 'function') window.openModal('login');
            }
        });
    });
}

// --- 模块 K: 用户菜单 (修复版：已加入管理员入口) ---
// Only mutate #auth-container — never replace .pwa-header-inner or .app-bottom-nav.
function setupUserDropdown() {
    const headerRight = document.getElementById('auth-container');
    if (!headerRight) return;
    
    // 1. 如果没有登录
    if (!currentUser) {
        headerRight.innerHTML = `
            <div class="auth-guest-actions" style="display: flex; gap: 8px; align-items: center;">
                <button type="button" class="btn-auth-pill" onclick="openModal('login')">Login / Register</button>
            </div>
        `;
    } else {
        // 2. 获取显示名称
        const displayName = currentUser.name || currentUser.displayName || currentUser.email.split('@')[0] || 'User';
        
        // 3. 获取头像链接
        const picUrl = currentUser.picture ? getFullImageUrl(currentUser.picture) : null;
        const initial = displayName.charAt(0).toUpperCase();

        // 4. 生成头像 HTML
        const avatarHtml = picUrl
            ? `<img src="${picUrl}" alt="Avatar" class="pwa-user-avatar"
                   style="border-radius: 50%; object-fit: cover; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.1); cursor: pointer;" 
                   onclick="toggleUserMenu()">`
            : `<div onclick="toggleUserMenu()" class="pwa-user-avatar pwa-user-avatar--initial"
                   style="border-radius: 50%; background-color: #2563eb; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; cursor: pointer; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                   ${initial}
               </div>`;

        // 🟢 [关键新增] 如果是管理员，生成这个红色的按钮HTML
        const adminLinkHtml = (currentUser.role === 'admin') ? `
            <a href="admin.html" style="display: block; padding: 10px 16px; color: #dc2626; text-decoration: none; font-size: 14px; font-weight: bold; transition: background 0.2s; border-top: 1px solid #f3f4f6;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='white'">
                <i class="fas fa-shield-alt" style="margin-right: 8px;"></i> Admin Dashboard
            </a>
        ` : '';

        // 6. 渲染菜单
        headerRight.innerHTML = `
            <div class="pwa-header-user-wrap" style="position: relative; display: flex; align-items: center; gap: 8px;">
                <span class="pwa-header-user-name" style="font-size: 13px; font-weight: 600; color: #333; max-width: 42vw;">${displayName}</span>
                ${avatarHtml}
                
                <div id="user-dropdown" class="hidden" 
                     style="position: absolute; right: 0; top: 55px; width: 200px; background: white; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #eee; z-index: 9999; overflow: hidden; text-align: left;">
                     
                     <div style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; background-color: #f9fafb;">
                        <p style="font-size: 12px; color: #6b7280; margin: 0;">Signed in as</p>
                        <p style="font-size: 14px; font-weight: bold; color: #111; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${currentUser.email}</p>
                     </div>

                     <a href="account.html" style="display: block; padding: 10px 16px; color: #374151; text-decoration: none; font-size: 14px; transition: background 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">
                        <i class="fas fa-user-circle" style="margin-right: 8px; color: #3b82f6;"></i> My Account
                     </a>
                     
                     <a href="usage.html" style="display: block; padding: 10px 16px; color: #374151; text-decoration: none; font-size: 14px; transition: background 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">
                        <i class="fas fa-chart-pie" style="margin-right: 8px; color: #10b981;"></i> Usage Stats
                     </a>

                     ${adminLinkHtml}

                     <a href="#" onclick="logout()" style="display: block; padding: 10px 16px; color: #ef4444; text-decoration: none; font-size: 14px; border-top: 1px solid #f3f4f6; transition: background 0.2s;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='white'">
                        <i class="fas fa-sign-out-alt" style="margin-right: 8px;"></i> Logout
                     </a>
                </div>
            </div>
        `;
    }
}

window.toggleUserMenu = function() { const m = document.getElementById('user-dropdown'); if(m) m.classList.toggle('hidden'); };
window.logout = function() { localStorage.removeItem('token'); window.location.reload(); };

// --- 修改点 A：加载个人资料页数据 ---
async function loadProfilePageData() {
    // 1. 确保拿到用户信息
    if (!currentUser) await fetchUserProfile();
    if (!currentUser) return;

    // 2. 填充头像 (关键：这里使用了 getFullImageUrl 来修补链接)
    const avatarImg = document.getElementById('profile-avatar');
    if (avatarImg) {
        avatarImg.src = getFullImageUrl(currentUser.picture);
    }

    // 3. 填充名字和邮箱
    const nameInput = document.getElementById('profile-name');
    const emailInput = document.getElementById('profile-email');
    
    // 防止页面上没有这些 ID 导致报错
    if (nameInput) nameInput.value = currentUser.name || '';
    if (emailInput) emailInput.value = currentUser.email || '';
}

// --- [重写] 账户页头像加载 (强制圆框版) ---
async function loadAccountPageAvatar() {
    console.log("正在加载账户页头像...");
    const bigAvatar = document.getElementById('account-hub-avatar');
    
    // 如果页面上没这个元素（比如在首页），直接退出
    if (!bigAvatar) return;

    // 1. 确保有用户信息
    if (!currentUser) await fetchUserProfile();

    // 2. 计算图片地址
    let finalUrl;
    if (currentUser && currentUser.picture) {
        finalUrl = getFullImageUrl(currentUser.picture);
    } else {
        finalUrl = getFullImageUrl(null); // 获取默认图
    }

    // 3. [关键] 强制应用样式 (解决大方块问题)
    // 不管 HTML/CSS 怎么写，这里强制把它变成圆的
    bigAvatar.style.width = '100px';
    bigAvatar.style.height = '100px';
    bigAvatar.style.borderRadius = '50%'; // 变圆
    bigAvatar.style.objectFit = 'cover';  // 裁剪防变形
    bigAvatar.style.border = '4px solid #fff';
    bigAvatar.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)';

    // 4. 设置图片与错误处理
    bigAvatar.src = finalUrl;
    
    // 如果加载失败（被墙或404），自动切回默认图
    bigAvatar.onerror = function() {
        console.warn("头像加载失败，已切换为默认图");
        this.src = getFullImageUrl(null);
    };
}

// ========================================================
// 🟢 账户设置页与登录弹窗的按钮事件绑定修复
// ========================================================
document.addEventListener('DOMContentLoaded', () => {

    // 1. 修复：登录弹窗中的“忘记密码”按钮
    // 寻找可能是忘记密码的链接 (根据常见 Tailwind/HTML 结构猜测)
    const forgotPwdLinks = document.querySelectorAll('a[href="#forgot"], .forgot-password, #forgot-password');
    forgotPwdLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // 阻止页面跳转
            // 目前如果没有做邮件发送系统，先用 Toast 提示用户
            showToast("密码重置系统接入中。请暂时联系管理员邮箱 support@goreportify.com 找回密码。", "info");
        });
    });

    // 2. 修复：修改密码表单提交
    const changePwdForm = document.getElementById('change-password-form');
    if (changePwdForm) {
        // 🟢 定点插入：修改密码的实时强度校验
        const securityNewPwdInput = document.getElementById('new-password');
        const securityStrengthBox = document.getElementById('security-password-strength-box');
        
        if (securityNewPwdInput && securityStrengthBox) {
            securityNewPwdInput.addEventListener('focus', () => {
                securityStrengthBox.style.display = 'block';
            });
            
            securityNewPwdInput.addEventListener('input', (e) => {
                const val = e.target.value;
                const reqLength = document.getElementById('sec-req-length');
                const reqUpper = document.getElementById('sec-req-upper');
                const reqNumber = document.getElementById('sec-req-number');
                const reqSpecial = document.getElementById('sec-req-special');

                // 长度检查
                if(val.length >= 8) { reqLength.classList.add('text-green-500'); reqLength.innerHTML = '<i class="fas fa-check-circle" style="margin-right:6px;"></i> 8+ chars'; }
                else { reqLength.classList.remove('text-green-500'); reqLength.innerHTML = '<i class="far fa-circle" style="margin-right:6px;"></i> 8+ chars'; }

                // 大写检查
                if(/[A-Z]/.test(val)) { reqUpper.classList.add('text-green-500'); reqUpper.innerHTML = '<i class="fas fa-check-circle" style="margin-right:6px;"></i> Uppercase'; }
                else { reqUpper.classList.remove('text-green-500'); reqUpper.innerHTML = '<i class="far fa-circle" style="margin-right:6px;"></i> Uppercase'; }

                // 数字检查
                if(/[0-9]/.test(val)) { reqNumber.classList.add('text-green-500'); reqNumber.innerHTML = '<i class="fas fa-check-circle" style="margin-right:6px;"></i> Number'; }
                else { reqNumber.classList.remove('text-green-500'); reqNumber.innerHTML = '<i class="far fa-circle" style="margin-right:6px;"></i> Number'; }

                // 特殊字符检查
                if(/[\W_]/.test(val)) { reqSpecial.classList.add('text-green-500'); reqSpecial.innerHTML = '<i class="fas fa-check-circle" style="margin-right:6px;"></i> Symbol'; }
                else { reqSpecial.classList.remove('text-green-500'); reqSpecial.innerHTML = '<i class="far fa-circle" style="margin-right:6px;"></i> Symbol'; }
            });
        }
        changePwdForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // 假设你的 HTML 里有这两个 ID 的输入框
            const oldPassword = document.getElementById('old-password').value;
            const newPassword = document.getElementById('new-password').value;
            const submitBtn = changePwdForm.querySelector('button[type="submit"]');
            
            if(!oldPassword || !newPassword) return showToast("Please fill in all fields", "warning");

            // 🟢 新增：严格的密码复杂度正则校验
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            if (!passwordRegex.test(newPassword)) {
                return showToast("Password must contain at least 8 characters, including uppercase, lowercase, numbers, and special symbols.", "warning");
            }

            const originalText = submitBtn.innerText;
            submitBtn.innerText = "更新中...";
            submitBtn.disabled = true;

            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE_URL}/api/change-password`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({ oldPassword, newPassword })
                });

                const data = await res.json();
                
                if (res.ok) {
                    showToast(data.message, "success");
                    changePwdForm.reset();
                    // 密码修改成功后，强制退出要求重新登录
                    setTimeout(() => {
                        localStorage.removeItem('token');
                        window.location.href = HOME_REL;
                    }, 2000);
                } else {
                    // 这里会精准捕获我们在后端写的 "旧密码不正确" 的报错
                    showToast(data.message, "error");
                }
            } catch (err) {
                showToast("网络错误", "error");
            } finally {
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // 3. 修复：删除账号按钮
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) {
        // 先克隆替换，防止重复绑定多次点击事件
        const newDeleteBtn = deleteAccountBtn.cloneNode(true);
        deleteAccountBtn.parentNode.replaceChild(newDeleteBtn, deleteAccountBtn);

        newDeleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // 二次确认，防止误触
            if (!confirm("⚠️ 警告：确定要永久删除您的账号和所有生成的报告吗？此操作不可逆！")) {
                return;
            }

            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE_URL}/api/delete-account`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    showToast("账号已彻底删除，期待您的再次使用。", "success");
                    localStorage.removeItem('token');
                    setTimeout(() => { window.location.href = HOME_REL; }, 1500);
                } else {
                    const data = await res.json();
                    showToast(data.message || "删除失败", "error");
                }
            } catch (err) {
                showToast("网络错误，请稍后重试", "error");
            }
        });
    }
});

// --- Password Reset UI Flow ---
window.openForgotModal = function() {
    const loginModal = document.getElementById('auth-modal-overlay');
    if(loginModal) loginModal.classList.add('hidden');
    const forgotModal = document.getElementById('forgot-password-modal');
    if(forgotModal) {
        forgotModal.classList.remove('hidden');
        document.getElementById('step1-form').classList.remove('hidden');
        document.getElementById('step2-form').classList.add('hidden');
        document.getElementById('forgot-subtitle').innerText = "Enter your registered email address.";
        
        // 🟢 核心修复：每次打开忘记密码弹窗时，强制“大扫除”，重置所有按钮状态和表单输入框
        const btn1 = document.getElementById('btn-send-code');
        if(btn1) { btn1.innerText = "Send Verification Code"; btn1.disabled = false; }
        
        const btn2 = document.getElementById('btn-reset-pwd');
        if(btn2) { btn2.innerText = "Confirm Reset"; btn2.disabled = false; }
        
        const form1 = document.getElementById('step1-form');
        if(form1) form1.reset();
        
        const form2 = document.getElementById('step2-form');
        if(form2) form2.reset();
    }
};

window.closeForgotModal = function() {
    document.getElementById('forgot-password-modal').classList.add('hidden');
};

// Listen for "Forgot Password" clicks
document.addEventListener('click', function(e) {
    const target = e.target;
    const parentAnchor = target.closest('a');
    
    const isForgotElement = (parentAnchor && parentAnchor.href.includes('forgot')) || 
                            (target.id && target.id.toLowerCase().includes('forgot')) ||
                            (target.className && typeof target.className === 'string' && target.className.toLowerCase().includes('forgot'));

    const textContent = target.innerText ? target.innerText.toLowerCase() : '';
    const hasForgotText = textContent.includes('forgot') || textContent.includes('忘记');

    if (isForgotElement || hasForgotText) {
        e.preventDefault();
        e.stopPropagation(); // 🟢 关键修复：阻止事件冒泡到关闭弹窗的逻辑
        if (typeof openForgotModal === 'function') {
            openForgotModal();
        }
    }
});

// Step 1: Request Code
// 🟢 定点插入：重置密码弹窗的实时强度校验
const resetPwdInput = document.getElementById('reset-new-password');
const resetStrengthBox = document.getElementById('reset-password-strength-box');

if (resetPwdInput && resetStrengthBox) {
    resetPwdInput.addEventListener('focus', () => {
        resetStrengthBox.style.display = 'block';
    });
    
    resetPwdInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const reqLength = document.getElementById('reset-req-length');
        const reqUpper = document.getElementById('reset-req-upper');
        const reqNumber = document.getElementById('reset-req-number');
        const reqSpecial = document.getElementById('reset-req-special');

        if(val.length >= 8) { reqLength.classList.add('text-green-500'); reqLength.innerHTML = '<i class="fas fa-check-circle" style="margin-right:6px;"></i> 8+ chars'; }
        else { reqLength.classList.remove('text-green-500'); reqLength.innerHTML = '<i class="far fa-circle" style="margin-right:6px;"></i> 8+ chars'; }

        if(/[A-Z]/.test(val)) { reqUpper.classList.add('text-green-500'); reqUpper.innerHTML = '<i class="fas fa-check-circle" style="margin-right:6px;"></i> Uppercase'; }
        else { reqUpper.classList.remove('text-green-500'); reqUpper.innerHTML = '<i class="far fa-circle" style="margin-right:6px;"></i> Uppercase'; }

        if(/[0-9]/.test(val)) { reqNumber.classList.add('text-green-500'); reqNumber.innerHTML = '<i class="fas fa-check-circle" style="margin-right:6px;"></i> Number'; }
        else { reqNumber.classList.remove('text-green-500'); reqNumber.innerHTML = '<i class="far fa-circle" style="margin-right:6px;"></i> Number'; }

        if(/[\W_]/.test(val)) { reqSpecial.classList.add('text-green-500'); reqSpecial.innerHTML = '<i class="fas fa-check-circle" style="margin-right:6px;"></i> Symbol'; }
        else { reqSpecial.classList.remove('text-green-500'); reqSpecial.innerHTML = '<i class="far fa-circle" style="margin-right:6px;"></i> Symbol'; }
    });
}
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'step1-form') {
        e.preventDefault();
        const email = document.getElementById('reset-email').value;
        const btn = document.getElementById('btn-send-code');
        btn.innerText = "Sending..."; btn.disabled = true;

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/send-reset-code`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
            });
            const data = await res.json();
            
            if (res.ok) {
                showToast("Code sent to your email.", "success");
                document.getElementById('step1-form').classList.add('hidden');
                document.getElementById('step2-form').classList.remove('hidden');
                document.getElementById('forgot-subtitle').innerText = `Code sent to ${email}`;
            } else {
                showToast(data.message, "error");
                btn.innerText = "Send Verification Code"; btn.disabled = false;
            }
        } catch (err) { 
            showToast("Network request failed.", "error"); 
            btn.innerText = "Send Verification Code"; btn.disabled = false; 
        }
    }

    // Step 2: Verify & Reset
    if (e.target.id === 'step2-form') {
        e.preventDefault();
        const email = document.getElementById('reset-email').value; 
        const code = document.getElementById('reset-code').value;
        const newPassword = document.getElementById('reset-new-password').value;
        const btn = document.getElementById('btn-reset-pwd');
        btn.innerText = "Resetting..."; btn.disabled = true;

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/verify-and-reset`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code, newPassword })
            });
            const data = await res.json();
            
            if (res.ok) {
                showToast("Password reset successful! Please log in.", "success");
                closeForgotModal();
                openModal('login'); 
            } else {
                showToast(data.message, "error");
                btn.innerText = "Confirm Reset"; btn.disabled = false;
            }
        } catch (err) { 
            showToast("Request failed.", "error"); 
            btn.innerText = "Confirm Reset"; btn.disabled = false; 
        }
    }
});

// ========================================================
// 🟢 计费周期切换逻辑 (Monthly vs Yearly)
// ========================================================
// 声明为全局变量，方便你以后在对接 PayPal API 时读取
window.isYearlyBilling = false; 

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('billing-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            window.isYearlyBilling = !window.isYearlyBilling;
            
            const circle = document.getElementById('toggle-circle');
            const labelMonthly = document.getElementById('label-monthly');
            const labelYearly = document.getElementById('label-yearly');

            if (window.isYearlyBilling) {
                // 切换到年付视觉状态
                circle.classList.add('translate-x-6');
                toggleBtn.classList.replace('bg-blue-600', 'bg-purple-600');
                
                labelMonthly.classList.replace('text-gray-900', 'text-gray-500');
                labelMonthly.classList.replace('font-semibold', 'font-medium');
                
                labelYearly.classList.replace('text-gray-500', 'text-gray-900');
                labelYearly.classList.replace('font-medium', 'font-semibold');

                // 更新价格数据
                document.getElementById('price-basic').innerText = '99.00';
                document.getElementById('period-basic').innerText = '/ yr';
                document.getElementById('price-pro').innerText = '199.00';
                document.getElementById('period-pro').innerText = '/ yr';
            } else {
                // 切换回月付视觉状态
                circle.classList.remove('translate-x-6');
                toggleBtn.classList.replace('bg-purple-600', 'bg-blue-600');
                
                labelYearly.classList.replace('text-gray-900', 'text-gray-500');
                labelYearly.classList.replace('font-semibold', 'font-medium');
                
                labelMonthly.classList.replace('text-gray-500', 'text-gray-900');
                labelMonthly.classList.replace('font-medium', 'font-semibold');

                // 还原价格数据
                document.getElementById('price-basic').innerText = '9.90';
                document.getElementById('period-basic').innerText = '/ mo';
                document.getElementById('price-pro').innerText = '19.90';
                document.getElementById('period-pro').innerText = '/ mo';
            }
        });
    }
});

// ========================================================
// 🟢 全局密码交互 UI (小眼睛与红绿验证引擎)
// ========================================================
document.addEventListener('click', function(e) {
    const toggleBtn = e.target.closest('.toggle-password');
    if (toggleBtn) {
        e.preventDefault();
        const container = toggleBtn.parentElement;
        const input = container.querySelector('input');
        const icon = toggleBtn.querySelector('i');
        
        if (input && input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else if (input) {
            input.type = 'password';
            icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    }
});

// 核心渲染器：根据密码输出红绿打勾 HTML
window.renderPasswordStrength = function(val, feedbackBox) {
    if (!val) {
        feedbackBox.style.display = 'none';
        return false;
    }
    feedbackBox.style.display = 'block';

    const hasUpper = /[A-Z]/.test(val);
    const hasLower = /[a-z]/.test(val);
    const hasNumber = /[0-9]/.test(val);
    const hasSpecial = /[\W_]/.test(val); 
    const isLongEnough = val.length >= 8;

    const iconStyle = "margin-right: 8px; width: 14px; text-align: center;";
    const checkIcon = `<i class="fas fa-check text-green-500" style="${iconStyle}"></i>`;
    const crossIcon = `<i class="fas fa-times text-red-500" style="${iconStyle}"></i>`;

    const getLine = (condition, text) => `
        <div style="display: flex; align-items: center; font-size: 12px; margin-bottom: 6px; color: ${condition ? '#10b981' : '#ef4444'}; font-weight: 600;">
            ${condition ? checkIcon : crossIcon} <span>${text}</span>
        </div>
    `;

    if (hasUpper && hasLower && hasNumber && hasSpecial && isLongEnough) {
        feedbackBox.innerHTML = `
            <div style="padding: 12px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; margin-top: 8px;">
                <div style="color: #059669; font-size: 13px; font-weight: bold; display: flex; align-items: center;">
                    <i class="fas fa-check-circle" style="margin-right: 6px; font-size: 16px;"></i> 密码强度达标 (Strong)
                </div>
            </div>
        `;
        if (feedbackBox.classList.contains('hidden')) feedbackBox.classList.remove('hidden');
        return true;
    } else {
        feedbackBox.innerHTML = `
            <div style="padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-top: 8px;">
                ${getLine(isLongEnough, '至少 8 个字符 (Min 8 chars)')}
                ${getLine(hasUpper, '包含大写字母 (Uppercase)')}
                ${getLine(hasLower, '包含小写字母 (Lowercase)')}
                ${getLine(hasNumber, '包含数字 (Number)')}
                ${getLine(hasSpecial, '包含特殊字符 (Special symbol)')}
            </div>
        `;
        if (feedbackBox.classList.contains('hidden')) feedbackBox.classList.remove('hidden');
        return false;
    }
};

// 绑定三大输入框的实时监听
document.addEventListener('DOMContentLoaded', () => {
    const bindLiveValidation = (inputId, boxId) => {
        const input = document.getElementById(inputId);
        const box = document.getElementById(boxId);
        if (input && box) {
            input.addEventListener('input', (e) => renderPasswordStrength(e.target.value, box));
            input.addEventListener('focus', (e) => renderPasswordStrength(e.target.value, box));
        }
    };
    bindLiveValidation('reset-new-password', 'reset-pwd-feedback');
    bindLiveValidation('new-password', 'security-pwd-feedback');
});
