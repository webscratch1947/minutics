// POST /api/pi/payments/complete — Complete a Pi Network payment.
//
// This is called after the client has completed the payment via Pi SDK.
// Server-side verification ensures the payment was genuinely completed.

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

    // TODO: Record the completed payment in a database for later reference.
    // For now, the payment completion is verified server-side, which is
    // sufficient for the Pro plan flag stored on the device.

    res.status(200).json({ payment, ok: true });
  } catch (err) {
    console.error("Pi payment completion error:", err);
    res.status(500).json({ error: "Payment completion failed" });
  }
}
