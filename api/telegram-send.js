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

  /* ── Verify Firebase Auth token ──────────────────────────────────────── */
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  try {
    const app = getAdminApp();
    await getAuth(app).verifyIdToken(idToken);
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const { token, chatId, text } = body || {};

  if (!token || !chatId || !text) {
    res.status(400).json({ error: "Missing token, chatId, or text" });
    return;
  }

  try {
    const tgRes = await fetch(
      "https://api.telegram.org/bot" + token + "/sendMessage",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      }
    );
    const data = await tgRes.json();
    res.status(tgRes.status).json(data);
  } catch {
    res.status(502).json({ ok: false, description: "Could not reach Telegram" });
  }
}
