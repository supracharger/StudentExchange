import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter, once } from 'node:events'
import http from 'node:http'
import https from 'node:https'
import { BACKEND_ORIGIN, destinationFor, validateBackend } from '../server/backend-policy.mjs'
import { loadDeploymentConfig } from '../server/deployment-config.mjs'
import { createWebsiteServer } from '../server/app.mjs'
import { createApplicationClient, upstream } from '../server/api.mjs'
import { imageResponse } from '../server/images.mjs'

const env={NODE_ENV:'production',SE_APP_ACCESS:'server-only-test-value',SE_BACKEND_URL:BACKEND_ORIGIN+'/',SE_PUBLIC_ORIGIN:'https://adapter.example.invalid',WEB_CONCURRENCY:'1'}
const enabled=Object.freeze({mode:'deployed',enabled:true})
async function listen(s){s.listen(0,'127.0.0.1');await once(s,'listening');return `http://127.0.0.1:${s.address().port}`}
// Native http preserves a test Host header; Node fetch intentionally substitutes its own.
function requestLocal(url, {method='GET',headers={},body}={}) {
 return new Promise((resolve,reject)=>{
  const req=http.request(url,{method,headers},res=>{
   const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));res.on('error',reject)
  });req.on('error',reject);req.end(body)
 })
}
function fakeHttps(t, handler) {
 t.mock.method(https,'request',(url,options,callback)=>{
  const req=new EventEmitter()
  req.end=body=>{const result=handler(url,options,body);queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=result.status??200;callback(res);res.emit('data',Buffer.from(JSON.stringify(result.body)));res.emit('end')})}
  return req
 })
}
test('deployment configuration is fail-closed and accepts only the specified backend',()=>{
 const config=loadDeploymentConfig(env)
 assert.equal(config.trafficPolicy.enabled,false);assert.equal(config.publicOrigin,env.SE_PUBLIC_ORIGIN)
 assert.equal(config.limits.concurrent,4)
 for(const overrides of [{NODE_ENV:'development'},{NODE_TLS_REJECT_UNAUTHORIZED:'0'},{SE_PUBLIC_ORIGIN:'https://adapter.example.invalid:444'},{SE_APP_ACCESS:''},{SE_APP_ACCESS:'mock-app-only'},{SE_BACKEND_URL:'http://127.0.0.1/'},{SE_BACKEND_URL:BACKEND_ORIGIN+'/Listing'},{SE_BACKEND_URL:BACKEND_ORIGIN+'.evil.test/'},{SE_PUBLIC_ORIGIN:'http://adapter.example.invalid'},{SE_PUBLIC_ORIGIN:BACKEND_ORIGIN},{SE_PUBLIC_ORIGIN:'https://user:secret@adapter.example.invalid/'},{WEB_CONCURRENCY:'2'},{SE_ENABLE_BACKEND_TRAFFIC:'yes'},{SE_SESSION_STORE:'redis'},{PORT:'70000'},{SE_MAX_CONCURRENT_REQUESTS:'0'}])assert.throws(()=>loadDeploymentConfig({...env,...overrides}))
 assert.throws(()=>validateBackend(BACKEND_ORIGIN+'/'),/mock backend/)
 const base=validateBackend(BACKEND_ORIGIN+'/',enabled)
 for(const route of ['https://example.com/Listing','//example.com/Listing','Admin','../../Admin','Listing?ip=1','api/Message/1?after=1&ip=x','uploads/bad.svg'])assert.throws(()=>destinationFor(base,route,enabled))
 assert.equal(destinationFor(base,'api/Message/2?after=3',enabled).pathname,'/api/Message/2')
})
test('disabled deployment never opens an upstream connection, including images',async t=>{
 let opened=0
 t.mock.method(https,'request',()=>{opened++;throw new Error('Network must not open')})
 t.mock.method(https,'get',()=>{opened++;throw new Error('Network must not open')})
 const config=loadDeploymentConfig(env),base=validateBackend(config.backend,config.trafficPolicy)
 assert.throws(()=>upstream(base,'Category','GET',{app_access:env.SE_APP_ACCESS},1000,config.trafficPolicy),/disabled/)
 await assert.rejects(imageResponse(base,'fixture.png',{},config.trafficPolicy),/disabled/)
 const server=createWebsiteServer(config),local=await listen(server)
 t.after(()=>{server.closeAllConnections();server.close()})
 const headers={Host:'adapter.example.invalid',Origin:env.SE_PUBLIC_ORIGIN}
 assert.equal((await requestLocal(local+'/api/categories',{headers})).status,503)
 assert.equal((await requestLocal(local+'/api/categories',{headers:{Host:'adapter.example.invalid'}})).status,403)
 assert.equal((await requestLocal(local+'/api/images/fixture.png',{headers})).status,503)
 assert.equal((await requestLocal(local+'/api/login',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({email:'a@mock.invalid',password:'sample'})})).status,503)
 assert.equal((await requestLocal(local+'/api/admin',{headers})).status,404)
 assert.equal((await requestLocal(local+'/',{headers})).status,404)
 assert.equal((await requestLocal(local+'/api/categories',{headers:{'X-Forwarded-Host':'adapter.example.invalid'}})).status,421)
 const health=await (await requestLocal(local+'/healthz')).json();assert.equal(health.backendTrafficEnabled,false)
 assert.equal(JSON.stringify(health).includes(env.SE_APP_ACCESS),false)
 assert.equal(opened,0)
})
test('HTTPS wire contract, canonical Origin and Secure opaque sessions work without real networking',async t=>{
 const calls=[]
 fakeHttps(t,(url,options,body)=>{
  const data=JSON.parse(body);calls.push({url:url.href,method:options.method,data})
  assert.equal(url.origin,BACKEND_ORIGIN);assert.notEqual(options.agent.options.rejectUnauthorized,false) // TLS verification is never disabled.
  if(url.pathname==='/LogIn')return {status:201,body:{access_token:'private-user-token'}}
  if(url.pathname==='/Register')return {body:{email:'test@mock.invalid',first_name:'Test',last_name:'Student',school:'Mock school',user:'test_student',location:null}}
  if(url.pathname==='/api/Message')return {body:[]}
  return {body:['Textbooks']}
 })
 const server=createWebsiteServer(loadDeploymentConfig({...env,SE_ENABLE_BACKEND_TRAFFIC:'true'})),local=await listen(server)
 t.after(()=>{server.closeAllConnections();server.close()})
 const headers={Host:'adapter.example.invalid',Origin:env.SE_PUBLIC_ORIGIN,'Content-Type':'application/json'}
 const forbidden=await requestLocal(local+'/api/login',{method:'POST',headers:{...headers,Origin:'https://evil.invalid'},body:'{}'});assert.equal(forbidden.status,403);assert.equal(calls.length,0)
 const result=await requestLocal(local+'/api/login',{method:'POST',headers,body:JSON.stringify({email:'test@mock.invalid',password:'sample-password'})})
 assert.equal(result.status,200)
 const cookie=result.headers.get('set-cookie');assert.match(cookie,/HttpOnly; SameSite=Lax; Max-Age=43200; Secure/)
 const text=await result.text();assert.equal(text.includes('private-user-token'),false);assert.equal(text.includes(env.SE_APP_ACCESS),false)
 assert.equal((await requestLocal(local+'/api/messages',{headers:{...headers,Cookie:cookie.split(';')[0]}})).status,200)
 assert.equal(calls[1].method,'GET');assert.equal(calls[1].data.access_token,'private-user-token')
 for(const call of calls){assert.equal(call.data.app_access,env.SE_APP_ACCESS);assert.equal('ip'in call.data,false);assert.equal('admin_token'in call.data,false)}
 assert.match(result.headers.get('strict-transport-security'),/max-age/)
})
test('enabled HTTPS transport rejects redirects without forwarding credentials',async t=>{
 let calls=0;fakeHttps(t,()=>{calls++;return {status:302,body:{}}})
 const client=createApplicationClient({backend:BACKEND_ORIGIN+'/',appAccess:'fixture-secret',trafficPolicy:enabled})
 await assert.rejects(client.call('Category','GET'),/temporarily unavailable/)
 assert.equal(calls,1)
})
test('deployed global rate limits also cover anonymous requests',async t=>{
 const server=createWebsiteServer({...loadDeploymentConfig(env),limits:{requestsPerMinute:1,authPerMinute:1,concurrent:1}}),local=await listen(server)
 t.after(()=>{server.closeAllConnections();server.close()})
 const headers={Host:'adapter.example.invalid',Origin:env.SE_PUBLIC_ORIGIN}
 assert.equal((await requestLocal(local+'/api/categories',{headers})).status,503)
 const limited=await requestLocal(local+'/api/categories',{headers});assert.equal(limited.status,429);assert.ok(limited.headers.get('retry-after'))
 assert.equal((await requestLocal(local+'/healthz')).status,200)
})

