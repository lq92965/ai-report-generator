#!/usr/bin/env node
/**
 * 修复 article.html 模板 — 删除重复的 OG/Twitter/Canonical 标签（第58-75行）
 * 使用：node tools/fix-article-template.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '..', 'article.html');

let html = fs.readFileSync(filePath, 'utf8');

// 找到第一组 OG 标签的结尾（第一个 </head> 之前的那一组 canonical）
// 结构：第一组 canonical 结尾在 line 55，空一行 line 57，然后第二组开始
// 我们删掉从 "    <!-- Open Graph / Social -->\n\n" (第二个) 到 "    <!-- Canonical -->\n    <link rel=\"canonical\" href=\"https://www.goreportify.com/article.html\" />\n\n</head>"

// 更精准：找到第一个 "    <!-- Canonical -->\n    <link rel=\"canonical\" href=\"https://www.goreportify.com/article.html\" />\n\n    <!-- Open Graph / Social -->"
// 然后删到 "</head>" 之前

const dupStart = '    <!-- Canonical -->\n    <link rel="canonical" href="https://www.goreportify.com/article.html" />\n\n    <!-- Open Graph / Social -->';
const dupEnd = '    <!-- Canonical -->\n    <link rel="canonical" href="https://www.goreportify.com/article.html" />\n\n</head>';

if (html.includes(dupStart)) {
    // 从第二个 OG 开始到 </head> 之前  
    const idx = html.indexOf(dupStart);
    const endIdx = html.indexOf(dupEnd, idx);
    
    if (endIdx > idx) {
        const before = html.substring(0, idx);
        const after = html.substring(endIdx + dupEnd.length);
        html = before + after;
        fs.writeFileSync(filePath, html, 'utf8');
        console.log('✅  Deleted duplicate OG/Twitter/Canonical meta tags from article.html');
    }
} else {
    console.log('⚠️  No duplicates found — likely already clean');
}

// 确认 html 中只有一个 og:type
const ogCount = (html.match(/og:type/g) || []).length;
const canonicalCount = (html.match(/rel="canonical"/g) || []).length;
console.log(`📊  og:type occurrences: ${ogCount}, canonical occurrences: ${canonicalCount}`);
