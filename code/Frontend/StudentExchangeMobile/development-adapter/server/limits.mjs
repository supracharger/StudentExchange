// Global limits deliberately ignore untrusted forwarding headers. Configure per-client
// controls at the trusted HTTPS edge as well; only one process/replica is supported.
export function createLimits({ requestsPerMinute=300, authPerMinute=20, concurrent=4 }={}) {
  let reset=Date.now()+60000,requests=0,auth=0,active=0
  return function admit(request,response,path) {
    const now=Date.now()
    if(now>=reset){reset=now+60000;requests=0;auth=0}
    const authenticating=['/api/login','/api/register'].includes(path)
    const rateExceeded=++requests>requestsPerMinute || authenticating && ++auth>authPerMinute
    if(rateExceeded || active>=concurrent) {
      response.writeHead(rateExceeded?429:503,{'Content-Type':'application/json','Cache-Control':'no-store','Retry-After':rateExceeded?String(Math.ceil((reset-now)/1000)):'5','Connection':'close'})
      response.end(JSON.stringify({message:rateExceeded?'Too many requests. Please wait.':'Adapter is busy. Please wait before trying again.'}))
      return false
    }
    active++
    let released=false
    // Keep the slot until response work finishes. A disconnected client must not
    // release a slot while its upstream write is still running.
    const end=response.end
    response.end=function(...args){if(!released){released=true;active--}return end.apply(this,args)}
    return true
  }
}
