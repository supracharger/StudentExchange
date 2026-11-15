import http from 'node:http';
import https from 'node:https';
import {randomBytes} from 'node:crypto';

const COOKIE='se_session';
const TTL=8*60*60*1000;
const fields=['email','first_name','last_name','password','school'];
const publicProfile=p=>Object.fromEntries(['email','first_name','last_name','school'].map(k=>[k,String(p[k]??'')]));

// Node's HTTP client supports the GET body required by Register.Get().
// Neither the application credential nor upstream access tokens reach the browser.
export function upstreamRequest(base,route,method,data){
 return new Promise((resolve,reject)=>{
  const url=new URL(route,base),body=data===undefined?null:Buffer.from(JSON.stringify(data));
  const req=(url.protocol==='https:'?https:http).request(url,{
   method,headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','Content-Length':body.length}:{})},
  },res=>{
   let size=0;const chunks=[];
   res.on('data',chunk=>{size+=chunk.length;if(size>1024*1024){res.destroy();reject(new Error('Response too large'));}else chunks.push(chunk);});
   res.on('error',reject);
   res.on('end',()=>{const raw=Buffer.concat(chunks).toString();let payload;try{payload=JSON.parse(raw);}catch{payload={Message:raw};}resolve({status:res.statusCode,data:payload});});
  });
  req.setTimeout(15000,()=>req.destroy(new Error('Upstream timeout')));
  req.on('error',reject);req.end(body);
 });
}

export function createBackendBridge({baseUrl='',appAccess='',publicOrigin='',secureCookies=false,request=upstreamRequest,now=Date.now}={}){
 const enabled=Boolean(baseUrl&&appAccess),sessions=new Map();
 if(baseUrl){const u=new URL(baseUrl);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw new Error('Invalid backend URL');}
 if(publicOrigin)publicOrigin=new URL(publicOrigin).origin;
 const reply=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));};
 const cookie=(value,maxAge)=>`${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureCookies?'; Secure':''}`;
 const call=(route,method,data)=>request(baseUrl,route,method,data===undefined?undefined:{...data,app_access:appAccess});
 return async(req,res)=>{
  const route=req.url.split('?')[0];if(!route.startsWith('/api/'))return false;
  try{
   for(const [key,value] of sessions)if(value.expires<=now())sessions.delete(key);
   if(route==='/api/status'&&req.method==='GET'){reply(res,200,{enabled});return true;}
   if(!enabled){reply(res,503,{message:'Backend is not configured. Ask the team to set the server environment variables.'});return true;}
   const known={'/api/schools':['GET'],'/api/login':['POST'],'/api/register':['POST'],'/api/profile':['GET','PATCH'],'/api/logout':['POST']};
   if(!known[route]){reply(res,404,{message:'Unknown API route.'});return true;}
   if(!known[route].includes(req.method)){reply(res,405,{message:'Method not allowed.'},{Allow:known[route].join(', ')});return true;}
   // Require browser mutations to originate from the same web app.
   if(!['GET','HEAD'].includes(req.method)){
    const expected=publicOrigin||`${req.socket.encrypted?'https':'http'}://${req.headers.host}`;
    if(req.headers.origin!==expected){reply(res,403,{message:'Request origin does not match this app.'});return true;}
    if(!(req.headers['content-type']||'').startsWith('application/json')){reply(res,415,{message:'JSON required.'});return true;}
   }
   let input={};
   if(!['GET','HEAD'].includes(req.method)){
    let size=0;const chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>16384){reply(res,413,{message:'Request too large.'});return true;}chunks.push(chunk);}
    try{input=JSON.parse(Buffer.concat(chunks).toString()||'{}');if(!input||typeof input!=='object'||Array.isArray(input))throw new Error();}catch{reply(res,400,{message:'Invalid JSON.'});return true;}
   }
   const id=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
   const session=sessions.get(id);
   if(['/api/profile','/api/logout'].includes(route)&&!session){reply(res,401,{message:'Please log in again.'},{'Set-Cookie':cookie('',0)});return true;}
   let result;
   if(route==='/api/schools'){
    result=await call('/Schools/','GET');
    if(result.status<300){if(!Array.isArray(result.data.Schools)||result.data.Schools.some(x=>typeof x!=='string'))throw new Error('Invalid school response');reply(res,200,{schools:result.data.Schools});return true;}
   }
   if(route==='/api/login'){
    if(typeof input.email!=='string'||typeof input.password!=='string'||!input.email.trim()||!input.password){reply(res,400,{message:'Email and password are required.'});return true;}
    result=await call('/LogIn/','POST',{email:input.email.trim(),password:input.password});
    if(result.status<300){
     if(typeof result.data.access_token!=='string'||!result.data.access_token)throw new Error('Missing token');
     const profile=await call('/Register/','GET',{access_token:result.data.access_token});
     if(profile.status>=300){reply(res,502,{message:'Login succeeded, but the backend could not load your profile. Try again.'});return true;}
     if(id)sessions.delete(id);
     const sid=randomBytes(32).toString('base64url');sessions.set(sid,{token:result.data.access_token,expires:now()+TTL});
     reply(res,200,{profile:publicProfile(profile.data)},{'Set-Cookie':cookie(sid,TTL/1000)});return true;
    }
   }
   if(route==='/api/register'||(route==='/api/profile'&&req.method==='PATCH')){
    const data={};for(const key of fields)if(typeof input[key]==='string')data[key]=input[key];
    if(session&&route==='/api/profile')data.access_token=session.token;
    result=await call('/Register/',route==='/api/register'?'POST':'PATCH',data);
    if(result.status<300){reply(res,result.status,{message:route==='/api/register'?'Account created. You can now log in.':'Account updated.'});return true;}
   }
   if(route==='/api/profile'&&req.method==='GET'){
    result=await call('/Register/','GET',{access_token:session.token});
    if(result.status<300){reply(res,200,{profile:publicProfile(result.data)});return true;}
    if([400,401,403].includes(result.status)){sessions.delete(id);reply(res,401,{message:'Your backend session has expired. Please log in again.'},{'Set-Cookie':cookie('',0)});return true;}
   }
   if(route==='/api/logout'){
    // Backend logout revokes ALL tokens for this user, including other devices.
    result=await call('/LogIn/','DELETE',{access_token:session.token});
    if(result.status<300){sessions.delete(id);reply(res,200,{message:'Logged out on the backend.'},{'Set-Cookie':cookie('',0)});return true;}
   }
   // Do not expose upstream stack traces or raw response text to clients.
   const safeMessages={400:'The backend rejected these details. Check the required fields and account credentials.',401:'The backend rejected authorization. Check your credentials or ask the backend owner to verify application access.',403:'Access denied.',409:'An account with that email already exists.',429:'Too many attempts. Please wait before trying again.'};
   reply(res,result.status>=500?502:result.status,{message:safeMessages[result.status]||'The backend request failed. Please try again.'});
  }catch{reply(res,502,{message:'Could not reach the backend or read its response. Check server configuration and connectivity.'});}
  return true;
 };
}
