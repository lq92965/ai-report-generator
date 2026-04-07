/* 文件名：mobile-patch.js */
/* 作用：原生 App 文件下载拦截与分享、强刷头像缓存 */

/* News/Blog 静态详情 + article.html：html 根类用于顶栏对齐（见 mobile-patch.css）；Capacitor / 缓存场景下 pathname 可能异常，DOM 就绪后再兜底一次 */
(function markNewsBlogDetailLayout() {
    function byUrl() {
        var raw = (location.pathname || '').replace(/^\/+/, '');
        try {
            raw = decodeURIComponent(raw);
        } catch (e) {}
        var f = (raw.split('/').pop() || '').split('?')[0].split('#')[0].toLowerCase();
        var href = (location.href || '').toLowerCase();
        if (/^(news|blog)-.+\.html$/i.test(f) || f === 'article.html') return true;
        if (/[\\/](news|blog)-[^/?#\\]+\.html/i.test(href)) return true;
        return false;
    }
    if (byUrl()) document.documentElement.classList.add('pwa-nb-detail-layout');
})();

document.addEventListener('DOMContentLoaded', function() {
    if (
        !document.documentElement.classList.contains('pwa-nb-detail-layout') &&
        document.querySelector('body.has-app-nav main.flex-grow > article.max-w-4xl.mx-auto')
    ) {
        document.documentElement.classList.add('pwa-nb-detail-layout');
    }

    // 检查是否在 Capacitor 原生 App 环境中
    const isNative = window.Capacitor && window.Capacitor.isNative;

    // -----------------------------------------
    // 拦截原生环境下的文件下载 (Word, PPT, Markdown)
    // -----------------------------------------
    if (isNative) {
        document.addEventListener('click', async function(e) {
            const target = e.target.closest('a');
            if (target && target.hasAttribute('download')) {
                e.preventDefault(); 

                const url = target.href;
                const filename = target.getAttribute('download') || 'Reportify_Document';

                try {
                    const Filesystem = window.Capacitor.Plugins.Filesystem;
                    const { Share } = window.Capacitor.Plugins.Share;
                    let base64Data;

                    if (url.startsWith('blob:')) {
                        const response = await fetch(url);
                        const blob = await response.blob();
                        base64Data = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                resolve(reader.result.split(',')[1]);
                            };
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                    } else if (url.startsWith('data:')) {
                        base64Data = url.split(',')[1];
                    } else {
                        window.open(url, '_system');
                        return;
                    }

                    const savedFile = await Filesystem.writeFile({
                        path: filename,
                        data: base64Data,
                        directory: 'DATA'
                    });

                    var shareUri = savedFile && savedFile.uri;
                    if (!shareUri && Filesystem.getUri) {
                        var gu = await Filesystem.getUri({ path: filename, directory: 'DATA' });
                        shareUri = gu && gu.uri;
                    }
                    if (!shareUri) throw new Error('No file uri for share');

                    await Share.share({
                        title: filename,
                        url: shareUri,
                        dialogTitle: 'Save or Share Document'
                    });

                } catch (error) {
                    console.error('App download error:', error);
                    alert('Save failed. Please check permissions.');
                }
            }
        });
    }

    // -----------------------------------------
    // 头像缓存：仅在当前页 DOM 就绪时 bust 一次（pageshow 每次返回都改 src 会闪动、顶栏跳动）
    // -----------------------------------------
    (function bustAvatarCacheOnce() {
        const avatarImages = document.querySelectorAll('img.rounded-full, img[src*="avatar"]');
        avatarImages.forEach(img => {
            if (!img.src.includes('logo') && !img.src.includes('icon')) {
                const originalSrc = img.src.split('?')[0];
                img.src = originalSrc + '?v=' + Date.now();
            }
        });
    })();

    // -----------------------------------------
    // News/Blog 静态详情页：列表链接带 ?lp=当前页
    // lp≤1：← Back to News / Back to Blog → news.html / blog.html
    // lp≥2：← Previous Page → news.html?p=lp / blog.html?p=lp（回到进入详情前的那一页）
    // （样式沿用页面上的 .unified-back-btn，不在此改字体颜色）
    // -----------------------------------------
    (function applyNewsBlogDetailBackFromLp() {
        const file = (location.pathname.split('/').pop() || '').toLowerCase();
        const m = file.match(/^(news|blog)-(\d+)\.html$/);
        if (!m) return;

        const kind = m[1];
        const listFile = kind === 'news' ? 'news.html' : 'blog.html';
        const params = new URLSearchParams(window.location.search);
        const lp = parseInt(params.get('lp'), 10) || 1;

        const a =
            document.querySelector('.pwa-header-leading .unified-back-btn') ||
            document.querySelector('.pwa-header-leading a#dynamic-back-btn') ||
            document.querySelector('.pwa-header-leading a.pwa-page-back-link') ||
            document.querySelector('.pwa-page-back-row a');
        if (!a) return;

        a.classList.add('unified-back-btn');
        a.removeAttribute('id');

        if (lp <= 1) {
            a.setAttribute('href', listFile);
            a.innerHTML =
                '<span class="back-arrow">←</span><span class="back-text">Back to ' +
                (kind === 'news' ? 'News' : 'Blog') +
                '</span>';
        } else {
            a.setAttribute('href', listFile + '?p=' + encodeURIComponent(String(lp)));
            a.innerHTML =
                '<span class="back-arrow">←</span><span class="back-text">Previous Page</span>';
        }
    })();
});

// 同站多页 HTML 跳转：支持时用 View Transition，减轻白屏闪一下（Chrome / 部分 WebView）
(function setupAppViewTransitions() {
    if (typeof document.startViewTransition !== 'function') return;
    document.addEventListener(
        'click',
        function (e) {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            var a = e.target.closest && e.target.closest('a[href]');
            if (!a || a.target === '_blank' || a.getAttribute('download')) return;
            var href = a.getAttribute('href');
            if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0) return;
            var url;
            try {
                url = new URL(a.href, window.location.href);
            } catch (err) {
                return;
            }
            if (url.origin !== window.location.origin) return;
            if (url.pathname === window.location.pathname && url.search === window.location.search) return;
            e.preventDefault();
            document.startViewTransition(function () {
                window.location.href = url.href;
            });
        },
        true
    );
})();

