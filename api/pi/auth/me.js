// GET /api/pi/auth/me — Check if the current session cookie is valid
// and return the authenticated user's info.

import crypto from "crypto";

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

export default async function handler(req, res) {
  var origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies.lt_pi_session;

  if (!sessionToken) {
    res.status(401).json({ error: "No session" });
    return;
  }

  const session = verifySessionToken(sessionToken);
  if (!session) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }

  res.status(200).json({
    user: {
      uid: session.userId,
      username: "Pi User",
    },
  });
}
