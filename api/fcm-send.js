import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const { fcmToken } = body || {};

  if (!fcmToken) {
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

    const result = await getMessaging().send({
      token: fcmToken,
      notification: {
        title: "Minutics",
        body: "Test alert: notifications are working.",
      },
      webpush: {
        fcmOptions: { link: "https://app.minutics.com" },
        notification: {
          title: "Minutics",
          body: "Test alert: notifications are working.",
          icon: "https://app.minutics.com/favicon.png",
          badge: "https://app.minutics.com/favicon.png",
          tag: "minutics-notification-test",
          requireInteraction: true,
        },
      },
    });

    res.status(200).json({ ok: true, messageId: result });
  } catch (e) {
    console.error("FCM send error:", e);
    res.status(500).json({ error: e.message });
  }
}
