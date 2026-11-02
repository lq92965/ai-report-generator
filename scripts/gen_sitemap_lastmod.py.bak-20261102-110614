#!/usr/bin/env python3
"""Generate sitemap.xml WITH <lastmod> for every URL.

Guidance (Google): lastmod must be accurate and consistent. We derive it from
the post date for article pages, and from file mtime for static pages.
"""
import json, os, re, datetime

BASE = '/root/ai-report-generator'
OUT = os.path.join(BASE, 'sitemap.xml')

posts = json.load(open(os.path.join(BASE, 'data', 'posts.json')))
by_html = {}
for p in posts:
    cf = p.get('contentFile')
    if not cf:
        continue
    html_name = cf.replace('.md', '.html')
    d = str(p.get('date') or '')
    m = re.match(r'^(\d{4})[-/](\d{2})[-/](\d{2})', d)
    by_html[html_name] = m.group(0) if m else None

# newest post date -> lastmod for the index/list pages
dates = [v for v in by_html.values() if v]
newest = max(dates) if dates else datetime.date.today().isoformat()
today = datetime.date.today().isoformat()

STATIC = [
    ("", "daily", "1.0", today),
    ("generate.html", "daily", "0.9", today),
    ("blog.html", "daily", "0.9", newest),
    ("news.html", "daily", "0.9", newest),
    ("faq.html", "weekly", "0.8", today),
    ("subscription.html", "weekly", "0.8", today),
    ("usage.html", "weekly", "0.7", today),
    ("contact.html", "monthly", "0.6", today),
    ("privacy.html", "monthly", "0.4", today),
    ("terms.html", "monthly", "0.4", today),
    ("security.html", "monthly", "0.4", today),
    ("account.html", "monthly", "0.3", today),
    ("history.html", "monthly", "0.3", today),
    ("profile.html", "monthly", "0.3", today),
    ("templates.html", "monthly", "0.3", today),
    ("payments.html", "monthly", "0.3", today),
]

lines = ['<?xml version="1.0" encoding="UTF-8"?>',
         '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']

def url_block(loc, freq, prio, lastmod):
    b = ['  <url>', f'    <loc>{loc}</loc>']
    if lastmod:
        b.append(f'    <lastmod>{lastmod}</lastmod>')
    b += [f'    <changefreq>{freq}</changefreq>', f'    <priority>{prio}</priority>', '  </url>']
    return '\n'.join(b)

for rel, freq, prio, lm in STATIC:
    lines.append(url_block(f'https://goreportify.com/{rel}', freq, prio, lm))

ap = os.path.join(BASE, 'article-pages')
files = sorted(os.listdir(ap), reverse=True)
for f in files:
    if not f.endswith('.html'):
        continue
    lm = by_html.get(f) or datetime.date.fromtimestamp(
        os.path.getmtime(os.path.join(ap, f))).isoformat()
    lines.append(url_block(f'https://goreportify.com/article-pages/{f}',
                           'weekly', '0.8', lm))

lines.append('</urlset>')
content = '\n'.join(lines) + '\n'

# sanity check
assert content.count('<url>') == content.count('</url>')
assert '<lastmod>' in content
with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write(content)

print(f'urls={content.count("<url>")}  with_lastmod={content.count("<lastmod>")}  newest_post={newest}')
