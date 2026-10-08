"use strict";
// Smoke-test harness (runs inside tools/smoke/wrapper.html, in headless Chrome).
// The app runs in a same-origin 375x812 iframe (headless Chrome won't go below ~500px wide itself). A scenario is
// an async function that gets a `t` helper: open a screen, press things with real DOM events, assert. Window
// errors, unhandled rejections and failed script loads inside the iframe are collected, and any of them fails the
// scenario. Results are written as JSON into <pre id=out>, which tools/smoke.sh reads back with --dump-dom.
(function () {
  const REG = [];
  window.scenario = (group, name, fn) => REG.push({ group, name, fn });

  const out = () => document.getElementById("out");
  const sleepReal = ms => new Promise(r => setTimeout(r, ms));
  class Fail extends Error {}

  class T {
    constructor(name) { this.name = name; this._errs = []; this.fails = []; this.frame = null; this.w = null; this.d = null; this.notes = []; }
    // errors from every frame this scenario opened (recorded inside the page by tools/smoke/capture.js)
    get errors() { return this._errs.concat((this.w && this.w.__smokeErrors) || []); }
    // ---- the page under test ----
    async open(hash = "", opt = {}) {
      this.close();
      if (!opt.keepState) { try { localStorage.clear(); } catch (e) {} }
      const f = document.createElement("iframe");
      document.body.appendChild(f);
      const w = f.contentWindow;
      this.frame = f; this.w = w;
      const loaded = new Promise(r => f.addEventListener("load", r, { once: true }));
      w.location.replace("/index.html" + hash);
      await loaded;
      this.w = f.contentWindow; this.d = this.w.document;
      // CSS animations and transitions run on the compositor's real clock, not the virtual one, so a sheet would
      // still be mid-slide when we look. Make them (nearly) instant; the app's own timers and logic are untouched.
      const st = this.d.createElement("style");
      st.textContent = "*,*::before,*::after{animation-duration:.001s!important;animation-delay:0s!important;transition-duration:.001s!important;transition-delay:0s!important;scroll-behavior:auto!important}";
      this.d.head.appendChild(st);
      await this.sleep(opt.settle != null ? opt.settle : 400);
      return this;
    }
    close() { if (this.frame) { try { this._errs.push(...(this.w.__smokeErrors || [])); } catch (e) {} this.frame.remove(); this.frame = null; this.w = null; } }
    // ---- reading ----
    $(sel, root) { return (root || this.d).querySelector(sel); }
    $$(sel, root) { return [...(root || this.d).querySelectorAll(sel)]; }
    text(sel, root) { const e = typeof sel === "string" ? this.$(sel, root) : sel; return e ? e.textContent.trim().replace(/\s+/g, " ") : ""; }
    // Chrome runs with a virtual clock (--virtual-time-budget), so timers cost no real time, but anything that needs
    // real time (a camera permission answer, image decoding, lazy data) only progresses while a real network
    // request is in flight. tick() is that: a tiny same-origin request the virtual clock has to wait for.
    sleep(ms) { return sleepReal(ms); }
    // wait until an element stops moving (a sheet sliding in, a page growing from a bubble)
    async stable(e, ms = 2500) {
      let last = "";
      for (let i = 0; i < ms / 40; i++) {
        const r = e.getBoundingClientRect(), k = [r.left, r.top, r.width, r.height].map(v => Math.round(v)).join();
        if (k === last) return true;
        last = k; await this.tick(); await this.sleep(40);
      }
      return false;
    }
    // (the server's Date header is the only real clock the page can see; Date.now() is virtual too)
    async tick() { try { const r = await fetch("/tools/smoke/wrapper.html", { method: "HEAD", cache: "no-store" }), d = Date.parse(r.headers.get("date")); if (d) this.realT = d; } catch (e) {} return this.realT; }
    // Gives up only when BOTH the virtual `ms` and `realMs` of real time have passed, so a slow machine or a busy
    // parallel run (camera permission, lazy data, image decoding) is not mistaken for a broken screen.
    async waitFor(what, ms = 8000, msg, realMs = 6000) {
      const fn = typeof what === "function" ? what : () => this.$(what);
      const t0 = Date.now(), r0 = await this.tick(); let v;
      for (;;) {
        try { v = fn(); } catch (e) { v = null; }
        if (v) return v;
        if (Date.now() - t0 > ms && (this.realT || 0) - (r0 || 0) >= realMs) throw new Fail(`timed out waiting for ${msg || (typeof what === "string" ? what : "condition")}`);
        await this.tick(); await this.sleep(25);
      }
    }
    // ---- asserting ----
    expect(cond, msg) { if (!cond) throw new Fail(msg); return cond; }
    check(cond, msg) { if (!cond) this.fails.push(msg); return !!cond; }   // soft: keeps going
    // ---- acting (real DOM events) ----
    el(x) {
      const e = typeof x === "string" ? this.$(x) : x;
      if (!e) throw new Fail(`no element for ${x}`);
      return e;
    }
    // is a real finger able to hit this element? (catches pointer-events:none, covered, off-screen buttons)
    reachable(e) {
      const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (!r.width || !r.height) return "has no size";
      if (cx < 0 || cy < 0 || cx > this.w.innerWidth || cy > this.w.innerHeight) return "is off screen";
      const hit = this.d.elementFromPoint(cx, cy);
      if (!hit || !(e === hit || e.contains(hit) || hit.contains(e))) return `is covered by <${hit && hit.tagName.toLowerCase()}${hit && hit.className ? "." + String(hit.className).split(" ")[0] : ""}>`;
      return "";
    }
    label(e, x) {
      if (typeof x === "string") return x;
      const d = [...e.attributes].find(a => a.name.startsWith("data-") || a.name === "id");
      return `${e.tagName.toLowerCase()}${d ? "[" + d.name + (d.value ? "=" + d.value.slice(0, 20) : "") + "]" : ""}${this.text(e) ? ' "' + this.text(e).slice(0, 24) + '"' : ""}`;
    }
    async click(x, opt = {}) {
      const e = this.el(x), label = this.label(e, x);
      if (!opt.force) {
        // a finger can only hit what is on screen and on top: give a sheet or a page up to ~2s to slide in, then fail
        let why = "";
        for (let i = 0; i < 40; i++) {
          try { e.scrollIntoView({ block: "center", inline: "nearest" }); } catch (er) {}
          why = this.reachable(e);
          if (!why) break;
          await this.tick(); await this.sleep(50);
        }
        if (why) throw new Fail(`${label} is not tappable: it ${why}`);
      }
      const r = e.getBoundingClientRect(), o = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, pointerType: "touch", isPrimary: true, view: this.w };
      if (opt.pointer) { e.dispatchEvent(new this.w.PointerEvent("pointerdown", o)); e.dispatchEvent(new this.w.PointerEvent("pointerup", o)); }
      e.click();
      await this.sleep(opt.wait != null ? opt.wait : 250);
      return e;
    }
    // a tap on a canvas (or anything) at viewport coordinates: pointerdown + pointerup, optionally held
    async tapAt(target, x, y, opt = {}) {
      const e = this.el(target), w = this.w;
      const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: "touch", isPrimary: true, view: w };
      e.dispatchEvent(new w.PointerEvent("pointerdown", o));
      if (opt.hold) await this.sleep(opt.hold);
      e.dispatchEvent(new w.PointerEvent("pointerup", o));
      await this.sleep(opt.wait != null ? opt.wait : 600);
    }
    pointerOn(sel) { const e = this.el(sel), r = e.getBoundingClientRect(); return { e, r, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }
    // run code inside the app (its globals live in the iframe's global scope: S, go, colorPage…)
    ev(code) { return this.w.eval(code); }
    // k items from arr, the same ones for the same seed (SMOKE_SEED, default today's date): random coverage that
    // changes daily but can always be replayed
    sample(arr, k, salt = "") {
      let h = 2166136261; for (const ch of (SMOKE.seed + salt)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
      const rnd = () => { h = (h + 0x6D2B79F5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a.slice(0, k);
    }
    snapshot() { return this.d.body ? this.d.body.innerText.slice(0, 160).replace(/\s+/g, " ") : ""; }
  }

  async function runOne(sc, only) {
    const t = new T(sc.name), t0 = Date.now();
    let status = "pass", msg = "";
    try {
      await Promise.race([sc.fn(t), new Promise((_, rej) => setTimeout(() => rej(new Fail("scenario timed out (120s)")), 120000))]);
    } catch (e) {
      status = "fail"; msg = e instanceof Fail ? e.message : `exception in scenario: ${e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e}`;
    }
    if (t.fails.length) { status = "fail"; msg = (msg ? msg + "; " : "") + t.fails.join("; "); }
    if (t.errors.length) { status = "fail"; msg = (msg ? msg + " || " : "") + "page errors: " + [...new Set(t.errors)].slice(0, 4).join(" ## "); }
    t.close();
    return { group: sc.group, name: sc.name, status, msg, ms: Date.now() - t0, notes: t.notes };
  }

  window.SMOKE = {
    registry: REG,
    seed: new URLSearchParams(location.search).get("seed") || new Date().toISOString().slice(0, 10),
    async runFromQuery() {
      const q = new URLSearchParams(location.search), g = q.get("g"), only = q.get("only");
      if (q.get("probe")) {   // development aid: run a throwaway script (tools/smoke/_probe.js, never committed) with a `t`
        await new Promise(r => { const s = document.createElement("script"); s.src = "/tools/smoke/" + q.get("probe"); s.onload = s.onerror = r; document.head.appendChild(s); });
        const t = new T("probe");
        let res; try { res = await window.PROBE(t); } catch (e) { res = "PROBE ERROR " + (e && e.stack || e); }
        out().textContent = JSON.stringify({ done: true, results: [], probe: res, errors: t.errors });
        return;
      }
      const list = REG.filter(s => (!g || s.group === g) && (!only || only.split(",").includes(s.name)));
      const results = [];
      out().textContent = "running";
      for (const sc of list) {
        results.push(await runOne(sc));
        out().textContent = JSON.stringify({ done: false, results });
      }
      out().textContent = JSON.stringify({ done: true, results });
    },
  };
})();
