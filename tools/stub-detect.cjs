/**
 * Detect stub article pages by analyzing the RENDERED body inside
 * #article-content, not by file size (inline template boilerplate inflates
 * stub pages well past any byte threshold).
 *
 * Key distinction: a SHORT article whose body matches its markdown is fine;
 * a STUB is a page whose body is nearly empty regardless of how long the
 * source markdown is.
 */
function articleBodyStats(html) {
    const start = html.indexOf('id="article-content"');
    if (start === -1) return { found: false };
    const open = html.indexOf('>', start) + 1;
    let depth = 1, end = html.length;
    const re = /<\/?div\b[^>]*>/g;
    re.lastIndex = open;
    let m;
    while ((m = re.exec(html))) {
        if (m[0].startsWith('</')) { depth--; if (depth === 0) { end = m.index; break; } }
        else depth++;
    }
    const body = html.slice(open, end);
    const text = body
        .replace(/<figure[\s\S]*?<\/figure>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return {
        found: true,
        p: (body.match(/<p\b/gi) || []).length,
        h2: (body.match(/<h2\b/gi) || []).length,
        textLen: text.length,
    };
}

/**
 * True when the page's rendered body is a stub.
 *
 * A page is a stub if the body is essentially empty. The earlier byte-size
 * check (<12000) missed stubs because boilerplate inflates them; the earlier
 * `<5 <p>` check produced false positives on legitimately short articles.
 * Instead, compare rendered body length against the source markdown: a stub
 * renders far less than its source.
 */
function isStubBody(html, mdText) {
    const st = articleBodyStats(html);
    if (!st.found) return true;

    const rendered = st.textLen;
    const md = String(mdText || '');

    if (!md) {
        // No markdown to compare against: fall back to an absolute floor.
        return rendered < 400;
    }

    // Text that survives markdown stripping: tags, figures, images, markdown
    // punctuation are not body prose.
    const mdProse = md
        .replace(/<figure[\s\S]*?<\/figure>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/[#*`>_|\[\]()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // A healthy page renders roughly the same amount of prose as the source.
    // A stub renders a small fraction of it (usually just the banner text).
    // 45% is a safe floor: allow for excerpt/heading normalization differences
    // while still catching pages that dropped the entire body.
    return rendered < mdProse.length * 0.45;
}

module.exports = { articleBodyStats, isStubBody };
