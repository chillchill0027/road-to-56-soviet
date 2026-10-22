/* 《56之路：苏维埃》游戏脚本
   状态机 / 数值结算 / 战役判定 / 结局判定
   玩家扮演：斯大林与继承人的最高领导席位，国家意志贯穿全程 */

/* ============================================================
   《56之路：苏维埃》 —— 状态机 / 数值 / 战役判定
   玩家扮演：斯大林与继承人的最高领导席位，国家意志贯穿全程
   ============================================================ */

/* ---------- 属性定义 ---------- */
const META = {
  PP:  {n:'政治资本', cap:999},
  PAR: {n:'偏执',     cap:100},
  IND: {n:'工业',     cap:300},
  ARMY:{n:'红军',     cap:100},
  MOR: {n:'民心',     cap:100},
  COM: {n:'阵营影响', cap:100},
};
const KEYS = Object.keys(META);
const FACTION = {STAL:1, LEFT:1, RIGHT:1};
const NAMES = {PP:'政治资本',PAR:'偏执',IND:'工业',ARMY:'红军',MOR:'民心',COM:'阵营影响',
               STAL:'斯大林派',LEFT:'左翼',RIGHT:'右翼'};
const ADD_NAMES = {fort:'防线', enemyMod:'敌军强度', nationalQ:'民族问题',
                   nuclear:'核进度', beria:'贝利亚势力', zhukov:'朱可夫威望'};
const EFFECT_NAMES = {...NAMES, ...ADD_NAMES, fortStalin:'旧边界工事', fortMolotov:'新边界工事',
  indSaved:'已转移工业', westTrust:'西方信任', destalinUnrest:'阵营动荡', religion:'宗教和解',
  purgeCount:'清洗次数', warning:'预警系数'};
const RAW_LIMITS = {nuclear:100, beria:100, zhukov:100, westTrust:100, nationalQ:100};
const EFFECT_DIRECTION = {PAR:-1, enemyMod:-1, nationalQ:-1, destalinUnrest:-1, warning:-1,
  STAL:0, LEFT:0, RIGHT:0, beria:0, zhukov:0, religion:0, purgeCount:0};
function effectTone(k, d){
  const direction = EFFECT_DIRECTION[k] ?? 1;
  return !direction || !d ? '' : d * direction > 0 ? 'up' : 'dn';
}
function effectNumber(n){ return Number(n.toFixed(2)); }
function effectSnapshot(){
  return Object.fromEntries(Object.keys(EFFECT_NAMES).map(k => [k, Number(S[k]) || 0]));
}
function effectChanges(before){
  return Object.keys(EFFECT_NAMES).map(k => ({k, d:effectNumber((Number(S[k])||0)-(before[k]||0))})).filter(x => x.d);
}
function effectsHTML(deltas){
  return deltas.map(({k,d}) => `<span class="${effectTone(k,d)}">${EFFECT_NAMES[k]} ${d>0?'+':''}${effectNumber(d)}</span>`).join('');
}
function boundedValue(k, value){
  const floor = k==='enemyMod' ? -999 : k==='westTrust' ? -100 : 0;
  return Math.max(floor, Math.min(META[k]?.cap ?? (k in FACTION ? 100 : RAW_LIMITS[k] ?? 999), value));
}
function previewEffects(o){
  const values = effectSnapshot();
  const before = {...values};
  for (const fx of [o.fx, o.add, o.raw]) for (const k in fx||{}){
    if (k in EFFECT_NAMES) values[k] = boundedValue(k, (values[k]||0)+fx[k]);
  }
  for (const k in o.flags||{}) if (k in EFFECT_NAMES && typeof o.flags[k]==='number') values[k]=o.flags[k];
  if (o.purge) values.purgeCount++;
  return Object.keys(EFFECT_NAMES).map(k=>({k,d:effectNumber(values[k]-before[k])})).filter(x=>x.d);
}

/* ============================================================
   图版素材（assets/images/<key>.jpg）
   同一场景族共用一张图，重复使用是设计的一部分。
   含"同一位男性"的三张图（leader-map / leader-corridor / leader-night）
   使用完全一致的人物锚点，保证跨图形象相同。
   ============================================================ */
const ART = {
  'p0-intro':'cover',        '0-1':'leader-map',     '0-2':'steel',
  '0-3':'hall',              'dec-prologue':'desk',
  'a1-intro':'steel',        '1-1':'military-court', '1-2':'village',
  '1-3':'leader-corridor',   '1-4':'lab',            '1-5':'map-arrows',
  'a1-end':'archive',        'dec-act1':'desk',
  'a2-intro':'port',         '2-1':'summit-table',   '2-2':'winter',
  '2-3':'port',              '2-4':'formation',      '2-5':'formation',
  'a2-end':'leader-night',
  'a3-intro':'ruins',        '3-1':'advance',        'dec-mid3':'desk',
  '3-2':'ruins',             '3-3a':'redsquare',     '3-3b':'redsquare',
  '3-5':'port',              '3-6':'tankfield',      '3-7':'tankfield',
  'dec-mid3b':'desk',        '3-9':'summit-table',   '3-10':'advance',
  '3-11':'ruins',            '3-12':'advance',       '3-13':'conference',
  'a3-end':'conference',     'dec-act3':'housing',
  'x-left':'leader-corridor','x-napoleon':'military-court', 'x-right':'leader-corridor',
  'a4-intro':'housing',      '4-1':'housing',        '4-2':'curtain',
  '4-3':'bomb',              '4-4':'curtain',        '4-5':'curtain',
  '4-6':'archive',           'a4-end':'leader-map',  'dec-act4':'desk',
  'a5-intro':'leader-night', '5-0':'leader-night',   '5-1':'hall',
  '5-2':'hall',              '5-3':'hungary',        '5-4':'eternal-flame',
  'dec-act5':'desk'
};
const ART_CAPTION = {
  cover:'卷首', archive:'档案', steel:'工业', hall:'会场', desk:'决议',
  'leader-map':'在地图前', 'leader-corridor':'走廊', 'leader-night':'夜半',
  'military-court':'军事法庭', village:'农庄', nkvd:'内务部', lab:'实验室',
  'map-arrows':'作战图', 'summit-table':'会谈', winter:'冬季', formation:'列队',
  ruins:'废墟', redsquare:'红场', port:'港运', tankfield:'装甲原野',
  advance:'推进', conference:'波茨坦', housing:'重建', curtain:'铁幕',
  bomb:'蘑菇云', hungary:'布达佩斯', 'eternal-flame':'长明火'
};
/* 图版调色分族：同一族内视觉一致，跨族区分幕次气氛 */
const ART_TONE = {
  cover:'mid',      archive:'light', steel:'mid',        hall:'mid',
  desk:'light',     lab:'light',     'map-arrows':'light','summit-table':'light',
  conference:'light',curtain:'light',
  'leader-map':'night','leader-corridor':'night','leader-night':'night',
  nkvd:'night',     bomb:'night',    'eternal-flame':'night',
  'military-court':'dark',village:'mid',winter:'mid',formation:'mid',
  housing:'mid',
  ruins:'dark',     redsquare:'dark',port:'dark',        tankfield:'dark',
  advance:'dark',   hungary:'dark'
};
const ENDING_ART = 'eternal-flame';

const ART_SOURCE = {
  cover:['cover',-1], steel:['industry-sheet',0], village:['industry-sheet',1],
  lab:['industry-sheet',2], archive:['industry-sheet',3],
  'leader-map':['leader-sheet',0], 'leader-corridor':['leader-sheet',1],
  'leader-night':['leader-sheet',2], desk:['leader-sheet',3],
  winter:['war-sheet',0], ruins:['war-sheet',1], tankfield:['war-sheet',2], advance:['war-sheet',3],
  hall:['state-sheet',0], conference:['state-sheet',1], housing:['state-sheet',2], port:['state-sheet',3],
  'summit-table':['state-sheet',1], curtain:['history-sheet',0], bomb:['history-sheet',1],
  hungary:['history-sheet',2], 'eternal-flame':['history-sheet',3],
  'military-court':['military-sheet',0], 'map-arrows':['military-sheet',1],
  formation:['military-sheet',2], redsquare:['military-sheet',3]
};

/* 图版：返回一段 <figure>；文件缺失时由 CSS 降级为构成主义色块 */
function artHTML(key, year){
  if (!key) return '';
  const cap = ART_CAPTION[key] || key;
  const tone = ART_TONE[key] || 'mid';
  const y = String(year || S.year || '');
  const [file, cell] = ART_SOURCE[key] || ART_SOURCE.archive;
  return `<figure class="scene-art art-${tone}" data-art="${key}">
    <div class="art-window${cell < 0 ? ' single' : ''}"><div class="art-cell"><img src="assets/images/${file}.webp" alt="${cap} · AI 生成的历史场景演绎" decoding="async" style="${cell < 0 ? '' : `left:-${cell%2*100}%;top:-${Math.floor(cell/2)*100}%`}"></div></div>
    <figcaption><span>${cap} <span class="art-fiction">/ 历史场景演绎</span></span><span>${y}</span></figcaption>
  </figure>`;
}
function artForCurrent(){ return artHTML(S.curId ? ART[S.curId] : null, S.year); }

/* ---------- 初始状态 ---------- */
let S, i, LOG, ENDED;

function fresh(){
  FLOW = FLOW_V2;
  S = {
    PP:140, PAR:10, IND:95, ARMY:62, MOR:68, COM:45,
    STAL:60, LEFT:25, RIGHT:25,
    purgeCount:0, _purgeAccounting:2, beria:0, zhukov:0, napoleon:false,
    fort:0, warning:1.0, enemyMod:0, nationalQ:0, nuclear:0, westTrust:0,
    collapses:0, loses:0, holds:0, reverses:0, standoffs:0,
    rulesVersion:2, flowVersion:2, novelVersion:1,
    warOutcome:null, act:0, year:1936,
  };
  i = -1; LOG = []; ENDED = false; S.curId = null;
  document.getElementById('stage').innerHTML = '';
  if (typeof Statistics!=='undefined') Statistics.ensure();
}

const clamp = (k,v) => Math.max(0, Math.min(META[k].cap, v));

function apply(fx){
  const out = [];
  for (const k in fx){
    const isMeta = k in META, isFac = k in FACTION;
    if (!isMeta && !isFac) continue;
    const cap = isMeta ? META[k].cap : 100;
    const before = S[k];
    S[k] = Math.max(0, Math.min(cap, S[k] + fx[k]));
    const d = S[k] - before;
    if (d !== 0) out.push({k, d});
  }
  return out;
}
function setFlags(f){ if (f) for (const k in f) S[k] = f[k]; }
function addRaw(k,v){
  S[k] = boundedValue(k, (S[k]||0)+v);
}

/* ---------- HUD ---------- */
function hudAct(){
  const names = ['序幕','第一幕 · 钢铁与血','第二幕 · 魔鬼的交易','第三幕 · 伟大的卫国战争','第四幕 · 胜利的代价','第五幕 · 走向 56'];
  document.getElementById('hud-act').textContent =
    (names[S.act] || '') + (S.year ? '  ' + S.year : '') +
    (S.novelVersion && typeof Novel!=='undefined' ? ' · '+Novel.leader().name : '');
}
function renderHUD(){
  const box = document.getElementById('hud-stats');
  if (!box.children.length){
    box.innerHTML = KEYS.map(k =>
      `<div class="stat" id="st-${k}"><span class="k">${META[k].n}</span><span class="v" id="v-${k}">0</span></div>`
    ).join('');
    document.getElementById('hud-fac').innerHTML =
      [['STAL','斯大林派','f-stal'],['LEFT','左翼','f-left'],['RIGHT','右翼','f-right']]
      .map(([k,n,c]) =>
        `<div class="fac ${c}"><span class="n">${n}</span><span class="bar"><i id="b-${k}"></i></span><span class="num" id="fn-${k}">0</span></div>`
      ).join('');
  }
  KEYS.forEach(k => {
    document.getElementById('v-'+k).textContent = S[k];
    const el = document.getElementById('st-'+k);
    el.className = 'stat';
    if ((k==='PAR' && S.PAR>=75) || (k==='MOR' && S.MOR<=25) || (k==='ARMY' && S.ARMY<=25)) el.className='stat crit';
    else if ((k==='PAR' && S.PAR>=50) || (k==='MOR' && S.MOR<=40)) el.className='stat warn';
  });
  ['STAL','LEFT','RIGHT'].forEach(k => {
    document.getElementById('b-'+k).style.width = Math.min(100,S[k]) + '%';
    document.getElementById('fn-'+k).textContent = S[k];
  });
  hudAct();
}
function fly(k, d){
  const el = document.getElementById('st-'+k);
  if (!el || !d) return;
  const s = document.createElement('span');
  s.className = 'fly ' + effectTone(k,d);
  s.textContent = (d>0?'+':'') + effectNumber(d);
  el.appendChild(s);
  setTimeout(()=>s.remove(), 1200);
}
function showDeltas(list){
  list.forEach((o,idx)=>setTimeout(()=>fly(o.k,o.d), idx*70));
}

/* ---------- 战役判定 ---------- */
const TIERS = [
  {t:'崩溃', cls:'cat',     fx:{ARMY:-8, MOR:-18}},
  {t:'失守', cls:'lose',    fx:{ARMY:-4, MOR:-8}},
  {t:'僵持', cls:'hold',    fx:{MOR:-3}},
  {t:'守住', cls:'hold',    fx:{ARMY:2,  MOR:5}},
  {t:'反攻', cls:'counter', fx:{ARMY:5,  MOR:10}},
];
function battle(name, enemy, o){
  o = o || {};
  const baseEnemy = enemy;
  enemy = Math.max(20, baseEnemy + (S.enemyMod||0));
  const fort = 1 + Math.min(S.fort, 48)/160;
  const mor  = 0.65 + S.MOR/200;
  const warn = S.warning || 1.0;
  const raw  = (S.ARMY * fort * mor) / (enemy * warn);
  const discipline = S.harsh && o.defensive ? 1.25 : 1;
  const tactic = (o.hold || 1) / discipline;
  const rc   = raw / tactic;
  const idx  = rc < 0.4 ? 0 : rc < 0.7 ? 1 : rc < 1.0 ? 2 : rc < 1.35 ? 3 : 4;
  const tier = TIERS[idx];
  const res  = {name, enemy, baseEnemy, enemyMod:S.enemyMod||0, level:idx, success:idx>=3,
    R:rc.toFixed(2), baseR:raw.toFixed(2), tier:tier.t, cls:tier.cls, fx:{...tier.fx},
    factors:{army:S.ARMY, fortValue:S.fort, effectiveFort:Math.min(S.fort,48), fort, morale:S.MOR, mor, warning:warn, tactic, discipline}};
  // Tactical costs apply to every outcome; victory rewards require an actual win.
  if (o.fx) for (const k in o.fx) if (o.fx[k] < 0 || idx >= 3) res.fx[k] = (res.fx[k]||0) + o.fx[k];
  if (idx===0) S.collapses++;
  else if (idx===1) S.loses++;
  else if (idx===2) S.standoffs = (S.standoffs||0)+1;
  else if (idx>=3) S.holds++;
  if (idx===4) S.reverses++;
  return res;
}
function battleHTML(b){
  const f = b.factors;
  const warningLabel = f.warning >= 1.0 ? '无预警' : f.warning >= 0.8 ? '部分预警' : '完整预警';
  const wn = warningLabel + ' ×' + f.warning.toFixed(2);
  return `<div class="battle">
    <div class="bt">战 役 判 定 · ${b.name}</div>
    <div class="br"><span class="rr">R = ${b.R}</span><span class="rl ${b.cls}">${b.tier}</span></div>
    <div class="bd">结算前：红军 ${f.army}　·　工事系数 ${f.fort.toFixed(2)}（防线 ${f.fortValue}，有效上限 48）　·　民心系数 ${f.mor.toFixed(2)}（民心 ${f.morale}）<br>敌军强度 ${b.enemy}${b.baseEnemy!==undefined?`（基础 ${b.baseEnemy}，战场修正 ${b.enemyMod>0?'+':''}${b.enemyMod}，下限 20）`:''}　·　${wn}　·　战术系数 ×${f.tactic.toFixed(2)}${f.discipline>1?'（死守纪律加成 25%）':''}<br>战力比 R = 红军 × 工事 × 民心 ÷（敌军 × 预警 × 战术）。胜利奖励仅在守住或反攻时发放。</div>
  </div>`;
}
/* 战时动员底线：新组建的师不断补充到前线 */
const mobil = (n) => (S) => {
  const need = n - S.ARMY;
  if (need <= 0) return { deltas:{} };
  return { deltas:{ARMY:need},
    html:'<div class="brief"><p><em>战时动员：后方新组建的师完成训练，补充到前线。红军战力回升到 '+n+'。</em></p></div>' };
};

/* ---------- 幕间随机清洗 ---------- */
const PURGE_TARGETS = [
  {n:'一批老布尔什维克', fx:{STAL:3, PAR:-8, MOR:-6},        t:'名单上又多了三十七个名字，都是 1917 年在场的人。'},
  {n:'总参谋部的一批军官', fx:{ARMY:-9, PAR:-10, MOR:-4},    t:'三个人被从作战会议室直接带走，他们的地图还摊在桌上。'},
  {n:'物理研究所的两位负责人', fx:{IND:-6, nuclear:-10, PAR:-8}, t:'两位负责人被指控与外国实验室通信。项目推迟了。'},
  {n:'内务部的一个副局长', fx:{PAR:-12, MOR:-3},             t:'内务部开始审查内务部。楼里的人学会了不看同事的眼睛。'},
  {n:'共青团的一整个地区委员会', fx:{MOR:-8, STAL:4, PAR:-9}, t:'年轻人被要求互相检举。他们照做了，而且做得很快。'},
];
function interlude(){
  const out = [];
  if (S.PAR >= 75){
    const p = PURGE_TARGETS[Math.floor(Math.random()*PURGE_TARGETS.length)];
    S.purgeCount++;
    out.push({k:'purge', title:'偏执 > 75：幕间清洗自动发生', text:'清洗了'+p.n+'。'+p.t, fx:p.fx});
  } else if (S.PAR >= 50 && Math.random() < 0.5){
    S.purgeCount++;
    out.push({k:'purge', title:'偏执 > 50：内务部自行其是', text:'没有人下达命令，但昨晚又有两辆黑色轿车开进了院子。', fx:{PAR:-3, MOR:-3}});
  }
  return out;
}

