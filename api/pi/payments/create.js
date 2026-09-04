const PI_API_BASE = "https://api.minepi.com/v2";
const CG_BASE = "https://api.coingecko.com/api/v3";
const PRICE_TOLERANCE = 0.05;
const CG_TIMEOUT_MS = 4000;
const PI_TIMEOUT_MS = 12000;

const PLANS = {
  basic:    { usdPrice: 1 },
  yearly:   { usdPrice: 9 },
  lifetime: { usdPrice: 99 },
};

async function getPiUsdPrice() {
  const apiKey = process.env.CG_API_KEY;
  if (!apiKey) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, CG_TIMEOUT_MS);
    const res = await fetch(CG_BASE + "/simple/price?ids=pi-network&vs_currencies=usd", {
      headers: { "x-cg-demo-api-key": apiKey },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data && data["pi-network"] && data["pi-network"].usd;
  } catch (e) {
    return null;
  }
}

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
  console.log("[create] request received method=" + req.method);

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
  console.log("[create] PI_API_KEY configured=" + Boolean(piApiKey));
  if (!piApiKey) {
    res.status(500).json({
      error: "Payment service not configured",
      diagnostic: "PI_API_KEY is missing in the Vercel environment variables. Go to Vercel Dashboard > Settings > Environment Variables and add PI_API_KEY from the Pi Developer Portal.",
    });
    return;
  }

  var body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  var paymentId = body && body.paymentId;
  var quote = body && body.quote;

  console.log("[create] paymentId type=" + typeof paymentId + " len=" + (paymentId ? paymentId.length : 0));

  if (!paymentId || typeof paymentId !== "string") {
    res.status(400).json({ error: "Missing or invalid paymentId" });
    return;
  }

  if (quote) {
    if (!quote.expiresAt || Date.now() > quote.expiresAt) {
      res.status(400).json({ error: "Quote has expired. Please get a new price." });
      return;
    }
    var plan = PLANS[quote.planId];
    if (!plan) {
      res.status(400).json({ error: "Invalid plan in quote" });
      return;
    }
    if (quote.usdPrice !== plan.usdPrice) {
      res.status(400).json({ error: "Invalid USD price in quote" });
      return;
    }
    var livePrice = await getPiUsdPrice();
    if (livePrice && quote.piUsdPrice) {
      var expectedPiAmount = parseFloat((plan.usdPrice / livePrice).toFixed(8));
      if (Math.abs(expectedPiAmount - quote.piAmount) / quote.piAmount > PRICE_TOLERANCE) {
        res.status(400).json({ error: "Quote amount no longer matches market price. Please get a new quote." });
        return;
      }
    }
  }

  try {
    var approvePath = "/payments/" + encodeURIComponent(paymentId) + "/approve";
    console.log("[create] calling Pi approve path=" + approvePath);
    var piResult = await piApiPost(approvePath, {}, piApiKey);
    console.log("[create] Pi approve status=" + piResult.status);

    if (piResult.ok) {
      res.status(200).json({ payment: piResult.body, quote: quote || null, ok: true });
      return;
    }

    var piMsg = "";
    if (piResult.body && typeof piResult.body === "object") {
      piMsg = piResult.body.error || piResult.body.message || JSON.stringify(piResult.body);
    } else {
      piMsg = String(piResult.body || "");
    }
    console.error("[create] Pi approve failed status=" + piResult.status + " msg=" + piMsg.substring(0, 300));

    if (piResult.status === 400 && /already/i.test(piMsg)) {
      res.status(200).json({ payment: piResult.body, quote: quote || null, ok: true, alreadyApproved: true });
      return;
    }

    res.status(piResult.status).json({
      error: "Failed to approve payment on Pi Network",
      piStatus: piResult.status,
      piMessage: piMsg.substring(0, 500),
    });
  } catch (err) {
    console.error("[create] exception:", err.name, err.message || err);
    var detail = "";
    if (err.name === "AbortError") {
      detail = "Pi API request timed out";
    } else {
      detail = err.message || String(err);
    }
    res.status(500).json({ error: "Payment approval failed", detail: detail });
  }
}
