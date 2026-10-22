/* Presentation layer: keeps narrative, decisions and saves in the game engine. */
function requestNewGame() {
  if (hasSave()) {
    document.getElementById("restart-dialog").showModal();
    return;
  }
  startNewJourney();
}
function startNewJourney() {
  clearSave();
  fresh();
  menuMode(false);
  renderHUD();
  advance();
}
function enhanceStage() {
  const root = document.querySelector("#stage > .fade");
  if (!root) return;
  const artwork = root.querySelector(":scope > .scene-art");
  if (
    artwork &&
    !root.classList.contains("ending") &&
    !root.classList.contains("play-layout")
  ) {
    const rail = document.createElement("aside");
    rail.className = "visual-rail";
    const copy = document.createElement("article");
    copy.className = "scene-copy";
    const nodes = Array.from(root.childNodes);
    rail.append(artwork);
    const idx = Math.max(0, FLOW.indexOf(S.curId));
    const label = ACT_LINE[S.act] || ACT_LINE[0];
    const note = document.createElement("div");
    note.className = "rail-note";
    note.innerHTML = `<div class="rail-label">THE CHRONICLE <span>${String(idx + 1).padStart(2, "0")} / ${FLOW.length}</span></div><h2>${label}</h2><div class="chapter-track" aria-label="当前第${S.act}幕">${ACT_LINE.map((a, n) => `<span class="${n === S.act ? "current" : n < S.act ? "complete" : ""}" title="${a}">${n === 0 ? "序" : String(n).padStart(2, "0")}</span>`).join("")}</div><p>每一个选择，都是历史的一部分。</p>`;
    rail.append(note);
    nodes.forEach((n) => {
      if (n !== artwork) copy.append(n);
    });
    root.classList.add("play-layout");
    // Keep the article heading, byline and image in reading order.
    const lead = [];
    while (copy.firstElementChild && copy.firstElementChild.matches('.tag, h1, .vn-seat, .sub')) {
      lead.push(copy.firstElementChild);
      copy.firstElementChild.remove();
    }
    root.append(...lead, rail, copy);
  }
  const heading = root.querySelector("h1") || root.querySelector("h2");
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
  document.getElementById("save-status").textContent =
    !document.body.classList.contains("is-menu") && !ENDED
      ? "进度自动保存"
      : "";
  const home = root.classList.contains('title-screen');
  const gallery=root.classList.contains('gallery')||root.classList.contains('ending-detail');
  document.getElementById('nav-home')?.setAttribute('aria-current',home?'page':'false');
  document.getElementById('nav-start')?.setAttribute('aria-current',gallery?'false':'page');
  document.getElementById('nav-gallery')?.setAttribute('aria-current',gallery?'page':'false');
  const position=document.getElementById('sidebar-position');
  if(position)position.textContent=home?'国家意志 · 1936—1956':gallery?'你的历史档案':`${S.year} · ${(ACT_LINE[S.act]||ACT_LINE[0]).split(' · ')[0]}`;
}
const statGuide = {
  PP: "用于执行国家决议的政治资本。",
  PAR: "偏执越高，清洗风险越大。此项越低越好。",
  IND: "工业支撑长期发展与战争动员。",
  ARMY: "红军战力影响每场战役的结果。",
  MOR: "民心影响战役韧性与国家稳定。",
  COM: "国际阵营影响力，影响战后道路。",
};
document.addEventListener("DOMContentLoaded", () => {
  const icons={
    'nav-start':'<path d="m9 5 10 7-10 7V5Z"/>',
    'nav-dialogue':'<path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 9h8M8 13h5"/>',
    'nav-statistics':'<path d="M4 4v16h16M8 15l4-6 4 3 4-7"/>',
    'nav-gallery':'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m4 15 5-5 6 7 3-3 2 2"/><circle cx="15.5" cy="8.5" r="1"/>',
    'nav-help':'<circle cx="12" cy="12" r="8"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16v.1"/>',
  };
  for(const[id,paths]of Object.entries(icons)){
    const button=document.getElementById(id),label=button.textContent;
    button.innerHTML=`<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg><span>${label}</span>`;
  }
  document.getElementById("nav-home").addEventListener("click", renderTitle);
  document.getElementById("nav-start").addEventListener("click", renderTitle);
  document
    .getElementById("nav-dialogue")
    .addEventListener("click", Novel.openLog);
  document
    .getElementById("nav-gallery")
    .addEventListener("click", renderGallery);
  document
    .getElementById("nav-help")
    .addEventListener("click", () =>
      document.getElementById("help-dialog").showModal(),
    );
  document.getElementById("restart-confirm").addEventListener("click", () => {
    document.getElementById("restart-dialog").close();
    startNewJourney();
  });
  document
    .getElementById("restart-cancel")
    .addEventListener("click", () =>
      document.getElementById("restart-dialog").close(),
    );
  document.querySelectorAll("dialog:not(#annual-dialog)").forEach((d) =>
    d.addEventListener("click", (e) => {
      if (e.target === d) {
        const r = d.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          d.close();
      }
    }),
  );
  new MutationObserver(enhanceStage).observe(document.getElementById("stage"), {
    childList: true,
  });
  new MutationObserver(() => {
    Object.entries(statGuide).forEach(([k, v]) => {
      const el = document.getElementById("st-" + k);
      if (el) {
        el.title = v;
        el.setAttribute("aria-label", META[k].n + " " + S[k] + "。" + v);
      }
    });
  }).observe(document.getElementById("hud-stats"), {
    childList: true,
    subtree: true,
  });
  enhanceStage();
});
