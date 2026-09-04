// POST /api/quote — Create a checkout quote for a subscription plan.
// Uses the cached PI/USD price from /api/pi/price.
// Returns a time-limited quote that locks the exact Pi amount for checkout.
//
// Request body: { planId: "basic" | "yearly" | "lifetime" }
// Response: { orderId, planId, usdPrice, piUsdPrice, piAmount, createdAt, expiresAt }

import crypto from "crypto";

const PLANS = {
  basic:    { usdPrice: 1,   label: "Basic" },
  yearly:   { usdPrice: 9,  label: "1 Year" },
  lifetime: { usdPrice: 99,  label: "Lifetime" },
};

const QUOTE_TTL_MS = 10 * 60 * 1000; // 10 minutes

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

  const planId = body && body.planId;
  const plan = PLANS[planId];
  if (!plan) {
    res.status(400).json({ error: "Invalid planId. Expected: basic, yearly, or lifetime." });
    return;
  }

  // Fetch PI/USD price — reuse /api/pi/price or fetch directly from CoinGecko
  const CG_BASE = "https://api.coingecko.com/api/v3";
  let piUsdPrice = null;

  // Try internal price endpoint first (reuses the 5-min cache)
  try {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host || "piapp.minutics.com";
    const priceUrl = proto + "://" + host + "/api/price";
    const priceRes = await fetch(priceUrl);
    if (priceRes.ok) {
      const priceData = await priceRes.json();
      piUsdPrice = priceData.piUsdPrice;
    }
  } catch (e) {
    // Fall through to direct CoinGecko fetch
  }

  // Direct CoinGecko fallback if internal call failed
  if (!piUsdPrice) {
    const apiKey = process.env.CG_API_KEY;
    if (apiKey) {
      try {
        const url = CG_BASE + "/simple/price?ids=pi-network&vs_currencies=usd";
        const cgRes = await fetch(url, {
          headers: { "x-cg-demo-api-key": apiKey },
        });
        if (cgRes.ok) {
          const data = await cgRes.json();
          piUsdPrice = data && data["pi-network"] && data["pi-network"].usd;
        }
      } catch (e) { /* fall through */ }
    }
  }

  if (!piUsdPrice || typeof piUsdPrice !== "number" || piUsdPrice <= 0) {
    res.status(503).json({ error: "Unable to determine Pi price. Please try again." });
    return;
  }

  const piAmount = parseFloat((plan.usdPrice / piUsdPrice).toFixed(8));
  const orderId = "ord_" + crypto.randomBytes(12).toString("hex");
  const now = Date.now();
  const createdAt = now;
  const expiresAt = now + QUOTE_TTL_MS;

  // Extract userId from session cookie
  let userId = "anonymous";
  try {
    const cookies = (req.headers.cookie || "").split(";").reduce((acc, c) => {
      const [k, v] = c.trim().split("=");
      acc[k] = v;
      return acc;
    }, {});
    const sessionToken = cookies.lt_pi_session;
    if (sessionToken) {
      const secret = process.env.PI_SESSION_SECRET;
      if (secret) {
        const parts = sessionToken.split(".");
        if (parts.length === 2) {
          const payload = JSON.parse(Buffer.from(parts[0], "base64").toString());
          userId = payload.userId;
        }
      }
    }
  } catch (e) {
    // userId stays "anonymous"
  }

  res.status(200).json({
    orderId,
    userId,
    planId,
    usdPrice: plan.usdPrice,
    piUsdPrice,
    piAmount,
    createdAt,
    expiresAt,
  });
}
