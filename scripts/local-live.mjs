// Local-only production-account preview. Never deployed; no public listener or production API proxy.
import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const host='local.flightdeck.gakinz.com',origin=`https://${host}`;
const localDir=path.join(root,'.local-live');
const env=parseEnv(fs.readFileSync(path.join(root,'.env'),'utf8'));
const key=env.VITE_CLERK_PUBLISHABLE_KEY||'';
if(!key.startsWith('pk_live_'))throw Error('The existing .env must contain the Flightdeck production publishable key.');
const issuer=Buffer.from(key.slice('pk_live_'.length),'base64').toString('utf8').replace(/\$$/,'');
if(issuer!=='clerk.flightdeck.gakinz.com')throw Error('The production key must belong to Flightdeck.');
const cert=path.join(localDir,'cert.pem'),certKey=path.join(localDir,'key.pem');
if(!fs.existsSync(cert)||!fs.existsSync(certKey))throw Error('Local certificate missing. Follow docs/LOCAL-LIVE-LOGIN.md first.');
const hosts=fs.readFileSync('/etc/hosts','utf8');
if(!hosts.split('\n').some(line=>/^127\.0\.0\.1\s/.test(line)&&line.split(/\s+/).includes(host)))throw Error('The local hostname must resolve to 127.0.0.1 in /etc/hosts.');
const privateDir=path.join(localDir,'private');
fs.mkdirSync(privateDir,{recursive:true,mode:0o700});
fs.cpSync(path.join(root,'php/private/src'),path.join(privateDir,'src'),{recursive:true});
// Only the existing public production key enters the browser; no secret key is needed to verify sessions.
const dist=path.join(localDir,'dist');
for(const [command,args] of [['pnpm',['exec','tsc','--noEmit']],['pnpm',['exec','vite','build','--outDir',dist]],['node',['scripts/build-public.mjs','--dist',dist]]]){
 const build=spawnSync(command,args,{cwd:root,env:{...process.env,VITE_CLERK_PUBLISHABLE_KEY:key},stdio:'inherit'});
 if(build.status!==0)process.exit(build.status||1);
}
const php=spawn('php',['-S','127.0.0.1:3993','php/dev-router.php'],{
 cwd:root,env:{...process.env,...env,FLIGHTDECK_PRIVATE:privateDir,FLIGHTDECK_DIST:dist,CLERK_ISSUER:`https://${issuer}`,CLERK_AUTHORIZED_PARTIES:origin,FLIGHTDECK_AUTH:'on'},stdio:['ignore','ignore','pipe'],
});
// PHP errors may include request URLs. Keep them private; print only lifecycle failures.
php.stderr.on('data',()=>{});
let shuttingDown=false,proxy;
const stop=()=>{if(shuttingDown)return;shuttingDown=true;proxy?.kill('SIGTERM');php.kill();process.exit(0)};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
php.on('exit',code=>{if(!shuttingDown){console.error('Local PHP server stopped. Check whether port 3993 is already in use.');proxy?.kill();process.exit(code||1)}});
const proxyScript=path.join(root,'scripts/local-live-proxy.mjs');
function startProxy(privileged=false){
 const args=privileged?[process.execPath,proxyScript]:[proxyScript];
 proxy=spawn(privileged?'sudo':process.execPath,args,{cwd:root,stdio:'inherit'});
 proxy.on('exit',code=>{
  if(shuttingDown)return;
  if(code===77&&!privileged){
   console.log('macOS needs administrator authentication for HTTPS port 443. Only the proxy starts elevated and drops privileges after binding.');
   startProxy(true);return;
  }
  shuttingDown=true;php.kill();process.exit(code||0);
 });
}
startProxy();
