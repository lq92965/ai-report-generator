/**
 * Android 原生：Google Play 订阅购买 + 服务端验单（网页不加载此逻辑）。
 */
(function (global) {
    function apiBase() {
        return (global.REPORTIFY_API_BASE || 'https://api.goreportify.com').replace(/\/$/, '');
    }

    function nativePurchases() {
        try {
            var c = global.Capacitor;
            if (!c || !c.Plugins) return null;
            return c.Plugins.NativePurchases || null;
        } catch (e) {
            return null;
        }
    }

    global.reportifyIsAndroidNative = function () {
        try {
            return (
                global.Capacitor &&
                typeof global.Capacitor.isNativePlatform === 'function' &&
                global.Capacitor.isNativePlatform() &&
                global.Capacitor.getPlatform() === 'android'
            );
        } catch (e) {
            return false;
        }
    };

    /**
     * @param {string} planType 'basic' | 'pro'
     * @param {boolean} yearly
     * @returns {{ productId: string, basePlanId: string } | null}
     */
    global.reportifyGooglePlanToProduct = function (planType, yearly) {
        var y = !!yearly;
        if (planType === 'basic') {
            return y
                ? { productId: 'reportify_basic_annual', basePlanId: 'annual' }
                : { productId: 'reportify_basic_monthly', basePlanId: 'monthly' };
        }
        if (planType === 'pro') {
            return y
                ? { productId: 'reportify_pro_annual', basePlanId: 'annual' }
                : { productId: 'reportify_pro_monthly', basePlanId: 'monthly' };
        }
        return null;
    };

    global.reportifyGooglePlayPurchase = async function (productId, basePlanId) {
        var P = nativePurchases();
        if (!P) throw new Error('Google Play Billing not available');
        return P.purchaseProduct({
            productIdentifier: productId,
            planIdentifier: basePlanId,
            productType: 'subs',
            autoAcknowledgePurchases: false
        });
    };

    global.reportifyGooglePlayVerify = async function (purchaseToken, productId) {
        var token = global.localStorage.getItem('token');
        if (!token) throw new Error('Not logged in');
        var res = await fetch(apiBase() + '/api/billing/google-play/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ purchaseToken: purchaseToken, productId: productId })
        });
        var data = {};
        try {
            data = await res.json();
        } catch (e) {}
        if (!res.ok) throw new Error(data.message || 'Verification failed');
        return data;
    };
})(typeof window !== 'undefined' ? window : globalThis);
