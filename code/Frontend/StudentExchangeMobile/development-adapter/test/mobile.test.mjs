import {test} from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import http from 'node:http'
import {createMockBackend} from '../server/mock-backend.mjs'
import {createWebsiteServer} from '../server/app.mjs'
import {listingFields,messageFields,messageResponse} from '../server/mobile-contracts.mjs'
async function listen(s){s.listen(0,'127.0.0.1');await once(s,'listening');return `http://127.0.0.1:${s.address().port}`}
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII='
test('two-user account, listing, image, message and offer lifecycle follows controller wire contracts',async t=>{
 const mock=createMockBackend({appAccess:'server-test-secret'}),wire=[]
 mock.prependListener('request',req=>{const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>wire.push({method:req.method,path:req.url,body:JSON.parse(Buffer.concat(chunks).toString()||'{}')}))})
 const backend=await listen(mock),adapter=createWebsiteServer({backend,appAccess:'server-test-secret',production:false}),base=await listen(adapter)
 t.after(()=>{adapter.closeAllConnections();adapter.close();mock.closeAllConnections();mock.close()})
 function client(){let cookie='';return async(path,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});if(r.headers.has('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const text=await r.text();assert.equal(text.includes('server-test-secret'),false);assert.equal(text.includes('access_token'),false);let value;try{value=JSON.parse(text)}catch{value=text}return{status:r.status,value,headers:r.headers}}}
 const buyer=client(),seller=client(),outsider=client(),anon=client()
 assert.equal((await anon('/api/my-listings')).status,401)
 assert.equal((await anon('/api/messages')).status,401)
 assert.equal((await anon('/api/listings','POST',{})).status,401)
 assert.equal((await anon('/api/schools')).value.schools[0],'Mock University')
 const registration={email:'student@mock.invalid',first_name:'New',last_name:'Student',password:'Testing123!',school:'Mock University'}
 assert.equal((await outsider('/api/register','POST',{...registration,app_access:'bad'})).status,400)
 // Both fields are PATCH-only. Reject before making an upstream request.
 const registrationsBefore=wire.filter(r=>r.method==='POST'&&r.path==='/Register').length
 for(const forbidden of [{user:'new_student'},{location:'Library'},{user:null},{location:null}]) {
  assert.equal((await outsider('/api/register','POST',{...registration,...forbidden})).status,400)
 }
 assert.equal(wire.filter(r=>r.method==='POST'&&r.path==='/Register').length,registrationsBefore)
 assert.equal((await outsider('/api/register','POST',registration)).status,201)
 const registered=wire.find(r=>r.method==='POST'&&r.path==='/Register')
 assert.deepEqual(Object.keys(registered.body).sort(),[...Object.keys(registration),'app_access'].sort())
 assert.equal((await outsider('/api/profile')).status,401) // Registration does not log in.
 assert.equal((await outsider('/api/register','POST',registration)).status,409)
 assert.equal((await buyer('/api/login','POST',{email:'demo@mock.invalid',password:'wrong'})).status,400)
 const login=await buyer('/api/login','POST',{email:'demo@mock.invalid',password:'CampusDemo123!'})
 assert.equal(login.status,200);assert.equal(login.value.profile.user,'mock_buyer')
 assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/)
 assert.equal((await seller('/api/login','POST',{email:'seller@mock.invalid',password:'CampusDemo123!'})).status,200)
 const newLogin=await outsider('/api/login','POST',{email:registration.email,password:registration.password})
 assert.equal(newLogin.status,200)
 assert.equal(typeof newLogin.value.profile.user,'string')
 assert.equal(newLogin.value.profile.location,null)
 const newProfile=await outsider('/api/profile','PATCH',{user:'new_student',location:'Library'})
 assert.equal(newProfile.status,200)
 assert.equal(newProfile.value.profile.user,'new_student')
 assert.equal(newProfile.value.profile.location,'Library')
 const profile=await buyer('/api/profile','PATCH',{location:'Campus library',user:'mock_buyer'})
 assert.equal(profile.value.profile.location,'Campus library')
 const fields={title:'Test headphones',price:45.5,category:'Electronics',condition:'Good',description:'Works well',imageBase64:[png]}
 assert.equal((await seller('/api/listings','POST',{...fields,admin_token:'inject'})).status,400)
 assert.equal((await seller('/api/listings','POST',fields)).status,201)
 const mine=await seller('/api/my-listings');assert.equal(mine.value.length,2)
 const listing=mine.value.find(l=>l.id!==1),id=listing.id
 assert.equal((await buyer('/api/my-listings')).value.length,0)
 const detail=await buyer('/api/listings/'+id);assert.equal(detail.value.description,'Works well');assert.equal('email'in detail.value,false)
 const name=detail.value.images_url[0].slice(9)
 const image=await fetch(base+'/api/images/'+name);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await image.arrayBuffer()),Buffer.from(png,'base64'))
 assert.equal((await buyer('/api/messages','POST',{listing_id:id,text:'  '+'x'.repeat(1000)+'  ',kind:'message'})).status,201)
 let list=await buyer('/api/messages');const conversation=list.value[0].id
 assert.equal((await seller('/api/messages/unread')).value.unread,1)
 assert.equal((await outsider('/api/messages/'+conversation)).status,404)
 const opened=await seller('/api/messages/'+conversation);assert.equal(opened.value.messages[0].mine,false)
 assert.equal((await seller('/api/messages/unread')).value.unread,0)
 assert.equal((await seller('/api/messages','POST',{conversation_id:conversation,kind:'offer',amount:40,text:'How about this?'})).status,201)
 const next=await buyer('/api/messages/'+conversation+'?after='+opened.value.messages[0].id)
 assert.equal(next.value.messages.length,1);assert.equal(next.value.messages[0].amount,40);assert.equal(next.value.messages[0].kind,'offer')
 for(const query of ['after=-1','after=1&after=2','admin_token=x','after=NaN'])assert.equal((await buyer('/api/messages/'+conversation+'?'+query)).status,400)
 assert.equal((await buyer('/api/messages','POST',{listing_id:id,kind:'offer',amount:0})).status,400)
 assert.equal((await buyer('/api/messages','POST',{listing_id:id,conversation_id:conversation,text:'bad'})).status,400)
 assert.equal((await seller('/api/listings/'+id,'PATCH',{price:40,status:'Sold'})).status,200)
 assert.equal((await seller('/api/listings/'+id)).value.status,'Sold')
 assert.equal((await buyer('/api/listings/'+id,'PATCH',{price:1})).status,400)
 assert.equal((await buyer('/api/listings/'+id,'DELETE')).status,403)
 assert.equal((await buyer('/api/profile')).status,200)
 assert.equal((await seller('/api/listings/'+id,'PATCH',{imgs:[{action:'replace',location:0,imageBase64:png}]})).status,200)
 assert.equal((await seller('/api/listings/'+id,'PATCH',{imgs:[{action:'delete',location:0}]})).status,200)
 assert.deepEqual((await seller('/api/listings/'+id)).value.images_url,[])
 assert.equal((await seller('/api/listings/'+id,'DELETE')).status,200)
 assert.equal((await seller('/api/listings/'+id)).status,400)
 // Backend logout revokes all sessions for that user, including an independently issued cookie.
 const secondBuyer=client();await secondBuyer('/api/login','POST',{email:'demo@mock.invalid',password:'CampusDemo123!'})
 assert.equal((await buyer('/api/logout','POST',{})).status,200)
 assert.equal((await buyer('/api/profile')).status,401)
 assert.equal((await secondBuyer('/api/profile')).status,401)
 assert.ok(wire.some(r=>r.method==='GET'&&r.path==='/Listing'&&r.body.for_user===''&&r.body.access_token))
 assert.ok(wire.some(r=>r.method==='DELETE'&&r.path==='/Listing'&&r.body.id===id))
 assert.ok(wire.some(r=>r.method==='POST'&&r.path==='/api/Message'&&r.body.kind==='offer'))
 assert.ok(wire.some(r=>r.method==='POST'&&r.path==='/api/Message'&&r.body.text==='x'.repeat(1000)))
 for(const r of wire.filter(r=>!r.path.startsWith('/uploads/'))){assert.equal(r.body.app_access,'server-test-secret');assert.equal('ip'in r.body,false);assert.equal('admin_token'in r.body,false)}
})
test('validation rejects malformed writes and malformed messaging responses',()=>{
 const listing={title:'Test',price:2,category:'Textbooks',condition:'Good'}
 for(const extra of [{price:-1},{price:NaN},{imageBase64:['not-base64']},{imageBase64:Array(9).fill(png)},{ip:'x'},{title:'x'.repeat(201)}])assert.throws(()=>listingFields({...listing,...extra},false))
 for(const body of [{},{listing_id:1,text:''},{listing_id:1,text:'x'.repeat(1001)},{listing_id:1,kind:'offer',amount:Infinity},{listing_id:1,kind:'offer',amount:1000001},{conversation_id:1,kind:'accept',text:'yes'},{listing_id:1,text:'x',access_token:'inject'}])assert.throws(()=>messageFields(body))
 for(const [value,kind]of [[{},'conversations'],[{unread:-1},'unread'],[{conversation_id:1,messages:[{id:1}]},'messages'],[{},'sent']])assert.throws(()=>messageResponse(value,kind))
})
test('image proxy rejects redirects, unsafe types and oversized responses',async t=>{
 const upstream=http.createServer((req,res)=>{if(req.url.includes('redirect'))res.writeHead(302,{Location:'https://example.com'}).end();else if(req.url.includes('large'))res.writeHead(200,{'Content-Type':'image/png'}).end(Buffer.alloc(2*1024*1024+1));else res.writeHead(200,{'Content-Type':'text/html'}).end('<script>bad</script>')})
 const backend=await listen(upstream),adapter=createWebsiteServer({backend,appAccess:'fixture',production:false}),base=await listen(adapter)
 t.after(()=>{adapter.closeAllConnections();adapter.close();upstream.closeAllConnections();upstream.close()})
 for(const name of ['redirect.png','large.png','unsafe.png'])assert.equal((await fetch(base+'/api/images/'+name)).status,502)
 assert.equal((await fetch(base+'/api/images/test.svg')).status,404)
 assert.equal((await fetch(base+'/api/images/a.png?url=https://example.com')).status,400)
})

