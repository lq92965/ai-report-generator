/**
 * Apply Lucide bottom nav HTML + script to every news-*.html and blog-*.html
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const NAV_HTML = `    <nav class="app-bottom-nav" aria-label="Main navigation">
        <a href="index.html" class="app-nav-item" data-nav="home"><span class="app-nav-icon"><i data-lucide="home"></i></span><span class="app-nav-label">Home</span></a>
        <a href="news.html" class="app-nav-item" data-nav="news"><span class="app-nav-icon"><i data-lucide="newspaper"></i></span><span class="app-nav-label">News</span></a>
        <a href="blog.html" class="app-nav-item" data-nav="blog"><span class="app-nav-icon"><i data-lucide="book-open"></i></span><span class="app-nav-label">Blog</span></a>
        <a href="history.html" class="app-nav-item" data-nav="history"><span class="app-nav-icon"><i data-lucide="history"></i></span><span class="app-nav-label">History</span></a>
        <a href="profile.html" class="app-nav-item" data-nav="profile"><span class="app-nav-icon"><i data-lucide="user"></i></span><span class="app-nav-label">Profile</span></a>
    </nav>`;

const navRe = /<nav class="app-bottom-nav"[^>]*>[\s\S]*?<\/nav>/;

const LUCIDE_LINE =
  '    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>\n';

function process(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');
  if (!navRe.test(s)) {
    console.warn('no app-bottom-nav:', filePath);
    return;
  }
  s = s.replace(navRe, NAV_HTML);

  if (!s.includes('lucide.min.js')) {
    s = s.replace(
      /(\s*)<script src="pwa-nav\.js"><\/script>/,
      `$1${LUCIDE_LINE}$1<script src="pwa-nav.js"></script>`
    );
  }

  fs.writeFileSync(filePath, s, 'utf8');
  console.log('ok', path.basename(filePath));
}

const files = fs.readdirSync(root).filter((f) => /^(news|blog)-.+\.html$/.test(f));
for (const f of files) {
  process(path.join(root, f));
}
