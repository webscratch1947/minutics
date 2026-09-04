const PI_API_BASE = "https://api.minepi.com/v2";
const PI_TIMEOUT_MS = 12000;

const PLANS = {
  basic:    { usdPrice: 1,   label: "Basic",    durationDays: 30 },
  yearly:   { usdPrice: 9,   label: "1 Year",   durationDays: 365 },
  lifetime: { usdPrice: 99,  label: "Lifetime", durationDays: null },
};

async function piApiPost(path, body, apiKey) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, PI_TIMEOUT_MS);
  try {
    var res = await fetch(PI_API_BASE + path, {
      method: "POST",
      headers: {
        "Authorization": "Key " + apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    var text = await res.text().catch(function () { return ""; });
    var parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { parsed = text; }
    return { status: res.status, ok: res.ok, body: parsed, raw: text };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export default async function handler(req, res) {
  console.log("[complete] request received method=" + req.method);

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

  var piApiKey = process.env.PI_API_KEY;
  console.log("[complete] PI_API_KEY configured=" + Boolean(piApiKey));
  if (!piApiKey) {
    res.status(500).json({
      error: "Payment service not configured",
      diagnostic: "PI_API_KEY is missing in the Vercel environment variables.",
    });
    return;
  }

  var body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  var paymentId = body && body.paymentId;
  var txid = body && body.txid;
  var quote = body && body.quote;

  console.log("[complete] paymentId type=" + typeof paymentId + " len=" + (paymentId ? paymentId.length : 0) + " txid=" + (txid ? "present" : "missing"));

  if (!paymentId || typeof paymentId !== "string") {
    res.status(400).json({ error: "Missing or invalid paymentId" });
    return;
  }

  try {
    var completePath = "/payments/" + encodeURIComponent(paymentId) + "/complete";
    var completeBody = {};
    if (txid) completeBody.txid = txid;

    console.log("[complete] calling Pi complete path=" + completePath + " hasTxid=" + Boolean(txid));
    var piResult = await piApiPost(completePath, completeBody, piApiKey);
    console.log("[complete] Pi complete status=" + piResult.status);

    if (piResult.ok) {
      var planInfo = null;
      if (quote && quote.planId) {
        var plan = PLANS[quote.planId];
        if (plan) {
          var activatedAt = Date.now();
          planInfo = {
            planId: quote.planId,
            label: plan.label,
            durationDays: plan.durationDays,
            activatedAt: activatedAt,
            expiresAt: plan.durationDays ? activatedAt + plan.durationDays * 86400000 : null,
          };
        }
      }
      res.status(200).json({ payment: piResult.body, ok: true, plan: planInfo });
      return;
    }

    var piMsg = "";
    if (piResult.body && typeof piResult.body === "object") {
      piMsg = piResult.body.error || piResult.body.message || JSON.stringify(piResult.body);
    } else {
      piMsg = String(piResult.body || "");
    }
    console.error("[complete] Pi complete failed status=" + piResult.status + " msg=" + piMsg.substring(0, 300));

    if (piResult.status === 400 && /already/i.test(piMsg)) {
      var planInfo2 = null;
      if (quote && quote.planId) {
        var plan2 = PLANS[quote.planId];
        if (plan2) {
          var activatedAt2 = Date.now();
          planInfo2 = {
            planId: quote.planId,
            label: plan2.label,
            durationDays: plan2.durationDays,
            activatedAt: activatedAt2,
            expiresAt: plan2.durationDays ? activatedAt2 + plan2.durationDays * 86400000 : null,
          };
        }
      }
      res.status(200).json({ payment: piResult.body, ok: true, plan: planInfo2, alreadyCompleted: true });
      return;
    }

    res.status(piResult.status).json({
      error: "Failed to complete payment on Pi Network",
      piStatus: piResult.status,
      piMessage: piMsg.substring(0, 500),
    });
  } catch (err) {
    console.error("[complete] exception:", err.name, err.message || err);
    var detail = "";
    if (err.name === "AbortError") {
      detail = "Pi API request timed out";
    } else {
      detail = err.message || String(err);
    }
    res.status(500).json({ error: "Payment completion failed", detail: detail });
  }
}
