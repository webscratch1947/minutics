// Stores the user's Telegram report schedule + latest report snapshot in
// their Firebase custom claims (key `tgs`). The cron endpoint
// (/api/telegram-cron) reads these claims to send the daily report while
// the user's browser/app is closed. Claims are per-user, ≤ ~1 KB, and are
// deleted again when the user disconnects.
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

/* Firebase caps ALL custom claims at 1000 bytes JSON — keep tgs ≤ ~900. */
const MAX_CLAIM_BYTES = 900;

function fitClaims(tgs) {
  const over = () =>
    Buffer.byteLength(JSON.stringify(tgs), "utf8") - MAX_CLAIM_BYTES;
  if (over() <= 0) return tgs;
  /* Shrink the report text first, keeping head + tail (totals live at the
     end of the report). Each pass removes `cut` chars from the middle. */
  if (typeof tgs.x === "string") {
    let x = tgs.x;
    while (over() > 0 && x.length > 80) {
      const cut = Math.min(x.length - 60, Math.max(16, Math.ceil(over() * 1.5)));
      if (cut < 16) break;
      const head = Math.max(30, Math.floor((x.length - cut) / 2));
      x = x.slice(0, head) + "\n…\n" + x.slice(head + cut);
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  let uid;
  let authApi;
  try {
    authApi = getAuth(getAdminApp());
    const decoded = await authApi.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  body = body || {};

  try {
    const user = await authApi.getUser(uid);
    const claims = Object.assign({}, user.customClaims || {});
    const existing = claims.tgs || {};

    const connected = !!body.connected && !!body.token && !!body.chatId;
    if (!connected) {
      if (claims.tgs) {
        delete claims.tgs;
        await authApi.setCustomUserClaims(uid, claims);
      }
      res.status(200).json({ ok: true, removed: true });
      return;
    }

    const time = normalizeTime(body.time);
    if (!time) {
      res.status(400).json({ error: "Invalid report time" });
      return;
    }

    let text = typeof body.text === "string" ? body.text : "";
    if (!text) text = "📊 Daily Report — no data synced yet. Open Minutics once to refresh.";

    const tgs = {
      k: String(body.token).slice(0, 200),
      c: String(body.chatId).slice(0, 100),
      t: time,
      z: Math.round(Number(body.tzOffset) || 0),
      x: text,
      /* Carry forward server-side state (dedup marker, failure backoff,
         heartbeat) unless the client reports a fresher last-sent pair. */
      sd: body.lastSentDate ? String(body.lastSentDate).slice(0, 40) : (existing.sd || ""),
      st: body.lastSentTime ? String(body.lastSentTime).slice(0, 40) : (existing.st || ""),
      fp: existing.fp || null,
      b: existing.b || 0,
    };
    if (!tgs.fp) delete tgs.fp;

    claims.tgs = fitClaims(tgs);
    await authApi.setCustomUserClaims(uid, claims);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Store failed: " + String((e && e.message) || e) });
  }
}