/* ---------- 渲染：场景 ---------- */
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

function optionHTML(sc, o, idx){
  const ok = !o.when || o.when(S);
  const fx = [];
  for (const {k,d} of previewEffects(o)){
    const tone = effectTone(k,d);
    fx.push(`<span class="${tone==='up'?'p':tone==='dn'?'n':''}">${EFFECT_NAMES[k]} ${d>0?'+':''}${d}</span>`);
  }
  if (o.battle) fx.push('<span class="h">另按战力比结算战损；胜利后才发放奖励</span>');
  for (const k in o.winAdd||{}) fx.push(`<span class="h">获胜后：${EFFECT_NAMES[k]} ${o.winAdd[k]>0?'+':''}${o.winAdd[k]}</span>`);
  if (o.hide) o.hide.forEach(h => fx.push(`<span class="h">${h}</span>`));
  return `<button class="opt${ok?'':' locked'}" data-i="${idx}" ${ok?'':'disabled'}>
    <div class="row1">
      <span class="key">${o.k}</span>
      <span class="lb">${esc(o.label)}</span>
      ${o.flavor?`<span class="fl">${esc(o.flavor)}</span>`:''}
      ${ok?'':`<span class="lock">条件：${esc(o.lock||'条件不足')}</span>`}
    </div>
    ${fx.length?`<div class="fx">${fx.join('')}</div>`:''}
  </button>`;
}

function campaignScene(sc){
  return sc.act===3 || ['2-5','a2-end','dec-act3'].includes(S.curId);
}
function sceneYear(sc){
  return (sc.year||S.year) + (campaignScene(sc) && sc.year>=1941 && sc.year<=1945 ? (S.warYear||1941)-1941 : 0);
}
function sceneText(sc, value){
  const text = typeof value==='function' ? value(S) : value||'';
  return campaignScene(sc) && S.warYear===1942 ? String(text).replace(/194[1-5]/g,y=>String(Number(y)+1)) : String(text);
}
function enterScene(sc, options = {}){
  if (typeof Statistics!=='undefined') Statistics.beforeYear(sceneYear(sc));
  S.act = sc.act !== undefined ? sc.act : S.act;
  S.year = sceneYear(sc);
  let ex = '', dl = [];
  const entered = S._enteredScene === S.curId;
  if (!options.restoring && !entered){
    const before = effectSnapshot();
    if (sc.onEnter){
      const r = sc.onEnter(S) || {};
      if (r.deltas) {
        dl = apply(r.deltas);
        for (const k in r.deltas) if (!(k in META) && !(k in FACTION)) addRaw(k, r.deltas[k]);
      }
      ex = r.html || '';
    }
    S._enteredScene = S.curId;
    S._entryHTML = ex;
    dl = effectChanges(before);
    S._entryDeltas = dl;
  } else {
    ex = entered ? S._entryHTML || '' : '';
    S._enteredScene = S.curId;
    S._entryHTML = ex;
  }
  if (!options.restoring && !entered && typeof Statistics!=='undefined') Statistics.record('阶段',sceneText(sc,sc.title));
  return {ex, deltas:S._entryDeltas||[], applied:!options.restoring && !entered};
}
function renderScene(sc, options = {}){
  const entry = enterScene(sc,options);
  if (S.novelVersion && typeof World!=='undefined' && World.handles(S.curId)) {
    World.renderInterlude(sc,entry); return;
  }
  if (S.novelVersion && typeof Novel!=='undefined' && Novel.handles(S.curId)) {
    Novel.renderEvent(sc, entry);
    return;
  }
  const ex = entry.ex;
  const dl = entry.deltas;
  const briefArr = typeof sc.brief === 'function' ? sc.brief(S) : (sc.brief||[]);
  renderHUD();
  if (entry.applied && dl.length) showDeltas(dl);
  const st = document.getElementById('stage');
  let html = `<div class="fade">
    <div class="tag">${esc(sc.chapter||'')} · ${esc(S.year)}</div>
    <h1 class="scene">${esc(sceneText(sc,sc.title))}</h1>
    <div class="sub">${esc(sceneText(sc,sc.sub))}</div>
    ${artForCurrent()}<div class="brief">${briefArr.map(p=>`<p>${sceneText(sc,p)}</p>`).join('')}</div>${ex}
    ${dl.length?`<div class="entry-effects"><div class="hint">阶段结算 · 已计入当前状态</div><div class="deltas">${effectsHTML(dl)}</div></div>`:''}`;
  if (sc.options && sc.options.length){
    const vis = sc.options.filter(o => !(o.only && o.when && !o.when(S)));
    html += `<div class="prompt">国 家 机 器 的 选 择</div>
      <div class="opts">${vis.map((o)=>optionHTML(sc,o,sc.options.indexOf(o))).join('')}</div>`;
  } else {
    html += `<div class="acts"><button class="btn" id="next">继 续</button></div>`;
  }
  html += `</div>`;
  st.innerHTML = html;
  st.querySelectorAll('.opt').forEach(b => {
    if (b.disabled) return;
    b.addEventListener('click', () => choose(sc, sc.options[+b.dataset.i]));
  });
  const nb = document.getElementById('next');
  if (nb) nb.addEventListener('click', advance);
  if (S.novelVersion && typeof Novel!=='undefined') Novel.connectScene(sc);
  saveGame();
  scrollToStart();
}

/* ---------- 渲染：结果 ---------- */
function renderResult(sc, o, deltas, battles, extra){
  renderHUD(); showDeltas(deltas);
  const st = document.getElementById('stage');
  const warReport = typeof WarReports!=='undefined' ? WarReports.forResult(sc,o,battles,deltas) : null;
  const tone = warReport?.kind==='battle' ? (warReport.level>=3?'good':warReport.level<2?'bad':'') : warReport?.kind==='war' ? (S.warOutcome==='great'?'good':S.warOutcome==='defeat'?'bad':'') : o.tone || '';
  const failed = (battles||[]).some(b=>!battleSucceeded(b));
  const verdict = warReport ? warReport.headline+(failed?'，未达成计划目标':'') : failed ? '作战结果：'+battles.map(b=>b.tier).join('、')+'，未达成计划目标' : o.verdict||'';
  const paragraphs = warReport ? [warReport.opening] : failed ? ['部队执行了所选计划，但实际战力不足以取得预期胜利。伤亡和额外成本已结算；未发放胜利专属奖励。'] : o.res||[];
  let html = `<div class="fade">
    <div class="tag">${esc(sc.chapter||'')} · 选择已执行</div>
    <h1 class="scene">${esc(o.label)}</h1>
    ${S.novelVersion && typeof Novel!=='undefined' ? Novel.seatHTML() : ''}
    ${o.flavor?`<div class="sub">${esc(o.flavor)}</div>`:'<div class="sub"></div>'}
    ${warReport ? WarReports.heroHTML(warReport) : artForCurrent()}
    <div class="verdict ${failed?'bad':tone}">${esc(sceneText(sc,verdict))}</div>
    <div class="brief">${paragraphs.map(p=>`<p>${sceneText(sc,p)}</p>`).join('')}</div>
    ${S.novelVersion && typeof Novel!=='undefined' ? Novel.aftermathHTML(sc) : ''}
    ${warReport ? WarReports.bodyHTML(warReport) : ''}
    ${(battles||[]).map(battleHTML).join('')}
    ${extra||''}
    <div class="deltas">${deltas.length?effectsHTML(deltas):'<span>无数值变化</span>'}</div>
    ${S.novelVersion && typeof Novel!=='undefined' ? Novel.resolutionHTML() : ''}
    <div class="acts"><button class="btn" id="next">继 续</button></div>
    ${logHTML()}
  </div>`;
  st.innerHTML = html;
  document.getElementById('next').addEventListener('click', advance);
  document.getElementById('war-open-archive')?.addEventListener('click',()=>Novel.openLog());
  scrollToStart();
}
function logHTML(){
  if (!LOG.length) return '';
  return `<div class="log"><div class="lt">已 执 行 的 决 定</div>
    ${LOG.slice(-6).map(l=>`<div class="li">${esc(l)}</div>`).join('')}</div>`;
}

/* ---------- 渲染：决议台 ---------- */
function enterDecisionPhase(phase){
  if (typeof Statistics!=='undefined') Statistics.beforeYear(sceneYear(phase));
  S.act = phase.act !== undefined ? phase.act : S.act;
  S.year = sceneYear(phase);
}
function renderDecisions(phase){
  enterDecisionPhase(phase);
  if (S.novelVersion && typeof Novel!=='undefined' && S._novel?.kind==='decision') {
    Novel.renderActive(); return;
  }
  renderHUD();
  const st = document.getElementById('stage');
  const avail = DECISIONS.filter(d =>
    (!d.act || d.act.includes(S.act)) &&
    (!d.when || d.when(S)) &&
    (d.max === undefined || (S['_c_'+d.id]||0) < d.max)
  );
  st.innerHTML = `<div class="fade">
    <div class="tag">${esc(phase.chapter)} · ${esc(S.year)}</div>
    <h1 class="scene">${esc(phase.title)}</h1>
    <div class="sub">${esc(phase.sub||'')}</div>
    ${artForCurrent()}
    <div class="brief">${(phase.brief||[]).map(p=>`<p>${sceneText(phase,p)}</p>`).join('')}</div>
    ${!S.novelVersion && S._lastDecision?.sceneId===S.curId?`<div class="decision-result" role="status"><div class="hint">已执行：${esc(S._lastDecision.name)}</div><div class="deltas">${effectsHTML(S._lastDecision.deltas)}</div></div>`:''}
    ${S.novelVersion && typeof Novel!=='undefined' ? Novel.decisionOutcomeHTML() : ''}
    <div class="dpanel">
      <div class="dhead">
        <span class="dt">决 议 台</span>
        <span class="db">政治资本 <b id="dp">${S.PP}</b> · 工业 <b id="di">${S.IND}</b></span>
      </div>
      <div class="dlist" id="dlist">
        ${avail.length?avail.map(d=>{
          const c = decisionCost(d);
          const can = Object.keys(c).every(k=>S[k]>=c[k]);
          const left = d.max!==undefined ? `（剩余 ${d.max-(S['_c_'+d.id]||0)} 次）` : '';
          return `<div class="di">
            <div class="dn">${esc(d.name)}<span class="df">${esc(d.note||'')}${left}${d.purge&&S.constitution?' · 宪法法理降低政治成本 20%':''}</span><span class="decision-effects">${effectsHTML(previewEffects(d))}</span></div>
            <div class="dc">${Object.keys(c).map(k=>`${META[k].n} −${c[k]}`).join(' · ')}</div>
            <button class="db2" data-id="${d.id}" ${can?'':'disabled'}>${S.novelVersion?'听取汇报':'执 行'}</button>
          </div>`;
        }).join(''):'<div class="di"><div class="dn">当前无可执行决议</div></div>'}
      </div>
    </div>
    <div class="hint">${S.novelVersion?'秘书将各部门的文件分开摆好，没有批示的仍压在桌角。':'决议不消耗回合，只消耗资源。执行完毕后进入下一阶段。'}</div>
    <div class="acts"><button class="btn" id="next">进 入 下 一 阶 段</button></div>
    ${logHTML()}
  </div>`;
  st.querySelectorAll('.db2').forEach(b => {
    if (b.disabled) return;
    b.addEventListener('click', () => {
      const d = DECISIONS.find(x=>x.id===b.dataset.id);
      if (S.novelVersion && typeof Novel!=='undefined') { Novel.startDecision(d); return; }
      const d2 = executeDecision(d);
      if (!d2) return;
      renderHUD(); showDeltas(d2);
      renderDecisions(phase);
      const box = document.getElementById('dlist');
      if (box && box.animate) box.animate([{opacity:.55},{opacity:1}],{duration:230});
    });
  });
  document.getElementById('next').addEventListener('click', advance);
  if (S.novelVersion && typeof Novel!=='undefined') Novel.connectScene(phase);
  saveGame();
  scrollToStart();
}

