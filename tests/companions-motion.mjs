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
const area = element(); area.id = "homeView"; area.classList.add("active");
area.querySelectorAll = () => [card];
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
  performance:{now:()=>now}, Math:{...Math, random:()=>.5, max:Math.max, min:Math.min, hypot:Math.hypot, sin:Math.sin, PI:Math.PI, floor:Math.floor},
  setTimeout:later, clearTimeout:clear,
  requestAnimationFrame:fn=>later(fn, 16), cancelAnimationFrame:clear,
  addEventListener(){}
};
vm.runInNewContext(await readFile(new URL("../public/companions.js", import.meta.url), "utf8"), context);
context.window.PocketMintCompanions.init();
await advance(1000);
const start = {grim:Number.parseFloat(grim.style.left), noxel:Number.parseFloat(noxel.style.left)};
await advance(7200);
const beforeStride = Number.parseFloat(grim.style.left);
await advance(350);
const duringStride = Number.parseFloat(grim.style.left);
assert.ok(Math.abs(duringStride - beforeStride) > 3 && Math.abs(duringStride - beforeStride) < 64,
  "Grim's position must progress through a visible walk, without teleporting");
await advance(950);
const end = {grim:Number.parseFloat(grim.style.left), noxel:Number.parseFloat(noxel.style.left)};
assert.ok(Math.abs(end.grim - start.grim) > 25, "Grim must walk while one card is visible");
assert.ok(Math.abs(end.noxel - start.noxel) > 25, "Noxel must walk independently while one card is visible");
console.log("PASS: independent companion walking with one visible card");
