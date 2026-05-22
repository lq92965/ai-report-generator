#!/bin/bash
# Regenerate sitemap.xml with all pages from goreportify.com
cd /root/ai-report-generator

OUTPUT="sitemap.xml.new"

cat > "$OUTPUT" << 'XMLHEAD'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
XMLHEAD

# Static pages
add_url() {
    local url="$1"
    local freq="$2"
    local priority="$3"
    cat >> "$OUTPUT" << URL
  <url>
    <loc>https://www.goreportify.com/${url}</loc>
    <changefreq>${freq}</changefreq>
    <priority>${priority}</priority>
  </url>
URL
}

add_url "" daily 1.0
add_url "generate.html" daily 0.9
add_url "blog.html" daily 0.9
add_url "news.html" daily 0.9
add_url "faq.html" weekly 0.8
add_url "subscription.html" weekly 0.8
add_url "usage.html" weekly 0.7
add_url "contact.html" monthly 0.6
add_url "privacy.html" monthly 0.4
add_url "terms.html" monthly 0.4
add_url "security.html" monthly 0.4
add_url "account.html" monthly 0.3
add_url "history.html" monthly 0.3
add_url "profile.html" monthly 0.3
add_url "templates.html" monthly 0.3
add_url "payments.html" monthly 0.3
add_url "admin.html" monthly 0.3

# Article pages - sort by filename (timestamp order, newest first)
for f in $(ls article-pages/ | sort -rn); do
    cat >> "$OUTPUT" << URL
  <url>
    <loc>https://www.goreportify.com/article-pages/${f}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
URL
done

echo "</urlset>" >> "$OUTPUT"

# Validate basic XML structure
if head -1 "$OUTPUT" | grep -q '<?xml' && tail -1 "$OUTPUT" | grep -q '</urlset>'; then
    echo "✅ Valid XML structure"
    # Count URLs
    grep -c '<loc>' "$OUTPUT"
    echo "URLs generated"
    # Replace old sitemap
    mv "$OUTPUT" sitemap.xml
    echo "✅ sitemap.xml updated"
else
    echo "❌ Invalid XML"
    exit 1
fi
