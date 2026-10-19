const test=require('node:test');
const assert=require('node:assert/strict');
const {runtime}=require('./helpers/runtime.cjs');
const {replay}=require('./helpers/routes.cjs');
const fixtures=require('./fixtures/routes.json').routes;
for (const fixture of fixtures) test(`statistics preserve ${fixture.id} and account for every year`,()=>{
  const old=replay(fixture), next=replay(fixture,{statistics:true});
  const clean=structuredClone(next.state);delete clean._statistics;
  assert.deepEqual(clean,old.state,'ledger never changes resources, flags, decisions or ending');
  const d=next.state._statistics;
  assert.deepEqual(d.years.map(r=>r.year),Array.from({length:21},(_,i)=>1936+i));
  assert.equal(new Set(d.years.map(r=>r.year)).size,21);
  for (const [key,value] of Object.entries(d.years.at(-1).end)) assert.equal(value,next.state[key],`final ${key} reconciles`);
  for (let i=1;i<d.years.length;i++) assert.deepEqual(d.years[i].start,d.years[i-1].end);
  for (const r of d.years) {
    assert.ok(r.events.every(i=>d.events[i].year===r.year));
    if(r.carried) assert.deepEqual(r.start,r.end,'unobserved years invent no gains');
  }
  assert.equal(d.years.find(r=>r.year===1952).leader.name,'约瑟夫·斯大林');
  assert.notEqual(d.years.find(r=>r.year===1953).leader.name,'约瑟夫·斯大林');
});

test('actual capped values, baseline migration and restored ledger are stable',()=>{
  const {game,storage}=runtime({statistics:true});
  game.advance();game.advance();
  const s=game.state();s.PP=999;s.MOR=99;
  game.statistics.record('阶段','达到上限前');
  game.choose(game.scenes['0-1'],game.scenes['0-1'].options[0]);
  const last=game.state()._statistics.events.at(-1);
  assert.equal(last.values.PP,game.state().PP);
  assert.equal(last.values.MOR,game.state().MOR);
  const before=JSON.stringify(game.state());game.resume();assert.equal(JSON.stringify(game.state()),before);
  const saved=JSON.parse(storage.get(game.saveKey));delete saved.S._statistics;storage.set(game.saveKey,JSON.stringify(saved));
  game.resume();
  assert.equal(game.state()._statistics.events.length,1);
  assert.equal(game.state()._statistics.events[0].title,'1936 · 接续案头报告');
  const migrated=JSON.stringify(game.state());game.saveGame();game.resume();assert.equal(JSON.stringify(game.state()),migrated);
});
test('annual report follows the incumbent, includes actual decisions and never changes state',()=>{
  const {game}=runtime({statistics:true,novel:true});game.advance();
  const s=game.state();s._novelLeader='beria';
  game.statistics.record('政策','测试国家报告');game.statistics.beforeYear(1937);
  const before=JSON.stringify(s),d=s._statistics,r=d.years[0];
  const html=game.statistics.reportHTML(r,d);
  assert.match(html,/贝利亚/);assert.match(html,/测试国家报告/);assert.match(html,/机关的效率/);
  assert.equal(JSON.stringify(s),before);
  game.statistics.beforeYear(1937);assert.equal(d.years.length,1);
  game.statistics.beforeYear(1940);assert.equal(d.years.length,4);
  assert.match(game.statistics.reportHTML(d.years.at(-1),d),/沿用那份报告/);
});
