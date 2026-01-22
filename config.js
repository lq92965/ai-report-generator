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
function getFullImageUrl(path) {
    if (!path) return 'https://via.placeholder.com/150';
    if (path.startsWith('http')) return path;
    // 使用配置好的 API 地址拼接
    if (path.startsWith('/uploads')) {
        return `${CONFIG.API_BASE_URL}${path}`;
    }
    return path;
}
