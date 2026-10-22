const test=require('node:test'),assert=require('node:assert/strict');
const {runtime}=require('./helpers/runtime.cjs');
const {replay}=require('./helpers/routes.cjs');
const fixtures=require('./fixtures/routes.json').routes;
function finished(){return replay(fixtures[0],{statistics:true,endings:true});}
test('every completed route stores its own factual final ledger and a matching outcome illustration',()=>{
 for(const fixture of fixtures){
  const r=replay(fixture,{statistics:true,endings:true}),{game:g}=r;
  const records=g.archive.all();assert.equal(records.length,1);
  const run=records[0];assert.equal(run.endingId,fixture.ending);assert.ok(g.archive.validRun(run));
  assert.equal(run.statistics.years.length,21);assert.equal(run.statistics.pending.length,0);
  for(const k of g.statistics.keys)assert.equal(run.final[k],g.state()[k]);
  const saved=JSON.stringify(run),before=JSON.stringify(g.state());
  g.renderEnding();assert.equal(g.archive.all().length,1,'repeated ending render never duplicates a playthrough');
  assert.equal(JSON.stringify(g.archive.all()[0]),saved);
  assert.equal(JSON.stringify(g.state()),before,'archiving does not change game state');
  assert.match(g.archive.imageHTML(fixture.ending),/ending-.*-sheet.webp/);
  assert.doesNotMatch(g.archive.imageHTML(fixture.ending),/eternal-flame/);
 }
});
test('restarting and later runs do not overwrite completed data; imports merge without duplication',()=>{
 const {game:g}=finished();const first=JSON.stringify(g.archive.all()[0]);
 g.fresh();g.state().IND=160;g.statistics.record('政策','下一次不同的投入');g.statistics.finish();
 const e=g.decideEnding();g.unlockEnding(e.heads[0].id);g.archive.capture(e);
 assert.equal(g.archive.all().length,2);assert.equal(JSON.stringify(g.archive.all()[0]),first);
 const {game:target}=runtime({statistics:true,endings:true});
 assert.equal(target.archive.importData({v:1,runs:g.archive.all()}),2);
 assert.equal(target.archive.importData({v:1,runs:g.archive.all()}),0);
 assert.equal(target.archive.all().length,2);target.fresh();assert.equal(target.archive.all().length,2);
 const data=JSON.parse(JSON.stringify(g.archive.all()));data[0].body='different';
 assert.throws(()=>target.archive.importData({v:1,runs:data}),/相同但内容不同/);
 assert.equal(JSON.stringify(target.archive.all()[0]),first);
});
test('reading an old ending is honest, and invalid backups cannot erase stored records',()=>{
 const{game:g,storage}=runtime({statistics:true,endings:true});
 g.unlockEnding('rome');assert.equal(g.archive.all().length,0);
 const saved=JSON.stringify(g.state());assert.equal(g.archive.open('rome'),true);assert.equal(JSON.stringify(g.state()),saved);
 assert.equal(g.archive.open('right'),false,'locked ending stays locked');
 assert.throws(()=>g.archive.importData({v:1,runs:[{endingId:'rome'}]}),/格式/);
 assert.equal(storage.has(g.archive.key),false);
 const record=JSON.parse(JSON.stringify(finished().game.archive.all()[0]));
 record.statistics.events[0].values.IND=null;
 assert.throws(()=>g.archive.importData({v:1,runs:[record]}),/格式/);
});
test('storage failures keep the unsaved run available and report the actual problem',()=>{
 const {game:g,storage}=finished();const run=g.archive.all()[0];
 const {game:target,storage:targetStore}=runtime({statistics:true,endings:true});
 const set=targetStore.set.bind(targetStore);targetStore.set=()=>{throw Error('quota exceeded')};
 assert.throws(()=>target.archive.importData({v:1,runs:[run]}),/未能保存/);
 assert.equal(target.archive.all().length,0);assert.match(target.archive.saveMessage(),/尚未写入/);
 targetStore.set=set;assert.equal(target.archive.importData({v:1,runs:[run]}),1);
 assert.equal(target.archive.all().length,1);assert.match(target.archive.saveMessage(),/已归档/);
 assert.equal(storage.has(g.archive.key),true);
});
test('a quota error on completion keeps an exportable in-memory copy without deleting prior runs',()=>{
 const {game:g,storage}=finished();const old=JSON.stringify(g.archive.all());
 g.fresh();g.statistics.finish();storage.set=()=>{throw Error('quota exceeded')};
 const run=g.archive.capture(g.decideEnding());
 assert.equal(g.archive.all().length,2);assert.equal(JSON.stringify(g.archive.all().slice(0,1)),old);
 assert.ok(g.archive.all().some(r=>r.id===run.id));assert.match(g.archive.saveMessage(),/尚未写入/);
});
