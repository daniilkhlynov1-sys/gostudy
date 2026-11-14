
/* GoStudy Cloud Progress v1.0: per-user Supabase RLS, local-first migration, cross-device refresh. */
(function(){
"use strict";
const project="https://kawfqlohguwvmmplvrny.supabase.co";
const publishable="sb_publishable_aAZxKwYpLcIXAjCiN5lBSg_qdFxvYwL";
const path=location.pathname.split("/").pop().toLowerCase();
const isCabinet=path==="student-turkey.html";
const isB2=path==="general-english-b2-m01-l01.html";
const isTurkey2=path==="turkey-b1-02.html";
if(!isCabinet&&!isB2&&!isTurkey2)return;
const keys=isCabinet?["gostudy-turkey-b1-v1","gostudy-turkey-profile-v1","gostudy-business-ai-shared-v1","gostudy-turkey-b1-lesson02-v1","gostudy-ge-b2-m01-l01-v1"]
:isB2?["gostudy-ge-b2-m01-l01-v1","gostudy-business-ai-shared-v1"]
:["gostudy-turkey-b1-lesson02-v1","gostudy-turkey-b1-v1"];
const sharedKeys=new Set(["gostudy-business-ai-shared-v1","gostudy-turkey-b1-v1"]);
let client=null,user=null,ready=false,stopped=false,processing=false,lastRemote={},lastLocal={},timer=null,poller=null;
const el=document.createElement("span");el.id="gs-cloud-status";el.setAttribute("role","status");el.style.cssText="font-size:11px;font-weight:700;color:#74859d;margin-left:10px;white-space:nowrap";el.textContent="☁ Подключаем синхронизацию…";
document.querySelector("header")?.append(el);
function status(text,color){el.textContent=text;el.style.color=color||"#74859d"}
function parse(value){if(!value)return null;try{const data=JSON.parse(value);return data&&typeof data==="object"&&!Array.isArray(data)?data:null}catch(e){return null}}
function canonical(value){return JSON.stringify(value??{})}
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
      if(canonical(result)!==canonical(here)){saveLocal(key,result);if(key!=="gostudy-business-ai-shared-v1"&&key!=="gostudy-turkey-b1-v1")requireReload=true;}
      if(canonical(result)!==canonical(cloud))dirtyKeys.push([key,result]);
      lastRemote[key]=canonical(cloud);lastLocal[key]=canonical(result);
    }else if(meaningful(here)){
      dirtyKeys.push([key,here]);lastLocal[key]=canonical(here);
    }else{lastLocal[key]=canonical(here);lastRemote[key]=canonical(null)}
  }
  for(const [key,value] of dirtyKeys)await push(key,value);
  ready=true;status("☁ Синхронизировано","#16976d");
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
      if(!sharedKeys.has(key))needsReload=true;
    }
    lastRemote[key]=canonical(cloud);lastLocal[key]=canonical(value);
    if(canonical(value)!==canonical(cloud))await push(key,value);
  }
  status("☁ Синхронизировано","#16976d");
  if(needsReload)location.reload();
 }catch(e){console.warn("Cloud refresh error",e);status("☁ Нет соединения","#bd4356")}
 finally{processing=false}
}
async function start(){
 if(user||stopped)return;
 client=window.gostudyAuthClient||window.supabase?.createClient?.(project,publishable);
 if(!client){status("☁ Сервис недоступен","#bd4356");return}
 try{
  const {data,error}=await client.auth.getUser();
  if(error||!data?.user)return;
  if(String(data.user.email||"").toLowerCase()!=="iamshchikova.r@gmail.com")return;
  user=data.user;await bootstrap();
  timer=setInterval(saveChanges,1600);poller=setInterval(refresh,14000);
  window.addEventListener("focus",refresh);
  window.addEventListener("pageshow",refresh);
  window.addEventListener("storage",e=>{if(keys.includes(e.key))setTimeout(saveChanges,400)});
  window.addEventListener("pagehide",()=>{if(ready&&!processing)saveChanges()});
 }catch(e){status("☁ Ошибка подключения","#bd4356")}
}
document.addEventListener("gostudy:authenticated",start);
document.addEventListener("gostudy:signedout",()=>{stopped=true;ready=false;user=null;clearInterval(timer);clearInterval(poller);});
start();
})();
