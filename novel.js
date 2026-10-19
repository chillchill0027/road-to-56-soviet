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
    return `<div class="vn-seat">${portrait(l.key, "vn-seat-portrait")}<span><small>你的位置 · 国家意志贯穿始终</small><strong>${esc(l.name)}</strong><span>${esc(l.role)}</span></span></div>`;
  }
  function profile(session = S._novel) {
    if (!session) return null;
    if (session.kind === "event") return NOVEL_EVENTS[session.sceneId];
    const d = DECISIONS.find((d) => d.id === session.decisionId),
      spec = NOVEL_DECISIONS[session.decisionId];
    if (!d || !spec) return null;
    const [actor, count, pace, line, yes, no] = spec;
    const cost = Object.entries(decisionCost(d))
      .map(([k, v]) => `${META[k].n}${v}`)
      .join("、");
    const scenes = [
      ["工作汇报", "议题提出", line, yes, no],
      [
        "预算会商",
        "资源核算",
        `这次需要${cost}。资源一旦拨出，其他项目就要后退。`,
        "为这件事预留资源。",
        "先把资源留给其他项目。",
      ],
      [
        "执行机关",
        "实施准备",
        `关于“${d.name}”，执行机关需要确定的工作范围，而不是一句口号。`,
        "让执行机关开始准备。",
        "保持现有工作安排。",
      ],
      [
        "会后走廊",
        "责任与代价",
        `${spec[3]} 发生后果时，地方会把它理解为最高层的态度。`,
        "我承担推动它的责任。",
        "此时不扩大最高层的承诺。",
      ],
      [
        "办公厅",
        "本期安排",
        `这项工作的承诺，需要在下一份计划里兑现。您准备维持投入吗？`,
        "把这项工作保留在投入序列里。",
        "不为它保留追加投入。",
      ],
      [
        "筹备部门",
        "持续性复核",
        `“${d.name}”不能只靠第一次动员。后续人员和资源也要有着落。`,
        "让团队按持续投入作准备。",
        "先不锁定后续安排。",
      ],
      [
        "办公厅",
        "授权定稿",
        `综合此前的表态，我们应当推进“${d.name}”，还是维持原来的安排？`,
        "把推进写入本期工作安排。",
        "让现行安排继续。",
      ],
    ];
    // Short processes use proposal, cost, mandate. Longer ones include implementation review.
    const pick =
      count === 3
        ? [0, 1, 6]
        : count === 5
          ? [0, 1, 2, 3, 6]
          : [0, 1, 2, 3, 4, 5, 6];
    return {
      pace,
      reason: `${pace}：议题、成本、执行条件与授权依次形成。`,
      arrival: `${d.name}的文件被单独抽出来。${d.note}。`,
      rounds: pick.map((n) => ({
        actor,
        place: scenes[n][0],
        time: scenes[n][1],
        aside: n
          ? "门外的人仍在等待这一期的安排。"
          : "汇报人先讲了方案最难承担的部分。",
        line: scenes[n][2],
      })),
      voices: [pick.map((n) => scenes[n][3]), pick.map((n) => scenes[n][4])],
    };
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
  function bridgeHTML(arrival) {
    const previous = (S._novelHistory || []).at(-1);
    return `${S._novel?.round === 0 ? `<p class="vn-opening">${esc(arrival)}</p>` : ""}<details class="vn-bridge"><summary>前情与此刻</summary>${previous ? `<p>上一次，你在“${esc(previous.title)}”中形成了“${esc(previous.policy)}”的安排。${esc(previous.consequence || "这项安排已经交给执行机关。")}</p>` : ""}<p>${esc(arrival)}</p></details>`;
  }
  function roundArt(r) {
    if (/工厂|厂区/.test(r.place)) return "steel";
    if (/居民|住房|工棚/.test(r.place)) return "housing";
    if (/实验室|物理研究/.test(r.place)) return "lab";
    if (/训练|演习/.test(r.place)) return "formation";
    if (/总参谋部|作战室|作战图/.test(r.place)) return "map-arrows";
    if (/谈判|会谈/.test(r.place)) return "summit-table";
    if (/档案|调查/.test(r.place)) return "archive";
    if (r.place === "书房" && leader().key !== "stalin") return "desk";
    return ART[S.curId];
  }
  function renderActive() {
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
    const previous = session.answers.at(-1),
      memory = S._novelMemory?.[actor.key];
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
    const entry =
      session.kind === "event" && S._entryDeltas?.length
        ? `<details class="vn-entry"><summary>已发生的阶段结算</summary><div class="deltas">${effectsHTML(S._entryDeltas)}</div></details>`
        : "";
    const stage = document.getElementById("stage");
    stage.innerHTML = `<div class="fade novel-layout">
      <div class="vn-heading"><div><div class="tag">${esc(sc.chapter)} · ${esc(S.year)} · ${esc(p.pace)}</div><h1 class="scene">${esc(title)}</h1></div>${seatHTML()}</div>
      <div class="vn-film">${artHTML(roundArt(r), S.year)}<div class="vn-location"><span>${esc(r.place)}</span><span>${esc(sceneText(sc, r.time))}</span></div></div>
      <div class="vn-progress" aria-label="对话进度，第${session.round + 1}轮，共${p.rounds.length}轮"><span>第 ${session.round + 1} / ${p.rounds.length} 轮</span><div>${p.rounds.map((_, n) => `<span class="${n < session.round ? "done" : n === session.round ? "now" : ""}"></span>`).join("")}</div><button class="nav-button" id="vn-log">对话记录</button></div>
      <div class="vn-body">${bridgeHTML(p.arrival)}${entry}
      <p class="vn-aside">${esc(r.aside)}${reaction ? " " + esc(reaction) : ""}</p>
      <section class="vn-dialogue" aria-label="${esc(actor.name)}的对话">${portrait(actor.key)}<div><div class="vn-speaker">${esc(actor.name)}<small>${esc(actor.role)}</small></div><p class="vn-line">“${esc(text)}”</p></div></section>
      ${memory && memory.sceneId !== S.curId ? `<details class="vn-memory"><summary>对方还记得上次的谈话</summary><p>在“${esc(memory.title)}”中，你曾说：“${esc(memory.text)}”</p></details>` : ""}
      ${previous ? `<p class="vn-previous">你刚才说：“${esc(previous.text)}”</p>` : ""}
      <div class="prompt">${esc(leader().name)} · 你的回应</div><div class="vn-options">${enabled
        .filter((o) => o.enabled)
        .map(
          (o) =>
            `<button class="opt vn-choice" data-i="${o.id}"><span class="key">${esc(o.key)}</span><span>${esc(p.voices[o.id][session.round])}</span></button>`,
        )
        .join("")}</div>
      ${locked.length ? `<details class="vn-unavailable"><summary>暂时无法作出的承诺 · ${locked.length}</summary>${locked.map((o) => `<p><strong>${esc(o.label)}</strong><br>${esc(o.lock)}</p>`).join("")}</details>` : ""}
      <p class="vn-rule">回应将累计形成政策，本轮不扣除国家资源。${session.round === p.rounds.length - 1 ? "这轮之后将自动归纳并结算。" : "你可以在接下来的交谈中改变立场。"}</p>
      <details class="vn-process"><summary>这项决定为什么需要 ${p.rounds.length} 轮？</summary><p>${esc(p.reason)}轮数是历史情境的叙事压缩，不代表史实中的会议次数。各倾向按表态次数累计；最高次数相同时，以其中最近一次明确表态为准。</p></details>
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
        .querySelector(".vn-aside")
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
      record.consequence =
        selected === 0 && result
          ? "投入已经结算。"
          : "资源未拨出，现行安排继续。";
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
      round: 0,
      answers: [],
    };
    renderActive();
    return true;
  }
  function resolutionHTML() {
    const r = S._novelResolution;
    if (!r || r.sceneId !== S.curId) return "";
    return `<details class="vn-resolution"><summary>这项决定怎样形成 · ${r.answers.length} 轮表态</summary><p>累计倾向自动形成：${esc(r.policy)}。${r.tied ? "最高次数相同，采用其中最近一次明确表态。" : "采用累计次数最多的倾向。"}</p><div class="vn-tally">${r.scores
      .filter((s) => s.votes)
      .map((s) => `<span>${esc(s.label)} · ${s.votes} 次</span>`)
      .join(
        "",
      )}</div><ol>${r.answers.map((a) => `<li><span>${esc(a.speaker)} · ${esc(a.time)}</span><p>${esc(a.leader)}：“${esc(a.text)}”</p></li>`).join("")}</ol></details>`;
  }
  function decisionOutcomeHTML() {
    const r = S._novelResolution;
    return r?.kind === "decision" && r.sceneId === S.curId
      ? `<div class="vn-decision-outcome"><p>${esc(r.policy)}</p>${resolutionHTML()}</div>`
      : "";
  }
  function connectScene(sc) {
    if (S.curId === "5-0" && S.deathMode) {
      S._novelLeader = "vacant";
      hudAct();
    }
    const root = document.querySelector("#stage > .fade");
    if (!root) return;
    const heading = root.querySelector("h1");
    if (heading) heading.insertAdjacentHTML("afterend", seatHTML());
    const bridge =
      {
        "p0-intro":
          "你是约瑟夫·斯大林，也承载着国家的意志。眼前的每个人都有自己的记忆与目的。你的回应会逐轮积累，形成真正下达的政策。",
        "a1-intro":
          "政治局散会之后，干部带着新的口径返回各地。报表仍会按时到达，报表之外的人也会再次来到门前。",
        "a1-end":
          "一份任命改变了机关里谁敢开口，一份预算改变了谁必须等待。夜里，白天没有说完的话开始变成私人来信。",
        "a2-intro":
          "国内的安排还没有显出全部后果，欧洲已经开始按另一种速度运转。外交官等待的答复，很快会变成边境上的时间。",
        "a2-end":
          "过去的会议纪要被收入柜中。新的地图挂上墙，铁路上的每一班列车都开始带着战争的意味。",
        "a3-intro":
          "电话取代了会议。你仍然是下令的人，但从此无法等所有报告互相吻合之后才回答。",
        "a3-end":
          "秘书把伤亡、工业损失与战线位置逐项念出。这里没有新的政策可选；战争结果来自此前所有已经执行的决定。",
        "a4-intro":
          "战时的承诺开始有人要求兑现。军队问重建怎样安排，工人问什么时候能回家，邻国问和平究竟意味着什么。",
        "a4-end":
          "晚年的会谈越来越短。人们在离开书房之后，开始互相猜测下一份文件上的签名。",
        "a5-intro":
          "领导人的生命有终点，国家的记忆却会继续。门外的人逐渐改变了说话的方式。",
        "5-0":
          "斯大林的视角在这里结束。你作为国家意志经历交接；继承争论结束后，将从新的最高领导席位继续看待同一个国家。",
      }[S.curId] ||
      (sc.decisions
        ? "大会议结束了，具体任务还没有自动完成。各部门把需要资源的议题送进办公室，等待一次次单独交谈。"
        : "");
    if (bridge && heading)
      heading.insertAdjacentHTML(
        "afterend",
        `<div class="vn-connecting"><p>${esc(bridge)}</p></div>`,
      );
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
    document.getElementById("novel-log-content").innerHTML = history.length
      ? history
          .map(
            (h) =>
              `<section><h3>${esc(h.title)}</h3><p class="hint">${esc(h.policy)}</p>${h.answers.map((a) => `<div class="vn-log-line"><small>${esc(a.place)} · ${esc(a.time)}</small><p><strong>${esc(a.speaker)}</strong>：${esc(a.prompt)}</p><p><strong>${esc(a.leader)}</strong>：${esc(a.text)}</p></div>`).join("")}</section>`,
          )
          .join("")
      : "<p>开始交谈后，人物的提问与你的回应会保存在这里。</p>";
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
    connectScene,
    openLog,
    seatHTML,
  };
})();
