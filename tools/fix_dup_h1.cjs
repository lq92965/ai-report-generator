/**
 * Remove the duplicate leading <h1> from statically generated article pages.
 *
 * The page template already renders the title in #article-header. Markdown
 * bodies often open with "# Same Title", which marked() turns into a second
 * <h1>. article.html strips it at runtime; static pages must do the same.
 *
 * Only removes a LEADING <h1> inside #article-content, and only when it
 * matches the page's own header title. Any other <h1> is left untouched.
 */
const fs = require('fs');
const path = require('path');

const REPO = '/root/ai-report-generator';
const OUT_DIR = path.join(REPO, 'article-pages');
const DRY = process.argv.includes('--dry-run');

function norm(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function stripLeadingH1(html, title) {
  const start = html.indexOf('id="article-content"');
  if (start === -1) return { html, removed: false };
  const open = html.indexOf('>', start) + 1;

  // Locate the end of the #article-content div by balancing <div> tags.
  let depth = 1, end = html.length;
  const re = /<\/?div\b[^>]*>/g;
  re.lastIndex = open;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('</')) { depth--; if (depth === 0) { end = m.index; break; } }
    else depth++;
  }

  const body = html.slice(open, end);
  // Match the first heading-ish element; allow the cover <figure> (and any
  // other block markup) to precede it.
  const h1re = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i;
  const hm = h1re.exec(body);
  if (!hm) return { html, removed: false };

  // Only touch it if nothing but figures/whitespace precedes it.
  const before = body.slice(0, hm.index);
  const beforeText = before
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (beforeText.length > 0) return { html, removed: false };

  const got = norm(hm[1].replace(/<[^>]+>/g, ' ').replace(/[*_`]/g, ''));
  const want = norm(title);
  const matches = got && want && (got === want || want.indexOf(got) === 0 || got.indexOf(want) === 0);
  if (!matches) return { html, removed: false };

  const newBody = body.slice(0, hm.index) + body.slice(hm.index + hm[0].length);
  return { html: html.slice(0, open) + newBody + html.slice(end), removed: true };
}

// Derive the header title from the template's own header block.
function headerTitle(html) {
  const hi = html.indexOf('id="article-header"');
  if (hi === -1) return '';
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html.slice(hi));
  return h1 ? h1[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').trim() : '';
}

let scanned = 0, fixed = 0, skipped = 0;
for (const f of fs.readdirSync(OUT_DIR).filter((x) => x.endsWith('.html'))) {
  const p = path.join(OUT_DIR, f);
  const html = fs.readFileSync(p, 'utf8');
  const nH1 = (html.match(/<h1\b/gi) || []).length;
  if (nH1 < 2) continue;
  scanned++;

  const title = headerTitle(html);
  if (!title) { console.log('SKIP (no header title) ' + f); skipped++; continue; }

  const { html: out, removed } = stripLeadingH1(html, title);
  if (!removed) { console.log('SKIP (leading h1 not a duplicate) ' + f); skipped++; continue; }

  if (!DRY) fs.writeFileSync(p, out, 'utf8');
  console.log((DRY ? 'WOULD FIX ' : 'FIXED     ') + f);
  fixed++;
}

console.log('---');
console.log('pages with >1 h1 :', scanned);
console.log('duplicate h1 fixed:', fixed);
console.log('skipped           :', skipped);
if (DRY) console.log('(dry run - nothing written)');
