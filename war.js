/* War reportage is a presentation of settled results, never a second simulation. */
const WarReports = (() => {
  const focus = {
    frontier:[[26.3,53.0],[25.0,52.6],[24.1,52.8],[23.9,52.6],[23.8,53.0]],
    moscow:[[37.9,55.75],[37.2,55.75],[36.0,55.7],[36.9,55.75],[36.3,55.85]],
    volga:[[44.78,48.74],[44.50,48.75],[44.52,48.75],[44.53,48.75],[43.6,49.0]],
    kursk:[[36.8,51.73],[36.5,51.7],[36.2,51.73],[36.2,51.8],[36.65,51.1]],
    belarus:[[29.25,54.25],[29.0,54.25],[28.9,54.25],[28.6,54.25],[28.0,54.0]],
    romania:[[28.25,46.91],[28.1,46.91],[28.0,47.0],[28.02,46.94],[27.8,46.8]],
    berlin:[[14.0,52.45],[13.7,52.5],[13.6,52.51],[13.55,52.51],[13.42,52.52]]
  };
  for (const key of Object.keys(WAR_SECTORS)) for(let cell=0;cell<4;cell++) {
    const id=`war-${key}-${cell}`;
    ART_SOURCE[id]=[`battle-${key}-sheet`,cell];
    ART_CAPTION[id]=`${WAR_SECTORS[key].name} · ${WAR_PHOTO_CAPTIONS[key][cell]}`;
    ART_TONE[id]='mid';
  }
  for(let cell=0;cell<4;cell++) {
    const id=`war-aftermath-${cell}`;
    ART_SOURCE[id]=['battle-aftermath-sheet',cell];
    ART_CAPTION[id]=['停战与撤收','胜利后的重建','胜利与和平','警戒线上的和平'][cell];
    ART_TONE[id]='mid';
  }
  const sectorFor = name => Object.entries(WAR_SECTORS).find(([,s])=>s.names.includes(name));
  const imageCell = level => level<=1?0:level-1;
  function base(sc,o,deltas){
    return {v:1,id:`${S.curId}:${sc.options.indexOf(o)}`,sceneId:S.curId,optionIndex:sc.options.indexOf(o),year:S.year,policy:o.label,leader:typeof Novel!=='undefined' && S.novelVersion?Novel.leader().name:'约瑟夫·斯大林',deltas:deltas.map(d=>({...d}))};
  }
  function create(sc,o,battles,deltas){
    const b=battles?.[0], found=b && sectorFor(b.name);
    if(found){
      const [key,sector]=found, level=Number.isInteger(b.level)?b.level:WAR_TIER_NOTES.findIndex(t=>t[0]===b.tier);
      if(!Number.isInteger(level)||level<0||level>4) return null;
      const [place,headline,dispatch,letter]=sector.reports[level],note=WAR_TIER_NOTES[level];
      return {...base(sc,o,deltas),kind:'battle',sector:key,name:b.name,order:sector.order,season:sector.season,tier:b.tier,level,place,headline,opening:`${place}送来了命令执行后的报告。文件后面，紧跟着需要处理的人员、物资和地方事务。`,photo:`war-${key}-${imageCell(level)}`,points:sector.points.map(p=>[...p]),focus:[...focus[key][level]],terrain:sector.terrain,supply:sector.supply,
        messages:[{from:'方面军值班电报',title:'前沿送来的这一页',text:dispatch},{from:'军需与交通部门',title:note[1],text:`${sector.supply}仍是当前行动的要害。${note[2]}`},{from:'战地来信',title:'公报之外的人',text:letter}],outlook:[`下一封来自${place}的电报，首先要说明失散部队能否重新归队。`,`${place}的新阵地需要接住退下来的部队，也需要接上后方的物资。`,`${place}的下一步，取决于持续补给能否赶在消耗前面。`,`${place}获得了喘息；接下来要把时间用在轮换、运输和修复上。`,`${place}的推进已经发生，下一道命令要让后方跟上前沿。`][level],ratio:b.R};
    }
    if(S.curId==='a3-end' && WAR_ENDINGS[S.warOutcome]) {
      const end=WAR_ENDINGS[S.warOutcome];
      return {...base(sc,o,deltas),...end,kind:'war',sector:'aftermath',name:'战争总体结果',season:'战争结束 · 汇总报告',place:'欧洲战区—苏联后方',photo:`war-aftermath-${end.cell}`,points:[['柏林',13.4,52.52],['明斯克',27.56,53.9],['莫斯科',37.62,55.75]],focus:null,terrain:'已交战地区与战后事务',supply:'复员、重建、驻军和停战安排',messages:[{from:'最高统帅部汇总',title:'战争的结果',text:end.dispatch},{from:'地方来信',title:'回到生活里的人',text:end.civilian},{from:'战后工作备忘',title:'下一页还没有写完',text:end.outlook}],counts:{collapse:S.collapses||0,lost:S.loses||0,stalemate:S.standoffs||0,held:Math.max(0,(S.holds||0)-(S.reverses||0)),counter:S.reverses||0}};
    }
    const key=S.curId==='3-12' && sc.options.indexOf(o)===2?'3-12-west':S.curId;
    const incident=WAR_INCIDENTS[key];
    if(!incident)return null;
    const index=key==='3-12-west'?0:sc.options.indexOf(o),row=incident.outcomes[index];
    if(!row)return null;
    const [tier,place,headline,opening,outlook]=row;
    return {...base(sc,o,deltas),kind:'incident',sector:key,name:incident.name,season:incident.phase,tier,level:null,place,headline,opening:`${place}的报告送到了案头。军方与地方正在分别处理这道命令留下的后续事务。`,outlook,photo:incident.photos?.[index]||incident.art,points:incident.points.map(p=>[...p]),focus:null,terrain:'城市、河岸与运输通道',supply:outlook,messages:[{from:'战区工作电报',title:'命令已经执行',text:opening},{from:'行动后续报告',title:'这项决定留下什么',text:outlook}]};
  }
  function capture(sc,o,battles,deltas){
    const report=create(sc,o,battles,deltas);
    if(!report)return null;
    if(!S._warReports) S._warReports=[];
    const old=S._warReports.find(r=>r.id===report.id);
    if(old)return old;
    S._warReports.push(report);
    return report;
  }
  function forResult(sc,o,battles,deltas){
    return S._warReports?.find(r=>r.sceneId===S.curId && r.optionIndex===sc.options.indexOf(o)) || create(sc,o,battles,deltas);
  }
  function heroHTML(report,lazy=false){
    return artHTML(report.photo,report.year).replace('<figcaption>','<figcaption class="war-photo-caption">').replace('decoding="async"',`decoding="async"${lazy?' loading="lazy"':''}`);
  }
  function mapHTML(r,archive=false){
    const coords=[...r.points.map(p=>p.slice(1)),...(r.focus?[r.focus]:[])];
    const lons=coords.map(p=>p[0]),lats=coords.map(p=>p[1]);
    const spanX=Math.max(2,Math.max(...lons)-Math.min(...lons)),spanY=Math.max(1.8,Math.max(...lats)-Math.min(...lats));
    const centerX=(Math.max(...lons)+Math.min(...lons))/2,centerY=(Math.max(...lats)+Math.min(...lats))/2;
    const x=lon=>90+(lon-(centerX-spanX/2))/spanX*420,y=lat=>70+((centerY+spanY/2)-lat)/spanY*190;
    const line=r.points.map(p=>`${x(p[1])},${y(p[2])}`).join(' '),id=`war-map-${archive?'archive-':''}${r.id.replace(/[^a-z0-9]/gi,'-')}`;
    return `<figure class="war-map" data-sector="${esc(r.sector)}"><div class="war-map-head"><span>战区位置示意</span><b>${esc(r.place)}</b><p class="war-terrain">${esc(r.terrain)}</p></div><svg viewBox="0 0 600 340" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${esc(r.name)} · ${esc(r.place)}</title><desc id="${id}-desc">${r.points.map(p=>`${esc(p[0])}，东经${p[1]}度，北纬${p[2]}度`).join('；')}。${r.focus?'红点标注本次报告所在的约略战区。':'标记为报告涉及的地点。'}连线不表示实际战线或领土控制。</desc><rect width="600" height="340" class="map-paper"/>${[0,1,2,3,4].map(n=>`<path class="map-grid" d="M${60+n*120},35V300 M40,${45+n*65}H565"/>`).join('')}<path class="map-north" d="M555,72V40l-6,10m6,-10l6,10"/><text class="map-compass" x="555" y="30" text-anchor="middle">北</text><polyline class="map-links" points="${line}"/>${r.points.map((p,n)=>`<g class="map-place" data-lon="${p[1]}" data-lat="${p[2]}"><circle cx="${x(p[1])}" cy="${y(p[2])}" r="5"/><text x="${x(p[1])}" y="${y(p[2])+(n%2?-23:30)}" text-anchor="middle">${esc(p[0])}</text></g>`).join('')}${r.focus?`<g class="map-focus" data-lon="${r.focus[0]}" data-lat="${r.focus[1]}"><circle cx="${x(r.focus[0])}" cy="${y(r.focus[1])}" r="15"/><circle cx="${x(r.focus[0])}" cy="${y(r.focus[1])}" r="5"/></g>`:''}<text class="map-coordinate" x="40" y="322">${(centerX-spanX/2).toFixed(1)}°E — ${(centerX+spanX/2).toFixed(1)}°E / ${centerY.toFixed(1)}°N 附近</text></svg><figcaption>${r.focus?'红点为报告所在战区；其余标记为关联地点。':'标记为报告涉及地点。'}位置与连线为示意，不表示实时战线或领土归属。</figcaption></figure>`;
  }
  function bodyHTML(r,archive=false){
    const counts=r.counts?`<div class="war-counts" aria-label="本周目实际战役结果">${[['崩溃','collapse'],['失守','lost'],['僵持','stalemate'],['守住','held'],['反攻','counter']].map(([label,key])=>`<div><span>${label}</span><b>${r.counts[key]}</b></div>`).join('')}</div>`:'';
    return `<section class="war-report" data-war-kind="${r.kind}" data-war-sector="${esc(r.sector)}" data-war-tier="${esc(r.tier)}"><header class="war-report-heading"><div class="eyebrow">FRONT DISPATCH / 战地卷</div><div class="war-date">${r.year} · ${esc(r.season)}</div><h2>${esc(r.name)}<span>${esc(r.tier)}</span></h2><p>${esc(r.policy)}</p></header>${counts}${mapHTML(r,archive)}<div class="war-sources">${r.messages.map((m,n)=>`<article class="war-source war-source-${n}"><div class="war-source-meta"><span>${esc(m.from)}</span><span>${r.year} · ${esc(r.place)}</span></div><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p></article>`).join('')}</div>${r.kind==='battle'?`<div class="war-outlook"><span>留给下一阶段</span><p>${esc(r.outlook)}</p></div>`:''}${archive?`<div class="war-ledger"><h3>此次行动 · 实际变化</h3><div class="deltas">${r.deltas.length?effectsHTML(r.deltas):'无数值变化'}</div></div>`:'<p class="war-archive-note">战报已收入「见闻档案」的战地卷。<button type="button" class="nav-button" id="war-open-archive">翻阅战地卷 →</button></p>'}</section>`;
  }
  const LAST_KEY='r56sov.war.last.v1';
  function finish(){store.set(LAST_KEY,S._warReports||[]);}
  function archiveHTML(){
    const history=S.curId ? S._warReports||[] : store.get(SAVE_KEY)?.S?._warReports || store.get(LAST_KEY) || [];
    if(!history.length)return '';
    return `<section class="war-archive"><div class="eyebrow">FRONT ARCHIVE / 战地卷</div><h3>从接触线到停战之后。</h3><p class="hint">${history.length} 份已结算战报 · 按收到顺序保存</p>${history.slice().reverse().map(r=>`<details class="war-archive-entry"><summary><span>${r.year} · ${esc(r.name)}</span><b>${esc(r.tier)}</b></summary><h3>${esc(r.headline)}</h3>${heroHTML(r,true)}${bodyHTML(r,true)}</details>`).join('')}</section>`;
  }
  return {capture,create,forResult,finish,heroHTML,bodyHTML,mapHTML,archiveHTML,sectorFor,imageCell};
})();
