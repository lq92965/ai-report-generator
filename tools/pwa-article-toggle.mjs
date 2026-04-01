import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const re =
  /<div id="auth-container" class="flex items-center gap-4"><\/div>\s*<\/div>\s*<\/div>\s*<\/header>/;

const rep = `<div id="auth-container" class="flex items-center gap-4 header-actions"></div>
                </div>
            <button type="button" class="pwa-menu-toggle" id="pwa-menu-toggle" aria-label="Open menu" aria-expanded="false"><i class="fas fa-bars"></i></button>
            </div>
        
    </header>`;

function patch(content) {
  if (content.includes('pwa-menu-toggle')) return content;
  return content.replace(re, rep);
}

const files = fs.readdirSync(root).filter((f) => /^(news|blog)-.+\.html$/.test(f));
for (const f of files) {
  const p = path.join(root, f);
  const before = fs.readFileSync(p, 'utf8');
  const after = patch(before);
  if (after !== before) {
    fs.writeFileSync(p, after, 'utf8');
    console.log('patched', f);
  } else {
    console.log('skip', f);
  }
}
