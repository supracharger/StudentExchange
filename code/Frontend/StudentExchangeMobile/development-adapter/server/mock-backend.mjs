import http from 'node:http'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { listingFields, messageFields } from './mobile-contracts.mjs'

export const fixture = {
  id: 1, title: 'Mock calculus textbook', price: 25, category: 'Textbooks',
  condition: 'Good', location: 'Mock campus', isbn: null,
  datetime: '2026-11-14T12:00:00', status: 'Active', user: 'mock_seller', image_url: null,
}
export function createMockBackend({ appAccess = 'mock-app-only' } = {}) {
  const accounts = new Map(), tokens = new Map(), listings = new Map([[1,{...fixture,description:'Local mock response; no database.',images_url:[]}]]), conversations = new Map(), images = new Map()
  let nextListing=2,nextConversation=1,nextMessage=1
  const addAccount = profile => {
    const salt=randomBytes(16); const {password,...publicFields}=profile
    accounts.set(profile.email,{...publicFields,salt,hash:scryptSync(password,salt,32)})
  }
  addAccount({email:'demo@mock.invalid',first_name:'Demo',last_name:'Buyer',school:'Mock University',user:'mock_buyer',location:'Mock campus',password:'CampusDemo123!'})
  addAccount({email:'seller@mock.invalid',first_name:'Mock',last_name:'Seller',school:'Mock University',user:'mock_seller',location:'Mock campus',password:'CampusDemo123!'})
  function saveImage(raw) {
    const b=Buffer.from(raw.replace(/^data:[^,]+,/,''),'base64')
    const ext=b[0]===137?'png':b[0]===255?'jpg':'webp', name=randomBytes(16).toString('hex')+'.'+ext
    images.set(name,b); return '/uploads/'+name
  }
  return http.createServer(async (req,res) => {
    const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value))}
    try {
      const url=new URL(req.url,'http://mock.local'),path=url.pathname,method=req.method
      if(method==='GET'&&path.startsWith('/uploads/')) {
        const name=path.slice(9),b=images.get(name)
        if(!b)return send(404,{message:'Image not found.'})
        res.writeHead(200,{'Content-Type':name.endsWith('.png')?'image/png':name.endsWith('.jpg')?'image/jpeg':'image/webp'});return res.end(b)
      }
      const chunks=[];let size=0
      for await (const c of req) {size+=c.length;if(size>23*1024*1024)return send(413,{message:'Too large.'});chunks.push(c)}
      let data;try{data=JSON.parse(Buffer.concat(chunks).toString()||'{}')}catch{return send(400,{message:'Invalid JSON.'})}
      if(data.app_access!==appAccess)return send(401,{message:'Not authorized.'})
      if('ip'in data||'admin_token'in data||'to_user'in data)return send(400,{message:'Forwarding is forbidden.'})
      const email=tokens.get(data.access_token),account=accounts.get(email)
      const profile=()=>Object.fromEntries(['email','first_name','last_name','school','user','location'].map(k=>[k,account[k]]))
      const privateRoute=path==='/Register'&&method!=='POST'||path.startsWith('/api/Message')||path.startsWith('/Listing')&&(method!=='GET'||data.for_user!==undefined)
      if(privateRoute&&!account)return send(401,{message:'The access token expired or is invalid.'})
      if(path==='/Schools'&&method==='GET')return send(200,{schools:['Mock University'],short_names:['MU']})
      if(path==='/LogIn'&&method==='POST') {
        const a=accounts.get(data.email?.toLowerCase())
        if(!a||!timingSafeEqual(a.hash,scryptSync(data.password||'',a.salt,32)))return send(400,{message:'Email or password is incorrect.'})
        const token=randomBytes(32).toString('base64url');tokens.set(token,a.email);return send(201,{message:'Successfull Login.',access_token:token,first_name:a.first_name})
      }
      if(path==='/LogIn'&&method==='DELETE') {for(const [t,e]of tokens)if(e===email)tokens.delete(t);return send(200,{message:'Logged out.'})}
      if(path==='/Register'&&method==='POST') {
        // Mirror Register.cs before field validation; direct mock callers must agree too.
        if(data.user!=null)return send(400,{message:'User cannot be set yet.'})
        if(data.location!=null)return send(400,{message:'Location cannot be set yet.'})
        if(!['email','first_name','last_name','school','password'].every(k=>typeof data[k]==='string'&&data[k].trim()))return send(400,{message:'Complete all required fields.'})
        if(data.school!=='Mock University'||data.password.length<8||data.password.length>50||!/[A-Z]/.test(data.password)||!/[!@#$%^&*_+\-=]/.test(data.password))return send(400,{message:'Choose a school and password with uppercase and symbol.'})
        const email=data.email.trim().toLowerCase();if(accounts.has(email))return send(409,{message:'A user with that email already exists.'})
        const user='student_'+randomBytes(4).toString('hex')
        if([...accounts.values()].some(a=>a.user===user))return send(400,{message:'Username already exists.'})
        addAccount({...data,email,user,location:null});return send(201,{message:'User added.',email})
      }
      if(path==='/Register'&&method==='GET')return send(200,profile())
      if(path==='/Register'&&method==='PATCH') {
        if(data.email&&data.email!==email&&accounts.has(data.email))return send(409,{message:'Email already exists.'})
        if(data.school&&data.school!=='Mock University')return send(400,{message:'School not found.'})
        for(const k of ['email','first_name','last_name','school','user','location'])if(data[k])account[k]=data[k]
        if(data.password){account.salt=randomBytes(16);account.hash=scryptSync(data.password,account.salt,32)}
        if(account.email!==email){accounts.delete(email);accounts.set(account.email,account);for(const [t,e]of tokens)if(e===email)tokens.set(t,account.email)}
        return send(200,{message:'Profile updated.'})
      }
      if(path==='/Category'&&method==='GET')return send(200,['Textbooks','Electronics'])
      if(path==='/Condition'&&method==='GET')return send(200,['New','Good'])
      if(path==='/Listing'&&method==='GET')return send(200,[...listings.values()].filter(l=>(!data.category||l.category===data.category)&&(!data.user_page||l.user===data.user_page)&&(!data.isbn||l.isbn===data.isbn)&&(data.for_user===undefined?['Active','Sold'].includes(l.status):l.user===account.user)).map(l=>({...l,...(data.for_user!==undefined?{days:30}:{})})))
      if(path==='/Listing'&&method==='POST') {
        const fields=Object.fromEntries(Object.entries(data).filter(([k])=>!['app_access','access_token'].includes(k)));listingFields(fields,false)
        const urls=(data.imageBase64||[]).map(saveImage),id=nextListing++
        delete fields.imageBase64
        listings.set(id,{id,...fields,user:account.user,location:account.location,isbn:data.isbn||null,datetime:new Date().toISOString(),status:'Active',image_url:urls[0]||null,images_url:urls})
        return send(201,{message:'Listing created successfully!'})
      }
      if(path==='/Listing'&&method==='DELETE') {
        const l=listings.get(data.id);if(!l)return send(404,{message:'Listing not found.'})
        if(l.user!==account.user)return send(401,{message:'Not authorized.'})
        listings.delete(data.id);return send(200,{message:'Listing deleted successfully!'})
      }
      const detail=/^\/Listing\/([1-9][0-9]*)$/.exec(path)
      if(detail) {
        const l=listings.get(Number(detail[1]));if(!l)return send(400,'Listing not found.')
        if(method==='GET') {const seller=[...accounts.values()].find(a=>a.user===l.user);return send(200,{...l,first_name:seller?.first_name||'Mock',last_name:seller?.last_name||'Seller',email:seller?.email,images_url:l.images_url.length?l.images_url:null})}
        if(method==='PATCH') {
          if(l.user!==account.user)return send(400,'Listing not found.')
          const fields=Object.fromEntries(Object.entries(data).filter(([k])=>!['app_access','access_token'].includes(k)));listingFields(fields,true)
          const urls=[...l.images_url]
          if (urls.length+(fields.imgs||[]).filter(op=>op.action==='insert').length-(fields.imgs||[]).filter(op=>op.action==='delete').length>8) return send(400,{message:'Only 8 images are allowed.'})
          if ((fields.imgs||[]).some(op=>op.action!=='insert'&&op.location>=urls.length)) return send(400,{message:'Invalid image location.'})
          for(const op of fields.imgs||[]) {if(op.action==='insert')urls.push(saveImage(op.imageBase64));else if(op.action==='replace')urls[op.location]=saveImage(op.imageBase64);else urls.splice(op.location,1)}
          delete fields.imgs;Object.assign(l,fields,{images_url:urls,image_url:urls[0]||null});if(l.status==='Renew')l.status='Active'
          return send(200,'Listing Updated Successfully!')
        }
      }
      const msgRoute=/^\/api\/Message(?:\/(unread|[1-9][0-9]*))?$/.exec(path)
      if(msgRoute) {
        const mine=c=>c.buyer===account.user||c.seller===account.user
        const suffix=msgRoute[1]
        if(method==='POST'&&!suffix) {
          const fields=Object.fromEntries(Object.entries(data).filter(([k])=>!['app_access','access_token'].includes(k)));messageFields(fields)
          let c=data.conversation_id&&conversations.get(data.conversation_id)
          if(data.listing_id) {
            const l=listings.get(data.listing_id);if(!l)return send(404,{message:'Listing not found.'})
            if(l.user===account.user)return send(400,{message:'You cannot message yourself about your own listing.'})
            c=[...conversations.values()].find(c=>c.listing_id===l.id&&c.buyer===account.user)
            if(!c){c={id:nextConversation++,listing_id:l.id,buyer:account.user,seller:l.user,messages:[]};conversations.set(c.id,c)}
          }
          if(!c||!mine(c))return send(404,{message:'Conversation not found.'})
          c.messages.push({id:nextMessage++,sender:account.user,kind:data.kind||'message',text:data.text?.trim()||null,amount:data.kind==='offer'?Math.round(data.amount*100)/100:null,datetime:new Date().toISOString(),read:false})
          return send(201,{message:'Message sent.',conversation_id:c.id})
        }
        const unread=c=>c.messages.filter(m=>m.sender!==account.user&&!m.read).length
        if(method==='GET'&&!suffix)return send(200,[...conversations.values()].filter(mine).sort((a,b)=>b.messages.at(-1).id-a.messages.at(-1).id).map(c=>{const m=c.messages.at(-1);return{id:c.id,listing_id:c.listing_id,listing_title:listings.get(c.listing_id)?.title||'Listing',image_url:null,role:c.buyer===account.user?'buyer':'seller',other_name:c.buyer===account.user?c.seller:c.buyer,last_kind:m.kind,last_text:m.text?.slice(0,80)||'',last_amount:m.amount,last_datetime:m.datetime,last_from_me:m.sender===account.user,unread:unread(c)}}))
        if(method==='GET'&&suffix==='unread')return send(200,{unread:[...conversations.values()].filter(mine).reduce((n,c)=>n+unread(c),0)})
        if(method==='GET') {const c=conversations.get(Number(suffix));if(!c||!mine(c))return send(404,{message:'Conversation not found.'});const messages=c.messages.filter(m=>m.id>Number(url.searchParams.get('after')||0)).slice(0,200).map(m=>({id:m.id,mine:m.sender===account.user,kind:m.kind,text:m.text,amount:m.amount,datetime:m.datetime,read:m.read}));if(messages.length)c.messages.forEach(m=>{if(m.sender!==account.user)m.read=true});return send(200,{conversation_id:c.id,messages})}
      }
      return send(404,{message:'Mock route not found.'})
    } catch(e) {return send(e.status||500,{message:e.status?e.message:'Mock request failed.'})}
  })
}
