const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'preview/template.html'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'src/auth.cjs'), 'utf8');
if (!template.includes('/* AUTH_SOURCE */')) throw new Error('Missing auth placeholder');
fs.writeFileSync(path.join(root, 'preview/index.html'), template.replace('/* AUTH_SOURCE */', auth));
console.log('Built preview/index.html');
