
const fs=require("fs");
const p=require("./data/posts.json");
const bad=[];
for(const x of p){
  const f="content/"+x.contentFile;
  if(!fs.existsSync(f)) continue;
  const md=fs.readFileSync(f,"utf8");
  const stripped=md.replace(/<figure[\s\S]*?<\/figure>/gi,"").replace(/!\[[^\]]*\]\([^)]*\)/g,"").replace(/<[^>]*>/g,"").replace(/[#*`>_|\[\]()\-]/g," ").replace(/\s+/g," ").trim();
  const words=stripped.split(" ").filter(w=>w.length>2).length;
  if(words<120) bad.push({t:x.type,id:x.id,w:words,h:x.title.slice(0,50)});
}
console.log("TOTAL_BAD",bad.length,"OF",p.length);
// group by date desc
const byDate={};
bad.forEach(b=>{const d=b.id.slice(0,6);});
const counts={};
p.forEach(x=>{});
console.log(JSON.stringify(bad.slice(0,40),null,0));
