const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {runtime} = require('./helpers/runtime.cjs');

const root = path.resolve(__dirname, '..');
const keyOf = html => /data-scene-key="([^"]+)"/.exec(html)?.[1];
const signature = html => [/<img src="([^"]+)"/.exec(html)?.[1], /<img[^>]+style="([^"]+)"/.exec(html)?.[1]].join('|');
const stage = runtime => runtime.nodes.get('stage').innerHTML;

test('each conversation round, policy result and restored image selects its own scene without settling again', () => {
  const r = runtime({sceneArt:true, novel:true}), g = r.game;
  g.cursor('0-1'); g.renderScene(g.scenes['0-1']);
  const first = stage(r);
  assert.equal(keyOf(first), 'event/0-1/round/0');
  g.novel.respond(2,0);
  assert.equal(keyOf(stage(r)), 'event/0-1/round/1');
  assert.notEqual(signature(first), signature(stage(r)));
  const before = JSON.stringify(g.state());
  g.novel.renderActive();
  assert.equal(JSON.stringify(g.state()),before,'rerendering an existing round is read-only');
  for(let n=1;n<7;n++)g.novel.respond(2,n);
  g.renderRealResult(g.scenes['0-1'],g.scenes['0-1'].options[2],[],[],'');
  assert.equal(keyOf(stage(r)), 'result/0-1/option/2');
  const settled = JSON.stringify(g.state());
  g.renderRealResult(g.scenes['0-1'],g.scenes['0-1'].options[2],[],[],'');
  assert.equal(JSON.stringify(g.state()),settled);
});

test('interlude pages and legacy scene views have deterministic dedicated photographs', () => {
  const r = runtime({sceneArt:true,novel:true}),g=r.game;
  g.cursor('p0-intro');g.renderScene(g.scenes['p0-intro']);
  assert.equal(keyOf(stage(r)),'interlude/p0-intro/page/0');
  g.state()._worldPage.index=1;g.renderScene(g.scenes['p0-intro']);
  assert.equal(keyOf(stage(r)),'interlude/p0-intro/page/1');
  const before=JSON.stringify(g.state());
  g.renderScene(g.scenes['p0-intro'],{restoring:true});
  assert.equal(keyOf(stage(r)),'interlude/p0-intro/page/1');
  assert.equal(JSON.stringify(g.state()),before);
  const old=runtime({sceneArt:true}).game;
  delete old.state().novelVersion;old.cursor('0-2');
  assert.equal(keyOf(old.currentArt()),'event/0-2/round/0');
  old.cursor('p0-intro');assert.equal(keyOf(old.currentArt()),'interlude/p0-intro/page/0');
  old.cursor('a3-end');assert.equal(keyOf(old.currentArt()),'scene/a3-end');
});

test('approval and deferral photographs stay with their decision and do not leak into the next phase', () => {
  const r=runtime({sceneArt:true,novel:true}),g=r.game;
  g.cursor('dec-prologue');g.renderDecisions(g.scenes['dec-prologue']);
  assert.equal(keyOf(stage(r)),'phase/dec-prologue');
  const decision=g.decisions.find(d=>d.id==='religion');
  assert.equal(g.novel.startDecision(decision),true);
  assert.equal(keyOf(stage(r)),'agenda/religion');
  g.novel.respond(1,0);assert.equal(keyOf(stage(r)),'agenda/religion/deferred');
  assert.equal(g.novel.startDecision(decision),true);
  g.novel.respond(0,0);assert.equal(keyOf(stage(r)),'agenda/religion/approved');
  const before=JSON.stringify(g.state());g.renderDecisions(g.scenes['dec-prologue']);
  assert.equal(JSON.stringify(g.state()),before);
  g.cursor('dec-act1');g.renderDecisions(g.scenes['dec-act1']);
  assert.equal(keyOf(stage(r)),'phase/dec-act1');
});

test('war pictures distinguish tactics and all five ratings and work with existing archived reports', () => {
  const {game:g}=runtime({sceneArt:true,war:true});
  const pictures=new Set();
  for(const [sectorKey,sector]of Object.entries(g.warSectors)){
    g.cursor(sector.scene);g.enterScene(g.scenes[sector.scene]);
    const sc=g.scenes[sector.scene];
    for(let option=0;option<sc.options.length;option++){
      const o=sc.options[option];if(!o.battle)continue;
      const spec=typeof o.battle==='function'?o.battle(g.state()):o.battle;
      const match=g.war.sectorFor(spec.name);if(match?.[0]!==sectorKey)continue;
      for(let level=0;level<5;level++){
        const report=g.war.create(sc,o,[{name:spec.name,level,tier:['崩溃','失守','僵持','守住','反攻'][level],R:'1.00'}],[]);
        const before=JSON.stringify(g.state()),archived=JSON.parse(JSON.stringify(report));
        const html=g.war.heroHTML(archived,true);
        assert.equal(keyOf(html),`result/${sector.scene}/option/${option}/tier/${level}`);
        assert.ok(html.includes('loading="lazy"'));
        assert.ok(html.includes(`data-art="${report.photo}"`),'legacy report identity remains available');
        const image=signature(html);assert.ok(!pictures.has(image),'different tactical result has its own cell');pictures.add(image);
        assert.equal(JSON.stringify(g.state()),before);
        delete archived.level;delete archived.sceneId;delete archived.optionIndex;
        assert.equal(keyOf(g.war.heroHTML(archived)),`result/${sector.scene}/option/${option}/tier/${level}`,'older report fields infer their existing scene and actual rating');
      }
    }
  }
  assert.equal(pictures.size,85,'all 17 tactics keep a separate photograph for each of their five ratings');
});

test('missing artwork falls back without changing the save, including older pages without the manifest', () => {
  const r=runtime({sceneArt:true}),g=r.game;
  assert.equal(g.sceneArt.html('missing/scene',1936),'');
  assert.equal(g.sceneArt.entry('toString'),null);
  g.cursor('0-1');const before=JSON.stringify(g.state());
  g.currentArt();assert.equal(JSON.stringify(g.state()),before);
  const legacy=runtime().game;legacy.cursor('0-1');
  assert.equal(legacy.sceneArt,null);assert.ok(legacy.currentArt().includes('leader-sheet.webp'));
});

test('scene captions are escaped and image files stay inside the local artwork directory', () => {
  const context=vm.createContext({});
  const manifest={caption:{file:'assets/images/scenes/valid.webp',cell:3,cols:2,rows:2,caption:'<img src=x onerror="alert(1)">'},bad:{file:'https://example.com/photo.webp'},traversal:{file:'assets/images/../other.webp'},script:{file:'javascript:alert(1)'},badCell:{file:'assets/images/scenes/valid.webp',cell:4}};
  vm.runInContext('const SCENE_ART_MANIFEST='+JSON.stringify(manifest)+';'+fs.readFileSync(path.join(root,'scene-art.js'),'utf8')+';globalThis.art=SceneArt;',context);
  const html=context.art.html('caption','1936<', {artKey:'a"b'});
  assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
  assert.ok(html.includes('1936&lt;'));assert.ok(html.includes('data-art="a&quot;b"'));
  for(const key of ['bad','traversal','script','badCell'])assert.equal(context.art.html(key),'',key);
});
