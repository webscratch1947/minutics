// POST /api/pi/auth — Verify Pi Network access token server-side and
// create an authenticated session cookie.
//
// Flow:
// 1. Client authenticates via Pi SDK (browser), receives an accessToken
// 2. Client POSTs the accessToken here over HTTPS
// 3. Server validates the token with Pi's API
// 4. Server creates an HttpOnly session cookie
// 5. Server returns safe user information to the client

import crypto from "crypto";

const PI_API_BASE = "https://api.minepi.com/v2";

function createSessionToken(userId) {
  const secret = process.env.PI_SESSION_SECRET;
  if (!secret) throw new Error("PI_SESSION_SECRET not configured");
  const payload = JSON.stringify({ userId, iat: Date.now() });
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const sig = hmac.digest("hex");
  return Buffer.from(payload).toString("base64") + "." + sig;
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

export default async function handler(req, res) {
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

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  const accessToken = body && body.accessToken;
  if (!accessToken) {
    res.status(400).json({ error: "Missing accessToken" });
    return;
  }

  try {
    // Validate the access token with Pi's server
    const piRes = await fetch(PI_API_BASE + "/users/me", {
      method: "GET",
      headers: {
        "Authorization": `Key ${accessToken}`,
      },
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

    // Create session token
    const sessionToken = createSessionToken(piUser.uid);
    setSessionCookie(res, sessionToken);

    // Return safe user info (never expose server secrets)
    res.status(200).json({
      user: {
        uid: piUser.uid,
        username: piUser.username || "Pi User",
      },
      sessionToken,
    });
  } catch (err) {
    console.error("Pi auth error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
}