function executeDecision(d){
  if (ENDED || !d || !DECISIONS.includes(d) || (d.act && !d.act.includes(S.act)) || (d.when && !d.when(S)) ||
      (d.max !== undefined && (S['_c_'+d.id]||0) >= d.max) ||
      !SCENES[S.curId]?.decisions ||
      !Object.entries(decisionCost(d)).every(([k,c]) => S[k] >= c)) return null;
  const before = effectSnapshot();
  const cost = {};
  for (const [k,c] of Object.entries(decisionCost(d))) cost[k] = -c;
  apply(cost); apply(d.fx||{});
  if (d.raw) for (const k in d.raw) addRaw(k, d.raw[k]);
  S['_c_'+d.id] = (S['_c_'+d.id]||0) + 1;
  if (d.purge) S.purgeCount = (S.purgeCount||0) + 1;
  LOG.push(d.name);
  const deltas = effectChanges(before);
  S._lastDecision = {sceneId:S.curId, name:d.name, deltas};
  if (typeof Statistics!=='undefined') Statistics.record('决议',d.name);
  saveGame();
  return deltas;
}
function decisionCost(d){
  const cost = {...d.cost};
  if (d.purge && S.constitution && cost.PP) cost.PP = Math.ceil(cost.PP*.8);
  if (d.id==='lend' && S.cominternPath) cost.PP *= 2;
  return cost;
}
function battleSucceeded(b){ return b.success ?? ['守住','反攻'].includes(b.tier); }
function scrollToStart(){
  window.scrollTo({top:0, behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}

/* ---------- 标题页 ---------- */
const ACT_LINE = ['序幕 · 遗产与偏执','第一幕 · 钢铁与血','第二幕 · 魔鬼的交易',
                  '第三幕 · 伟大的卫国战争','第四幕 · 胜利的代价','第五幕 · 走向 56'];
function menuMode(on){
  document.body.classList.remove('is-cover');
  document.body.classList.toggle('is-menu', !!on);
  const w = document.querySelector('.wrap');
  if (w) w.classList.toggle('is-menu', !!on);
}
function renderTitle(){
  menuMode(true);
  document.body.classList.add('is-cover');
  const g = unlocked();
  const st = document.getElementById('stage');
  st.innerHTML = `<div class="title-screen fade">
    <section class="title-hero" aria-label="56之路：苏维埃 · 开始封面">
      <div class="hero-copy">
        <div class="cover-edition"><span aria-hidden="true">★</span> 历史视觉小说 <i></i> 1936 — 1956</div>
        <h1 class="ts-title" aria-label="56之路：苏维埃"><span>56之路</span><span>苏维埃</span></h1>
        <p class="hero-quote">历史没有如果，直到你做出选择。</p>
        <div class="ts-actions">${hasSave()?`<button class="btn primary" id="ts-continue">继续上次进度 <span aria-hidden="true">↗</span></button><button class="btn ghost" id="ts-new">新的历史</button>`:`<button class="btn primary" id="ts-new">开启你的历史 <span aria-hidden="true">↗</span></button>`}</div>
        ${hasSave()&&!store.get(SAVE_KEY)?.S?.novelVersion?'<p class="hint">此存档沿用旧版国策流程；新周目启用完整情景对话，结局图鉴保留。</p>':''}
        <button class="cover-archive" id="ts-gallery">结局图鉴 <small>${g.length} / ${ENDINGS.length}</small><span aria-hidden="true">→</span></button>
        <p class="cover-note">基于 Road to 56 的架空历史 · 非官方同人作品</p>
      </div>
      <figure class="hero-image"><img src="assets/images/cover.webp" alt="从克里姆林宫的办公桌眺望冬日莫斯科，AI 生成的历史场景演绎" fetchpriority="high"><figcaption><span>莫斯科，1936 年</span><span>AI 生成的历史场景演绎</span></figcaption></figure>
    </section>
  </div>`;
  const nw = document.getElementById('ts-new');
  if (nw) nw.addEventListener('click', requestNewGame);
  const cc = document.getElementById('ts-continue');
  if (cc) cc.addEventListener('click', resume);
  const gg = document.getElementById('ts-gallery');
  if (gg) gg.addEventListener('click', renderGallery);
  scrollToStart();
}
function renderGallery(){
  if(typeof EndingArchive!=='undefined'){ EndingArchive.renderGallery(); return; }
  menuMode(true);
  const g = unlocked();
  const st = document.getElementById('stage');
  st.innerHTML = `<div class="gallery fade">
    <div class="ts-kicker">已 解 锁 &nbsp;${g.length} / ${ENDINGS.length}</div>
    <h1 class="gal-title">结 局 图 鉴</h1>
    <div class="gal-grid">
      ${ENDINGS.map(e => {
        const got = g.indexOf(e.id) >= 0;
        return `<div class="gal-item${got?' got':''}">
          <div class="gal-name">${got ? e.t : '？ ？ ？'}</div>
          <div class="gal-hint">${got ? esc(e.h) : '未 解 锁'}</div>
        </div>`;
      }).join('')}
    </div>
    <div class="ts-note">同一个主结局会因为战争结果与冷战选择读起来完全不同。想收全，前三幕就得开始偏离历史。</div>
    <div class="acts"><button class="btn" id="gal-back">返 回</button></div>
  </div>`;
  document.getElementById('gal-back').addEventListener('click', renderTitle);
  scrollToStart();
}
function resume(){
  if (!loadGame()){ renderTitle(); return; }
  menuMode(false); renderHUD();
  const pending = S._pendingResult;
  const resultScene = pending && SCENES[pending.sceneId];
  const resultOption = resultScene && resultScene.options && resultScene.options[pending.optionIndex];
  if (resultOption && Array.isArray(pending.deltas) && Array.isArray(pending.battles) &&
      SCENES[pending.sceneId]){
    const nextId = pending.nextSceneId || (resultOption.gotoFn ? resultOption.gotoFn(S) : resultOption.goto) || FLOW[FLOW.indexOf(pending.sceneId)+1];
    i = nextId ? FLOW.indexOf(nextId)-1 : FLOW.length-1;
    S.curId = pending.sceneId;
    renderResult(resultScene, resultOption, pending.deltas, pending.battles, pending.extra || '');
    return;
  }
  delete S._pendingResult;
  const id = FLOW[i], sc = SCENES[id];
  if (!sc){ renderEnding(); return; }
  S.curId = id;
  if (sc.decisions) renderDecisions(sc); else renderScene(sc, {restoring:true});
  if (typeof Statistics!=='undefined') Statistics.present();
}

/* ---------- 主推进 ---------- */
function advance(){
  delete S._pendingResult;
  delete S._lastDecision;
  i++;
  while (i < FLOW.length){
    const id = FLOW[i];
    S.curId = id;
    const sc = SCENES[id];
    if (sc && sc.decisions) { renderDecisions(sc); if (typeof Statistics!=='undefined') Statistics.present(); return; }
    if (sc && (!sc.when || sc.when(S))) { renderScene(sc); if (typeof Statistics!=='undefined') Statistics.present(); return; }
    i++;
  }
  renderEnding();
}
function choose(sc, o){
  if (ENDED || SCENES[S.curId]!==sc || !sc.options?.includes(o) || (o.when && !o.when(S)) || S._resolvedScene === S.curId) return;
  const before = effectSnapshot();
  S._resolvedScene = S.curId;
  if (o.purge) S.purgeCount = (S.purgeCount||0) + 1;
  apply(o.fx || {});
  if (o.add) for (const k in o.add) addRaw(k, o.add[k]);
  setFlags(o.flags);
  LOG.push(o.label);
  let battles = [];
  if (o.battle){
    const spec = typeof o.battle === 'function' ? o.battle(S) : o.battle;
    const b = battle(spec.name, spec.enemy, spec);
    apply(b.fx);
    if (battleSucceeded(b)){
      setFlags(o.winFlags);
      for (const k in o.winAdd||{}) addRaw(k,o.winAdd[k]);
    }
    battles.push(b);
  }
  let extra = '';
  if (o.then) extra = o.then(S) || '';
  if (o.goto || o.gotoFn){
    const target = o.gotoFn ? o.gotoFn(S) : o.goto;
    const j = FLOW.indexOf(target);
    if (j >= 0){ i = j - 1; }
  }
  const deltas = effectChanges(before);
  if (typeof WarReports!=='undefined') WarReports.capture(sc,o,battles,deltas);
  if (typeof Statistics!=='undefined') Statistics.record('政策',`${sceneText(sc,sc.title)} · ${o.label}`);
  S._pendingResult = {sceneId:S.curId, optionIndex:sc.options.indexOf(o), deltas, battles, extra, nextIndex:i, nextSceneId:FLOW[i+1]||null};
  saveGame();
  renderResult(sc, o, deltas, battles, extra);
}

/* ============================================================
   流程表
   ============================================================ */
const FLOW_V2 = [
  'p0-intro',
  '0-1','0-2','0-3','dec-prologue',
  'a1-intro','1-1','1-2','1-3','1-4','1-5','a1-end','dec-act1',
  'a2-intro','2-1','2-2','2-3','2-4','2-5','a2-end',
  'a3-intro','3-1','dec-mid3','3-2','3-3a','3-3b','3-5','3-6','3-7','dec-mid3b','3-9','3-10','3-11','3-12',
  'a3-end','3-13',
  'x-left','x-napoleon','x-right','dec-act3',
  'a4-intro','4-1','4-2','4-4','4-3','4-5','4-6','a4-end','dec-act4',
  'a5-intro','5-0','5-1','dec-act5','5-2','5-3','5-4'
];
// Existing saves keep their original order, so no conference or decision is skipped.
const FLOW_V1 = [
  'p0-intro','0-1','0-2','0-3','dec-prologue',
  'a1-intro','1-1','1-2','1-3','1-4','1-5','a1-end','dec-act1',
  'a2-intro','2-1','2-2','2-3','2-4','2-5','a2-end',
  'a3-intro','3-1','dec-mid3','3-2','3-3a','3-3b','3-5','3-6','3-7','dec-mid3b','3-9','3-10','3-11','3-12','3-13',
  'a3-end','dec-act3','x-left','x-napoleon','x-right',
  'a4-intro','4-1','4-2','4-3','4-4','4-5','4-6','a4-end','dec-act4',
  'a5-intro','5-0','5-1','dec-act5','5-2','5-3','5-4'
];
let FLOW = FLOW_V2;

/* ============================================================
   场景数据
   ============================================================ */
const SCENES = {

/* ---------------- 序幕 ---------------- */
'p0-intro': {
  act:0, year:1936, chapter:'序幕', title:'遗 产',
  sub:'1936 年 1 月 · 莫斯科',
  brief:[
    '基洛夫死了。这是两年里第一次有人敢在斯莫尔尼宫的走廊里开枪。案件的结论已经写好，跟事实没有关系。',
    '第一个五年计划刚刚宣布提前完成。生铁产量在纸面上翻了一倍半，第聂伯河水电站的涡轮开始转动。农村那边的数字也在涨——涨的方式是有人不再回信。',
    '这台机器现在有三个问题没有答案：党内那两股反对力量怎么处理，第二个五年计划朝哪个方向使劲，以及那份还没通过的宪法要不要发下去。',
    '机器不需要一个具体的人来发号施令。它只需要一个方向。'
  ]
},

'0-1': {
  act:0, year:1936, chapter:'序幕', title:'两 个 纵 队',
  sub:'定调抉择 · 决定此后二十年的运转方式',
  brief:[
    '内务部递上来的名单排成两个纵队。左边是左翼反对派：托洛茨基仍在国外流亡，季诺维也夫和加米涅夫在等第二次机会。右边是右翼：布哈林还在《消息报》上写社论，语气温和得像什么都没发生。',
    '名单下面压着一张空白表格，填的是处理方式。'
  ],
  options:[
    {k:'A', label:'铁腕 —— 两个纵队一起划掉', flavor:'THE GREAT PURGE', purge:true,
     fx:{PAR:20, LEFT:-40, RIGHT:-30, ARMY:-8, IND:-5, MOR:-5},
     flags:{purgeStart:true},
     verdict:'名单被退回内务部，附一句话：加快。',
     res:['反对派的影响力被压低，政治控制更集中。代价写在红军、工业和民心的账本上。'],
     tone:'bad'},
    {k:'B', label:'分化 —— 拉一派，打一派', flavor:'DIVIDE ET IMPERA',
     fx:{PP:50, PAR:5, LEFT:10, RIGHT:-10, STAL:-5},
     flags:{divide:'left'},
     verdict:'名单被分成两份，一份加批注，一份退回。',
     res:['左翼被暂时吸纳，右翼受到排挤。政治资本增加，斯大林派对新的平衡并不放心。'],
     tone:''},
    {k:'C', label:'容忍 —— 让争论留在党内', flavor:'FREEDOM OF DEBATE',
     fx:{PAR:-10, LEFT:15, RIGHT:15, MOR:-10, STAL:-10},
     flags:{tolerance:true},
     verdict:'名单被锁进抽屉。有人松了口气，有人记住了这件事。',
     res:['偏执下降，两派获得发言空间；公开争论也让民众暂时担忧政策摇摆。后续可在决议台投入政治资本恢复党内讨论。'],
     tone:''}
  ]
},

'0-2': {
  act:0, year:1936, chapter:'序幕', title:'第 二 个 五 年 计 划',
  sub:'定调抉择 · 决定工厂往哪里长',
  brief:[
    '第一个五年计划的账本里有一半是假的，但剩下那一半是真的：马格尼托哥尔斯克、高尔基汽车厂、乌拉尔机械厂，全部建起来了。',
    '第二个五年计划的草案有四个版本摆在桌上，厚度一样，内容互相矛盾。'
  ],
  options:[
    {k:'A', label:'重工业继续优先', flavor:'THIRD FIVE YEAR PLAN',
     fx:{IND:40, MOR:-12, ARMY:5},
     verdict:'钢和铁。别的不谈。',
     res:['工业以最快速度堆高。住房、面包、日用品继续排队。'],
     tone:''},
    {k:'B', label:'转向民生 —— 住房、疫苗、学校', flavor:'SOCIAL WELFARE / MASS IMMUNIZATIONS',
     fx:{MOR:18, IND:10, ARMY:-3},
     verdict:'让机器先喘一口气。',
     res:['R56 意义上的社会线：大众免疫、教育倡议、工人文化。工厂增长慢了，但农村开始回信了。'],
     tone:'good'},
    {k:'C', label:'转军工 —— 战争比所有人想的都近', flavor:'SHIFT TO ARMAMENTS PRODUCTION',
     fx:{ARMY:15, IND:15, MOR:-8},
     flags:{guns:true},
     verdict:'把民用车间改成坦克车间。',
     res:['五年后这笔钱会派上用场。代价是现在没人相信战争真的会来。'],
     tone:''},
    {k:'D', label:'均衡 —— 请外国专家，自己做图纸', flavor:'NATIONAL SPECIALISTS / FOREIGN EXPERTS',
     fx:{IND:22, MOR:-2, PP:30},
     verdict:'进口的机器，仿制的图纸。',
     res:['工业稳步推进，没有突出成绩，也没有明显短板。'],
     tone:''}
  ]
},

'0-3': {
  act:0, year:1936, chapter:'序幕', title:'那 份 宪 法',
  sub:'定调抉择 · 法理工具还是留白',
  brief:[
    '宪法草案已经在抽屉里躺了一年。它写着苏联最高苏维埃、普遍选举权、以及一长串不会兑现的权利。',
    '它也写着另一样东西：在法理上，反对派从此有了明确的定义。'
  ],
  options:[
    {k:'A', label:'通过 —— 斯大林宪法', flavor:'THE STALIN CONSTITUTION',
     fx:{PP:60, MOR:10, STAL:10},
     flags:{constitution:true},
     verdict:'最高苏维埃第一次开会时，全体起立鼓掌四十分钟。',
     res:['清洗从此有法理外衣。后续清洗决议的政治资本成本降低 20%，军力和民心等损失仍会发生。'],
     tone:''},
    {k:'B', label:'推迟 —— 再放一放', flavor:'—',
     fx:{PAR:15, MOR:-8},
     verdict:'草案被重新塞回抽屉。',
     res:['机器保留了灵活性。同时也保留了一个将来能被别人翻出来的东西。'],
     tone:''}
  ]
},

'dec-prologue': {
  decisions:true, act:0, year:1936, chapter:'序幕', title:'决 议 台',
  sub:'序幕阶段 · 资源分配',
  brief:['第二幕之前，这台机器还有一些可以立刻执行的动作。它们不消耗时间，只消耗资源。',
         '政治资本和内务部的产能是有限的。用完了就没了。']
},

/* ---------------- 第一幕 ---------------- */
'a1-intro': {
  onEnter: () => ({ deltas:{PP:60} }),
  act:1, year:1937, chapter:'第一幕 · 钢铁与血', title:'钢 铁 与 血',
  sub:'1937 – 1938 · 大清洗与五年计划同时进行',
  brief:[
    '工业产量在继续爬。同一时间，内务部的车在夜里比以前多了一倍。',
    '这两件事由同一台机器同时完成，而且它完成得很好。这才是最让人不安的地方。',
    '现在有三份文件需要批复：一份来自军方，一份来自内务部，一份来自列宁格勒物理研究所。'
  ]
},

'1-1': {
  act:1, year:1937, chapter:'第一幕', title:'图 哈 切 夫 斯 基 案',
  sub:'核心抉择 · 全作分歧最大的一刀',
  brief:[
    '内务部送来一份据称来自德军总参谋部的文件，说红军高层正在策划政变。文件的纸张是真的，德语也是真的，日期对不上。',
    '这台机器现在要决定：是让它是真的，还是让它是假的。'
  ],
  options:[
    {k:'A', label:'批准 —— 清洗军方高层', flavor:'THE MILITARY CONSPIRACY', purge:true,
     fx:{ARMY:-22, PAR:-15, STAL:8, MOR:-6},
     flags:{napoleon:false, tukh:false},
     verdict:'图哈切夫斯基、乌博列维奇、叶戈罗夫、布柳赫尔，在同一天被带走。',
     res:['军内再没有政治威胁。纵深作战学说线随之永久关闭。',
          '1941 年，红军要用没有大脑的躯体去挡住德军的进攻。'],
     tone:'bad'},
    {k:'B', label:'保住 —— 元帅留在总参谋部', flavor:'APPROACH TUKHACHEVSKY',
     fx:{PAR:25, ARMY:15, STAL:-10, LEFT:5},
     flags:{napoleon:true, tukh:true},
     verdict:'文件被宣布为伪造，作者被宣布为间谍。',
     res:['这条路打开纵深作战与大机械化的学说线，也让总参谋部第一次握住了实权。',
          '代价是这个国家里多了一个有军队支持、并且知道这一点的人。'],
     tone:''},
    {k:'C', label:'拖延 —— 只清理边缘', flavor:'—', purge:true,
     fx:{PAR:12, ARMY:-6},
     flags:{napoleon:false, tukh:true, officerCorpsPurged:true},
     verdict:'三个人被带走，都是副职。元帅们的名字一个没动。',
     res:['折中方案。既没有完整的军官团，也没有完整的控制。'],
     tone:''}
  ]
},

'1-2': {
  act:1, year:1937, chapter:'第一幕', title:'集 体 化 的 代 价',
  sub:'核心抉择 · 工业与农村之间',
  brief:['粮食收购指标又上调了。指标本身没问题，问题是要完成它，得先决定谁交不起。'],
  options:[
    {k:'A', label:'全速推进 —— 富农作为一个阶级被消灭', flavor:'THE COLLECTIVIZATION',
     fx:{IND:20, MOR:-25, RIGHT:-20},
     flags:{famine:true},
     verdict:'拖拉机站建起来了，交不起粮的人被划成了另一个阶级。',
     res:['在这条架空路线中，追加征购进一步挤压农村生计。饥荒与逃亡的风险上升，死亡不会出现在产量表里。'],
     tone:'bad'},
    {k:'B', label:'有节制 —— 分三年完成，允许自留地', flavor:'—',
     fx:{IND:10, MOR:-10, RIGHT:5},
     verdict:'进度放慢。基层干部对此不满。',
     res:['没有大规模饥荒。集体化的完成时间推后，但农村没有崩掉。'],
     tone:''},
    {k:'C', label:'退让 —— 让农民留在土地上', flavor:'THE POWER OF THE PEASANTRY',
     fx:{IND:5, MOR:12, RIGHT:25, PAR:15},
     verdict:'收购指标被下调，自留地合法化。',
     res:['农村支持回来了。右翼拿到了一面旗子，而偏执开始上升——因为没有交粮的人必须有人负责。'],
     tone:''}
  ]
},

'1-3': {
  act:1, year:1938, chapter:'第一幕', title:'叶 若 夫 还 是 贝 利 亚',
  sub:'核心抉择 · 决定清洗的形态',
  brief:[
    '叶若夫把清洗做成了一条流水线：效率极高，配额按地区下达，名单不够就补。他本人也开始睡不好觉。',
    '贝利亚站在走廊另一头，手里拿着一份更薄的名单。他的方案是：只清洗该清洗的人，并且由他来决定谁该清洗。'
  ],
  options:[
    {k:'A', label:'让叶若夫继续', flavor:'NKVD PRIMACY', purge:true,
     fx:{PAR:20, MOR:-6},
     flags:{yezhov:true},
     verdict:'配额指标照旧下达到各州。',
     res:['清洗效率在此后两幕维持在最高水平。内务部本身成为一台不受控制的机器。'],
     tone:'bad'},
    {k:'B', label:'换上贝利亚', flavor:'THE FAITHFUL SERVANT',
     fx:{PAR:-10}, flags:{beria:15},
     verdict:'叶若夫被调离内务部。他很清楚这意味着什么。',
     res:['贝利亚获得初始势力 15。后续可在决议台给内务部专项授权，换取短期控制力，同时承担权力向他集中的代价。'],
     tone:''},
    {k:'C', label:'清算叶若夫', flavor:'—', purge:true,
     fx:{PAR:-20, MOR:-10}, flags:{beria:0},
     verdict:'叶若夫被自己建立的程序处理掉了。',
     res:['内务部一时虚弱。此后清洗的规模会小一个档次。'],
     tone:'good'}
  ]
},

'1-4': {
  act:1, year:1938, chapter:'第一幕', title:'原 子 弹 工 程',
  sub:'长期投注 · 1949 年才结算',
  brief:[
    '列宁格勒物理研究所递上来一份估算：铀-235 分离需要的电力，相当于一座中型城市全年用电量。',
    '1938 年末，核裂变研究正在改变物理学的边界。军用设想仍未得到验证，这份超前的工程预案属于本作的架空分支。'
  ],
  options:[
    {k:'A', label:'全力投入', flavor:'SOVIET ATOMIC BOMB PROJECT',
     when:S=>S.IND>=30, lock:'需要工业 ≥ 30 才能承担完整项目',
     fx:{IND:-30}, flags:{nuclear:40},
     verdict:'三个新的研究所成立，代号保密。',
     res:['1949 年可以完成试爆。十年的账，现在开始记。'],
     tone:''},
    {k:'B', label:'小规模研究', flavor:'—',
     when:S=>S.IND>=10, lock:'需要工业 ≥ 10',
     fx:{IND:-10}, flags:{nuclear:15},
     verdict:'保留一个实验室和一批理论物理学家。',
     res:['进度缓慢。1953 年之前不会开花结果。'],
     tone:''},
    {k:'C', label:'暂缓', flavor:'—',
     fx:{IND:10}, flags:{nuclear:0},
     verdict:'备忘录被退回，理由是纸张短缺。',
     res:['省下的资源现在有用。1945 年美国人会告诉你它到底值多少。'],
     tone:''}
  ]
},

'1-5': {
  act:1, year:1938, chapter:'第一幕', title:'军 队 的 形 态',
  sub:'学说抉择 · 决定 1941 年的样子',
  brief:['新的一批军事学说草案送上来。四份，互相不兼容。'],
  options:[
    {k:'A', label:'纵深作战 —— 大机械化突击群', flavor:'DEEP BATTLE',
     fx:{ARMY:18, IND:-15}, when:S=>S.napoleon && S.IND>=15,
     lock:'需要保住图哈切夫斯基 且 工业 ≥ 15',
     verdict:'三个坦克军、五个机械化军按新编制组建。',
     res:['红军在三幕之后会拥有一套能反攻的理论。在此之前，它需要时间。'],
     tone:'good'},
    {k:'B', label:'恢复政治委员制度', flavor:'KEEP COMMISSARS',
     fx:{ARMY:-10, STAL:15, PAR:-10},
     verdict:'每个师部多了一张桌子，桌上坐着一个人。',
     res:['党对军队的控制回到 1937 年的水平。指挥效率反而下降。'],
     tone:''},
    {k:'C', label:'恢复哥萨克部队', flavor:'RESTORE COSSACK UNITS',
     fx:{ARMY:8, MOR:8},
     verdict:'顿河和库班的骑兵师重新挂上了传统的番号。',
     res:['骑兵在现代战争里价值有限，但士气是真实的。'],
     tone:''},
    {k:'D', label:'炮兵至上 —— 大炮兵主义', flavor:'SOVIET ARTILLERY',
     fx:{ARMY:12, IND:-10}, when:S=>S.guns && S.IND>=10,
     lock:'需要第二个五年计划转向军工 且 工业 ≥ 10',
     verdict:'火炮产量提高到世界第一。',
     res:['突破时会有用。机动时不会有。'],
     tone:''}
  ]
},

'a1-end': {
  act:1, year:1938, chapter:'第一幕', title:'第 一 幕 结 算',
  sub:'1936 – 1938 已执行完毕',
  onEnter: (S) => {
    const parts = [], deltas = {};
    if (S.ARMY <= 40){ S.flags_weakArmy = true; parts.push('<p>红军战力已经低于可控线。所有军事行动将按缺员状态计算。</p>'); }
    if (S.LEFT >= 55 || S.RIGHT >= 55){ S.unrest = true; parts.push('<p>党内出现了一个够大的反对派群体。它现在还只在会议室里活动。</p>'); }
    if (S.PAR >= 75){ parts.push('<p>偏执已经越过临界。内务部开始不需要命令了。</p>'); }
    const purges = interlude();
    purges.forEach(p => {
      for (const k in p.fx) deltas[k] = (deltas[k]||0) + p.fx[k];
      parts.push('<p><em>' + p.text + '</em></p>');
    });
    return { deltas, html: parts.length ? '<div class="brief">' + parts.join('') + '</div>' : '' };
  },
  brief:['第一个五年计划结束，第二个正在进行。红军的名册短了一截，工厂的名单长了一截。']
},

'dec-act1': {
  decisions:true, act:1, year:1938, chapter:'第一幕', title:'决 议 台',
  sub:'幕间 · 资源分配',
  brief:['距离下一份条约还有一年。这段时间可以用来做很多事，也可以什么都做不了。']
},

/* ---------------- 第二幕 ---------------- */
'a2-intro': {
  onEnter: () => ({ deltas:{PP:60} }),
  act:2, year:1939, chapter:'第二幕 · 魔鬼的交易', title:'魔 鬼 的 交 易',
  sub:'1939 – 1941 · 条约、瓜分与筑墙',
  brief:[
    '1939 年 8 月。希特勒的使节在莫斯科等回话，英法的军事代表团还在船上，据说船开得很慢。',
    '三个方向都是可行的：和西方结盟、和德国做一笔生意、或者谁也不靠，独自把自己的墙砌高。',
    '不论选哪一条，有一件事是确定的——战争会来，来的那一天取决于今天的签字。'
  ]
},

'2-1': {
  act:2, year:1939, chapter:'第二幕', title:'1939 年 的 选 择',
  sub:'全局最大分叉 · 决定战争时间与预警',
  brief:['三条路摆在桌上。每一条都有代价，代价的大小取决于 1941 年 6 月那天谁会先得到消息。'],
  options:[
    {k:'A', label:'与德国签约 —— 那份附议定书', flavor:'APPROACH GERMANY',
     fx:{IND:25, COM:-30, MOR:-5},
     flags:{warYear:1941, warning:1.0, pact:true}, add:{enemyMod:15, westTrust:-15},
     verdict:'克里姆林宫的走廊里出现了万字旗。合影时双方都笑得很自然。',
     res:['东波兰、波罗的海、比萨拉比亚进入势力范围，工业获得两年的喘息。',
          '代价是：1941 年 6 月 22 日那天，边境上不会有任何人提前告诉你。'],
     tone:''},
    {k:'B', label:'集体安全 —— 与英法结盟', flavor:'POLICY OF COLLECTIVE SECURITY',
     fx:{COM:25, IND:10, MOR:5},
     flags:{warYear:1942, warning:0.7, allied:true}, add:{westTrust:10},
     verdict:'军事代表团终于上岸了。谈判进行了十一天。',
     res:['战争推后一年，而且这次有完整预警。',
          '但英法拖到最后一天才签，期间什么承诺都没兑现。'],
     tone:'good'},
    {k:'C', label:'共产国际输出革命', flavor:'THE COMINTERN',
     fx:{COM:30, LEFT:25, IND:-10, MOR:-5},
     flags:{warYear:1942, warning:0.9, cominternPath:true}, add:{westTrust:-20},
     when:S=>S.LEFT>=50, lock:'需要左翼 ≥ 50',
     verdict:'西班牙、中国、法国的支部都收到了新指示。',
     res:['德国先动手打西方。你有额外的一年。',
          '输出革命损害西方信任；战时请求租借物资的政治成本会翻倍。'],
     tone:''},
    {k:'D', label:'单独安全 —— 谁也不靠，把墙砌高', flavor:'POLICY OF INDIVIDUAL SECURITY',
     when:S=>S.IND>=20, lock:'需要工业 ≥ 20 修筑防线',
     fx:{IND:-20, PAR:-10, MOR:5},
     flags:{warYear:1941, warning:0.8, alone:true}, add:{fort:20},
     verdict:'没有签字，没有合影，没有盟友。',
     res:['防线值大幅提高，偏执下降——因为不再需要猜测盟友的意图。',
          '代价是没有任何人会分担这场战争。'],
     tone:''}
  ]
},

'2-2': {
  act:2, year:1939, chapter:'第二幕', title:'冬 季 战 争',
  sub:'列宁格勒离边境只有三十二公里',
  brief:['芬兰人拒绝交换领土。地图上，列宁格勒的北侧几乎是贴着国界线画的。'],
  options:[
    {k:'A', label:'全面入侵 —— 两周拿下赫尔辛基', flavor:'THE WINTER WAR',
     fx:{MOR:-8, ARMY:-6}, when:S=>S.ARMY>=55, lock:'红军 ≥ 55 时可用此版本',
     add:{fort:15, enemyMod:10},
     verdict:'四十万人在雪地里推进。四个月后，前线推到卡累利阿地峡。',
     res:['打赢了，但赢得很难看。一个中立观察员在报告里写下了红军暴露的每一个问题，那份报告现在在柏林。'],
     tone:''},
    {k:'A', label:'全面入侵 —— 但红军现在是缺员的', flavor:'THE WINTER WAR',
     fx:{MOR:-14, ARMY:-10, PAR:10}, when:S=>S.ARMY<55,
     add:{fort:15, enemyMod:28},
     verdict:'四十万人在雪地里推进。伤亡数字用了六个月才统计出来。',
     res:['割地拿到了，代价高得不成比例。柏林由此得出了一个结论，并且写进了巴巴罗萨的作战计划里。'],
     tone:'bad'},
    {k:'B', label:'有限目标 —— 只要卡累利阿地峡', flavor:'SECURE LENINGRAD',
     when:S=>S.IND>=10, lock:'需要工业 ≥ 10 承担交换与边防调整',
     fx:{IND:-10, MOR:3},
     flags:{finlandNeutral:true}, add:{fort:8, enemyMod:5},
     verdict:'谈判在莫斯科进行，条件比入侵温和得多。',
     res:['芬兰被推远了三十二公里，但没有倒向德国。北线在 1941 年会安静很多。'],
     tone:'good'},
    {k:'C', label:'外交解决 —— 用汉科半岛换', flavor:'—',
     fx:{COM:10},
     flags:{leninRisk:true},
     verdict:'交换协议签署。列宁格勒仍然在火炮射程内。',
     res:['没有战争，没有伤亡，也没有缓冲。列宁格勒会为此付出代价。'],
     tone:''},
    {k:'D', label:'全面吞并 —— 走波罗的海那套流程', flavor:'—',
     fx:{IND:15, COM:-25, MOR:-10},
     add:{enemyMod:8, nationalQ:10},
     verdict:'一个傀儡政府成立，然后被并入联盟。',
     res:['北线彻底解决，国际声誉彻底破产。芬兰的抵抗组织会一直存在到战争结束。'],
     tone:'bad'}
  ]
},

'2-3': {
  act:2, year:1940, chapter:'第二幕', title:'波 罗 的 海 与 比 萨 拉 比 亚',
  sub:'缓冲区问题',
  brief:['从芬兰湾到黑海，边界线上有三百公里的缺口。填上它的方式会决定这个国家在别人眼里是什么。'],
  options:[
    {k:'A', label:'最后通牒 —— 三国与比萨拉比亚一起解决', flavor:'CLAIMS IN BALTIC',
     fx:{IND:20, MOR:-5, COM:-10},
     flags:{baltic:true}, add:{fort:10, nationalQ:20},
     verdict:'三个外交部长在莫斯科签了字。签字时窗外停着红军。',
     res:['缓冲区到手，防线前推四百公里。',
          '代价是这片新领土上的人不认为自己是苏联人——这件事在 1941 年会以另一种形式爆发。'],
     tone:''},
    {k:'B', label:'分阶段 —— 先经济协定，再谈驻军', flavor:'RESPECT BALTIC SELF-DETERMINATION',
     fx:{IND:12, MOR:3, COM:5},
     flags:{baltic:true}, add:{fort:6, nationalQ:8},
     verdict:'先是贸易协定，然后是互助条约，然后才是驻军。',
     res:['慢，但每一层都有法律形式。当地的抵抗会弱一个档次。'],
     tone:'good'},
    {k:'C', label:'不吞并 —— 让他们自己做决定', flavor:'—',
     fx:{COM:15, MOR:5},
     flags:{baltic:false},
     verdict:'边界线没有变。波罗的海三国的首都在观望。',
     res:['防线短了四百公里，也缺了一块缓冲。1941 年德军会从这里直接开进列宁格勒方向。'],
     tone:''}
  ]
},

'2-4': {
  act:2, year:1940, chapter:'第二幕', title:'军 队 整 顿',
  sub:'三年时间，还来得及改多少',
  brief:['总参谋部送来一份内部评估：按当前状态，与德军的第一次会战会在三周内打成消耗战。这个数字没有被公开。'],
  options:[
    {k:'A', label:'从营地放人 —— 恢复军官团', flavor:'FIRST REHABILITATED MILITARY',
     fx:{ARMY:15, PAR:10, STAL:-8},
     verdict:'几千名军官从科雷马回来，军衔恢复，职务待定。',
     res:['指挥层补上了。偏执因此上升——放回来的人记得是谁把他们送走的。'],
     tone:'good'},
    {k:'B', label:'强化政治控制 —— 每个师部都坐一个人', flavor:'KEEP COMMISSARS',
     fx:{STAL:12, PAR:-12, ARMY:-5},
     verdict:'政治委员的签字重新成为作战命令生效的必要条件。',
     res:['军队在政治上完全可靠。在军事上，命令会慢一步。'],
     tone:''},
    {k:'C', label:'惩戒营与屏障部队', flavor:'PENAL BATTALIONS / BARRIER TROOPS',
     fx:{ARMY:5, MOR:-8},
     flags:{harsh:true},
     verdict:'相关条例已经起草完成，等战争爆发后生效。',
     res:['第三幕所有死守类选项的判定效果提高四分之一。',
          '代价是这些人不会被计入战斗损失之外的任何统计。'],
     tone:'bad'}
  ]
},

'2-5': {
  decisions:true,
  act:2, year:1941, chapter:'第二幕', title:'工 业 的 天 平',
  sub:'战前最后的机会 · 在决议台分配资源',
  brief:[
    '最后一份战前预算送到桌上。工厂数量是固定的，防线长度不是。',
    '新边界上的工事是一笔冒险的赌注：如果 1941 年 6 月之前没修满，它就一点用都没有。',
    '斯大林防线是旧的、结实的、位置靠后的。莫洛托夫防线是新的、脆弱的、位置靠前的。'
  ]
},

'a2-end': {
  act:2, year:1941, chapter:'第二幕', title:'1941 年 6 月 22 日',
  sub:'战争爆发',
  onEnter: (S) => {
    const mol = S['_c_fort-molotov'] || 0;
    const stalin = S.fortStalin || 0;
    const molotov = S.fortMolotov || 0;
    const built = mol >= 3;
    S.fort = (S.fort || 0) + stalin + (built ? molotov : 0);
    const parts = [];
    if (molotov > 0 && !built){
      parts.push('<p><em>莫洛托夫防线只完成了三分之一。浇筑到一半的碉堡停在原野上——它们的位置在新边界，而红军的仓库和铁路全在旧边界。这些工事一点用都没有。</em></p>');
    } else if (built) {
      parts.push('<p>新边界上的工事按期完工。前沿阵地第一次有了水泥。</p>');
    }
    parts.push('<p>开战时的防线值：' + S.fort + '。</p>');
    return { deltas: {}, html: '<div class="brief">' + parts.join('') + '</div>' };
  },
  brief: function(S){
    const warn = S.warning >= 1.0 ? '没有预警' : S.warning >= 0.8 ? '部分预警' : '完整预警';
    return [
      '凌晨三点四十五分，边境线上的电话开始响。',
      '六百万人、三千六百辆坦克、四千架飞机，从波罗的海到黑海同时越过国界。',
      '这台机器在战争爆发时的状态：预警等级' + warn + '，边境驻军战力 ' + S.ARMY + '。',
      '接下来的四年，每一个决定都是用城市换来的。'
    ];
  }
},

'dec-mid3': {
  decisions:true, act:3, year:1941, chapter:'第三幕', title:'决 议 台',
  sub:'战时分配 · 第一轮',
  brief:['边境线已经丢了。现在能做的只有两件事：把工厂拆下来往东送，把人重新填进部队。',
         '每一条决议都要从别的方向挪资源。']
},

'dec-mid3b': {
  decisions:true, act:3, year:1943, chapter:'第三幕', title:'决 议 台',
  sub:'战时分配 · 第二轮',
  brief:['库尔斯克之后，战线第一次不再后移。这段时间可以用来补充建制，也可以用来清账。']
},

/* ---------------- 第三幕 ---------------- */
'a3-intro': {
  onEnter: () => ({ deltas:{PP:60} }),
  act:3, year:1941, chapter:'第三幕 · 伟大的卫国战争', title:'伟 大 的 卫 国 战 争',
  sub:'1941 – 1945 · 用城市换时间',
  brief:[
    '第一周，边境军区失去了联系。第二周，明斯克陷落。第三周，基辅被合围。',
    '接下来的四年里，每一次战役都会用同一个公式衡量：红军战力、工事、民心、预警，除以德军的强度。',
    '这台机器要做的，是在这个公式不站在自己这边的时候，把时间拖下去。'
  ]
},

'3-1': {
  act:3, year:1941, chapter:'第三幕', title:'边 境 战 役',
  sub:'巴巴罗萨 · 第一场判定',
  brief:['德军装甲集群以每天五十公里的速度推进。前线的报告互相矛盾，但都提到同一个词：包围。'],
  onEnter: mobil(36),
  options:[
    {k:'A', label:'死守 —— 一步也不许后退', flavor:'ORDER 227',
     battle:S=>({name:'边境战役', enemy:110, hold:0.85, defensive:true,
                 fx:{ARMY:-15, MOR:-16}}),
     verdict:'第 227 号命令在七月签发，比历史上早了十一个月。',
     res:['拖住了德军的推进节奏。代价是成建制的部队被合围在东欧的包围圈里，再没有走出来。'],
     tone:''},
    {k:'B', label:'弹性防御 —— 用空间换建制', flavor:'DEEP BATTLE',
     when:S=>S.napoleon, lock:'需要图哈切夫斯基活着',
     battle:S=>({name:'边境战役', enemy:110, hold:1.15, fx:{ARMY:-4, MOR:-6}}),
     verdict:'放弃白俄罗斯和乌克兰大部，把部队撤到能重新组织的地方。',
     res:['红军保住了骨架。地图上，丢掉的东西要到 1944 年才拿回来。'],
     tone:'good'},
    {k:'C', label:'全线反击 —— 把敌人赶回去', flavor:'—',
     battle:S=>({name:'边境战役', enemy:110, hold:1.65, fx:{ARMY:-18, MOR:-14}}),
     verdict:'反击在第三天开始，在第七天被切断。',
     res:['这不是一场战役的失败，是一次建制的消失。'],
     tone:'bad'},
    {k:'D', label:'焦土 —— 搬走能搬的，烧掉剩下的', flavor:'MOVE INDUSTRY TO THE URALS',
     battle:S=>({name:'边境战役', enemy:116, hold:1.05, fx:{MOR:-14}}),
     flags:{scorched:true}, add:{indSaved:25},
     verdict:'一千五百家工厂开始拆卸、装车、往东运。',
     res:['工业从此不再暴露在敌人面前。代价是撤退变成了迁徙，而迁徙是没有秩序的。'],
     tone:''}
  ]
},

'3-2': {
  act:3, year:1941, chapter:'第三幕', title:'列 宁 格 勒',
  onEnter: S => {
    const result = mobil(38)(S);
    if (!S.leninRisk) return result;
    return {deltas:{...(result.deltas||{}), MOR:-5, IND:-5},
      html:(result.html||'')+'<div class="brief"><p><em>未取得北线缓冲区，近郊工厂提前停产，围城准备更为仓促：工业 −5、民心 −5。</em></p></div>'};
  },
  sub:'1941 年 9 月 · 围城开始',
  brief:['北面的德军切断了最后一条铁路。城市里还有两百五十万人，和够吃四十天的粮食。'],
  options:[
    {k:'A', label:'拉多加湖「生命之路」', flavor:'THE ROAD OF LIFE',
     when:S=>S.IND>=10, lock:'需要工业 ≥ 10 组织运输',
     fx:{IND:-10, MOR:8, ARMY:-3},
     verdict:'卡车在结冰的湖面上排成一条线，每天往返两次。',
     res:['城市活下来了，代价是用最脆弱的运输方式供养一座百万人口的城市。'],
     tone:'good'},
    {k:'B', label:'与工业共存亡 —— 不疏散', flavor:'—',
     fx:{MOR:-15, COM:5}, flags:{noEvac:true},
     verdict:'工厂继续在炮火射程内生产，工人就住在车间旁边。',
     res:['工业产能保住了。城里的死亡人数要到战后才会公布。'],
     tone:''},
    {k:'C', label:'优先疏散平民', flavor:'—',
     when:S=>S.IND>=15, lock:'需要工业 ≥ 15 组织大规模疏散',
     fx:{MOR:6, IND:-15},
     verdict:'七十万人被分批运过湖。',
     res:['数字上的人道主义。城市的工业基础随之流失。'],
     tone:''},
    {k:'D', label:'放弃城市', flavor:'—',
     fx:{MOR:-20, ARMY:4}, flags:{leningradFallen:true},
     verdict:'撤退命令下达，工厂炸毁，部队向东转移。',
     res:['建制保住了。这座以那位名字命名的城市改名，会成为此后二十年里党内最忌讳的话题。'],
     tone:'bad'}
  ]
},

'3-3a': {
  act:3, year:1941, chapter:'第三幕', title:'远 东 的 师',
  onEnter: mobil(34),
  sub:'莫斯科能等到援军吗',
  brief:[
    '情报部门发来一份报告：日本决定南进，不会在 1941 年进攻西伯利亚。',
    '这份报告的作者是一个在东京的德国人。相信它，需要用三十个师的调动来下注。'
  ],
  options:[
    {k:'A', label:'与日本签中立条约，然后调兵', flavor:'SOVIET-JAPANESE PACT',
     fx:{ARMY:15, COM:-10},
     verdict:'条约在莫斯科签署。西伯利亚师开始通过西伯利亚大铁路西调。',
     res:['三十个师在莫斯科城下出现的时候，德军参谋部以为是新组建的部队。'],
     tone:''},
    {k:'B', label:'不签约 —— 只相信那份情报', flavor:'—',
     fx:{ARMY:12, PAR:5},
     verdict:'远东保持戒备，但抽出三分之二的兵力西调。',
     res:['同样的援军，方式不同。这份信任日后会变成一份档案，被反复引用。'],
     tone:''}
  ]
},

'3-3b': {
  act:3, year:1941, chapter:'第三幕', title:'莫 斯 科',
  sub:'1941 年 10 月 – 12 月 · 标志性抉择',
  brief:['德军先头部队距离市区二十七公里。政府机关已经开始装箱。'],
  onEnter: mobil(42),
  options:[
    {k:'A', label:'留在莫斯科，红场阅兵', flavor:'THE DEFENSE OF MOSCOW',
     battle:()=>({name:'莫斯科保卫战', enemy:78, hold:0.9, defensive:true, fx:{STAL:15}}),
     verdict:'十一月七日，阅兵照常举行，部队从红场直接开往前线。',
     res:['这件事被全世界看到，也被这座城市里的人看到。'],
     tone:'good'},
    {k:'B', label:'撤往古比雪夫', flavor:'—',
     battle:()=>({name:'莫斯科保卫战', enemy:78, hold:1.05, fx:{MOR:-18, PAR:-8}}),
     verdict:'政府机关和外国使团迁往伏尔加河畔。',
     res:['指挥系统完整地转移了。城市的守军在没有最高统帅部的地方打了三个星期。'],
     tone:''},
    {k:'C', label:'交给朱可夫全权指挥', flavor:'—',
     battle:()=>({name:'莫斯科保卫战', enemy:78, hold:0.95, fx:{MOR:8, STAL:-8}}),
     winAdd:{zhukov:20},
     verdict:'作战全权交给总参谋长，一切电报不必抄送。',
     res:['反攻在十二月初开始。一个人因此获得了他在此后二十年里都不打算放弃的东西。'],
     tone:'good'}
  ]
},

'3-5': {
  act:3, year:1941, chapter:'第三幕', title:'租 借 法 案',
  onEnter: mobil(46),
  sub:'1941 – 1942',
  brief:['美国人提出了一份清单：卡车、罐头、铝、机床。清单后面附了一份条件表。'],
  options:[
    {k:'A', label:'接受 —— 按清单签字', flavor:'LEND-LEASE',
     fx:{IND:15, MOR:5, COM:-8},
     verdict:'第一批车队从波斯湾上岸，然后穿过伊朗开进高加索。',
     res:['卡车和铝改变了红军的机动能力。代价是这台机器第一次公开接受了资本主义的施舍。'],
     tone:'good'},
    {k:'B', label:'拒绝 —— 我们不需要施舍', flavor:'—',
     fx:{MOR:6, LEFT:12, COM:5}, add:{enemyMod:10},
     verdict:'答复是一句话：苏联有能力自己打赢这场战争。',
     res:['这句话在宣传上很有用。在后勤上，它意味着此后每一辆卡车都要自己造。'],
     tone:''},
    {k:'C', label:'接受，但用黄金和矿产支付', flavor:'—',
     fx:{IND:8, COM:-2}, flags:{noDebt:true},
     verdict:'协议采用现金结算，不附带战后条款。',
     res:['拿到的物资少了一半，但战后的账本干净。这笔账在 1945 年之后会体现出价值。'],
     tone:''}
  ]
},

'3-6': {
  act:3, year:1942, chapter:'第三幕', title:'斯 大 林 格 勒',
  onEnter: mobil(50),
  sub:'1942 – 1943 · 天王星行动',
  brief:['城市已经被炸成碎砖。双方都把师往同一个点上填，因为城市的名字本身就是筹码。'],
  options:[
    {k:'A', label:'巷战死守，同时准备两翼合围', flavor:'OPERATION URANUS',
     battle:()=>({name:'斯大林格勒战役', enemy:95, hold:0.9, defensive:true, fx:{ARMY:15, MOR:15}}),
     verdict:'第 62 集团军在城市里撑了三个月，两翼的兵力在同一时间集结完毕。',
     res:['包围圈在十一月合拢。二十二个德国师在里面。'],
     tone:'good'},
    {k:'B', label:'撤出城区，保存兵力', flavor:'—',
     battle:()=>({name:'斯大林格勒战役', enemy:66, hold:1.1, fx:{MOR:-10, ARMY:5}}),
     verdict:'部队撤到伏尔加河东岸，城市交给巷战小组。',
     res:['建制保住了，反攻因此推迟了一年。这个延误是可以用年份计算的。'],
     tone:''},
    {k:'C', label:'正面强攻 —— 不计代价夺回城区', flavor:'—',
     battle:()=>({name:'斯大林格勒战役', enemy:66, hold:1.35, fx:{ARMY:-10, MOR:-4}}),
     verdict:'一批一批的师被送进城区。',
     res:['消耗战按消耗战的规则进行，而规则对进攻方不利。'],
     tone:'bad'}
  ]
},

'3-7': {
  act:3, year:1943, chapter:'第三幕', title:'库 尔 斯 克',
  onEnter: mobil(54),
  sub:'1943 年 7 月 · 战线上的突出部',
  brief:['情报说德军会在突出部两翼同时进攻。情报很详细，详细到可能是故意泄露的。'],
  options:[
    {k:'A', label:'相信情报 —— 先挖八道反坦克壕', flavor:'IMPROVE THE STALIN LINE',
     when:S=>S.holds>=1, lock:'需要在此前的战役中至少守住过一次',
     battle:()=>({name:'库尔斯克战役', enemy:84, hold:0.85, defensive:true, fx:{MOR:8, STAL:5}}),
     winAdd:{zhukov:20},
     verdict:'八道防线，一百万颗地雷，在进攻开始前全部就位。',
     res:['德军的突击力量被防线消耗。红军不再需要战略后撤，朱可夫先防后攻的主张获得承认，威望上升。'],
     tone:'good'},
    {k:'B', label:'抢先反攻 —— 在敌人准备好之前', flavor:'—',
     battle:()=>({name:'库尔斯克战役', enemy:60, hold:1.3, fx:{MOR:-6}}),
     verdict:'反攻提前了十天，正好撞上对方的集结。',
     res:['突出部保住了，付出的是不成比例的代价。'],
     tone:''},
    {k:'C', label:'后撤诱敌，拉长德军补给线', flavor:'—',
     battle:()=>({name:'库尔斯克战役', enemy:76, hold:0.95, fx:{MOR:-8}}),
     verdict:'突出部被主动放弃，部队后撤到第二道防线。',
     res:['德军的攻势在消耗完油料之后自己停下来了。地图上丢了两百公里。'],
     tone:''}
  ]
},

'3-9': {
  act:3, year:1943, chapter:'第三幕', title:'第 二 战 场 的 外 交 战',
  onEnter: mobil(56),
  sub:'1943 – 1944',
  brief:['莫洛托夫在伦敦和华盛顿之间来回飞。每一次会谈的结论都是同一个词：尽快。'],
  options:[
    {k:'A', label:'反复催促，保持耐心', flavor:'—',
     fx:{COM:10, MOR:3},
     verdict:'每次会谈都提出同一份备忘录。',
     res:['丘吉尔承诺在 1944 年开辟第二战场，并且兑现了。'],
     tone:''},
    {k:'B', label:'威胁单独媾和', flavor:'—',
     fx:{COM:-15, MOR:5}, add:{enemyMod:-15, westTrust:-15},
     verdict:'一份未经确认的私下备忘录被送到了伦敦和华盛顿。',
     res:['西线的压力提前到来。西方对莫斯科的信任则永久性地少了一格。'],
     tone:''},
    {k:'C', label:'用共产国际在欧洲制造压力', flavor:'IGNITE THE FLAMES',
     when:S=>S.LEFT>=50, lock:'需要左翼 ≥ 50',
     fx:{COM:15}, add:{enemyMod:-10, westTrust:-8},
     verdict:'意大利和法国的支部收到了新指示，内容包括罢工的时间表。',
     res:['德军的后方开始不稳定。这件事在战后会被西方反复拿出来讲。'],
     tone:''}
  ]
},

'3-10': {
  act:3, year:1944, chapter:'第三幕', title:'巴 格 拉 季 昂',
  onEnter: mobil(58),
  sub:'1944 年 6 月 · 中央集团军群的覆灭',
  brief:['三个方向都可以打。打哪一个，决定了战后谁站在哪张地图上。'],
  options:[
    {k:'A', label:'主攻中央集团军群', flavor:'OPERATION BAGRATION',
     battle:()=>({name:'巴格拉季昂', enemy:82, hold:0.9, fx:{MOR:10, ARMY:6}}),
     verdict:'中央集团军群在两周内被摧毁，德军战线上出现了一个四百公里宽的缺口。',
     res:['红军推进到维斯瓦河。这是这场战争里最干净的一次胜利。'],
     tone:'good'},
    {k:'B', label:'主攻南线，抢先进入巴尔干', flavor:'—',
     battle:()=>({name:'雅西-基什尼奥夫', enemy:88, hold:0.95, fx:{MOR:5}}),
     fx:{COM:15}, add:{nationalQ:15},
     verdict:'罗马尼亚和保加利亚的政权在两个月内更替。',
     res:['抢在盟军之前控制了巴尔干。代价是这片区域要在之后二十年里消化这个结果。'],
     tone:''}
  ]
},

'3-11': {
  act:3, year:1944, chapter:'第三幕', title:'华 沙 起 义',
  onEnter: mobil(58),
  sub:'道德抉择 · 1944 年 8 月',
  brief:['维斯瓦河东岸，红军停止了推进。西岸，华沙城里的人开始起义。',
         '起义的指挥者是伦敦的流亡政府。河对岸听得见枪声。'],
  options:[
    {k:'A', label:'渡河支援', flavor:'—',
     fx:{COM:10, MOR:8, ARMY:-6},
     verdict:'两个集团军强行渡河，在城区外围建立了桥头堡。',
     res:['起义没有被镇压。战后波兰会成为一个半独立的盟友，而不是一个被占领的邻国。'],
     tone:'good'},
    {k:'B', label:'按兵不动，扶持另一个委员会', flavor:'—',
     fx:{MOR:-8, COM:-10}, add:{nationalQ:20},
     verdict:'河对岸的炮声持续了六十三天，东岸的部队在休整。',
     res:['波兰战后由自己人接管。这个结果在此后四十年里一直是这个阵营里最深的裂痕。'],
     tone:'bad'},
    {k:'C', label:'有限接触，两边下注', flavor:'—',
     fx:{MOR:-3, COM:2},
     verdict:'空投了一批武器，同时承认了另一个委员会。',
     res:['两边都不完全信任莫斯科，两边都不能完全脱离它。'],
     tone:''}
  ]
},

'3-12': {
  act:3, year:1945, chapter:'第三幕', title:'柏 林',
  onEnter: mobil(60),
  sub:'1945 年 4 月 · 谁先到',
  brief:['距离柏林还有六十公里。西边，盟军也在推进。这场竞赛的奖品是一整块大陆。'],
  options:[
    {k:'A', label:'全速抢在盟军之前', flavor:'—',
     battle:()=>({name:'柏林战役', enemy:84, hold:0.95, fx:{ARMY:-12, MOR:20, COM:12}}),
     winFlags:{berlinSoviet:true},
     verdict:'两个方面军之间的竞赛比对付德军还激烈。',
     res:['红旗插上国会大厦的照片传遍了世界。这张照片会在之后二十年里定义这场战争的意义。'],
     tone:'good'},
    {k:'B', label:'有序推进，减少伤亡', flavor:'—',
     battle:()=>({name:'柏林战役', enemy:48, hold:0.8, fx:{ARMY:-4, MOR:10, COM:5}}),
     verdict:'炮兵准备按标准流程进行，不是按日程表进行。',
     res:['柏林分区占领。少死了十万人，多了一个需要谈判的对象。'],
     tone:''},
    {k:'C', label:'让盟军先到', flavor:'—',
     fx:{MOR:-10, COM:-10}, flags:{berlinWest:true},
     verdict:'进攻暂停了四天。',
     res:['西线的部队先进了城。这笔账在战后的每一次谈判里都会被翻出来。'],
     tone:''}
  ]
},

'3-13': {
  act:3, year:1945, chapter:'第三幕', title:'战 后 秩 序',
  sub:'波茨坦 · 被解放的欧洲',
  brief:['欧洲的地图摊在桌上。每一块的颜色都要重新涂一遍。',
         '涂色的方式有两种：一种慢，一种快。快的那种不会有人反对，慢的那种不会有人怀念。'],
  options:[
    {k:'A', label:'全部苏维埃化', flavor:'LIBERATION OF THE EUROPEAN',
     fx:{COM:20, MOR:-5}, add:{nationalQ:25},
     verdict:'每个被解放的国家都收到了一份关于政权形式的建议，建议只有一种。',
     res:['这个阵营在东欧是铁的，也是脆的。三十年后你会知道哪一点更重要。'],
     tone:''},
    {k:'B', label:'人民民主 —— 先联合政府，再慢慢来', flavor:'—',
     fx:{COM:5, MOR:5}, add:{nationalQ:5},
     flags:{peoplesDemocracy:true},
     verdict:'过渡期被写进了协议。过渡期的长度没有写。',
     res:['东欧的共产党通过选举逐步掌权。过程更慢，但 1948 年不会出现一个分裂出去的邻居。'],
     tone:'good'},
    {k:'C', label:'尊重自由选举', flavor:'—',
     fx:{COM:-15, MOR:5}, add:{nationalQ:-10, westTrust:30},
     verdict:'选举由国际观察员监督。其中两个国家的共产党输了。',
     res:['结果被接受了。这台机器第一次在赢得战争之后主动放弃了战利品。'],
     tone:''}
  ]
},

'a3-end': {
  act:3, year:1945, chapter:'第三幕', title:'战 争 结 算',
  sub:S=>S.warOutcome==='defeat'?'1945 年 · 战败与停战条款':'1945 年 · 战争结果与重建起点',
  onEnter: (S) => {
    let o;
    if (S.collapses >= 3 || S.MOR <= 15) o = 'defeat';
    else if (S.collapses >= 1 || S.loses >= 3) o = 'costly';
    else if (S.reverses >= 3) o = 'great';
    else if (S.holds >= 3) o = 'held';
    else o = 'stalemate';
    S.warOutcome = o;
    const recovered = Math.max(0, Math.min(META.IND.cap-S.IND, 15, Math.floor((S.indSaved||0)/5)));
    return {deltas:recovered?{IND:recovered}:{}, html:recovered?'<div class="brief"><p><em>东迁厂房恢复产出：已转移工业 '+S.indSaved+'，本阶段工业恢复 +'+recovered+'。</em></p></div>':''};
  },
  brief: function(S){
    return [
      '战争结束了。崩溃 ' + S.collapses + ' 次，失守 ' + S.loses + ' 次，僵持 ' + (S.standoffs||0) + ' 次，守住或反攻 ' + S.holds + ' 次（其中反攻 ' + S.reverses + ' 次）。',
      '接下来的二十年，都从这里开始。'
    ];
  },
  options:[
    {k:'→', only:true, when:S=>S.warOutcome==='defeat',
     label:'战败 · 第二个布列斯特', flavor:'THE SECOND BREST-LITOVSK',
     fx:{MOR:12, IND:-30, ARMY:-20, COM:-25}, flags:{defeat:true},
     gotoFn:()=>'a5-intro',
     verdict:'1945 年签的那份文件，和 1918 年那份只差一个地名。',
     res:['西部领土被划走，工业带丢了一半。这台机器第一次在全世界面前显得像个可以被处理掉的东西。',
          '第四幕被跳过了——一个战败的国家没有资格讨论战后秩序。'],
     tone:'bad'},
    {k:'→', only:true, when:S=>S.warOutcome==='costly',
     label:'惨胜 · 灰烬上的胜利', flavor:'VICTORY IN ASHES',
     fx:{MOR:-12, IND:-25, ARMY:-10}, flags:{costly:true},
     verdict:'柏林拿下来了。代价是两千七百万人，以及整整一代男人。',
     res:['胜利是真的，废墟也是真的。1945 年的苏联是一个打赢了战争、但需要二十年才能站直的国家。'],
     tone:''},
    {k:'→', only:true, when:S=>S.warOutcome==='great',
     label:'伟大胜利 · 从伏尔加河到易北河', flavor:'THE GREAT PATRIOTIC WAR',
     fx:{MOR:15, ARMY:8, COM:15}, flags:{greatVictory:true},
     verdict:'战线没有被真正动摇过。反攻从 1943 年开始，一直到柏林。',
     res:['损失依然巨大，国家的骨架没有断。这台机器证明了自己在极端压力下不会散架。'],
     tone:'good'},
    {k:'→', only:true, when:S=>S.warOutcome==='held',
     label:'守住 · 但没能推到柏林', flavor:'THE LINE HELD',
     fx:{MOR:5, ARMY:4}, flags:{lineHeld:true},
     verdict:'红军守住了每一条主要防线，但反攻的力气用完了。',
     res:['西线盟军走得更远。战后的欧洲地图上，红线比预想的靠东一点——或者说，靠西得不够。'],
     tone:''},
    {k:'→', only:true, when:S=>S.warOutcome==='stalemate',
     label:'僵持和平 · 没有人和解', flavor:'STALEMATE',
     fx:{MOR:-5, IND:-15}, flags:{stalemate:true},
     verdict:'1945 年的战线，和 1941 年的相差四百公里。',
     res:['没有人胜利，也没有人求和。边境线上还埋着 1941 年的尸体，而两国都宣布自己赢了。'],
     tone:''}
  ]
},

'dec-act3': {
  decisions:true, act:4, year:1945, chapter:'第三幕', title:'决 议 台',
  sub:'战争结束 · 重建开始',
  brief:['房子要盖，铁路要修，人要回来。也有一些人不会回来。']
},

/* ---------------- 政变支线（条件触发） ---------------- */
'x-left': {
  act:3, year:1945, chapter:'支线 · 党内', title:'军 事 阴 谋',
  sub:'条件触发 · 左翼 ≥ 60 且偏执 ≥ 80',
  when:S=>S.LEFT>=60 && S.PAR>=80,
  brief:[
    '一份名单在几个人之间传阅，名单上是政治局委员的顺序。',
    '图哈切夫斯基的名字在名单上排第二，仅次于第一行那个名字。',
    '这台机器的某一部分正在决定要不要换掉它的核心。'
  ],
  options:[
    {k:'A', label:'镇压 —— 提前动手', flavor:'ELIMINATE THE LEFT', purge:true,
     fx:{LEFT:-35, PAR:10, ARMY:-8, MOR:-10}, flags:{leftCoupFailed:true},
     verdict:'名单上的人在同一天被捕。图哈切夫斯基没有被牵连，但也没有再被信任。',
     res:['政变失败。这台机器保住了它的核心，代价是又一批有经验的人。'],
     tone:''},
    {k:'B', label:'纵容 —— 让事情发生', flavor:'COUP D ETAT',
     fx:{LEFT:15, STAL:-30, PAR:-25, ARMY:10}, flags:{leftCoup:true},
     verdict:'那个夜里，克里姆林宫的警卫换成了另一支部队。',
     res:['斯大林保留最高领导席位，但接受左翼联盟分享实际决策权。此后的正式继承，将在这一新的权力基础上展开。'],
     tone:''}
  ]
},

'x-napoleon': {
  act:3, year:1945, chapter:'支线 · 军队', title:'红 色 拿 破 仑',
  sub:'条件触发 · 图哈切夫斯基在世 且 红军 ≥ 85',
  when:S=>S.napoleon && S.ARMY>=85,
  brief:[
    '战争结束了，军队还留在原地。总参谋部第一次以军事机构的名义向政治局提交了一份政治文件。',
    '文件的内容是战后重建计划。文件没有写的是：这份计划是谁批准它提交的。'
  ],
  options:[
    {k:'A', label:'让军队留在政治里', flavor:'THE IRON WALL',
     fx:{ARMY:15, MOR:5, STAL:-25, PAR:10, LEFT:-10}, flags:{napoleonGov:true},
     verdict:'元帅们开始坐在政治局会议桌的边上，后来坐到了中间。',
     res:['军方进入行政与重建机关，斯大林仍保留最高领导席位。军事效率与政治权力从此更紧地缠在一起。'],
     tone:''},
    {k:'B', label:'把军队赶回军营', flavor:'DEPOLITICIZE THE MILITARY',
     fx:{ARMY:-15, STAL:20, PAR:20, LEFT:-15}, flags:{napoleonPurged:true, napoleon:false, napoleonGov:false},
     verdict:'图哈切夫斯基被调任一个不存在的军区。',
     res:['文官重新掌握了一切。代价是这台机器在战后失去了唯一一个敢说真话的部门。'],
     tone:''}
  ]
},

'x-right': {
  act:3, year:1945, chapter:'支线 · 党内', title:'政 策 变 更 的 需 要',
  sub:'条件触发 · 右翼 ≥ 60 且 民心 ≤ 35',
  when:S=>S.RIGHT>=60 && S.MOR<=35,
  brief:[
    '农庄的报表和城市的配给单同时摆在桌上。两份文件说的是同一件事：这个体制在养活自己这件事上出了问题。',
    '右翼拿出了一个方案。方案的第一页写着一句话：重新允许市场。'
  ],
  options:[
    {k:'A', label:'允许讨论，但不允许实施', flavor:'THE ENEMIES OF THE STATE',
     fx:{RIGHT:-25, PAR:15, MOR:-5}, flags:{rightCoupFailed:true},
     verdict:'方案被退回，附一份长达四十页的批评。',
     res:['体制没有变。会有更多人在接下来的十年里想起这份被退回的文件。'],
     tone:''},
    {k:'B', label:'实施 —— 回到新经济政策', flavor:'BACK TO THE NEP',
     fx:{RIGHT:20, IND:20, MOR:18, LEFT:-20, COM:-10}, flags:{rightPath:true},
     verdict:'市场回来了，而且是被政权自己请回来的。',
     res:['这台机器的经济逻辑从此改变。它在意识形态上的说服力，也从此开始流失。'],
     tone:''}
  ]
},

/* ---------------- 第四幕 ---------------- */
'a4-intro': {
  onEnter: () => ({ deltas:{PP:60} }),
  act:4, year:1946, chapter:'第四幕 · 胜利的代价', title:'胜 利 的 代 价',
  sub:'1945 – 1949 · 战争赢了，然后呢',
  brief: function(S){
    const p = [];
    p.push('战争结束了。欧洲最强的陆军留在了这个国家手里，同时留下的还有一个被打成废墟的西部和两千七百万个空缺的位置。');
    if (S.nuclear >= 40) p.push('原子弹项目在继续。按目前的进度，1949 年会有结果。');
    else p.push('美国人有原子弹，这个国家还没有。这个差距会在每一次谈判桌上被对方提到。');
    return p;
  }
},

'4-1': {
  act:4, year:1946, chapter:'第四幕', title:'战 后 经 济 模 式',
  sub:'核心抉择 · 钱往哪里去',
  brief:[
    '工厂在战争中被搬到了乌拉尔，现在要不要搬回去，没有人知道。',
    '工人住在工棚和防空洞里，军方要求继续扩产，党要求先解决住房，农业部门要求放宽农庄制度。三份文件摆在同一个桌上。'
  ],
  options:[
    {k:'A', label:'重工业与军工继续 —— 没有和平时代', flavor:'NO TIME FOR PEACE',
     fx:{IND:35, MOR:-20, ARMY:10}, flags:{heavyLine:true},
     verdict:'战争结束的第三个月，军工指标恢复到战前水平。',
     res:['这个国家在 1956 年会拥有世界上最多的坦克。它也会继续排着队买面包。'],
     tone:''},
    {k:'B', label:'消费品与住房优先', flavor:'—',
     fx:{MOR:25, IND:10, ARMY:-8}, flags:{consumerLine:true},
     verdict:'第一批预制板住宅楼在莫斯科郊区开工。',
     res:['民心回到二十年来的最高点。军方对此的意见被记录下来，但没有被采纳。'],
     tone:'good'},
    {k:'C', label:'有限市场化改革 —— 给企业一点自主权', flavor:'—',
     fx:{IND:20, MOR:8, STAL:-10, RIGHT:15}, flags:{reformLine:true},
     verdict:'企业被允许保留一部分利润，指标由数量改为销售额。',
     res:['一个经济学家的方案被采纳。它在 1956 年会显出成效，也会让意识形态部门很不安。'],
     tone:'good'},
    {k:'D', label:'农业自由化', flavor:'BACK TO THE NEP',
     fx:{MOR:20, RIGHT:25, LEFT:-15}, flags:{rightPath:true},
     verdict:'农庄的收购指标下调，农民第一次有余粮可卖。',
     res:['面包问题解决了。代价是这个政权的经济逻辑向 1928 年之前的版本退了一大步。'],
     tone:''}
  ]
},

'4-2': {
  act:4, year:1947, chapter:'第四幕', title:'东 欧 模 式',
  sub:'一圈盟友，还是一圈哨所',
  brief:['十一个国家的政府形式需要确定。确定的方式会决定这个阵营是一件盔甲，还是一具骨架。'],
  options:[
    {k:'A', label:'苏维埃化 —— 全部照抄', flavor:'—',
     fx:{COM:14, MOR:-5}, add:{nationalQ:20},
     verdict:'每个国家都收到了一份关于政权形式的建议，建议只有一种。',
     res:['阵营是铁的，也是脆的。三十年后会知道哪一点更重要。'],
     tone:''},
    {k:'B', label:'人民民主 —— 先联合政府', flavor:'—',
     fx:{COM:8, MOR:3}, flags:{peoplesDemocracy:true},
     verdict:'过渡期被写进协议，过渡期的长度没有写。',
     res:['过程更慢，但 1948 年不会出现一个分裂出去的邻居。'],
     tone:'good'},
    {k:'C', label:'松散联邦 —— 各自决定', flavor:'—',
     fx:{COM:-10, MOR:5}, add:{westTrust:15},
     verdict:'没有一个国家的共产党被要求照抄同一种模式。',
     res:['阵营的凝聚力下降，成员国的合法性上升。'],
     tone:''}
  ]
},

'4-3': {
  act:4, year:1949, chapter:'第四幕', title:'核 与 威 慑',
  sub:'1949 年 8 月 · 第一朵蘑菇云',
  brief: function(S){
    if (S.nuclear >= 40) return ['塞米巴拉金斯克的试验场已经准备好了。按进度，今年可以有结果。',
      '有了它，这个国家在谈判桌上就不必每次都先让步。'];
    if (S.nuclear >= 15) return ['项目在推进，但比预想的慢。',
      '没有它，这个国家在每一次危机里都只能选择更强硬的姿态，因为温和会被当成软弱。'];
    return ['美国人已经在 1945 年用过一次了。这个国家什么都没有。',
      '在这种状态下，唯一可用的工具是常规兵力——而常规兵力需要钱。'];
  },
  options:[
    {k:'A', label:'完成试爆，并立刻启动氢弹', flavor:'—',
     when:S=>S.nuclear>=15 && S.IND>=25, lock:'需要核进度 ≥ 15 且 工业 ≥ 25',
     fx:{IND:-25, COM:12}, add:{nuclear:45}, flags:{hbomb:true},
     verdict:'1949 年 8 月 29 日，第一朵蘑菇云。四年后第二朵更大。',
     res:['这个国家从此在每一次对抗中都有了底牌。底牌的价格从不公开。'],
     tone:'good'},
    {k:'B', label:'只做原子弹，不做氢弹', flavor:'—',
     when:S=>S.nuclear>=15 && S.IND>=12, lock:'需要核进度 ≥ 15 且 工业 ≥ 12',
     fx:{IND:-12, COM:5}, add:{nuclear:20}, flags:{atomicOnly:true},
     verdict:'试爆成功，项目规模随即压缩。',
     res:['有和没有的区别解决了。多和少的区别留着。'],
     tone:''},
    {k:'C', label:'援助中国的核项目', flavor:'—',
     when:S=>S.nuclear>=15 && S.IND>=15, lock:'需要核进度 ≥ 15 且 工业 ≥ 15',
     fx:{COM:20, IND:-15}, add:{nuclear:5},
     verdict:'一批专家和图纸被送过边境。',
     res:['阵营的纵深加深了。这件事在十年后会以一种完全不同的方式回到莫斯科的桌上。'],
     tone:''},
    {k:'D', label:'放弃核武，推动核裁军', flavor:'—',
     fx:{COM:18, MOR:5}, add:{westTrust:20}, flags:{disarm:true},
     verdict:'一份不首先使用、并建议全面禁止的草案被提交到联合国。',
     res:['这是这台机器在冷战中做过的最大一次赌博。它的结果取决于对方是否愿意接。'],
     tone:''}
  ]
},

'4-4': {
  act:4, year:1948, chapter:'第四幕', title:'柏 林 封 锁',
  sub:'1948 年 6 月 · 第一次冷战危机',
  brief:['西方三国在自己的占领区推行货币改革。柏林在苏占区中央，城里流通两种马克。',
         '所有通往西柏林的陆路通道都在这个国家手里。'],
  options:[
    {k:'A', label:'全面封锁 —— 掐断陆路', flavor:'—',
     fx:{COM:10}, add:{westTrust:-20}, flags:{blockade:true},
     verdict:'所有通往西柏林的铁路和公路在同一夜关闭。',
     res:['对方用空运回应。三百天里，运输机昼夜不停地降落——这件事被全世界看到了。'],
     tone:''},
    {k:'B', label:'谈判解决', flavor:'—',
     fx:{COM:3, MOR:3}, add:{westTrust:5},
     verdict:'四国代表重新坐到了一张桌上。',
     res:['危机的处理方式成为此后所有危机的模板：施压、僵持、然后各退一步。'],
     tone:''},
    {k:'C', label:'不封锁 —— 用经济组织反制', flavor:'FOUND THE COMECON',
     fx:{IND:15, COM:5}, add:{westTrust:-8}, flags:{comecon:true},
     verdict:'经济互助委员会成立，成员国的贸易转向内部。',
     res:['对抗从柏林移到了账本上。这是一条更慢、但更难逆转的路线。'],
     tone:'good'}
  ]
},

'4-5': {
  act:4, year:1949, chapter:'第四幕', title:'中 国',
  sub:'1949 年 10 月',
  brief:['长江以北的战争已经结束。一个新的政权在北京成立，它自称是二十年前那个盟友的继承人。',
         '问题只有一个：它是盟友，还是另一个需要防备的邻居。'],
  options:[
    {k:'A', label:'全力支持 —— 条约、专家、工厂', flavor:'—',
     when:S=>S.IND>=10, lock:'需要工业 ≥ 10 提供工厂援助',
     fx:{COM:18, IND:-10},
     verdict:'一份友好同盟互助条约在莫斯科签署。',
     res:['社会主义阵营从此有了两个中心。这个结果在十年后会变成一件复杂的事。'],
     tone:''},
    {k:'B', label:'双面接触 —— 与另一方也保持联系', flavor:'—',
     fx:{COM:-10, MOR:3},
     verdict:'大使馆在两个地方同时保持着联络。',
     res:['灵活性保住了，盟友的信任没有。'],
     tone:''},
    {k:'C', label:'观望', flavor:'—',
     fx:{COM:-5},
     verdict:'承认被推迟了三个月。',
     res:['没有条约，没有专家，也没有负担。边境另一侧的事，由那边自己处理。'],
     tone:''}
  ]
},

'4-6': {
  act:4, year:1952, chapter:'第四幕', title:'内 部 清 算',
  sub:'列宁格勒案与医生阴谋',
  brief:['一份名单送上来，上面是几个战时在列宁格勒任职的干部。名单下面还有一份，涉及克里姆林宫的几位医生。',
         '战时被放松的那部分，现在要收回去。'],
  options:[
    {k:'A', label:'继续清洗', flavor:'THE DOCTORS PLOT', purge:true,
     fx:{PAR:-15, ARMY:-8, MOR:-15}, add:{nuclear:-20},
     verdict:'两份名单都被批准。',
     res:['偏执得到了宣泄。战后本该用来重建的那部分人，又少了一批。'],
     tone:'bad'},
    {k:'B', label:'停止政治迫害', flavor:'—',
     fx:{PAR:10, MOR:12, STAL:-12},
     verdict:'调查被终止，几份已经签发的逮捕令被撤回。',
     res:['军队和科研机构第一次感到不用再提防背后。代价是偏执没有出口。'],
     tone:'good'},
    {k:'C', label:'交给贝利亚去处理', flavor:'—', purge:true,
     when:S=>S.beria>=40, lock:'需要贝利亚势力 ≥ 40',
     fx:{PAR:-20, MOR:-4}, add:{beria:25, nuclear:-5},
     verdict:'贝利亚拿到名单之后，只逮捕了名单上的人。',
     res:['清算规模较小，但仍伤及社会信任和科研。贝利亚借这次授权继续扩大人事网。'],
     tone:''}
  ]
},

'a4-end': {
  act:4, year:1953, chapter:'第四幕', title:'1953 年 3 月',
  sub:'第四幕结算',
  onEnter: (S) => {
    const parts = [];
    if (S.PAR >= 75){ parts.push('<p>偏执一直处在高位。幕间清洗仍在继续。</p>'); }
    const purges = interlude();
    const deltas = {};
    purges.forEach(p => { for (const k in p.fx) deltas[k]=(deltas[k]||0)+p.fx[k]; parts.push('<p><em>'+p.text+'</em></p>'); });
    return { deltas, html: parts.length?'<div class="brief">'+parts.join('')+'</div>':'' };
  },
  brief:['七年过去了。这个国家重建了一半，另一半还在原地。','然后是一个电话没有响的夜晚。']
},

'dec-act4': {
  decisions:true, act:4, year:1953, chapter:'第四幕', title:'决 议 台',
  sub:'最后的资源分配',
  brief:['留给这台机器的时间不多了。这些决定不会再有机会修改。']
},

/* ---------------- 第五幕 ---------------- */
'a5-intro': {
  onEnter: () => ({ deltas:{PP:60} }),
  act:5, year:1953, chapter:'第五幕 · 走向 56', title:'走 向 56',
  sub:'1953 – 1956 · 没有那个人之后',
  brief:['二十年来第一次，这台机器要面对一个问题：没有它最大的那个零件，它是什么。',
         '它不需要回答给自己听，它需要回答给两亿人听。']
},

'5-0': {
  act:5, year:1953, chapter:'第五幕', title:'那 个 夜 晚',
  sub:'自动判定',
  onEnter: (S) => {
    let mode, txt;
    if (S.PAR >= 90 && S.purgeCount >= 6){
      mode = 'assassinated';
      txt = '<p><em>是内务部。或者是一位医生。或者是某个已经没有人记得名字的警卫。结论不重要——重要的是这台机器在最后关头被自己的零件拆掉了。</em></p>';
      S.assassinated = true;
    } else if ((S.napoleon && !S.napoleonPurged && S.ARMY >= 85) || S.napoleonGov){
      mode = 'military';
      txt = '<p><em>总参谋部的车在同一个夜里开进了克里姆林宫。没有人抵抗，因为守卫的指挥官接到了两份命令，而他选择执行第二份。</em></p>';
      S.interimLeader = 'military';
    } else if (S.beria >= 65){
      mode = 'beria';
      txt = '<p><em>名单是贝利亚拟的，副署人是贝利亚，执行人是贝利亚的部门。他做这件事的时候非常有效率——就像他做所有事一样。</em></p>';
      S.interimLeader = 'beria';
    } else {
      mode = 'natural';
      txt = '<p><em>是个普通的中风。发现的时候已经很晚了，或者说，没有人急着发现。</em></p>';
    }
    S.deathMode = mode;
    const label = {assassinated:'被暗杀', military:'被军政府接管', beria:'被贝利亚接管', natural:'自然死亡'}[mode];
    return { deltas:{}, html:'<div class="brief">'+txt+'<p><b style="color:#9E1B1B">权力交接方式：'+label+'</b></p><p>这是权力真空期的临时安排。下一场继承争论将决定长期路线；已有势力与资格限制仍然保留。</p></div>' };
  },
  brief:['1953 年 3 月 5 日，孔采沃别墅的电话响了很久。']
},

'5-1': {
  act:5, year:1953, chapter:'第五幕', title:'继 承 人 之 战',
  sub:'核心抉择 · 决定 1956 年的样子',
  brief:S=>['政治局委员们在同一栋楼里，彼此之间隔着一道走廊和二十年的记忆。',
         S.interimLeader==='military'?'军方已在权力真空期临时接管；这场争论决定是否把临时控制变成长期军政府。':S.interimLeader==='beria'?'贝利亚已临时控制中枢；政治局仍需要决定，是确认他的改革方案，还是另组长期领导层。':'机器需要一个新的核心。选择的核心会决定这个国家此后的方向。'],
  options:[
    {k:'A', label:'集体领导 —— 几个人一起负责', flavor:'COLLECTIVE LEADERSHIP',
     fx:{MOR:15, STAL:-20, PAR:-5}, flags:{route:'khrushchev'},
     verdict:'权力被拆成几份，每一份都由不同的人拿着。',
     res:['这个国家第一次有了一个可以吵架的最高层。'],
     tone:'good'},
    {k:'B', label:'继续 —— 一切照旧', flavor:'THE CULT OF PERSONALITY',
     fx:{MOR:-10, PAR:10, STAL:20}, flags:{route:'stalin'},
     verdict:'画像没有取下来，只是换了一个人的名字。',
     res:['稳定，僵化，并且把 1953 年的问题完整地留给 1956 年。'],
     tone:''},
    {k:'C', label:'贝利亚的技术官僚改革', flavor:'—',
     when:S=>S.beria>=40, lock:'需要贝利亚势力 ≥ 40',
     fx:{IND:20, MOR:8, PAR:-25}, flags:{route:'beria'},
     verdict:'第一个被平反的人是在他签的名单上的人之一。',
     res:['他同时推动了大规模改革和大规模平反。这件事本身就是这个方案的固有风险。'],
     tone:'good'},
    {k:'D', label:'由军队来管', flavor:'—',
     when:S=>S.zhukov>=40 || S.napoleonGov || S.interimLeader==='military', lock:'需要朱可夫威望 ≥ 40 或军队已在政坛',
     fx:{ARMY:15, MOR:5, STAL:-30}, flags:{route:'military'},
     verdict:'元帅坐到了长桌的中间。',
     res:['这可能是效率最高的一种安排，也可能是一种无法退出的安排。'],
     tone:''},
    {k:'E', label:'新市场社会主义', flavor:'BACK TO THE NEP',
     when:S=>S.RIGHT>=60 || S.rightPath, lock:'需要右翼 ≥ 60 或已走向新经济政策',
     fx:{IND:25, MOR:15, LEFT:-15}, flags:{route:'right'},
     verdict:'让市场回来这件事，被写进了党纲。',
     res:['这个国家在物质上会好起来。它在意识形态上不再向任何人许诺什么。'],
     tone:''},
    {k:'F', label:'第四国际的苏联', flavor:'THE FOURTH INTERNATIONAL',
     when:S=>S.LEFT>=60 || S.leftCoup, lock:'需要左翼 ≥ 60 或左翼政变已发生',
     fx:{COM:22, MOR:10, STAL:-25}, flags:{route:'left'},
     verdict:'流放地被平反，一份 1940 年的文献被重新出版。',
     res:['这个国家把自己重新定义为一场运动，而不是一块领土。'],
     tone:''},
    {k:'G', label:'还政于苏维埃', flavor:'ALL POWER TO THE SOVIETS',
     when:S=>S.tolerance && S.MOR>=70, lock:'需要在序幕选择容忍 且 民心 ≥ 70',
     fx:{MOR:25, COM:15, STAL:-25, PAR:-20}, flags:{route:'soviet'},
     verdict:'最高苏维埃获得了它名义上一直拥有的权力。',
     res:['党内分裂立刻加剧。这是唯一一条通向「全权苏维埃」的路。'],
     tone:'good'},
    {k:'H', label:'临时委员会留任 —— 搁置路线争论', flavor:'GOVERN BY INERTIA',
     fx:{MOR:-5, COM:-5}, flags:{route:'caretaker'},
     verdict:'继承安排变成了一项没有截止日期的临时决议。',
     res:['各部门沿用旧计划，重大改革被继续搁置。民心与国际影响小幅流失，这条惯性道路通向「平庸的延续」。'],
     tone:''}
  ]
},

'dec-act5': {
  decisions:true, act:5, year:1953, chapter:'第五幕', title:'决 议 台',
  sub:'新的领导层 · 最后的三年',
  brief:['继承人的席位已经确定。重建、民生与个人崇拜的遗产，仍需要在有限的资源中作出取舍。']
},

'5-2': {
  act:5, year:1956, chapter:'第五幕', title:'去 斯 大 林 化 与 否',
  sub:'1956 年 2 月 · 第二十次代表大会',
  brief:['一份报告已经写好，装在信封里。信封上有两种可能的结局，取决于它是否会被念出来。'],
  options:[
    {k:'A', label:'念出来 —— 全面批判', flavor:'ON THE CULT OF PERSONALITY',
     fx:{MOR:20, STAL:-30, PAR:-15}, add:{destalinUnrest:30}, flags:{destalin:'full'},
     verdict:'报告在大会堂里念了四个小时。没有人中途离场。',
     res:['二十年的账第一次被拿到桌面上。东欧会在半年内开始动摇。'],
     tone:'good'},
    {k:'B', label:'有限批判 —— 只谈个人崇拜的某些方面', flavor:'—',
     fx:{MOR:8, STAL:-12, PAR:-5}, add:{destalinUnrest:10}, flags:{destalin:'limited'},
     verdict:'报告被删去了具体的数据和姓名。',
     res:['一半的真相被公开，一半被留下。留下的那一半会在之后几十年里持续发酵。'],
     tone:''},
    {k:'C', label:'不批判 —— 维持原样', flavor:'—',
     fx:{MOR:-12, STAL:10}, add:{destalinUnrest:-10}, flags:{destalin:'none'},
     verdict:'大会的程序照常进行，报告没有出现。',
     res:['阵营稳定，党内稳定，一切都很稳定。'],
     tone:''}
  ]
},

'5-3': {
  act:5, year:1956, chapter:'第五幕', title:'1956 · 布 达 佩 斯 与 华 沙',
  sub:'阵营的第一次公开裂痕',
  onEnter:S=>{
    if ((S.destalinUnrest||0)<25) return {};
    const loss = S.peoplesDemocracy ? 3 : 8;
    return {deltas:{COM:-loss}, html:'<div class="brief"><p><em>全面批判引发阵营公开争论。'+(S.peoplesDemocracy?'此前保留的联合政府渠道减轻了冲击。':'此前集中的控制方式放大了冲击。')+'阵营影响 −'+loss+'。</em></p></div>'};
  },
  brief:['波兰换了领导人，匈牙利走上了街。两个国家的共产党都在问同一个问题：这个阵营里，成员能不能有自己的路。',
         '坦克停在了边境线上的待命位置。'],
  options:[
    {k:'A', label:'军事干预', flavor:'—',
     fx:{COM:15, MOR:-10}, add:{westTrust:-25, destalinUnrest:-20}, flags:{budapest:true},
     verdict:'坦克在布达佩斯的街道上开了三天。',
     res:['阵营在形式上被保住了。这份文件此后成为这个阵营内部每一场争论的参照物。'],
     tone:'bad'},
    {k:'B', label:'政治解决，撤军', flavor:'—',
     fx:{COM:-15, MOR:8}, add:{destalinUnrest:10},
     verdict:'部队撤回边境以内，谈判在新政府的框架下进行。',
     res:['阵营开始允许成员有不同的路。这件事的长期后果比短期损失大得多。'],
     tone:'good'},
    {k:'C', label:'谈判加经济让利', flavor:'—',
     when:S=>S.IND>=180, lock:'需要工业 ≥ 180',
     fx:{COM:8, IND:-10, MOR:3},
     verdict:'一份新的贸易协议换来了不动武的承诺。',
     res:['用经济手段解决政治问题。这个方案只有在一个富裕到能给东西的国家才成立。'],
     tone:''}
  ]
},

'5-4': {
  act:5, year:1956, chapter:'第五幕', title:'遗 产',
  sub:'1956 年 12 月 · 最后一次分配',
  brief:['新一个五年计划的草案需要确定方向。',
         '这是这台机器在 1956 年会做的最后一个决定。之后的事，由别人来记。'],
  options:[
    {k:'A', label:'军备与威慑', flavor:'—',
     fx:{ARMY:10, IND:10, MOR:-5}, flags:{legacyArms:true},
     verdict:'预算的百分之四十划给国防。',
     res:['这个国家会变得很难被击败，也会变得很难被住在里面。'],
     tone:''},
    {k:'B', label:'民生与住房', flavor:'—',
     fx:{MOR:15, IND:8, ARMY:-5}, flags:{legacyHome:true},
     verdict:'预制板住宅楼的年建设量提高到一千二百万平方米。',
     res:['一代人第一次拥有了自己的房间。这件事不会被写进任何历史书的第一页。'],
     tone:'good'},
    {k:'C', label:'世界革命与阵营扩张', flavor:'—',
     when:S=>S.IND>=5, lock:'需要工业 ≥ 5 提供对外援助',
     fx:{COM:15, MOR:-5, IND:-5}, flags:{legacyWorld:true},
     verdict:'顾问、贷款和武器被送往三大洲。',
     res:['这个国家把自己变成了一场运动。运动不需要面包，但需要人相信它。'],
     tone:''}
  ]
},

};

/* ============================================================
   决议表
   ============================================================ */
const DECISIONS = [
  {id:'party-debate', name:'恢复党内讨论', note:'扩大两派发言空间；现有核心更不安', cost:{PP:30}, max:2, act:[1,2],
   when:S=>!!(S.tolerance||S.divide), fx:{LEFT:10, RIGHT:10, STAL:-5, PAR:5, MOR:3}},
  {id:'nkvd-delegate', name:'内务部专项授权', note:'短期偏执缓解，社会信任受损，贝利亚势力扩大', cost:{PP:30}, max:2, act:[1,2,3,4],
   when:S=>S.beria>=15, fx:{PAR:-5, MOR:-4, STAL:-3}, raw:{beria:15}},
  {id:'purge-army', name:'清洗军队', note:'军官团缩减，红军战力下降', purge:true, cost:{PP:30}, max:3, act:[0,1,2],
   fx:{ARMY:-5, PAR:-10, MOR:-3}},
  {id:'purge-party', name:'清洗党', note:'老布尔什维克又少一批', purge:true, cost:{PP:25}, max:4, act:[0,1,2],
   fx:{STAL:3, LEFT:-4, RIGHT:-4, PAR:-8}},
  {id:'purge-nkvd', name:'清洗内务部', note:'让内务部审查内务部', purge:true, cost:{PP:40}, max:2, act:[1,2,3],
   fx:{PAR:-15, MOR:-2}},
  {id:'collectivize', name:'集体化推进', note:'农业再压缩一轮', cost:{PP:20}, max:2, act:[0,1,2],
   fx:{IND:8, MOR:-6}},
  {id:'fort-stalin', name:'修建斯大林防线', note:'旧边界 · 位置靠后但结实', cost:{PP:25}, max:3, act:[1,2],
   raw:{fortStalin:8}},
  {id:'fort-molotov', name:'修建莫洛托夫防线', note:'新边界 · 未满三次则完全作废', cost:{PP:30}, max:3, act:[2],
   raw:{fortMolotov:8}},
  {id:'tanks', name:'扩产坦克', note:'坦克工厂昼夜不停', cost:{PP:25}, max:3, act:[2,3],
   when:S=>S.ARMY<100, fx:{ARMY:6}},
  {id:'relocate', name:'工业东迁', note:'把工厂装上车皮', cost:{PP:40}, max:2, act:[3],
   raw:{indSaved:25}},
  {id:'lend', name:'请求租借法案物资', note:'卡车、铝、罐头', cost:{PP:25}, max:3, act:[3],
   fx:{IND:10, MOR:4, COM:-5}},
  {id:'partisan', name:'组织敌后游击', note:'铁路、桥梁、通讯线', cost:{PP:20}, max:3, act:[3],
   raw:{enemyMod:-8}},
  {id:'lessons', name:'战争教训 —— 恢复军官团', note:'需要在此前吃过一次失守', cost:{PP:40}, max:2, act:[3,4],
   when:S=>S.loses>=1, fx:{ARMY:12, PAR:5}},
  {id:'mobilize', name:'动员征兵', note:'再征一批，代价是工厂缺人', cost:{PP:25}, max:3, act:[3],
   fx:{ARMY:7, MOR:-5}},
  {id:'religion', name:'宗教和解', note:'重开教堂 · 与第三罗马有关', cost:{PP:15}, max:3, act:[0,1,2,3,4],
   fx:{MOR:3}, raw:{religion:1}},
  {id:'atheist', name:'无神论宣传', note:'关闭剩余的教堂', cost:{PP:15}, max:2, act:[0,1,2],
   fx:{MOR:5, PAR:-3}},
  {id:'amnesty', name:'大赦', note:'打开一些营地的门', cost:{PP:25}, max:1, act:[1,2,3,4],
   fx:{MOR:8, PAR:-10, STAL:-5}},
  {id:'rebuild', name:'战后重建', note:'住房、道路、医院', cost:{PP:30}, max:3, act:[4,5],
   when:S=>S.MOR<100 || S.IND<300, fx:{MOR:10, IND:6}},
  {id:'comintern', name:'扩大阵营', note:'向亚洲和非洲派顾问', cost:{PP:30}, max:3, act:[4,5],
   fx:{COM:12, MOR:-3}},
  {id:'hydrogen', name:'氢弹工程', note:'直接消耗工业产能', cost:{IND:30}, max:2, act:[4],
   when:S=>S.nuclear>=40 && S.nuclear<100, raw:{nuclear:30}},
  {id:'consumer', name:'消费品生产', note:'以工业产能换取住房与日用品', cost:{IND:20}, max:2, act:[4,5],
   fx:{MOR:12}},
  {id:'destalin', name:'反个人崇拜', note:'把画像取下来', cost:{PP:40}, max:1, act:[5],
   fx:{PAR:-25, STAL:-15, MOR:5}},
  {id:'deport', name:'民族迁移', note:'整批人装上列车', cost:{PP:30}, max:2, act:[3,4],
   fx:{MOR:-8, PAR:-8}, raw:{nationalQ:15}}
];

/* ============================================================
   结局名录（图鉴用；顺序即图鉴顺序）
   ============================================================ */
const ENDINGS = [
  {id:'khrushchev', t:'伟 大 的 继 承 人', h:'集体领导，以公开问责或渐进调整走向 1956'},
  {id:'beria',      t:'技 术 官 僚 的 秩 序', h:'秘密警察换成了规划委员会的图表'},
  {id:'military',   t:'红 色 拿 破 仑',   h:'军队走进了克里姆林宫'},
  {id:'right',      t:'新 经 济 道 路',   h:'市场被政权自己请了回来'},
  {id:'left',       t:'永 久 的 革 命',   h:'这个国家不再是一个国家，而是一场运动'},
  {id:'soviet',     t:'全 权 苏 维 埃',   h:'最高苏维埃第一次真正投票'},
  {id:'stalin-quiet',t:'无 声 的 独 裁',  h:'恐惧退潮，集中的权力结构延续'},
  {id:'eternal',    t:'钢 铁 的 永 恒',   h:'画像还挂在那里'},
  {id:'dusk',       t:'苏 维 埃 的 黄 昏', h:'联盟开始一块一块地掉下来'},
  {id:'rome',       t:'第 三 罗 马',      h:'旧王朝在废墟上复辟'},
  {id:'island',     t:'孤 岛',           h:'没有人愿意来莫斯科了'},
  {id:'comecon',    t:'共 同 经 济 体',   h:'经互会变成了一个真正的经济体'},
  {id:'detente',    t:'缓 和',           h:'两个阵营改用开会解决问题'},
  {id:'mediocre',   t:'平 庸 的 延 续',   h:'1956 年和 1936 年没有区别'}
];

/* ============================================================
   本地存档 + 结局图鉴
   ============================================================ */
const SAVE_KEY = 'r56sov.save.v1';
const GALLERY_KEY = 'r56sov.gallery.v1';
const store = {
  get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} },
  del(k){ try { localStorage.removeItem(k); } catch(e){} }
};
function saveGame(){
  if (ENDED) return;
  store.set(SAVE_KEY, { v:1, i:i, LOG:LOG, S:S });
}
function validSave(d){
  return !!(d && d.v === 1 && d.S && typeof d.S === 'object' && !Array.isArray(d.S) &&
    Number.isInteger(d.i) && d.i >= 0 && d.i < FLOW.length &&
    [...KEYS, ...Object.keys(FACTION)].every(k => Number.isFinite(d.S[k])));
}
function loadGame(){
  const d = store.get(SAVE_KEY);
  if (!validSave(d)){ clearSave(); return false; }
  S = d.S; i = d.i; LOG = Array.isArray(d.LOG) ? d.LOG.filter(l => typeof l === 'string') : []; ENDED = false;
  FLOW = S.flowVersion===2 ? FLOW_V2 : FLOW_V1;
  S.flowVersion = S.flowVersion===2 ? 2 : 1;
  const savedScene = FLOW.indexOf(S.curId);
  if (savedScene >= 0) i = savedScene;
  for (const k of [...KEYS, ...Object.keys(FACTION), ...Object.keys(RAW_LIMITS)]){
    if (Number.isFinite(S[k])) S[k] = boundedValue(k,S[k]);
  }
  S.westTrust = Number.isFinite(S.westTrust) ? boundedValue('westTrust',S.westTrust) : 0;
  S.standoffs = Number.isFinite(S.standoffs) ? S.standoffs : 0;
  if ((S.rulesVersion||1)<2){
    if (LOG.includes(SCENES['1-1'].options[2].label)){ S.tukh=true; S.officerCorpsPurged=true; }
    if (S.napoleonPurged){ S.napoleon=false; S.napoleonGov=false; }
    S.rulesVersion=2;
  }
  if (S._purgeAccounting !== 2){
    const purgeNames = new Set(DECISIONS.filter(d => d.purge).map(d => d.name));
    for (const scene of Object.values(SCENES)) for (const option of scene.options||[]) if (option.purge) purgeNames.add(option.label);
    S.purgeCount = (S.purgeCount||0) + LOG.filter(label => purgeNames.has(label)).length;
    S._purgeAccounting = 2;
  }
  if (typeof Statistics!=='undefined') Statistics.ensure();
  return true;
}
function hasSave(){ return validSave(store.get(SAVE_KEY)); }
function clearSave(){ store.del(SAVE_KEY); }
function unlocked(){ const g = store.get(GALLERY_KEY); return Array.isArray(g) ? g : []; }
function unlockEnding(id){
  const g = unlocked();
  if (g.indexOf(id) < 0){ g.push(id); store.set(GALLERY_KEY, g); }
}

