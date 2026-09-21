
const fs=require("fs");
const path=require("path");
const ROOT="/root/ai-report-generator";
const p=JSON.parse(fs.readFileSync(path.join(ROOT,"data/posts.json"),"utf8"));
const bad=[];
for(const x of p){
  const pg=path.join(ROOT,"article-pages",`${x.type}-${x.id}.html`);
  if(!fs.existsSync(pg)){bad.push({t:x.type,id:x.id,why:"MISSING"});continue;}
  const html=fs.readFileSync(pg,"utf8");
  const m=html.match(/id="article-content"[^>]*>([\s\S]*?)<\/section>/);
  const body=m?m[1]:html;
  const text=body.replace(/<[^>]*>/g," ").replace(/&[a-z]+;/g," ").replace(/\s+/g," ").trim();
  const words=text.split(" ").filter(w=>w.length>2).length;
  const imgs=(body.match(/<img/g)||[]).length;
  if(words<120) bad.push({t:x.type,id:x.id,w:words,imgs:imgs,sz:html.length,date:x.date,h:x.title.slice(0,50)});
}
console.log("STUB_PAGES",bad.length,"OF",p.length);
bad.sort((a,b)=>String(b.id).localeCompare(String(a.id)));
console.log(JSON.stringify(bad.slice(0,60),null,1));
