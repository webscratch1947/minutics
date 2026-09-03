// POST /api/pi/payments/create — Approve a Pi Network payment.
//
// Pi Payment flow:
// 1. Client creates a payment via Pi SDK (browser) → gets a paymentId
// 2. Client POSTs the paymentId here for server-side approval
// 3. Server calls Pi's API to approve the payment
// 4. Client completes the payment via Pi SDK
// 5. Server verifies completion via /api/pi/payments/complete

const PI_API_BASE = "https://api.minepi.com/v2";

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
  const { paymentId, accessToken } = body || {};

  if (!paymentId) {
    res.status(400).json({ error: "Missing paymentId" });
    return;
  }

  if (!accessToken) {
    res.status(400).json({ error: "Missing accessToken" });
    return;
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
    res.status(200).json({ payment });
  } catch (err) {
    console.error("Pi payment approval error:", err);
    res.status(500).json({ error: "Payment approval failed" });
  }
}
