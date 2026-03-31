/**
 * Normalize article page headers for PWA grid + hamburger (news-*.html, blog-*.html)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const BLOCK_OLD = `                <div id="auth-container" class="flex items-center gap-4"></div>
                </div>
            </div>
        
    </header>`;

const BLOCK_NEW = `                <div id="auth-container" class="flex items-center gap-4 header-actions"></div>
                </div>
            <button type="button" class="pwa-menu-toggle" id="pwa-menu-toggle" aria-label="Open menu" aria-expanded="false"><i class="fas fa-bars"></i></button>
            </div>
        
    </header>`;

function fix(content) {
  let s = content;
  s = s.replace(
    /<div class="container mx-auto px-6 flex justify-between items-center">/g,
    '<div class="container mx-auto px-6 pwa-header-inner">'
  );
  s = s.replace(
    /<nav class="main-nav hidden md:block">/g,
    '<nav class="main-nav hidden md:block" id="pwa-collapse-nav">'
  );
  s = s.replace(
    /<div style="display: flex; align-items: center; gap: 15px;">/,
    '<div class="pwa-header-actions" style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">'
  );
  s = s.replace(
    /<a href="usage\.html#share-area" style="/g,
    '<a href="usage.html#share-area" class="pwa-invite-btn" style="'
  );
  if (s.includes('id="pwa-menu-toggle"')) return s;
  if (s.includes(BLOCK_OLD)) {
    s = s.replace(BLOCK_OLD, BLOCK_NEW);
  }
  return s;
}

const files = fs.readdirSync(root).filter((f) => /^(news|blog)-.+\.html$/.test(f));
for (const f of files) {
  const p = path.join(root, f);
  const before = fs.readFileSync(p, 'utf8');
  const after = fix(before);
  if (after !== before) {
    fs.writeFileSync(p, after, 'utf8');
    console.log('fixed', f);
  } else {
    console.log('skip or no match', f);
  }
}
