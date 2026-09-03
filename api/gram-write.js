// Server-side proxy for writing likes.json / comments.json to the
// "infographics" GitHub repo. Runs on Vercel, never in the browser, so
// the GitHub token (GH_WRITE_TOKEN env var) is never exposed to clients.

const GH_OWNER = "webscratch1947";
const GH_REPO = "infographics";
const ALLOWED_PATHS = new Set(["likes.json", "comments.json"]);

export default async function handler(req, res) {
  // The Android app's WebView serves pages from https://app.local, a
  // different origin than app.minutics.com, so browsers/WebView require
  // this endpoint to explicitly opt in via CORS headers, and to answer the
  // preflight OPTIONS request the browser sends first for a JSON POST.
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

  const token = process.env.GH_WRITE_TOKEN;
  if (!token) {
    res.status(500).json({ error: "Server missing GH_WRITE_TOKEN" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  const { path, content, sha, message } = body || {};

  if (!path || !ALLOWED_PATHS.has(path) || typeof content !== "object" || !message) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const ghUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`;
  const putBody = {
    message,
    content: Buffer.from(JSON.stringify(content), "utf-8").toString("base64"),
  };
  if (sha) putBody.sha = sha;

  try {
    const ghRes = await fetch(ghUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(putBody),
    });
    const data = await ghRes.json().catch(() => null);
    res.status(ghRes.status).json(data);
  } catch (e) {
    res.status(502).json({ error: "GitHub request failed" });
  }
}