/** 拦截内联 onclick 的 Google 登录按钮，在 Capacitor 中附加 ?native_app=1（script.js 的 getGoogleAuthStartUrl 优先） */
(function interceptGoogleAuthInlineClicks() {
    function urlForGoogleAuth() {
        if (typeof window.getGoogleAuthStartUrl === 'function') return window.getGoogleAuthStartUrl();
        var base = 'https://api.goreportify.com/auth/google';
        try {
            if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
                return base + '?native_app=1';
            }
        } catch (err) {}
        return base;
    }
    document.addEventListener(
        'click',
        function (e) {
            if (e.button !== 0 || e.defaultPrevented) return;
            var el = e.target && e.target.closest && e.target.closest('button, a');
            if (!el) return;
            var oc = el.getAttribute && el.getAttribute('onclick');
            var href = el.getAttribute && el.getAttribute('href');
            var hitsGoogle =
                (oc && oc.indexOf('auth/google') !== -1) ||
                (href && href.indexOf('auth/google') !== -1 && href.indexOf('api.goreportify.com') !== -1);
            if (!hitsGoogle) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            window.location.href = urlForGoogleAuth();
        },
        true
    );
})();

/**
 * Generate 页（移动端）：原生 <select> 在 WebView 中会弹出系统大字号列表，无法用 CSS 美化。
 * 在 generate.html + 窄屏下用自定义底部弹层替代点击，仍同步真实 select 的值与 change 事件。
 */
