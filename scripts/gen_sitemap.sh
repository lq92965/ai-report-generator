#!/bin/bash
# Regenerate sitemap.xml WITH accurate <lastmod> (drives re-crawl + indexing)
cd /root/ai-report-generator
python3 /root/ai-report-generator/scripts/gen_sitemap_lastmod.py
