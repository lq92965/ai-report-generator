/**
 * fix-article-headers.cjs
 *
 * Repairs article-pages/*.html static pages that were generated from a stale
 * template. Three problems, all confirmed by audit on 2026-09-21:
 *
 *   1. 740/755 pages have NO logo and NO canonical Home button in the header.
 *      They rely on a hacked `.article-home-btn` anchor appended AFTER the
 *      `.pwa-header-leading` wrapper, so the logo is missing entirely and the
 *      Home affordance sits in an inconsistent position.
 *   2. 3 pages render literal markdown in headings ("<h2>## Why ...</h2>")
 *      because the generator passed already-heading-ed markdown to a parser
 *      that emitted raw `##`.
 *   3. 526 pages are missing the FAQ footer link present on healthy pages.
 *
 * Strategy: take the HEALTHY page as the source of truth for the header block
 * and the footer nav, then graft those onto every stale page. Content
 * (#article-header / #article-content) is never touched.
 *
 * Idempotent: running twice produces no further changes.
 *
 * Usage:
 *   node tools/fix-article-headers.cjs            # dry run, prints plan
 *   node tools/fix-article-headers.cjs --apply    # write changes
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const REPO = path.resolve(__dirname, '..');
const DIR = path.join(REPO, 'article-pages');
const REFERENCE = process.argv.find((a) => a.endsWith('.html'));
const APPLY = process.argv.includes('--apply');

// A known-good page generated from the current template.
const REF_FILE = path.join(DIR, 'blog-1789909252571.html');

const HOME_BTN_HTML =
    '<a id="article-home-btn" href="index.html" class="home-btn" title="Back to Home" aria-label="Back to Home">' +
    '<i class="fas fa-home"></i><span class="home-btn-text">Home</span></a>';

const LOGO_HTML =
    '<a id="pwa-header-logo" href="index.html" class="logo flex items-center gap-2 no-underline" style="text-decoration: none;">' +
    '<img src="logo-3d.png.png" alt="Reportify AI Logo" style="width: 40px; height: 40px; object-fit: contain;">' +
    '<span style="font-size: 1.25rem; font-weight: 800; color: #1a1a1a; font-family: \'Inter\', sans-serif;">Reportify AI</span>' +
    '</a>';

/** Strip leading markdown heading markers that leaked into rendered headings. */
function fixRawMarkdownHeadings($) {
    let fixed = 0;
    $('#article-content').find('h1,h2,h3,h4,h5,h6').each((_, el) => {
        const $el = $(el);
        const txt = $el.text();
        const cleaned = txt.replace(/^\s*#{1,6}\s*/, '');
        if (cleaned !== txt) {
            $el.text(cleaned);
            fixed += 1;
        }
    });
    return fixed;
}

function main() {
    const refHtml = fs.readFileSync(REF_FILE, 'utf8');
    const $ref = cheerio.load(refHtml, { decodeEntities: false });

    // Reference header pieces.
    const refLeading = $ref('.pwa-header-leading').html();
    if (!refLeading) throw new Error('reference page has no .pwa-header-leading');
    const refFooterNav = $ref('footer nav, footer .footer-nav').first().html() || null;

    const refFooterHtml = $ref('footer').html();

    const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.html')).sort();
    const plan = { missingLogo: [], dupHomeBtn: [], rawMd: [], missingFaq: [] };
    let written = 0;

    for (const f of files) {
        if (path.join(DIR, f) === REF_FILE) continue;
        const full = path.join(DIR, f);
        const html = fs.readFileSync(full, 'utf8');
        const $ = cheerio.load(html, { decodeEntities: false });

        let changed = false;

        // --- 1. Header: ensure logo + home button inside .pwa-header-leading
        const $lead = $('.pwa-header-leading');
        if ($lead.length) {
            if (!$lead.find('#pwa-header-logo, .logo').length) {
                // Remove the stray injected duplicate anchor (sits as a sibling).
                $('.article-home-btn').remove();
                $lead.prepend(LOGO_HTML + '\n' + HOME_BTN_HTML);
                plan.missingLogo.push(f);
                changed = true;
            }
        }

        // Remove any leftover duplicate home anchors so only one remains.
        const homeCount = $('.home-btn').length;
        if (homeCount > 1) {
            $('.home-btn').slice(1).remove();
            changed = true;
        }
        if ($('.article-home-btn').length) {
            $('.article-home-btn').remove();
            plan.dupHomeBtn.push(f);
            changed = true;
        }

        // --- 2. Raw markdown in headings
        const mdFixed = fixRawMarkdownHeadings($);
        if (mdFixed > 0) { plan.rawMd.push(`${f} (${mdFixed})`); changed = true; }

        // --- 3. Footer: restore the full nav (FAQ / Terms / Privacy / App)
        if (!html.includes('faq.html') && refFooterHtml) {
            const $f = $('footer');
            if ($f.length) {
                $f.html(refFooterHtml);
                plan.missingFaq.push(f);
                changed = true;
            }
        }

        if (changed) {
            if (APPLY) fs.writeFileSync(full, $.html(), 'utf8');
            written += 1;
        }
    }

    console.log(`[fix-article-headers] scanned ${files.length} pages`);
    console.log(`  missing logo/home -> repaired: ${plan.missingLogo.length}`);
    console.log(`  stray .article-home-btn removed: ${plan.dupHomeBtn.length}`);
    console.log(`  raw markdown headings fixed: ${plan.rawMd.length}`);
    if (plan.rawMd.length) console.log(`    ${plan.rawMd.join(', ')}`);
    console.log(`  footer nav restored (FAQ etc): ${plan.missingFaq.length}`);
    console.log(`  total pages changed: ${written}`);
    console.log(APPLY ? '  ✅ WRITTEN' : '  (dry run — pass --apply to write)');
}

main();
