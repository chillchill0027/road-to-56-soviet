/* A local editorial catalog for reviewing each independently commissioned scene. */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..'), ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'scene-art-manifest.js'), 'utf8') + ';globalThis.images=SCENE_ART_MANIFEST;', ctx);
const data = JSON.parse(fs.readFileSync(path.join(root, 'docs/scene-art/inventory.json'), 'utf8'));
const escape = s => String(s || '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const categories = {eventRound: '会谈', agenda: '常设议题', interlude: '过场', policyResult: '政策结果', decisionPhase: '决议台', incidentResult: '特殊行动', battleResult: '战役结果', scene: '阶段', warOutcome: '战争总结', agendaOutcomeCard: '批示后续', cover: '卷首', ending: '结局'};
const labels = {completed: '已完成', pending: '待生成', 'needs-fix': '待修正'};
const records = new Map();
const exists = file => {
  try { const stat = fs.statSync(path.join(root, file)); return stat.isFile() && stat.size > 0; }
  catch { return false; }
};

function batchRecord(id) {
  if (!records.has(id)) {
    const file = path.join(root, 'docs/scene-art', `batch-${String(id).padStart(3, '0')}.json`);
    records.set(id, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
  }
  return records.get(id);
}

function assess(entry) {
  const art = ctx.images[entry.sceneKey];
  if (!art || !art.file) return {entry, status: 'pending', reason: '尚未配置可审核的场景图片。'};
  if (!exists(art.file)) return {entry, status: 'pending', reason: '图片尚未生成；图像服务额度恢复后继续制作。'};
  // The existing cover and endings were accepted before the new scene commissions.
  const record = Number.isInteger(entry.batch) ? batchRecord(entry.batch) : null;
  const approved = entry.alreadyDedicated === true || !!(record && record.batch === entry.batch && record.file === art.file && record.approved === true);
  if (!approved) return {entry, status: 'pending', reason: '素材尚未完成审核，暂不展示图片。'};
  const issues = (record && Array.isArray(record.reviewIssues) ? record.reviewIssues : [])
    .filter(issue => issue.status === 'open' && (issue.cell == null || issue.cell === art.cell));
  return {entry, art, status: issues.length ? 'needs-fix' : 'completed', reason: issues.map(issue => issue.reason).join(' ')};
}

const entries = [...data.existing, ...data.scenes].map(assess);
const totals = entries.reduce((counts, item) => { counts[item.status]++; return counts; }, {completed: 0, pending: 0, 'needs-fix': 0});
const cards = entries.map(({entry: e, art: a, status, reason}) => {
  const search = escape([e.sceneKey, e.title, e.place, e.year, ...(e.actors || [])].join(' ').toLowerCase());
  const picture = a
    ? `<figure style="--cols:${a.cols};--rows:${a.rows};--ratio:${a.file.includes('ending-rupture') ? '4/3' : '3/2'}"><img loading="lazy" src="../../${escape(a.file)}" style="left:-${a.cell % a.cols * 100}%;top:-${Math.floor(a.cell / a.cols) * 100}%" alt="${escape(a.caption)}"></figure>`
    : `<figure class="placeholder"><span>待生成</span><p>${escape(reason)}</p></figure>`;
  const source = status === 'pending'
    ? `<p class="scene-text">${escape(e.summary)}</p>`
    : `<details><summary>场景依据</summary><p>${escape(e.summary)}</p></details>`;
  const review = status === 'needs-fix' ? `<p class="review-note">待修正：${escape(reason)}</p>` : '';
  return `<article data-category="${escape(e.category)}" data-status="${status}" data-scene-key="${escape(e.sceneKey)}" data-search="${search}"${status === 'completed' ? '' : ' hidden'}>${picture}<div class="copy"><span class="meta">${escape(categories[e.category] || e.category)} · ${escape(e.year || '随当前年份')}</span><span class="status ${status}">${labels[status]}</span><h2>${escape(e.title)}</h2><p>${escape(e.place)}</p><code>${escape(e.sceneKey)}</code>${review}${source}</div></article>`;
}).join('');

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>56之路：v1.11 配图制作预览</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f1ede5;color:#272523;font:15px/1.8 system-ui,sans-serif}header,main{max-width:1320px;margin:auto;padding:32px}header{padding-bottom:20px}h1{font-size:32px;line-height:1.4;margin:8px 0}header p{max-width:900px;color:#686159}.preview-note{padding:14px 18px;background:#e9dcd6;border-left:4px solid #8e313b;color:#5f2c33}form{display:flex;flex-wrap:wrap;gap:12px;position:sticky;top:0;background:#f1ede5f5;padding:18px 32px;z-index:3;border-block:1px solid #d9d1c4}input,select{font:inherit;padding:12px;border:1px solid #c8bdac;border-radius:8px;background:#fffdf8;min-height:48px}input{flex:1;min-width:160px}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}article{background:#fffdf8;border:1px solid #d9d1c4;border-radius:12px;overflow:hidden}article[hidden],#empty[hidden]{display:none}figure{position:relative;aspect-ratio:var(--ratio,3/2);margin:0;overflow:hidden;background:#252523}figure img{position:absolute;width:calc(100% * var(--cols));height:calc(100% * var(--rows));max-width:none}.placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;background:#e8e2d8;color:#6d6258}.placeholder span{font-size:22px}.placeholder p{font-size:13px;max-width:26em}.copy{padding:20px}h2{font-size:18px;line-height:1.6;margin:8px 0}p{margin:10px 0}.meta{color:#8e313b;font-size:12px}.status{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:4px;background:#e6eee3;color:#3f573a;font-size:12px}.status.pending{background:#eee7da;color:#756342}.status.needs-fix{background:#f0ddd5;color:#7e3930}.review-note{padding:10px;background:#f6e9e1;color:#7e3930;font-size:13px}.scene-text{padding-top:12px;border-top:1px solid #d9d1c4;font-size:13px;color:#514c46}code{font-size:12px;overflow-wrap:anywhere;color:#686159}details{margin-top:16px;border-top:1px solid #d9d1c4;padding-top:12px}summary{cursor:pointer;min-height:32px}details p{font-size:13px;color:#514c46}#empty{grid-column:1/-1;color:#686159}@media(max-width:900px){main{grid-template-columns:repeat(2,minmax(0,1fr));padding:20px}header{padding:24px}form{padding-inline:20px}}@media(max-width:550px){main{grid-template-columns:1fr}.copy{padding:18px}h1{font-size:28px}input,select{width:100%}}:focus-visible{outline:3px solid #ad2635;outline-offset:3px}
</style></head><body>
<header><span class="meta">56之路：苏维埃 · 本地素材审核目录</span><h1>每一段历史，各有它的画面。</h1><p class="preview-note"><strong>v1.11 配图仍在制作，非已发布最终版。</strong>本页展示本地制作进度，待生成与待修正内容尚未全部完成。</p><p>共 ${entries.length} 个场景绑定，含 ${data.scenes.length} 个新增场景、既有卷首与 ${data.existing.length - 1} 个结局。已完成项须有实际图片和审核认可记录；既有卷首与结局沿用已认可素材。待修正项另行标记，不计入已完成数。图片为 AI 生成的历史演绎。</p><p id="totals">已完成 ${totals.completed} · 待修正 ${totals['needs-fix']} · 待生成 ${totals.pending} · 共 ${entries.length} 个场景</p><p id="count" aria-live="polite">当前显示 ${totals.completed} 个场景 · 已完成</p></header>
<form onsubmit="return false"><input id="query" type="search" aria-label="搜索场景" placeholder="搜索标题、地点、人物或场景ID"><select id="status" aria-label="制作状态"><option value="completed" selected>已完成（${totals.completed}）</option><option value="">全部（${entries.length}）</option><option value="pending">待生成（${totals.pending}）</option><option value="needs-fix">待修正（${totals['needs-fix']}）</option></select><select id="category" aria-label="场景类别"><option value="">全部类别</option>${Object.entries(categories).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></form>
<main>${cards}<p id="empty" hidden>没有符合当前筛选条件的场景。</p></main>
<script>
const cards=[...document.querySelectorAll('article')],query=document.querySelector('#query'),category=document.querySelector('#category'),status=document.querySelector('#status');
const labels={completed:'已完成',pending:'待生成','needs-fix':'待修正'};
function filter(){let n=0;const text=query.value.trim().toLowerCase();for(const card of cards){card.hidden=!!((status.value&&card.dataset.status!==status.value)||(category.value&&card.dataset.category!==category.value)||!card.dataset.search.includes(text));if(!card.hidden)n++;}document.querySelector('#count').textContent='当前显示 '+n+' 个场景 · '+(labels[status.value]||'全部状态');document.querySelector('#empty').hidden=n!==0;}
query.addEventListener('input',filter);category.addEventListener('change',filter);status.addEventListener('change',filter);filter();
</script></body></html>`;
fs.writeFileSync(path.join(root, 'docs/scene-art/catalog.html'), html);
console.log(`Wrote ${entries.length} catalog cards: ${totals.completed} completed, ${totals['needs-fix']} need correction, ${totals.pending} pending.`);
