const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const P = path.join(R, 'data', 'posts.json');
const C = [
  {url:'https://goreportify.com',title:'Homepage',description:'Generate professional AI-powered business reports.'},
  {url:'https://goreportify.com/generate.html',title:'Generate Report',description:'Upload your data and generate comprehensive AI reports.'},
  {url:'https://goreportify.com/blog.html',title:'Deep Insights Blog',description:'Articles on PM, reporting, and AI automation.'},
  {url:'https://goreportify.com/news.html',title:'Global Tech Radar',description:'Daily curated tech news.'},
  {url:'https://goreportify.com/index.html#pricing',title:'Pricing',description:'Reportify AI subscription plans.'},
  {url:'https://goreportify.com/contact.html',title:'Contact Support',description:'Get in touch with Reportify AI.'},
  {url:'https://goreportify.com/privacy.html',title:'Privacy Policy',description:'Data handling and privacy practices.'},
  {url:'https://goreportify.com/terms.html',title:'Terms of Service',description:'Terms for using Reportify AI.'}
];
function L(){try{return JSON.parse(fs.readFileSync(P,'utf8'))}catch(e){return[]}}
function T(s,m){if(m===void 0)m=120;if(!s||s.length<=m)return s||'';return s.slice(0,m).replace(/\s+\S*$/,'')+'\u2026'}
function A(t){return t==='blog'?'Deep Insights':'Tech Radar'}
function G(p){var l=['# Reportify AI','','> Reportify AI generates professional business reports, market analyses, and financial documents using AI.','','## Core Features',''];['AI Report Generator','Market Analysis','Financial Reports','Business Plans','Data Visualization','Daily Blog & News'].forEach(function(f){l.push('- '+f)});l.push('','## Core Pages','');C.forEach(function(x){l.push('- ['+x.title+']('+x.url+') - '+x.description)});l.push('');var r=p.slice(0,30);if(r.length){l.push('## Recent Articles','');r.forEach(function(x){var u='https://goreportify.com/article-pages/'+x.type+'-'+x.id+'.html';l.push('- ['+x.title+']('+u+') - ['+A(x.type)+'] '+T(x.excerpt,100))});l.push('')}return l.join('\n')}
function F(p){var l=['# Reportify AI - Full Site Index','','> Complete index of all pages and articles.','','## All Core Pages',''];C.forEach(function(x){l.push('- ['+x.title+']('+x.url+') - '+x.description)});l.push('');if(p.length){l.push('## All Articles','');p.forEach(function(x){var u='https://goreportify.com/article-pages/'+x.type+'-'+x.id+'.html';l.push('- ['+x.title+']('+u+')','  - Type: '+A(x.type)+' | Date: '+x.date+' | Author: '+x.author,'  - '+T(x.excerpt,250))});l.push('')}var b=p.filter(function(x){return x.type==='blog'}).length;var n=p.filter(function(x){return x.type==='news'}).length;l.push('---','_Total: '+p.length+' articles ('+b+' blog + '+n+' news) + '+C.length+' core pages._');return l.join('\n')}
function M(){var p=L();console.log('[llmstxt] Loaded '+p.length+' posts');fs.writeFileSync(path.join(R,'llms.txt'),G(p),'utf8');console.log('[llmstxt] llms.txt written');fs.writeFileSync(path.join(R,'llms-full.txt'),F(p),'utf8');console.log('[llmstxt] llms-full.txt written')}
if(require.main===module)M();else module.exports={main:M};
