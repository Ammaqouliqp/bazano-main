const API_BASE = '/api';
function getToken(){return localStorage.getItem('token');}
function setToken(t){localStorage.setItem('token',t);}
function removeToken(){localStorage.removeItem('token');}
function isLoggedIn(){return !!getToken();}
function getTokenPayload(){try{const t=getToken();if(!t)return null;return JSON.parse(atob(t.split('.')[1]));}catch(e){return null;}}
function isPendingProfile(){const p=getTokenPayload();return !!(p&&p.pending);}
async function apiFetch(endpoint,method,body){
  method=method||'GET';
  const headers={'Content-Type':'application/json'};
  const token=getToken();
  if(token)headers['Authorization']='Bearer '+token;
  const res=await fetch(API_BASE+endpoint,{method:method,headers:headers,body:body?JSON.stringify(body):null});
  if(!res.ok){const err=await res.json().catch(function(){return{};});
    if(err.code==='PROFILE_REQUIRED'){location.href='/complete-profile.html';throw new Error(err.error||'تکمیل پروفایل');}
    throw new Error(err.error||('خطا '+res.status));}
  return res.json();
}
function requireAuth(){
  if(!getToken()){location.href='/login.html';return false;}
  if(isPendingProfile()){location.href='/complete-profile.html';return false;}
  return true;
}
function logout(){removeToken();location.href='/';}
document.addEventListener('DOMContentLoaded',function(){
  const sendBtn=document.getElementById('send-otp-btn');
  const verifyBtn=document.getElementById('verify-otp-btn');
  const backBtn=document.getElementById('back-btn');
  const messageEl=document.getElementById('message');
  if(!sendBtn)return;
  function showMsg(text,type){messageEl.textContent=text;messageEl.className='auth_message '+(type||'error');}
  sendBtn.addEventListener('click',async function(){
    const email=document.getElementById('email').value.trim();
    if(!email||email.indexOf('@')===-1){showMsg('ایمیل معتبر وارد کنید');return;}
    try{sendBtn.disabled=true;sendBtn.textContent='در حال ارسال...';
      const data=await apiFetch('/auth/send-otp','POST',{email:email});
      showMsg(data.message||'کد ارسال شد','success');
      if(data.devCode)console.log('DEV OTP',data.devCode);
      document.getElementById('step-email').style.display='none';
      document.getElementById('step-otp').style.display='block';
      document.getElementById('otp').value='';
      document.getElementById('otp').focus();
    }catch(err){showMsg(err.message||'خطا در ارسال کد');}
    finally{sendBtn.disabled=false;sendBtn.textContent='دریافت کد';}
  });
  verifyBtn.addEventListener('click',async function(){
    const email=document.getElementById('email').value.trim();
    const code=document.getElementById('otp').value.trim();
    if(!code){showMsg('کد را وارد کنید');return;}
    try{const data=await apiFetch('/auth/verify-otp','POST',{email:email,code:code});
      setToken(data.token);
      if(data.action==='complete_profile'){showMsg('لطفاً پروفایل را تکمیل کنید','success');setTimeout(function(){location.href='/complete-profile.html';},500);}
      else{showMsg('ورود موفق','success');setTimeout(function(){location.href='/';},500);}
    }catch(err){showMsg(err.message);}
  });
  if(backBtn)backBtn.addEventListener('click',function(){
    document.getElementById('step-otp').style.display='none';
    document.getElementById('step-email').style.display='block';
    messageEl.textContent='';
  });
});
