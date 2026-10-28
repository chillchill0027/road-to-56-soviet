/* Visual-novel adapter. Dialogue accumulates intent; only the existing engine settles policy. */
const Novel = (() => {
  const leaderRoutes = {
    khrushchev: ["khrushchev", "赫鲁晓夫", "集体领导中的最高席位"],
    stalin: ["malenkov", "马林科夫", "既有路线的继承者"],
    beria: ["beria", "贝利亚", "技术官僚改革领导人"],
    military: ["zhukov", "朱可夫", "军方最高领导人"],
    right: ["mikoyan", "米高扬", "新市场路线领导人"],
    left: ["left-chair", "左翼执行书记", "架空继承席位"],
    soviet: ["soviet-chair", "最高苏维埃主席", "经代表机关授权的最高席位"],
    caretaker: ["malenkov", "马林科夫", "临时委员会协调人"],
  };
  const handles = (id) => Object.hasOwn(NOVEL_EVENTS, id);
  function leader() {
    if (S._novelLeader === "vacant")
      return { key: "vacant", name: "国家意志", role: "最高席位暂时空缺" };
    if (S._novelLeader) {
      let [key, name, role] =
        leaderRoutes[S._novelLeader] || leaderRoutes.caretaker;
      if (
        S._novelLeader === "military" &&
        S.napoleonGov &&
        S.tukh &&
        !S.napoleonPurged
      )
        [key, name] = ["tukh", "图哈切夫斯基"];
      return { key, name, role };
    }
    return { key: "stalin", name: "约瑟夫·斯大林", role: "最高领导人" };
  }
  function address() {
    const l = leader();
    return l.key === "stalin"
      ? "斯大林同志"
      : l.key === "vacant"
        ? "各位同志"
        : l.name + "同志";
  }
  function speaker(key) {
    const l = leader();
    const cast = NOVEL_CAST[key] || NOVEL_CAST.clerk;
    // A player never receives a speech from their own portrait.
    return key === l.key
      ? { key: "council", ...NOVEL_CAST.council }
      : { key, ...cast };
  }
  function portrait(key, extra = "") {
    const c = NOVEL_CAST[key];
    return c?.cell !== undefined
      ? `<span class="vn-portrait ${extra}" role="img" aria-label="${esc(c.name)} · AI历史演绎肖像" style="--cx:${c.cell % 4};--cy:${Math.floor(c.cell / 4)}"></span>`
      : "";
  }
  function seatHTML() {
    const l = leader();
    return `<div class="vn-seat">${portrait(l.key, "vn-seat-portrait")}<span><small>当前席位</small><strong>${esc(l.name)}</strong><span>${esc(l.role)}</span></span></div>`;
  }
  function profile(session = S._novel) {
    if (!session) return null;
    if (session.kind === "event") return NOVEL_EVENTS[session.sceneId];
    const d = DECISIONS.find((d) => d.id === session.decisionId);
    const encounter = NOVEL_AGENDA_SCENES[session.decisionId];
    if (!d || !encounter) return null;
    return {
      agenda: true,
      pace: "本次批示",
      reason: "听取具体汇报后，一次回应决定本期执行或暂缓。",
      arrival: encounter.arrival,
      art: encounter.art,
      approved: encounter.approved,
      deferred: encounter.deferred,
      rounds: [{ actor: encounter.actor, place: encounter.place,
        time: '本期安排', aside: encounter.aside, line: encounter.line }],
      voices: [[encounter.yes], [encounter.no]],
      cost: decisionCost(d),
    };
  }
  function normalizeDecisionSession() {
    const s = S._novel;
    if (!s || s.kind !== "decision" || s.agendaVersion === 2 || S._pendingResult) return;
    const oldCount = NOVEL_DECISIONS[s.decisionId]?.[1];
    if (!oldCount || !Array.isArray(s.answers) || !Number.isInteger(s.round) ||
        s.round !== s.answers.length || s.round < 0 || s.round >= oldCount ||
        s.answers.some((a,n) => a.round !== n || ![0,1].includes(a.option))) return;
    // Earlier replies were never charged. Keep them as discussion; request one final decision.
    s.previousDiscussion = s.answers.map(a => ({...a}));
    s.answers = [];
    s.round = 0;
    s.agendaVersion = 2;
  }
  function candidates(session = S._novel) {
    if (!session) return [];
    if (session.kind === "decision")
      return [
        { id: 0, key: "A", label: "推进议题", enabled: true },
        { id: 1, key: "B", label: "维持现状", enabled: true },
      ];
    return SCENES[session.sceneId].options.map((o, id) => ({
      id,
      key: o.k,
      label: o.label,
      enabled: !o.when || o.when(S),
      hidden: o.only && o.when && !o.when(S),
      lock: o.lock || "当前条件不满足",
    }));
  }
  function tally(answers, options) {
    const scores = new Map(
      options.filter((o) => o.enabled && !o.hidden).map((o) => [o.id, 0]),
    );
    for (const a of answers)
      if (scores.has(a.option)) scores.set(a.option, scores.get(a.option) + 1);
    const max = Math.max(...scores.values());
    const tied = [...scores].filter(([, v]) => v === max).map(([id]) => id);
    // With more than two policies an odd count can still tie: latest explicit stance breaks it.
    const last = [...answers].reverse().find((a) => tied.includes(a.option));
    return {
      winner: last?.option ?? tied[0],
      scores: [...scores].map(([id, votes]) => ({ id, votes })),
      tied: tied.length > 1,
    };
  }
  function validSession(s, id) {
    const p = profile(s);
    return !!(
      s &&
      s.v === 1 &&
      ["event", "decision"].includes(s.kind) &&
      s.sceneId === id &&
      p &&
      Array.isArray(s.answers) &&
      Number.isInteger(s.round) &&
      s.round >= 0 &&
      s.round < p.rounds.length &&
      s.round === s.answers.length &&
      s.answers.every(
        (a, n) =>
          a.round === n &&
          Number.isInteger(a.option) &&
          p.voices[a.option]?.[n],
      )
    );
  }
  function renderEvent(sc, entry) {
    if (!validSession(S._novel, S.curId))
      S._novel = {
        v: 1,
        kind: "event",
        sceneId: S.curId,
        round: 0,
        answers: [],
      };
    renderHUD();
    if (entry.applied && entry.deltas.length) showDeltas(entry.deltas);
    renderActive();
  }
  function roundArt(r) {
    if (/走廊|外间/.test(r.place)) return "corridor";
    if (/铁路|调度|站台/.test(r.place)) return "station";
    if (/休息室|食堂/.test(r.place)) return "canteen";
    if (/接待|来访/.test(r.place)) return "reception";
    if (/情报|监听/.test(r.place)) return "radio-room";
    if (/工厂|厂区/.test(r.place)) return "steel";
    if (/居民|住房|工棚/.test(r.place)) return "housing";
    if (/实验室|物理研究/.test(r.place)) return "lab-bench";
    if (/训练|演习/.test(r.place)) return "formation";
    if (/总参谋部|作战室|作战图/.test(r.place)) return "map-arrows";
    if (/谈判|会谈/.test(r.place)) return "summit-table";
    if (/档案|调查/.test(r.place)) return "archive";
    if (r.place === "书房" && leader().key !== "stalin") return "desk";
    return ART[S.curId];
  }
  function renderActive() {
    normalizeDecisionSession();
    const session = S._novel,
      p = profile();
    if (!p || !validSession(session, S.curId)) {
      delete S._novel;
      const scene = SCENES[S.curId];
      if (scene.decisions) renderDecisions(scene);
      else renderScene(scene, { restoring: true });
      return;
    }
    const r = p.rounds[session.round],
      actor = speaker(r.actor),
      sc = SCENES[S.curId];
    const title =
      session.kind === "decision"
        ? DECISIONS.find((d) => d.id === session.decisionId).name
        : sceneText(sc, sc.title);
    const previous = session.answers.at(-1);
    const changed =
      session.answers.length > 1 &&
      previous.option !== session.answers.at(-2).option;
    const reaction = changed
      ? {
          molotov: "他摘下眼镜，重新核对你改变的措辞。",
          beria: "他收住了刚才的笑意，将已经写好的意见翻到背面。",
          worker: "她停了一下，重新判断这次表态能不能成为一个承诺。",
          general: "参谋将已经画好的箭头擦淡，等候新的边界。",
          zhukov: "朱可夫重新看向地图，没有用沉默代替反对。",
        }[actor.key] ||
        "对方把原先的草案推回桌心。你改变了立场，这场谈话也需要重新寻找方向。"
      : "";
    const all = candidates(),
      enabled = all.filter((o) => !o.hidden),
      locked = enabled.filter((o) => !o.enabled);
    const text = sceneText(sc, r.line).replaceAll("{address}", address());
    const context = World.current(session, p);
    const sceneKey = p.agenda ? `agenda/${session.decisionId}` : `event/${session.sceneId}/round/${session.round}`;
    const dedicatedArt = typeof SceneArt !== 'undefined' ? SceneArt.html(sceneKey, S.year) : '';
    const stage = document.getElementById("stage");
    stage.innerHTML = `<div class="fade novel-layout">
      <div class="vn-heading"><div><div class="tag">${esc(sc.chapter)} · ${esc(S.year)}</div><h1 class="scene">${esc(title)}</h1></div>${seatHTML()}</div>
      <div class="vn-progress" aria-label="${p.agenda ? '本项决议一次批示' : `对话进度，第${session.round + 1}轮，共${p.rounds.length}轮`}"><span>${p.agenda ? '听取汇报 · 一次批示' : `第 ${session.round + 1} / ${p.rounds.length} 轮`}</span><div>${p.agenda ? '' : p.rounds.map((_, n) => `<span class="${n < session.round ? "done" : n === session.round ? "now" : ""}"></span>`).join("")}</div><button class="nav-button" id="vn-log">见闻档案</button></div>
      ${context?.show ? `<div class="vn-context">${World.card(context.record)}</div>` : ""}
      <div class="vn-film">${dedicatedArt || artHTML(p.agenda ? p.art : context?.show ? context.record.art : roundArt(r), S.year)}<div class="vn-location"><span>${esc(dedicatedArt ? r.place : p.agenda ? r.place : context?.show ? context.record.from : r.place)}</span><span>${esc(dedicatedArt ? sceneText(sc, r.time) : context?.show ? context.record.stamp : sceneText(sc, r.time))}</span></div></div>
      <div class="vn-body">
      ${session.round === 0 ? `<div class="vn-opening"><p>${esc(p.arrival)}</p>${!p.agenda && NOVEL_SCENE_MOMENTS[S.curId] ? `<p>${esc(NOVEL_SCENE_MOMENTS[S.curId][0])}</p>` : ''}</div>` : ''}
      ${previous ? `<div class="vn-echo"><span>你刚才的回应</span><p>“${esc(previous.text)}”</p></div>` : ''}
      ${session.previousDiscussion?.length ? '<p class="vn-carry-note">此前的会谈记录已归档。请对这项议题作最后批示。</p>' : ''}
      <p class="vn-aside">${esc(r.aside)}${reaction ? " " + esc(reaction) : ""}</p>
      <section class="vn-dialogue" aria-label="${esc(actor.name)}的对话">${portrait(actor.key)}<div><div class="vn-speaker">${esc(actor.name)}<small>${esc(actor.role)}</small></div><p class="vn-line">“${esc(text)}”</p></div></section>
      ${p.agenda ? `<div class="vn-policy-cost"><span>本次投入</span><b>${Object.entries(p.cost).map(([k,v]) => `${esc(META[k].n)} ${v}`).join(' · ')}</b><small>批准后执行并结算，暂缓不拨付资源。</small></div>` : ''}
      <div class="prompt">${esc(leader().name)} · ${p.agenda ? '你的批示' : '你的回应'}</div><div class="vn-options">${enabled
        .filter((o) => o.enabled)
        .map(
          (o) =>
            `<button class="opt vn-choice" data-i="${o.id}"><span class="key">${esc(o.key)}</span><span>${esc(p.voices[o.id][session.round])}</span></button>`,
        )
        .join("")}</div>
      ${locked.length ? `<details class="vn-unavailable"><summary>其他尚未具备条件的意见</summary>${locked.map((o) => `<p><strong>${esc(o.label)}</strong><br>${esc(o.lock)}</p>`).join("")}</details>` : ""}
      </div></div>`;
    const renderRound = session.round;
    stage
      .querySelectorAll(".vn-choice")
      .forEach((b) =>
        b.addEventListener("click", () =>
          respond(Number(b.dataset.i), renderRound),
        ),
      );
    document.getElementById("vn-log").addEventListener("click", openLog);
    saveGame();
    if (session.round > 0)
      document
        .querySelector(context?.show ? "#stage .world-source" : ".vn-aside")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
    else scrollToStart();
  }
  function respond(option, expectedRound) {
    const session = S._novel,
      p = profile();
    if (
      !p ||
      !validSession(session, S.curId) ||
      session.round !== expectedRound ||
      ENDED ||
      S._pendingResult
    )
      return false;
    if (!candidates().some((o) => o.id === option && o.enabled && !o.hidden))
      return false;
    const r = p.rounds[session.round],
      actor = speaker(r.actor);
    session.answers.push({
      round: session.round,
      option,
      text: p.voices[option][session.round],
      speaker: actor.name,
      actor: actor.key,
      prompt: sceneText(SCENES[S.curId], r.line).replaceAll(
        "{address}",
        address(),
      ),
      place: r.place,
      time: r.time,
      leader: leader().name,
    });
    session.round++;
    if (session.round < p.rounds.length) {
      saveGame();
      renderActive();
      return true;
    }
    settle(session, p);
    return true;
  }
  function settle(session, p) {
    const tallyResult = tally(session.answers, candidates(session)),
      selected = tallyResult.winner;
    if (selected === undefined) return;
    const sc = SCENES[session.sceneId],
      d = DECISIONS.find((d) => d.id === session.decisionId);
    const choice = session.kind === "event" ? sc.options[selected] : null;
    const title = choice ? sceneText(sc, sc.title) : d.name;
    const policy = choice
      ? choice.label
      : selected === 0
        ? d.name
        : "维持现状，暂不推进" + d.name;
    const record = {
      sceneId: session.sceneId,
      kind: session.kind,
      title,
      policy,
      answers: session.answers.map((a) => ({ ...a })),
      previousDiscussion: (session.previousDiscussion || []).map(a => ({...a})),
      scores: tallyResult.scores.map((row) => ({
        ...row,
        label:
          session.kind === "event"
            ? sc.options[row.id].label
            : row.id === 0
              ? "推进议题"
              : "维持现状",
      })),
      tied: tallyResult.tied,
    };
    delete S._novel;
    S._novelResolution = record;
    (S._novelHistory ??= []).push(record);
    S._novelHistory = S._novelHistory.slice(-120);
    S._novelMemory ??= {};
    for (const a of record.answers)
      S._novelMemory[a.actor] = {
        sceneId: session.sceneId,
        title,
        text: a.text,
      };
    if (choice) {
      if (session.sceneId === "5-1") S._novelLeader = choice.flags.route;
      choose(sc, choice);
      const pending = S._pendingResult;
      record.consequence = pending?.battles?.length
        ? "实际战果：" + pending.battles.map((b) => b.tier).join("、") + "。"
        : pending?.deltas?.length
          ? "资源与政治后果已经结算，执行机关开始按此安排工作。"
          : "这项安排已经进入执行。";
      saveGame();
    } else {
      const result = selected === 0 ? executeDecision(d) : null;
      record.approved = selected === 0 && !!result;
      record.resultDeltas = result || [];
      record.consequence = selected === 0
        ? result ? p.approved : "执行条件已经改变，文件暂未发出，资源没有拨付。"
        : p.deferred;
      if (record.approved && d.id === 'fort-molotov') {
        record.consequence += ` 当前已完成${S['_c_fort-molotov'] || 0}／3期。`;
      }
      if (selected === 0 && !result)
        record.policy = "条件变化，本次未执行" + d.name;
      renderDecisions(sc);
      saveGame();
    }
  }
  function startDecision(d) {
    if (
      ENDED ||
      !d ||
      !DECISIONS.includes(d) ||
      !NOVEL_DECISIONS[d.id] ||
      !SCENES[S.curId]?.decisions ||
      S._novel ||
      (d.when && !d.when(S)) ||
      (d.act && !d.act.includes(S.act)) ||
      (d.max !== undefined && (S["_c_" + d.id] || 0) >= d.max) ||
      !Object.entries(decisionCost(d)).every(([k, v]) => S[k] >= v)
    )
      return false;
    S._novel = {
      v: 1,
      kind: "decision",
      sceneId: S.curId,
      decisionId: d.id,
      agendaVersion: 2,
      round: 0,
      answers: [],
    };
    renderActive();
    return true;
  }
  function resolutionHTML() {
    const r = S._novelResolution;
    if (!r || r.sceneId !== S.curId) return "";
    return `<details class="vn-resolution"><summary>${r.kind === 'decision' ? '批示记录' : '会谈记录'} · ${r.answers.length} 次回应</summary><p>${r.kind === 'decision' ? `本期批示：${esc(r.policy)}。` : `累计倾向自动形成：${esc(r.policy)}。${r.tied ? "最高次数相同，采用其中最近一次明确表态。" : "采用累计次数最多的倾向。"}`}</p><div class="vn-tally">${r.scores
      .filter((s) => s.votes)
      .map((s) => `<span>${esc(s.label)} · ${s.votes} 次</span>`)
      .join(
        "",
      )}</div><ol>${r.answers.map((a) => `<li><span>${esc(a.speaker)} · ${esc(a.time)}</span><p>${esc(a.leader)}：“${esc(a.text)}”</p></li>`).join("")}</ol></details>`;
  }
  function decisionOutcomeHTML() {
    const r = S._novelResolution;
    if (r?.kind !== "decision" || r.sceneId !== S.curId) return "";
    const approved = r.approved ?? !/^(维持现状|条件变化)/.test(r.policy);
    const deltas = r.resultDeltas ?? (S._lastDecision?.sceneId === S.curId && S._lastDecision.name === r.policy ? S._lastDecision.deltas : []);
    const ledger = approved ? effectsHTML(deltas) : '<span>未拨付资源</span>';
    return `<section class="vn-decision-outcome" role="status"><div class="eyebrow">${approved ? '批示已记录' : '本期暂缓'}</div><h2>${esc(r.policy)}</h2><p>${esc(r.consequence || '')}</p><div class="deltas">${ledger}</div>${resolutionHTML()}</section>`;
  }
  function aftermathHTML(sc) {
    const moment = NOVEL_SCENE_MOMENTS[S.curId];
    const r = S._novelResolution;
    if (!moment || r?.kind !== 'event' || r.sceneId !== S.curId) return '';
    const last = r.answers.at(-1);
    return `<section class="vn-aftermath"><div class="eyebrow">会谈之后</div>${last ? `<blockquote><span>${esc(last.leader)}的最后回应</span><p>“${esc(last.text)}”</p></blockquote>` : ''}<p>${esc(moment[1])}</p></section>`;
  }
  function connectScene(sc) {
    const root = document.querySelector("#stage > .fade"),
      heading = root?.querySelector("h1");
    if (heading) heading.insertAdjacentHTML("afterend", seatHTML());
    saveGame();
  }
  function openLog() {
    const dialog = document.getElementById("novel-log");
    const history = [...(S._novelHistory || [])];
    if (S._novel?.answers.length)
      history.push({
        title: "当前谈话",
        policy: "尚未形成最终决定",
        answers: S._novel.answers,
      });
    document.getElementById("novel-log-content").innerHTML =
      (typeof WarReports!=='undefined' ? WarReports.archiveHTML() : '') +
      World.archiveHTML() +
      (history.length
        ? history
            .map(
              (h) =>
                `<section><h3>${esc(h.title)}</h3><p class="hint">${esc(h.policy)}</p>${[...(h.previousDiscussion || []), ...h.answers].map((a) => `<div class="vn-log-line"><small>${esc(a.place)} · ${esc(a.time)}</small><p><strong>${esc(a.speaker)}</strong>：${esc(a.prompt)}</p><p><strong>${esc(a.leader)}</strong>：${esc(a.text)}</p></div>`).join("")}</section>`,
            )
            .join("")
        : "<p>案头还没有留下会谈记录。</p>");
    dialog.showModal();
  }
  return {
    handles,
    leader,
    profile,
    candidates,
    tally,
    validSession,
    renderEvent,
    renderActive,
    respond,
    startDecision,
    resolutionHTML,
    decisionOutcomeHTML,
    aftermathHTML,
    connectScene,
    openLog,
    seatHTML,
  };
})();
