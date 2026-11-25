// Proxy for infographic JPGs. raw.githubusercontent.com is blocked/slow on
// many Indian mobile networks, which made Knowledge Gram show a black screen
// and broke canvas watermark -> share/download. Serve the bytes from OUR domain.
import { setCors } from "../lib/cors.js";

const ALLOWED = /^\d{3}$/; // 001, 002, ... only

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET") { res.status(405).end(); return; }

  const id = String(req.query.id || "");
  if (!ALLOWED.test(id)) { res.status(400).end(); return; }

  const upstream = `https://raw.githubusercontent.com/webscratch1947/infographics/main/${id}.jpg`;
  try {
    const r = await fetch(upstream, {
      headers: { "User-Agent": "Minutics/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) { res.status(404).end(); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).end();
  }
}
