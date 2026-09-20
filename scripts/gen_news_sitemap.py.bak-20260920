#!/usr/bin/env python3
"""Generate Google News Sitemap from posts.json"""
import json
import os

REPO = os.path.join(os.path.dirname(__file__), '..')
with open(os.path.join(REPO, 'data', 'posts.json')) as f:
    data = json.load(f)

news = [p for p in data if p.get('type') == 'news' and p.get('date')]
# Sort by date descending
news.sort(key=lambda x: x.get('date', ''), reverse=True)

TODAY = __import__('datetime').date.today().isoformat()

xml_parts = []
xml_parts.append('<?xml version="1.0" encoding="UTF-8"?>')
xml_parts.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
xml_parts.append('        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">')

for n in news:
    article_id = f"{n['type']}-{n['id']}"
    url = f"https://www.goreportify.com/article-pages/{article_id}.html"
    pub_date = n['date']
    title = n['title'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&apos;')
    
    xml_parts.append('  <url>')
    xml_parts.append(f'    <loc>{url}</loc>')
    xml_parts.append('    <news:news>')
    xml_parts.append('      <news:publication>')
    xml_parts.append('        <news:name>Reportify AI Tech Radar</news:name>')
    xml_parts.append('        <news:language>en</news:language>')
    xml_parts.append('      </news:publication>')
    xml_parts.append(f'      <news:publication_date>{pub_date}</news:publication_date>')
    xml_parts.append(f'      <news:title>{title}</news:title>')
    xml_parts.append('    </news:news>')
    xml_parts.append('  </url>')

xml_parts.append('</urlset>')

xml_content = '\n'.join(xml_parts)

output_path = os.path.join(REPO, 'news.xml')
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(xml_content)

print(f"✅ Generated news.xml with {len(news)} news articles")
print(f"File size: {len(xml_content)} bytes")
