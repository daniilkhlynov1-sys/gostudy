
/* GoStudy Cloud Progress v1.0: per-user Supabase RLS, local-first migration, cross-device refresh. */
(function(){
"use strict";
const project="https://kawfqlohguwvmmplvrny.supabase.co";
const publishable="sb_publishable_aAZxKwYpLcIXAjCiN5lBSg_qdFxvYwL";
const path=location.pathname.split("/").pop().toLowerCase();
const isCabinet=path==="student-turkey.html";
const isB2=path==="general-english-b2-m01-l01.html";
if(!isCabinet&&!isB2)return;
const keys=["gostudy-ge-b2-m01-l01-v1","gostudy-business-ai-shared-v1","gostudy-b2-student-profile-v1"];
const sharedKeys=new Set(["gostudy-business-ai-shared-v1"]);
let client=null,user=null,ready=false,stopped=false,processing=false,lastRemote={},lastLocal={},timer=null,poller=null,wordsPoller=null,checkingWords=false;
const el=document.createElement("span");el.id="gs-cloud-status";el.setAttribute("role","status");el.style.cssText="font-size:11px;font-weight:700;color:#74859d;margin-left:10px;white-space:nowrap";el.textContent="☁ Подключаем синхронизацию…";
document.querySelector("header")?.append(el);
function status(text,color){el.textContent=text;el.style.color=color||"#74859d"}
function parse(value){if(!value)return null;try{const data=JSON.parse(value);return data&&typeof data==="object"&&!Array.isArray(data)?data:null}catch(e){return null}}
function canonical(value){const norm=v=>Array.isArray(v)?v.map(norm):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,norm(v[k])])):v;return JSON.stringify(norm(value??{}))}
function local(key){return parse(localStorage.getItem(key))}
function saveLocal(key,data){localStorage.setItem(key,canonical(data));lastLocal[key]=canonical(data)}
function meaningful(obj){return obj&&Object.keys(obj).length>0}
function combineWords(left,right){
 if(!left)return right;if(!right)return left;
 const merged={...left,...right};const map=new Map();
 for(const w of [...(Array.isArray(left.words)?left.words:[]),...(Array.isArray(right.words)?right.words:[])]){
   if(!w||typeof w.en!=="string")continue;
   const k=w.en.trim().toLowerCase();
   if(k)map.set(k,{...map.get(k),...w});
 }
 merged.words=[...map.values()];return merged;
}
async function push(key,state){
 const {error}=await client.from("gostudy_progress").upsert({user_id:user.id,lesson_key:key,state},{onConflict:"user_id,lesson_key"});
 if(error)throw error;
 lastRemote[key]=canonical(state);lastLocal[key]=canonical(state);
}

