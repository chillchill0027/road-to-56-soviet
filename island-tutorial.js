/* A deterministic, read-only case study. This never touches the active save. */
const IslandTutorial = (() => {
  // Each snapshot is from tests/fixtures/island-tutorial.json, case 10.
  const steps = [
    {
      year:'1936', art:'event/0-1/round/0', title:'一份清洗名单', decision:'铁腕：两个纵队一起划掉',
      explanation:'在克里姆林宫的办公桌前，两份名单等待签字。你选择同时打击两个政治纵队，希望以铁腕稳住权力；结果却让国家的资源先受损。偏执从 10 升到 30，工业从 95 降到 90，红军从 62 降到 54，民心从 68 降到 63。一个决定可以同时改写多项数据，而这些变化会延续到后面的会议和战场。选择之前，先想一想：眼前的政治收益，是否值得付出军事与社会成本？从这一刻起，之后每一份报告都带着这笔最初的代价。',
      metrics:[['偏执','10 → 30'],['工业','95 → 90'],['红军','62 → 54'],['民心','68 → 63'],['左翼','25 → 0'],['右翼','25 → 0'],['清洗次数','0 → 1']],
      note:'这是一条固定试局的实际结算；箭头表示此项选择前后的数值。'
    },
    {
      year:'1936', art:'event/0-2/round/0', title:'工厂转向军工', decision:'转军工：战争比所有人想的都近',
      explanation:'新一轮工业计划摆上桌面，你把机器与原料送往兵工厂。这道命令确实扩大了生产：工业从 90 升至 105，红军从 54 升至 69；但消费品受到挤占，民心由 63 降至 55。军力提高并不等于其他代价已经消失。民心不仅关系到国家的稳定，也会进入日后的战役计算。继续扩军时，必须留意人民还能承受多少，以及这支军队是否拥有足够的支持。当国家需要继续动员时，社会的反应也将成为必须考虑的一部分。',
      metrics:[['工业','90 → 105'],['红军','54 → 69'],['民心','63 → 55']],
      note:'工业增长不会直接代替红军、民心、防线等战役参数。'
    },
    {
      year:'1937', art:'event/1-1/round/0', title:'将领离开了作战室', decision:'批准清洗军方高层',
      explanation:'新的报告把怀疑指向军队高层。签字后，偏执从 45 降到 30，眼前的疑虑有所缓解；但军官和指挥经验也一同流失，红军从 69 降到 47，民心从 47 降到 41。上一步与这里之间还有一次推迟宪法的选择，使民心先下降了 8 点。因此，这里的起点并非上一幕的终点。看清一个政策的全部后果，才能避免刚扩充的军队又在其他决定中被削弱。纸上的安全感与现实中的战斗准备，可能朝着不同方向变化。',
      metrics:[['偏执','45 → 30'],['红军','69 → 47'],['民心','47 → 41'],['斯大林派','60 → 68'],['清洗次数','1 → 2']],
      note:'节选之间还有其他事件；本页以清洗决策的实际前后数值为准。'
    },
    {
      year:'1937', art:'event/1-2/round/0', title:'工业增长，民心下降', decision:'全速推进农业集体化',
      explanation:'地方报告要求更快完成农业集体化。你决定全速推进，工业由 105 升到 125，看起来为国家建设提供了更多能力；与此同时，民心由 41 急降到 16。账本上的两条曲线向相反方向移动，揭示了这个选择的真正代价。工业储备可以支撑长期建设，但工业本身并不直接进入战力比公式；民心过低却会削弱军队在每一场战役中的有效表现。在决策页面，资源增长与风险上升需要放在一起衡量。',
      metrics:[['工业','105 → 125'],['民心','41 → 16']],
      note:'民心系数为 0.65 + 民心 ÷ 200，越低则战役中的有效战力越低。'
    },
    {
      year:'1938', art:'event/1-5/round/0', title:'大炮填满生产计划', decision:'炮兵至上：大炮兵主义',
      explanation:'军方要求更多火炮，你批准了炮兵优先。红军从 47 增至 59，工业从 135 降至 125：军队得到补强，生产能力也付出了 10 点成本。此前另一项事件曾让工业增长，因此这里的起点是 135。重要的是，民心仍只有 16，火炮并没有自动修复社会的承受力。面对下一次选择，要同时看装备、民心、防线和敌情，不能只凭军工计划的规模判断胜算。一份成功的扩军计划，还需要足够稳定的后方来支撑。',
      metrics:[['工业','135 → 125'],['红军','47 → 59'],['民心','16 → 16']],
      note:'相邻节选之间经历过其他事件；未变化的民心仍会参与战役计算。'
    },
    {
      year:'1939', art:'event/2-2/round/0', title:'吞并的隐藏成本', decision:'全面吞并芬兰',
      explanation:'全面吞并看似给国家带来更多资源：工业从 135 增至 150。但这份收益附带了长期账单：民心从 21 降至 11，阵营影响从 70 跌至 45，民族问题从 0 升至 10，敌军强度修正增加 8。接下来的最后通牒又让民心从 11 降到 6。扩张获得的工业可以用于建设，却无法直接抵消战场上变强的敌军或社会信任的流失。外交选择也会改变战争条件。在地图上画出的边界，也会改变后续事件的起点和可承受的风险。',
      metrics:[['工业','135 → 150'],['民心','21 → 11'],['阵营影响','70 → 45'],['敌军强度修正','0 → +8'],['民族问题','0 → 10']],
      note:'账本为吞并这一项选择的变化；最后通牒是随后另一项决策。'
    },
    {
      year:'1942', art:'result/3-1/option/2/tier/0', title:'第一场崩溃', decision:'边境战役：全线反击',
      explanation:'战争到来时，工业已达 170，红军却在清洗和政治控制后只剩 49，民心更降至 3。边境防线为 10，敌军强度因早先吞并增至 118。你选择全线反击，战术系数 1.65 使这次进攻更难成功。战力比算得 0.25，低于 0.40，结果是崩溃：红军从 49 降到 23，民心从 3 降到 0。数值不会跌破零，因此民心的实际损失被下限截断。此前积累的低民心与军官流失，在此刻同时显现；下一道命令必须面对已经改变的局面。',
      metrics:[['战前工业','170'],['红军','49 → 23'],['民心','3 → 0'],['敌军强度','118'],['战力比 R','0.25 · 崩溃']],
      note:'R = 红军 × 工事系数 × 民心系数 ÷（敌军 × 预警 × 战术）。'
    },
    {
      year:'1942', art:'event/3-5/round/0', title:'拒绝援助的两面', decision:'拒绝租借援助',
      explanation:'边境崩溃后，动员、平民疏散与调兵暂时缓解了危机；莫斯科一战以 0.71 的战力比陷入僵持。此时外部援助摆上桌面，你选择拒绝：民心由 3 升到 9，阵营影响由 25 升到 30，但敌军强度修正也由 8 升到 18。短期民心增长是真实收益，敌军压力上升也是真实代价。接下来的战役会同时使用这两项结果，而不会只记住其中一项。援助是否值得接受，要结合此刻的战况和今后将面对的敌人来判断。',
      metrics:[['民心','3 → 9'],['阵营影响','25 → 30'],['左翼','0 → 12'],['敌军强度修正','+8 → +18']],
      note:'莫斯科战况与本页拒绝援助是先后发生的两个事件。'
    },
    {
      year:'1943', art:'result/3-6/option/0/tier/1', title:'斯大林格勒失守', decision:'巷战死守，同时准备两翼合围',
      explanation:'斯大林格勒的汇报送来时，红军为 53，民心为 9，防线为 10。拒绝援助后的敌军修正将本场敌军强度推到 113；即使采取战术系数为 0.9 的防守，战力比仍只有 0.55，落在 0.40 至 0.70 的失守区间。结算后红军从 53 降到 49，民心从 9 降到 1。前一次决策留下的敌军压力，与长期流失的民心，在这里共同决定了结果。军队固守阵地的决心无法单独决定胜负，战前的外交决定和社会状况也被带进了战场。',
      metrics:[['红军','53 → 49'],['民心','9 → 1'],['敌军强度','113'],['战术系数','0.9'],['战力比 R','0.55 · 失守']],
      note:'失守判定：0.40 ≤ R < 0.70；胜利奖励不会在失守时发放。'
    },
    {
      year:'1944', art:'result/3-7/option/2/tier/1', title:'又一次失守', decision:'库尔斯克：后撤诱敌',
      explanation:'库尔斯克战前，动员把红军从 49 补到 54，战术也改为后撤诱敌；但民心仍只有 1，敌军强度为 94，防线为 10。即使补充了兵力，战力比仍为 0.60，战线再次失守。红军从 54 降到 50，民心从 1 降到 0。这里的教训不是某个单项数字永远不够，而是战争持续消耗多个条件：只补兵力，无法立刻弥合民心、敌情和战术之间的缺口。增援让部队得以继续作战，却不能抹去此前损失留下的后果，选择仍需结合全部条件。',
      metrics:[['战前动员','红军 49 → 54'],['战斗后红军','54 → 50'],['民心','1 → 0'],['敌军强度','94'],['战力比 R','0.60 · 失守']],
      note:'民心有零点下限，战报中的实际减少量不会超过原有数值。'
    },
    {
      year:'1945', art:'event/3-11/round/0', title:'盟友也在记账', decision:'华沙：按兵不动',
      explanation:'多次失利之后，外交和民族关系仍在随命令变化。面对华沙，你选择按兵不动：民心从 2 降至 0，阵营影响从 30 降至 20，民族问题从 45 升至 65。战后这些数字不会随着战役画面结束而清空，它们继续参与后续剧情与最终结局的判定。军事失利是一条线索，如何对待邻国、盟友和内部矛盾，则会决定国家在战争之后还剩下怎样的处境。下次作出战时承诺时，也要考虑和平到来后人与邻国如何回应。',
      metrics:[['民心','2 → 0'],['阵营影响','30 → 20'],['民族问题','45 → 65']],
      note:'民族问题越高意味着风险越大；民心降幅受零点下限约束。'
    },
    {
      year:'1956', art:'ending/island', title:'走向「孤岛」', decision:'最终结算：阵营影响 15，民族问题 65',
      explanation:'这条固定试局以战争失败收场，随后经历领导权交接和新的政治选择。到 1956 年，阵营影响为 15，民族问题为 65，分别满足「阵营影响不超过 20」和「民族问题至少 50」的孤岛条件，最终进入孤岛结局。整个过程里，军工扩张确实增加了军力；清洗、民心流失、敌军修正和战术风险却一步步改变了战局。实际游玩时，留意每次结算和条件，再决定下一个选择。从开局起追踪这些变化，才能理解最后的结果是如何形成的。',
      metrics:[['阵营影响','15 · 条件 ≤ 20'],['民族问题','65 · 条件 ≥ 50'],['最终结局','孤岛']],
      note:'结局按游戏现有顺序判定，其他更高优先级条件也可能改变结果。'
    }
  ];
  let current = 0;
  function render() {
    const step = steps[current];
    menuMode(true);
    const stage = document.getElementById('stage');
    stage.innerHTML = `<article class="island-tutorial fade" data-tutorial-step="${current + 1}">
      <div class="tutorial-top"><button class="tutorial-back" id="tutorial-back">← 返回首页</button><span class="tutorial-progress">案例讲解 · ${current + 1} / ${steps.length}</span></div>
      <header class="tutorial-heading"><p class="tutorial-kicker">一条通往孤岛的历史 / ${esc(step.year)}</p><h1 tabindex="-1">${esc(step.title)}</h1><p class="tutorial-deck">${esc(step.decision)}</p></header>
      <div class="tutorial-art">${SceneArt.html(step.art, step.year)}</div>
      <div class="tutorial-body"><section><h2>这一刻，数字发生了什么</h2><p class="tutorial-explanation">${esc(step.explanation)}</p></section>
      <aside class="tutorial-ledger" aria-label="本次数据变化"><h3>决策账本 / DATA</h3>${step.metrics.map(([name,value])=>`<div class="tutorial-metric"><span>${esc(name)}</span><span>${esc(value)}</span></div>`).join('')}<p class="tutorial-note">${esc(step.note)}</p></aside></div>
      <div class="tutorial-actions">${current ? '<button class="btn ghost" id="tutorial-prev">← 上一幕</button>' : '<span></span>'}${current < steps.length - 1 ? '<button class="btn primary" id="tutorial-next">继续阅读 →</button>' : '<button class="btn primary" id="tutorial-start">开启你的历史 →</button>'}</div>
      <p class="tutorial-source">根据游戏中一条可复现的固定「孤岛」试局（案例 10）编写，节选关键决策；数字为同一次回放的实际结算。讲解独立于游戏进度，不会改变你的存档。</p>
    </article>`;
    document.getElementById('tutorial-back').addEventListener('click', renderTitle);
    document.getElementById('tutorial-prev')?.addEventListener('click', () => { current--; render(); });
    document.getElementById('tutorial-next')?.addEventListener('click', () => { current++; render(); });
    document.getElementById('tutorial-start')?.addEventListener('click', requestNewGame);
    scrollToStart();
    stage.querySelector('h1').focus({preventScroll:true});
  }
  return {open() { current = 0; render(); }};
})();
