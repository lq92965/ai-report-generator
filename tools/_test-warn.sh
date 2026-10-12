#!/bin/bash
cd /root/ai-report-generator || exit 1
TMPL=/tmp/warn-test
mkdir -p $TMPL

# TEST 1: internal_links 含不存在的目标 -> WARN + 照常发布
cat > $TMPL/1.md <<'EOF'
---
title: "Warn Test"
slug: "warn-test-tmp-1"
type: "blog"
status: "pending"
platform: "website"
lang: "en"
date: "2026-10-13"
target_keyword: "warn test keyword"
secondary_keywords: "kw a, kw b"
internal_links: "monthly-report-template, definitely-nonexistent-slug-xyz"
author: "Reportify AI Editorial"
---
# Warn Test

Body paragraph one for excerpt purposes.
EOF

echo "=== TEST 1: 内链目标不存在 -> 应 WARN 但 exit 0 ==="
node tools/publish-queue-item.cjs $TMPL/1.md warn-test-tmp-1 2>&1
echo "exit=$?"

# TEST 2: internal_links 全部存在 -> 应通过校验
exist=$(ls article-pages/*.html | head -2 | xargs -n1 basename | sed 's/.html//' | paste -sd, -)
cat > $TMPL/2.md <<EOF
---
title: "Pass Test"
slug: "warn-test-tmp-2"
type: "blog"
status: "pending"
platform: "website"
lang: "en"
date: "2026-10-13"
target_keyword: "pass test keyword"
internal_links: "$exist"
author: "Reportify AI Editorial"
---
# Pass Test

Body paragraph one.
EOF
echo
echo "=== TEST 2: 内链目标都存在 ($exist) -> 应通过 ==="
node tools/publish-queue-item.cjs $TMPL/2.md warn-test-tmp-2 2>&1
echo "exit=$?"

echo
echo "=== TEST 3: platform 缺失 -> 仍应硬失败 exit 3 ==="
printf -- '---\ntitle: "P"\nslug: "p-tmp"\nstatus: "pending"\n---\nbody\n' > $TMPL/3.md
node tools/publish-queue-item.cjs $TMPL/3.md p-tmp 2>&1
echo "exit=$?"

echo
echo "=== 清理 ==="
rm -f article-pages/warn-test-tmp-1.html article-pages/warn-test-tmp-2.html
rm -rf $TMPL
node -e 'const fs=require("fs");let p=JSON.parse(fs.readFileSync("data/posts.json","utf8"));const n=p.length;p=p.filter(x=>!x.id.startsWith("warn-test-tmp"));fs.writeFileSync("data/posts.json",JSON.stringify(p,null,4));console.log("posts:",n,"->",p.length)'