const seenKey="gostudy-b2-assigned-seen-v2";
function notifyWord(word){
 if(document.querySelector("#gs-student-word-notice"))return;
 const shade=document.createElement("div");
 shade.id="gs-student-word-notice";
 shade.setAttribute("role","alertdialog");
 shade.setAttribute("aria-modal","true");
 shade.style.cssText="position:fixed;inset:0;z-index:12000;background:#1c27465e;display:flex;align-items:center;justify-content:center;padding:16px";
 const card=document.createElement("div");
 card.style.cssText="width:min(350px,100%);background:#fff;color:#242b46;border-radius:20px;padding:26px;text-align:center;box-shadow:0 16px 65px #14223a3d;font:15px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif";
 const title=document.createElement("h2");title.style.cssText="font-size:20px;margin:0 0 16px";title.textContent="✦ Новое слово в словаре!";
 const en=document.createElement("div");en.style.cssText="font-size:23px;font-weight:800;overflow-wrap:anywhere";en.textContent=word.en;
 const ru=document.createElement("div");ru.style.cssText="font-size:18px;color:#5a6782;margin:8px 0 12px;overflow-wrap:anywhere";ru.textContent=word.ru;
 const hint=document.createElement("p");hint.style.cssText="font-size:12px;color:#718099;margin:0 0 18px";hint.textContent="Преподаватель добавил слово. Оно сохранено в вашем словаре.";
 const btn=document.createElement("button");btn.type="button";btn.textContent="Понятно";btn.style.cssText="border:0;border-radius:11px;background:#08aec7;color:white;padding:12px 30px;font-weight:800;cursor:pointer";
 btn.onclick=()=>{shade.remove();window.dispatchEvent(new Event("gostudy:vocab-changed"))};
 card.append(title,en,ru,hint,btn);shade.append(card);document.body.append(shade);btn.focus();
}
function seenWords(){try{return JSON.parse(localStorage.getItem(seenKey)||"{}")||{}}catch{return {}}}
function markSeen(row){const seen=seenWords();seen[row.en_key]=row.updated_at||true;localStorage.setItem(seenKey,JSON.stringify(seen))}
async function checkTeacherWords(){
 if(!user||stopped||checkingWords||processing)return;
 checkingWords=true;
 try{
  const {data,error}=await client.from("gostudy_b2_word_assignments").select("en_key,en,ru,updated_at").eq("student_id",user.id).order("updated_at",{ascending:true});
  if(error)throw error;
  const unseen=(data||[]).filter(row=>seenWords()[row.en_key]!==row.updated_at);
  if(!unseen.length)return;
  const imported=await importTeacherWords();
  for(const word of unseen)markSeen(word);
  if(imported)window.dispatchEvent(new Event("gostudy:vocab-changed"));
  const word=unseen[unseen.length-1];
  notifyWord(word);
 }catch(e){console.warn("Teacher vocabulary refresh:",e)}
 finally{checkingWords=false}
}
async function importTeacherWords(){
 const {data,error}=await client.from("gostudy_b2_word_assignments").select("en,ru").eq("student_id",user.id);
 if(error)throw error;
 if(!data||!data.length)return false;
 const key="gostudy-business-ai-shared-v1",dict=local(key)||{},words=Array.isArray(dict.words)?dict.words.slice():[];
 let changed=false;
 for(const w of data){
  if(!w||!w.en||!w.ru)continue;
  const pos=words.findIndex(x=>String(x?.en||"").trim().toLowerCase()===String(w.en).trim().toLowerCase());
  if(pos<0){words.push({en:w.en,ru:w.ru,assignedByTeacher:true});changed=true}
  else if(words[pos].ru!==w.ru||!words[pos].assignedByTeacher){words[pos]={...words[pos],ru:w.ru,assignedByTeacher:true};changed=true}
 }
 if(!changed)return false;
 const merged={...dict,words};saveLocal(key,merged);await push(key,merged);
 return true;
}
async function bootstrap(){
 if(processing||stopped||!user)return;
 processing=true;ready=false;status("☁ Загружаем прогресс…");
 let requireReload=false,dirtyKeys=[];
 try{
  const {data,error}=await client.from("gostudy_progress").select("lesson_key,state").eq("user_id",user.id).in("lesson_key",keys);
  if(error)throw error;
  const remote=new Map((data||[]).map(r=>[r.lesson_key,r.state]));
  for(const key of keys){
    const here=local(key),cloud=remote.get(key)||null;
    if(cloud){
      let result=cloud;
      if(sharedKeys.has(key)&&here)result=combineWords(cloud,here);
      if(canonical(result)!==canonical(here)){saveLocal(key,result);if(key==="gostudy-business-ai-shared-v1")window.dispatchEvent(new Event("gostudy:vocab-changed"));else requireReload=true;}
      if(canonical(result)!==canonical(cloud))dirtyKeys.push([key,result]);
      lastRemote[key]=canonical(cloud);lastLocal[key]=canonical(result);
    }else if(meaningful(here)){
      dirtyKeys.push([key,here]);lastLocal[key]=canonical(here);
    }else{lastLocal[key]=canonical(here);lastRemote[key]=canonical(null)}
  }
  for(const [key,value] of dirtyKeys)await push(key,value);
  ready=true; if(await importTeacherWords())window.dispatchEvent(new Event("gostudy:vocab-changed"));status("☁ Синхронизировано","#16976d");
  if(requireReload)location.reload();
 }catch(e){console.warn("GoStudy cloud sync failed:",e);status("☁ Не удалось синхронизировать","#bd4356")}
 finally{processing=false}
}
async function saveChanges(){
 if(!ready||processing||stopped||!user)return;
 processing=true;
 try{
  for(const key of keys){
   const data=local(key),snapshot=canonical(data);
   if(snapshot===lastLocal[key])continue;
   if(!meaningful(data)){lastLocal[key]=snapshot;continue}
   status("☁ Сохраняем…");
   await push(key,data);
  }
  status("☁ Синхронизировано","#16976d");
 }catch(e){console.warn("Cloud save error",e);status("☁ Ошибка сохранения","#bd4356")}
 finally{processing=false}
}
async function refresh(){
 if(!ready||processing||stopped||!user)return;
 // Never overwrite unsent local changes.
 if(keys.some(key=>canonical(local(key))!==lastLocal[key])){await saveChanges();return}
 processing=true;let needsReload=false;
 try{
  const {data,error}=await client.from("gostudy_progress").select("lesson_key,state").eq("user_id",user.id).in("lesson_key",keys);
  if(error)throw error;
  for(const row of data||[]){
    const key=row.lesson_key,cloud=row.state;
    if(canonical(cloud)===lastRemote[key])continue;
    let value=cloud;
    if(sharedKeys.has(key))value=combineWords(cloud,local(key));
    if(canonical(value)!==canonical(local(key))){
      saveLocal(key,value);
      if(key==="gostudy-business-ai-shared-v1")window.dispatchEvent(new Event("gostudy:vocab-changed"));else needsReload=true;
    }
    lastRemote[key]=canonical(cloud);lastLocal[key]=canonical(value);
    if(canonical(value)!==canonical(cloud))await push(key,value);
  }
  if(await importTeacherWords())window.dispatchEvent(new Event("gostudy:vocab-changed"));
  status("☁ Синхронизировано","#16976d");
  if(needsReload)location.reload();
 }catch(e){console.warn("Cloud refresh error",e);status("☁ Нет соединения","#bd4356")}
 finally{processing=false}
}
async function start(){
 if(user)return;stopped=false;
 client=window.gostudyAuthClient||window.supabase?.createClient?.(project,publishable);
 if(!client){status("☁ Сервис недоступен","#bd4356");return}
 try{
  const {data,error}=await client.auth.getUser();
  if(error||!data?.user)return;
  if(String(data.user.email||"").toLowerCase()!=="iamshchikova.r@gmail.com")return;
  user=data.user;await bootstrap();
  timer=setInterval(saveChanges,1600);poller=setInterval(refresh,14000);wordsPoller=setInterval(checkTeacherWords,5000);setTimeout(checkTeacherWords,700);
  window.addEventListener("focus",refresh);
  window.addEventListener("pageshow",refresh);
  window.addEventListener("storage",e=>{if(keys.includes(e.key))setTimeout(saveChanges,400)});
  window.addEventListener("pagehide",()=>{if(ready&&!processing)saveChanges()});
 }catch(e){status("☁ Ошибка подключения","#bd4356")}
}
document.addEventListener("gostudy:authenticated",start);
document.addEventListener("gostudy:signedout",()=>{stopped=true;ready=false;user=null;clearInterval(timer);clearInterval(poller);clearInterval(wordsPoller);status("☁ Войдите для синхронизации")});
start();
})();