/* ============================================================
   结局判定
   ============================================================ */
function decideEnding(){
  const heads = [], mods = [];
  const push = (id,t,b)=>heads.push({id,t,b});

  if (S.collapses >= 3 || (S.MOR <= 15 && !S.defeat)){
    push('dusk', '苏 维 埃 的 黄 昏',
      '联盟开始一块一块地掉下来。波罗的海、高加索、中亚——每一个地方都在同一周里宣布自己不再属于这里。没有人下令，也没有人阻止。这台机器第一次发现，它没有可以按压的按钮。');
  } else if (S.defeat && (S.religion||0) >= 2 && S.MOR <= 35){
    push('rome', '第 三 罗 马',
      '诸圣大教堂重新点亮。一个自称来自旧王朝的人在莫斯科加冕，称这是恢复而不是革命。军队保持沉默，因为他们不知道该向谁敬礼。七十年被压缩成一段插曲。');
  } else if (S.COM <= 20 && (S.nationalQ||0) >= 50){
    push('island', '孤 岛',
      '没有人愿意来莫斯科了。盟友是负担，邻国是威胁，而边境另一侧的世界正在忙着做别的事。这台机器仍然庞大，仍然危险，但它只能对自己说话。');
  } else if (S.disarm && (S.westTrust||0) >= 20){
    push('detente', '缓 和',
      '一份不首先使用的草案被对方接了。此后的十年里，两个阵营在维也纳、日内瓦和纽约反复开会，而不是在柏林和布达佩斯。没有人赢，但也没有人按按钮。');
  } else if (S.comecon && S.IND >= 190){
    push('comecon', '共 同 经 济 体',
      '经济互助委员会变成了一个真正的经济体：统一的电网、统一的轨距、统一的计价单位。经互会的卡车开到了伏尔加河边的新城，那里的人不知道柏林在哪里。');
  } else if (S.assassinated || (S.route === 'stalin' && S.PAR >= 80)){
    push('eternal', '钢 铁 的 永 恒',
      '画像还挂在那里。上面的人已经不在很久了，但没有人敢把它取下来。这台机器继续以他的名义运转，像一台没有人敢关掉的机器。');
  } else {
    switch (S.route) {
      case 'khrushchev':
        push('khrushchev', '伟 大 的 继 承 人',
          S.destalin==='full'?'秘密报告念完的那一刻，大厅里有人晕倒。二十年的账第一次被拿到桌面上。这台机器开始试着承认自己做过什么——这是它二十年来最难的一个动作。':S.destalin==='limited'?'集体领导取代了单一的声音。报告只公开了一部分历史，新的领导层选择渐进调整；留下的账目，还需要下一代人继续追问。':'权力被拆分给几个人，但秘密报告仍被锁在抽屉里。新的领导层学会了内部协商，尚未学会公开回答过去的问题。');
        break;
      case 'beria':
        push('beria', '技 术 官 僚 的 秩 序',
          '秘密警察的档案柜换成了规划委员会的图表。效率提高了，指标完成了，没有人在乎人怎么想。这可能是最危险的一种结局，因为它看起来很正常。');
        break;
      case 'military':
        push('military', '红 色 拿 破 仑',
          '军装走进了克里姆林宫。勋章代替了意识形态，地图代替了纲领。这个国家会变得很有力量，也会变得很少问自己为什么。');
        break;
      case 'right':
        push('right', '新 经 济 道 路',
          '市场回来了，富农的孙子成了拖拉机厂的经理。商店里有东西了，监狱里的人少了。老布尔什维克坐在角落里不说话，因为他们不知道该说什么。');
        break;
      case 'left':
        push('left', '永 久 的 革 命',
          '第四国际的旗帜在亚洲和非洲升起来。这个国家不再只是一个国家，它是一场运动。它不再需要保卫自己，因为它不再有边界。');
        break;
      case 'soviet':
        push('soviet', '全 权 苏 维 埃',
          '最高苏维埃第一次真正投票。表决结果出乎所有人意料，包括被否决的那个人。他接受了这个结果——这是这二十年里最难做到的一件事。');
        break;
      case 'stalin':
        push('stalin-quiet', '无 声 的 独 裁',
          '恐惧逐渐退潮，集中的权力结构却没有改变。'+(S.destalin==='none'?'报告没有被公开，画像仍留在原处。':'报告触及了个人崇拜，却没有重新分配决定事情的权力。')+'这台机器仍按熟悉的程序运转。');
        break;
      case 'caretaker':
        push('mediocre', '平 庸 的 延 续',
          '临时委员会一直没有结束任期。计划被续签，争论被搁置，部门之间互相等待批复。1956 年的国家沿着旧有惯性前行，谁也没有为它确定新的方向。');
        break;
      default:
        push('mediocre', '平 庸 的 延 续',
          '1956 年和 1936 年几乎没有区别。档案柜里那个名字早就没有人提了，包括当初把它写上去的人。');
    }
  }

  if (S.greatVictory) mods.push('从伏尔加河到易北河 —— 战线没有被真正动摇过');
  if (S.costly) mods.push('灰烬上的胜利 —— 打赢了，但用掉了一整代人');
  if (S.defeat) mods.push('第二个布列斯特 —— 1945 年签的字和 1918 年几乎一样');
  if (S.stalemate) mods.push('僵持和平 —— 没有人胜利，也没有人和解');
  if (S.lineHeld) mods.push('守住了每一条防线，但没能推到柏林');
  if (S.nuclear >= 70) mods.push('1949 年，塞米巴拉金斯克的蘑菇云');
  if (S.nuclear < 40) mods.push('核武器缺席 —— 每一次危机都只能先摆出强硬姿态');
  if (S.westTrust >= 30) mods.push('东欧的选举是真的，柏林没有被封锁');
  if (S.peoplesDemocracy) mods.push('东欧是一圈盟友，而不是一圈哨所');
  if ((S.nationalQ||0) >= 50) mods.push('民族问题是一笔始终没有还的债');
  if (S.COM >= 90) mods.push('社会主义阵营覆盖了欧亚大陆的大部分');
  if (S.indSaved >= 50) mods.push('工业整体搬到了乌拉尔山以东');
  if (S.constitution) mods.push('1936 年宪法从未被废除');
  if (S.tukh === false) mods.push('图哈切夫斯基与他的同僚没有活过 1937 年');
  if (S.tukh && S.officerCorpsPurged) mods.push('图哈切夫斯基活着，但军官团在部分清洗中受损');
  if (S.tukh && !S.officerCorpsPurged) mods.push('总参谋部在战争期间保持了完整');
  if (S.legacyArms) mods.push('最后的预算向军备倾斜，工业与军力增加，民心付出代价');
  if (S.legacyHome) mods.push('最后的预算投向住房，民心和民用工业改善');
  if (S.legacyWorld) mods.push('最后的预算用于阵营扩张，国际影响增加，国内资源更紧');
  if ((S.destalinUnrest||0)>=25) mods.push('去斯大林化引发的阵营争论仍未平息');
  if (S.interimLeader==='beria') mods.push('1953 年的权力真空期曾由内务部临时控制');
  if (S.interimLeader==='military') mods.push('1953 年的权力真空期曾由军方临时接管');

  const industry = S.IND >= 220 ? '欧洲第一、世界第二'
                 : S.IND >= 150 ? '重建完成，但落后于美国'
                 : '仍有半个国家的工厂停在战前的位置';
  const cost = S.purgeCount >= 6 ? '清洗的规模超过了战争本身造成的政治损失'
             : S.collapses >= 2 ? '西部被反复碾过两次'
             : S.costly ? '两千七百万人，以及整整一代男人'
             : '代价被控制在可承受的范围内';
  const legacy = S.route === 'soviet' ? '这个国家学会了自己决定事情'
               : S.route === 'stalin' ? '这个国家学会了不提问'
               : S.route === 'left' ? '这个国家把自己变成了一场运动'
               : S.route === 'right' ? '这个国家学会了算账'
               : S.route === 'military' ? '这个国家学会了服从命令'
               : S.route === 'beria' ? '这个国家学会了填表'
               : '这个国家学会了忍耐';

  return {heads, mods, report:[
    ['工业', String(S.IND), industry],
    ['代价', String(S.purgeCount) + ' 次清洗', cost],
    ['遗产', S.route === 'soviet' ? '一票之差' : '一个指纹', legacy]
  ]};
}

