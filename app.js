/* The Curiosity Workshop v2. Vanilla JS, no build step. Content lives in content/*.json. */
(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = u => (/^https:\/\//i.test(String(u || "")) ? String(u) : "");
const reduce = () => document.documentElement.classList.contains("reduce");
const DAY = 864e5;
const TIER = { spark: { name: "Spark", e: "🌱" }, build: { name: "Build", e: "🔨" }, invent: { name: "Invent", e: "🚀" } };
const SPROUT = { spark: "🌱", build: "🌿", invent: "🌻" };
const ARC_COL = { 1: "var(--arc1)", 2: "var(--arc2)", 3: "var(--arc3)" };
const COLORS = ["#E4A44F", "#58A7A0", "#B48AD8", "#E2813F", "#7FAE6A", "#C76B72", "#6E9BD1", "#D9C27A"];

/* ---------------- content ---------------- */
const C = { stations: [], arcs: [], challenges: [], checks: {}, director: { current: [] }, whatsnew: { items: [] }, paths: { paths: [], ranks: [], belt: [], cage: [] }, lessons: [], recipes: [], cards: [], videos: [], academy: [] };
const st = id => C.stations.find(s => s.id === id);
const imgSet = name => `img/v2/${name}-s.webp 720w, img/v2/${name}.webp 1280w`;

async function loadContent() {
  const get = f => fetch(f, { cache: "no-cache" }).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  const [s, ch, q, d, w, p, l, r, f, v] = await Promise.all(["stations", "challenges", "selfchecks", "director", "whatsnew", "paths", "lessons", "recipes", "flashcards", "videos"].map(n => get(`content/${n}.json`)));
  C.stations = s.stations || []; C.arcs = s.arcs || [];
  C.challenges = ch.challenges || []; C.checks = q.checks || {};
  C.director = d && d.current ? d : { current: [] };
  C.whatsnew = w && w.items ? w : { items: [] };
  C.paths = Object.assign(C.paths, p || {});
  const newest = (a, b) => String(b.date).localeCompare(String(a.date));
  C.lessons = (l.lessons || []).filter(x => x && x.id && x.title).sort(newest);
  C.recipes = (r.recipes || []).filter(x => x && x.id && x.title).sort(newest);
  C.cards = f.cards || []; C.videos = v.videos || []; C.academy = v.academy || [];
}

/* ---------------- state (per learner, in this browser) ---------------- */
const KEY = "cw:v3";
const blankLearner = () => ({ stamps: {}, done: {}, hints: {}, quiz: {}, cage: {}, belt: null, path: null, lens: null, cards: {}, reviews: 0, visited: {}, seenWalk: false });
let S;
function loadState() {
  try { S = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { S = null; }
  if (!S || !Array.isArray(S.learners)) {
    S = { learners: [], current: null, data: {}, plants: [] };
    // bring members and garden plants over from the first workshop
    try {
      const old = JSON.parse(localStorage.getItem("curiosity-workshop:v2") || "null");
      if (old && Array.isArray(old.members)) {
        old.members.forEach(m => { S.learners.push({ id: m.id, name: m.name, color: m.color || COLORS[0] }); S.data[m.id] = blankLearner(); });
        S.current = old.current || (S.learners[0] && S.learners[0].id) || null;
        (old.plants || []).forEach(pl => S.plants.push({ id: pl.id || "p" + Math.random().toString(36).slice(2), by: pl.by || pl.member || null, station: pl.station || null, tier: "spark", title: pl.title || pl.name || "A build", link: safeUrl(pl.link || pl.url), note: pl.note || "", at: pl.at || Date.now() }));
      }
    } catch (e) {}
  }
  S.plants = S.plants || [];
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const me = () => S.learners.find(l => l.id === S.current) || null;
const D = () => { const m = me(); if (!m) return null; return (S.data[m.id] = Object.assign(blankLearner(), S.data[m.id] || {})); };
const guest = blankLearner();
const data = () => D() || guest;

/* ---------------- progress & ranks ---------------- */
const stampCount = d => Object.values(d.stamps).reduce((n, t) => n + Object.keys(t || {}).length, 0);
const hasStamp = (d, id) => !!(d.stamps[id] && Object.keys(d.stamps[id]).length);
const quizPassed = d => Object.values(d.quiz).filter(q => q && q.passed).length;
const cageDone = d => C.paths.cage.length > 0 && C.paths.cage.every((_, i) => d.cage[i]);
function need(n, d) {
  switch (n.k) {
    case "cage": return cageDone(d);
    case "stamps": return stampCount(d) >= n.n;
    case "arc": return C.stations.filter(s => s.arc === n.arc).every(s => hasStamp(d, s.id));
    case "arcCount": return C.stations.filter(s => s.arc === n.arc && hasStamp(d, s.id)).length >= n.n;
    case "quizzes": return quizPassed(d) >= n.n;
    case "tiered": return Object.values(d.stamps).reduce((c, t) => c + n.tiers.filter(x => t && t[x]).length, 0) >= n.n;
    case "inventArcs": return [1, 2, 3].every(a => C.stations.some(s => s.arc === a && d.stamps[s.id] && d.stamps[s.id].invent));
    case "plants": { const m = me(); return S.plants.filter(p => m && p.by === m.id).length >= n.n; }
    case "reviews": return (d.reviews || 0) >= n.n;
  }
  return false;
}
function rankInfo(d) {
  const R = C.paths.ranks; let i = 0;
  for (let k = 1; k < R.length; k++) { if (R[k].needs.every(n => need(n, d))) i = k; else break; }
  const next = R[i + 1] || null;
  const pct = next ? Math.round(100 * next.needs.filter(n => need(n, d)).length / next.needs.length) : 100;
  return { i, rank: R[i], next, pct };
}
function suggestedTier(sid) {
  const d = data(), s = st(sid); const t = d.stamps[sid] || {};
  if (t.build && !t.invent) return "invent";
  if (t.spark && !t.build) return "build";
  if (t.invent) return "invent";
  const b = d.belt; if (!b) return "spark";
  const lvl = Math.max(b[0] || 0, b[1] || 0);
  if (s && s.arc === 1) return lvl >= 2 ? "build" : "spark";
  if (s && s.arc === 2) return b[1] >= 2 ? "build" : "spark";
  return b[1] >= 2 ? "build" : "spark";
}
function nextBench() {
  const d = data();
  const p = C.paths.paths.find(x => x.id === d.path);
  const route = p ? p.route : ["prompts", "discernment", "models", "artifacts", "projects", "connectors", "skills", "designs", "data", "claudemd", "mods", "duet", "motion"];
  return route.find(id => !hasStamp(d, id)) || C.stations.find(s => !hasStamp(d, s.id))?.id || "discernment";
}

/* ---------------- toast & stamp ---------------- */
let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 3200); }
function stampFx(text) { const f = $("#stampFx"); f.innerHTML = text; f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); }

/* ---------------- top bar ---------------- */
function renderWho() {
  const m = me();
  $("#whoName").textContent = m ? m.name : "Join in";
  const av = $("#whoAv"); av.textContent = m ? m.name[0].toUpperCase() : "?"; av.style.background = m ? m.color : "#8c816e";
}
function initTop() {
  const top = $("#top");
  const onScroll = () => top.classList.toggle("solid", window.scrollY > window.innerHeight * 0.6 && !inWalk());
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  $("#menuBtn").addEventListener("click", e => { const n = $("#nav"); const o = n.classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", o); });
  $$("#nav a").forEach(a => a.addEventListener("click", () => { $("#nav").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded", "false"); }));
  $("#whoBtn").addEventListener("click", openJoin);
  $("#setBtn").addEventListener("click", () => { $("#motionSw").checked = reduce(); $("#setDlg").showModal(); });
  $("#motionSw").addEventListener("change", e => {
    try { localStorage.setItem("cw:motion", e.target.checked ? "reduce" : "full"); } catch (x) {}
    document.documentElement.classList.toggle("reduce", e.target.checked); walk.reset(); intro.reset(); toast(e.target.checked ? "Calm motion on." : "Full motion on.");
  });
}
const inWalk = () => { const w = $("#walkin"); const r = w.getBoundingClientRect(); return r.bottom > innerHeight * 0.5; };

/* ---------------- the walk-in ---------------- */
const walk = (() => {
  let raf = 0, layers = {}, caps = [], tags = [], dots = [], bloom, cue, chalk, canvas, ctx, motes = [], last = 0, running = false;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const win = (p, a, b, f = 0.05) => clamp(Math.min(seg(p, a, a + f), 1 - seg(p, b - f, b)));
  const TAG_AT = [[18, 44], [55, 24], [79, 40]];
  // map a point on a 16:9 photo (in %) to screen px, for object-fit: cover plus the layer's scale about its origin
  function place(xp, yp, scale, ox, oy, txPct, posX = 0.5) {
    const W = innerWidth, H = innerHeight, A = 16 / 9;
    const dw = W / H > A ? W : H * A, dh = W / H > A ? W / A : H;
    let x = (W - dw) * posX + dw * xp / 100, y = (H - dh) / 2 + dh * yp / 100;
    const cx = W * ox, cy = H * oy; x = cx + (x - cx) * scale + W * (txPct || 0) / 100 * scale; y = cy + (y - cy) * scale;
    return [x, y];
  }
  function progress() { const el = $("#walkin"); const r = el.getBoundingClientRect(); const h = el.offsetHeight - innerHeight; return clamp(-r.top / Math.max(1, h)); }
  function frame() {
    raf = 0; if (reduce()) return;
    const p = progress();
    // door: push toward the glowing gap; the light swells and carries you through
    const pd = ease(seg(p, 0, 0.24));
    set("door", 1 - seg(p, 0.17, 0.25), `scale(${1 + pd * 0.75})`, "43% 62%");
    const bl = Math.min(ease(seg(p, 0.1, 0.2)), 1 - seg(p, 0.22, 0.34)); bloom.style.opacity = bl.toFixed(3);
    // threshold: emerge from the light, slow walk down the aisle
    const pt = seg(p, 0.18, 0.52);
    set("threshold", Math.min(seg(p, 0.17, 0.25), 1 - seg(p, 0.47, 0.55)), `scale(${1.12 + ease(pt) * 0.16})`, "50% 62%");
    // hall: the reveal from the balcony
    const ph = seg(p, 0.48, 0.78);
    set("hall", Math.min(seg(p, 0.47, 0.55), 1 - seg(p, 0.74, 0.82)), `scale(${1.22 - ease(ph) * 0.22}) translateX(${(0.5 - ph) * 3}%)`, "50% 50%");
    // desk
    const pk = seg(p, 0.76, 1);
    set("desk", seg(p, 0.75, 0.83), `scale(${1.1 - ease(pk) * 0.1})`, "60% 40%");
    // captions
    const windows = [[0, 0.17], [0.27, 0.46], [0.55, 0.74], [0.83, 1.02]];
    caps.forEach((c, i) => { const o = i === 0 ? Math.min(1, 1 - seg(p, 0.12, 0.17)) : win(p, windows[i][0], windows[i][1]); c.style.opacity = o.toFixed(3); c.style.transform = `translateY(${(1 - o) * 18}px)`; c.style.pointerEvents = o > .5 ? "auto" : "none"; c.style.visibility = o < 0.01 ? "hidden" : "visible"; });
    const hs = 1.22 - ease(ph) * 0.22;
    tags.forEach((t, i) => {
      const o = win(p, 0.57 + i * 0.025, 0.74, 0.03); t.style.opacity = o.toFixed(3);
      if (o > 0) { const [x, y] = place(TAG_AT[i][0], TAG_AT[i][1], hs, 0.5, 0.5, (0.5 - ph) * 3); const w = innerWidth, h = innerHeight; t.style.left = Math.max(12, Math.min(w - t.offsetWidth - 12, x - t.offsetWidth / 2)) + "px"; t.style.top = Math.max(70, Math.min(h * 0.42, y)) + "px"; t.style.transform = `translateY(${(1 - o) * 10}px)`; }
    });
    // this week's news chalked on the Director's board
    const ko = seg(p, 0.8, 0.88);
    chalk.style.opacity = ko.toFixed(3);
    if (ko > 0) { const ks = 1.1 - ease(pk) * 0.1; const px = innerWidth <= innerHeight ? 0.78 : 0.5; const [x0, y0] = place(61.6, 3.6, ks, 0.6, 0.4, 0, px); const [x1, y1] = place(80.6, 46.4, ks, 0.6, 0.4, 0, px); const safe = Math.max(0, 70 - y0); Object.assign(chalk.style, { left: x0 + "px", top: (y0 + safe) + "px", width: (x1 - x0) + "px", height: (y1 - y0 - safe) + "px", fontSize: Math.max(9, Math.min((y1 - y0) / 13, (y1 - y0 - safe) / 9.5)) + "px" }); }
    const active = p < 0.22 ? 0 : p < 0.5 ? 1 : p < 0.78 ? 2 : 3;
    dots.forEach((d, i) => d.classList.toggle("on", i === active));
    cue.style.opacity = p > 0.03 ? 0 : 1;
  }
  function set(name, o, tf, origin) { const l = layers[name]; if (!l) return; l.style.opacity = o.toFixed(3); l.style.transform = tf; l.style.transformOrigin = origin; l.style.visibility = o < 0.005 ? "hidden" : "visible"; }
  function onScroll() { if (!raf) raf = requestAnimationFrame(frame); }
  // dust motes drifting in the light
  function sizeCanvas() { const dpr = Math.min(2, devicePixelRatio || 1); canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function initMotes() { const n = innerWidth < 700 ? 34 : 70; motes = Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.8 + 0.4, vx: (Math.random() - .5) * 0.00012, vy: -Math.random() * 0.00016 - 0.00003, a: Math.random() * 0.5 + 0.2, t: Math.random() * 6 })); }
  function dust(ts) {
    if (!running) return;
    const dt = Math.min(50, ts - last || 16); last = ts;
    const w = canvas.clientWidth, h = canvas.clientHeight; ctx.clearRect(0, 0, w, h);
    if (inWalk()) {
      for (const m of motes) {
        m.x += m.vx * dt; m.y += m.vy * dt; m.t += dt * 0.001; if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); } if (m.x < 0) m.x = 1; if (m.x > 1) m.x = 0;
        const tw = 0.6 + 0.4 * Math.sin(m.t * 2);
        ctx.beginPath(); ctx.fillStyle = `rgba(255,222,160,${(m.a * tw).toFixed(3)})`; ctx.arc(m.x * w, m.y * h, m.r, 0, 6.283); ctx.fill();
      }
    }
    requestAnimationFrame(dust);
  }
  function start() {
    layers = {}; $$(".layer").forEach(l => layers[l.dataset.l] = l);
    caps = $$(".stage > .cap"); tags = $$(".arc-tag"); dots = $$(".walk-dots span"); bloom = $("#bloom"); cue = $("#cue"); chalk = $("#walkChalk");
    canvas = $("#dust"); ctx = canvas.getContext("2d");
    if (!reduce()) { sizeCanvas(); initMotes(); running = true; requestAnimationFrame(dust); frame(); }
  }
  function reset() { running = false; $$(".layer,.stage>.cap,.arc-tag,#walkChalk").forEach(e => e.removeAttribute("style")); start(); }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => { if (!reduce()) { sizeCanvas(); frame(); } });
  return { start, reset };
})();

/* ---------------- the full-motion entrance ---------------- */
// Plays once over the walk-in, then moves into the hall the way "Skip to the hall" does.
// Calm motion: no autoplay; the poster waits behind a play button.
const intro = (() => {
  let fly, v, play, replayBtn, done = false, pending = false;
  const near = () => scrollY < innerHeight * 0.15;
  const enterRoom = () => $("#hall").scrollIntoView({ behavior: reduce() ? "auto" : "smooth" });
  const showPlay = (on, label) => { play.hidden = !on; if (label) play.setAttribute("aria-label", label); };
  function tryPlay() { const p = v.play(); if (p && p.catch) p.catch(() => showPlay(true, "Play the flythrough")); }
  function rewind() { try { v.currentTime = 0; } catch (e) {} }
  function dismiss() { done = true; pending = false; v.pause(); fly.classList.add("done"); replayBtn.hidden = reduce(); }
  function park() { v.pause(); v.controls = false; showPlay(true, "Replay the flythrough"); }
  function leave() { if (reduce()) park(); else dismiss(); enterRoom(); }
  function begin() { done = false; pending = false; fly.classList.remove("done"); replayBtn.hidden = true; showPlay(false); rewind(); tryPlay(); }
  function replay() { if (reduce()) { begin(); return; } done = false; pending = true; fly.classList.remove("done"); replayBtn.hidden = true; scrollTo({ top: 0, behavior: "instant" }); if (near()) begin(); }
  function onScroll() {
    if (reduce()) return;
    if (pending) { if (near()) begin(); return; }
    if (!done && !near()) dismiss(); // scrolling on means the visitor chose the photo tour
  }
  function reset() {
    v.pause(); v.controls = false; pending = false; done = false; fly.classList.remove("done"); replayBtn.hidden = true;
    if (reduce()) { v.autoplay = false; showPlay(true, "Play the flythrough"); return; }
    showPlay(false);
    const d = D(), deepLink = location.hash && location.hash !== "#walkin";
    if ((d && d.seenWalk && !location.hash) || deepLink || !near()) { v.autoplay = false; dismiss(); } else { v.autoplay = true; tryPlay(); }
  }
  function start() {
    fly = $("#fly"); v = $("#flyVid"); play = $("#flyPlay"); replayBtn = $("#flyReplay");
    if (!fly || !v) return;
    v.addEventListener("ended", leave);
    v.addEventListener("playing", () => showPlay(false));
    play.addEventListener("click", () => { if (reduce()) v.controls = true; if (v.ended) rewind(); done = false; fly.classList.remove("done"); showPlay(false); tryPlay(); });
    $("#flySkip").addEventListener("click", leave);
    replayBtn.addEventListener("click", replay);
    addEventListener("scroll", onScroll, { passive: true });
    reset();
  }
  return { start, reset: () => v && reset() };
})();

/* ---------------- the hall ---------------- */
let showLabels = false;
function renderHall() {
  const d = data(), map = $("#map"), dirSt = C.director.current.map(c => c.station);
  $$(".hot", map).forEach(h => h.remove());
  C.stations.forEach(s => {
    const b = document.createElement("button");
    const isDir = dirSt.includes(s.id);
    b.className = "hot" + (hasStamp(d, s.id) ? " done" : "") + (isDir ? " dir" : "");
    b.dataset.st = s.id; b.style.left = s.hall[0] + "%"; b.style.top = s.hall[1] + "%"; b.style.setProperty("--c", ARC_COL[s.arc]);
    b.setAttribute("aria-label", `${s.name}: ${s.promise}${isDir ? " (Lab Director clip this week)" : ""}${hasStamp(d, s.id) ? " (stamped)" : ""}`);
    b.innerHTML = `<span class="pin" aria-hidden="true"></span><span class="lbl" aria-hidden="true">${esc(s.name)}<small>${esc(s.promise)}</small></span>`;
    b.addEventListener("click", () => openBench(s.id));
    map.appendChild(b);
  });
  map.classList.toggle("labels", showLabels);
  const ms = $("#mapScroll"); if (ms.scrollWidth > ms.clientWidth && !ms.dataset.centered) { ms.dataset.centered = "1"; ms.scrollLeft = (ms.scrollWidth - ms.clientWidth) * 0.45; }
  $("#arcs").innerHTML = C.arcs.map(a => `
    <div class="arc"><h3><i style="background:${ARC_COL[a.n]}" aria-hidden="true"></i>Arc ${a.n} · ${esc(a.name)}</h3>
      <div class="meta">${esc(a.durability)} · signature move: ${esc(a.move)}<br>${esc(a.blurb)}</div>
      <div class="benches">${C.stations.filter(s => s.arc === a.n).map(s => {
        const t = d.stamps[s.id] || {};
        return `<button class="bench-row${s.parent ? " sub" : ""}" data-bench="${s.id}">
          <img src="img/v2/${s.img}-s.webp" alt="" loading="lazy" width="64" height="44">
          <span class="t"><b>${esc(s.name)}${dirSt.includes(s.id) ? '<span class="badge-dir">Director</span>' : ""}</b><span>${esc(s.promise)}</span></span>
          <span class="pips" aria-label="${["spark", "build", "invent"].filter(x => t[x]).length} of 3 stamps">${["spark", "build", "invent"].map(x => `<i class="${t[x] ? "on" : ""}"></i>`).join("")}</span>
        </button>`; }).join("")}</div></div>`).join("");
}

/* ---------------- the desk ---------------- */
function clipFor(station) { return C.director.current.find(c => c.station === station) || null; }
function videoHTML(clip, opts = {}) {
  if (!clip) return "";
  const id = "v-" + clip.id;
  return `<div class="vid"><video id="${id}" controls playsinline preload="none" ${opts.autoplay ? "autoplay" : ""} data-hg="${esc(clip.heygenId)}" data-src="${esc(safeUrl(clip.src))}" aria-label="The Lab Director: ${esc(clip.title)}">
      <track kind="captions" srclang="en" label="English" src="${esc(clip.captions)}" default>
    </video></div>
    <details class="deep" style="margin-top:10px"><summary>Read what she says</summary><p>${esc(clip.transcript)}</p></details>`;
}
// Try a fresh link from /api/director first (if the family set it up), then the saved link, then the transcript.
function wireVideo(v) {
  if (!v || v.dataset.wired) return; v.dataset.wired = "1";
  const saved = v.dataset.src, fresh = `/api/director?id=${encodeURIComponent(v.dataset.hg)}`;
  let stage = 0;
  const tryNext = () => {
    stage++;
    if (stage === 1) { v.src = fresh; }
    else if (stage === 2 && saved) { v.src = saved; }
    else { const box = document.createElement("div"); box.className = "vfail"; box.textContent = "The Director's clip isn't available right now. Her words are below."; v.closest(".vid").replaceWith(box); return; }
    v.load();
  };
  v.addEventListener("error", tryNext, true);
  v.addEventListener("play", () => { $$("video").forEach(o => { if (o !== v) o.pause(); }); });
  const go = () => { tryNext(); v.removeEventListener("pointerdown", go); };
  // load on first interaction or when scrolled near, to keep the page light
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); if (!stage) tryNext(); } }, { rootMargin: "200px" });
  io.observe(v);
}
function renderDesk() {
  const d = data(), wn = C.whatsnew;
  const wk = wn.weekOf ? new Date(wn.weekOf + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
  $("#chalk").innerHTML = $("#walkChalk").innerHTML = `<div class="wk">This week · ${esc(wk)}</div><ul>${(wn.items || []).slice(0, 4).map(i => `<li>${esc(i.title)}</li>`).join("")}</ul>`;
  $("#news").innerHTML = (wn.items || []).slice(0, 5).map(i => `<li><a href="${esc(i.link && i.link.startsWith("#") ? i.link : safeUrl(i.link) || "#desk")}"><b>${esc(i.title)}</b><br><small>${esc(i.body)}</small></a></li>`).join("");
  const welcome = clipFor("desk");
  $("#deskDirector").innerHTML = welcome ? `${videoHTML(welcome)}<div class="meta"><span><b>${esc(welcome.title)}</b><small>The Lab Director · ${Math.round(welcome.duration)} seconds · captions on</small></span><span style="color:var(--muted);font-size:.85rem">She's an AI video avatar made for this workshop.</span></div>` : "";
  wireVideo($("#deskDirector video"));
  // next step
  const m = me(), nb = st(nextBench());
  const tNext = $("#tileNext");
  if (!m) tNext.innerHTML = `<h3>Welcome in.</h3><p>Tell the workshop who you are so your stamps and progress are kept for you.</p><div class="row"><button class="btn primary small" data-act="join">Who's joining?</button></div>`;
  else if (!cageDone(d)) tNext.innerHTML = `<h3>First stop, ${esc(m.name)}: the Tool Cage.</h3><p>Four quick shop rules. Tap each one, and your passport opens.</p><div class="row"><a class="btn primary small" href="#cagePanel">Check out</a></div>`;
  else tNext.innerHTML = `<h3>Your next bench</h3><div class="next-card"><img src="img/v2/${nb.img}-s.webp" alt="" loading="lazy"><div><b>${esc(nb.name)}</b><br><small style="color:var(--muted)">${esc(nb.promise)} Try the ${TIER[suggestedTier(nb.id)].name} challenge.</small></div></div><div class="row"><button class="btn primary small" data-bench="${nb.id}">Walk over</button></div>`;
  // rank
  const r = rankInfo(d);
  $("#tileRank").innerHTML = `<div class="rank-mini"><div class="ring" style="--p:${r.pct}"><span>${r.pct}%</span></div><div><h3>${esc(r.rank.name)}</h3><p>${r.next ? `${r.pct}% of the way to ${esc(r.next.name)}.` : "You've reached the top rung. Keep the garden growing."}</p></div></div><div class="row"><span style="color:var(--muted);font-size:.9rem">${stampCount(d)} stamps · ${quizPassed(d)} self-checks passed</span><a class="link" href="#path">See the ladder</a></div>`;
  renderCards();
}
// flash cards on a simple spaced schedule: 1, 3, 7, 21 days
let fcQueue = [], fcIdx = 0;
function dueCards() {
  const d = data(), now = Date.now();
  const touched = new Set(Object.keys(d.stamps).concat(Object.keys(d.visited)));
  const pool = C.cards.filter(c => touched.size === 0 || touched.has(c.station));
  const src = pool.length ? pool : C.cards;
  return src.filter(c => !d.cards[c.id] || d.cards[c.id].due <= now).slice(0, 5);
}
function renderCards() {
  const tile = $("#tileCards"); fcQueue = dueCards(); fcIdx = 0;
  if (!fcQueue.length) { tile.innerHTML = `<h3>Flash cards</h3><p>Nothing due. Visit a bench and its cards join your deck.</p>`; return; }
  drawCard();
}
function drawCard() {
  const tile = $("#tileCards"), c = fcQueue[fcIdx];
  if (!c) { tile.innerHTML = `<h3>Flash cards</h3><p>Done for today. Remembering is a muscle; see you next time.</p>`; return; }
  const s = st(c.station);
  tile.innerHTML = `<h3>Flash cards <small style="color:var(--muted);font-family:var(--sans);font-size:.85rem">${fcIdx + 1} of ${fcQueue.length}</small></h3>
    <div class="fc"><div class="fc-card" id="fcCard" role="button" tabindex="0" aria-label="Flash card. Press to flip."><div class="fc-face"><b>${esc(c.front)}</b><small>${esc(s ? s.name : "")} · tap to flip</small></div><div class="fc-face back"><div>${sanitize(c.back)}</div></div></div></div>
    <div class="row" id="fcActs" hidden><button class="btn ghost small" data-fc="again">Again</button><button class="btn primary small" data-fc="good">Got it</button></div>`;
  const card = $("#fcCard");
  const flip = () => { card.classList.toggle("flip"); $("#fcActs").hidden = false; };
  card.addEventListener("click", flip); card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
}
const sanitize = html => String(html).replace(/<(?!\/?(code|br|b|i|em)\b)[^>]*>/gi, "");
function gradeCard(ok) {
  const d = D(); const c = fcQueue[fcIdx]; if (!c) return;
  if (d) {
    const steps = [1, 3, 7, 21]; const prev = d.cards[c.id] || { step: -1 };
    const step = ok ? Math.min(steps.length - 1, prev.step + 1) : 0;
    d.cards[c.id] = { step, due: Date.now() + steps[step] * DAY }; d.reviews = (d.reviews || 0) + 1; save();
  }
  fcIdx++; drawCard();
}

/* ---------------- the path ---------------- */
function renderPath() {
  const d = data(), r = rankInfo(d);
  $("#ladder").innerHTML = C.paths.ranks.map((k, i) => `<li class="rung${i === r.i ? " now" : ""}${i < r.i ? " done" : ""}">
    <div class="n">Rung ${i + 1}${i === r.i ? " · you are here" : ""}</div><h3>${esc(k.name)}</h3><div class="pct">${esc(k.pct)}</div><p>${esc(k.can)}</p>
    ${k.needs.length ? `<ul>${k.needs.map(n => `<li class="${need(n, d) ? "ok" : ""}">${esc(n.label)}</li>`).join("")}</ul>` : ""}</li>`).join("");
  // tool cage
  $("#cagePanel").innerHTML = `<div class="cage"><img src="img/v2/cage-s.webp" alt="The tool checkout cage: goggles and aprons on hooks, a sign-out ledger and safety placards." loading="lazy"><div>
    <h3>The Tool Cage</h3><p style="color:var(--muted);margin:0 0 12px">Every maker checks out here once. Tap each rule when you've read it.</p>
    <div class="cage-cards">${C.paths.cage.map((c, i) => `<button class="cc" data-cage="${i}" aria-pressed="${!!d.cage[i]}"><span class="ic" aria-hidden="true">${c.icon}</span><span><b>${esc(c.title)}</b><span>${esc(c.body)}</span></span></button>`).join("")}</div>
    ${cageDone(d) ? `<p class="stamped" style="margin-top:12px">✓ Checked out. Your passport is open.</p>` : ""}</div></div>`;
  // tool belt check
  const b = d.belt || [];
  $("#beltPanel").innerHTML = `<h3>Tool Belt Check</h3><p>Three quick questions. No grades; it just helps us suggest where to start. Change your answers any time.</p>
    ${C.paths.belt.map((q, qi) => `<p class="q" id="bq${qi}">${esc(q.q)}</p><div class="choice" role="group" aria-labelledby="bq${qi}">${q.a.map((a, ai) => `<button data-belt="${qi}:${ai}" aria-pressed="${b[qi] === ai}">${esc(a)}</button>`).join("")}</div>`).join("")}
    ${b.length === 3 ? `<p class="stamped">✓ We'll suggest ${TIER[suggestedTier("prompts")].name} challenges to start, and the ${esc((C.paths.paths.find(p => p.id === d.path) || {}).name || "")} path.</p>` : ""}`;
  // interest paths
  $("#pathsPanel").innerHTML = `<h3>Explorer's paths</h3><p>Pick the path that sounds most like you. Every path passes the Inspection Bench, and any bench is open any time.</p>
    <div class="paths">${C.paths.paths.map(p => `<button class="pathcard" data-path="${p.id}" aria-pressed="${d.path === p.id}"><b>${p.icon} ${esc(p.name)}</b><span>For ${esc(p.for.toLowerCase())}. Capstone: ${esc(p.capstone)}.</span>
      <div class="route">${p.route.map(id => `<span class="chip" style="background:${hasStamp(d, id) ? "rgba(127,174,106,.25)" : "rgba(239,230,212,.06)"}">${hasStamp(d, id) ? "✓ " : ""}${esc(st(id) ? st(id).name : id)}</span>`).join("")}</div></button>`).join("")}</div>`;
}

/* ---------------- recipes & catalog ---------------- */
let allRecipes = false, allLessons = false, lessonFilter = "all";
const isFresh = dt => { const t = new Date(dt + "T12:00:00"); return !isNaN(t) && Date.now() - t < 7 * DAY; };
const fmt = dt => { const t = new Date(dt + "T12:00:00"); return isNaN(t) ? "" : t.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); };
const markBrackets = t => esc(t).replace(/\[([^\]]+)\]/g, "<mark>[$1]</mark>");
function recipeCard(r) {
  const s = st(r.station);
  return `<article class="icard">${isFresh(r.date) ? '<span class="tag">New this week</span>' : ""}<h3>${esc(r.title)}</h3>
    ${r.ingredients ? `<ul>${r.ingredients.map(i => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
    <div class="method">${esc(r.method)}</div>${r.notes ? `<p class="notes">${esc(r.notes)}</p>` : ""}
    <div class="foot"><button class="copy" data-copy="${esc(r.method)}">Copy prompt</button>${s ? `<button class="link" style="color:#8a5a1a" data-bench="${s.id}">${esc(s.name)}</button>` : ""}${safeUrl(r.source && r.source.url) ? `<a href="${esc(r.source.url)}" target="_blank" rel="noopener">Source</a>` : ""}<span>${esc(fmt(r.date))}</span></div></article>`;
}
function renderRecipes() {
  const list = allRecipes ? C.recipes : C.recipes.slice(0, 6);
  $("#recipeCards").innerHTML = list.map(recipeCard).join("") || `<p class="empty">The first cards are on their way.</p>`;
  $("#moreRecipes").hidden = C.recipes.length <= 6 || allRecipes;
}
function lessonCard(l) {
  const s = st(l.station);
  return `<article class="lesson"><span class="st">${esc(s ? s.name : l.station)}${isFresh(l.date) ? '<span class="new">NEW</span>' : ""}</span><h3>${esc(l.title)}</h3><p class="${l.body.length > 200 ? "clamp" : ""}" id="lb-${esc(l.id)}">${esc(l.body)}</p>${l.body.length > 200 ? `<button class="more-btn" data-more="lb-${esc(l.id)}" aria-expanded="false" aria-controls="lb-${esc(l.id)}">Read more</button>` : ""}
    ${l.tryIt ? `<div class="try"><b>Try it:</b> ${esc(l.tryIt)}</div>` : ""}
    <div class="foot">${esc(fmt(l.date))}${safeUrl(l.source && l.source.url) ? ` · <a href="${esc(l.source.url)}" target="_blank" rel="noopener">${esc(l.source.title || "Source")}</a>` : ""}</div></article>`;
}
function renderCatalog() {
  const used = [...new Set(C.lessons.map(l => l.station))];
  $("#lessonFilters").innerHTML = `<button data-lf="all" aria-pressed="${lessonFilter === "all"}">All</button>` + used.map(id => `<button data-lf="${id}" aria-pressed="${lessonFilter === id}">${esc(st(id) ? st(id).name : id)}</button>`).join("");
  const ls = C.lessons.filter(l => lessonFilter === "all" || l.station === lessonFilter);
  $("#lessons").innerHTML = (allLessons ? ls : ls.slice(0, 6)).map(lessonCard).join("") || `<p class="empty">No lessons here yet.</p>`;
  $("#moreLessons").hidden = ls.length <= 6 || allLessons;
  $("#reels").innerHTML = C.videos.map(v => reelCard(v)).join("");
}
const reelCard = v => `<button class="reel" data-yt="${esc(v.id)}"><span class="th" style="background-image:url('https://i.ytimg.com/vi/${encodeURIComponent(v.yt)}/mqdefault.jpg')"></span><span class="tx"><b>${esc(v.short)}</b><span>${esc(v.channel)} · ${esc(v.len)}</span></span></button>`;
function openReel(id) {
  const v = C.videos.find(x => x.id === id); if (!v) return;
  $("#ytFrame").innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.yt)}?rel=0&modestbranding=1&playsinline=1&autoplay=1&cc_load_policy=1" title="${esc(v.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  $("#ytH").textContent = v.title; $("#ytSub").textContent = `${v.channel} · ${v.len}`;
  const n = $("#ytNotes"); if (safeUrl(v.notes)) { n.href = v.notes; n.hidden = false; } else n.hidden = true;
  $("#ytTake").innerHTML = `<p style="margin:0 0 6px">${esc(v.sum || "")}</p>${v.take ? `<ul style="margin:0;padding-left:18px">${v.take.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}`;
  const dd = D(); if (dd && v.stations && v.stations[0]) { dd.visited[v.stations[0]] = Date.now(); save(); }
  $("#ytDlg").showModal();
}

/* ---------------- garden ---------------- */
let plantCtx = null;
function renderGarden() {
  const plants = [...S.plants].sort((a, b) => b.at - a.at);
  $("#beds").innerHTML = plants.length ? plants.map(p => {
    const by = S.learners.find(l => l.id === p.by), s = st(p.station), link = safeUrl(p.link);
    return `<div class="plant"><div class="sp" aria-hidden="true">${SPROUT[p.tier] || "🌱"}</div><b>${esc(p.title)}</b><small>${esc(by ? by.name : "Someone")}${s ? " · " + esc(s.name) : ""} · ${new Date(p.at).toLocaleDateString()}</small>
      ${p.note ? `<small style="margin-top:6px">Checked: ${esc(p.note)}</small>` : ""}${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Open it</a>` : ""}
      ${me() && p.by === me().id ? `<button class="rm" data-unplant="${esc(p.id)}" aria-label="Remove ${esc(p.title)} from the garden">✕</button>` : ""}</div>`; }).join("")
    : `<div class="empty">The beds are freshly dug. Finish a challenge at any bench and plant the first build.</div>`;
}
function openPlant(ctx) {
  if (!me()) { openJoin(() => openPlant(ctx)); return; }
  plantCtx = ctx || null; const f = $("#plantForm"); f.reset();
  $("#plantSub").textContent = ctx && ctx.station ? `From the ${st(ctx.station).name}, ${TIER[ctx.tier].name} challenge. A title is enough; a link is a bonus.` : "Share what you made so others can see it. A title is enough; a link is a bonus.";
  $("#plantDlg").showModal();
}

/* ---------------- learners ---------------- */
let afterJoin = null;
function openJoin(then) {
  afterJoin = typeof then === "function" ? then : null;
  const used = S.learners.map(l => l.color); const free = COLORS.filter(c => !used.includes(c));
  $("#learnerList").innerHTML = S.learners.map(l => `<div style="display:flex;gap:6px"><button class="learner" data-learner="${l.id}" aria-pressed="${l.id === S.current}"><span class="av" style="background:${l.color}">${esc(l.name[0].toUpperCase())}</span><span><b>${esc(l.name)}</b><small>${esc(rankInfo(Object.assign(blankLearner(), S.data[l.id] || {})).rank.name)} · ${stampCount(Object.assign(blankLearner(), S.data[l.id] || {}))} stamps</small></span></button><button class="iconbtn" data-rmlearner="${l.id}" aria-label="Remove ${esc(l.name)}">✕</button></div>`).join("");
  $("#swatches").innerHTML = COLORS.map((c, i) => `<label><input type="radio" name="color" value="${c}" ${c === (free[0] || COLORS[0]) ? "checked" : ""} aria-label="Color ${i + 1}"><span style="background:${c}"></span></label>`).join("");
  $("#joinDlg").showModal();
}
function setLearner(id) { S.current = id; save(); renderAll(); const m = me(); if (m) toast(`Welcome back, ${m.name}.`); }

/* ---------------- the bench (one station) ---------------- */
let curBench = null, lastFocus = null, lastFocusSel = null, curTier = null;
function benchHTML(s) {
  const d = data(), clip = clipFor(s.id), arc = C.arcs.find(a => a.n === s.arc) || {};
  const parent = s.parent ? st(s.parent) : null, subs = C.stations.filter(x => x.parent === s.id);
  const chs = C.challenges.filter(c => c.station === s.id);
  const tier = curTier && chs.some(c => c.tier === curTier) ? curTier : suggestedTier(s.id);
  const recipe = C.recipes.find(r => r.station === s.id);
  const vids = C.videos.filter(v => (v.stations || []).includes(s.id)).slice(0, 3);
  const lessons = C.lessons.filter(l => l.station === s.id);
  const idx = C.stations.indexOf(s), prev = C.stations[(idx - 1 + C.stations.length) % C.stations.length], next = C.stations[(idx + 1) % C.stations.length];
  const t = d.stamps[s.id] || {};
  const lens = d.lens || "read";
  return `
  <div class="bench-hero"><img src="img/v2/${s.img}.webp" srcset="${imgSet(s.img)}" sizes="100vw" alt="">
    <div class="in"><p class="eyebrow" style="margin:0">Arc ${s.arc} · ${esc(arc.name || "")}${parent ? ` · part of the ${esc(parent.name)}` : ""}</p>
      <h2 id="benchTitle" tabindex="-1">${esc(s.name)}</h2><p class="promise">${esc(s.promise)}</p>
      <div class="chips"><span class="chip">4D: ${esc(s.fourD)}</span><span class="chip">Lasts: ${esc(s.durability)}</span><span class="chip">Signature move: ${esc(s.move)}</span>${clip ? '<span class="chip" style="border-color:var(--teal)">Lab Director here this week</span>' : ""}${s.checked ? `<span class="chip">Checked ${esc(fmt(s.checked))}</span>` : ""}</div></div></div>
  <div class="bench-body">
    <div class="flow ${lens}" id="flow">
      <section class="blk" data-k="what" aria-labelledby="w-h"><h3 id="w-h"><span class="num">WHAT IS IT</span></h3>
        <p class="what-quick">${esc(s.quick)}</p>
        <details class="deep"><summary>Go deeper</summary><p>${esc(s.deep)}</p>${subs.length ? `<p>Sub-benches: ${subs.map(x => `<button class="link" data-bench="${x.id}">${esc(x.name)}</button>`).join(", ")}.</p>` : ""}</details>
      </section>
      <section class="blk" data-k="watch" aria-labelledby="v-h"><h3 id="v-h"><span class="num">WATCH</span> ${clip ? "The Lab Director" : "Watch it done"}</h3>
        ${clip ? `<p class="sub">${esc(clip.title)} · ${Math.round(clip.duration)} seconds · captions on. She's an AI video avatar made for this workshop.</p>${videoHTML(clip)}` : `<p class="sub">The Director visits four benches each week. Until she's here, these reels from the family's Treasure Chest show it done.</p>`}
        ${vids.length ? `<div class="reels" style="margin-top:14px">${vids.map(reelCard).join("")}</div>` : ""}
      </section>
      <section class="blk" data-k="recipe" aria-labelledby="r-h"><h3 id="r-h"><span class="num">WE DO</span> The recipe card</h3>
        <p class="sub">${recipe ? esc(recipe.title) + ". Copy it, fill in the [brackets], paste it into Claude." : "Start with the Spark prompt below."}</p>
        ${recipe ? `<div class="prompt-box">${markBrackets(recipe.method)}<div class="acts"><button class="btn small ghost" data-copy="${esc(recipe.method)}">Copy</button><a class="btn small primary" href="https://claude.ai/new" target="_blank" rel="noopener">Open Claude ↗</a></div></div>${recipe.notes ? `<p class="sub" style="margin-top:10px">${esc(recipe.notes)}</p>` : ""}` : ""}
      </section>
      <section class="blk" data-k="challenge" aria-labelledby="c-h"><h3 id="c-h"><span class="num">YOU DO</span> Challenge board</h3>
        <p class="sub">Pick any level. Build it in your own Claude, then tick off the checks here. We suggest <b>${TIER[tier].name}</b> for you.</p>
        <div class="tiers" role="tablist" aria-label="Challenge level">${chs.map(c => `<button role="tab" id="tab-${c.id}" aria-controls="pane" aria-selected="${c.tier === tier}" data-tier="${c.tier}"><span aria-hidden="true">${TIER[c.tier].e}</span>${TIER[c.tier].name}${t[c.tier] ? ' <span class="st" aria-label="stamped">✓</span>' : ""}</button>`).join("")}</div>
        <div id="pane" role="tabpanel">${challengePane(chs.find(c => c.tier === tier) || chs[0])}</div>
      </section>
      <section class="blk quiz" data-k="question" aria-labelledby="q-h"><h3 id="q-h"><span class="num">NOW QUESTION IT</span></h3>
        <p class="discern">${esc(s.discern)}</p>
        <p class="sub">Then the self-check: three questions. Get them all right (retries welcome) to earn this bench's inspector's mark.</p>
        <form id="quiz" data-st="${s.id}">${(C.checks[s.id] || []).map((q, qi) => `<fieldset><legend>${qi + 1}. ${esc(q.q)}</legend>${q.options.map((o, oi) => `<label class="opt"><input type="radio" name="q${qi}" value="${oi}" ${d.quiz[s.id] && d.quiz[s.id].passed && oi === q.answer ? "checked" : ""}><span>${esc(o)}</span></label>`).join("")}<p class="why" id="why${qi}" aria-live="polite"></p></fieldset>`).join("")}
          <button class="btn primary" type="submit">Check my answers</button> ${d.quiz[s.id] && d.quiz[s.id].passed ? '<span class="stamped">✓ Inspector\'s mark earned</span>' : ""}</form>
      </section>
      <section class="blk" data-k="rule" aria-labelledby="sr-h"><h3 id="sr-h"><span class="num">SHOP RULE</span></h3><div class="rule"><span class="ic" aria-hidden="true">📜</span><p style="margin:0;font-size:1.08rem">${esc(s.rule)}</p></div></section>
      <div class="bench-nav" style="order:9"><button data-bench="${prev.id}"><small>← Previous bench</small>${esc(prev.name)}</button><button data-bench="${next.id}"><small>Next bench →</small>${esc(next.name)}</button></div>
    </div>
    <aside class="side" aria-label="About this bench">
      <div class="blk"><h4>Your stamps here</h4><div class="stamps-big">${["spark", "build", "invent"].map(x => `<div class="stamp${t[x] ? " on" : ""}"><span class="e" aria-hidden="true">${TIER[x].e}</span>${TIER[x].name}${t[x] ? "<br>✓" : ""}</div>`).join("")}</div></div>
      ${lessons.length ? `<div class="blk"><h4>From the card catalog</h4><ul>${lessons.slice(0, 4).map(l => `<li><b style="color:var(--text)">${esc(l.title)}</b><br>${esc(l.tryIt || "")}</li>`).join("")}</ul></div>` : ""}
      <div class="blk"><h4>Academy shelf</h4><ul>${(s.academy || []).map(a => `<li><a href="${esc(safeUrl(a.u))}" target="_blank" rel="noopener">${esc(a.t)}</a></li>`).join("")}</ul>
        ${s.source && safeUrl(s.source.url) ? `<p style="color:var(--muted);font-size:.85rem;margin:12px 0 0">Checked against <a href="${esc(s.source.url)}" target="_blank" rel="noopener">${esc(s.source.title)}</a>.</p>` : ""}</div>
      <div class="blk"><h4>Pair build</h4><p style="color:var(--muted);margin:0;font-size:.92rem">Doing this with someone? One drives Claude, one inspects, then swap. Both of you stamp.</p></div>
    </aside>
  </div>`;
}
function challengePane(c) {
  if (!c) return "";
  const d = data(), ticks = d.done[c.id] || [], shown = d.hints[c.id] || 0, stamped = !!(d.stamps[c.station] && d.stamps[c.station][c.tier]);
  const all = c.doneWhen.every((_, i) => ticks[i]);
  return `<h4 style="font-family:var(--serif);font-weight:500;font-size:1.3rem;margin:0 0 6px">${TIER[c.tier].e} ${esc(c.title)}</h4><p>${esc(c.brief)}</p>
    <div class="prompt-box">${markBrackets(c.prompt)}<div class="acts"><button class="btn small ghost" data-copy="${esc(c.prompt)}">Copy</button><a class="btn small primary" href="https://claude.ai/new" target="_blank" rel="noopener">Open Claude ↗</a></div></div>
    <p style="margin:16px 0 0;font-weight:600">Done when…</p>
    <ul class="done-list">${c.doneWhen.map((w, i) => `<li><label><input type="checkbox" data-done="${c.id}:${i}" ${ticks[i] ? "checked" : ""}><span>${esc(w)}</span></label></li>`).join("")}</ul>
    <div class="hints">${c.hints.slice(0, shown).map((h, i) => `<div class="hint"><b>${["Nudge", "A model", "Worked example"][i]}</b>${esc(h)}</div>`).join("")}
      ${shown < c.hints.length ? `<button class="btn ghost small" data-hint="${c.id}">${shown ? "Another hint" : "Stuck? Get a hint"}</button>` : ""}</div>
    <div class="stamp-row">${stamped ? `<span class="stamped">✓ Stamped. Nice work.</span><button class="btn ghost small" data-act="plant" data-plantst="${c.station}" data-planttier="${c.tier}">Plant it in the garden</button>${c.tier !== "invent" ? `<button class="btn ghost small" data-tier="${c.tier === "spark" ? "build" : "invent"}">Next: ${c.tier === "spark" ? "Build" : "Invent"} →</button>` : ""}`
      : `<button class="btn primary" data-stamp="${c.id}" ${all ? "" : "disabled"}>Stamp my passport</button><span style="color:var(--muted);font-size:.9rem">${all ? "All checks ticked." : "Tick every check to stamp."}</span>`}</div>`;
}
function openBench(id, push = true, keepTier = false) {
  const s = st(id); if (!s) return;
  if (!keepTier || !curBench || curBench.id !== id) curTier = null;
  curBench = s; const b = $("#bench");
  if (!b.classList.contains("open")) { const a = document.activeElement; lastFocus = a; lastFocusSel = a && a.classList && a.classList.contains("hot") ? `.hot[data-st="${id}"]` : a && a.dataset && a.dataset.bench ? `#${(a.closest("section[id]") || {}).id || "hall"} [data-bench="${id}"]` : null; }
  $("#benchInner").innerHTML = benchHTML(s); $("#benchBarTitle").textContent = s.name;
  const d = data(); $$("[data-lens]").forEach(x => x.setAttribute("aria-pressed", x.dataset.lens === (d.lens || "read")));
  b.hidden = false; requestAnimationFrame(() => b.classList.add("open"));
  document.body.style.overflow = "hidden"; b.scrollTop = 0;
  const dd = D(); if (dd) { dd.visited[s.id] = Date.now(); save(); }
  $$("#benchInner video").forEach(wireVideo);
  if (push && location.hash !== "#/bench/" + id) history.pushState({ bench: id }, "", "#/bench/" + id);
  setTimeout(() => { const h = $("#benchTitle"); h && h.focus({ preventScroll: true }); }, 60);
}
function closeBench(push = true) {
  const b = $("#bench"); if (!b.classList.contains("open")) return;
  $$("#bench video").forEach(v => v.pause());
  b.classList.remove("open"); document.body.style.overflow = "";
  setTimeout(() => { if (!b.classList.contains("open")) b.hidden = true; }, 460);
  curBench = null; renderAll();
  if (push && location.hash.startsWith("#/bench/")) history.pushState({}, "", "#hall");
  const back = lastFocus && lastFocus.isConnected ? lastFocus : lastFocusSel ? $(lastFocusSel) : null;
  if (back && back.focus) back.focus({ preventScroll: true }); else $("#hall").scrollIntoView();
}
function refreshBench() { if (!curBench) return; const y = $("#bench").scrollTop; openBench(curBench.id, false, true); $("#bench").scrollTop = y; }
function refreshPane(cid) { const c = C.challenges.find(x => x.id === cid); const p = $("#pane"); if (c && p) p.innerHTML = challengePane(c); }

/* ---------------- events ---------------- */
function copy(text, btn) {
  const done = () => { toast("Copied. Paste it into Claude and fill in the [brackets]."); if (btn) { const o = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(() => btn.textContent = o, 1600); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallback());
  else fallback();
  function fallback() { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { toast("Select the text and copy it by hand."); } ta.remove(); }
}
function requireLearner(then) { if (me()) return true; openJoin(then); toast("Tell the workshop who you are first, so it can keep your stamps."); return false; }
function onClick(e) {
  const t = e.target.closest("button, a, [data-bench]"); if (!t) return;
  const ds = t.dataset;
  if (ds.bench) { e.preventDefault(); openBench(ds.bench); return; }
  if (ds.copy != null) { copy(ds.copy, t); return; }
  if (ds.more) { const el = document.getElementById(ds.more); const open = el.classList.toggle("open"); t.setAttribute("aria-expanded", open); t.textContent = open ? "Show less" : "Read more"; return; }
  if (ds.yt) { openReel(ds.yt); return; }
  if (ds.learner) { setLearner(ds.learner); $("#joinDlg").close(); return; }
  if (ds.rmlearner) { const l = S.learners.find(x => x.id === ds.rmlearner); if (l && confirm(`Remove ${l.name} and their progress from this browser?`)) { S.learners = S.learners.filter(x => x.id !== l.id); delete S.data[l.id]; if (S.current === l.id) S.current = S.learners[0] ? S.learners[0].id : null; save(); openJoin(); renderAll(); } return; }
  if (ds.close != null) { t.closest("dialog").close(); return; }
  if (ds.lens) { const d = D(); if (d) { d.lens = ds.lens; save(); } else guest.lens = ds.lens; $$("[data-lens]").forEach(x => x.setAttribute("aria-pressed", x === t)); const f = $("#flow"); if (f) f.className = "flow " + ds.lens; $("#bench").scrollTo({ top: $(".bench-hero").offsetHeight - 10, behavior: reduce() ? "auto" : "smooth" }); return; }
  if (ds.tier && curBench) { curTier = ds.tier; $$(".tiers [role=tab]").forEach(x => x.setAttribute("aria-selected", x.dataset.tier === ds.tier)); const c = C.challenges.find(x => x.station === curBench.id && x.tier === ds.tier); $("#pane").innerHTML = challengePane(c); return; }
  if (ds.hint) { const d = D(); const g = d || guest; g.hints[ds.hint] = (g.hints[ds.hint] || 0) + 1; save(); refreshPane(ds.hint); return; }
  if (ds.stamp) {
    if (!requireLearner(() => refreshBench())) return;
    const c = C.challenges.find(x => x.id === ds.stamp), d = D(); const before = rankInfo(d).i; curTier = c.tier;
    d.stamps[c.station] = Object.assign({}, d.stamps[c.station], { [c.tier]: Date.now() }); save();
    stampFx(`${TIER[c.tier].e}<br>${esc(st(c.station).name)}<br><small style="font-size:.7em">${TIER[c.tier].name}</small>`);
    const after = rankInfo(d);
    setTimeout(() => { refreshBench(); toast(after.i > before ? `You're now a ${after.rank.name}!` : "Stamped! Plant it in the garden so others can see."); }, reduce() ? 0 : 900);
    return;
  }
  if (ds.cage != null) { if (!requireLearner()) return; const d = D(); d.cage[ds.cage] = !d.cage[ds.cage]; save(); renderPath(); renderDesk(); renderHall(); if (cageDone(d)) toast("Checked out. Your passport is open."); return; }
  if (ds.belt) { if (!requireLearner()) return; const [qi, ai] = ds.belt.split(":").map(Number); const d = D(); d.belt = d.belt || []; d.belt[qi] = ai; if (qi === 2 && !d.path) d.path = ["storyteller", "organizer", "builder", "artist"][ai]; save(); renderPath(); renderDesk(); return; }
  if (ds.path) { if (!requireLearner()) return; const d = D(); d.path = ds.path; save(); renderPath(); renderDesk(); toast(`The ${C.paths.paths.find(p => p.id === ds.path).name} path it is.`); return; }
  if (ds.fc) { gradeCard(ds.fc === "good"); return; }
  if (ds.unplant) { S.plants = S.plants.filter(p => p.id !== ds.unplant); save(); renderGarden(); return; }
  if (ds.lf) { lessonFilter = ds.lf; allLessons = false; renderCatalog(); return; }
  switch (ds.act) {
    case "join": e.preventDefault(); $("#setDlg").open && $("#setDlg").close(); openJoin(); break;
    case "closebench": closeBench(); break;
    case "next": openBench(nextBench()); break;
    case "plant": openPlant(ds.plantst ? { station: ds.plantst, tier: ds.planttier } : null); break;
    case "skipwalk": $("#hall").scrollIntoView({ behavior: reduce() ? "auto" : "smooth" }); break;
    case "replaywalk": $("#setDlg").close(); scrollTo({ top: 0, behavior: "auto" }); break;
    case "reset": { const m = me(); if (m && confirm(`Clear all of ${m.name}'s stamps and checks on this device?`)) { S.data[m.id] = blankLearner(); S.data[m.id].seenWalk = true; save(); renderAll(); toast("Fresh start."); } break; }
  }
}
function onChange(e) {
  const t = e.target;
  if (t.dataset.done) {
    const [cid, i] = [t.dataset.done.slice(0, t.dataset.done.lastIndexOf(":")), +t.dataset.done.split(":").pop()];
    const g = D() || guest; g.done[cid] = g.done[cid] || []; g.done[cid][i] = t.checked; save();
    const c = C.challenges.find(x => x.id === cid); const all = c.doneWhen.every((_, k) => g.done[cid][k]);
    const btn = $(`[data-stamp="${cid}"]`); if (btn) { btn.disabled = !all; btn.nextElementSibling.textContent = all ? "All checks ticked." : "Tick every check to stamp."; }
  }
}
function onSubmit(e) {
  const f = e.target;
  if (f.id === "quiz") {
    e.preventDefault(); const sid = f.dataset.st, qs = C.checks[sid] || []; let right = 0;
    qs.forEach((q, qi) => {
      const sel = f.querySelector(`input[name=q${qi}]:checked`), why = $("#why" + qi);
      $$(`input[name=q${qi}]`, f).forEach(i => i.closest(".opt").classList.remove("right", "wrong"));
      if (!sel) { why.className = "why"; why.textContent = "Pick an answer."; return; }
      const ok = +sel.value === q.answer; if (ok) right++;
      sel.closest(".opt").classList.add(ok ? "right" : "wrong");
      why.className = "why" + (ok ? " ok" : ""); why.textContent = (ok ? "Right. " : "Not quite. ") + (ok ? q.why : "Have another look.");
    });
    const d = D();
    if (right === qs.length) {
      if (d) { const was = d.quiz[sid] && d.quiz[sid].passed; d.quiz[sid] = { passed: true, at: Date.now() }; save(); if (!was) { stampFx("🔍<br>Inspector's<br>mark"); toast("All right! Inspector's mark earned."); } }
      else toast("All right! Join the workshop to keep your marks.");
    } else toast(`${right} of ${qs.length}. Try the others again.`);
    return;
  }
  if (f.id === "joinForm") {
    e.preventDefault(); const name = f.name.value.trim().slice(0, 24); if (!name) { f.name.focus(); return; }
    const color = (f.querySelector("input[name=color]:checked") || {}).value || COLORS[0];
    const id = "m" + Date.now().toString(36); S.learners.push({ id, name, color }); S.data[id] = blankLearner(); S.data[id].seenWalk = true; S.current = id; save();
    $("#joinDlg").close(); f.reset(); renderAll(); toast(`Welcome to the workshop, ${name}!`);
    if (afterJoin) { const a = afterJoin; afterJoin = null; a(); }
    return;
  }
  if (f.id === "plantForm") {
    e.preventDefault(); const m = me(); if (!m) return;
    S.plants.push({ id: "p" + Date.now().toString(36), by: m.id, station: plantCtx && plantCtx.station, tier: (plantCtx && plantCtx.tier) || "spark", title: f.title.value.trim().slice(0, 80) || "A build", link: safeUrl(f.link.value.trim()), note: f.note.value.trim().slice(0, 280), at: Date.now() });
    save(); $("#plantDlg").close(); renderGarden(); renderPath(); toast("Planted! It's in the garden.");
  }
}

/* ---------------- routing ---------------- */
function route() {
  const m = location.hash.match(/^#\/bench\/([a-z]+)/);
  if (m) openBench(m[1], false); else closeBench(false);
}

/* ---------------- reveal on scroll ---------------- */
function initReveal() {
  if (reduce() || !("IntersectionObserver" in window)) { $$(".rv").forEach(x => x.classList.add("in")); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  $$(".rv").forEach(x => io.observe(x));
}

function renderAll() { renderWho(); renderHall(); renderDesk(); renderPath(); renderRecipes(); renderCatalog(); renderGarden(); }

/* ---------------- start ---------------- */
async function start() {
  loadState();
  initTop(); walk.start(); intro.start();
  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  document.addEventListener("submit", onSubmit);
  $("#moreRecipes").addEventListener("click", () => { allRecipes = true; renderRecipes(); });
  $("#moreLessons").addEventListener("click", () => { allLessons = true; renderCatalog(); });
  $("#labelsBtn").addEventListener("click", e => { showLabels = !showLabels; e.currentTarget.setAttribute("aria-pressed", showLabels); e.currentTarget.textContent = showLabels ? "Hide names" : "Show all names"; $("#map").classList.toggle("labels", showLabels); });
  $("#monitorBtn").addEventListener("click", () => { const v = $("#deskDirector video"); if (v) { v.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "center" }); wireVideo(v); v.play().catch(() => {}); } });
  $("#ytDlg").addEventListener("close", () => { $("#ytFrame").innerHTML = ""; });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#bench").classList.contains("open") && !document.querySelector("dialog[open]")) closeBench(); });
  // keep keyboard focus inside the open bench
  $("#bench").addEventListener("keydown", e => {
    if (e.key !== "Tab") return; const f = $$("#bench button, #bench a[href], #bench input, #bench summary, #bench video, #bench [tabindex='0']").filter(x => x.offsetParent !== null);
    if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  addEventListener("popstate", route);
  await loadContent();
  renderAll(); initReveal(); route();
  // returning learners skip straight past the walk-in to the desk
  const d = D();
  if (d && d.seenWalk && !location.hash) $("#desk").scrollIntoView();
  if (d && !d.seenWalk) { d.seenWalk = true; save(); }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
