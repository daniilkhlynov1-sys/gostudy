
/* GoStudy B2 incoming vocabulary notifications.
   Runs independently of lesson progress synchronization. */
(function(){
"use strict";
if(!/\/(?:student-turkey|general-english-b2-m01-l01)\.html$/.test(location.pathname))return;
const studentEmail="iamshchikova.r@gmail.com";
const studentId="b0a12885-4971-4cbd-acc8-b469e486d5ed";
const seenKey="gostudy-b2-word-notifications-v4-"+studentId;
let client=null,polling=false,started=false,pollTimer=null,channel=null,active=null,userId=null;
let queue=[];
const css=document.createElement("style");
css.textContent='.gs-incoming-backdrop{position:fixed!important;inset:0!important;z-index:2147483000!important;background:#14284488!important;display:flex;align-items:center!important;justify-content:center!important;padding:18px!important}.gs-incoming-card{width:min(370px,100%)!important;background:#fff!important;color:#252c4a!important;border-radius:22px!important;padding:28px 24px!important;text-align:center!important;box-shadow:0 18px 65px #111c3455!important;font:15px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif!important}.gs-incoming-icon{display:grid;place-items:center;width:55px;height:55px;margin:0 auto 13px;border-radius:50%;background:#e2f9fc;color:#0499b2;font-size:28px;font-weight:850}.gs-incoming-title{font-size:20px!important;margin:0 0 15px!important;color:#212745!important}.gs-incoming-en{font-weight:850;font-size:23px;overflow-wrap:anywhere}.gs-incoming-ru{font-size:18px;color:#536584;margin:9px 0;overflow-wrap:anywhere}.gs-incoming-description{font-size:12px;color:#64728b;margin:14px 0 19px}.gs-incoming-ok{background:#02abc7;border:0;border-radius:12px;color:#fff;font:inherit;font-weight:850;padding:12px 28px;cursor:pointer;min-width:145px}';
document.head.append(css);
const backdrop=document.createElement("div");
backdrop.className="gs-incoming-backdrop";
backdrop.style.display="none";
backdrop.setAttribute("role","presentation");
const box=document.createElement("div");box.className="gs-incoming-card";box.setAttribute("role","alertdialog");box.setAttribute("aria-modal","true");box.setAttribute("aria-label","Новое слово от преподавателя");
const icon=document.createElement("div");icon.className="gs-incoming-icon";icon.textContent="+";
const title=document.createElement("h2");title.className="gs-incoming-title";title.textContent="Вам добавили новое слово!";
const english=document.createElement("div");english.className="gs-incoming-en";
const russian=document.createElement("div");russian.className="gs-incoming-ru";
const description=document.createElement("p");description.className="gs-incoming-description";description.textContent="Слово сохранено в вашем личном словаре.";
const ok=document.createElement("button");ok.className="gs-incoming-ok";ok.type="button";ok.textContent="Понятно";
box.append(icon,title,english,russian,description,ok);backdrop.append(box);document.body.append(backdrop);
function seen(){try{const obj=JSON.parse(localStorage.getItem(seenKey)||"{}");return obj&&typeof obj==="object"?obj:{}}catch{return {}}}
function mark(row){try{const obj=seen();obj[row.en_key]=row.updated_at||"1";localStorage.setItem(seenKey,JSON.stringify(obj))}catch(e){console.warn("Couldn't record notification acknowledgement:",e)}}
function render(){
 if(active||!queue.length)return;
 active=queue.shift();english.textContent=active.en;russian.textContent=active.ru;
 backdrop.style.removeProperty("display");ok.focus();
}
ok.addEventListener("click",()=>{if(active)mark(active);active=null;backdrop.style.display="none";render()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&active)ok.click()});
async function scan(){
 if(polling||!client||!userId)return;
 polling=true;
 try{
  const {data,error}=await client.from("gostudy_b2_word_assignments")
    .select("en_key,en,ru,updated_at")
    .eq("student_id",userId).order("updated_at",{ascending:true});
  if(error)throw error;
  const done=seen();
  const queued=new Set(queue.map(x=>x.en_key));if(active)queued.add(active.en_key);
  for(const row of data||[]){
   if(!row.en||!row.en_key||!row.ru)continue;
   if(done[row.en_key]===row.updated_at||queued.has(row.en_key))continue;
   queue.push(row);queued.add(row.en_key);
  }
  render();
  if((data||[]).length)window.dispatchEvent(new Event("gostudy:check-assigned-vocabulary"));
 }catch(e){console.warn("GoStudy notification check failed:",e)}
 finally{polling=false}
}
function subscribe(){
 try{
  channel=client.channel("gostudy-b2-vocabulary-"+userId)
   .on("postgres_changes",{event:"*",schema:"public",table:"gostudy_b2_word_assignments",filter:"student_id=eq."+userId},()=>scan())
   .subscribe();
 }catch(e){console.warn("Realtime unavailable; polling is active",e)}
}
async function start(){
 if(started)return;
 client=window.gostudyAuthClient||null;
 if(!client)return;
 try{
  const {data,error}=await client.auth.getUser();
  if(error||!data?.user||String(data.user.email||"").toLowerCase()!==studentEmail)return;
  userId=data.user.id;started=true;
  await scan();
  pollTimer=setInterval(scan,3000);
  window.addEventListener("focus",scan);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)scan()});
  subscribe();
 }catch(e){console.warn("GoStudy notification setup failed:",e)}
}
function stop(){
 started=false;userId=null;queue=[];active=null;backdrop.style.display="none";
 if(pollTimer)clearInterval(pollTimer);pollTimer=null;
 if(client&&channel)client.removeChannel(channel);channel=null;
}
document.addEventListener("gostudy:authenticated",()=>{setTimeout(start,0)});
document.addEventListener("gostudy:signedout",stop);
setTimeout(start,0);
})();
