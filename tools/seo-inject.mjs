const REPO_DIR = 'D:\\ai-report-generator';
const BACKUP_DIR = 'D:\\ai-report-generator\\tools\\seo-backups';
const fs = require('fs');
const path = require('path');

const PAGE_CONFIG = {
  'index.html': {
    title: 'Reportify AI - AI Report Generator',
    description: 'Generate professional reports in seconds with Reportify AI. AI-powered daily, weekly, and executive report generator for modern teams.',
    canonical: 'https://www.goreportify.com/',
    type: 'website',
    keywords: 'AI report generator, weekly report tool, automated report writing',
    jsonld: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", "@id": "https://www.goreportify.com/#organization", "name": "Reportify AI", "url": "https://www.goreportify.com", "logo": { "@type": "ImageObject", "url": "https://www.goreportify.com/logo-3d.png.png" }, "description": "AI-powered report generation platform for modern teams." },
        { "@type": "WebSite", "@id": "https://www.goreportify.com/#website", "url": "https://www.goreportify.com", "name": "Reportify AI", "description": "Generate professional reports in seconds with AI", "publisher": { "@id": "https://www.goreportify.com/#organization" } },
        { "@type": "SoftwareApplication", "@id": "https://www.goreportify.com/#software", "name": "Reportify AI", "applicationCategory": "BusinessApplication", "operatingSystem": "Web", "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }, "description": "AI-powered daily, weekly, and executive report generator." }
      ]
    }
  },
  'blog.html': { title: 'Deep Insights - Reportify AI Blog', description: 'Expert insights on AI, productivity, and modern report writing. Learn how AI can transform your workflow.', canonical: 'https://www.goreportify.com/blog.html', type: 'blog', jsonld: { "@context": "https://schema.org", "@type": "Blog", "@id": "https://www.goreportify.com/blog.html#blog", "name": "Deep Insights - Reportify AI Blog", "description": "Expert insights on AI, productivity, and modern report writing.", "publisher": { "@type": "Organization", "name": "Reportify AI", "url": "https://www.goreportify.com" } } },
  'news.html': { title: 'Global Tech Radar - Reportify AI', description: 'Stay updated with the latest tech news and AI industry trends. Curated tech radar by Reportify AI.', canonical: 'https://www.goreportify.com/news.html', type: 'website', jsonld: { "@context": "https://schema.org", "@type": "CollectionPage", "@id": "https://www.goreportify.com/news.html#page", "name": "Global Tech Radar - Reportify AI", "description": "Curated tech news and AI industry trends.", "publisher": { "@type": "Organization", "name": "Reportify AI", "url": "https://www.goreportify.com" } } },
  'generate.html': { title: 'Generate Report - Reportify AI', description: 'Create professional AI-powered reports instantly. Choose from daily, weekly, or executive report templates.', canonical: 'https://www.goreportify.com/generate.html', type: 'website', jsonld: null },
  'usage.html': { title: 'Usage & Limits - Reportify AI', description: 'Track your Reportify AI usage, manage credits, and view report generation history.', canonical: 'https://www.goreportify.com/usage.html', type: 'website', jsonld: null },
  'account.html': { title: 'Account - Reportify AI', description: 'Manage your Reportify AI account settings and preferences.', canonical: 'https://www.goreportify.com/account.html', type: 'website', jsonld: null },
'profile.html': { title: 'Profile - Reportify AI', description: 'Edit your Reportify AI profile and personal information.', canonical: 'https://www.goreportify.com/profile.html', type: 'website', jsonld: null },
  'subscription.html': { title: 'Subscription - Reportify AI', description: 'Manage your Reportify AI subscription plan and billing.', canonical: 'https://www.goreportify.com/subscription.html', type: 'website', jsonld: null },
  'payments.html': { title: 'Payments - Reportify AI', description: 'Payment history and billing management for Reportify AI.', canonical: 'https://www.goreportify.com/payments.html', type: 'website', jsonld: null },
  'security.html': { title: 'Security - Reportify AI', description: 'Security settings and authentication management for your Reportify AI account.', canonical: 'https://www.goreportify.com/security.html', type: 'website', jsonld: null },
  'privacy.html': { title: 'Privacy Policy - Reportify AI', description: 'Read the Reportify AI privacy policy. Learn how we collect, use, and protect your data.', canonical: 'https://www.goreportify.com/privacy.html', type: 'website', jsonld: null },
  'terms.html': { title: 'Terms of Service - Reportify AI', description: 'Read the Reportify AI terms of service and conditions of use.', canonical: 'https://www.goreportify.com/terms.html', type: 'website', jsonld: null },
  'contact.html': { title: 'Contact Us - Reportify AI', description: 'Get in touch with the Reportify AI team. We are here to help with any questions or feedback.', canonical: 'https://www.goreportify.com/contact.html', type: 'website', jsonld: null },
  'history.html': { title: 'Report History - Reportify AI', description: 'View your report generation history and past AI-generated reports.', canonical: 'https://www.goreportify.com/history.html', type: 'website', jsonld: null },
  'admin.html': { title: 'Admin - Reportify AI', description: 'Reportify AI administration panel.', canonical: 'https://www.goreportify.com/admin.html', type: 'website', jsonld: null },
  'templates.html': { title: 'Report Templates - Reportify AI', description: 'Browse report templates for daily, weekly, monthly, and executive reports powered by Reportify AI.', canonical: 'https://www.goreportify.com/templates.html', type: 'website', jsonld: null },
  'oauth-native-bridge.html': { title: 'Sign In - Reportify AI', description: 'Sign in to your Reportify AI account to generate AI-powered reports.', canonical: 'https://www.goreportify.com/oauth-native-bridge.html', type: 'website', jsonld: null }
};

