// Independent viewport companions. This module reads cards; it never changes
// collection or identification state.
(() => {
  const art = {
    grim: {idle:"characters/grim-companion.webp", walk:"characters/grim-walk.webp", step:"characters/grim-walk-b.webp", inspect:"characters/grim-inspect.webp"},
    noxel: {idle:"characters/noxel-companion.webp", walk:"characters/noxel-scuttle.webp", step:"characters/noxel-scuttle-b.webp", inspect:"characters/noxel-peek.webp"}
  };
  const supported = new Set(["homeView", "findView", "collectionView", "myMintView"]);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const actors = {};
  let area, stage, spark, active = false, initialized = false;
  let scrollTimer, scrollFrame, resizeTimer, meetTimer, scrolling = false, lastScrollY = scrollY;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const safeSpace = () => ({
    top: Math.max(8, (document.querySelector(".topbar")?.getBoundingClientRect().bottom || 0) + 8),
    bottom: Math.min(innerHeight - 8, (document.querySelector(".bottomNav")?.getBoundingClientRect().top || innerHeight) - 8)
  });

  function targets() {
    if (!area) return [];
    if (area.id === "homeView") return [...area.querySelectorAll(".pm-home-hero, .findHero, #homeSeries .pm-cream-card, #recentCoins .coinCard")];
    if (area.id === "findView") return [...area.querySelectorAll("#catalogueList .coinCard")];
    if (area.id === "collectionView") return [...area.querySelectorAll("#myMintList .coinCard")];
    return [...area.querySelectorAll(".menuCard")];
  }

  function visibleTargets() {
    const safe = safeSpace();
    return targets().filter(element => {
      const rect = element.getBoundingClientRect();
      const exposed = Math.min(rect.bottom, safe.bottom) - Math.max(rect.top, safe.top);
      return rect.width > 0 && rect.height > 0 && exposed > Math.min(85, Math.max(28, rect.height * .22));
    });
  }

  function destination(target, name) {
    const rect = target.getBoundingClientRect();
    const button = actors[name].button;
    const safe = safeSpace();
    const bottom = Math.max(safe.top, safe.bottom - button.offsetHeight);
    const above = rect.top - button.offsetHeight * .78;
    const below = rect.bottom - button.offsetHeight * .2;
    const special = target.matches(".coinCard, .menuCard")
      ? (above >= safe.top ? above : rect.bottom - button.offsetHeight * .42) : null;
    const left = target.classList.contains("findHero");
    const x = left
      ? rect.left + (name === "grim" ? 8 : actors.grim.button.offsetWidth + 14)
      : rect.right - button.offsetWidth - (name === "grim" ? actors.noxel.button.offsetWidth + 14 : 8);
    return {
      x: clamp(x, 4, Math.max(4, innerWidth - button.offsetWidth - 4)),
      y: clamp((special ?? (above >= safe.top ? above : below <= bottom ? below : rect.top - button.offsetHeight * .4)) + (name === "noxel" ? 5 : 0), safe.top, bottom)
    };
  }

  function pose(actor, frame) {
    const src = art[actor.name][frame];
    if (actor.image.getAttribute("src") !== src) actor.image.src = src;
    actor.button.classList.toggle("is-walking", frame === "walk");
    actor.button.classList.toggle("is-inspecting", frame === "inspect");
    if (frame !== "walk") actor.stepImage.classList.remove("is-step");
  }

  function place(actor, point) {
    actor.point = point;
    actor.button.style.left = `${point.x}px`;
    actor.button.style.top = `${point.y}px`;
  }

  function highlight() {
    document.querySelectorAll(".pm-companion-spotlight").forEach(e => e.classList.remove("pm-companion-spotlight"));
    for (const actor of Object.values(actors)) {
      if (!actor.hidden && actor.target?.isConnected && actor.target.matches(".coinCard, .pm-cream-card, .findHero, .menuCard"))
        actor.target.classList.add("pm-companion-spotlight");
    }
  }

  function cancel(actor) {
    actor.run++;
    clearTimeout(actor.timer);
    clearTimeout(actor.idleTimer);
    clearTimeout(actor.pulseTimer);
    actor.pulseTarget?.classList.remove("pm-companion-investigated");
    actor.pulseTarget = null;
    actor.button.classList.remove("is-meeting");
    if (actor.walkFrame) cancelAnimationFrame(actor.walkFrame);
    actor.walkFrame = null;
    actor.walkResolve?.();
    actor.walkResolve = null;
    actor.stepImage.classList.remove("is-step");
    if (actor.motion) {
      const rect = actor.button.getBoundingClientRect();
      actor.motion.onfinish = actor.motion.oncancel = null;
      actor.motion.cancel();
      actor.motion = null;
      place(actor, {x:rect.left, y:rect.top});
    }
    actor.resolve?.();
    actor.resolve = null;
    actor.button.style.opacity = "";
  }

  function animate(actor, frames, options) {
    if (!actor.button.animate || reduced.matches) return Promise.resolve();
    return new Promise(resolve => {
      actor.resolve = resolve;
      const motion = actor.button.animate(frames, {...options, fill:"forwards"});
      actor.motion = motion;
      const done = () => {
        if (actor.motion === motion) actor.motion = null;
        motion.onfinish = motion.oncancel = null;
        motion.cancel();
        if (actor.resolve === resolve) actor.resolve = null;
        resolve();
      };
      motion.onfinish = done;
      motion.oncancel = done;
    });
  }

  function walk(actor, next, run) {
    const from = {...actor.point};
    const distance = Math.hypot(next.x - from.x, next.y - from.y);
    const duration = clamp(distance * (actor.name === "noxel" ? 7 : 8), 650, 2700);
    return new Promise(resolve => {
      actor.walkResolve = resolve;
      const started = performance.now();
      const frame = now => {
        if (run !== actor.run || !active || scrolling) return;
        const elapsed = now - started;
        const t = Math.min(1, elapsed / duration);
        // Position and footfall come from the same clock. This keeps each
        // stride attached to actual travel rather than a stationary wobble.
        const progress = t * t * (3 - 2 * t);
        place(actor, {
          x:from.x + (next.x - from.x) * progress,
          y:from.y + (next.y - from.y) * progress - Math.sin(Math.PI * t) * Math.min(9, distance * .05)
        });
        actor.stepImage.classList.toggle("is-step", Math.floor(elapsed / (actor.name === "noxel" ? 190 : 230)) % 2 === 1);
        if (t < 1) actor.walkFrame = requestAnimationFrame(frame);
        else {
          actor.walkFrame = null;
          actor.walkResolve = null;
          actor.stepImage.classList.remove("is-step");
          resolve();
        }
      };
      actor.walkFrame = requestAnimationFrame(frame);
    });
  }

  function patrolPoint(actor) {
    const anchor = destination(actor.target, actor.name);
    const card = actor.target.getBoundingClientRect();
    const size = actor.button.offsetWidth;
    const roomLeft = Math.max(4, card.left + 8);
    const roomRight = Math.min(innerWidth - size - 4, card.right - size - 8);
    // Stay by the card's edge, alternating a modest walk in either direction.
    const offset = actor.steps % 2 ? -64 : 35;
    return {x:clamp(anchor.x + offset, roomLeft, Math.max(roomLeft, roomRight)), y:anchor.y};
  }

  function schedule(actor) {
    clearTimeout(actor.timer);
    if (!active || scrolling || actor.hidden) return;
    if (reduced.matches) { pose(actor, "idle"); return; }
    idleMoment(actor);
    const interval = actor.name === "noxel" ? 4600 + Math.random() * 1700 : 6800 + Math.random() * 2100;
    actor.timer = setTimeout(() => {
      const options = visibleTargets();
      if (!options.length) { schedule(actor); return; }
      if (!options.includes(actor.target)) {
        actor.target = null;
        visit(actor.name, options[0]);
        return;
      }
      const other = actors[actor.name === "grim" ? "noxel" : "grim"];
      actor.steps++;
      if (options.length === 1 || actor.steps % 3 === 1) {
        visit(actor.name, actor.target, patrolPoint(actor), actor.steps % 5 === 0);
        return;
      }
      // Occasionally choose the other companion's card; most trips stay independent.
      const meet = actor.steps % 4 === 0 && options.includes(other.target) && other.target !== actor.target;
      const choices = options.filter(target => target !== actor.target && (!other.target || target !== other.target));
      const nearby = choices.sort((a, b) => {
        const pa = destination(a, actor.name), pb = destination(b, actor.name);
        return Math.hypot(pa.x - actor.point.x, pa.y - actor.point.y) - Math.hypot(pb.x - actor.point.x, pb.y - actor.point.y);
      });
      const next = meet ? other.target : nearby[0] || options.find(t => t !== actor.target);
      visit(actor.name, next, null, meet && actor.steps % 8 === 0);
    }, interval);
  }

  function idleMoment(actor) {
    clearTimeout(actor.idleTimer);
    if (!active || scrolling || reduced.matches || actor.hidden || actor.motion) return;
    pose(actor, "idle");
    actor.idleTimer = setTimeout(() => {
      if (!active || scrolling || actor.hidden || actor.motion) return;
      pose(actor, "inspect");
      if (actor.target?.isConnected) {
        actor.pulseTarget = actor.target;
        actor.pulseTarget.classList.add("pm-companion-investigated");
        actor.pulseTimer = setTimeout(() => {
          actor.pulseTarget?.classList.remove("pm-companion-investigated");
          actor.pulseTarget = null;
        }, 1100);
      }
      actor.idleTimer = setTimeout(() => idleMoment(actor), 800 + Math.random() * 450);
    }, 1800 + Math.random() * 2000);
  }

  function maybeMeet() {
    clearTimeout(meetTimer);
    if (!active || scrolling || actors.grim.hidden || actors.noxel.hidden || !actors.grim.target ||
        actors.grim.target !== actors.noxel.target || actors.grim.motion || actors.noxel.motion ||
        actors.grim.walkFrame || actors.noxel.walkFrame || reduced.matches) return;
    meetTimer = setTimeout(() => {
      if (!active || scrolling || actors.grim.target !== actors.noxel.target || actors.grim.walkFrame || actors.noxel.walkFrame) return;
      const g = actors.grim.point, n = actors.noxel.point;
      spark.style.left = `${(g.x + actors.grim.button.offsetWidth / 2 + n.x + actors.noxel.button.offsetWidth / 2) / 2}px`;
      spark.style.top = `${Math.min(g.y, n.y) - 12}px`;
      spark.hidden = false;
      if (spark.animate) spark.animate([{opacity:0, transform:"scale(.3)"}, {opacity:1, transform:"scale(1.15)", offset:.4}, {opacity:0, transform:"scale(.7)"}],
        {duration:900, easing:"ease-out"}).onfinish = () => { spark.hidden = true; };
      else spark.hidden = true;
      pose(actors.grim, "inspect");
      pose(actors.noxel, "inspect");
      for (const actor of Object.values(actors)) {
        clearTimeout(actor.idleTimer);
        actor.button.classList.add("is-meeting");
        actor.idleTimer = setTimeout(() => {
          actor.button.classList.remove("is-meeting");
          idleMoment(actor);
        }, 1200);
      }
    }, 450);
  }

  async function visit(name, target, waypoint = null, pop = false) {
    const actor = actors[name];
    if (!active || scrolling || !target || !visibleTargets().includes(target) || (actor.target === target && !waypoint)) return;
    cancel(actor);
    const run = actor.run;
    const next = waypoint || destination(target, name);
    const from = actor.point;
    const distance = from ? Math.hypot(next.x - from.x, next.y - from.y) : Infinity;
    actor.target = target;
    if (reduced.matches || !actor.button.animate) {
      place(actor, next);
    } else if (actor.hidden || pop) {
      if (pop && !actor.hidden) await animate(actor, [{opacity:1, transform:"scale(1)"}, {opacity:0, transform:"scale(.8)"}],
        {duration:220, easing:"ease-in"});
      if (!active || run !== actor.run) return;
      place(actor, next);
      actor.button.style.opacity = "0";
      pose(actor, "inspect");
      actor.hidden = false;
      await animate(actor, [
        {opacity:0, transform:"translateY(18px) scale(.76)"},
        {opacity:1, transform:"translateY(-3px) scale(1.04)", offset:.7},
        {opacity:1, transform:"translateY(0) scale(1)"}
      ], {duration:name === "noxel" ? 390 : 470, easing:"ease-out"});
    } else {
      pose(actor, "walk");
      await walk(actor, next, run);
    }
    if (!active || run !== actor.run) return;
    place(actor, next);
    actor.hidden = false;
    actor.button.style.opacity = "";
    pose(actor, "inspect");
    highlight();
    maybeMeet();
    schedule(actor);
  }

  function start() {
    if (!initialized || active || document.hidden || !area?.classList.contains("active")) return;
    if (area.id === "findView" && area.querySelector('[data-find-panel="catalogue"]').hidden) return;
    const options = visibleTargets();
    if (!options.length) return;
    active = true;
    lastScrollY = scrollY;
    stage.hidden = false;
    for (const actor of Object.values(actors)) {
      actor.target = null;
      actor.point = null;
      actor.hidden = true;
      actor.button.style.opacity = "0";
    }
    visit("grim", options[0]);
    visit("noxel", options[1] || options[0]);
  }

  function stop() {
    active = false;
    scrolling = false;
    clearTimeout(scrollTimer);
    clearTimeout(meetTimer);
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = null;
    for (const actor of Object.values(actors)) { cancel(actor); actor.target = null; actor.hidden = true; actor.point = null; }
    spark && (spark.hidden = true);
    highlight();
    if (stage) stage.hidden = true;
  }

  function followScroll() {
    scrollFrame = null;
    if (!active) return;
    const delta = scrollY - lastScrollY;
    lastScrollY = scrollY;
    const options = visibleTargets();
    const safe = safeSpace();
    for (const actor of Object.values(actors)) {
      if (actor.target && options.includes(actor.target)) {
        // The stage is fixed, so translate the current position by the page's
        // scroll delta. Recomputing the destination here teleports a walker.
        if (actor.point) place(actor, {x:actor.point.x, y:actor.point.y - delta});
        actor.hidden = !actor.point || actor.point.y < safe.top - 12 ||
          actor.point.y > safe.bottom - actor.button.offsetHeight + 12;
        actor.button.style.opacity = actor.hidden ? "0" : "";
        if (!actor.hidden) pose(actor, "idle");
      } else {
        if (actor.point) place(actor, {x:actor.point.x, y:actor.point.y - delta});
        actor.hidden = true;
        actor.button.style.opacity = "0";
      }
    }
    highlight();
  }

  function onScroll() {
    if (!active) { lastScrollY = scrollY; clearTimeout(scrollTimer); scrollTimer = setTimeout(start, 170); return; }
    if (!scrolling) {
      scrolling = true;
      clearTimeout(meetTimer);
      spark.hidden = true;
      for (const actor of Object.values(actors)) cancel(actor);
    }
    if (!scrollFrame) scrollFrame = requestAnimationFrame(followScroll);
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      scrolling = false;
      const options = visibleTargets();
      if (!options.length) { stop(); return; }
      for (const actor of Object.values(actors)) {
        if (actor.hidden || !options.includes(actor.target)) {
          actor.target = null;
          visit(actor.name, options[actor.name === "noxel" && options.length > 1 ? 1 : 0]);
        } else settle(actor);
      }
      maybeMeet();
    }, 180);
  }

  async function settle(actor) {
    const next = destination(actor.target, actor.name);
    const from = actor.point;
    const distance = Math.hypot(next.x - from.x, next.y - from.y);
    const run = actor.run;
    if (distance > 8 && !reduced.matches) {
      await animate(actor, [{transform:"translate(0,0)"},
        {transform:`translate(${next.x - from.x}px,${next.y - from.y}px)`}],
      {duration:clamp(distance * 3, 180, 340), easing:"ease-out"});
    }
    if (!active || scrolling || run !== actor.run) return;
    place(actor, next);
    schedule(actor);
    maybeMeet();
  }

  function refresh() {
    if (!initialized) return;
    if (!active) return start();
    if (scrolling) return;
    const options = visibleTargets();
    if (!options.length) { stop(); return; }
    for (const actor of Object.values(actors)) {
      if (!options.includes(actor.target)) {
        actor.target = null;
        visit(actor.name, options[actor.name === "noxel" && options.length > 1 ? 1 : 0]);
      } else if (!actor.motion && !actor.walkFrame && !actor.hidden) {
        const point = destination(actor.target, actor.name);
        if (Math.hypot(point.x - actor.point.x, point.y - actor.point.y) > 16) settle(actor);
      }
    }
  }

  function init() {
    if (initialized) return;
    const selected = document.querySelector(".view.active");
    area = selected && supported.has(selected.id) ? selected : document.getElementById("homeView");
    stage = document.getElementById("homeCompanions");
    if (!area || !stage) return;
    document.body.append(stage);
    stage.classList.add("pm-roaming-companions");
    spark = document.createElement("span");
    spark.className = "pm-companion-spark";
    spark.setAttribute("aria-hidden", "true");
    spark.hidden = true;
    stage.append(spark);
    for (const name of ["grim", "noxel"]) {
      const button = document.getElementById(name === "grim" ? "companionGrim" : "companionNoxel");
      const image = button.querySelector("img");
      const stepImage = document.createElement("img");
      stepImage.src = art[name].step;
      stepImage.alt = "";
      stepImage.className = "pm-companion-step";
      stepImage.setAttribute("aria-hidden", "true");
      button.append(stepImage);
      actors[name] = {name, button, image, stepImage, target:null, point:null, hidden:true, run:0, steps:0};
      Object.values(art[name]).forEach(src => { const preload = new Image(); preload.src = src; });
      button.addEventListener("click", () => {
        const actor = actors[name], options = visibleTargets();
        const choice = options.find(t => t !== actor.target);
        if (choice) visit(name, choice);
        else if (actor.target && !reduced.matches) {
          pose(actor, "inspect");
          actor.button.animate([{transform:"translateY(0)"}, {transform:"translateY(-6px)", offset:.5}, {transform:"translateY(0)"}],
            {duration:370, easing:"ease-out"});
        }
      });
    }
    document.addEventListener("pointerover", event => {
      if (!active || scrolling || event.pointerType === "touch") return;
      const target = event.target.closest(".coinCard, .pm-home-hero, .findHero, .menuCard");
      if (!target || !visibleTargets().includes(target)) return;
      // Grim notices inspected coins; Noxel continues her own wandering.
      visit("grim", target);
    });
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
    addEventListener("scroll", onScroll, {passive:true});
    addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(refresh, 130); });
    reduced.addEventListener?.("change", () => { stop(); start(); });
    initialized = true;
    start();
  }

  window.PocketMintCompanions = {
    init, refresh,
    setView(view) { stop(); if (!supported.has(view)) return; area = document.getElementById(view); if (initialized) start(); },
    setFindTab(tab) { if (area?.id !== "findView") return; if (tab === "catalogue") start(); else stop(); },
    celebrate() {
      if (!active || reduced.matches) return;
      const options = visibleTargets();
      if (options.length) visit("noxel", options.find(t => t !== actors.noxel.target) || options[0]);
    }
  };
})();
