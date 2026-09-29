// Single-device session enforcement.
//
// POST /api/session  { deviceId }  (Authorization: Bearer <Firebase ID token>)
//
// Stores the calling device's id in the user's Firebase custom claim
// `sessionDevice` (merged with existing claims, e.g. the telegram schedule).
// The claim is the registry — no extra database needed. Clients poll their
// own token every minute; if `sessionDevice` names a different device they
// sign themselves out (last login wins).
//
// Part of the Vercel Hobby 12-function budget (kept small on purpose).

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

const CLAIM_BUDGET = 960; // Firebase custom-claims limit is ~1000 bytes

function sizeOf(obj) {
  try { return new TextEncoder().encode(JSON.stringify(obj)).length; } catch { return 0; }
}

function fitClaims(claims) {
  if (sizeOf(claims) <= CLAIM_BUDGET) return claims;
  // Trim the same free-text field the telegram store endpoint trims.
  if (typeof claims.tgs === "object" && claims.tgs && typeof claims.tgs.x === "string") {
    let x = claims.tgs.x;
    while (sizeOf(claims) > CLAIM_BUDGET && x.length > 40) {
      x = x.slice(0, Math.max(40, Math.floor(x.length * 0.7)));
      claims.tgs = Object.assign({}, claims.tgs, { x });
    }
  }
  if (sizeOf(claims) > CLAIM_BUDGET && typeof claims.tgs === "object" && claims.tgs) {
    const tgs = Object.assign({}, claims.tgs);
    delete tgs.x;
    claims = Object.assign({}, claims, { tgs });
  }
  return claims;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Method not allowed" }); return; }

  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) { res.status(401).json({ ok: false, error: "Missing authorization token" }); return; }

  let uid, authApi;
  try {
    authApi = getAuth(getAdminApp());
    const decoded = await authApi.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    res.status(401).json({ ok: false, error: "Invalid or expired token" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const deviceId = body && typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(deviceId)) {
    res.status(400).json({ ok: false, error: "Invalid deviceId" });
    return;
  }

  try {
    const user = await authApi.getUser(uid);
    const claims = Object.assign({}, user.customClaims || {});
    if (claims.sessionDevice === deviceId) {
      res.status(200).json({ ok: true, claimed: false });
      return;
    }
    claims.sessionDevice = deviceId;
    const fitted = fitClaims(claims);
    await authApi.setCustomUserClaims(uid, fitted);
    res.status(200).json({ ok: true, claimed: true });
  } catch (e) {
    console.error("session claim failed:", e && e.message);
    res.status(500).json({ ok: false, error: "Could not claim session" });
  }
}
