import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const path=root+'.env';
if(existsSync(path)) {console.log('.env already exists; existing configuration was preserved.');process.exit(0);}
let text=readFileSync(root+'.env.example','utf8');
text=text.replace('AUDIT_HMAC_KEY=GENERATE_WITH_NPM_RUN_SETUP','AUDIT_HMAC_KEY='+randomBytes(48).toString('hex'));
for(const role of ['NURSE','PHARMACIST','AUDITOR']) text=text.replace(`DEMO_${role}_PASSWORD=GENERATE_WITH_NPM_RUN_SETUP`,`DEMO_${role}_PASSWORD=Demo-${randomBytes(9).toString('base64url')}!`);
writeFileSync(path,text,{mode:0o600});
console.log('Created .env with fresh secrets. Find demo passwords in .env. Usernames: nurse, pharmacist, auditor.');
