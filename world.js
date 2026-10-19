/* A newspaper, call or overheard exchange supplies context before a reply. No policy effects here. */
const World = (() => {
  const art = {
    kiosk: ["world-life-sheet", 0, "报亭"],
    corridor: ["world-life-sheet", 1, "走廊"],
    kitchen: ["world-life-sheet", 2, "来信"],
    station: ["world-life-sheet", 3, "车站"],
    newsroom: ["world-signals-sheet", 0, "通讯社"],
    "radio-room": ["world-signals-sheet", 1, "监听室"],
    "cipher-desk": ["world-signals-sheet", 2, "密电"],
    "field-phone": ["world-signals-sheet", 3, "战地电话"],
    canteen: ["world-state-sheet", 0, "工厂食堂"],
    "lab-bench": ["world-state-sheet", 1, "实验台"],
    "bread-line": ["world-state-sheet", 2, "面包店"],
    reception: ["world-state-sheet", 3, "等候室"],
  };
  for (const [key, [sheet, cell, caption]] of Object.entries(art)) {
    ART_SOURCE[key] = [sheet, cell];
    ART_CAPTION[key] = caption;
    ART_TONE[key] = "mid";
  }
  const handles = (id) => Object.hasOwn(WORLD_INTERLUDES, id);
  function substitutions() {
    const war =
      {
        defeat:
          "前线已经停止推进，战败条件正在履行。损失、撤出的人员与留下的领土分别列在账上。",
        costly:
          "战争以惨重代价结束。伤亡表比庆祝的公报厚，许多单位仍在补齐姓名。",
        great:
          "大规模胜利已经确认。驻军、伤亡和重建需求正在分别报送，胜利没有免去这些账。",
        held: "本土守住了，部队没有实现更远的推进。停战线仍留着反复争夺的阵地。",
        stalemate:
          "战线在僵持中停下来。双方发布各自的公报，失踪人员仍没有全部找到。",
      }[S.warOutcome] ||
      "前线正在报送伤亡、运输和阵地情况，最终汇总还没有完成。";
    const death =
      {
        natural:
          "斯大林逝世的消息传出。广播停顿了一会儿，随后开始念主席团的公告。",
        assassinated:
          "内部急电确认最高领导人遭到暗杀。公开公告仍很简短，各部门要求尽快明确由谁签字。",
        military:
          "军方接管中央机关的消息已经送达。值班人员改用临时名单，等候正式的领导安排。",
        beria:
          "内务部暂时控制中枢。贝利亚的部门已发出值班安排，长期领导席位仍待确认。",
      }[S.deathMode] || "中央机关正在准备一份关于最高领导席位的公告。";
    return {
      warReport: war,
      deathReport: death,
      interregnumReport:
        S.interimLeader === "military"
          ? "军方暂时控制中央机关。"
          : S.interimLeader === "beria"
            ? "内务部已临时接管中枢。"
            : "办公厅仍在询问，下一份通知应由谁签字。",
      nuclearReport:
        S.nuclear >= 40
          ? "科研组报告已有阶段成果，随后列出下一阶段仍缺的材料和设备。"
          : S.nuclear >= 15
            ? "基础研究已有记录。科研人员请求明确是否继续投入，档案里还没有完成的武器。"
            : "旧备忘录仍在档案夹里。没有完整工程可以交接，科研组仍在等待正式投入。",
      officerReport:
        S.tukh === false
          ? "原有指挥员的名字被划去，几处签字栏已换了新人。"
          : S.officerCorpsPurged
            ? "元帅仍在，部分岗位已被调换，新的指挥关系还没有磨合。"
            : "专业军官要求保留完整的指挥与协同体系。",
    };
  }
  function materialize(fragment, key, where = "") {
    S._worldInbox ??= {};
    if (S._worldInbox[key]) return S._worldInbox[key];
    const tokens = substitutions();
    const record = {
      ...fragment,
      key,
      sceneId: S.curId,
      year: S.year,
      stamp: fragment.stamp || [S.year, where].filter(Boolean).join(" · "),
      body: fragment.body.replace(/\{(\w+)\}/g, (_, k) => tokens[k] || ""),
    };
    S._worldInbox[key] = record;
    return record;
  }
  function positions(n, total) {
    return Array.from({ length: n }, (_, j) =>
      n === 1 ? 0 : Math.round((j * (total - 1)) / (n - 1)),
    );
  }
  function current(session, profile) {
    const rows =
      session.kind === "event"
        ? WORLD_EVENTS[session.sceneId]
        : [WORLD_AGENDAS[session.decisionId]];
    if (!rows?.length || !rows[0]) return null;
    const slots = positions(rows.length, profile.rounds.length);
    let index = 0;
    for (let n = 0; n < slots.length; n++)
      if (slots[n] <= session.round) index = n;
    const occurrence =
      session.kind === "decision"
        ? `${session.decisionId}:${S["_c_" + session.decisionId] || 0}`
        : "event";
    const key = `${session.sceneId}/${occurrence}/${index}`;
    const known = !!S._worldInbox?.[key];
    const record = materialize(
      rows[index],
      key,
      profile.rounds[session.round].time,
    );
    return { record, show: slots[index] === session.round || !known };
  }
  function card(record, compact = false, heading = "h2") {
    const [label, form] = WORLD_SOURCE_TYPES[record.type] || [
      "来件",
      "document",
    ];
    return `<section class="world-source world-${form}${compact ? " world-compact" : ""}" data-kind="${record.type}" aria-label="${esc(label)}：${esc(record.title)}"><div class="world-source-meta"><span>${esc(record.from)}</span><time>${esc(record.stamp)}</time></div><div class="world-source-kind">${esc(label)}</div><${heading}>${esc(record.title)}</${heading}><p>${esc(record.body)}</p></section>`;
  }
  function renderInterlude(sc, entry) {
    const pages = WORLD_INTERLUDES[S.curId];
    if (!pages) return;
    if (S.curId === "5-0" && S.deathMode) S._novelLeader = "vacant";
    if (
      S._worldPage?.sceneId !== S.curId ||
      !Number.isInteger(S._worldPage.index) ||
      S._worldPage.index < 0 ||
      S._worldPage.index >= pages.length
    )
      S._worldPage = { sceneId: S.curId, index: 0 };
    const index = S._worldPage.index,
      id = S.curId;
    const record = materialize(pages[index], `${id}/interlude/${index}`);
    renderHUD();
    if (entry.applied && entry.deltas.length) showDeltas(entry.deltas);
    document.getElementById("stage").innerHTML =
      `<div class="fade world-interlude"><div class="world-scene-heading"><span>${esc(sc.chapter)} · ${esc(S.year)}</span><span>${index + 1} / ${pages.length}</span></div><div class="world-scene-frame">${artHTML(record.art, S.year)}</div><div class="world-scene-copy">${card(record, false, "h1")}<div class="acts"><button class="btn" id="next">${index < pages.length - 1 ? "往 下 看" : "继 续"}</button></div></div></div>`;
    document.getElementById("next").addEventListener("click", () => {
      if (S.curId !== id || S._worldPage?.index !== index) return;
      if (index < pages.length - 1) {
        S._worldPage.index++;
        renderInterlude(sc, { applied: false, deltas: [] });
      } else {
        delete S._worldPage;
        advance();
      }
    });
    saveGame();
    scrollToStart();
  }
  function archiveHTML() {
    const records = Object.values(S._worldInbox || {}).reverse();
    return records.length
      ? `<section class="world-archive"><h3>收到的消息</h3>${records.map((r) => `<details><summary><span>${esc(WORLD_SOURCE_TYPES[r.type][0])}</span> ${esc(r.title)}<small>${esc(r.stamp)}</small></summary>${card(r, true)}</details>`).join("")}</section>`
      : "";
  }
  return {
    handles,
    renderInterlude,
    current,
    card,
    archiveHTML,
    positions,
    materialize,
    art,
  };
})();
