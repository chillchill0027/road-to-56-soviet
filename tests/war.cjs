const test=require('node:test'),assert=require('node:assert/strict');
const {runtime}=require('./helpers/runtime.cjs');
const {replay}=require('./helpers/routes.cjs');
const fixtures=require('./fixtures/routes.json').routes;
const reached=new Set(),warResults=new Set();
for(const fixture of fixtures) test(`war archive preserves legal route ${fixture.id}`,()=>{
  const old=replay(fixture),next=replay(fixture,{war:true});
  const clean=structuredClone(next.state);delete clean._warReports;
  assert.deepEqual(clean,old.state,'reportage never changes resources, flags, random events or ending');
  const reports=next.state._warReports;
  assert.equal(new Set(reports.map(r=>r.id)).size,reports.length,'one report per action');
  const battles=reports.filter(r=>r.kind==='battle');
  assert.equal(battles.filter(r=>r.level===0).length,next.state.collapses);
  assert.equal(battles.filter(r=>r.level===1).length,next.state.loses);
  assert.equal(battles.filter(r=>r.level===2).length,next.state.standoffs);
  assert.equal(battles.filter(r=>r.level>=3).length,next.state.holds);
  assert.equal(battles.filter(r=>r.level===4).length,next.state.reverses);
  for(const r of battles){reached.add(r.sector);assert.equal(r.photo,`war-${r.sector}-${r.level<=1?0:r.level-1}`);}
  const end=reports.find(r=>r.kind==='war');assert.ok(end);warResults.add(next.state.warOutcome);
  assert.equal(Object.values(end.counts).reduce((a,b)=>a+b,0),battles.length,'counterattacks are not counted twice as held');
  assert.ok(reports.every(r=>r.year>=1936&&r.year<=1956));
});
test('legal routes exercise all seven sectors and all five overall war results',()=>{
  assert.deepEqual([...reached].sort(),['frontier','moscow','volga','kursk','belarus','romania','berlin'].sort());
  assert.deepEqual([...warResults].sort(),['defeat','costly','great','held','stalemate'].sort());
});
test('all 35 battle report variants use stage-specific geography and actual outcome art',()=>{
  const {game}=runtime({war:true});
  for(const [key,sector] of Object.entries(game.warSectors)){
    game.cursor(sector.scene);game.enterScene(game.scenes[sector.scene]);
    for(let level=0;level<5;level++){
      const b={name:sector.names[0],tier:['崩溃','失守','僵持','守住','反攻'][level],level,R:'1.00'};
      const before=JSON.stringify(game.state());
      const r=game.war.create(game.scenes[sector.scene],game.scenes[sector.scene].options[0],[b],[]);
      assert.equal(r.level,level);assert.equal(r.tier,b.tier);assert.equal(r.sector,key);
      assert.equal(r.messages.length,3);assert.ok(r.messages.every(m=>m.text.length>25));
      assert.equal(new Set(sector.reports.map(row=>row[1])).size,5,'five distinct headlines');
      const html=game.war.bodyHTML(r);
      assert.ok(html.includes(r.place));assert.ok(html.includes('位置与连线为示意'));
      assert.equal(JSON.stringify(game.state()),before,'rendering never changes state');
      assert.notEqual(game.war.mapHTML(r),game.war.mapHTML(r,true),'archive map IDs are distinct');
    }
  }
});
test('southward choice changes region, season and coordinates, not just the title',()=>{
  const {game}=runtime({war:true});game.cursor('3-10');game.enterScene(game.scenes['3-10']);
  const sc=game.scenes['3-10'];
  const north=game.war.create(sc,sc.options[0],[{name:'巴格拉季昂',level:3,tier:'守住'}],[]);
  const south=game.war.create(sc,sc.options[1],[{name:'雅西-基什尼奥夫',level:3,tier:'守住'}],[]);
  assert.match(north.season,/6—7月/);assert.match(south.season,/8月/);
  assert.match(south.photo,/romania/);assert.ok(south.points.some(p=>p[0]==='雅西'));
  assert.ok(south.points.every(p=>p[2]<49));assert.ok(north.points.every(p=>p[2]>53));
});
test('alternative war calendar keeps report dates aligned to the actual game year',()=>{
  const {game}=runtime({war:true});game.state().warYear=1942;
  game.cursor('3-6');game.enterScene(game.scenes['3-6']);
  const r=game.war.create(game.scenes['3-6'],game.scenes['3-6'].options[0],[{name:'斯大林格勒战役',tier:'失守',level:1}],[]);
  assert.equal(r.year,1943);assert.match(game.war.bodyHTML(r),/1943/);
});
test('old pending battles render a report without replaying or mutating the save',()=>{
  const {game,storage}=runtime({war:true});game.cursor('3-1');game.renderScene(game.scenes['3-1']);
  game.choose(game.scenes['3-1'],game.scenes['3-1'].options[0]);
  const saved=JSON.parse(storage.get(game.saveKey));delete saved.S._warReports;
  delete saved.S._pendingResult.battles[0].level;storage.set(game.saveKey,JSON.stringify(saved));game.resume();
  const s=game.state(),before=JSON.stringify(s),pending=s._pendingResult;
  const r=game.war.forResult(game.scenes[s.curId],game.scenes[s.curId].options[pending.optionIndex],pending.battles,pending.deltas);
  assert.equal(r.tier,pending.battles[0].tier);assert.equal(JSON.stringify(s),before);
});
test('policy incidents retain their own outcomes without fabricated battle ratios',()=>{
  const {game}=runtime({war:true});
  for(const [key,incident] of Object.entries(game.warIncidents)){
    const scene=key==='3-12-west'?'3-12':key;game.cursor(scene);game.enterScene(game.scenes[scene]);
    incident.outcomes.forEach((_,index)=>{
      const o=game.scenes[scene].options[key==='3-12-west'?2:index];
      const r=game.war.create(game.scenes[scene],o,[],[]);
      assert.equal(r.kind,'incident');assert.equal(r.level,null);assert.equal(r.ratio,undefined);
    });
  }
});
