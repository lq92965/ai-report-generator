/**
 * One-time / batch: normalize news-*.html & blog-*.html detail pages —
 * remove duplicate back blocks, ensure PWA header + style.css + mobile-patch,
 * single unified back row, optional bottom nav + pwa-nav.js.
 * Run: node tools/normalize-news-blog-detail-pages.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* 与全站一致：勿用 Tailwind container + 顶栏 logo；返回在 .pwa-header-leading（style.css / mobile-patch） */
const HEADER_NEWS = `    <header class="main-header pwa-app-header">
        <div class="app-header-shell pwa-header-inner flex flex-row flex-nowrap items-center justify-between w-full gap-3 md:gap-6">
                <div class="pwa-header-leading flex items-center min-w-0 flex-shrink-0 max-w-[60%]">
            <a href="news.html" class="unified-back-btn"><span class="back-arrow">←</span><span class="back-text">Back to News</span></a>
        </div>
<nav class="main-nav pwa-desktop-nav hidden md:block" id="pwa-collapse-nav">
                <ul class="flex gap-6 font-medium text-gray-600">
                    <li><a href="index.html#features" class="hover:text-blue-600 transition">Features</a></li>
                    <li><a href="index.html#pricing" class="hover:text-blue-600 transition">Pricing</a></li>
                    <li><a href="generate.html" class="hover:text-blue-600 transition">Generator</a></li>
                    <li><a href="news.html" class="text-blue-600 font-bold">News</a></li>
                    <li><a href="blog.html" class="hover:text-blue-600 transition">Blog</a></li>
                </ul>
            </nav>
            <div class="pwa-header-actions" style="display: flex; align-items: center; gap: 12px;">
                <a href="usage.html#share-area" class="pwa-invite-icon-btn" title="Invite" aria-label="Invite">
                    <span class="pwa-invite-lucide"><i data-lucide="gift"></i></span>
                </a>
                <div id="auth-container" class="flex items-center gap-4 header-actions"></div>
            </div>
        </div>
    </header>`;

const HEADER_BLOG = `    <header class="main-header pwa-app-header">
        <div class="app-header-shell pwa-header-inner flex flex-row flex-nowrap items-center justify-between w-full gap-3 md:gap-6">
                <div class="pwa-header-leading flex items-center min-w-0 flex-shrink-0 max-w-[60%]">
            <a href="blog.html" class="unified-back-btn"><span class="back-arrow">←</span><span class="back-text">Back to Blog</span></a>
        </div>
<nav class="main-nav pwa-desktop-nav hidden md:block" id="pwa-collapse-nav">
                <ul class="flex gap-6 font-medium text-gray-600">
                    <li><a href="index.html#features" class="hover:text-blue-600 transition">Features</a></li>
                    <li><a href="index.html#pricing" class="hover:text-blue-600 transition">Pricing</a></li>
                    <li><a href="generate.html" class="hover:text-blue-600 transition">Generator</a></li>
                    <li><a href="news.html" class="hover:text-blue-600 transition">News</a></li>
                    <li><a href="blog.html" class="text-blue-600 font-bold">Blog</a></li>
                </ul>
            </nav>
            <div class="pwa-header-actions" style="display: flex; align-items: center; gap: 12px;">
                <a href="usage.html#share-area" class="pwa-invite-icon-btn" title="Invite" aria-label="Invite">
                    <span class="pwa-invite-lucide"><i data-lucide="gift"></i></span>
                </a>
                <div id="auth-container" class="flex items-center gap-4 header-actions"></div>
            </div>
        </div>
    </header>`;

const BOTTOM_NAV = `
    <nav id="app-bottom-nav" class="app-bottom-nav" aria-label="Main navigation">
        <a href="index.html" class="app-nav-item" data-nav="home"><span class="app-nav-icon"><i data-lucide="home"></i></span><span class="app-nav-label">Home</span></a>
        <a href="generate.html" class="app-nav-item" data-nav="generate"><span class="app-nav-icon"><i data-lucide="sparkles"></i></span><span class="app-nav-label">Generate</span></a>
        <a href="news.html" class="app-nav-item" data-nav="news"><span class="app-nav-icon"><i data-lucide="newspaper"></i></span><span class="app-nav-label">News</span></a>
        <a href="blog.html" class="app-nav-item" data-nav="blog"><span class="app-nav-icon"><i data-lucide="book-open"></i></span><span class="app-nav-label">Blog</span></a>
        <a href="account.html" class="app-nav-item" data-nav="mine"><span class="app-nav-icon"><i data-lucide="circle-user"></i></span><span class="app-nav-label">Mine</span></a>
    </nav>
`;

