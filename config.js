// config.js - 全局配置中心
// 以后上线只需要改这里的一个变量，不用动其他代码

const CONFIG = {
    // 开发模式开关：
    // true = 本地开发 (连接 localhost:3000)
    // false = 正式上线 (连接 api.goreportify.com)
    IS_DEV: true, 

    // 本地 API 地址
    LOCAL_API: 'http://localhost:3000',

    // 线上 API 地址
    PROD_API: 'https://api.goreportify.com',

    // 自动判断当前使用哪个地址
    get API_BASE_URL() {
        return this.IS_DEV ? this.LOCAL_API : this.PROD_API;
    }
};

// 全局工具：自动补全图片链接
// 放在这里，所有页面都能用，不用重复写
// --- 修复版图片处理函数 (拦截坏地址) ---
function getFullImageUrl(path) {
    // 1. 定义那个永远不会挂的灰色默认图
    const DEFAULT_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2UzZTNlMyI+PHBhdGggZD0iTTAgMGgyNHYyNEgwVjB6IiBmaWxsPSJub25lIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSI4IiByPSI0IiBmaWxsPSIjOWNhM2FmIi8+PHBhdGggZD0iTTEyIDE0Yy02LjEgMC04IDQtOCA0djJoMTZ2LTJzLTEuOS00LTgtNHoiIGZpbGw9IiM5Y2EzYWYiLz48L3N2Zz4=';

    // 2. 如果没有路径，直接返回默认图
    if (!path) return DEFAULT_ICON;

    // 3. 🚨【核心拦截】🚨
    // 如果数据库里存的是那个打不开的国外网站，立刻拦截，强制返回默认图！
    if (path.includes('via.placeholder.com')) {
        return DEFAULT_ICON;
    }

    // 4. 正常逻辑
    if (path.startsWith('http')) return path;
    if (path.startsWith('/uploads')) {
        return `${CONFIG.API_BASE_URL}${path}`;
    }
    
    // 其他情况返回默认图
    return DEFAULT_ICON;
}
