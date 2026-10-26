/* Build a portable, credential-free project snapshot for local review. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const audit=JSON.parse(fs.readFileSync(path.join(root,'docs/qa/scene-art/assets.json'),'utf8'));
if(audit.passed!==true)throw Error('Finish and approve every scene image before packaging');
const browserReportFile=path.join(root,'docs/qa/scene-art/report.json');
if(!fs.existsSync(browserReportFile))throw Error('Run the strict scene-art browser acceptance before packaging');
const browserReport=JSON.parse(fs.readFileSync(browserReportFile,'utf8'));
if(browserReport.passed!==true||browserReport.fullAssetAcceptance!==true||browserReport.mode!=='strict')throw Error('Packaging requires a passed strict scene-art browser report with fullAssetAcceptance: true');
const publicationFile=path.join(root,'docs/qa/scene-art/publication.json');
const publication=fs.existsSync(publicationFile)?JSON.parse(fs.readFileSync(publicationFile,'utf8')):null;
let publicationNote='未记录完整游戏发布成功；本地验收通过不代表线上版本已更新。';
if(publication){
 if(publication.scope==='full_game'&&publication.status==='succeeded'){
  publicationNote='发布记录确认完整游戏发布成功（scope: full_game，status: succeeded）。';
  if(typeof publication.url==='string'&&publication.url.trim())publicationNote+='\n记录中的发布地址：'+publication.url;
  publicationNote+='\nGitHub推送：'+(publication.github_push==='succeeded'?'发布记录确认成功。':'发布记录未确认成功。');
 }else publicationNote='发布记录范围：'+(publication.scope||'未注明')+'；状态：'+(publication.status||'未注明')+'。\n尚无 scope: full_game 且 status: succeeded 的完整游戏发布记录，请勿据此认为线上完整游戏已更新。';
}
const out=path.resolve(process.argv[2]||path.join(root,'..','artifacts','road-to-56-soviet-v1.11.0'));
if(out===root||root.startsWith(out+path.sep)||out.startsWith(root+path.sep))throw Error('Use a separate artifact directory');
fs.mkdirSync(out,{recursive:true});
for(const name of fs.readdirSync(root))if(/\.(html|css|js|svg)$/.test(name)||['README.md','package.json','package-lock.json','dev-server.cjs'].includes(name))fs.copyFileSync(path.join(root,name),path.join(out,name));
for(const name of ['assets','tests','scripts','.github'])fs.cpSync(path.join(root,name),path.join(out,name),{recursive:true});
fs.mkdirSync(path.join(out,'docs'),{recursive:true});
for(const name of fs.readdirSync(path.join(root,'docs')))if(name.endsWith('.md'))fs.copyFileSync(path.join(root,'docs',name),path.join(out,'docs',name));
fs.cpSync(path.join(root,'docs','scene-art'),path.join(out,'docs','scene-art'),{recursive:true});
fs.cpSync(path.join(root,'docs/qa/scene-art'),path.join(out,'docs/qa/scene-art'),{recursive:true});
fs.writeFileSync(path.join(out,'REVIEW.txt'),'56之路：苏维埃 v1.11.0\n\n本包包含完整游戏、全部专属场景图、图像目录和浏览器验收报告，无需账号或凭据即可本机游玩。\n解压后可直接打开 index.html；推荐安装 Node.js 20 或更新版本，在包目录运行 node dev-server.cjs，并访问 http://localhost:4173。运行游戏无需安装依赖。\n图像目录：docs/scene-art/catalog.html。\n\n素材验收：docs/qa/scene-art/assets.json（passed: true）。\n浏览器验收：docs/qa/scene-art/report.json（mode: strict，passed: true，fullAssetAcceptance: true）。\n\n'+publicationNote+'\n发布记录：docs/qa/scene-art/publication.json（如有）。\n\n复查：npm test；npm run audit:scene-art；npm run test:browser:scene-art。浏览器复查需先运行 npm ci 和 npx playwright install chromium。\n');
console.log(out);
