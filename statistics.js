/* A factual ledger of settled game states. Reviews never apply game effects. */
const Statistics = (() => {
  const KEYS = ['PP','PAR','IND','ARMY','MOR','COM','STAL','LEFT','RIGHT'];
  const NAMES = {PP:'政治资本',PAR:'偏执',IND:'工业',ARMY:'红军',MOR:'民心',COM:'阵营影响',STAL:'斯大林派',LEFT:'左翼',RIGHT:'右翼'};
  const context = () => ({nuclear:S.nuclear||0,purges:S.purgeCount||0,war:S.warOutcome||null});
  const LAST_KEY = 'r56sov.statistics.last.v1';
  const liveView = {selected:'IND',cursor:-1,tab:'chart'};
  let runSerial = 0;
  const newRunId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `run-${Date.now().toString(36)}-${++runSerial}`;
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
    S._statistics.runId ||= newRunId();
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
  const SERIES = {
    PP:['#58616b',''],PAR:['#b52d3a','6 4'],IND:['#86212e',''],
    ARMY:['#42654e',''],MOR:['#976a1b',''],COM:['#386b8a',''],
    STAL:['#785441','8 3'],LEFT:['#875d88','3 3'],RIGHT:['#467e7c','10 3 2 3'],
  };
  function annualSamples(report,data){
    const samples=[{title:`${report.year} · 年初`,values:report.start}];
    for(const index of report.events){const e=data.events[index];if(e)samples.push({title:e.title,values:e.values});}
    if(samples.length===1 || KEYS.some(k=>samples.at(-1).values[k]!==report.end[k]))
      samples.push({title:`${report.year} · 年末报告`,values:report.end});
    return samples;
  }
  function annualPlot(report,samples,view){
    const visible=KEYS.filter(k=>view.visible.has(k)),w=760,h=300,left=48,right=20,top=20,bottom=42;
    const ceiling=Math.max(10,Math.ceil(Math.max(0,...samples.flatMap(e=>visible.map(k=>e.values[k])))/10)*10);
    const x=i=>left+(w-left-right)*i/Math.max(1,samples.length-1),y=v=>h-bottom-(h-top-bottom)*v/ceiling;
    return `<svg class="stat-chart annual-combined-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${report.year}年九项国家指标综合折线图，当前显示${visible.length}项"><title>${report.year}年国家指标综合图</title><desc>原始游戏数值，共用纵轴。横轴按本年的事件顺序排列，图例可显隐指标，下方滑块可逐条查阅九项准确数值。</desc>${[0,.25,.5,.75,1].map(t=>`<line x1="${left}" x2="${w-right}" y1="${y(Math.round(t*ceiling))}" y2="${y(Math.round(t*ceiling))}" class="chart-grid"/><text x="${left-10}" y="${y(Math.round(t*ceiling))+4}" text-anchor="end">${Math.round(t*ceiling)}</text>`).join('')}${visible.map(k=>`<polyline data-annual-line="${k}" points="${samples.map((e,i)=>`${x(i)},${y(e.values[k])}`).join(' ')}" fill="none" stroke="${SERIES[k][0]}" stroke-width="3" stroke-dasharray="${SERIES[k][1]}" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}<text x="${left}" y="${h-12}" text-anchor="start">年初</text><text x="${w-right}" y="${h-12}" text-anchor="end">年末</text><line class="chart-cursor" x1="${x(view.cursor)}" x2="${x(view.cursor)}" y1="${top}" y2="${h-bottom}"/>${visible.map(k=>`<circle cx="${x(view.cursor)}" cy="${y(samples[view.cursor].values[k])}" r="4" fill="${SERIES[k][0]}" stroke="var(--white)" stroke-width="1.5"/>`).join('')}</svg>`;
  }
  function annualPoint(samples,cursor){
    const point=samples[cursor],before=samples[cursor-1]||point;
    return `<p class="annual-chart-event"><span>${cursor===0?'年初基线':`第 ${cursor} 条记录`} · ${esc(point.title)}</span></p><dl class="annual-chart-values">${KEYS.map(k=>`<div><dt><i aria-hidden="true" style="background:${SERIES[k][0]}"></i>${NAMES[k]}${k==='PAR'?' ↓':''}</dt><dd>${point.values[k]}<small>本次 ${signed(point.values[k]-before.values[k])}</small></dd></div>`).join('')}</dl>`;
  }
  function annualCombinedContents(report,data,view){
    const samples=annualSamples(report,data);
    return `<div class="annual-chart-heading"><div><div class="eyebrow">THE YEAR IN LINES</div><h3>${report.year} · 国家综合曲线</h3></div><span>${report.events.length} 次结算 · 九项指标</span></div><div class="annual-chart-legend" role="group" aria-label="显示或隐藏年度指标">${KEYS.map(k=>`<button type="button" data-annual-toggle="${k}" aria-pressed="${view.visible.has(k)}"><i aria-hidden="true" style="border-color:${SERIES[k][0]};${SERIES[k][1]?'border-top-style:dashed':''}"></i>${NAMES[k]}${k==='PAR'?' ↓':''}</button>`).join('')}</div><div data-annual-plot>${annualPlot(report,samples,view)}</div><label class="annual-chart-position">查阅本年事件 <input type="range" data-annual-position min="0" max="${samples.length-1}" value="${view.cursor}" aria-label="查阅年度综合图的事件"/></label><div data-annual-point aria-live="polite">${annualPoint(samples,view.cursor)}</div><p class="stats-note">九条线均为原始游戏数值，共用纵轴；纵轴随当前显示的指标自动调整。点击图例可暂时隐藏指标。偏执越低越好，派系影响不表示好坏。${report.carried?'本年没有新结算，年初与年末沿用最近报告的数值。':'横轴按本年实际结算顺序排列，同年可以有多次变化。'}</p>`;
  }
  function annualCombinedHTML(report,data){
    const view={visible:new Set(KEYS),cursor:annualSamples(report,data).length-1};
    return `<section class="annual-synthesis" data-annual-chart aria-label="${report.year}年综合折线图">${annualCombinedContents(report,data,view)}</section>`;
  }
  function bindAnnualCharts(container,report,data){
    container.querySelectorAll('[data-annual-chart]').forEach(root=>{
      const samples=annualSamples(report,data),view={visible:new Set(KEYS),cursor:samples.length-1};
      function bind(){
        root.querySelectorAll('[data-annual-toggle]').forEach(button=>button.addEventListener('click',()=>{
          const key=button.dataset.annualToggle;
          if(view.visible.has(key))view.visible.delete(key);else view.visible.add(key);
          root.innerHTML=annualCombinedContents(report,data,view);bind();
          root.querySelector(`[data-annual-toggle="${key}"]`).focus({preventScroll:true});
        }));
        root.querySelector('[data-annual-position]').addEventListener('input',event=>{
          view.cursor=Number(event.target.value);
          root.querySelector('[data-annual-plot]').innerHTML=annualPlot(report,samples,view);
          root.querySelector('[data-annual-point]').innerHTML=annualPoint(samples,view.cursor);
        });
      }
      bind();
    });
  }
  function reportHTML(report,data){
    const {year,start,end,leader:person}=report;
    const changes = KEYS.slice(0,6).map(k=>({k,d:end[k]-start[k]}));
    const events = report.events.map(i=>data.events[i]).filter(e=>e && ['政策','决议'].includes(e.kind));
    const changed = changes.filter(c=>c.d!==0);
    const opening = person.key==='beria' ? '新年的报告到了。机关的效率、工厂的进度、街头的情绪，我要一项项看清。权力已经交到我手里，不能只有新的签名，没有新的结果。' : person.key==='khrushchev' ? '又是一年。我把报告拉到面前：会上说得再热闹，也得看工厂开不开工，百姓日子过得怎么样。前任留下的账，现在得由我们来回答。' : ['zhukov','tukh'].includes(person.key) ? '新年的国家报告，像一张新的态势图摊在桌上。可治理国家不能只看箭头；军队、工厂和普通人的生活，都要算在同一份责任里。' : person.key==='stalin' ? '又一个新年。送到书房的报告已经摊开，我必须看看，这个国家究竟走到了哪里。' : person.key==='vacant' ? '新年到来，最高席位仍然空着。个人的命运已经改变，国家却还要把这一年的账翻过去。' : `新年的报告摆在我面前。我是${esc(person.name)}，如今这些数字背后的责任，也落在了我的肩上。`;
    const industry = end.IND>start.IND ? '工业的底子比年初厚了。但机器多了，不等于每张餐桌都更丰盛。' : end.IND<start.IND ? '工业退了下去。我不能拿一张漂亮的计划表，遮住车间里失去的东西。' : '工业的数字没有变化。既有的基础还在，新的突破却不能凭一句命令写进报告。';
    const people = end.MOR>start.MOR ? '民心回升了。我应当记住，信任也要靠下一年的生活来兑现。' : end.MOR<start.MOR ? '民心下降了。会议室里安静，并不意味着街上没有怨言。' : '民心停在原处。沉默的人群，仍然需要我去听。';
    const army = end.ARMY>start.ARMY ? '红军比年初更有力量；我仍要衡量，这份力量该用于守住边境，还是又一次冒险。' : end.ARMY<start.ARMY ? '红军的账面力量下降了。我必须分清，这是前线的损耗，还是我们自己的整顿削弱了它。' : '红军的账面力量未变。保持战备，仍然是留给来年的事。';
    const cost = end.PAR>start.PAR ? '我的疑虑比年初更重了。如果每一扇门后都是敌人，最后还会剩下多少可以相信的人？' : end.PAR<start.PAR ? '疑惧有所缓和。我愿意把这当成喘息的机会，但制度不能只依赖一个人的心情。' : '';
    const international = end.COM>start.COM ? '我们在国外的影响扩大了。我也要留意，新的承诺会不会超出国家能够承担的范围。' : end.COM<start.COM ? '国际影响在收缩。地图上的盟友，不能只靠口号维系。' : '';
    const milestones = !report.carried ? `${report.context?.war && report.context.war!==report.previousContext?.war ? ({great:'战争以全面胜利结束。胜利的光照进了办公室，我仍要面对它留下的伤口。',held:'国家守住了。接下来的任务，是让活下来的人重新生活。',costly:'我们赢下了战争，代价却沉得不能轻轻翻过去。',stalemate:'战争留下一场僵局。我必须承认，地图还没有替我们作出最后的回答。',defeat:'战争以失败收场。我必须从这个结果出发，重新估量国家的力量。'}[report.context.war]||'') : ''}${report.context?.nuclear>=(report.previousContext?.nuclear||0)+1 ? '核工程有了新的进展。它改变的是威慑的分量，也把更重的责任带到案头。' : ''}${report.context?.purges>(report.previousContext?.purges||0) ? '这一年又有清洗命令落下。卷宗可以写上结案，人和制度留下的缺口却不会随之消失。' : ''}` : '';
    const carry = '这一年没有新的重大路线命令记入这份卷宗。我手边仍是最近一次国家报告；下面的数值沿用那份报告，不能据此断言这一年毫无变化。';
    return `<article class="annual-page"><div class="eyebrow">${year+1} · 新年案头 / 回望 ${year}</div><h2>${year}，留在身后的这一年。</h2><div class="annual-author">${portrait(person)}<span>${esc(person.name)} · 年末在任视角</span></div><p class="annual-opening">${opening}</p>${report.carried?`<p>${carry}</p>`:`<p>${industry}${people}</p><p>${army}${cost}${international}</p>${milestones?`<p>${milestones}</p>`:""}`}${annualCombinedHTML(report,data)}<div class="annual-numbers">${changes.map(({k,d})=>`<div><span>${NAMES[k]}</span><b>${end[k]}</b><small class="${d && (k==='PAR'?d<0:d>0)?'gain':d?'loss':''}">${signed(d)} / 较年初</small></div>`).join('')}</div>${events.length?`<h3>我在这一年签下的决定</h3><ol class="annual-events">${events.map(e=>`<li>${esc(e.title)}</li>`).join('')}</ol>`:!report.carried?'<p class="stats-note">这一年没有记入新的政策决定。</p>':''}<p class="annual-closing">${report.carried?'旧的决定仍在塑造眼前的国家。新的一年，我还要接着回答。':changed.length?'这些变化不是纸上的装饰。明年再打开这份卷宗时，我必须承担它们继续生长的后果。':'数字暂时停在原处，历史却还在往前走。'}</p><p class="stats-note">原创历史演绎。数值为游戏指标；新年回顾不额外增减资源。${data.firstYear>1936?` 本周目从 ${data.firstYear} 年开始统计，此前年份不追溯。`:''}</p></article>`;
  }
  function present(){
    const data=S?._statistics, dialog=document.getElementById('annual-dialog');
    if (!data?.pending.length || typeof dialog?.showModal!=='function') return;
    const report=data.years.find(r=>r.year===data.pending[0]);
    document.getElementById('annual-content').innerHTML=reportHTML(report,data);
    bindAnnualCharts(document.getElementById('annual-content'),report,data);
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
  function chart(data,key,small=false,cursor=0,prefix=''){
    const list=data.events, w=760,h=260,left=48,right=20,top=20,bottom=40;
    const max=Math.max(10,...list.map(e=>e.values[key]));
    const ceiling=Math.ceil(max/10)*10;
    const x=i=>left+(w-left-right)*i/Math.max(1,list.length-1), y=v=>h-bottom-(h-top-bottom)*v/ceiling;
    const points=list.map((e,i)=>`${x(i)},${y(e.values[key])}`).join(' ');
    if(small) return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/></svg>`;
    const labels = list.map((e,i)=>({e,i})).filter(({e,i})=>i===0||i===list.length-1||e.year!==list[i-1].year);
    const ticks=[labels[0]];
    for(const point of labels.slice(1,-1))
      if(x(point.i)-x(ticks.at(-1).i)>=140 && x(list.length-1)-x(point.i)>=140) ticks.push(point);
    if(labels.length>1) ticks.push(labels.at(-1));
    return `<svg class="stat-chart" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${prefix}chart-title ${prefix}chart-desc"><title id="${prefix}chart-title">${NAMES[key]}变化折线图</title><desc id="${prefix}chart-desc">从 ${list[0].year} 年的 ${list[0].values[key]} 到 ${list.at(-1).year} 年的 ${list.at(-1).values[key]}，共 ${list.length} 次记录。用下方滑块逐条查看准确数值与事件。</desc>${[0,.25,.5,.75,1].map(t=>`<line x1="${left}" x2="${w-right}" y1="${y(Math.round(t*ceiling))}" y2="${y(Math.round(t*ceiling))}" class="chart-grid"/><text x="${left-10}" y="${y(Math.round(t*ceiling))+4}" text-anchor="end">${Math.round(t*ceiling)}</text>`).join('')}<polyline points="${points}" class="chart-line"/>${ticks.map(({e,i})=>`<text x="${x(i)}" y="${h-12}" text-anchor="${i===0?'start':i===list.length-1?'end':'middle'}">${e.year}</text>`).join('')}<line class="chart-cursor" x1="${x(cursor)}" x2="${x(cursor)}" y1="${top}" y2="${h-bottom}"/><circle class="chart-point" cx="${x(cursor)}" cy="${y(list[cursor].values[key])}" r="5"/></svg>`;
  }
  function detail(data,cursor,selected){
    const e=data.events[cursor],before=data.events[cursor-1]?.values||e.values;
    return `<div class="stat-event"><div><span>${e.year} · ${esc(e.kind)} · 第 ${cursor+1} / ${data.events.length} 条</span><h3>${esc(e.title)}</h3><p>${esc(e.leader.name)}在任</p></div><div class="stat-event-number"><b>${e.values[selected]}</b><span>${NAMES[selected]} / 本次 ${signed(e.values[selected]-before[selected])}</span></div></div>`;
  }
  function renderDashboard(data=viewData(), target=document.getElementById('statistics-content'), view=liveView){
    const {selected,tab}=view, prefix=view.prefix||'';
    if(!data?.events?.length){target.innerHTML='<p class="stats-empty">开启一段历史后，国家报告会随每次事件结算累积。</p>';return;}
    const cursor=view.cursor=Math.max(0,Math.min(view.cursor<0?data.events.length-1:view.cursor,data.events.length-1));
    const last=data.events.at(-1),first=data.events[0];
    target.innerHTML=`<div class="statistics-tabs" role="group" aria-label="统计内容"><button type="button" data-stats-tab="chart" aria-pressed="${tab==='chart'}">国家曲线</button><button type="button" data-stats-tab="years" aria-pressed="${tab==='years'}">新年手记 <span>${data.years.length}</span></button></div>${tab==='chart'?`<div class="stat-metrics">${KEYS.map(k=>`<button class="stat-metric" data-metric="${k}" aria-pressed="${selected===k}"><span>${NAMES[k]}${k==='PAR'?' ↓':''}</span><b>${last.values[k]}</b><small>自统计起点 ${signed(last.values[k]-first.values[k])}</small>${chart(data,k,true,cursor)}</button>`).join('')}</div><section class="stat-plot"><div class="stat-plot-title"><h3>${NAMES[selected]} · 变化轨迹</h3><span>${first.year} — ${last.year} / ${data.events.length} 次记录</span></div><div id="${prefix}stat-chart-holder">${chart(data,selected,false,cursor,prefix)}</div><label for="${prefix}stat-position">沿时间线查阅事件 <span>← → 逐条查看</span></label><input id="${prefix}stat-position" type="range" min="0" max="${data.events.length-1}" value="${cursor}" aria-label="选择事件记录"/><div id="${prefix}stat-event-detail" aria-live="polite">${detail(data,cursor,selected)}</div><p class="stats-note">横轴按实际结算顺序排列，同年可有多次变化；纵轴为所选指标的实际值。偏执越低越好，派系影响不表示好坏。没有新记录的年份不插入虚构数据。</p></section><details class="stat-table"><summary>查阅完整数值表</summary><div class="stat-table-scroll" tabindex="0" role="region" aria-label="国家指标数据表"><table><caption>本周目逐次结算记录</caption><thead><tr><th scope="col">年份 / 事件</th>${KEYS.map(k=>`<th scope="col">${NAMES[k]}</th>`).join('')}</tr></thead><tbody>${data.events.map(e=>`<tr><th scope="row">${e.year} · ${esc(e.title)}</th>${KEYS.map(k=>`<td>${e.values[k]}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`:data.years.length?`<label class="annual-select" for="${prefix}annual-year">翻阅年份 <select id="${prefix}annual-year">${data.years.slice().reverse().map(r=>`<option value="${r.year}">${r.year} · ${esc(r.leader.name)}</option>`).join('')}</select></label><div id="${prefix}annual-archive">${reportHTML(data.years.at(-1),data)}</div>`:'<p class="stats-empty">第一个新年到来时，你会在这里收到上一年的手记。</p>'}`;
    target.querySelectorAll('[data-stats-tab]').forEach(b=>b.addEventListener('click',()=>{view.tab=b.dataset.statsTab;renderDashboard(data,target,view);}));
    target.querySelectorAll('[data-metric]').forEach(b=>b.addEventListener('click',()=>{view.selected=b.dataset.metric;renderDashboard(data,target,view);target.querySelector(`[data-metric="${view.selected}"]`).focus();}));
    target.querySelector(`#${prefix}stat-position`)?.addEventListener('input',e=>{view.cursor=Number(e.target.value);target.querySelector(`#${prefix}stat-chart-holder`).innerHTML=chart(data,selected,false,view.cursor,prefix);target.querySelector(`#${prefix}stat-event-detail`).innerHTML=detail(data,view.cursor,selected);});
    if(tab==='years' && data.years.length)bindAnnualCharts(target,data.years.at(-1),data);
    target.querySelector(`#${prefix}annual-year`)?.addEventListener('change',e=>{const report=data.years.find(r=>r.year===Number(e.target.value));const archive=target.querySelector(`#${prefix}annual-archive`);archive.innerHTML=reportHTML(report,data);bindAnnualCharts(archive,report,data);});
  }
  function open(){liveView.cursor=-1;renderDashboard();document.getElementById('statistics-dialog').showModal();}
  document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('nav-statistics').addEventListener('click',open);
    document.getElementById('annual-continue').addEventListener('click',acknowledge);
    document.getElementById('annual-dialog').addEventListener('cancel',e=>{e.preventDefault();acknowledge();});
  });
  return {ensure,record,beforeYear,finish,present,acknowledge,open,reportHTML,keys:KEYS,annualSamples,annualCombinedHTML, mount:(data,target)=>renderDashboard(data,target,{selected:'IND',cursor:-1,tab:'chart',prefix:'run-'})};
})();
