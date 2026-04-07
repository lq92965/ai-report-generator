/**
 * Copy tools/android-res/file_paths.xml into the Capacitor Android app so FileProvider
 * knows app internal files/ and cache/ (fixes "Failed to find configured root that contains …").
 * Run after: npx cap sync android
 * Usage: node tools/apply-android-fileprovider.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(__dirname, 'android-res', 'file_paths.xml');
const DEST_DIR = path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'xml');
const DEST = path.join(DEST_DIR, 'file_paths.xml');

if (!fs.existsSync(path.join(ROOT, 'android'))) {
  console.log('[apply-android-fileprovider] No android/ folder (often gitignored). Run: npx cap add android');
  process.exit(0);
}

if (!fs.existsSync(SRC)) {
  console.error('[apply-android-fileprovider] Missing', SRC);
  process.exit(1);
}

if (fs.existsSync(DEST)) {
  console.log('[apply-android-fileprovider] Skip overwrite:', DEST);
  console.log('[apply-android-fileprovider] If Share still fails, merge <files-path> and <cache-path> from', SRC);
  process.exit(0);
}

fs.mkdirSync(DEST_DIR, { recursive: true });
fs.copyFileSync(SRC, DEST);
console.log('[apply-android-fileprovider] Wrote', DEST);
console.log('[apply-android-fileprovider] Rebuild the APK in Android Studio.');