function isDetail(name) {
    return /^news-\d+\.html$/.test(name) || /^blog-\d+\.html$/.test(name);
}

function fixFile(filePath) {
    const base = path.basename(filePath);
    if (!isDetail(base)) return false;

    const kind = base.startsWith('news-') ? 'news' : 'blog';
    let text = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // 1) Remove duplicate "second" back block (container below main back row)
    const dup =
        /\s*<div class="container mx-auto px-6 mb-2 mt-8 w-full">[\s\S]*?<\/div>\s*/g;
    if (dup.test(text)) {
        text = text.replace(dup, '\n');
        changed = true;
    }

    // 2) Head: meta + manifest + style + mobile-patch + lucide order
    if (!text.includes('name="theme-color"')) {
        text = text.replace(
            /(<meta name="viewport"[^>]*>)/i,
            '$1\n    <meta name="theme-color" content="#2563eb">\n    <link rel="manifest" href="manifest.json">\n    <link rel="apple-touch-icon" href="icons/icon-192.png">'
        );
        changed = true;
    }
    if (!text.includes('style.css')) {
        text = text.replace(
            /(<link rel="stylesheet" href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/[^"]*">)/i,
            '$1\n    <link rel="stylesheet" href="style.css?v=3.2">'
        );
        if (!text.includes('style.css')) {
            text = text.replace(/<\/head>/i, '    <link rel="stylesheet" href="style.css?v=3.2">\n</head>');
        }
        changed = true;
    }
    if (!text.includes('mobile-patch.css')) {
        text = text.replace(
            /(<link href="https:\/\/fonts\.googleapis\.com[^>]*>)/i,
            '$1\n    \n    <link rel="stylesheet" href="mobile-patch.css?v=10">\n    <script src="mobile-patch.js?v=10"><\/script>'
        );
        if (!text.includes('mobile-patch.css')) {
            text = text.replace(/<\/head>/i, '    <link rel="stylesheet" href="mobile-patch.css?v=10">\n    <script src="mobile-patch.js?v=10"><\/script>\n</head>');
        }
        changed = true;
    }

    // Ensure lucide after mobile-patch (for gift icon)
    if (!text.includes('unpkg.com/lucide')) {
        text = text.replace(/<\/head>/i, '    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"><\/script>\n</head>');
        changed = true;
    }

    // 3) Body: has-app-nav
    if (!text.includes('has-app-nav')) {
        text = text.replace(
            /<body class="([^"]*)"/i,
            (m, c) => {
                if (c.includes('has-app-nav')) return m;
                return `<body class="has-app-nav ${c}"`;
            }
        );
        changed = true;
    }

    // 4) Replace header：合并错误模板（container+logo）、或缺少 app-header-shell
    const needsHeader =
        !text.includes('app-header-shell') ||
        text.includes('container mx-auto px-6 pwa-header-inner') ||
        text.includes('hide-mobile-text') ||
        text.includes('Invite &amp; Earn');
    if (needsHeader) {
        text = text.replace(/<header[\s\S]*?<\/header>/i, kind === 'news' ? HEADER_NEWS : HEADER_BLOG);
        changed = true;
    }

    // 5) 去掉独立第二行返回区（返回应在顶栏 .pwa-header-leading）；勿再插入 pwa-page-back-row
    if (text.includes('pwa-page-back-row')) {
        const newT = text.replace(/\s*<div class="pwa-page-back-row[^"]*"[^>]*>[\s\S]*?<\/div>\s*/i, '\n');
        if (newT !== text) {
            text = newT;
            changed = true;
        }
    }

    // 6) Bottom nav before footer
    if (!text.includes('id="app-bottom-nav"')) {
        text = text.replace(/(\s*)<footer class="main-footer/i, `${BOTTOM_NAV}\n$1<footer class="main-footer`);
        changed = true;
    }

    // 7) pwa-nav.js before script.js
    if (!text.includes('pwa-nav.js')) {
        text = text.replace(
            /(<script src="script\.js[^"]*"><\/script>)/i,
            '<script src="pwa-nav.js"><\/script>\n    $1'
        );
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(filePath, text, 'utf8');
        return true;
    }
    return false;
}

const files = fs.readdirSync(ROOT).filter((f) => isDetail(f));
let n = 0;
for (const f of files) {
    if (fixFile(path.join(ROOT, f))) {
        console.log('OK', f);
        n++;
    }
}
console.log('Done. Updated', n, 'of', files.length, 'detail file(s).');
