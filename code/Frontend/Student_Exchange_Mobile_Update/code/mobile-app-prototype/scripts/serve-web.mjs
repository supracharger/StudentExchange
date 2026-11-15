import http from 'node:http';
import {createBackendBridge} from './backend-bridge.mjs';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../web/dist/',import.meta.url));
const args=process.argv.slice(2);
function option(flag,fallback){const at=args.indexOf(flag);if(at===-1)return fallback;if(!args[at+1])throw new Error(`Missing value for ${flag}`);return args[at+1];}
const host=option('--host',process.env.HOST||'127.0.0.1'),port=Number(option('--port',process.env.PORT||'8080'));
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Port must be an integer from 0 to 65535.');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json; charset=utf-8'};
const bridge=createBackendBridge({baseUrl:process.env.STUDENT_EXCHANGE_BACKEND_URL,appAccess:process.env.STUDENT_EXCHANGE_APP_ACCESS,publicOrigin:process.env.STUDENT_EXCHANGE_PUBLIC_ORIGIN,secureCookies:process.env.STUDENT_EXCHANGE_SECURE_COOKIES==='true'});
const server=http.createServer(async(req,res)=>{
 if(await bridge(req,res))return;
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end('Bad request');return;}
 if(pathname.includes('\\')||pathname.includes('\0')){res.writeHead(400);res.end('Bad request');return;}
 const target=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
 if(!target.startsWith(root)){res.writeHead(403);res.end('Forbidden');return;}
 try{
  const info=await stat(target);if(!info.isFile())throw new Error('Not a file');
  const body=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');}
});
server.on('error',err=>{console.error(err.message);process.exitCode=1;});
server.listen(port,host,()=>console.log(`Student Exchange web prototype: http://${host}:${server.address().port}/`));
