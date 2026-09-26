// Combined Telegram server-side endpoints — stays within Vercel Hobby 12-function limit.
// Routes (all under /api/telegram):
//   POST { action: "store", ... }  → saves schedule to user's Firebase custom claims
//   GET  ?action=cron              → runs daily-report scheduler (external cron hits this)
//   POST { action: "send", ... }   → sends a Telegram message (legacy /api/telegram-send compat)
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || "lifetime-a4bde",
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}
const MAX_CLAIM_BYTES = 900;

function fitClaims(tgs) {
  const over = () => new TextEncoder().encode(JSON.stringify(tgs)).length - MAX_CLAIM_BYTES;
  if (over() <= 0) return tgs;
  if (typeof tgs.x === "string") {
    let x = tgs.x;
    while (over() > 0 && x.length > 80) {
      const cut = Math.min(x.length - 60, Math.max(16, Math.ceil(over() * 1.5)));
      if (cut < 16) break;
      const head = Math.max(30, Math.floor((x.length - cut) / 2));
      x = x.slice(0, head) + "\n\u2026\n" + x.slice(head + cut);
    }
    tgs.x = x;
  }
  if (over() > 0) tgs.x = String(tgs.x || "").slice(0, 60);
  return tgs;
}

function normalizeTime(t) {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(String(t || "").trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  if (h > 23 || mi > 59) return null;
  return (h < 10 ? "0" : "") + h + ":" + (mi < 10 ? "0" : "") + mi;
}

function pad(n) { return (n < 10 ? "0" : "") + n; }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const action = req.method === "POST" ? req.body?.action : req.query?.action;

  if (action === "store") {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!idToken) { res.status(401).json({ error: "Missing authorization token" }); return; }

    let uid, authApi;
    try {
      authApi = getAuth(getAdminApp());
      const decoded = await authApi.verifyIdToken(idToken);
      uid = decoded.uid;
    } catch { res.status(401).json({ error: "Invalid or expired token" }); return; }

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
    body = body || {};

    try {
      const user = await authApi.getUser(uid);
      const claims = Object.assign({}, user.customClaims || {});
      const existing = claims.tgs || {};

      const connected = !!body.connected && !!body.token && !!body.chatId;
      if (!connected) {
        if (claims.tgs) { delete claims.tgs; await authApi.setCustomUserClaims(uid, claims); }
        res.status(200).json({ ok: true, removed: true });
        return;
      }

      const time = normalizeTime(body.time);
      if (!time) { res.status(400).json({ error: "Invalid report time" }); return; }

      let text = typeof body.text === "string" ? body.text : "";
      if (!text) text = "📊 Daily Report — no data synced yet. Open Minutics once to refresh.";

      const tgs = {
        k: String(body.token).slice(0, 200),
        c: String(body.chatId).slice(0, 100),
        t: time,
        z: Math.round(Number(body.tzOffset) || 0),
        x: text,
        sd: body.lastSentDate ? String(body.lastSentDate).slice(0, 40) : (existing.sd || ""),
        st: body.lastSentTime ? String(body.lastSentTime).slice(0, 40) : (existing.st || ""),
        fp: existing.fp || null,
        b: existing.b || 0,
      };
      if (!tgs.fp) delete tgs.fp;

      claims.tgs = fitClaims(tgs);
      await authApi.setCustomUserClaims(uid, claims);
      res.status(200).json({ ok: true });
      return;
    } catch (e) {
      res.status(500).json({ error: "Store failed: " + String((e && e.message) || e) });
      return;
    }
  }

  if (action === "cron") {
    if (req.method !== "GET") { res.status(405).json({ ok: false, error: "Method not allowed" }); return; }

    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = req.headers.authorization || "";
      if (auth !== "Bearer " + secret) { res.status(401).json({ ok: false, error: "Unauthorized" }); return; }
    }

    let authApi;
    try { authApi = getAuth(getAdminApp()); } catch { res.status(500).json({ ok: false, error: "Firebase admin not configured" }); return; }

    const now = Date.now();
    let checked = 0, sent = 0, failed = 0, pageToken;
    try {
      do {
        const page = await authApi.listUsers(1000, pageToken);
        for (const user of page.users) {
          const claims = user.customClaims || {};
          const tgs = claims.tgs;
          if (!tgs || !tgs.k || !tgs.c || !tgs.t) continue;
          checked++;
          const tz = Number(tgs.z) || 0;
          const local = new Date(now - tz * 60000);
          const date = local.getUTCFullYear() + "-" + pad(local.getUTCMonth() + 1) + "-" + pad(local.getUTCDate());
          const hhmm = pad(local.getUTCHours()) + ":" + pad(local.getUTCMinutes());
          /* Send only once the scheduled time is at least 2 minutes past:
             the device's exact-time native alarm gets the first shot at
             hh:mm:00, and it marks the report here (action=mark) so this
             cron skips instead of double-sending. */
          const tParts = tgs.t.split(":");
          const tMin = parseInt(tParts[0], 10) * 60 + parseInt(tParts[1], 10);
          const nowMin = local.getUTCHours() * 60 + local.getUTCMinutes();
          const due = nowMin >= Math.min(tMin + 2, 1439) && (tgs.sd !== date || tgs.st !== tgs.t);
          const inBackoff = tgs.fp && now - tgs.fp < 10 * 60 * 1000;
          const next = Object.assign({}, tgs); next.b = now;
          if (due && !inBackoff) {
            try {
              const tgRes = await fetch("https://api.telegram.org/bot" + tgs.k + "/sendMessage", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: tgs.c, text: tgs.x || "📊 Daily Report — no data synced yet. Open Minutics once to refresh." })
              });
              const data = await tgRes.json().catch(function () { return null; });
              if (data && data.ok) { next.sd = date; next.st = tgs.t; next.fp = null; sent++; }
              else { next.fp = now; failed++; }
            } catch { next.fp = now; failed++; }
          }
          await authApi.setCustomUserClaims(user.uid, Object.assign({}, claims, { tgs: next }));
        }
        pageToken = page.pageToken;
      } while (pageToken);
    } catch (e) {
      res.status(500).json({ ok: false, error: "listUsers/claims failed", detail: String(e && e.message || e), checked, sent, failed });
      return;
    }
    res.status(200).json({ ok: true, checked, sent, failed });
    return;
  }

  if (action === "send") {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!idToken) { res.status(401).json({ error: "Missing authorization token" }); return; }

    let authApi;
    try {
      authApi = getAuth(getAdminApp());
      await authApi.verifyIdToken(idToken);
    } catch { res.status(401).json({ error: "Invalid or expired token" }); return; }

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
    const { token, chatId, text } = body || {};

    if (!token || !chatId || !text) {
      res.status(400).json({ error: "Missing token, chatId, or text" });
      return;
    }

    try {
      const tgRes = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" })
      });
      const data = await tgRes.json();
      res.status(tgRes.status).json(data);
      return;
    } catch {
      res.status(502).json({ ok: false, description: "Could not reach Telegram" });
      return;
    }
  }

  if (action === "state" || action === "mark") {
    /* Auth = possession of the bot token (same secret used to send).
       state → read the last-sent markers; mark → set them after a
       device-side send, so this cron and other devices skip. */
    if (action === "state" && req.method !== "GET") { res.status(405).json({ ok: false, error: "Method not allowed" }); return; }
    if (action === "mark" && req.method !== "POST") { res.status(405).json({ ok: false, error: "Method not allowed" }); return; }

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
    body = body || {};
    const k = action === "state" ? req.query.k : body.k;
    if (!k) { res.status(400).json({ ok: false, error: "Missing bot token" }); return; }

    let authApi;
    try { authApi = getAuth(getAdminApp()); } catch { res.status(500).json({ ok: false, error: "Firebase admin not configured" }); return; }

    let pageToken, tgs = null;
    try {
      do {
        const page = await authApi.listUsers(1000, pageToken);
        for (const user of page.users) {
          const claims = user.customClaims || {};
          if (claims.tgs && claims.tgs.k === k) {
            tgs = claims.tgs;
            if (action === "mark") {
              const sd = String(body.sd || "").slice(0, 40);
              if (sd) {
                const next = Object.assign({}, tgs);
                next.sd = sd;
                next.st = String(body.st || tgs.t).slice(0, 40);
                await authApi.setCustomUserClaims(user.uid, Object.assign({}, claims, { tgs: next }));
                tgs = next;
              }
            }
            break;
          }
        }
        if (tgs) break;
        pageToken = page.pageToken;
      } while (pageToken);
    } catch (e) {
      res.status(500).json({ ok: false, error: "Lookup failed: " + String((e && e.message) || e) });
      return;
    }
    if (!tgs) { res.status(404).json({ ok: false, error: "No schedule found for this token" }); return; }
    res.status(200).json({ ok: true, sd: tgs.sd || "", st: tgs.st || "", t: tgs.t || "" });
    return;
  }

  if (action === "health") {
    /* Liveness probe ONLY — never touches Firebase claims, so testing this
       endpoint can't fake the tgs.b heartbeat and disarm the phone alarm. */
    if (req.method !== "GET") { res.status(405).json({ ok: false, error: "Method not allowed" }); return; }
    res.status(200).json({ ok: true, ts: Date.now() });
    return;
  }

  res.status(400).json({ error: "Missing or invalid action (expected 'store', 'cron', 'send', 'state', 'mark', or 'health')" });
}