# Android：Google 登录后从浏览器回到 App（深链接）

若浏览器里「Open Reportify AI」或「Alternate」点击后**完全没反应**，通常是 **APK 里没有声明**能打开 `com.crickettechnology.reportifyai://oauth` 的 **intent-filter**，系统不知道把链接交给谁。

应用 ID 必须与仓库 `capacitor.config.json` 里一致：**`com.crickettechnology.reportifyai`**。

---

## 一、在 Android 工程里加 intent-filter（必做）

1. 在本机打开项目里的 **`android/`** 目录（执行过 `npx cap sync android` 后会有）。
2. 用 **Android Studio** 打开 **`android`** 文件夹。
3. 打开 **`app/src/main/AndroidManifest.xml`**。
4. 找到带 **`android.intent.action.MAIN`** 和 **`LAUNCHER`** 的那个 **`<activity>`**（一般是 `MainActivity`）。
5. **在同一个 `<activity>` 标签内**，在已有的 `</intent-filter>` 后面，**再增加**下面一整段（不要删原来的 MAIN/LAUNCHER）：

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
        android:scheme="com.crickettechnology.reportifyai"
        android:host="oauth" />
</intent-filter>
```

6. **保存** → **Build → Clean Project** → 再 **Rebuild**。
7. 卸载手机上的旧版 App，**重新安装**新 APK（避免旧签名/旧 manifest 缓存）。

---

## 二、用手机系统设置检查「打开链接」

路径因品牌略有不同，大致为：

**设置 → 应用 → Reportify AI → 默认打开 / 打开支持的链接 / 通过链接打开应用**

- 打开 **“打开支持的链接”** 或 **“在此应用中打开链接”**。
- 若有 **“添加链接”**，可勾选与你的域名相关的项（若使用 https App Links 才会有；自定义 scheme 主要靠上面 manifest）。

---

## 三、用 adb 自测（可选，需 USB 调试）

电脑安装好 adb 后：

```text
adb shell am start -a android.intent.action.VIEW -d "com.crickettechnology.reportifyai://oauth?error=test"
```

若 App 能弹出或收到错误参数，说明 **manifest 生效**。若提示找不到 Activity，说明 **intent-filter 未打进当前安装的 APK**。

---

## 四、部署与代码的关系

| 位置 | 作用 |
|------|------|
| **Netlify 上的 `oauth-native-bridge.html`** | 浏览器里打开桥页、点按钮尝试唤起 App |
| **API 上的 `server.js`** | OAuth 回调、`/api/oauth/bridge-token` |
| **APK 里的 intent-filter** | 系统是否允许 **从浏览器** 把 `com.crickettechnology.reportifyai://oauth?...` 交给 App |

三者缺一不可；**仅改网页/服务器而不重装带 manifest 的 APK，按钮会一直“没反应”。**
