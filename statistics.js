/* A factual ledger of settled game states. Reviews never apply game effects. */
const Statistics = (() => {
  const KEYS = ['PP','PAR','IND','ARMY','MOR','COM','STAL','LEFT','RIGHT'];
  const NAMES = {PP:'政治资本',PAR:'偏执',IND:'工业',ARMY:'红军',MOR:'民心',COM:'阵营影响',STAL:'斯大林派',LEFT:'左翼',RIGHT:'右翼'};
  const context = () => ({nuclear:S.nuclear||0,purges:S.purgeCount||0,war:S.warOutcome||null});
  const LAST_KEY = 'r56sov.statistics.last.v1';
  let selected = 'IND', cursor = -1, tab = 'chart';
  const values = () => Object.fromEntries(KEYS.map(k=>[k,S[k]]));
  const signed = n => n > 0 ? `+${n}` : String(n);
  function leader(){
    if (S.novelVersion && typeof Novel !== 'undefined') return {...Novel.leader()};
    const seats = {khrushchev:['khrushchev','赫鲁晓夫'],stalin:['malenkov','马林科夫'],beria:['beria','贝利亚'],military:S.napoleonGov&&S.tukh&&!S.napoleonPurged?['tukh','图哈切夫斯基']:['zhukov','朱可夫'],right:['mikoyan','米高扬'],left:['left-chair','左翼执行书记'],soviet:['soviet-chair','最高苏维埃主席'],caretaker:['malenkov','马林科夫']};
    const [key,name]=seats[S.route]||['stalin','约瑟夫·斯大林'];
    return {key,name,role:'最高领导人'};
  }
  function ensure(){
    if (!S._statistics || S._statistics.v !== 1) {
      S._statistics = {v:1,firstYear:S.year,year:S.year,baseline:values(),initialContext:context(),events:[],years:[],pending:[]};
      record('起点',S.year===1936 && !S.curId ? '1936 · 新的历史' : `${S.year} · 接续案头报告`);
    }
    return S._statistics;
  }
  function record(kind,title){
    const data = ensure(), current = values(), prev = data.events.at(-1);
    if (kind==='阶段' && prev && KEYS.every(k=>prev.values[k]===current[k])) return;
    data.events.push({year:S.year,scene:S.curId,kind,title:String(title),values:current,leader:leader(),context:context()});
  }
  function closeYear(year,carried=false){
    const data = ensure();
    if (data.years.some(r=>r.year===year)) return;
    const events = data.events.map((e,index)=>({e,index})).filter(({e})=>e.year===year);
    const last = data.events.at(-1);
    const start = data.years.at(-1)?.end || data.baseline;
    const end = {...(last?.values||values())};
    data.years.push({year,start:{...start},end,context:{...(last?.context||context())},previousContext:{...(data.years.at(-1)?.context||data.initialContext)},leader:{...(last?.leader||leader())},events:events.filter(({e})=>e.kind!=='起点').map(({index})=>index),carried});
    data.pending.push(year);
  }
  function beforeYear(year){
    const data = ensure();
    if (year<=data.year) return;
    for (let y=data.year;y<year;y++) closeYear(y,y>data.year);
    data.year=year;
  }
  function finish(){
    const data=ensure();
    beforeYear(Math.max(1956,S.year));
    closeYear(Math.max(1956,S.year));
    store.set(LAST_KEY,data);
  }
  function portrait(person){
    const c=typeof NOVEL_CAST!=='undefined' && NOVEL_CAST[person.key];
    return c?.cell!==undefined ? `<span class="vn-portrait" role="img" aria-label="${esc(person.name)} · AI历史演绎肖像" style="--cx:${c.cell%4};--cy:${Math.floor(c.cell/4)}"></span>` : '';
  }
  function reportHTML(report,data){
    const {year,start,end,leader:person}=report;
    const changes = KEYS.slice(0,6).map(k=>({k,d:end[k]-start[k]}));
    const events = report.events.map(i=>data.events[i]).filter(e=>e && ['政策','决议'].includes(e.kind));
    const changed = changes.filter(c=>c.d!==0);
    const opening = person.key==='beria' ? '新年的报告到了。机关的效率、工厂的进度、街头的情绪，我要一项项看清。权力已经交到我手里，不能只有新的签名，没有新的结果。' : person.key==='khrushchev' ? '又是一年。我把报告拉到面前：会上说得再热闹，也得看工厂开不开工，百姓日子过得怎么样。前任留下的账，现在得由我们来回答。' : ['zhukov','tukh'].includes(person.key) ? '新年的国家报告，像一张新的态势图摊在桌上。可治理国家不能只看箭头；军队、工厂和普通人的生活，都要算在同一份责任里。' : person.key==='stalin' ? '又一个新年。送到书房的报告已经摊开，我必须看看，这个国家究竟走到了哪里。' : person.key==='vacant' ? '新年到来，最高席位仍然空着。个人的命运已经改变，国家却还要把这一年的账翻过去。' : `新年的报告摆在我面前。我是${person.name}，如今这些数字背后的责任，也落在了我的肩上。`;
    const industry = end.IND>start.IND ? '工业的底子比年初厚了。但机器多了，不等于每张餐桌都更丰盛。' : end.IND<start.IND ? '工业退了下去。我不能拿一张漂亮的计划表，遮住车间里失去的东西。' : '工业的数字没有变化。既有的基础还在，新的突破却不能凭一句命令写进报告。';
    const people = end.MOR>start.MOR ? '民心回升了。我应当记住，信任也要靠下一年的生活来兑现。' : end.MOR<start.MOR ? '民心下降了。会议室里安静，并不意味着街上没有怨言。' : '民心停在原处。沉默的人群，仍然需要我去听。';
    const army = end.ARMY>start.ARMY ? '红军比年初更有力量；我仍要衡量，这份力量该用于守住边境，还是又一次冒险。' : end.ARMY<start.ARMY ? '红军的力量受了损失。我不能只数地图上的旗帜，也要记住没有回到队列里的人。' : '红军的账面力量未变。保持战备，仍然是留给来年的事。';
    const cost = end.PAR>start.PAR ? '我的疑虑比年初更重了。如果每一扇门后都是敌人，最后还会剩下多少可以相信的人？' : end.PAR<start.PAR ? '疑惧有所缓和。我愿意把这当成喘息的机会，但制度不能只依赖一个人的心情。' : '';
    const international = end.COM>start.COM ? '我们在国外的影响扩大了。我也要留意，新的承诺会不会超出国家能够承担的范围。' : end.COM<start.COM ? '国际影响在收缩。地图上的盟友，不能只靠口号维系。' : '';
    const milestones = !report.carried ? `${report.context?.war && report.context.war!==report.previousContext?.war ? ({great:'战争以全面胜利结束。胜利的光照进了办公室，我仍要面对它留下的伤口。',held:'国家守住了。接下来的任务，是让活下来的人重新生活。',costly:'我们赢下了战争，代价却沉得不能轻轻翻过去。',stalemate:'战争留下一场僵局。我必须承认，地图还没有替我们作出最后的回答。',defeat:'战争以失败收场。我必须从这个结果出发，重新估量国家的力量。'}[report.context.war]||'') : ''}${report.context?.nuclear>=(report.previousContext?.nuclear||0)+1 ? '核工程有了新的进展。它改变的是威慑的分量，也把更重的责任带到案头。' : ''}${report.context?.purges>(report.previousContext?.purges||0) ? '这一年又有清洗命令落下。卷宗可以写上结案，人和制度留下的缺口却不会随之消失。' : ''}` : '';
    const carry = '这一年没有新的重大路线命令记入这份卷宗。我手边仍是最近一次国家报告；下面的数值沿用那份报告，不能据此断言这一年毫无变化。';
    return `<article class="annual-page"><div class="eyebrow">${year+1} · 新年案头 / 回望 ${year}</div><h2>${year}，留在身后的这一年。</h2><div class="annual-author">${portrait(person)}<span>${esc(person.name)} · 年末在任视角</span></div><p class="annual-opening">${opening}</p>${report.carried?`<p>${carry}</p>`:`<p>${industry}${people}</p><p>${army}${cost}${international}</p>${milestones?`<p>${milestones}</p>`:""}`}<div class="annual-numbers">${changes.map(({k,d})=>`<div><span>${NAMES[k]}</span><b>${end[k]}</b><small class="${d && (k==='PAR'?d<0:d>0)?'gain':d?'loss':''}">${signed(d)} / 较年初</small></div>`).join('')}</div>${events.length?`<h3>我在这一年签下的决定</h3><ol class="annual-events">${events.map(e=>`<li>${esc(e.title)}</li>`).join('')}</ol>`:!report.carried?'<p class="stats-note">这一年没有记入新的政策决定。</p>':''}<p class="annual-closing">${report.carried?'旧的决定仍在塑造眼前的国家。新的一年，我还要接着回答。':changed.length?'这些变化不是纸上的装饰。明年再打开这份卷宗时，我必须承担它们继续生长的后果。':'数字暂时停在原处，历史却还在往前走。'}</p><p class="stats-note">原创历史演绎。数值为游戏指标；新年回顾不额外增减资源。${data.firstYear>1936?` 本周目从 ${data.firstYear} 年开始统计，此前年份不追溯。`:''}</p></article>`;
  }
  function present(){
    const data=S?._statistics, dialog=document.getElementById('annual-dialog');
    if (!data?.pending.length || typeof dialog?.showModal!=='function') return;
    const report=data.years.find(r=>r.year===data.pending[0]);
    document.getElementById('annual-content').innerHTML=reportHTML(report,data);
    document.getElementById('annual-continue').textContent=data.pending.length>1?'翻阅下一年手记':'收起手记，继续';
    if (!dialog.open) {
      dialog.showModal();
      const heading=dialog.querySelector('h2');
      heading.tabIndex=-1;heading.focus({preventScroll:true});dialog.scrollTop=0;
    }
  }
  function acknowledge(){
    const data=S?._statistics;
    if (!data?.pending.length) return;
    data.pending.shift();
    document.getElementById('annual-dialog').close();
    if (ENDED) store.set(LAST_KEY,data); else saveGame();
    present();
  }
  function viewData(){
    if (S?.curId && S._statistics) return S._statistics;
    return store.get(SAVE_KEY)?.S?._statistics || store.get(LAST_KEY) || null;
  }
  function chart(data,key,small=false){
    const list=data.events, w=760,h=260,left=48,right=20,top=20,bottom=40;
    const max=Math.max(10,...list.map(e=>e.values[key]));
    const ceiling=Math.ceil(max/10)*10;
    const x=i=>left+(w-left-right)*i/Math.max(1,list.length-1), y=v=>h-bottom-(h-top-bottom)*v/ceiling;
    const points=list.map((e,i)=>`${x(i)},${y(e.values[key])}`).join(' ');
    if(small) return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/></svg>`;
    const labels = list.map((e,i)=>({e,i})).filter(({e,i})=>i===0||i===list.length-1||e.year!==list[i-1].year);
    const ticks=labels.filter((_,i)=>i===0||i===labels.length-1||i%Math.max(1,Math.ceil(labels.length/6))===0);
    return `<svg class="stat-chart" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="chart-title chart-desc"><title id="chart-title">${NAMES[key]}变化折线图</title><desc id="chart-desc">从 ${list[0].year} 年的 ${list[0].values[key]} 到 ${list.at(-1).year} 年的 ${list.at(-1).values[key]}，共 ${list.length} 次记录。用下方滑块逐条查看准确数值与事件。</desc>${[0,.25,.5,.75,1].map(t=>`<line x1="${left}" x2="${w-right}" y1="${y(t*ceiling)}" y2="${y(t*ceiling)}" class="chart-grid"/><text x="${left-10}" y="${y(t*ceiling)+4}" text-anchor="end">${Math.round(t*ceiling)}</text>`).join('')}<polyline points="${points}" class="chart-line"/>${ticks.map(({e,i})=>`<text x="${x(i)}" y="${h-12}" text-anchor="${i===0?'start':i===list.length-1?'end':'middle'}">${e.year}</text>`).join('')}<line class="chart-cursor" x1="${x(cursor)}" x2="${x(cursor)}" y1="${top}" y2="${h-bottom}"/><circle class="chart-point" cx="${x(cursor)}" cy="${y(list[cursor].values[key])}" r="5"/></svg>`;
  }
  function detail(data){
    const e=data.events[cursor],before=data.events[cursor-1]?.values||e.values;
    return `<div class="stat-event"><div><span>${e.year} · ${esc(e.kind)} · 第 ${cursor+1} / ${data.events.length} 条</span><h3>${esc(e.title)}</h3><p>${esc(e.leader.name)}在任</p></div><div class="stat-event-number"><b>${e.values[selected]}</b><span>${NAMES[selected]} / 本次 ${signed(e.values[selected]-before[selected])}</span></div></div>`;
  }
  function renderDashboard(){
    const data=viewData(), target=document.getElementById('statistics-content');
    if(!data?.events?.length){target.innerHTML='<p class="stats-empty">开启一段历史后，国家报告会随每次事件结算累积。</p>';return;}
    cursor=Math.max(0,Math.min(cursor<0?data.events.length-1:cursor,data.events.length-1));
    const last=data.events.at(-1),first=data.events[0];
    target.innerHTML=`<div class="statistics-tabs" role="group" aria-label="统计内容"><button type="button" data-stats-tab="chart" aria-pressed="${tab==='chart'}">国家曲线</button><button type="button" data-stats-tab="years" aria-pressed="${tab==='years'}">新年手记 <span>${data.years.length}</span></button></div>${tab==='chart'?`<div class="stat-metrics">${KEYS.map(k=>`<button class="stat-metric" data-metric="${k}" aria-pressed="${selected===k}"><span>${NAMES[k]}${k==='PAR'?' ↓':''}</span><b>${last.values[k]}</b><small>自统计起点 ${signed(last.values[k]-first.values[k])}</small>${chart(data,k,true)}</button>`).join('')}</div><section class="stat-plot"><div class="stat-plot-title"><h3>${NAMES[selected]} · 变化轨迹</h3><span>${first.year} — ${last.year} / ${data.events.length} 次记录</span></div><div id="stat-chart-holder">${chart(data,selected)}</div><label for="stat-position">沿时间线查阅事件 <span>← → 逐条查看</span></label><input id="stat-position" type="range" min="0" max="${data.events.length-1}" value="${cursor}" aria-label="选择事件记录"/><div id="stat-event-detail" aria-live="polite">${detail(data)}</div><p class="stats-note">横轴按实际结算顺序排列，同年可有多次变化；纵轴为所选指标的实际值。偏执越低越好，派系影响不表示好坏。没有新记录的年份不插入虚构数据。</p></section><details class="stat-table"><summary>查阅完整数值表</summary><div class="stat-table-scroll" tabindex="0" role="region" aria-label="国家指标数据表"><table><caption>本周目逐次结算记录</caption><thead><tr><th scope="col">年份 / 事件</th>${KEYS.map(k=>`<th scope="col">${NAMES[k]}</th>`).join('')}</tr></thead><tbody>${data.events.map(e=>`<tr><th scope="row">${e.year} · ${esc(e.title)}</th>${KEYS.map(k=>`<td>${e.values[k]}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`:data.years.length?`<label class="annual-select" for="annual-year">翻阅年份 <select id="annual-year">${data.years.slice().reverse().map(r=>`<option value="${r.year}">${r.year} · ${esc(r.leader.name)}</option>`).join('')}</select></label><div id="annual-archive">${reportHTML(data.years.at(-1),data)}</div>`:'<p class="stats-empty">第一个新年到来时，你会在这里收到上一年的手记。</p>'}`;
    target.querySelectorAll('[data-stats-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.statsTab;renderDashboard();}));
    target.querySelectorAll('[data-metric]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.metric;renderDashboard();document.querySelector(`[data-metric="${selected}"]`).focus();}));
    document.getElementById('stat-position')?.addEventListener('input',e=>{cursor=Number(e.target.value);document.getElementById('stat-chart-holder').innerHTML=chart(data,selected);document.getElementById('stat-event-detail').innerHTML=detail(data);});
    document.getElementById('annual-year')?.addEventListener('change',e=>{document.getElementById('annual-archive').innerHTML=reportHTML(data.years.find(r=>r.year===Number(e.target.value)),data);});
  }
  function open(){cursor=-1;renderDashboard();document.getElementById('statistics-dialog').showModal();}
  document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('nav-statistics').addEventListener('click',open);
    document.getElementById('annual-continue').addEventListener('click',acknowledge);
    document.getElementById('annual-dialog').addEventListener('cancel',e=>{e.preventDefault();acknowledge();});
  });
  return {ensure,record,beforeYear,finish,present,acknowledge,open,reportHTML,keys:KEYS};
})();
