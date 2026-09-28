import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

let now = 0, serial = 0;
const jobs = new Map();
const later = (fn, delay = 0) => { const id = ++serial; jobs.set(id, {at:now + delay, fn}); return id; };
const clear = id => jobs.delete(id);
async function advance(ms) {
  const end = now + ms;
  while (true) {
    const next = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
    if (!next || next[1].at > end) break;
    now = next[1].at;
    jobs.delete(next[0]);
    next[1].fn(now);
    await Promise.resolve();
    await Promise.resolve();
  }
  now = end;
}

function element() {
  const classes = new Set();
  return {
    style:{}, hidden:false, offsetWidth:82, offsetHeight:77, isConnected:true,
    classList:{add:x=>classes.add(x), remove:x=>classes.delete(x),
      contains:x=>classes.has(x), toggle:(x, value)=>value === undefined ? classes.has(x) ? (classes.delete(x), false) : (classes.add(x), true) : value ? (classes.add(x), true) : (classes.delete(x), false)},
    setAttribute(){}, addEventListener(){}, append(){}, matches(){return false;},
    getBoundingClientRect() {return {left:Number.parseFloat(this.style.left) || 0, top:Number.parseFloat(this.style.top) || 0};}
  };
}
const card = element();
card.getBoundingClientRect = () => ({left:40, right:450, top:160, bottom:385, width:410, height:225});
card.matches = selector => selector.includes(".pm-home-hero") || selector.includes(".pm-cream-card");
const card2 = element();
card2.getBoundingClientRect = () => ({left:40, right:450, top:415, bottom:625, width:410, height:210});
card2.matches = card.matches;
const visibleCards = [card];
const area = element(); area.id = "homeView"; area.classList.add("active");
area.querySelectorAll = () => visibleCards;
const stage = element();
function button(width, height) {
  const b = element(), img = element();
  b.offsetWidth = width; b.offsetHeight = height;
  img.getAttribute = key => key === "src" ? img.src : null;
  b.querySelector = () => img;
  b.animate = (_frames, options) => {
    const motion = {onfinish:null, oncancel:null};
    const id = later(() => motion.onfinish?.(), options.duration);
    motion.cancel = () => clear(id);
    return motion;
  };
  return b;
}
const grim = button(82, 77), noxel = button(73, 70);
const nodes = {homeView:area, homeCompanions:stage, companionGrim:grim, companionNoxel:noxel};
const document = {
  hidden:false, body:{append(){}},
  getElementById:id=>nodes[id], createElement:element,
  querySelector:selector=>selector === ".view.active" ? area : null,
  querySelectorAll:()=>[], addEventListener(){}
};
const context = {
  document, window:{}, innerWidth:500, innerHeight:700, scrollY:0,
  Image:class {set src(value) {this.value = value;}},
  matchMedia:()=>({matches:false, addEventListener(){}}),
  performance:{now:()=>now}, Math:{random:()=>.5, abs:Math.abs, max:Math.max, min:Math.min, hypot:Math.hypot, sin:Math.sin, PI:Math.PI, floor:Math.floor},
  setTimeout:later, clearTimeout:clear,
  requestAnimationFrame:fn=>later(fn, 16), cancelAnimationFrame:clear,
  addEventListener(){}
};
vm.runInNewContext(await readFile(new URL("../public/companions.js", import.meta.url), "utf8"), context);
context.window.PocketMintCompanions.init();
await advance(1000);
const start = {grim:Number.parseFloat(grim.style.left), noxel:Number.parseFloat(noxel.style.left)};
const samples = {grim:[start.grim], noxel:[start.noxel]};
for (let elapsed = 0; elapsed < 16000; elapsed += 100) {
  await advance(100);
  samples.grim.push(Number.parseFloat(grim.style.left));
  samples.noxel.push(Number.parseFloat(noxel.style.left));
}
const end = {grim:Number.parseFloat(grim.style.left), noxel:Number.parseFloat(noxel.style.left)};
for (const [name, positions] of Object.entries(samples)) {
  const steps = positions.slice(1).map((x, i) => Math.abs(x - positions[i]));
  assert.ok(steps.reduce((sum, step) => sum + step, 0) > 80, `${name} must travel while one card is visible`);
  assert.ok(steps.filter(step => step > .5 && step < 25).length > 8, `${name} must show intermediate walking positions`);
  assert.ok(Math.max(...steps) < 80, `${name} must not teleport between samples`);
}
assert.ok(Math.abs(end.grim - end.noxel) > 45 || Math.abs(Number.parseFloat(grim.style.top) - Number.parseFloat(noxel.style.top)) > 60,
  "the companions must never rest on top of each other");
visibleCards.push(card2);
const secondCardPath = {grim:[], noxel:[]};
for (let elapsed = 0; elapsed < 14000; elapsed += 100) {
  await advance(100);
  secondCardPath.grim.push(Number.parseFloat(grim.style.top));
  secondCardPath.noxel.push(Number.parseFloat(noxel.style.top));
  if (!grim.classList.contains("is-walking") && !noxel.classList.contains("is-walking") &&
      grim.style.opacity !== "0" && noxel.style.opacity !== "0") {
    const dx = Math.abs(Number.parseFloat(grim.style.left) - Number.parseFloat(noxel.style.left));
    const dy = Math.abs(Number.parseFloat(grim.style.top) - Number.parseFloat(noxel.style.top));
    assert.ok(dx >= 73 || dy >= 70, "the companions must not rest in front of each other");
  }
}
for (const [name, positions] of Object.entries(secondCardPath)) {
  const steps = positions.slice(1).map((y, i) => Math.abs(y - positions[i]));
  assert.ok(steps.reduce((sum, step) => sum + step, 0) > 110, `${name} must travel between visible cards`);
  assert.ok(steps.filter(step => step > .5 && step < 30).length > 8, `${name} must walk between cards without snapping`);
}
grim.animate = undefined;
noxel.animate = undefined;
const fallbackPath = [];
for (let elapsed = 0; elapsed < 12000; elapsed += 100) {
  await advance(100);
  fallbackPath.push(Number.parseFloat(grim.style.top));
}
const fallbackSteps = fallbackPath.slice(1).map((y, i) => Math.abs(y - fallbackPath[i]));
assert.ok(fallbackSteps.filter(step => step > .5 && step < 30).length > 5,
  "walking must still animate when Element.animate is unavailable");
visibleCards.pop();
card.getBoundingClientRect = () => ({left:100, right:232, top:160, bottom:385, width:132, height:225});
context.window.PocketMintCompanions.refresh();
await advance(5000);
assert.ok(Math.abs(Number.parseFloat(grim.style.left) - Number.parseFloat(noxel.style.left)) >= 73 ||
  Math.abs(Number.parseFloat(grim.style.top) - Number.parseFloat(noxel.style.top)) >= 70,
"the companions must have separate resting spots even on a narrow card");
console.log("PASS: separate companions walk around and between visible cards");
