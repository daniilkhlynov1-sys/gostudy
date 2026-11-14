
/* GoStudy B2: existing '+' saves for student; confirmation appears at screen center. */
(function(){
"use strict";
if(!location.pathname.endsWith("/general-english-b2-m01-l01.html"))return;
const btn=document.getElementById("saveWord"),input=document.getElementById("translateInput"),result=document.getElementById("translateResult");
if(!btn||!input||!result)return;
const studentId="b0a12885-4971-4cbd-acc8-b469e486d5ed";
const teacherEmail="daniil.khlynov1@gmail.com";
const studentEmail="iamshchikova.r@gmail.com";
const dictionaryKey="gostudy-business-ai-shared-v1";
const style=document.createElement("style");
style.textContent='.gs-word-overlay{position:fixed;inset:0;z-index:10001;background:#15243e66;display:flex;align-items:center;justify-content:center;padding:20px}.gs-word-panel{width:min(350px,100%);background:#fff;color:#25324e;border:1px solid #dfebf4;border-radius:20px;padding:24px;text-align:center;box-shadow:0 18px 65px #121d3440;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}.gs-word-panel .tick{font-size:29px;width:54px;height:54px;border-radius:50%;background:#e8fbf2;color:#07946c;margin:auto auto 12px;display:grid;place-items:center}.gs-word-panel h2{font-size:19px!important;line-height:1.2!important;margin:0 0 15px!important;color:#202c48!important}.gs-word-panel .english{font-size:22px;font-weight:850;color:#201e4b;overflow-wrap:anywhere}.gs-word-panel .russian{font-size:18px;color:#536382;margin-top:8px;overflow-wrap:anywhere}.gs-word-panel p{color:#66778f;font-size:12px;margin:17px 0}.gs-word-panel button{border:0;border-radius:10px;background:#00afc9;color:white;padding:11px 20px;font-size:14px;font-weight:800;cursor:pointer;min-width:130px}.gs-word-panel .failed{color:#b63454}.gs-word-panel .tick.failed{background:#ffecf1;color:#b63454}';
document.head.append(style);
const overlay=document.createElement("div");overlay.className="gs-word-overlay";overlay.style.display="none";overlay.innerHTML='<div class="gs-word-panel" role="dialog" aria-modal="true" aria-label="Сохранение слова"><div class="tick" id="gs-word-tick">✓</div><h2 id="gs-word-title">Сохраняем слово…</h2><div class="english" id="gs-word-en"></div><div class="russian" id="gs-word-ru"></div><p id="gs-word-message"></p><button id="gs-word-close" type="button">Закрыть</button></div>';
document.body.append(overlay);
const close=()=>{overlay.style.display="none";document.getElementById("translatePop")?.classList.remove("show")};
document.getElementById("gs-word-close").onclick=close;
overlay.onclick=e=>{if(e.target===overlay)close()};
document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
function modal(word,message,error){
 document.getElementById("gs-word-en").textContent=word.en;
 document.getElementById("gs-word-ru").textContent=word.ru;
 document.getElementById("gs-word-title").textContent=error?"Не удалось сохранить":"Слово добавлено!";
 document.getElementById("gs-word-message").textContent=message;
 const tick=document.getElementById("gs-word-tick");
 tick.textContent=error?"!":"✓";tick.classList.toggle("failed",!!error);
 overlay.style.display="flex";
 document.getElementById("gs-word-close").focus();
}
function localAdd(word){
 const data=JSON.parse(localStorage.getItem(dictionaryKey)||"{}");
 data.words=Array.isArray(data.words)?data.words:[];
 const pos=data.words.findIndex(x=>String(x.en||"").toLowerCase()===word.en.toLowerCase());
 if(pos<0)data.words.push(word);else data.words[pos]={...data.words[pos],...word};
 localStorage.setItem(dictionaryKey,JSON.stringify(data));
 document.querySelector("#wordCount")&&(document.querySelector("#wordCount").textContent=data.words.length);
 const list=document.querySelector("#vocabList");
 if(list)list.innerHTML=data.words.slice(-20).reverse().map(w=>'<div><b>'+String(w.en).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))+'</b> — '+String(w.ru).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))+'</div>').join("");
}
btn.onclick=async()=>{
 const source=input.value.trim(),translation=result.textContent.trim();
 if(!source||!translation||translation==="Translating…"||translation.startsWith("Translation preview unavailable"))return;
 const isRu=/[А-Яа-яЁё]/.test(source);
 const word={en:(isRu?translation:source).slice(0,200),ru:(isRu?source:translation).slice(0,400)};
 const client=window.gostudyAuthClient;
 if(!client){modal(word,"Нет подключения к Supabase. Попробуйте обновить страницу.",true);return}
 btn.disabled=true;btn.textContent="Сохраняем…";
 try{
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user)throw Error("Сначала войдите в аккаунт.");
  const email=String(user.email||"").toLowerCase();
  if(email===teacherEmail){
    const {error:e}=await client.from("gostudy_b2_word_assignments").upsert({
      teacher_id:user.id,student_id:studentId,en_key:word.en.trim().toLowerCase(),en:word.en,ru:word.ru,updated_at:new Date().toISOString()
    },{onConflict:"teacher_id,student_id,en_key"});
    if(e)throw e;
    modal(word,"Добавлено в словарь ученицы. Она увидит слово после синхронизации.");
  }else if(email===studentEmail){
    localAdd(word);
    const {data:existing,error:loadError}=await client.from("gostudy_progress").select("state").eq("user_id",user.id).eq("lesson_key",dictionaryKey).maybeSingle();
    if(loadError)throw loadError;
    const dict=existing?.state&&typeof existing.state==="object"?existing.state:{};
    const words=Array.isArray(dict.words)?dict.words.slice():[];
    const pos=words.findIndex(w=>String(w.en||"").trim().toLowerCase()===word.en.trim().toLowerCase());
    if(pos<0)words.push(word);else words[pos]={...words[pos],...word};
    const {error:e}=await client.from("gostudy_progress").upsert({
       user_id:user.id,lesson_key:dictionaryKey,state:{...dict,words}
    },{onConflict:"user_id,lesson_key"});
    if(e)throw e;
    modal(word,"Слово сохранено в твоём словаре и доступно на других устройствах.");
  }else throw Error("Этот аккаунт не привязан к уроку.");
  btn.textContent="✓ Saved";
 }catch(e){
   console.warn("GoStudy vocabulary save",e);
   modal(word,"Сохранение не завершено. Проверьте соединение и попробуйте ещё раз.",true);
   btn.textContent="＋ To vocabulary";
 }finally{btn.disabled=false}
};
})();
