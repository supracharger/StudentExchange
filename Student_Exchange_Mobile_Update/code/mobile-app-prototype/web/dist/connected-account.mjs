// Real account UI is intentionally separate from the local marketplace demo.
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function api(route,method='GET',body){
 const response=await fetch(`/api/${route}`,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 let data;try{data=await response.json();}catch{throw new Error('This host does not provide the account bridge. Run the Node server described in docs/BACKEND_INTEGRATION.md.');}
 if(!response.ok)throw new Error(data.message||'The account request failed.');return data;
}
export function createConnectedAccount({modal,close,toast,onChange}){
 let profile=null,version=0;
 const field=(key,label,value='',type='text')=>`<div class="field"><label for="backend-${key}">${label}</label><input id="backend-${key}" name="${key}" type="${type}" value="${escape(value)}" required maxlength="${key==='email'||key==='password'?50:80}" ${key==='password'?'autocomplete="current-password"':key==='email'?'autocomplete="email" autocapitalize="none"':''}></div>`;
 const schoolSelect=schools=>`<div class="field"><label for="backend-school">School</label><select id="backend-school" name="school" required><option value="">Choose your school</option>${schools.map(x=>`<option ${profile?.school===x?'selected':''}>${escape(x)}</option>`).join('')}</select></div>`;
 async function show(mode=profile?'profile':'login'){
  const revision=++version;
  modal('Backend account','<p role="status">Checking account service…</p>');
  try{
   const status=await api('status');if(revision!==version||!document.getElementById('sheet').open)return;
   if(!status.enabled)throw new Error('The account bridge is not configured yet. Follow docs/BACKEND_INTEGRATION.md to set it up.');
   const schools=mode==='login'?[]:(await api('schools')).schools;
   if(revision!==version||!document.getElementById('sheet').open)return;
   const editing=mode==='profile',registering=mode==='register';
   modal(editing?'Your backend account':registering?'Create a backend account':'Log in to your backend',`<div class="info">${editing?'These account details come from your group’s backend.':'This form sends account details to your group’s backend.'} Listings, saves, photos, and chats remain local demos.</div><form id="backend-form" data-mode="${mode}"><div id="backend-error" role="alert"></div>${field('email','Email address',editing?profile.email:'','email')}${registering||editing?field('first_name','First name',editing?profile.first_name:'')+field('last_name','Last name',editing?profile.last_name:'')+schoolSelect(schools):''}${editing?'':field('password','Password','','password')}${registering?'<p class="small muted">8–50 characters, including an uppercase letter and one of !@#$%^&amp;*_-+=. The backend validates all fields.</p>':''}<button class="primary block" type="submit">${editing?'Save account changes':registering?'Create account':'Log in'}</button></form>${editing?'<p class="small muted">Backend logout signs you out on all devices, as implemented by the group’s API.</p><button class="secondary block" data-backend-action="logout">Log out on all devices</button>':`<button class="text-btn block" data-backend-action="${registering?'login':'register'}">${registering?'Already registered? Log in':'Create an account'}</button>`}`);
  }catch(error){if(revision===version&&document.getElementById('sheet').open)modal('Account connection unavailable',`<p class="error">${escape(error.message)}</p><p class="muted">You can still explore the local marketplace demo.</p>`);}
 }
 document.getElementById('sheet').addEventListener('close',()=>{version++;});
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-backend-action]');if(!button||button.disabled)return;
  const action=button.dataset.backendAction;
  if(action!=='logout'){show(action);return;}
  button.disabled=true;
  try{await api('logout','POST',{});profile=null;onChange(null);close();toast('Backend logout completed on all devices.');}
  catch(error){toast(error.message);}finally{button.disabled=false;}
 });
 document.addEventListener('submit',async event=>{
  const form=event.target;if(form.id!=='backend-form')return;event.preventDefault();
  const button=form.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;
  const values=Object.fromEntries(new FormData(form)),mode=form.dataset.mode;
  try{
   if(mode==='register'){await api('register','POST',values);await show('login');toast('Account created. Log in with your new credentials.');}
   else{
    const result=mode==='login'?await api('login','POST',values):(await api('profile','PATCH',values),await api('profile'));
    profile=result.profile;onChange(profile);close();toast(mode==='login'?'Logged in to your backend. Marketplace activity is still local.':'Backend account updated.');
   }
  }catch(error){if(form.isConnected)form.querySelector('#backend-error').innerHTML=`<p class="error">${escape(error.message)}</p>`;}
  finally{if(form.isConnected)button.disabled=false;}
 });
 return {show,async restore(){try{const status=await api('status');if(!status.enabled)return;profile=(await api('profile')).profile;onChange(profile);}catch{/* An unavailable bridge never converts a demo session into real authentication. */}}};
}