(function setupPwaGenerateCustomSelects() {
    var SELECT_IDS = ['template', 'detail-level', 'role', 'tone', 'language'];

    function isGeneratePage() {
        var f = (location.pathname || '').replace(/^.*[\\/]/, '').split('?')[0].toLowerCase();
        return f === 'generate.html';
    }

    function isNarrow() {
        return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    }

    function getLabelForSelect(selectEl) {
        var id = selectEl.id;
        var lab = document.querySelector('label[for="' + id + '"]');
        return lab ? lab.textContent.replace(/\s+/g, ' ').trim() : 'Choose';
    }

    function refreshTrigger(btn, selectEl) {
        var opt = selectEl.options[selectEl.selectedIndex];
        var t = opt ? opt.textContent.trim() : '';
        btn.textContent = t || '—';
    }

    function flattenOptions(selectEl) {
        var out = [];
        var i;
        var node;
        var j;
        var o;
        for (i = 0; i < selectEl.children.length; i++) {
            node = selectEl.children[i];
            if (node.tagName === 'OPTGROUP') {
                out.push({ kind: 'group', label: node.label || '' });
                for (j = 0; j < node.children.length; j++) {
                    o = node.children[j];
                    if (o.tagName === 'OPTION') {
                        out.push({
                            kind: 'option',
                            value: o.value,
                            text: o.textContent,
                            disabled: o.disabled
                        });
                    }
                }
            } else if (node.tagName === 'OPTION') {
                out.push({
                    kind: 'option',
                    value: node.value,
                    text: node.textContent,
                    disabled: node.disabled
                });
            }
        }
        return out;
    }

    function ensureModal() {
        var el = document.getElementById('pwa-gen-select-overlay');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'pwa-gen-select-overlay';
        el.className = 'pwa-gen-select-overlay';
        el.setAttribute('hidden', '');
        el.innerHTML =
            '<div class="pwa-gen-select-backdrop" data-close="1"></div>' +
            '<div class="pwa-gen-select-sheet" role="dialog" aria-modal="true">' +
            '<div class="pwa-gen-select-sheet-head">' +
            '<button type="button" class="pwa-gen-select-cancel" data-close="1" aria-label="Close">Cancel</button>' +
            '<span class="pwa-gen-select-title"></span>' +
            '<span class="pwa-gen-select-head-spacer"></span>' +
            '</div>' +
            '<div class="pwa-gen-select-list"></div>' +
            '</div>';
        document.body.appendChild(el);
        el.addEventListener('click', function (e) {
            var t = e.target;
            if (t && (t.dataset && t.dataset.close)) closeModal();
        });
        return el;
    }

    var activeSelect = null;

    function closeModal() {
        var el = document.getElementById('pwa-gen-select-overlay');
        if (activeSelect) {
            var w0 = activeSelect.closest('.pwa-gen-select');
            var b0 = w0 && w0.querySelector('.pwa-gen-select-fake');
            if (b0) b0.setAttribute('aria-expanded', 'false');
        }
        if (el) {
            el.classList.remove('is-open');
            el.setAttribute('hidden', '');
        }
        activeSelect = null;
        document.body.classList.remove('pwa-gen-select-open');
    }

    function openModal(selectEl) {
        var overlay = ensureModal();
        var title = overlay.querySelector('.pwa-gen-select-title');
        var list = overlay.querySelector('.pwa-gen-select-list');
        title.textContent = getLabelForSelect(selectEl);
        list.innerHTML = '';
        activeSelect = selectEl;

        var flat = flattenOptions(selectEl);
        var currentVal = selectEl.value;
        var k;
        var row;
        var radio;
        var label;
        var item;

        for (k = 0; k < flat.length; k++) {
            item = flat[k];
            if (item.kind === 'group') {
                row = document.createElement('div');
                row.className = 'pwa-gen-select-group';
                row.textContent = item.label;
                list.appendChild(row);
            } else {
                row = document.createElement('button');
                row.type = 'button';
                row.className = 'pwa-gen-select-row';
                if (item.disabled) row.classList.add('is-disabled');
                if (String(item.value) === String(currentVal) && !item.disabled) {
                    row.classList.add('is-selected');
                }
                label = document.createElement('span');
                label.className = 'pwa-gen-select-row-text';
                label.textContent = item.text.trim();
                radio = document.createElement('span');
                radio.className = 'pwa-gen-select-radio';
                radio.setAttribute('aria-hidden', 'true');
                row.appendChild(label);
                row.appendChild(radio);

                if (!item.disabled) {
                    (function (val) {
                        row.addEventListener('click', function () {
                            if (!activeSelect) return;
                            activeSelect.value = val;
                            activeSelect.dispatchEvent(new Event('change', { bubbles: true }));
                            var wrap = activeSelect.closest('.pwa-gen-select');
                            if (wrap) {
                                var b = wrap.querySelector('.pwa-gen-select-fake');
                                if (b) refreshTrigger(b, activeSelect);
                            }
                            closeModal();
                        });
                    })(item.value);
                } else {
                    row.disabled = true;
                }
                list.appendChild(row);
            }
        }

        overlay.removeAttribute('hidden');
        void overlay.offsetWidth;
        overlay.classList.add('is-open');
        document.body.classList.add('pwa-gen-select-open');

        var wOpen = selectEl.closest('.pwa-gen-select');
        var bOpen = wOpen && wOpen.querySelector('.pwa-gen-select-fake');
        if (bOpen) bOpen.setAttribute('aria-expanded', 'true');

        requestAnimationFrame(function () {
            var selRow = list.querySelector('.pwa-gen-select-row.is-selected');
            if (selRow && selRow.scrollIntoView) selRow.scrollIntoView({ block: 'nearest' });
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && document.body.classList.contains('pwa-gen-select-open')) {
            e.preventDefault();
            closeModal();
        }
    });

    function wireSelect(selectEl) {
        if (selectEl.closest('.pwa-gen-select')) return;
        var wrap = document.createElement('div');
        wrap.className = 'pwa-gen-select';
        var parent = selectEl.parentNode;
        parent.insertBefore(wrap, selectEl);
        wrap.appendChild(selectEl);

        selectEl.classList.add('pwa-gen-select-native');

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pwa-gen-select-fake';
        btn.setAttribute('aria-haspopup', 'listbox');
        btn.setAttribute('aria-expanded', 'false');
        var tid = selectEl.id + '-pwa-trigger';
        btn.id = tid;

        var lab = document.querySelector('label[for="' + selectEl.id + '"]');
        if (lab) lab.setAttribute('for', tid);

        selectEl.setAttribute('tabindex', '-1');
        selectEl.setAttribute('aria-hidden', 'true');

        refreshTrigger(btn, selectEl);
        wrap.appendChild(btn);

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            openModal(selectEl);
        });

        selectEl.addEventListener('change', function () {
            refreshTrigger(btn, selectEl);
        });
    }

    function init() {
        if (!isGeneratePage() || !isNarrow()) return;
        var section = document.getElementById('generator');
        if (!section) return;

        var i;
        var sel;
        for (i = 0; i < SELECT_IDS.length; i++) {
            sel = document.getElementById(SELECT_IDS[i]);
            if (sel && sel.tagName === 'SELECT' && section.contains(sel)) wireSelect(sel);
        }

        var templateEl = document.getElementById('template');
        if (templateEl && window.MutationObserver) {
            var obs = new MutationObserver(function () {
                var w = templateEl.closest('.pwa-gen-select');
                var b = w && w.querySelector('.pwa-gen-select-fake');
                if (b) refreshTrigger(b, templateEl);
            });
            obs.observe(templateEl, { childList: true, subtree: true });
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(init, 0);
    });
})();