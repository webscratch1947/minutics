// POST /api/pi/logout — Clear the Minutics Pi session cookie.
// This does NOT log the user out of Pi Network itself — only
// removes the Minutics application session.

export default async function handler(req, res) {
  var origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

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
