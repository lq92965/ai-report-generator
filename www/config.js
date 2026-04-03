// config.js - 全局配置中心

const CONFIG = {
    // 开发模式开关：
    IS_DEV: true, 

    // API 地址
    LOCAL_API: 'http://localhost:3000',
    PROD_API: 'https://api.goreportify.com',

    get API_BASE_URL() {
        return this.IS_DEV ? this.LOCAL_API : this.PROD_API;
    }
};

// --- 全局工具：图片链接处理 (拦截坏地址核心修复) ---
function getFullImageUrl(path) {
    // 1. 定义那个永远不会挂的灰色默认图 (Base64)
    const DEFAULT_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2UzZTNlMyI+PHBhdGggZD0iTTAgMGgyNHYyNEgwVjB6IiBmaWxsPSJub25lIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSI4IiByPSI0IiBmaWxsPSIjOWNhM2FmIi8+PHBhdGggZD0iTTEyIDE0Yy02LjEgMC04IDQtOCA0djJoMTZ2LTJzLTEuOS00LTgtNHoiIGZpbGw9IiM5Y2EzYWYiLz48L3N2Zz4=';

    // 2. 如果没有任何路径，直接返回默认图
    if (!path) return DEFAULT_ICON;

    // 3. 🚨 关键拦截：如果数据库里存的是 via.placeholder.com，强制拦截！
    if (path.includes('via.placeholder.com')) {
        return DEFAULT_ICON;
    }

    // 4. 如果是上传的本地图片 (uploads 开头)
    if (path.startsWith('/uploads') || path.startsWith('uploads')) {
        // 确保前面有斜杠
        const cleanPath = path.startsWith('/') ? path : '/' + path;
        return `${CONFIG.API_BASE_URL}${cleanPath}`;
    }
    
    // 5. 如果是完整的 http 链接 (比如 Google 头像)
    if (path.startsWith('http')) {
        return path;
    }

    // 其他情况返回默认图
    return DEFAULT_ICON;
}
