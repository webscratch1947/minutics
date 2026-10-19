// Admin panel backend — ONE serverless function for everything, because the
// project sits at the Vercel Hobby 12-function budget (two Pi-auth functions
// were folded into /api/pi/auth to free slots for this).
//
//   POST /api/admin { action:"login",  email, password }  → signed session cookie
//   POST /api/admin { action:"logout" }                   → clears the cookie
//   GET  /api/admin?action=state                          → { authed, email }
//   GET  /api/admin?action=data                           → users + purchases from DynamoDB
//
// Security model:
//   - The function only answers on the admin host (404 everywhere else).
//   - Allowed emails come from ADMIN_EMAILS, password from ADMIN_PASSWORD.
//   - Passwords are compared in constant time; failures get a short delay.
//   - Sessions are HMAC-signed cookies (ADMIN_SESSION_SECRET) — stateless,
//     tamper-proof, 7-day expiry. The secret never leaves the server.

import crypto from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const ADMIN_HOST = "admin.minutics.com";
const COOKIE_NAME = "lt_admin_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DATA_CAP = 1000; // rows per table the panel will ever load

/* ── small helpers ─────────────────────────────────────────────────── */

function getQuery(req) {
  if (req.query && typeof req.query === "object") return req.query;
  try {
    return Object.fromEntries(new URL(req.url || "/", "http://local").searchParams);
  } catch {
    return {};
  }
}

function getBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  return body && typeof body === "object" ? body : {};
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value)).digest();
}

function safeEqual(a, b) {
  return crypto.timingSafeEqual(sha256Hex(a), sha256Hex(b));
}

function configuredSecret() {
  return process.env.ADMIN_SESSION_SECRET || "";
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/* ── session cookie (HMAC-signed, stateless) ───────────────────────── */

function b64url(str) {
  return Buffer.from(str, "utf8").toString("base64url");
}

function makeToken(email) {
  const secret = configuredSecret();
  const payload = b64url(JSON.stringify({ email, exp: Date.now() + SESSION_TTL_MS }));
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return payload + "." + sig;
}

function verifyToken(token) {
  const secret = configuredSecret();
  if (!secret || !token) return null;
  try {
    const parts = String(token).split(".");
    if (parts.length !== 2) return null;
    const expected = crypto.createHmac("sha256", secret).update(parts[0]).digest("base64url");
    const a = Buffer.from(parts[1]);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!data || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    if (typeof data.email !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function sessionFrom(req) {
  const cookies = parseCookies(req.headers && req.headers.cookie);
  return verifyToken(cookies[COOKIE_NAME]);
}

function setSessionCookie(res, token) {
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    [
      `${COOKIE_NAME}=${token}`,
      "Path=/",
      "HttpOnly",
      isProd ? "Secure" : "",
      "SameSite=Lax",
      `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    ].filter(Boolean).join("; ")
  );
}

function clearSessionCookie(res) {
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    [`${COOKIE_NAME}=`, "Path=/", "HttpOnly", isProd ? "Secure" : "", "SameSite=Lax", "Max-Age=0"]
      .filter(Boolean)
      .join("; ")
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── DynamoDB reads (the ledger tables the admin panel shows) ──────── */

async function scanTable(table, cap) {
  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: process.env.AWS_REGION || "ap-south-1" })
  );
  const items = [];
  let startKey;
  do {
    const res = await client.send(
      new ScanCommand({ TableName: table, Limit: 500, ExclusiveStartKey: startKey })
    );
    for (const item of res.Items || []) items.push(item);
    startKey = res.LastEvaluatedKey;
  } while (startKey && items.length < cap);
  return items.slice(0, cap);
}

function computeStats(users, purchases) {
  const FREE = new Set(["", "free", "none", "trial"]);
  const active = users.filter(
    (u) => u && u.plan && !FREE.has(String(u.plan).toLowerCase()) &&
      (!u.planStatus || !/expired|cancelled|canceled|inactive|refunded/i.test(String(u.planStatus)))
  ).length;
  let revenue = 0;
  for (const p of purchases) {
    if (!p || typeof p !== "object") continue;
    const raw = [p.amount, p.price, p.total, p.value].find((v) => typeof v === "number");
    if (typeof raw === "number") revenue += raw;
  }
  return { totalUsers: users.length, activePlans: active, purchases: purchases.length, revenue };
}

async function readData() {
  const warnings = [];
  const usersTable = process.env.AWS_TABLE;
  const purchasesTable = process.env.AWS_TABLE_PURCHASES;
  const haveCreds = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

  if (!haveCreds) warnings.push("AWS keys are not set in the environment yet — showing an empty ledger.");
  if (!usersTable || !purchasesTable) warnings.push("Table names are not configured (AWS_TABLE / AWS_TABLE_PURCHASES).");

  let users = [];
  let purchases = [];
  if (haveCreds && usersTable && purchasesTable) {
    try {
      users = await scanTable(usersTable, DATA_CAP);
    } catch (e) {
      warnings.push("Could not read the users table (" + (e && e.name ? e.name : "error") + ").");
    }
    try {
      purchases = await scanTable(purchasesTable, DATA_CAP);
    } catch (e) {
      warnings.push("Could not read the purchases table (" + (e && e.name ? e.name : "error") + ").");
    }
  }

  return { users, purchases, stats: computeStats(users, purchases), warnings };
}

/* ── handler ───────────────────────────────────────────────────────── */

export default async function handler(req, res) {
  const host = String((req.headers && req.headers.host) || "").toLowerCase();
  if (host !== ADMIN_HOST) {
    res.status(404).json({ ok: false, error: "Not found" });
    return;
  }

  const query = getQuery(req);

  /* POST — login / logout */
  if (req.method === "POST") {
    const body = getBody(req);
    const action = body.action || query.action;

    if (action === "logout") {
      clearSessionCookie(res);
      res.status(200).json({ ok: true });
      return;
    }

    if (action === "login") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const emails = adminEmails();
      const configured = process.env.ADMIN_PASSWORD && configuredSecret() && emails.length > 0;

      const emailOk = email !== "" && emails.includes(email);
      const passwordOk =
        process.env.ADMIN_PASSWORD && password.length > 0 && safeEqual(password, process.env.ADMIN_PASSWORD);

      if (!configured) {
        res.status(503).json({ ok: false, error: "Admin login is not configured on the server yet." });
        return;
      }
      if (!emailOk || !passwordOk) {
        await sleep(350); // blunt the speed of guessing
        res.status(401).json({ ok: false, error: "Wrong email or password." });
        return;
      }
      setSessionCookie(res, makeToken(email));
      res.status(200).json({ ok: true, email });
      return;
    }

    res.status(400).json({ ok: false, error: "Unknown action" });
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  /* GET — session state (no auth required; never leaks anything) */
  if (query.action === "state") {
    const session = sessionFrom(req);
    res.status(200).json({ ok: true, authed: Boolean(session), email: session ? session.email : null });
    return;
  }

  /* GET — the ledger (auth required) */
  const session = sessionFrom(req);
  if (!session) {
    res.status(401).json({ ok: false, error: "Not signed in" });
    return;
  }

  try {
    const data = await readData();
    res.status(200).json({ ok: true, email: session.email, generatedAt: new Date().toISOString(), ...data });
  } catch (e) {
    console.error("admin data failed:", e && e.message);
    res.status(500).json({ ok: false, error: "Could not read the ledger" });
  }
}
