
(function(){
"use strict";
const allowed="iamshchikova.r@gmail.com";
const project="https://kawfqlohguwvmmplvrny.supabase.co";
const publishable="sb_publishable_aAZxKwYpLcIXAjCiN5lBSg_qdFxvYwL";
const style=document.createElement("style");
style.textContent='body:not(.gs-logged-in) main,body:not(.gs-logged-in) .layout{visibility:hidden}.gs-login{position:fixed;inset:0;z-index:9999;background:linear-gradient(140deg,#f3faff,#f6f3ff);display:flex;justify-content:center;align-items:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}.gs-login-card{background:white;border:1px solid #e3e9f5;border-radius:20px;padding:34px;width:min(420px,100%);box-shadow:0 15px 65px #222a5333;color:#28304b}.gs-login-card h1{font-size:26px!important;line-height:1.2;margin:12px 0!important;color:#2a1750!important}.gs-login-card p{font-size:13px;color:#6b7894}.gs-login-card label{display:block;font-size:13px;font-weight:750;margin:14px 0}.gs-login-card input{display:block;width:100%;font:inherit;font-size:15px;padding:12px;margin-top:7px;border:1px solid #cbd6e8;border-radius:10px;box-sizing:border-box;color:#263452;background:white}.gs-login-card button{background:#03afc9;color:#fff;border:0;border-radius:11px;width:100%;padding:13px;font-size:15px;font-weight:800;cursor:pointer}.gs-login-card button:disabled{opacity:.6}.gs-login-error{color:#ae2b49;font-size:12px;margin-top:12px;min-height:18px}.gs-account{font-size:11px;color:#65758e;display:flex;gap:9px;align-items:center;margin-left:auto}.gs-logout{background:#eef8fc;border:1px solid #cfe7f3;color:#087e9f;padding:7px 10px;font-size:12px;border-radius:9px;cursor:pointer}.gs-brand{color:#04aaca;font-size:28px;font-weight:900;letter-spacing:-1.5px}';
document.head.append(style);
const panel=document.createElement("div");panel.className="gs-login";panel.id="gs-login";
panel.innerHTML='<div class="gs-login-card"><div class="gs-brand">GoStudy</div><h1>Вход в кабинет</h1><p>Введите email и пароль, чтобы открыть уроки.</p><form id="gs-login-form"><label>Email<input name="email" type="email" required autocomplete="username" placeholder="name@example.com"></label><label>Пароль<input name="password" type="password" required autocomplete="current-password"></label><button id="gs-submit" type="submit">Войти</button><div id="gs-error" class="gs-login-error" role="alert"></div></form></div>';
document.body.append(panel);
const form=document.getElementById("gs-login-form"),error=document.getElementById("gs-error"),submit=document.getElementById("gs-submit");
const client=window.supabase&&window.supabase.createClient?window.supabase.createClient(project,publishable,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null;
if(!client){error.textContent="Не загрузилась система входа. Проверьте подключение к интернету.";return;}
const show=()=>{document.body.classList.remove("gs-logged-in");panel.style.display="flex";document.getElementById("gs-account")?.remove();};
const accept=(user)=>{
  document.body.classList.add("gs-logged-in");panel.style.display="none";
  if(document.getElementById("gs-account"))return;
  const account=document.createElement("div");account.id="gs-account";account.className="gs-account";
  const email=document.createElement("span");email.textContent=user.email||"";
  const logout=document.createElement("button");logout.className="gs-logout";logout.textContent="Выйти";logout.type="button";
  logout.onclick=async()=>{await client.auth.signOut();show();form.reset()};
  account.append(email,logout);document.querySelector("header")?.append(account);
};
const validate=async(user)=>{if(!user){show();return}if(String(user.email||"").toLowerCase()!==allowed){await client.auth.signOut();show();error.textContent="Этот кабинет предназначен для другого email.";return}accept(user);};
form.addEventListener("submit",async(event)=>{
event.preventDefault();error.textContent="";
const email=form.elements.email.value.trim().toLowerCase();
if(email!==allowed){error.textContent="Этот email не привязан к кабинету.";return}
submit.disabled=true;submit.textContent="Проверяем…";
try{
 const {data,error:e}=await client.auth.signInWithPassword({email,password:form.elements.password.value});
 if(e){error.textContent=e.message==="Invalid login credentials"?"Неверный email или пароль.":e.message;return}
 form.elements.password.value="";await validate(data.user);
}catch(e){error.textContent="Не получилось войти. Проверьте интернет и повторите."}
finally{submit.disabled=false;submit.textContent="Войти";}
});
(async()=>{try{const {data}=await client.auth.getUser();await validate(data?.user)}catch(e){show()}})();
})();
