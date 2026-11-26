// Play Store reviewer demo sign-in. Credentials live ONLY in Vercel env
// (REVIEW_EMAIL / REVIEW_PASSWORD), never in the app bundle. The app posts
// entered credentials here; we return whether they match. No session is
// created on the server — the app opens its local full-access demo mode.
import { setCors } from "../lib/cors.js";

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ ok:false }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const envEmail = (process.env.REVIEW_EMAIL || "").trim().toLowerCase();
  const envPass = process.env.REVIEW_PASSWORD || "";
  if (!envEmail || !envPass) { res.status(200).json({ ok:false }); return; } // not configured

  const email = String(body.email || "").trim().toLowerCase();
  const pass = String(body.password || "");
  // constant-time-ish compare
  const match = email === envEmail && pass.length === envPass.length && pass === envPass;
  res.status(200).json({ ok: match });
}
