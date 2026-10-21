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
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { CognitoIdentityProviderClient, ListUsersCommand, AdminDeleteUserCommand } from "@aws-sdk/client-cognito-identity-provider";

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

/* ── Cognito: the authoritative account list ──────────────────────────
   Every account that exists lives in the Cognito user pool; the
   DynamoDB ledger only records logins (device + last seen). The panel
   therefore lists users FROM COGNITO and enriches each row with its
   ledger data, so a signup appears immediately — even before its first
   login claim ever lands. */
const USER_POOL_ID = process.env.COGNITO_POOL_ID || "ap-south-1_QAdugNxC2";

function mapCognitoUser(u) {
  const attrs = u.Attributes || [];
  const attr = (n) => { const hit = attrs.find((a) => a.Name === n); return hit ? hit.Value : ""; };
  const emailAttr = attr("email");
  return {
    sub: attr("sub") || u.Username || "",
    username: u.Username || "",
    email: emailAttr || (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.Username || "") ? u.Username : ""),
    status: u.UserStatus || "",
    enabled: u.Enabled !== false,
    createdAt: u.UserCreateDate ? new Date(u.UserCreateDate).getTime() : "",
  };
}

async function listCognitoUsers(cap) {
  const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || "ap-south-1",
  });
  const out = [];
  let token;
  do {
    const res = await client.send(new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: 60,
      PaginationToken: token,
    }));
    for (const u of res.Users || []) out.push(mapCognitoUser(u));
    token = res.PaginationToken;
  } while (token && out.length < cap);
  return out.slice(0, cap);
}

/* Cognito account + its login-ledger row → one panel row. Ledger rows that
   match no Cognito account (old pre-Cognito records) are still appended so
   nothing silently disappears. */
