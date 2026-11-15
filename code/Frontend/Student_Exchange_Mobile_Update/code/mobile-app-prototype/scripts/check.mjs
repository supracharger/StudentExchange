import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=['scripts/backend-bridge.mjs','web/dist/connected-account.mjs','tests/backend-bridge.test.mjs','web/dist/app.mjs','web/dist/model.mjs','web/dist/art.mjs','web/model.test.mjs','mobile/src/auth.cjs','mobile/tests/auth.test.cjs','mobile/scripts/build-preview.cjs','scripts/serve-web.mjs'];
for(const file of files){const r=spawnSync(process.execPath,['--check',path.join(root,file)],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
for(const f of ['package.json','mobile/package.json','mobile/app.json','web/dist/manifest.webmanifest'])JSON.parse(await readFile(path.join(root,f),'utf8'));
const html=await readFile(path.join(root,'web/dist/index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g))await readFile(path.resolve(root,'web/dist',match[1]));
if(/(?:src|href)="\//.test(html))throw new Error('Root-relative asset reference prevents subfolder hosting');
const manifest=JSON.parse(await readFile(path.join(root,'web/dist/manifest.webmanifest'),'utf8'));
if(manifest.start_url!=='./'||manifest.id!=='./')throw new Error('Manifest must support subfolder hosting');
console.log('PASS: JavaScript syntax, JSON, local assets, and subfolder paths. Native JSX bundling requires Expo dependencies.');
