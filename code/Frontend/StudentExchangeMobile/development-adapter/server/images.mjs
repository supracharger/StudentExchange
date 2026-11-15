import http from 'node:http'
import https from 'node:https'
import { MOCK_POLICY, destinationFor } from './backend-policy.mjs'
import { invalid } from './mobile-contracts.mjs'

export async function imageResponse(base, name, response, trafficPolicy = MOCK_POLICY, timeoutMs = 10000) {
  if (!/^[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(name)) invalid('Invalid image name.')
  const destination = destinationFor(base, 'uploads/'+name, trafficPolicy)
  const image = await new Promise((resolve,reject) => {
    const transport = destination.protocol === 'https:' ? https : http
    const req = transport.get(destination, {agent: destination.protocol === 'https:' ? new https.Agent({keepAlive:false}) : new http.Agent({keepAlive:false}), signal:AbortSignal.timeout(timeoutMs)}, res => {
      const chunks=[]; let size=0
      res.on('data', chunk => { size+=chunk.length; if(size>2*1024*1024) req.destroy(new Error('Image too large')); else chunks.push(chunk) })
      res.on('error',reject)
      res.on('end',()=>resolve({status:res.statusCode,type:res.headers['content-type']?.split(';')[0],bytes:Buffer.concat(chunks)}))
    })
    req.on('error',reject)
  }).catch(()=>invalid('Image service unavailable.',502))
  if(image.status === 404) invalid('Image not found.',404)
  const b=image.bytes
  const type = b.subarray(0,4).equals(Buffer.from([137,80,78,71])) ? 'image/png' : b[0]===255&&b[1]===216&&b[2]===255 ? 'image/jpeg' : b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP' ? 'image/webp' : null
  if(image.status!==200 || !type || image.type!==type) invalid('Invalid image response.',502)
  response.writeHead(200,{'Content-Type':type,'Content-Length':b.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
  response.end(b)
}
