// Sign in with Google, sync across devices (David, 2026-10-30). Optional: the app works the same without it.
// The sign-in lives in its own localStorage key (never inside S, so it can't travel in a backup or merge into another device).
// Sync = pull the cloud save, merge it into this device with mergeProgress (js/learn.js; nothing on either side is lost), push the merged result.
// Known limit: a merge is a union, so something removed on one device (an unliked painting) comes back from the other.
const SYNC_URL = "https://chromatlas-sync.dmekibel.workers.dev", SYNC_KEY = "chromatlas-sync", SYNC_CLIENT = "1024768595977-4b0iv66mlkla1b8a5dmjb87kdlfe8q4o.apps.googleusercontent.com";
let syncBusy = false, syncLast = "";

const syncGet = () => { try { const v = JSON.parse(localStorage.getItem(SYNC_KEY) || "null"); return v && v.token && v.exp > Date.now() / 1000 ? v : null; } catch (e) { return null; } };
const syncSet = v => { try { v ? localStorage.setItem(SYNC_KEY, JSON.stringify(v)) : localStorage.removeItem(SYNC_KEY); } catch (e) {} };
const syncCanon = v => JSON.stringify(v, (k, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, q) => (o[q] = x[q], o), {}) : x);

async function syncCall(method, path, body, token) {
  const r = await fetch(SYNC_URL + path, { method, headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}), body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { const e = new Error("sync " + r.status); e.status = r.status; throw e; }
  return r.json();
}
// pull, merge, push. quiet: no toast when nothing changed
async function syncNow(quiet) {
  const me = syncGet(); if (!me || syncBusy || !navigator.onLine) return;
  syncBusy = true;
  try {
    const cloud = await syncCall("GET", "/sync", null, me.token), before = syncCanon(S);
    if (cloud.save) {
      const d = migrateState(cloud.save);
      if (d && d.cards && syncCanon(d) !== before) {
        try { localStorage.setItem(KEY + "-before-merge", JSON.stringify(S)); } catch (e) {}
        S = migrateState(mergeProgress(S, d)); pickMigrate(S); save();
      }
    }
    const now = syncCanon(S);
    if (!cloud.save || now !== syncCanon(cloud.save)) await syncCall("PUT", "/sync", { save: S }, me.token);
    syncLast = now;
    if (!quiet || now !== before) toast(now !== before ? "Synced: your other device's progress is here" : "Synced");
  } catch (e) {
    if (e.status === 401) { syncSet(null); toast("Signed out. Sign in again to keep syncing."); }
    else if (!quiet) toast("Couldn't sync. Your progress is safe on this device.");
  }
  syncBusy = false;
}

const syncGid = () => window.google && window.google.accounts && window.google.accounts.id;
function syncLoadGoogle() {
  return new Promise((ok, no) => {
    if (syncGid()) return ok();
    const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = ok; s.onerror = () => no(new Error("google")); document.head.appendChild(s);
  });
}
async function syncSignInSheet() {
  const { sh, close } = sheet(`<div class="mn-sheet">${mnHead("Sign in", { close: true })}
    <p class="mn-body">Sign in with Google and your colors, kept paintings and palettes follow you to every device. It is optional: Chromatlas works the same without it.</p>
    <div data-gbtn style="display:flex;justify-content:center;min-height:44px;margin:14px 0"></div>
    <p class="fine" data-gerr role="status"></p>
    <p class="fine">We store your progress and your Google email, nothing else, and never share it. You can erase it any time from Settings.</p></div>`);
  sh.querySelector("[data-mn-close]").onclick = () => close();
  const err = sh.querySelector("[data-gerr]");
  try {
    await syncLoadGoogle();
    syncGid().initialize({
      client_id: SYNC_CLIENT,
      callback: async resp => {
        try {
          const a = await syncCall("POST", "/auth", { idToken: resp.credential });
          syncSet({ token: a.token, exp: a.exp, email: a.email }); close(); toast("Signed in as " + a.email); syncNow(false);
        } catch (e) { err.textContent = "Google accepted you, but we couldn't finish signing in. Try again in a minute."; }
      },
    });
    syncGid().renderButton(sh.querySelector("[data-gbtn]"), { theme: "outline", size: "large", text: "continue_with", shape: "pill", width: 280 });
  } catch (e) { err.textContent = "Couldn't reach Google. Check your connection and try again."; }
}
function syncRows() {
  const me = syncGet();
  return me ? [{ k: "syncnow", lead: YM_I.up, label: "Sync now", sub: "Signed in as " + esc(me.email) },
              { k: "signout", lead: YM_I.path, label: "Sign out", sub: "Your progress stays on this device" },
              { k: "syncerase", lead: YM_I.trash, label: "Erase my cloud copy", danger: true }]
            : [{ k: "signin", lead: YM_I.up, label: "Sign in with Google", sub: "Keep your progress on every device" }];
}
async function syncClick(k) {
  if (k === "signin") return syncSignInSheet();
  if (k === "syncnow") return syncNow(false);
  if (k === "signout") { syncSet(null); return toast("Signed out"); }
  if (k === "syncerase") {
    const yes = await mnConfirm({ title: "Erase your cloud copy?", body: "This deletes the copy stored with your Google account. Progress on your devices is not touched, and you stay signed in.", yes: "Erase cloud copy", no: "Keep it", danger: true });
    if (!yes) return;
    try { await syncCall("DELETE", "/sync", null, syncGet().token); toast("Cloud copy erased"); } catch (e) { toast("Couldn't reach the cloud. Try again."); }
  }
}
// pull on open and when the app comes back to the front; push a minute after anything changed
window.addEventListener("load", () => setTimeout(() => syncNow(true), 4000));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") syncNow(true); });
setInterval(() => { if (document.visibilityState === "visible" && syncGet() && syncCanon(S) !== syncLast) syncNow(true); }, 60000);
