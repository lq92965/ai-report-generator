#!/usr/bin/env node
/**
 * Reportify AI - Daily Health Check & Weekly Report
 * 
 * Runs daily: checks website availability, article freshness
 * Runs weekly (Monday): generates a summary report
 * 
 * Usage:
 *   node tools/daily-health-check.cjs          # daily check
 *   node tools/daily-health-check.cjs --report # weekly report
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const REPO_DIR = path.join(__dirname, '..');
const POSTS_JSON = path.join(REPO_DIR, 'data', 'posts.json');

const SITES = {
  website: { url: 'https://goreportify.com/', expected: 200 },
  api: { url: 'https://api.goreportify.com/', expected: 200 },
  llms: { url: 'https://goreportify.com/llms.txt', expected: 200 },
  sitemap: { url: 'https://goreportify.com/sitemap.xml', expected: 200 },
  robots: { url: 'https://goreportify.com/robots.txt', expected: 200 },
};

function fetchUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
  });
}

async function dailyCheck() {
  const now = new Date().toISOString();
  const results = [];
  
  for (const [name, site] of Object.entries(SITES)) {
    const res = await fetchUrl(site.url);
    const ok = res.status === site.expected;
    results.push({ name, url: site.url, status: res.status, expected: site.expected, ok });
    if (!ok) {
      console.log(`[HEALTH] ❌ ${name}: got ${res.status}, expected ${site.expected}`);
    }
  }

  // Check latest article freshness
  try {
    const posts = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf8'));
    const latestNews = posts.find(p => p.type === 'news');
    const latestBlog = posts.find(p => p.type === 'blog');
    
    const nyOffset = -4 * 60 * 60000;
    const nowNY = new Date(Date.now() + nyOffset);
    const todayStr = nowNY.toISOString().slice(0, 10);
    const dayOfWeek = nowNY.getDay(); // 0=Sun, 6=Sat
    
    const newsDate = latestNews ? String(latestNews.date).replace(/\//g, '-') : 'N/A';
    const blogDate = latestBlog ? String(latestBlog.date).replace(/\//g, '-') : 'N/A';
    
    console.log(`[HEALTH] 📰 Latest news: ${newsDate} | Latest blog: ${blogDate} | Today (NY): ${todayStr} | DOW: ${dayOfWeek}`);
    
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    if (newsDate !== todayStr && !isWeekend) {
      console.log(`[HEALTH] ⚠️ News last updated: ${newsDate} (not today)`);
    }
    if (blogDate !== todayStr && !isWeekend) {
      console.log(`[HEALTH] ⚠️ Blog last updated: ${blogDate} (not today)`);
    }
    
    // On weekends, consider it "ok" if last article is from Friday or later
    const isFresh = isWeekend ? true : (newsDate === todayStr || blogDate === todayStr);
    
    results.push({ name: 'news_freshness', value: newsDate, ok: isWeekend || newsDate === todayStr });
    results.push({ name: 'blog_freshness', value: blogDate, ok: isWeekend || blogDate === todayStr });
  } catch (e) {
    console.log(`[HEALTH] ⚠️ Could not check posts: ${e.message}`);
  }

  // Log to health history
  const historyFile = path.join(REPO_DIR, 'data', 'health_history.jsonl');
  const logEntry = JSON.stringify({ timestamp: now, results }) + '\n';
  fs.appendFileSync(historyFile, logEntry, 'utf8');

  const nameLen = Math.max(...results.map(r => r.name.length), 10);
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Reportify AI Health Check — ${now.slice(0, 19)}`);
  console.log(`${'='.repeat(50)}`);
  for (const r of results) {
    const mark = r.ok ? '✅' : '❌';
    const extra = r.value ? ` (${r.value})` : '';
    console.log(`  ${mark} ${r.name.padEnd(nameLen)} ${r.status || ''}${extra}`);
  }
  
  const allOk = results.every(r => r.ok);
  return { allOk, results, timestamp: now };
}

async function weeklyReport() {
  const historyFile = path.join(REPO_DIR, 'data', 'health_history.jsonl');
  if (!fs.existsSync(historyFile)) {
    console.log('[REPORT] No health history found. Run daily checks first.');
    return;
  }

  const lines = fs.readFileSync(historyFile, 'utf8').trim().split('\n').filter(Boolean);
  const last7 = lines.slice(-7).map(l => JSON.parse(l));
  
  if (last7.length === 0) {
    console.log('[REPORT] No data in last 7 days.');
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Reportify AI — 周报 (${last7.length}天数据)`);
  console.log(`${'='.repeat(60)}`);
  
  // Site uptime stats
  const siteNames = Object.keys(SITES);
  for (const name of siteNames) {
    const checks = last7.flatMap(d => d.results.filter(r => r.name === name));
    const ok = checks.filter(c => c.ok).length;
    const pct = checks.length > 0 ? (ok / checks.length * 100).toFixed(1) : 'N/A';
    console.log(`  ${name}: ${ok}/${checks.length} OK (${pct}%)`);
  }

  // Article freshness
  const newsDates = last7.flatMap(d => d.results.filter(r => r.name === 'news_freshness').map(r => r.value));
  const blogDates = last7.flatMap(d => d.results.filter(r => r.name === 'blog_freshness').map(r => r.value));
  console.log(`  News range: ${newsDates.filter(Boolean).sort()[0] || 'N/A'} → ${newsDates.filter(Boolean).sort().pop() || 'N/A'}`);
  console.log(`  Blog range: ${blogDates.filter(Boolean).sort()[0] || 'N/A'} → ${blogDates.filter(Boolean).sort().pop() || 'N/A'}`);

  // Failures summary
  const failures = last7.flatMap(d => d.results.filter(r => !r.ok));
  if (failures.length > 0) {
    console.log(`\n  ⚠️ ${failures.length} 次异常:`);
    for (const f of failures) {
      console.log(`    ${f.timestamp ? new Date(f.timestamp).toISOString().slice(0, 10) : '?'} — ${f.name} (got ${f.status})`);
    }
  }

  console.log(`\n${'='.repeat(60)}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--report')) {
    await weeklyReport();
  } else {
    await dailyCheck();
  }
}

main().catch(e => console.error('[HEALTH] Fatal:', e.message));
