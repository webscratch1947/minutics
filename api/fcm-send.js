import { setCors } from "../lib/cors.js";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

/* The one topic every device's service worker subscribes to (page calls
   action:"subscribe" once per token). A GitHub Actions cron pings it every
   10 minutes; each SW reads its own local state mirror (IndexedDB, written
   by the page's 60s heartbeat) and decides — and shows — locally. That is
   how closed-app idle / Time Waste alerts work on the web without any
   per-user server state. Payload is FIXED here: callers can never put
   arbitrary title/body in front of every subscriber. */
const CHECK_TOPIC = "minutics-check";

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const { fcmToken, action, topic } = body || {};

  const isSubscribe = action === "subscribe";
  if ((!fcmToken && !topic) || (isSubscribe && !fcmToken)) {
    res.status(400).json({ error: "Missing fcmToken" });
    return;
  }

  try {
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID || "lifetime-a4bde",
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        }),
      });
    }
    const m = getMessaging();

    /* Page boot: put this device's token on the check topic (idempotent). */
    if (isSubscribe) {
      const r = await m.subscribeToTopic([fcmToken], CHECK_TOPIC);
      res.status(200).json({ ok: true, topic: CHECK_TOPIC, results: r });
      return;
    }

    /* Silent 10-min heartbeat from the cron — server-chosen payload only. */
    if (topic) {
      if (topic !== CHECK_TOPIC) { res.status(400).json({ error: "Unknown topic" }); return; }
      const result = await m.send({
        topic: CHECK_TOPIC,
        data: {
          check: "1",
          tag: "minutics-bg",
          link: "https://app.minutics.com"
        }
      });
      res.status(200).json({ ok: true, messageId: result });
      return;
    }

    /* Settings → "Test notification": one explicit device. */
    const result = await m.send({
      token: fcmToken,
      data: {
        title: "Minutics",
        body: "Test alert: notifications are working.",
        tag: "minutics-notification-test",
        link: "https://app.minutics.com"
      }
    });

    res.status(200).json({ ok: true, messageId: result });
  } catch (e) {
    console.error("FCM send error:", e);
    res.status(500).json({ error: e.message });
  }
}
