import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createBackendBridge} from '../scripts/backend-bridge.mjs';

async function fixture(t,{configured=true,override,clock}={}){
 const calls=[];
 const upstream=http.createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk;
  const data=body?JSON.parse(body):undefined;calls.push({path:req.url,method:req.method,data});
  let status=200,result;
  if(override){const custom=override(req,data);if(custom){status=custom.status;result=custom.data;}}
  if(result===undefined){
   if(req.url==='/Schools/')result={Schools:['CU Denver','MSU Denver']};
   else if(data?.app_access!=='test-only-application-secret'){status=401;result={Message:'Not authorized.'};}
   else if(req.url==='/LogIn/'&&req.method==='POST'){
    if(data.password==='Wrong'){status=400;result={Message:'Invalid Email or Password.'};}
    else{status=201;result={access_token:'upstream-private-token',first_name:'Taylor'};}
   }else if(req.url==='/Register/'&&req.method==='GET')result={email:'taylor@example.test',first_name:'Taylor',last_name:'Student',school:'CU Denver',password:'must-not-leak'};
   else if(req.url==='/Register/'&&req.method==='POST'){status=201;result={Message:'User added.'};}
   else result={Message:'Success.'};
  }
  res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
 });
 await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
 const bridge=createBackendBridge({baseUrl:configured?`http://127.0.0.1:${upstream.address().port}`:'',appAccess:configured?'test-only-application-secret':'',...(clock?{now:clock}:{})});
 const server=http.createServer(async(req,res)=>{if(!await bridge(req,res)){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>upstream.close(r))]);});
 const origin=`http://127.0.0.1:${server.address().port}`;
 async function send(path,method='GET',body,cookie,extra={}){
  const response=await fetch(origin+'/api/'+path,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
 }
 async function login(){const r=await send('login','POST',{email:'taylor@example.test',password:'TestOnly!23',app_access:'attacker-value'});assert.equal(r.status,200);return r;}
 return {send,login,calls};
}

test('unconfigured bridge preserves demo use without claiming a live connection',async t=>{
 const f=await fixture(t,{configured:false});assert.deepEqual((await f.send('status')).data,{enabled:false});assert.equal((await f.send('login','POST',{})).status,503);assert.equal(f.calls.length,0);
});
test('school response maps the backend capitalized Schools key',async t=>{
 const f=await fixture(t);assert.deepEqual((await f.send('schools')).data.schools,['CU Denver','MSU Denver']);assert.equal(f.calls[0].data,undefined);
});
test('login hides secrets, rotates local sessions and loads profile with a GET body',async t=>{
 const f=await fixture(t),r=await f.login();
 assert.deepEqual(r.data.profile,{email:'taylor@example.test',first_name:'Taylor',last_name:'Student',school:'CU Denver'});
 assert.match(r.cookie,/HttpOnly/);assert.match(r.cookie,/SameSite=Strict/);
 assert.ok(!JSON.stringify(r).includes('upstream-private-token'));assert.ok(!JSON.stringify(r).includes('test-only-application-secret'));assert.ok(!JSON.stringify(r).includes('must-not-leak'));
 assert.equal(f.calls[0].data.app_access,'test-only-application-secret');assert.equal(f.calls[1].method,'GET');assert.equal(f.calls[1].data.access_token,'upstream-private-token');
 const old=r.cookie.split(';')[0],fresh=await f.send('login','POST',{email:'taylor@example.test',password:'TestOnly!23'},old);
 assert.notEqual(fresh.cookie,r.cookie);assert.equal((await f.send('profile','GET',undefined,old)).status,401);
});
test('profile requires a server session and PATCH only forwards permitted fields',async t=>{
 const f=await fixture(t);assert.equal((await f.send('profile')).status,401);
 const cookie=(await f.login()).cookie.split(';')[0];assert.equal((await f.send('profile','GET',undefined,cookie)).status,200);
 assert.equal((await f.send('profile','PATCH',{first_name:'New',access_token:'forged',extra:'ignored'},cookie)).status,200);
 assert.deepEqual(f.calls.at(-1).data,{first_name:'New',access_token:'upstream-private-token',app_access:'test-only-application-secret'});
});
test('registration uses POST Register without creating a session',async t=>{
 const f=await fixture(t);const r=await f.send('register','POST',{email:'new@example.test',first_name:'New',last_name:'Student',school:'CU Denver',password:'TestOnly!23'});
 assert.equal(r.status,201);assert.equal(r.cookie,null);assert.equal(f.calls[0].path,'/Register/');assert.equal((await f.send('profile')).status,401);
});
test('logout calls upstream DELETE then clears local session',async t=>{
 const f=await fixture(t),cookie=(await f.login()).cookie.split(';')[0];
 const r=await f.send('logout','POST',{},cookie);assert.equal(r.status,200);assert.match(r.cookie,/Max-Age=0/);assert.equal(f.calls.at(-1).method,'DELETE');assert.equal(f.calls.at(-1).path,'/LogIn/');assert.equal((await f.send('profile','GET',undefined,cookie)).status,401);
});
test('rejects foreign origins, unsupported methods and unknown endpoints',async t=>{
 const f=await fixture(t);assert.equal((await f.send('login','POST',{},undefined,{Origin:'https://other.example'})).status,403);assert.equal((await f.send('login')).status,405);assert.equal((await f.send('anything','POST',{})).status,404);assert.equal(f.calls.length,0);
});
test('failed login never creates a session; upstream server errors are redacted',async t=>{
 const f=await fixture(t);const r=await f.send('login','POST',{email:'taylor@example.test',password:'Wrong'});assert.equal(r.status,400);assert.equal(r.cookie,null);
 const g=await fixture(t,{override:()=>({status:500,data:{Message:'stacktrace test-only-application-secret'}})});const failure=await g.send('schools');assert.equal(failure.status,502);assert.ok(!JSON.stringify(failure.data).includes('stacktrace'));
});
test('expired local sessions are rejected without contacting upstream',async t=>{
 let time=0;const f=await fixture(t,{clock:()=>time}),cookie=(await f.login()).cookie.split(';')[0];const count=f.calls.length;
 time=9*60*60*1000;assert.equal((await f.send('profile','GET',undefined,cookie)).status,401);assert.equal(f.calls.length,count);
});
test('expired backend token clears the local session',async t=>{
 let fail=false;const f=await fixture(t,{override:req=>fail&&req.method==='GET'&&req.url==='/Register/'?{status:400,data:{Message:'The Access Token may have expired.'}}:null});
 const cookie=(await f.login()).cookie.split(';')[0];fail=true;const r=await f.send('profile','GET',undefined,cookie);assert.equal(r.status,401);assert.match(r.cookie,/Max-Age=0/);
});
