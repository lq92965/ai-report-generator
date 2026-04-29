import fs from 'fs';
import path from 'path';

const REPO_DIR = 'D:\\ai-report-generator';
const BACKUP_DIR = 'D:\\ai-report-generator\\tools\\seo-backups';

const cfg = {
  'index.html': {
    t: 'Reportify AI - AI Report Generator',
    d: 'Generate professional reports in seconds with Reportify AI. AI-powered daily, weekly, and executive report generator for modern teams.',
    c: 'https://www.goreportify.com/',
    tp: 'website',
    kw: 'AI report generator, weekly report tool, automated report writing',
    j: {"@context":"https://schema.org","@graph":[
      {"@type":"Organization","@id":"https://www.goreportify.com/#organization","name":"Reportify AI","url":"https://www.goreportify.com","logo":{"@type":"ImageObject","url":"https://www.goreportify.com/logo-3d.png.png"},"description":"AI-powered report generation platform for modern teams."},
      {"@type":"WebSite","@id":"https://www.goreportify.com/#website","url":"https://www.goreportify.com","name":"Reportify AI","description":"Generate professional reports in seconds with AI","publisher":{"@id":"https://www.goreportify.com/#organization"}},
      {"@type":"SoftwareApplication","@id":"https://www.goreportify.com/#software","name":"Reportify AI","applicationCategory":"BusinessApplication","operatingSystem":"Web","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":"AI-powered daily, weekly, and executive report generator."}
    ]}
  },
  'blog.html': {t:'Deep Insights - Reportify AI Blog',d:'Expert insights on AI, productivity, and modern report writing. Learn how AI can transform your workflow.',c:'https://www.goreportify.com/blog.html',tp:'blog',j:{"@context":"https://schema.org","@type":"Blog","@id":"https://www.goreportify.com/blog.html#blog","name":"Deep Insights - Reportify AI Blog","description":"Expert insights on AI, productivity, and modern report writing.","publisher":{"@type":"Organization","name":"Reportify AI","url":"https://www.goreportify.com"}}},
  'news.html': {t:'Global Tech Radar - Reportify AI',d:'Stay updated with the latest tech news and AI industry trends. Curated tech radar by Reportify AI.',c:'https://www.goreportify.com/news.html',tp:'website',j:{"@context":"https://schema.org","@type":"CollectionPage","@id":"https://www.goreportify.com/news.html#page","name":"Global Tech Radar - Reportify AI","description":"Curated tech news and AI industry trends.","publisher":{"@type":"Organization","name":"Reportify AI","url":"https://www.goreportify.com"}}},
  'generate.html': {t:'Generate Report - Reportify AI',d:'Create professional AI-powered reports instantly. Choose from daily, weekly, or executive report templates.',c:'https://www.goreportify.com/generate.html',tp:'website',j:null},
  'usage.html': {t:'Usage & Limits - Reportify AI',d:'Track your Reportify AI usage, manage credits, and view report generation history.',c:'https://www.goreportify.com/usage.html',tp:'website',j:null},
  'account.html': {t:'Account - Reportify AI',d:'Manage your Reportify AI account settings and preferences.',c:'https://www.goreportify.com/account.html',tp:'website',j:null},
  'profile.html': {t:'Profile - Reportify AI',d:'Edit your Reportify AI profile and personal information.',c:'https://www.goreportify.com/profile.html',tp:'website',j:null},
  'subscription.html': {t:'Subscription - Reportify AI',d:'Manage your Reportify AI subscription plan and billing.',c:'https://www.goreportify.com/subscription.html',tp:'website',j:null},
  'payments.html': {t:'Payments - Reportify AI',d:'Payment history and billing management for Reportify AI.',c:'https://www.goreportify.com/payments.html',tp:'website',j:null},
  'security.html': {t:'Security - Reportify AI',d:'Security settings and authentication management for your Reportify AI account.',c:'https://www.goreportify.com/security.html',tp:'website',j:null},
'privacy.html': {t:'Privacy Policy - Reportify AI',d:'Read the Reportify AI privacy policy. Learn how we collect, use, and protect your data.',c:'https://www.goreportify.com/privacy.html',tp:'website',j:null},
  'terms.html': {t:'Terms of Service - Reportify AI',d:'Read the Reportify AI terms of service and conditions of use.',c:'https://www.goreportify.com/terms.html',tp:'website',j:null},
  'contact.html': {t:'Contact Us - Reportify AI',d:'Get in touch with the Reportify AI team. We are here to help with any questions or feedback.',c:'https://www.goreportify.com/contact.html',tp:'website',j:null},
  'history.html': {t:'Report History - Reportify AI',d:'View your report generation history and past AI-generated reports.',c:'https://www.goreportify.com/history.html',tp:'website',j:null},
  'admin.html': {t:'Admin - Reportify AI',d:'Reportify AI administration panel.',c:'https://www.goreportify.com/admin.html',tp:'website',j:null},
  'templates.html': {t:'Report Templates - Reportify AI',d:'Browse report templates for daily, weekly, monthly, and executive reports powered by Reportify AI.',c:'https://www.goreportify.com/templates.html',tp:'website',j:null},
  'oauth-native-bridge.html': {t:'Sign In - Reportify AI',d:'Sign in to your Reportify AI account to generate AI-powered reports.',c:'https://www.goreportify.com/oauth-native-bridge.html',tp:'website',j:null}
};

