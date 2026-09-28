// A viewport scene: the companions visit visible cards and track scrolling.
(() => {
  const art = {
    grim: {idle: "characters/grim-companion.webp", walk: "characters/grim-walk.webp", walkB: "characters/grim-walk-b.webp", inspect: "characters/grim-inspect.webp"},
    noxel: {idle: "characters/noxel-companion.webp", walk: "characters/noxel-scuttle.webp", walkB: "characters/noxel-scuttle-b.webp", inspect: "characters/noxel-peek.webp"}
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const actors = {};
  let area, stage, active = false, generation = 0, visitTimer, resizeTimer, scrollTimer, currentTarget, initialized = false;
  const points = {grim: null, noxel: null};
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const safeSpace = () => ({
    top: Math.max(8, (document.querySelector('.topbar')?.getBoundingClientRect().bottom || 0) + 8),
    bottom: Math.min(innerHeight - 8, (document.querySelector('.bottomNav')?.getBoundingClientRect().top || innerHeight) - 8)
  });

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
      clearTimeout(actors[name].delay);
      if (actors[name].motion) {
        const rect = actors[name].button.getBoundingClientRect();
        actors[name].motion.onfinish = actors[name].motion.oncancel = null;
        actors[name].motion.cancel();
        place(name, {x: rect.left, y: rect.top});
      }
      actors[name].motion = null;
      actors[name].button.style.opacity = "";
      actors[name].settle?.();
      actors[name].settle = null;
    }
    currentTarget?.classList.remove("pm-companion-spotlight");
  }

  function targets() {
    if (area.id === "homeView") {
      return [...area.querySelectorAll('.pm-home-hero, .findHero, #homeSeries .pm-cream-card, #recentCoins .coinCard')];
    }
    if (area.id === "findView") return [...area.querySelectorAll('#catalogueList .coinCard')];
    if (area.id === "collectionView") return [...area.querySelectorAll('#myMintList .coinCard')];
    if (area.id === "myMintView") return [...area.querySelectorAll('.menuCard')];
    return [];
  }

  function visibleTargets() {
    const safe = safeSpace();
    const visible = targets().filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > safe.top + 24 && rect.top < safe.bottom - 24;
    });
    return visible;
  }

  function atCard(element, name) {
    const rect = element.getBoundingClientRect();
    const actor = actors[name].button;
    const safe = safeSpace();
    const bottom = Math.max(safe.top, safe.bottom - actor.offsetHeight);
    const above = rect.top - actor.offsetHeight * .78;
    const below = rect.bottom - actor.offsetHeight * .2;
    const coinLanding = element.matches('.coinCard') ? rect.top + 12 : null;
    const onLeft = element.classList.contains('findHero');
    const edge = onLeft
      ? rect.left + (name === 'grim' ? 8 : actors.grim.button.offsetWidth + 14)
      : rect.right - actor.offsetWidth - (name === 'grim' ? actors.noxel.button.offsetWidth + 14 : 8);
    return {
      x: clamp(edge, 4, Math.max(4, innerWidth - actor.offsetWidth - 4)),
      y: clamp((coinLanding ?? (above >= safe.top ? above : below <= bottom ? below : rect.top - actor.offsetHeight * .4)) + (name === 'noxel' ? 5 : 0), safe.top, bottom)
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
    if (reduced.matches) { place(name, destination); pose(name, "idle"); return Promise.resolve(); }
    return new Promise(resolve => {
      actor.settle = resolve;
      const begin = () => {
        if (!active || run !== generation) return resolve();
        const start = points[name] || destination;
        const dx = destination.x - start.x, dy = destination.y - start.y;
        if (!actor.button.animate) { place(name, destination); actor.button.style.opacity = ""; pose(name, "inspect"); return resolve(); }
        const finish = motion => {
          clearInterval(actor.frames);
          if (actor.motion === motion) actor.motion = null;
          motion.onfinish = motion.oncancel = null;
          motion.cancel();
          actor.button.style.opacity = "";
          if (run === generation) { place(name, destination); pose(name, "inspect"); }
          if (actor.settle === resolve) actor.settle = null;
          resolve();
        };
        const enter = () => {
          if (!active || run !== generation) return resolve();
          place(name, destination);
          pose(name, "inspect");
          const motion = actor.button.animate([
            {opacity:0, transform:"translateY(24px) scale(.67)"},
            {opacity:1, transform:"translateY(-5px) scale(1.08)", offset:.72},
            {opacity:1, transform:"translateY(0) scale(1)"}
          ], {duration:name === "noxel" ? 420 : 520, easing:"ease-out", fill:"forwards"});
          actor.motion = motion;
          motion.onfinish = () => finish(motion);
          motion.oncancel = resolve;
        };
        if (!points[name] || Math.hypot(dx, dy) > 195) {
          if (!points[name]) return enter();
          const motion = actor.button.animate([
            {opacity:1, transform:"translateY(0) scale(1)"},
            {opacity:0, transform:"translateY(13px) scale(.76)"}
          ], {duration:180, easing:"ease-in", fill:"forwards"});
          actor.motion = motion;
          motion.onfinish = () => { motion.oncancel = null; motion.cancel(); actor.motion = null; enter(); };
          motion.oncancel = resolve;
          return;
        }
        pose(name, "walk");
        let alternate = false;
        actor.frames = setInterval(() => { alternate = !alternate; pose(name, alternate ? "walkB" : "walk"); }, name === "noxel" ? 155 : 210);
        const motion = actor.button.animate([
          {transform:"translate(0,0)"},
          {transform:`translate(${dx * .28}px,${dy * .28 - 5}px)`,offset:.28},
          {transform:`translate(${dx * .67}px,${dy * .67 - 8}px)`,offset:.67},
          {transform:`translate(${dx}px,${dy}px)`}
        ], {duration:clamp(Math.hypot(dx, dy) * 5.5, 650, 1350), easing:"ease-in-out", fill:"forwards"});
        actor.motion = motion;
        motion.onfinish = () => finish(motion);
        motion.oncancel = resolve;
      };
      if (delay) actor.delay = setTimeout(begin, delay); else begin();
    });
  }

  async function visit(target, reposition = false) {
    if (!active || !target || !visibleTargets().includes(target)) return;
    if (target === currentTarget && !reposition) return;
    cancelMotion();
    const run = generation;
    currentTarget = target;
    for (const name of ["grim", "noxel"]) {
      if (reposition) actors[name].button.style.opacity = "";
      else if (!points[name] && !reduced.matches && actors[name].button.animate) actors[name].button.style.opacity = "0";
    }
    const noxel = atCard(target, "noxel"), grim = atCard(target, "grim");
    if (reposition) { place("noxel", noxel); place("grim", grim); }
    else await Promise.all([move("noxel", noxel, 0, run), move("grim", grim, 140, run)]);
    if (!active || run !== generation) return;
    pose("noxel", "inspect");
    pose("grim", "inspect");
    if (target.matches(".coinCard, .pm-cream-card, .findHero, .menuCard")) target.classList.add("pm-companion-spotlight");
    visitTimer = setTimeout(() => {
      const options = visibleTargets();
      const next = options.length ? options[(Math.max(-1, options.indexOf(target)) + 1) % options.length] : null;
      if (options.length > 1 && next) visit(next);
      else pose("noxel", "idle");
    }, 4300);
  }

  function ask(name, target) {
    if (!active || !target) return;
    if (target !== currentTarget) return visit(target);
    if (reduced.matches || actors[name].motion) return;
    actors[name].button.animate([
      {transform: "translateY(0) scale(1)"},
      {transform: "translateY(-9px) scale(1.1)", offset: .5},
      {transform: "translateY(0) scale(1)"}
    ], {duration: 430, easing: "ease-out"});
    pose(name, "inspect");
  }

  function start() {
    if (!initialized || active || document.hidden || !area?.classList.contains("active")) return;
    if (area.id === "findView" && area.querySelector('[data-find-panel="catalogue"]').hidden) return;
    const first = visibleTargets()[0];
    if (!first) return;
    active = true;
    stage.hidden = false;
    currentTarget = null;
    points.grim = points.noxel = null;
    visit(first);
  }

  function stop() {
    active = false;
    cancelMotion();
    currentTarget = null;
    if (stage) stage.hidden = true;
  }

  function refresh() {
    if (!initialized || !active) return;
    requestAnimationFrame(() => {
      if (!active) return;
      const options = visibleTargets();
      if (!options.length) { stop(); return; }
      if (currentTarget && options.includes(currentTarget)) visit(currentTarget, true);
      else visit(options[0]);
    });
  }

  function init() {
    if (initialized) return;
    const selected = document.querySelector('.view.active');
    area = selected && ["homeView", "findView", "collectionView", "myMintView"].includes(selected.id)
      ? selected : document.getElementById("homeView");
    stage = document.getElementById("homeCompanions");
    if (!area || !stage) return;
    document.body.append(stage);
    stage.classList.add("pm-roaming-companions");
    for (const name of ["grim", "noxel"]) {
      const button = document.getElementById(name === "grim" ? "companionGrim" : "companionNoxel");
      actors[name] = {button, image: button.querySelector("img"), motion: null, frames: null, delay: null, settle: null};
      Object.values(art[name]).forEach(source => { const preload = new Image(); preload.src = source; });
    }
    actors.noxel.button.addEventListener("click", () => {
      const options = visibleTargets();
      const find = area.id === "homeView" ? area.querySelector(".findHero") : null;
      ask("noxel", options.includes(find) ? find : options.at(-1));
    });
    actors.grim.button.addEventListener("click", () => {
      const options = visibleTargets();
      const recent = area.id === "homeView" ? area.querySelector("#recentCoins .coinCard") : null;
      ask("grim", options.includes(recent) ? recent : options[0]);
    });
    document.addEventListener("pointerover", event => {
      if (!active || event.pointerType === "touch") return;
      const target = event.target.closest(".coinCard, .pm-home-hero, .findHero, .menuCard");
      if (target && target !== currentTarget && visibleTargets().includes(target)) visit(target);
    });
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
    addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { refresh(); if (!active) start(); }, 130); });
    addEventListener("scroll", () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(() => { refresh(); if (!active) start(); }, 90); }, {passive:true});
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
      points.grim = points.noxel = null;
      start();
    },
    setFindTab(tab) { if (area?.id !== "findView") return; if (tab === "catalogue") start(); else stop(); },
    celebrate() { if (active && !reduced.matches) visit(visibleTargets()[0]); }
  };
})();
