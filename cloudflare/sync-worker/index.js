// Chromatlas sync (David, 2026-10-30): "Sign in with Google" keeps one progress save per person.
//   POST   /auth  {idToken}  -> verifies the Google sign-in, returns {token, email, exp}   (token: this Worker's own 180-day session)
//   GET    /sync  (Bearer token)  -> {save, at}        the stored save, or {save:null}
//   PUT    /sync  (Bearer token, body {save})          replaces the stored save (the app merges before it writes)
//   DELETE /sync  (Bearer token)                       erases the person's save
// The Worker never reads the save; it stores it under the Google account id in KV. Secrets: SESSION_SECRET (wrangler secret).
const CLIENT_ID = "1024768595977-4b0iv66mlkla1b8a5dmjb87kdlfe8q4o.apps.googleusercontent.com";
const ORIGINS = ["https://chromatlas.app", "https://www.chromatlas.app", "https://dmekibel.github.io", "http://localhost:8811"];
const MAX_SAVE = 4_000_000, SESSION_DAYS = 180;
const enc = new TextEncoder();
const b64u = u8 => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

function cors(req) {
  const o = req.headers.get("Origin");
  return { "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0], "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS", "Vary": "Origin", "Cache-Control": "no-store" };
}
const json = (req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

async function hmacKey(env) { return crypto.subtle.importKey("raw", enc.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); }
async function mint(env, sub, email) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400, body = b64u(enc.encode(JSON.stringify({ sub, email, exp })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(body)));
  return { token: body + "." + b64u(sig), exp };
}
async function session(req, env) {
  const m = /^Bearer (.+)\.(.+)$/.exec(req.headers.get("Authorization") || ""); if (!m) return null;
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(env), unb64u(m[2]), enc.encode(m[1]));
  if (!ok) return null;
  const p = JSON.parse(new TextDecoder().decode(unb64u(m[1])));
  return p.exp > Date.now() / 1000 ? p : null;
}
// Google's ID token: RS256 JWT; check signature against Google's published keys, audience, issuer and expiry
async function googleUser(idToken) {
  const [h, p, s] = String(idToken).split("."); if (!s) return null;
  const head = JSON.parse(new TextDecoder().decode(unb64u(h))), pay = JSON.parse(new TextDecoder().decode(unb64u(p)));
  if (head.alg !== "RS256" || pay.aud !== CLIENT_ID || !["https://accounts.google.com", "accounts.google.com"].includes(pay.iss) || pay.exp < Date.now() / 1000 || !pay.email_verified) return null;
  const keys = (await (await fetch("https://www.googleapis.com/oauth2/v3/certs", { cf: { cacheTtl: 3600 } })).json()).keys;
  const jwk = keys.find(k => k.kid === head.kid); if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  return (await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, unb64u(s), enc.encode(h + "." + p))) ? { sub: pay.sub, email: pay.email } : null;
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
    const path = new URL(req.url).pathname.replace(/\/+$/, "");
    if (!ORIGINS.includes(req.headers.get("Origin") || "")) return json(req, { error: "origin" }, 403);
    try {
      if (path === "/auth" && req.method === "POST") {
        const u = await googleUser((await req.json()).idToken);
        return u ? json(req, { ...(await mint(env, u.sub, u.email)), email: u.email }) : json(req, { error: "google" }, 401);
      }
      if (path === "/sync") {
        const me = await session(req, env); if (!me) return json(req, { error: "session" }, 401);
        const k = "u:" + me.sub;
        if (req.method === "GET") { const v = await env.SAVES.get(k, "json"); return json(req, v || { save: null }); }
        if (req.method === "PUT") {
          const text = await req.text(); if (text.length > MAX_SAVE) return json(req, { error: "size" }, 413);
          const save = JSON.parse(text).save; if (!save || typeof save !== "object" || !save.cards) return json(req, { error: "shape" }, 400);
          const at = Date.now(); await env.SAVES.put(k, JSON.stringify({ save, at })); return json(req, { ok: true, at });
        }
        if (req.method === "DELETE") { await env.SAVES.delete(k); return json(req, { ok: true }); }
      }
    } catch (e) { return json(req, { error: "bad request" }, 400); }
    return json(req, { error: "not found" }, 404);
  },
};
