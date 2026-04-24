#!/usr/bin/env node
/**
 * One-click daily pipeline health check (run on server).
 * Usage:
 *   node tools/check-daily-health.cjs
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const REPO_DIR = path.join(__dirname, '..');
const POSTS_JSON_PATH = path.join(REPO_DIR, 'data', 'posts.json');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: REPO_DIR, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

function latestDateByType(arr, type) {
  const dates = (arr || [])
    .filter((p) => p && p.type === type && p.date)
    .map((p) => String(p.date).replace(/\//g, '-'))
    .sort();
  return dates.length ? dates[dates.length - 1] : 'N/A';
}

function countByDate(arr, type, date) {
  return (arr || []).filter((p) => p && p.type === type && String(p.date).replace(/\//g, '-') === date).length;
}

async function fetchArray(url) {
  try {
    const res = await axios.get(url, { timeout: 12000 });
    return Array.isArray(res.data) ? res.data : [];
  } catch (_) {
    return null;
  }
}

async function main() {
  console.log('=== Reportify Daily Health Check ===');
  console.log('Server time:', new Date().toISOString());
  console.log(
    'NY time:',
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date())
  );
  console.log('');

  console.log('[Cron flags]');
  console.log('AMBER_DISABLE_CRON =', process.env.AMBER_DISABLE_CRON || '(unset)');
  console.log('AMBER_NO_GIT_PUSH  =', process.env.AMBER_NO_GIT_PUSH || '(unset)');
  console.log('');

  console.log('[Git state]');
  console.log('branch:', run('git branch --show-current'));
  console.log('status:', run('git status --porcelain'));
  console.log('last commit:', run('git log -1 --oneline'));
  console.log('');

  console.log('[PM2 state]');
  console.log(run('pm2 list'));
  console.log('');

  let localPosts = [];
  try {
    localPosts = JSON.parse(fs.readFileSync(POSTS_JSON_PATH, 'utf8'));
  } catch (_) {
    localPosts = [];
  }

  const localNewsDate = latestDateByType(localPosts, 'news');
  const localBlogDate = latestDateByType(localPosts, 'blog');

  console.log('[Local posts.json]');
  console.log('latest news date:', localNewsDate, `(${countByDate(localPosts, 'news', localNewsDate)} item(s))`);
  console.log('latest blog date:', localBlogDate, `(${countByDate(localPosts, 'blog', localBlogDate)} item(s))`);
  console.log('');

  const apiPosts = await fetchArray('https://api.goreportify.com/api/posts-json');
  const webPosts = await fetchArray('https://www.goreportify.com/data/posts.json');

  console.log('[Remote feeds]');
  if (apiPosts === null) {
    console.log('api.goreportify.com/api/posts-json: ERROR');
  } else {
    const d = latestDateByType(apiPosts, 'news');
    console.log('api latest news date:', d, `(${countByDate(apiPosts, 'news', d)} item(s))`);
  }
  if (webPosts === null) {
    console.log('www.goreportify.com/data/posts.json: ERROR');
  } else {
    const d = latestDateByType(webPosts, 'news');
    console.log('www latest news date:', d, `(${countByDate(webPosts, 'news', d)} item(s))`);
  }
  console.log('');

  console.log('[Recent amber logs]');
  console.log(run('pm2 logs amber --lines 40 --nostream'));
}

main().catch((e) => {
  console.error('Health check failed:', e.message || e);
  process.exit(1);
});