test('HTTPS image proxy validates bytes and never includes application/user credentials',async t=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=','base64')
 t.mock.method(https,'get',(url,options,callback)=>{
  assert.equal(url.href,BACKEND_ORIGIN+'/uploads/fixture.png');assert.equal(options.headers,undefined)
  assert.notEqual(options.agent.options.rejectUnauthorized,false)
  const req=new EventEmitter();queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=200;res.headers={'content-type':'image/png'};callback(res);res.emit('data',png);res.emit('end')});return req
 })
 let received,status
 await imageResponse(new URL(BACKEND_ORIGIN+'/'),'fixture.png',{writeHead:s=>{status=s},end:b=>{received=b}},enabled)
 assert.equal(status,200);assert.deepEqual(received,png)
})
test('concurrency limits bound in-flight backend work and release the slot on completion',{timeout:5000},async t=>{
 const started=new EventEmitter();let finish
 t.mock.method(https,'request',(url,options,callback)=>{
  const req=new EventEmitter();req.end=()=>{finish=()=>{const res=new EventEmitter();res.statusCode=200;callback(res);res.emit('data',Buffer.from('["Textbooks"]'));res.emit('end')};started.emit('started')};return req
 })
 const server=createWebsiteServer({...loadDeploymentConfig({...env,SE_ENABLE_BACKEND_TRAFFIC:'true'}),limits:{requestsPerMinute:10,authPerMinute:5,concurrent:1}}),local=await listen(server)
 t.after(()=>{server.closeAllConnections();server.close()})
 const headers={Host:'adapter.example.invalid',Origin:env.SE_PUBLIC_ORIGIN},waiting=once(started,'started')
 const first=requestLocal(local+'/api/categories',{headers});await waiting
 assert.equal((await requestLocal(local+'/api/categories',{headers})).status,503)
 finish();assert.equal((await first).status,200)
 const nextStarted=once(started,'started'),next=requestLocal(local+'/api/categories',{headers});await nextStarted;finish();assert.equal((await next).status,200)
})
