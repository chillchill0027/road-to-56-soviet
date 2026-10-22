/* Completed runs are independent, immutable snapshots; opening one never restores S. */
const EndingArchive = (() => {
  const KEY = 'r56sov.runs.v1';
  const copy = value => JSON.parse(JSON.stringify(value));
  const numeric = value => Number.isFinite(value) && value >= 0 && value <= 1000000;
  const text = (value,max=2000) => typeof value === 'string' && value.length <= max;
  const person = p => p && text(p.name,100) && text(p.key,100);
  const values = v => v && Statistics.keys.every(k=>numeric(v[k]));
  const known = id => ENDINGS.find(e=>e.id===id);
  const memory = new Map();
  let writeError = false;
  const ART = {
    khrushchev:['leadership',0,'集体领导与会场'], beria:['leadership',1,'规划机关的秩序'],
    military:['leadership',2,'军队进入行政中心'], soviet:['leadership',3,'代表们的真实表决'],
    right:['society',0,'重新开放的日常市场'], left:['society',1,'跨越边界的运动'],
    comecon:['society',2,'铁路、电网与共同生产'], detente:['society',3,'谈判桌上的缓和'],
    'stalin-quiet':['continuity',0,'集中权力的日常'], eternal:['continuity',1,'缺席者留下的机器'],
    mediocre:['continuity',2,'继续流转的公文'], island:['continuity',3,'空下来的外交站台'],
    dusk:['rupture',0,'共同体的黄昏',1,2], rome:['rupture',1,'大教堂里的复辟',1,2],
  };
  function imageHTML(id,thumbnail=false) {
    const [file,cell,caption,cols=2,rows=2]=ART[id];
    const picture=`<span class="ending-art-frame" style="--end-cols:${cols};--end-rows:${rows};--end-ratio:${file==='rupture'?'4/3':'3/2'}"><span class="ending-art-cell"><img src="assets/images/ending-${file}-sheet.webp" alt="${esc(caption)} · AI生成的历史场景演绎" decoding="async" style="left:-${cell%cols*100}%;top:-${Math.floor(cell/cols)*100}%"></span></span>`;
    return thumbnail ? picture : `<figure class="ending-art">${picture}<figcaption><span>${esc(caption)}</span><span>AI生成的历史场景演绎</span></figcaption></figure>`;
  }
  function validStatistics(d) {
    return d?.v===1 && Number.isInteger(d.firstYear) && d.firstYear>=1900 && d.firstYear<=2100 &&
      values(d.baseline) && Array.isArray(d.events) && d.events.length>0 && d.events.length<=5000 &&
      d.events.every(e=>Number.isInteger(e.year) && e.year>=1900 && e.year<=2100 && values(e.values) &&
        text(e.title) && text(e.kind,50) && person(e.leader)) &&
      Array.isArray(d.years) && d.years.length<=100 && d.years.every(y=>Number.isInteger(y.year) &&
        y.year>=1900 && y.year<=2100 && values(y.start) && values(y.end) && person(y.leader) &&
        Array.isArray(y.events) && y.events.every(i=>Number.isInteger(i) && i>=0 && i<d.events.length));
  }
  function validRun(r) {
    return r?.v===1 && text(r.id,200) && r.id.length>0 && known(r.endingId) &&
      text(r.completedAt,40) && Number.isFinite(Date.parse(r.completedAt)) && text(r.title,100) &&
      text(r.body,10000) && Array.isArray(r.modifiers) && r.modifiers.every(m=>text(m)) &&
      Array.isArray(r.decisions) && r.decisions.length<=5000 && r.decisions.every(d=>text(d)) &&
      values(r.final) && validStatistics(r.statistics) &&
      Statistics.keys.every(k=>r.final[k]===r.statistics.events.at(-1).values[k]);
  }
  function persisted() {
    const d=store.get(KEY);
    return d?.v===1 && Array.isArray(d.runs) ? d.runs.filter(validRun) : [];
  }
  function all() {
    const runs=persisted(), ids=new Set(runs.map(r=>r.id));
    return [...runs,...[...memory.values()].filter(r=>!ids.has(r.id))];
  }
  function write(runs) {
    try {localStorage.setItem(KEY,JSON.stringify({v:1,runs}));writeError=false;return true;}
    catch {writeError=true;return false;}
  }
  function capture(ending) {
    const statistics=copy(Statistics.ensure());
    const existing=all().find(r=>r.id===statistics.runId);
    if(existing) return existing;
    statistics.pending=[];
    const head=ending.heads[0];
    const run={v:1,id:statistics.runId,completedAt:new Date().toISOString(),endingId:head.id,
      title:head.t,body:head.b,modifiers:copy(ending.mods),decisions:[...LOG],
      final:copy(statistics.events.at(-1).values),statistics};
    const runs=[...all(),run];
    if(write(runs)) memory.clear(); else memory.set(run.id,run);
    return run;
  }
  function saveMessage() {
    return writeError ? '本次档案尚未写入浏览器，可能是存储空间不足。请先导出备份，离开页面前保留文件。' : '本次游玩已归档。数值曲线、逐次事件与新年手记保存在当前浏览器。';
  }
  const forEnding = id => all().filter(r=>r.endingId===id).sort((a,b)=>b.completedAt.localeCompare(a.completedAt));
  const date = value => new Date(value).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  function download(runs) {
    const url=URL.createObjectURL(new Blob([JSON.stringify({v:1,runs},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='56之路-游玩档案.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function importData(data) {
    if(data?.v!==1 || !Array.isArray(data.runs) || data.runs.length>1000 || !data.runs.every(validRun))
      throw Error('档案格式或数值记录不完整，未导入任何内容。');
    const runs=all(), byId=new Map(runs.map(r=>[r.id,r]));
    let added=0;
    for(const r of data.runs) {
      if(byId.has(r.id)) {
        if(JSON.stringify(byId.get(r.id))!==JSON.stringify(r)) throw Error('备份中存在编号相同但内容不同的记录，原档案保持不变。');
      } else {const next=copy(r);byId.set(next.id,next);added++;}
    }
    if(!write([...byId.values()])) throw Error('浏览器未能保存这份备份。原有记录未删除，请保留备份文件。');
    memory.clear();
    for(const r of data.runs) unlockEnding(r.endingId);
    return added;
  }
  function renderGallery() {
    menuMode(true);
    const runs=all(), unlockedIds=[...new Set([...unlocked(),...runs.map(r=>r.endingId)])];
    document.getElementById('stage').innerHTML=`<div class="gallery fade">
      <div class="ts-kicker">已解锁 ${unlockedIds.length} / ${ENDINGS.length} · ${runs.length} 次游玩留存</div>
      <h1 class="gal-title">结局图鉴</h1><p class="gallery-intro">同一个结局，也有不同的来路。打开已解锁的封面，回看当时的国家曲线。</p>
      <div class="archive-tools"><button class="btn ghost" id="runs-export" ${runs.length?'':'disabled'}>导出全部档案</button><button class="btn ghost" id="runs-import">导入备份</button><input type="file" id="runs-file" accept="application/json,.json" hidden></div>
      <p class="archive-storage-note">档案保存在当前浏览器；不同网址和设备不会自动同步，可通过备份转移。开始新游戏会保留通关档案。</p>
      <p id="runs-message" role="status">${writeError?esc(saveMessage()):''}</p>
      <div class="gal-grid">${ENDINGS.map(e=>{
        const got=unlockedIds.includes(e.id), count=runs.filter(r=>r.endingId===e.id).length;
        return got?`<button type="button" class="gal-item got" data-ending="${e.id}" aria-label="${esc(e.t.replaceAll(' ',''))}，${count?count+'次游玩，查看数值曲线':'旧版已解锁，查看结局'}">${imageHTML(e.id,true)}<span class="gal-copy"><span class="gal-name">${e.t}</span><span class="gal-hint">${esc(e.h)}</span><span class="gal-records">${count?`${count} 次游玩 · 查看曲线`:'旧版已解锁 · 查看结局'} <span aria-hidden="true">↗</span></span></span></button>`:
          '<div class="gal-item locked"><div class="ending-locked-art" aria-hidden="true">？</div><div class="gal-copy"><div class="gal-name">未解锁的历史</div><div class="gal-hint">在下一段历史中，找到另一种可能。</div></div></div>';
      }).join('')}</div><div class="acts"><button class="btn" id="gal-back">返回阅读首页</button></div></div>`;
    document.querySelectorAll('[data-ending]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.ending)));
    document.getElementById('gal-back').addEventListener('click',renderTitle);
    document.getElementById('runs-export').addEventListener('click',()=>download(all()));
    const file=document.getElementById('runs-file');
    document.getElementById('runs-import').addEventListener('click',()=>file.click());
    file.addEventListener('change',async()=>{
      const selected=file.files[0];if(!selected)return;
      try {
        if(selected.size>10*1024*1024)throw Error('备份超过10MB，请分批导入。');
        const added=importData(JSON.parse(await selected.text()));renderGallery();
        document.getElementById('runs-message').textContent=`已导入 ${added} 次游玩；重复档案已跳过。`;
      } catch(e) {const node=document.getElementById('runs-message');if(node)node.textContent=e instanceof SyntaxError?'无法读取JSON备份，原档案保持不变。':e.message;}
      file.value='';
    });
    scrollToStart();
  }
  function jumpToChart() {
    const heading=document.getElementById('ending-ledger-title');
    if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView({block:'start'});}
  }
  function open(id,runId,showChart=false) {
    const ending=known(id), runs=forEnding(id);
    if(!ending||(!unlocked().includes(id)&&!runs.length))return false;
    const run=runs.find(r=>r.id===runId)||runs[0];
    menuMode(true);
    document.getElementById('stage').innerHTML=`<div class="ending-detail fade"><button class="nav-button ending-back" id="ending-back">← 返回结局图鉴</button><div class="eyebrow">ENDING ARCHIVE / 结局档案</div>
      <h1 class="scene">${ending.t}</h1>${run?'<button class="btn ghost run-chart-jump" id="run-chart-jump">直接查看本次数值曲线 ↓</button>':''}${imageHTML(id)}
      ${run?`<section class="run-identity"><label for="ending-run-select">这一次历史 <select id="ending-run-select">${runs.map((r,n)=>`<option value="${esc(r.id)}" ${r.id===run.id?'selected':''}>${esc(date(r.completedAt))} · 第 ${runs.length-n} 次达成</option>`).join('')}</select></label><p>1956年末在任：${esc(run.statistics.events.at(-1).leader.name)} · ${run.statistics.events.length} 条数值记录</p></section><div class="ending-run-story"><p>${esc(run.body)}</p>${run.modifiers.length?`<ul>${run.modifiers.map(m=>`<li>${esc(m)}</li>`).join('')}</ul>`:''}</div><section class="ending-run-ledger" aria-labelledby="ending-ledger-title"><div class="eyebrow">YOUR PLAYTHROUGH / 当次游玩</div><h2 id="ending-ledger-title">这条道路，怎样走到这里。</h2><div id="ending-run-statistics"></div></section><details class="run-decisions"><summary>本次签下的决定 · ${run.decisions.length} 项</summary><ol>${run.decisions.map(d=>`<li>${esc(d)}</li>`).join('')}</ol></details><button class="btn ghost" id="run-export">导出这次游玩</button>`:
        `<p class="ending-run-story">${esc(ending.h)}</p><div class="archive-legacy" role="note"><h2>这是一份旧版解锁记录。</h2><p>当时的版本没有按结局留存游玩数据，无法还原那次的数值曲线。此后的每次通关都会分别归档；已有解锁仍然保留。</p></div>`}
      <p class="archive-storage-note">查阅档案不会替换正在进行的游玩，也不会改变任何数值。</p><div class="acts"><button class="btn" id="ending-detail-back">返回结局图鉴</button></div></div>`;
    document.getElementById('ending-back').addEventListener('click',renderGallery);
    document.getElementById('ending-detail-back').addEventListener('click',renderGallery);
    if(run) {
      Statistics.mount(run.statistics,document.getElementById('ending-run-statistics'));
      document.getElementById('ending-run-select').addEventListener('change',e=>open(id,e.target.value));
      document.getElementById('run-export').addEventListener('click',()=>download([run]));
      document.getElementById('run-chart-jump').addEventListener('click',jumpToChart);
    }
    scrollToStart();if(showChart)setTimeout(jumpToChart,0);return true;
  }
  return {capture,all,forEnding,open,renderGallery,imageHTML,saveMessage,importData,validRun,key:KEY};
})();