function renderEnding(){
  if (typeof WarReports!=='undefined') WarReports.finish();
  if (typeof Statistics!=='undefined') Statistics.finish();
  const e = decideEnding();
  ENDED = true;
  unlockEnding(e.heads[0].id);
  const archivedRun = typeof EndingArchive!=='undefined' ? EndingArchive.capture(e) : null;
  clearSave();
  menuMode(false); renderHUD();
  const st = document.getElementById('stage');
  st.innerHTML = `<div class="ending fade">
    ${typeof EndingArchive!=='undefined' ? EndingArchive.imageHTML(e.heads[0].id) : artHTML(ENDING_ART, 1956)}
    <div class="ey">1 9 5 6 年 1 2 月 · 结 算</div>
    <h2>${e.heads[0].t}</h2>
    <div class="etxt">${e.heads[0].b}</div>
    ${e.mods.length?`<div class="report" style="margin-top:24px;border-top-color:#463F37">
      <div class="ey" style="margin-bottom:10px">此 前 的 二 十 年 留 下 了 什 么</div>
      ${e.mods.map(m=>`<div class="rrow" style="border-bottom:none;padding:4px 0"><div class="rd">— ${m}</div></div>`).join('')}
    </div>`:''}
    <div class="report">
      ${e.report.map(([k,v,d])=>`<div class="rrow"><div class="rk">${k}</div><div class="rv">${v}</div><div class="rd">${d}</div></div>`).join('')}
    </div>
    <div class="acts" style="margin-top:30px">
      ${archivedRun?'<button class="btn" id="ending-review">查看本次数值曲线</button>':''}
      <button class="btn" id="again" style="background:#9E1B1B;border-color:#9E1B1B">再 走 一 次</button>
      <button class="btn ghost" id="to-menu" style="background:transparent;color:#C6BBA9;border-color:#463F37">回 到 标 题</button>
    </div>
    ${archivedRun?`<p class="ending-save-status" role="status">${esc(EndingArchive.saveMessage())}</p>`:''}
  </div>`;
  document.getElementById('ending-review')?.addEventListener('click',()=>EndingArchive.open(e.heads[0].id,archivedRun.id,true));
  document.getElementById('again').addEventListener('click', () => {
    fresh(); renderHUD(); advance();
  });
  document.getElementById('to-menu').addEventListener('click', renderTitle);
  if (typeof Statistics!=='undefined') Statistics.present();
  scrollToStart();
}

