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
let currentUserPlan = 'basic'; 
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

/** Capacitor：写入应用私有目录（DATA）再分享。勿用 DOCUMENTS：Android 10+ 上公共 Documents 常需 legacy 存储权限，易失败。 */
async function reportifySaveDownloadInNative(blob, filename, successToastMsg) {
    try {
        const Filesystem = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
        const Share = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
        if (!Filesystem || !Share || typeof Filesystem.writeFile !== 'function') {
            throw new Error('Filesystem/Share unavailable');
        }
        const pathSafe = sanitizeDownloadFilename(filename);
        const writeOpts = { path: pathSafe, directory: 'DATA' };
        const type = blob.type || '';
        const useUtf8 =
            typeof blob.text === 'function' &&
            (type.startsWith('text/') || type.includes('markdown') || type === 'application/json');
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
        await Share.share({
            title: pathSafe,
            text: 'Reportify export',
            url: saved.uri,
            dialogTitle: 'Save or share file'
        });
        if (successToastMsg) showToast(successToastMsg, 'success');
    } catch (e) {
        console.error('Native save/share failed', e);
        showToast('Could not save file. Check storage permission.', 'error');
    }
}

window.saveAs = function(blob, filename) {
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
        void reportifySaveDownloadInNative(blob, filename, null);
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
    console.log("Reportify AI v22.1 Initialized");

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
            currentUserPlan = currentUser.plan || 'basic';
        } else if (res.status === 401) {
            localStorage.removeItem('token');
            currentUser = null;
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

        const formData = new FormData();
        formData.append('avatar', file);

        // 使用 showToast 显示 "正在上传..."
        showToast('Uploading...', 'info'); 

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/upload-avatar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                // 成功：只显示轻提示，不弹窗
                showToast('Success!', 'success');
                
                if (avatarImg) avatarImg.src = getFullImageUrl(data.avatarUrl);
                if (currentUser) {
                    currentUser.picture = data.avatarUrl;
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    setupUserDropdown(); // 立即更新右上角
                }
            } else {
                showToast(data.message || 'Upload failed', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Network error', 'error');
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
                const isLocked = t.isPro && currentUserPlan !== 'pro';
                option.textContent = `${isLocked ? '🔒 ' : ''}${t.title}`;
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

            // 2. 🟢 修复渲染逻辑：确保 Markdown 被正确转换为漂亮 HTML
            if (typeof marked !== 'undefined') {
                resultBox.innerHTML = marked.parse(data.generatedText);
                // 这里保持你原有的 theme-corporate 等皮肤切换逻辑不变
            } else {
                resultBox.innerText = data.generatedText;
            }

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

            // 🟢 [核心优化]：渲染 Markdown + 应用专业皮肤
            if (typeof marked !== 'undefined') {
                const htmlContent = marked.parse(data.generatedText);
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
    if (!reportBox || reportBox.innerText.length < 5) {
        showToast('请先生成报告', 'warning');
        return;
    }

    const filename = `Report_${new Date().toISOString().slice(0,10)}`;

    if (type === 'word') {
        // 🚀 核心修改：传入 innerHTML (带样式的渲染结果) 而不是文本
        exportToWord(reportBox.innerHTML, filename);
    } 
    // ... markdown 和 pdf 保持不变 ...
}

// ==============================================================
// 🟢 1. [Word 引擎 2.0]：精益求精版 (优化字体回退、行距、封面)
// ==============================================================
async function exportToWord(content, filename) {
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
            /* 🟢 核心修复：强制扒掉用于生成页眉页脚的隐形表格的边框，消灭末尾的空方块 */
            #header_footer_ref, #header_footer_ref td { border: none !important; margin: 0; padding: 0; background: transparent; }
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

    const isNativeWord = window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();
    const utf8Bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([utf8Bom, wordHTML], { type: 'application/msword;charset=utf-8' });
    const docName = `${filename}.doc`;
    if (isNativeWord) {
        await reportifySaveDownloadInNative(blob, docName, 'Word 文档下载成功!');
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
    showToast("Word 文档下载成功!", "success");
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
            .then((blob) => reportifySaveDownloadInNative(blob, pptName, 'Professional PPT Downloaded!'))
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
    exportToWord(resultBox.innerHTML, filename);

    // 3. 延时打开邮件客户端 (给下载留点时间)
    setTimeout(() => {
        const subject = encodeURIComponent("Sharing an AI-generated report");
        const body = encodeURIComponent("Hello，\n\nThis is a professional report I generated using Reportify AI.\n\n[Attachment Instructions]: The system has automatically downloaded a Word document for you. Please manually drag and drop this file into the attachment.\n\nGenerated by Reportify AI");
        
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        showToast("The email has been opened. Please manually add the attachment you just downloaded.", "success");
    }, 1000);
}

// 🟢 [新增] Markdown 下载功能
function downloadMarkdown() {
    const content = window.currentReportContent; // 获取全局存储的 Markdown 原文
    if (!content) {
        showToast("没有可下载的内容", "warning");
        return;
    }
    
    const filename = `Report_${new Date().toISOString().slice(0,10)}.md`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
        void reportifySaveDownloadInNative(blob, filename, 'Markdown 已下载');
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
                        <button onclick="downloadHistoryItem('${item._id}', 'md', '${item.templateId || 'general'}')" title="Markdown" style="color: #444; background: #f3f4f6; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            <i class="fab fa-markdown"></i>
                        </button>
                        <button onclick="downloadHistoryItem('${item._id}', 'word', '${item.templateId || 'general'}')" title="Word" style="color: #2b579a; background: #e8f0fe; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            <i class="fas fa-file-word"></i>
                        </button>
                        <button onclick="downloadHistoryItem('${item._id}', 'ppt', '${item.templateId || 'general'}')" title="PPT Draft" style="color: #ea4335; background: #fce8e6; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            <i class="fas fa-file-powerpoint"></i>
                        </button>
                        <button onclick="emailHistoryItem('${item._id}')" title="Email Report" style="color: #4b5563; background: #f3f4f6; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
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
    window.downloadHistoryItem = function(id, type, passedTemplate = 'general') {
        // 从缓存中找到这条报告
        const item = window.currentHistoryData.find(r => r._id === id);
        if (!item || !item.content) {
            showToast("Content not found", "error");
            return;
        }

        const filename = (item.title || "Report").replace(/[^a-z0-9]/gi, '_') + `_${new Date().toISOString().slice(0,10)}`;

        if (type === 'md') {
            const blob = new Blob([item.content], { type: 'text/markdown;charset=utf-8' });
            saveAs(blob, `${filename}.md`);
            showToast("Markdown downloaded", "success");
        } 
        // 🟢 核心修复3：废弃简陋的 docx 库，强制调用主页统一的高级 Word 排版引擎
        else if (type === 'word') {
            const htmlContent = (typeof marked !== 'undefined') ? marked.parse(item.content) : item.content.replace(/\n/g, '<br>');
            exportToWord(htmlContent, filename);
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
        const htmlContent = (typeof marked !== 'undefined') ? marked.parse(item.content) : item.content.replace(/\n/g, '<br>');
        
        // 自动下载高颜值 Word 附件
        exportToWord(htmlContent, filename);

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
        bodyEl.innerHTML = marked.parse(item.content);
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

// 点击遮罩层也能关闭
window.onclick = function(event) {
    const modal = document.getElementById('report-view-modal');
    if (event.target == modal) {
        closeViewModal();
    }
    // (保留原本的用户菜单关闭逻辑)
    if(!event.target.closest('#auth-container')) { 
        const m = document.getElementById('user-dropdown'); 
        if(m) m.classList.add('hidden'); 
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
window.onclick = function(e) { 
    if(!e.target.closest('#auth-container')) { 
        const m = document.getElementById('user-dropdown'); 
        if(m) m.classList.add('hidden'); 
    }
};

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
