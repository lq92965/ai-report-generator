
const fs=require("fs");
const path=require("path");
const ROOT="/root/ai-report-generator";
const p=JSON.parse(fs.readFileSync(path.join(ROOT,"data/posts.json"),"utf8"));
const bad=[];
for(const x of p){
  const f=path.join(ROOT,"content",x.contentFile||"");
  if(!x.contentFile||!fs.existsSync(f)) continue;
  const md=fs.readFileSync(f,"utf8");
  const stripped=md.replace(/<figure[\s\S]*?<\/figure>/gi,"").replace(/!\[[^\]]*\]\([^)]*\)/g,"").replace(/<[^>]*>/g,"").replace(/[#*`>_|\[\]()\-]/g," ").replace(/\s+/g," ").trim();
  const words=stripped.split(" ").filter(w=>w.length>2).length;
  if(words<120){
    const pg=path.join(ROOT,"article-pages",`${x.type}-${x.id}.html`);
    const pgsz=fs.existsSync(pg)?fs.statSync(pg).size:0;
    bad.push({t:x.type,id:x.id,w:words,pg:pgsz,date:x.date,h:x.title.slice(0,55)});
  }
}
console.log("TOTAL_BAD",bad.length,"OF",p.length);
bad.sort((a,b)=>b.id.localeCompare(a.id));
console.log(JSON.stringify(bad.slice(0,50),null,1));