/* ---------- 键盘 ---------- */
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  if (document.querySelector('dialog[open]')) return;
  if (e.target && (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable)) return;
  if ((e.key === 'Enter' || e.key === ' ') && e.target?.closest?.('button,a,summary')) return;
  const opts = Array.from(document.querySelectorAll('.opt'));
  let choice;
  if (/^[1-9a-zA-Z]$/.test(e.key)) {
    const requested = /^[1-9]$/.test(e.key) ? String.fromCharCode(64+Number(e.key)) : e.key.toUpperCase();
    const matches = b => b.querySelector('.key')?.textContent.trim().toUpperCase() === requested;
    choice = opts.find(b => !b.disabled && matches(b)) || opts.find(matches);
    if (!choice && /^[1-9]$/.test(e.key) && opts.every(b=>! /^[A-Z]$/.test(b.querySelector('.key')?.textContent.trim()))) choice = opts[Number(e.key)-1];
  }
  if (choice){
    e.preventDefault();
    if (!choice.disabled) choice.click();
    return;
  }
  if (e.key === 'Enter' || e.key === ' '){
    const nx = document.getElementById('next');
    if (nx){ e.preventDefault(); nx.click(); }
    else if (opts.length===1 && !opts[0].disabled && opts[0].querySelector('.key')?.textContent.trim()==='→'){
      e.preventDefault(); opts[0].click();
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  fresh();
  renderTitle();
});
