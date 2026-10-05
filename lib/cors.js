// First-party CORS allowlist for the app API (ZAP: Cross-Domain
// Misconfiguration). A wildcard Access-Control-Allow-Origin lets ANY site
// read API responses from a browser — we only ever grant origins we own,
// the Android WebView fallback origin, and local dev hosts.
//
// Same-origin calls (app.minutics.com -> app.minutics.com) never need a
// CORS header, so an unlisted Origin simply gets none.
const ALLOWED_ORIGIN =
  /^https:\/\/((app|piapp)\.minutics\.com|(www\.)?minutics\.com|appassets\.androidplatform\.net)$|^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  // API responses are dynamic user data — never cacheable by any shared cache.
  res.setHeader("Cache-Control", "no-store");
}
