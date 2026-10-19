// Pi auth — ONE serverless function for login, session check and logout.
// (The Vercel Hobby plan caps this project at 12 functions; `me` and `logout`
// used to be separate files and are now dispatched via ?action=..., kept
// reachable at their original URLs by rewrites in vercel.json:
//
//   POST /api/pi/auth                    → verify Pi access token, set cookie
//   GET  /api/pi/auth?action=me          → check the session cookie (was /api/pi/auth/me)
//   POST /api/pi/auth?action=logout      → clear the cookie          (was /api/pi/auth/logout)
//
// The Pi app's front end still calls the original paths unchanged.

import crypto from "crypto";

const PI_API_BASE = "https://api.minepi.com/v2";

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

function getQuery(req) {
  if (req.query && typeof req.query === "object") return req.query;
  try {
    return Object.fromEntries(new URL(req.url || "/", "http://local").searchParams);
  } catch {
    return {};
  }
}

function createSessionToken(userId) {
  const secret = process.env.PI_SESSION_SECRET;
  if (!secret) throw new Error("PI_SESSION_SECRET not configured");
  const payload = JSON.stringify({ userId, iat: Date.now() });
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const sig = hmac.digest("hex");
  return Buffer.from(payload).toString("base64") + "." + sig;
}

function verifySessionToken(token) {
  const secret = process.env.PI_SESSION_SECRET;
  if (!secret || !token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const payload = Buffer.from(parts[0], "base64").toString("utf-8");
    const sig = parts[1];
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const expectedSig = hmac.digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"))) {
      return null;
    }
    const data = JSON.parse(payload);
    // Token expires after 30 days
    if (Date.now() - data.iat > 30 * 24 * 60 * 60 * 1000) return null;
    return { userId: data.userId };
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach(function (c) {
    const parts = c.trim().split("=");
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = decodeURIComponent(parts.slice(1).join("="));
    }
  });
  return cookies;
}

function setSessionCookie(res, token) {
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const cookie = [
    `lt_pi_session=${token}`,
    "Path=/",
    "HttpOnly",
    isProd ? "Secure" : "",
    "SameSite=Lax",
    "Max-Age=2592000", // 30 days
  ].filter(Boolean).join("; ");
  res.setHeader("Set-Cookie", cookie);
}

/* ── action: me — GET /api/pi/auth?action=me ──────────────────────── */
async function handleMe(req, res) {
  setCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies.lt_pi_session;

  if (!sessionToken) { res.status(401).json({ error: "No session" }); return; }

  const session = verifySessionToken(sessionToken);
  if (!session) { res.status(401).json({ error: "Invalid session" }); return; }

  res.status(200).json({
    user: { uid: session.userId, username: "Pi User" },
  });
}

/* ── action: logout — POST /api/pi/auth?action=logout ─────────────── */
async function handleLogout(req, res) {
  setCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const cookie = [
    "lt_pi_session=",
    "Path=/",
    "HttpOnly",
    isProd ? "Secure" : "",
    "SameSite=Lax",
    "Max-Age=0",
  ].filter(Boolean).join("; ");

  res.setHeader("Set-Cookie", cookie);
  res.status(200).json({ ok: true });
}

/* ── default: login — POST /api/pi/auth ────────────────────────────── */
async function handleLogin(req, res) {
  setCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  const accessToken = body && body.accessToken;
  if (!accessToken) { res.status(400).json({ error: "Missing accessToken" }); return; }

  try {
    // Validate the access token with Pi's server
    const piRes = await fetch(PI_API_BASE + "/me", {
      method: "GET",
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (!piRes.ok) {
      const errText = await piRes.text().catch(() => "");
      console.error("Pi API validation failed:", piRes.status, errText);
      res.status(401).json({ error: "Invalid Pi access token" });
      return;
    }

    const piUser = await piRes.json();

    if (!piUser || !piUser.uid) {
      res.status(401).json({ error: "Could not verify Pi user" });
      return;
    }

    const sessionToken = createSessionToken(piUser.uid);
    setSessionCookie(res, sessionToken);

    res.status(200).json({
      user: { uid: piUser.uid, username: piUser.username || "Pi User" },
      sessionToken,
    });
  } catch (err) {
    console.error("Pi auth error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
}

export default async function handler(req, res) {
  const action = getQuery(req).action;
  if (action === "me") return handleMe(req, res);
  if (action === "logout") return handleLogout(req, res);
  return handleLogin(req, res);
}
