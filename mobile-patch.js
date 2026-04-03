/* 文件名：mobile-patch.js */
/* 作用：原生 App 文件下载拦截与分享、强刷头像缓存 */

document.addEventListener('DOMContentLoaded', function() {
    
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
                    const { Filesystem, Directory } = window.Capacitor.Plugins.Filesystem;
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

                    // 写入手机系统文件
                    const savedFile = await Filesystem.writeFile({
                        path: filename,
                        data: base64Data,
                        directory: Directory.Documents
                    });

                    // 唤起手机底层的保存/分享弹窗
                    await Share.share({
                        title: filename,
                        text: 'Here is your Reportify document',
                        url: savedFile.uri,
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
    // 强刷头像缓存
    // -----------------------------------------
    window.addEventListener('pageshow', function() {
        const avatarImages = document.querySelectorAll('img.rounded-full, img[src*="avatar"]');
        avatarImages.forEach(img => {
            if (!img.src.includes('logo') && !img.src.includes('icon')) {
                let originalSrc = img.src.split('?')[0]; 
                img.src = originalSrc + '?v=' + new Date().getTime();
            }
        });
    });
});