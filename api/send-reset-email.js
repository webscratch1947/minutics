// Sends password-reset emails through Brevo instead of Firebase's default
// mailer. Runs on Vercel, never in the browser — Brevo API key and the
// Firebase Admin service-account credentials are never exposed to clients.
//
// Flow: Firebase Admin generates the actual reset link (this requires
// Admin SDK privileges, so it must happen server-side) → we email that
// link ourselves via Brevo's transactional email API.

import admin from "firebase-admin";

const BREVO_SENDER_NAME = "Minutics";

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel env vars store newlines as literal "\n" — convert back.
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

export default async function handler(req, res) {
  // The Android app's WebView serves pages from https://app.local, a
  // different origin than app.minutics.com, so browsers/WebView require
  // this endpoint to explicitly opt in via CORS headers, and to answer the
  // preflight OPTIONS request the browser sends first for a JSON POST.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const brevoKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!brevoKey || !senderEmail) {
    res.status(500).json({ error: "Server missing BREVO_API_KEY or BREVO_SENDER_EMAIL" });
    return;
  }
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    res.status(500).json({ error: "Server missing Firebase Admin credentials" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  const email = (body && body.email || "").trim();
  if (!email) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  // Always respond with the same generic success message, whether or not
  // the account exists — never let this endpoint confirm/deny an email
  // is registered.
  const genericOk = () => res.status(200).json({ ok: true });

  try {
    const app = getAdminApp();
    const resetLink = await admin.auth(app).generatePasswordResetLink(email);

    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: BREVO_SENDER_NAME, email: senderEmail },
        to: [{ email }],
        subject: "Reset your Minutics password",
        htmlContent:
          "<p>Someone requested a password reset for this Minutics account.</p>" +
          '<p><a href="' + resetLink + '">Click here to reset your password</a></p>' +
          "<p>If you didn't request this, you can safely ignore this email.</p>",
      }),
    });

    genericOk();
  } catch (e) {
    // user-not-found (and similar) still returns the generic success —
    // only genuine server/config failures should look different in logs.
    if (e && e.code === "auth/user-not-found") {
      genericOk();
      return;
    }
    console.error("send-reset-email failed:", e);
    genericOk();
  }
}