function escapeAttr(s) {
  return String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/&/g,'&amp;');
}

function injectMeta(html, fileName) {
  const cfg = PAGE_CONFIG[fileName];
  if (!cfg) return { html, modified: false, changes: [] };
  let modified = false, changes = [];
  const siteName = 'Reportify AI', imgUrl = 'https://www.goreportify.com/images/og-default.png', pageUrl = cfg.canonical, descAttr = escapeAttr(cfg.description||'');
  const headClose = '</head>';
  const headIdx = html.indexOf(headClose);
  if (headIdx === -1) return { html,modified:false,changes:[] };
  const beforeHead = html.slice(0,headIdx);
  const afterHead = html.slice(headIdx);
  const has = {};
  has.description = /name=["']description["']/.test(beforeHead);
  has.keywords = /name=["']keywords["']/.test(beforeHead);
  has.ogTitle = /property=["']og:title["']/.test(beforeHead);
  has.twitterCard = /name=["']twitter:card["']/.test(beforeHead);
  has.canonical = /rel=["']canonical["']/.test(beforeHead);
  has.jsonld = /application\/ld\+json/.test(beforeHead);
  const blocks = [];
  if (!has.description && cfg.description) { blocks.push('    <meta name="description" content="' + descAttr + '" />'); changes.push('description'); }
  if (!has.keywords && cfg.keywords) { blocks.push('    <meta name="keywords" content="' + escapeAttr(cfg.keywords) + '" />'); changes.push('keywords'); }
  if (!has.ogTitle) {
blocks.push('    <!-- Open Graph / Social -->\n    <meta property="og:type" content="' + cfg.type + '" />\n    <meta property="og:url" content="' + pageUrl + '" />\n    <meta property="og:title" content="' + escapeAttr(cfg.title) + '" />\n    <meta property="og:description" content="' + descAttr + '" />\n    <meta property="og:image" content="' + imgUrl + '" />\n    <meta property="og:site_name" content="' + siteName + '" />\n    <meta property="og:locale" content="en_US" />');
    changes.push('OG tags');
  }
  if (!has.twitterCard) {
    blocks.push('    <!-- Twitter Card -->\n    <meta name="twitter:card" content="summary_large_image" />\n    <meta name="twitter:title" content="' + escapeAttr(cfg.title) + '" />\n    <meta name="twitter:description" content="' + descAttr + '" />\n    <meta name="twitter:image" content="' + imgUrl + '" />');
    changes.push('Twitter Card');
  }
  if (!has.canonical) { blocks.push('    <link rel="canonical" href="' + pageUrl + '" />'); changes.push('canonical'); }
  if (!has.jsonld && cfg.jsonld) { blocks.push('    <script type="application/ld+json">\n' + JSON.stringify(cfg.jsonld,null,2) + '\n    </script>'); changes.push('JSON-LD'); }
  if (blocks.length === 0) return { html,modified:false,changes:[] };
  html = beforeHead + '\n' + blocks.join('\n\n') + '\n' + afterHead;
  return { html,modified:true,changes };
}

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
const files = fs.readdirSync(REPO_DIR).filter(f => f.endsWith('.html') && !f.startsWith('.'));
let mod = 0, skip = 0;
for (const f of Object.keys(PAGE_CONFIG)) {
  if (!files.includes(f)) continue;
  const fp = path.join(REPO_DIR, f);
  const raw = fs.readFileSync(fp, 'utf8');
  const { html, modified, changes } = injectMeta(raw, f);
  if (modified) {
    fs.copyFileSync(fp, path.join(BACKUP_DIR, f + '.bak'));
    fs.writeFileSync(fp, html, 'utf8');
    console.log('✅ ' + f + ' — 注入: ' + changes.join(', '));
    mod++;
  } else {
    console.log('⏭️  ' + f + ' — 已完整，跳过');
    skip++;
  }
}
console.log('\n=== 完成 ===\n修改: ' + mod + ' 个文件\n跳过: ' + skip + ' 个文件\n备份: ' + BACKUP_DIR + '/');
