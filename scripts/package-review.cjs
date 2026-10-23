/* Build a portable, credential-free project snapshot for local review. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const audit=JSON.parse(fs.readFileSync(path.join(root,'docs/qa/scene-art/assets.json'),'utf8'));
if(!audit.passed)throw Error('Finish and approve every scene image before packaging');
const out=path.resolve(process.argv[2]||path.join(root,'..','artifacts','road-to-56-soviet-v1.11.0'));
if(out===root||root.startsWith(out+path.sep)||out.startsWith(root+path.sep))throw Error('Use a separate artifact directory');
fs.mkdirSync(out,{recursive:true});
for(const name of fs.readdirSync(root))if(/\.(html|css|js|svg)$/.test(name)||['README.md','package.json','package-lock.json','dev-server.cjs'].includes(name))fs.copyFileSync(path.join(root,name),path.join(out,name));
for(const name of ['assets','tests','scripts','.github'])fs.cpSync(path.join(root,name),path.join(out,name),{recursive:true});
fs.mkdirSync(path.join(out,'docs'),{recursive:true});
for(const name of fs.readdirSync(path.join(root,'docs')))if(name.endsWith('.md'))fs.copyFileSync(path.join(root,'docs',name),path.join(out,'docs',name));
fs.cpSync(path.join(root,'docs','scene-art'),path.join(out,'docs','scene-art'),{recursive:true});
fs.cpSync(path.join(root,'docs/qa/scene-art'),path.join(out,'docs/qa/scene-art'),{recursive:true});
fs.writeFileSync(path.join(out,'REVIEW.txt'),'56之路：苏维埃 v1.11.0\n\n解压后可打开 index.html 查看；推荐在本机运行 node dev-server.cjs 并访问 http://localhost:4173。\n图像目录：docs/scene-art/catalog.html。\n\n当前包为本地待发布版本。逻辑与场景绑定检查通过；浏览器验收及GitHub/GPT网页发布受当前环境限制尚未执行，请勿据此认为线上版本已更新。\n\n检查：npm test；npm run audit:scene-art；npm run test:browser:scene-art（需安装依赖和Chromium）。\n');
console.log(out);
