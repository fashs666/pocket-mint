// A small scene engine for the roaming companions. It reads the real card positions
// and keeps its own state; coin identification and collection writes stay in app.js.
(() => {
  const art = {
    grim: {idle: "characters/grim-companion.webp", walk: "characters/grim-walk.webp", walkB: "characters/grim-walk-b.webp", inspect: "characters/grim-inspect.webp"},
    noxel: {idle: "characters/noxel-companion.webp", walk: "characters/noxel-scuttle.webp", walkB: "characters/noxel-scuttle-b.webp", inspect: "characters/noxel-peek.webp"}
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const actors = {};
  let area, stage, active = false, generation = 0, visitTimer, resizeTimer, currentTarget, initialized = false;
  const points = {grim: null, noxel: null};
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function pose(name, frame) {
    const actor = actors[name];
    const source = art[name][frame];
    if (actor.image.getAttribute("src") !== source) actor.image.src = source;
  }

  function cancelMotion() {
    generation++;
    clearTimeout(visitTimer);
    for (const name of Object.keys(actors)) {
      clearInterval(actors[name].frames);
      actors[name].motion?.cancel();
      actors[name].motion = null;
    }
    currentTarget?.classList.remove("pm-companion-spotlight");
  }

  function targets() {
    if (area.id === "homeView") {
      const recent = document.querySelector("#recentCoins .coinCard");
      return [area.querySelector(".pm-home-hero"), area.querySelector(".findHero"), recent || area.querySelector("#homeSeries .pm-cream-card")].filter(Boolean);
    }
    if (area.id === "findView") return [area.querySelector('[data-find-panel="catalogue"] .findPanelHead'), ...area.querySelectorAll("#catalogueList .coinCard")].slice(0, 4).filter(Boolean);
    if (area.id === "collectionView") return [area.querySelector(".listMeta"), ...area.querySelectorAll("#myMintList .coinCard")].slice(0, 4).filter(Boolean);
    if (area.id === "myMintView") return [...area.querySelectorAll(".menuHeading, .menuCard")].slice(0, 4);
    return [];
  }

  function visibleTargets() {
    return targets().filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 95 && rect.top < innerHeight - 105;
    });
  }

  function atCard(element, name) {
    const bounds = area.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const actor = actors[name].button;
    const onRight = element.classList.contains("pm-home-hero");
    const edge = onRight ? rect.right - bounds.left - actor.offsetWidth * (name === "grim" ? 1.95 : .85)
      : rect.left - bounds.left + (name === "grim" ? 80 : 8);
    return {
      x: clamp(edge, 3, Math.max(3, area.clientWidth - actor.offsetWidth - 3)),
      y: clamp(rect.top - bounds.top - actor.offsetHeight * .72, 0, Math.max(0, area.scrollHeight - actor.offsetHeight))
    };
  }

  function place(name, point) {
    const button = actors[name].button;
    points[name] = point;
    button.style.left = `${point.x}px`;
    button.style.top = `${point.y}px`;
  }

  function move(name, destination, delay, run) {
    const actor = actors[name];
    const start = points[name] || destination;
    if (reduced.matches) { place(name, destination); pose(name, "idle"); return Promise.resolve(); }
    return new Promise(resolve => {
      const begin = () => {
        if (!active || run !== generation) return resolve();
        pose(name, "walk");
        let alternate = false;
        actor.frames = setInterval(() => { alternate = !alternate; pose(name, alternate ? "walkB" : "walk"); }, 180);
        const dx = destination.x - start.x, dy = destination.y - start.y;
        const duration = clamp(Math.hypot(dx, dy) * 5, 700, 2200);
        if (!actor.button.animate) { clearInterval(actor.frames); place(name, destination); pose(name, "idle"); return resolve(); }
        const motion = actor.button.animate([
          {transform:"translate(0,0)"},
          {transform:`translate(${dx * .5}px,${dy * .5 - 8}px)`,offset:.5},
          {transform:`translate(${dx}px,${dy}px)`}
        ], {duration, easing:"ease-in-out", fill:"forwards"});
        actor.motion = motion;
        const finish = completed => {
          clearInterval(actor.frames);
          if (actor.motion === motion) actor.motion = null;
          if (completed && run === generation) { place(name, destination); pose(name, "idle"); }
          resolve();
        };
        motion.onfinish = () => { motion.oncancel = null; motion.cancel(); finish(true); };
        motion.oncancel = () => finish(false);
      };
      if (delay) setTimeout(begin, delay); else begin();
    });
  }

  async function visit(target) {
    if (!active || !target) return;
    cancelMotion();
    const run = generation;
    currentTarget = target;
    const noxel = atCard(target, "noxel"), grim = atCard(target, "grim");
    await Promise.all([move("noxel", noxel, 0, run), move("grim", grim, 260, run)]);
    if (!active || run !== generation) return;
    pose("noxel", "inspect");
    pose("grim", "inspect");
    target.classList.add("pm-companion-spotlight");
    visitTimer = setTimeout(() => {
      target.classList.remove("pm-companion-spotlight");
      const options = visibleTargets();
      const next = options.length ? options[(Math.max(-1, options.indexOf(target)) + 1) % options.length] : null;
      if (next) visit(next);
      else visitTimer = setTimeout(() => visit(visibleTargets()[0] || targets()[0]), 1200);
    }, 3600);
  }

  function start() {
    if (!initialized || active || document.hidden || !area?.classList.contains("active")) return;
    if (area.id === "findView" && area.querySelector('[data-find-panel="catalogue"]').hidden) return;
    active = true;
    stage.hidden = false;
    const first = visibleTargets()[0] || targets()[0];
    if (!first) { active = false; stage.hidden = true; return; }
    if (!points.grim) {
      place("grim", atCard(first, "grim"));
      place("noxel", atCard(first, "noxel"));
    }
    if (reduced.matches) { pose("grim", "idle"); pose("noxel", "idle"); return; }
    visitTimer = setTimeout(() => visit(visibleTargets()[1] || first), 1200);
  }

  function stop() {
    active = false;
    cancelMotion();
    if (stage) stage.hidden = true;
  }

  function refresh() {
    if (!initialized || !active) return;
    requestAnimationFrame(() => {
      if (!active) return;
      const options = visibleTargets();
      if (currentTarget && !options.includes(currentTarget)) visit(options[0] || targets()[0]);
      else if (!currentTarget && options.length) visit(options[0]);
    });
  }

  function init() {
    if (initialized) return;
    const selected = document.querySelector('.view.active');
    area = selected && ["homeView", "findView", "collectionView", "myMintView"].includes(selected.id)
      ? selected : document.getElementById("homeView");
    stage = document.getElementById("homeCompanions");
    if (!area || !stage) return;
    area.append(stage);
    stage.classList.add("pm-roaming-companions");
    for (const name of ["grim", "noxel"]) {
      const button = document.getElementById(name === "grim" ? "companionGrim" : "companionNoxel");
      actors[name] = {button, image: button.querySelector("img"), motion: null, frames: null};
      Object.values(art[name]).forEach(source => { const preload = new Image(); preload.src = source; });
    }
    actors.noxel.button.addEventListener("click", () => visit(area.id === "homeView" ? area.querySelector(".findHero") : visibleTargets().at(-1) || targets()[0]));
    actors.grim.button.addEventListener("click", () => visit(area.id === "homeView" ? area.querySelector("#recentCoins .coinCard") || area.querySelector(".pm-home-hero") : visibleTargets()[0] || targets()[0]));
    document.addEventListener("pointerover", event => {
      if (!active || event.pointerType === "touch") return;
      const target = event.target.closest(".coinCard, .pm-home-hero, .findHero, .menuCard");
      if (target && target !== currentTarget && targets().includes(target)) visit(target);
    });
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
    addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (active) visit(visibleTargets()[0]); }, 150); });
    addEventListener("scroll", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(refresh, 160); }, {passive:true});
    reduced.addEventListener?.("change", () => { stop(); start(); });
    initialized = true;
    start();
  }

  window.PocketMintCompanions = {
    init, refresh,
    setView(view) {
      stop();
      if (!["homeView", "findView", "collectionView", "myMintView"].includes(view)) return;
      area = document.getElementById(view);
      if (!initialized) return;
      area.append(stage);
      points.grim = points.noxel = null;
      start();
    },
    setFindTab(tab) { if (area?.id !== "findView") return; if (tab === "catalogue") start(); else stop(); },
    celebrate() { if (active && !reduced.matches) visit(visibleTargets()[0]); }
  };
})();
