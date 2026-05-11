/**
 * Set android/app/build.gradle versionCode + versionName from tools/android-version.json.
 * Run after: npx cap sync android (when android/ exists locally).
 * Usage: node tools/apply-android-version.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CFG = path.join(__dirname, 'android-version.json');
const GRADLE = path.join(ROOT, 'android', 'app', 'build.gradle');

if (!fs.existsSync(CFG)) {
  console.error('[apply-android-version] Missing', CFG);
  process.exit(1);
}

if (!fs.existsSync(GRADLE)) {
  console.log('[apply-android-version] No android/app/build.gradle. Run: npm run android:web (or npx cap add android && npx cap sync android)');
  process.exit(0);
}

const { versionCode, versionName } = JSON.parse(fs.readFileSync(CFG, 'utf8'));
if (typeof versionCode !== 'number' || versionCode < 1 || typeof versionName !== 'string' || !versionName.trim()) {
  console.error('[apply-android-version] Invalid tools/android-version.json');
  process.exit(1);
}

let src = fs.readFileSync(GRADLE, 'utf8');
const before = src;

if (!/\bversionCode\b/.test(src) || !/\bversionName\b/.test(src)) {
  console.error('[apply-android-version] build.gradle has no versionCode/versionName — open android/app/build.gradle and add them inside defaultConfig { }');
  process.exit(1);
}

src = src.replace(/\bversionCode\s+\d+/g, `versionCode ${versionCode}`);
src = src.replace(/\bversionName\s+"[^"]*"/g, `versionName "${versionName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);

if (src === before) {
  console.log('[apply-android-version] No changes (already matches?)');
  process.exit(0);
}

fs.writeFileSync(GRADLE, src, 'utf8');
console.log('[apply-android-version] Set versionCode', versionCode, 'versionName', JSON.stringify(versionName), 'in', GRADLE);
