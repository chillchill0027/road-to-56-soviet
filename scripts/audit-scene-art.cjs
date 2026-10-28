/* Verify authored bindings, native image sizes and provenance before publication. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function webpSize(buf){
 if(buf.toString('ascii',0,4)!=='RIFF'||buf.toString('ascii',8,12)!=='WEBP')throw Error('Invalid WebP container');
 for(let off=12;off+8<=buf.length;){const kind=buf.toString('ascii',off,off+4),len=buf.readUInt32LE(off+4),p=off+8;
  if(kind==='VP8X')return[buf.readUIntLE(p+4,3)+1,buf.readUIntLE(p+7,3)+1];
  if(kind==='VP8 ')return[buf.readUInt16LE(p+6)&0x3fff,buf.readUInt16LE(p+8)&0x3fff];
  if(kind==='VP8L')return[1+buf[p+1]+((buf[p+2]&63)<<8),1+(buf[p+2]>>6)+(buf[p+3]<<2)+((buf[p+4]&15)<<10)];
  off=p+len+(len&1);
 }throw Error('No WebP dimensions');
}
function audit(partial=false){
 const inventory=JSON.parse(fs.readFileSync(path.join(root,'docs/scene-art/inventory.json'),'utf8'));
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,'scene-art-manifest.js'),'utf8')+';globalThis.images=SCENE_ART_MANIFEST;',ctx);
 const manifest=ctx.images,expected=[...inventory.scenes,...inventory.existing],errors=[],missing=[],reviewIssues=[],cells=new Set(),files=new Map(),hashes=new Map(),sources=new Set();
 for(const entry of expected){
  const image=manifest[entry.sceneKey];if(!image){errors.push('Unbound scene '+entry.sceneKey);continue;}
  const cell=image.file+'#'+image.cell;if(cells.has(cell))errors.push('Reused picture '+cell);cells.add(cell);
  if(!/^assets\/images\/(?:[\w-]+\/)*[\w-]+\.webp$/.test(image.file)){errors.push('Invalid source '+entry.sceneKey);continue;}
  if(!Number.isInteger(image.cell)||image.cell<0||image.cell>=image.cols*image.rows)errors.push('Invalid cell '+entry.sceneKey);
  if(!image.caption)errors.push('Missing caption '+entry.sceneKey);
  if(files.has(image.file))continue;
  const full=path.join(root,image.file);if(!fs.existsSync(full)){missing.push(image.file);files.set(image.file,null);continue;}
  const bytes=fs.readFileSync(full),[width,height]=webpSize(bytes),hash=crypto.createHash('sha256').update(bytes).digest('hex');
  if(hashes.has(hash))errors.push('Identical image files '+image.file+' and '+hashes.get(hash));hashes.set(hash,image.file);
  if(image.file.startsWith('assets/images/scenes/')){
   if(width<1536||Math.abs(width/height-1.5)>.003)errors.push('Wrong native scene atlas dimensions '+image.file+': '+width+'x'+height);
   const id=Number(/batch-(\d+)/.exec(image.file)[1]),provenanceFile=path.join(root,'docs/scene-art/batch-'+String(id).padStart(3,'0')+'.json');
   if(!fs.existsSync(provenanceFile))errors.push('Missing provenance '+image.file);
   else{const p=JSON.parse(fs.readFileSync(provenanceFile,'utf8'));if(p.batch!==id||p.file!==image.file||p.approved!==true)errors.push('Unreviewed or mismatched provenance '+image.file);if(sources.has(p.path))errors.push('Reused generated original '+p.path);sources.add(p.path);for(const issue of p.reviewIssues||[])if(issue.status==='open')reviewIssues.push({file:image.file,...issue});}
  }
  files.set(image.file,{file:image.file,width,height,bytes:bytes.length,sha256:hash});
 }
 if(Object.keys(manifest).length!==expected.length)errors.push('Manifest includes an unexpected or missing key');
 const total=expected.length,ready=expected.filter(e=>manifest[e.sceneKey]&&files.get(manifest[e.sceneKey].file)).length;
 const report={passed:errors.length===0&&missing.length===0&&reviewIssues.length===0,scenes:total,ready,approvedScenes:ready-reviewIssues.length,reviewIssues,uniquePictures:cells.size,sourceFiles:files.size,newScenePhotographs:inventory.scenes.length,newAtlases:sources.size,bytes:[...files.values()].reduce((n,f)=>n+(f?.bytes||0),0),errors,missing,assets:[...files.values()].filter(Boolean)};
 fs.mkdirSync(path.join(root,'docs/qa/scene-art'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/scene-art/assets.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,scenes:total,ready,approvedScenes:report.approvedScenes,reviewPending:reviewIssues.length,newAtlases:sources.size,errors,missingFiles:missing.length,bytes:report.bytes}));
 if(errors.length||!partial&&(missing.length||reviewIssues.length))process.exitCode=1;
 return report;
}
if(require.main===module)audit(process.argv.includes('--partial'));
module.exports={audit,webpSize};
