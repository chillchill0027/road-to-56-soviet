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
  document
    .getElementById("nav-home")
    .setAttribute(
      "aria-current",
      document.body.classList.contains("is-menu") ? "page" : "false",
    );
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
  document.getElementById("nav-home").addEventListener("click", renderTitle);
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