function mergeUsers(cognitoUsers, ledger) {
  const byKey = new Map();
  for (const row of ledger || []) {
    if (!row || typeof row !== "object") continue;
    const sub = String(row.sub || row.pk || row.uid || "");
    const email = String(row.email || "").toLowerCase();
    if (sub) byKey.set("sub:" + sub, row);
    if (email) byKey.set("email:" + email, row);
  }
  const users = [];
  const matched = new Set();
  for (const c of cognitoUsers || []) {
    const row = byKey.get("sub:" + c.sub) || byKey.get("email:" + String(c.email || "").toLowerCase()) || {};
    /* Ledger rows carry the id as `uid` — match on it too or the SAME
       account shows up twice (once from Cognito, once appended raw). */
    if (row && (row.sub || row.pk || row.uid)) matched.add(row);
    users.push(Object.assign({}, row, c, {
      sub: c.sub || row.sub || row.pk || row.uid || "",
      email: c.email || row.email || "",
      createdAt: c.createdAt || row.createdAt || row.joinedAt || "",
      lastLoginAt: row.lastLoginAt || row.lastSeen || row.lastLogin || null,
      lastSeenAt: row.lastSeenAt || row.lastLoginAt || null,
    }));
  }
  for (const row of ledger || []) {
    if (matched.has(row)) continue;
    users.push(Object.assign({}, row, { sub: row.sub || row.pk || row.uid || "" }));
  }
  return users;
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

  let ledger = [];
  let purchases = [];
  let cognitoUsers = null;
  if (haveCreds && usersTable && purchasesTable) {
    try {
      ledger = await scanTable(usersTable, DATA_CAP);
    } catch (e) {
      warnings.push("Could not read the users table (" + (e && e.name ? e.name : "error") + ").");
    }
    try {
      purchases = await scanTable(purchasesTable, DATA_CAP);
    } catch (e) {
      warnings.push("Could not read the purchases table (" + (e && e.name ? e.name : "error") + ").");
    }
  }
  if (haveCreds) {
    try {
      cognitoUsers = await listCognitoUsers(DATA_CAP);
    } catch (e) {
      warnings.push(
        "Could not list the Cognito accounts (" + (e && e.name ? e.name : "error") +
        ") — the AWS key needs permission to read the user pool (cognito-idp:ListUsers). Showing the login ledger only."
      );
    }
  }

  const users = mergeUsers(cognitoUsers, ledger);
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

    /* POST — give a subscription to an account (admin session required).
       UpdateItem only, never Put: the device claim, email and history stay
       untouched; an account that has never touched the ledger yet just gets
       its row created. The plan starts now (planSince = now), so the normal
       expiry math applies, and the person's app picks it up on its next
       check-in because the server plan always wins over a stale local one. */
    if (action === "give-plan") {
      const session = sessionFrom(req);
      if (!session) {
        res.status(401).json({ ok: false, error: "Not signed in" });
        return;
      }
      const uid = String(body.uid || "").trim();
      const plan = String(body.plan || "").trim().toLowerCase();
      const email = String(body.email || "").trim().toLowerCase();
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(uid)) {
        res.status(400).json({ ok: false, error: "Pick an account to give a subscription to." });
        return;
      }
      if (!["basic", "yearly", "lifetime"].includes(plan)) {
        res.status(400).json({ ok: false, error: "Unknown subscription — pick Basic, 1 Year or Lifetime." });
        return;
      }
      const usersTable = process.env.AWS_TABLE;
      const haveCreds = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
      if (!haveCreds || !usersTable) {
        res.status(503).json({ ok: false, error: "AWS is not configured on the server yet." });
        return;
      }
      try {
        const client = DynamoDBDocumentClient.from(
          new DynamoDBClient({ region: process.env.AWS_REGION || "ap-south-1" })
        );
        const now = Date.now();
        await client.send(new UpdateCommand({
          TableName: usersTable,
          Key: { uid },
          // `plan` is a DynamoDB reserved word → always aliased (#p).
          UpdateExpression: "SET #p = :plan, planSince = :t, updatedAt = :t, email = if_not_exists(email, :e)",
          ExpressionAttributeNames: { "#p": "plan" },
          ExpressionAttributeValues: { ":plan": plan, ":t": now, ":e": email },
        }));
        res.status(200).json({ ok: true, uid, plan, planSince: now });
      } catch (e) {
        console.error("give-plan failed:", e && e.name, e && e.message);
        res.status(500).json({
          ok: false,
          error: "Could not write the subscription (" + (e && e.name ? e.name : "error") + ").",
        });
      }
      return;
    }

    /* POST — delete an account completely (admin session required):
       the sign-in account AND its ledger row. UserNotFoundException is a
       success — that's the ghost case (sign-in already deleted outside
       the app, only the ledger row left). Purchase receipts stay: they
       are sales history. */
    if (action === "delete-account") {
      const session = sessionFrom(req);
      if (!session) {
        res.status(401).json({ ok: false, error: "Not signed in" });
        return;
      }
      const uid = String(body.uid || "").trim();
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(uid)) {
        res.status(400).json({ ok: false, error: "Pick a valid account." });
        return;
      }
      const usersTable = process.env.AWS_TABLE;
      const haveCreds = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
      if (!haveCreds || !usersTable) {
        res.status(503).json({ ok: false, error: "AWS is not configured on the server yet." });
        return;
      }
      let cognitoWarning = null;
      try {
        const cog = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || "ap-south-1" });
        await cog.send(new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: uid }));
      } catch (e) {
        const name = (e && (e.name || e.Code)) || "";
        if (name !== "UserNotFoundException") {
          console.error("delete-account: cognito delete failed:", name, e && e.message);
          /* The panel row goes away either way — say so honestly instead
             of half-failing; the console can finish the sign-in side. */
          cognitoWarning = "The ledger row was deleted, but the sign-in account could not be removed (" +
            name + "). If it still accepts logins, delete it in the Cognito console.";
        }
      }
      try {
        const client = DynamoDBDocumentClient.from(
          new DynamoDBClient({ region: process.env.AWS_REGION || "ap-south-1" })
        );
        await client.send(new DeleteCommand({ TableName: usersTable, Key: { uid } }));
      } catch (e) {
        console.error("delete-account: ledger delete failed:", e && e.name, e && e.message);
        res.status(500).json({ ok: false, error: "Could not delete the ledger row (" + (e && e.name ? e.name : "error") + ")." });
        return;
      }
      res.status(200).json({ ok: true, uid, warning: cognitoWarning });
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
