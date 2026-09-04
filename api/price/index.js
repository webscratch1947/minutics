// GET /api/pi/price — Fetch current PI/USD price from CoinGecko.
// Server-side only: CG_API_KEY is never exposed to the frontend.
// Price is cached for 5 minutes. Returns { piUsdPrice, fetchedAt, expiresAt }.

const CG_BASE = "https://api.coingecko.com/api/v3";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let priceCache = null; // { piUsdPrice, fetchedAt, expiresAt }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const now = Date.now();

  // Return cached price if still valid
  if (priceCache && now < priceCache.expiresAt) {
    res.status(200).json({
      piUsdPrice: priceCache.piUsdPrice,
      fetchedAt: priceCache.fetchedAt,
      expiresAt: priceCache.expiresAt,
    });
    return;
  }

  // Fetch fresh price from CoinGecko
  const apiKey = process.env.CG_API_KEY;
  if (!apiKey) {
    // If no API key configured and we have a stale cache, use it
    if (priceCache) {
      res.status(200).json({
        piUsdPrice: priceCache.piUsdPrice,
        fetchedAt: priceCache.fetchedAt,
        expiresAt: priceCache.expiresAt,
        stale: true,
      });
      return;
    }
    res.status(503).json({ error: "Pricing unavailable (API key not configured)" });
    return;
  }

  try {
    const url = CG_BASE + "/simple/price?ids=pi-network&vs_currencies=usd";
    const cgRes = await fetch(url, {
      headers: { "x-cg-demo-api-key": apiKey },
    });

    if (cgRes.status === 401) {
      if (priceCache) {
        res.status(200).json({
          piUsdPrice: priceCache.piUsdPrice,
          fetchedAt: priceCache.fetchedAt,
          expiresAt: priceCache.expiresAt,
          stale: true,
        });
        return;
      }
      res.status(503).json({ error: "Pricing unavailable (invalid API key)" });
      return;
    }

    if (cgRes.status === 429) {
      if (priceCache) {
        res.status(200).json({
          piUsdPrice: priceCache.piUsdPrice,
          fetchedAt: priceCache.fetchedAt,
          expiresAt: priceCache.expiresAt,
          stale: true,
        });
        return;
      }
      res.status(503).json({ error: "Pricing unavailable (rate limited)" });
      return;
    }

    if (!cgRes.ok) {
      const errText = await cgRes.text().catch(() => "");
      console.error("CoinGecko error:", cgRes.status, errText);
      if (priceCache) {
        res.status(200).json({
          piUsdPrice: priceCache.piUsdPrice,
          fetchedAt: priceCache.fetchedAt,
          expiresAt: priceCache.expiresAt,
          stale: true,
        });
        return;
      }
      res.status(503).json({ error: "Pricing temporarily unavailable" });
      return;
    }

    const data = await cgRes.json();
    const piUsdPrice = data && data["pi-network"] && data["pi-network"].usd;

    if (!piUsdPrice || typeof piUsdPrice !== "number" || piUsdPrice <= 0) {
      if (priceCache) {
        res.status(200).json({
          piUsdPrice: priceCache.piUsdPrice,
          fetchedAt: priceCache.fetchedAt,
          expiresAt: priceCache.expiresAt,
          stale: true,
        });
        return;
      }
      res.status(503).json({ error: "Unable to determine Pi price" });
      return;
    }

    const fetchedAt = now;
    const expiresAt = now + CACHE_TTL_MS;

    priceCache = { piUsdPrice, fetchedAt, expiresAt };

    res.status(200).json({ piUsdPrice, fetchedAt, expiresAt });
  } catch (err) {
    console.error("CoinGecko fetch error:", err);
    if (priceCache) {
      res.status(200).json({
        piUsdPrice: priceCache.piUsdPrice,
        fetchedAt: priceCache.fetchedAt,
        expiresAt: priceCache.expiresAt,
        stale: true,
      });
      return;
    }
    res.status(503).json({ error: "Pricing temporarily unavailable" });
  }
}
