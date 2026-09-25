// Daily-report scheduler — invoked every few minutes by an EXTERNAL cron
// service (cron-job.org etc.) because the Vercel Hobby plan only allows one
// built-in cron run per day at a random minute. The client detects this
// endpoint being alive via a "beacon" timestamp stored in the user's
// Firebase custom claims (tgs.b) and then defers sending to us.
//
// Auth: if the CRON_SECRET env var is set, require `Authorization: Bearer
// <secret>` (set the same header in the external scheduler). If it is not
// set the endpoint stays open — it can only send a report that is actually
// DUE for a user, and it stores state in Firebase claims, so an outsider
// gains nothing by calling it.
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

function pad(n) { return (n < 10 ? "0" : "") + n; }

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || "";
    if (auth !== "Bearer " + secret) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }
  }

  let authApi;
  try {
    authApi = getAuth(getAdminApp());
  } catch {
    res.status(500).json({ ok: false, error: "Firebase admin not configured" });
    return;
  }

  const now = Date.now();
  let checked = 0;
  let sent = 0;
  let failed = 0;
  let pageToken;

  try {
    do {
      const page = await authApi.listUsers(1000, pageToken);
      for (const user of page.users) {
        const claims = user.customClaims || {};
        const tgs = claims.tgs;
        if (!tgs || !tgs.k || !tgs.c || !tgs.t) continue;
        checked++;

        /* User-local clock: client tzOffset = UTC − local (minutes), so
           local = UTC − offset. Read the shifted clock with getUTC* so the
           server's own (UTC) zone doesn't shift it again. */
        const tz = Number(tgs.z) || 0;
        const local = new Date(now - tz * 60000);
        const date =
          local.getUTCFullYear() + "-" +
          pad(local.getUTCMonth() + 1) + "-" +
          pad(local.getUTCDate());
        const hhmm = pad(local.getUTCHours()) + ":" + pad(local.getUTCMinutes());

        /* One report per (day, configured time) — same semantics as the
           client: changing the time the same day re-arms the report. */
        const due =
          hhmm >= tgs.t &&
          (tgs.sd !== date || tgs.st !== tgs.t);
        /* Back off 10 min after a Telegram failure so a bad token doesn't
           get hammered every cron run. */
        const inBackoff = tgs.fp && now - tgs.fp < 10 * 60 * 1000;

        const next = Object.assign({}, tgs);
        next.b = now; /* heartbeat: tells clients this scheduler is alive */

        if (due && !inBackoff) {
          try {
            const tgRes = await fetch(
              "https://api.telegram.org/bot" + tgs.k + "/sendMessage",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: tgs.c,
                  text: tgs.x || "📊 Daily Report — no data synced yet. Open Minutics once to refresh.",
                }),
              }
            );
            const data = await tgRes.json().catch(function () { return null; });
            if (data && data.ok) {
              next.sd = date;
              next.st = tgs.t;
              next.fp = null;
              sent++;
            } else {
              next.fp = now;
              failed++;
            }
          } catch {
            next.fp = now;
            failed++;
          }
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
}