test('message text limit follows trimmed controller text for messages and offers',()=>{
 for(const fields of [{kind:'message'},{kind:'offer',amount:12.5}]) {
  const body={listing_id:1,...fields,text:' \n'+ 'x'.repeat(1000)+'\t '}
  assert.equal(messageFields(body).text,'x'.repeat(1000))
  assert.throws(()=>messageFields({...body,text:' '+'x'.repeat(1001)+' '}))
  assert.throws(()=>messageFields({...body,text:123}))
 }
 assert.throws(()=>messageFields({listing_id:1,text:' \n\t '}))
 assert.equal(messageFields({listing_id:1,kind:'offer',amount:12.5}).text,undefined)
 assert.equal(messageFields({listing_id:1,kind:'offer',amount:12.5,text:'  '}).text,'')
})
test('mock registration rejects controller-forbidden fields without creating accounts',async t=>{
 const mock=createMockBackend(),base=await listen(mock)
 t.after(()=>{mock.closeAllConnections();mock.close()})
 const post=async body=>{
  const r=await fetch(base+'/Register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app_access:'mock-app-only',...body})})
  await r.text();return r.status
 }
 const fields={email:'registration@mock.invalid',first_name:'New',last_name:'Student',school:'Mock University',password:'Testing123!'}
 for(const forbidden of [{user:'student'},{user:''},{location:'Library'},{location:''}]) assert.equal(await post({...fields,...forbidden}),400)
 assert.equal(await post(fields),201)
})
