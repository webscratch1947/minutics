// POST /api/pi/payments/create — Approve a Pi Network payment.
//
// Pi Payment flow:
// 1. Client gets a quote from /api/quote (client stores it)
// 2. Client creates a payment via Pi SDK → gets a paymentId
// 3. Client POSTs { paymentId, accessToken, quote } here
// 4. Server validates the quote against live CoinGecko price
// 5. Server calls Pi's API to approve the payment
// 6. Client completes the payment via Pi SDK
// 7. Server verifies completion via /api/pi/payments/complete

const PI_API_BASE = "https://api.minepi.com/v2";
const CG_BASE = "https://api.coingecko.com/api/v3";
const PRICE_TOLERANCE = 0.05; // Allow 5% price drift between quote and live

const PLANS = {
  basic:    { usdPrice: 1 },
  yearly:   { usdPrice: 12 },
  lifetime: { usdPrice: 99 },
};

async function getPiUsdPrice() {
  const apiKey = process.env.CG_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(CG_BASE + "/simple/price?ids=pi-network&vs_currencies=usd", {
      headers: { "x-cg-demo-api-key": apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data["pi-network"] && data["pi-network"].usd;
  } catch (e) {
    return null;
  }
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
  const { paymentId, accessToken, quote } = body || {};

  if (!paymentId) {
    res.status(400).json({ error: "Missing paymentId" });
    return;
  }

  if (!accessToken) {
    res.status(400).json({ error: "Missing accessToken" });
    return;
  }

  // Validate quote if provided
  if (quote) {
    // Check quote expiry
    if (!quote.expiresAt || Date.now() > quote.expiresAt) {
      res.status(400).json({ error: "Quote has expired. Please get a new price." });
      return;
    }

    // Check plan exists
    const plan = PLANS[quote.planId];
    if (!plan) {
      res.status(400).json({ error: "Invalid plan in quote" });
      return;
    }

    // Validate USD price matches plan
    if (quote.usdPrice !== plan.usdPrice) {
      res.status(400).json({ error: "Invalid USD price in quote" });
      return;
    }

    // Cross-check Pi amount against live price (allow tolerance for price drift)
    const livePrice = await getPiUsdPrice();
    if (livePrice && quote.piUsdPrice) {
      const expectedPiAmount = parseFloat((plan.usdPrice / livePrice).toFixed(8));
      if (Math.abs(expectedPiAmount - quote.piAmount) / quote.piAmount > PRICE_TOLERANCE) {
        res.status(400).json({ error: "Quote amount no longer matches market price. Please get a new quote." });
        return;
      }
    }
  }

  try {
    // Approve the payment on Pi's server
    const piRes = await fetch(PI_API_BASE + "/payments/" + paymentId + "/approve", {
      method: "POST",
      headers: {
        "Authorization": `Key ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!piRes.ok) {
      const errText = await piRes.text().catch(() => "");
      console.error("Pi payment approve failed:", piRes.status, errText);
      res.status(piRes.status).json({ error: "Failed to approve payment" });
      return;
    }

    const payment = await piRes.json();
    res.status(200).json({ payment, quote: quote || null });
  } catch (err) {
    console.error("Pi payment approval error:", err);
    res.status(500).json({ error: "Payment approval failed" });
  }
}