function esc(s){return String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/&/g,'&amp;')}
function inj(html,f){
  const p=cfg[f];if(!p)return{html,mod:false,ch:[]};
  let mod=false,ch=[];const sn='Reportify AI',iu='https://www.goreportify.com/images/og-default.png',pu=p.c,da=esc(p.d||'');
  const hi=html.indexOf('</head>');if(hi===-1)return{html,mod:false,ch:[]};
  const bh=html.slice(0,hi),ah=html.slice(hi);
  const h={};h.ds=/name=["']description["']/.test(bh);h.kw=/name=["']keywords["']/.test(bh);h.og=/property=["']og:title["']/.test(bh);
  h.tw=/name=["']twitter:card["']/.test(bh);h.ca=/rel=["']canonical["']/.test(bh);h.jd=/application\/ld\+json/.test(bh);
  const bl=[];
  if(!h.ds&&p.d){bl.push('    <meta name="description" content="'+da+'" />');ch.push('description')}
  if(!h.kw&&p.kw){bl.push('    <meta name="keywords" content="'+esc(p.kw)+'" />');ch.push('keywords')}
  if(!h.og){bl.push('    <!-- Open Graph / Social -->\n    <meta property="og:type" content="'+p.tp+'" />\n    <meta property="og:url" content="'+pu+'" />\n    <meta property="og:title" content="'+esc(p.t)+'" />\n    <meta property="og:description" content="'+da+'" />\n    <meta property="og:image" content="'+iu+'" />\n    <meta property="og:site_name" content="'+sn+'" />\n    <meta property="og:locale" content="en_US" />');ch.push('OG tags')}
  if(!h.tw){bl.push('    <!-- Twitter Card -->\n    <meta name="twitter:card" content="summary_large_image" />\n    <meta name="twitter:title" content="'+esc(p.t)+'" />\n    <meta name="twitter:description" content="'+da+'" />\n    <meta name="twitter:image" content="'+iu+'" />');ch.push('Twitter Card')}
  if(!h.ca){bl.push('    <link rel="canonical" href="'+pu+'" />');ch.push('canonical')}
  if(!h.jd&&p.j){bl.push('    <script type="application/ld+json">\n'+JSON.stringify(p.j,null,2)+'\n    </script>');ch.push('JSON-LD')}
  if(bl.length===0)return{html,mod:false,ch:[]};
  return{html:bh+'\n'+bl.join('\n\n')+'\n'+ah,mod:true,ch};
}
if(!fs.existsSync(BACKUP_DIR))fs.mkdirSync(BACKUP_DIR,{recursive:true});
const files=fs.readdirSync(REPO_DIR).filter(f=>f.endsWith('.html')&&!f.startsWith('.'));
let mod=0,skip=0;
for(const f of Object.keys(cfg)){
  if(!files.includes(f))continue;
  const fp=path.join(REPO_DIR,f),raw=fs.readFileSync(fp,'utf8'),r=inj(raw,f);
  if(r.mod){
    fs.copyFileSync(fp,path.join(BACKUP_DIR,f+'.bak'));
    fs.writeFileSync(fp,r.html,'utf8');
    console.log('✅ '+f+' — 注入: '+r.ch.join(', '));mod++;
  }else{console.log('⏭️  '+f+' — 已完整，跳过');skip++}
}
console.log('\n=== 完成 ===\n修改: '+mod+' 个文件\n跳过: '+skip+' 个文件\n备份: '+BACKUP_DIR+'/');
