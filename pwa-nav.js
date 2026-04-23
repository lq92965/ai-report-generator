/* PWA: Service Worker registration, bottom-nav active state, mobile header menu */
(function () {
  'use strict';

  function isNativeRuntime() {
    try {
      var C = window.Capacitor;
      if (!C) return false;
      if (typeof C.isNativePlatform === 'function') return C.isNativePlatform();
      if (typeof C.getPlatform === 'function') {
        var p = String(C.getPlatform() || '').toLowerCase();
        if (p === 'android' || p === 'ios') return true;
      }
      return C.isNative === true;
    } catch (e) {
      return false;
    }
  }

  if ('serviceWorker' in navigator && !isNativeRuntime()) {
    window.addEventListener('load', function () {
      var swUrl = new URL('sw.js', window.location.href).href;
      navigator.serviceWorker.register(swUrl).catch(function () {
        /* non-fatal on file:// or blocked scope */
      });
    });
  } else if ('serviceWorker' in navigator && isNativeRuntime()) {
    // Native WebView: avoid stale shell/content from SW cache.
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) { r.unregister(); });
    }).catch(function () {});
  }

  function setActiveBottomNav() {
    var path = (window.location.pathname || '').split('/').pop() || 'index.html';
    var lower = path.toLowerCase();
    var root = document.getElementById('app-bottom-nav') || document.querySelector('.app-bottom-nav');
    if (!root) return;
    var items = root.querySelectorAll('.app-nav-item[data-nav]');
    items.forEach(function (el) {
      el.classList.remove('app-nav-item--active');
      var key = el.getAttribute('data-nav');
      var active = false;
      if (key === 'home') {
        active = lower === 'index.html' || lower === '' || path === '/';
      } else if (key === 'generate') {
        active = lower === 'generate.html';
      } else if (key === 'news') {
        active = lower === 'news.html' || lower.indexOf('news-') === 0;
      } else if (key === 'blog') {
        active = lower === 'blog.html' || lower.indexOf('blog-') === 0;
      } else if (key === 'mine') {
        active =
          lower === 'account.html' ||
          lower === 'contact.html' ||
          lower === 'profile.html' ||
          lower === 'history.html' ||
          lower === 'security.html' ||
          lower === 'subscription.html' ||
          lower === 'usage.html' ||
          lower === 'templates.html';
      }
      if (active) el.classList.add('app-nav-item--active');
    });
  }

  function initLucideIcons() {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    setActiveBottomNav();
    initLucideIcons();
    if (typeof window.ensurePwaShell === 'function') {
      window.ensurePwaShell();
    }
  });
})();
