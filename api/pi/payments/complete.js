// POST /api/pi/payments/complete — Complete a Pi Network payment.
//
// This is called after the client has completed the payment via Pi SDK.
// Server-side verification ensures the payment was genuinely completed.
// Returns the plan info so the client can activate the correct subscription.

const PI_API_BASE = "https://api.minepi.com/v2";

const PLANS = {
  basic:    { usdPrice: 1,   label: "Basic",    durationDays: 30 },
  yearly:   { usdPrice: 12,  label: "1 Year",   durationDays: 365 },
  lifetime: { usdPrice: 99,  label: "Lifetime", durationDays: null },
};

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

  try {
    // Complete the payment on Pi's server
    const piRes = await fetch(PI_API_BASE + "/payments/" + paymentId + "/complete", {
      method: "POST",
      headers: {
        "Authorization": `Key ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!piRes.ok) {
      const errText = await piRes.text().catch(() => "");
      console.error("Pi payment complete failed:", piRes.status, errText);
      res.status(piRes.status).json({ error: "Failed to complete payment" });
      return;
    }

    const payment = await piRes.json();

    // Determine the plan from the quote passed by the client
    let planInfo = null;
    if (quote && quote.planId) {
      const plan = PLANS[quote.planId];
      if (plan) {
        const activatedAt = Date.now();
        planInfo = {
          planId: quote.planId,
          label: plan.label,
          durationDays: plan.durationDays,
          activatedAt,
          expiresAt: plan.durationDays ? activatedAt + plan.durationDays * 86400000 : null,
        };
      }
    }

    res.status(200).json({ payment, ok: true, plan: planInfo });
  } catch (err) {
    console.error("Pi payment completion error:", err);
    res.status(500).json({ error: "Payment completion failed" });
  }
}
