// Single-device session enforcement — now Cognito + DynamoDB.
//
// POST /api/session  (Authorization: Bearer <Cognito ID token>)
//   { deviceId, mode: "claim" }  → store this device on the user's row in
//                                  the MinuticsUsers table (last login wins)
//   { mode: "check" }            → read back the stored device (no write);
//                                  the caller signs itself out when another
//                                  device owns the claim
//   { mode: "plan", plan }       → record which subscription this account
//                                  activated (purchase / cancel report)
//   { mode: "plan-get" }         → read the subscription back — AWS is the
//                                  source of truth, so wiping the device's
//                                  storage can't lose a purchase
//
// POST /api/session  (NO Authorization — the user is locked out by
//   definition; dispatched before the token gate)
//   { mode: "set-password", email, password }
//                                  → set a permanent Cognito password with
//                                  NO email code: email verification was
//                                  removed entirely (pool auto-verify off,
//                                  owner's decision — including the reset
//                                  code). Resolves the email alias to the
//                                  pool's internal username first.
//   Responds { ok } / { ok:false, error } / degraded when unconfigured.
//
//   Responds { ok, device, claimed?, plan?, planSince?, degraded? }. When
//   the AWS keys are not configured in the environment the endpoint answers
//   degraded and the client simply stops enforcing — auth itself never
//   depends on this.
//
// Legacy compatibility (already-installed APKs / old web bundles):
//   - POST with a Firebase ID token still updates the Firebase custom
//     claim exactly as before (old clients ignore the extra fields),
//   - DELETE still verifies a Firebase ID token and deletes that Firebase
//     account (old clients call it; new clients delete via the Cognito
//     SDK directly and never hit this route).
//
// Part of the Vercel Hobby 12-function budget (kept small on purpose).

import { setCors } from "../lib/cors.js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { CognitoIdentityProviderClient, AdminGetUserCommand, AdminSetUserPasswordCommand } from "@aws-sdk/client-cognito-identity-provider";
import crypto from "node:crypto";

/* ── Cognito pool identity (public values, verified against the token) ── */
const POOL_ID = process.env.COGNITO_POOL_ID || "ap-south-1_QAdugNxC2";
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "8kq0askdobsj49crut3fg9akf";
const ISS = "https://cognito-idp.ap-south-1.amazonaws.com/" + POOL_ID;
const TABLE = process.env.MINUTICS_USERS_TABLE || "MinuticsUsers";

/* ── JWKS (the pool's public verification keys), cached per warm instance ── */
let _jwks = null;
let _jwksAt = 0;
async function jwkFor(kid) {
  const fresh = !_jwks || Date.now() - _jwksAt > 10 * 60 * 1000;
  if (fresh) {
    const r = await fetch(ISS + "/.well-known/jwks.json");
    if (!r.ok) throw new Error("jwks " + r.status);
    const data = await r.json();
    _jwks = data.keys || [];
    _jwksAt = Date.now();
  }
  let key = _jwks.find((k) => k.kid === kid);
  if (!key) {
    /* Key rotation: force one refetch before giving up. */
    const r = await fetch(ISS + "/.well-known/jwks.json");
    if (r.ok) {
      _jwks = (await r.json()).keys || [];
      _jwksAt = Date.now();
      key = _jwks.find((k) => k.kid === kid);
    }
  }
  if (!key) throw new Error("unknown kid");
  return crypto.createPublicKey({ key, format: "jwk" });
}

async function verifyCognitoIdToken(token) {
  const parts = String(token).split(".");
  if (parts.length !== 3) throw new Error("malformed");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (header.alg !== "RS256") throw new Error("alg");
  if (payload.iss !== ISS) throw new Error("iss");
  if (payload.aud !== CLIENT_ID) throw new Error("aud");
  if (payload.token_use !== "id") throw new Error("token_use");
  if (!payload.exp || Date.now() / 1000 >= payload.exp + 60) throw new Error("exp");
  const key = await jwkFor(header.kid);
  const ok = crypto.verify(
    "RSA-SHA256",
    Buffer.from(parts[0] + "." + parts[1], "utf8"),
    key,
    Buffer.from(parts[2], "base64url")
  );
  if (!ok) throw new Error("signature");
  if (!payload.sub) throw new Error("sub");
  return payload; /* { sub, email, ... } */
}

/* ── DynamoDB (graceful when the AWS keys are not configured) ─────────── */
let _ddb = null;
function docClient() {
  if (_ddb !== null) return _ddb;
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    _ddb = null;
    return null;
  }
  _ddb = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: process.env.AWS_REGION || "ap-south-1" })
  );
  return _ddb;
}
const ddbGuard = () => (docClient() ? true : false);

/* ── Legacy Firebase admin (old-APK compatibility only) ────────────────── */
let _fbAuth = null;
async function legacyFirebaseAuth() {
  if (_fbAuth) return _fbAuth;
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID || "lifetime-a4bde",
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        }),
      });
  _fbAuth = getAuth(app);
  return _fbAuth;
}

const CLAIM_BUDGET = 960; // Firebase custom-claims limit is ~1000 bytes
function sizeOf(obj) {
  try { return new TextEncoder().encode(JSON.stringify(obj)).length; } catch { return 0; }
}
function fitClaims(claims) {
  if (sizeOf(claims) <= CLAIM_BUDGET) return claims;
  if (typeof claims.tgs === "object" && claims.tgs && typeof claims.tgs.x === "string") {
    let x = claims.tgs.x;
    while (sizeOf(claims) > CLAIM_BUDGET && x.length > 40) {
      x = x.slice(0, Math.max(40, Math.floor(x.length * 0.7)));
      claims.tgs = Object.assign({}, claims.tgs, { x });
    }
  }
  if (sizeOf(claims) > CLAIM_BUDGET && typeof claims.tgs === "object" && claims.tgs) {
    const tgs = Object.assign({}, claims.tgs);
    delete tgs.x;
    claims = Object.assign({}, claims, { tgs });
  }
  return claims;
}

/* ── Codeless password reset (mode "set-password") ──────────────────────
   No email codes exist anywhere anymore. The pool's usernames are UUIDs
   with the email as an ALIAS: AdminGetUser accepts the alias and hands
   back the real username, which is what AdminSetUserPassword requires.
   Vercel key needs cognito-idp:AdminGetUser + AdminSetUserPassword. */
async function handleSetPassword(body, res) {
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ ok: false, error: "Enter a valid email address." });
    return;
  }
  if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    res.status(400).json({ ok: false, error: "Password must be 8+ characters with an uppercase letter, a lowercase letter and a number." });
    return;
  }
  const region = POOL_ID.split("_")[0];
  if (!region || !process.env.AWS_ACCESS_KEY_ID) {
    res.status(200).json({ ok: false, degraded: true, error: "Password reset is unavailable right now." });
    return;
  }
  try {
    const cog = new CognitoIdentityProviderClient({ region });
    const got = await cog.send(new AdminGetUserCommand({ UserPoolId: POOL_ID, Username: email }));
    const username = got && got.Username ? got.Username : email;
    await cog.send(new AdminSetUserPasswordCommand({
      UserPoolId: POOL_ID, Username: username, Password: password, Permanent: true,
    }));
    res.status(200).json({ ok: true });
  } catch (e) {
    const name = (e && (e.name || e.Code)) || "";
    if (name === "UserNotFoundException") {
      res.status(404).json({ ok: false, error: "No account with that email — register first." });
      return;
    }
    console.error("set-password failed:", name, e && e.message);
    res.status(500).json({ ok: false, error: "Could not reset the password — try again." });
  }
}

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST" && req.method !== "DELETE") { res.status(405).json({ ok: false, error: "Method not allowed" }); return; }

  /* Body first — the codeless password reset runs WITHOUT a token (the
     whole point: the user is locked out), so it dispatches before the
     token gate below. */
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  body = body || {};
  if (req.method === "POST" && body.mode === "set-password") { await handleSetPassword(body, res); return; }

  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) { res.status(401).json({ ok: false, error: "Missing authorization token" }); return; }

  /* Which identity system is this token from? Cognito first (new app),
     Firebase second (already-installed APKs during the transition). */
  let cognitoPayload = null;
  try {
    cognitoPayload = await verifyCognitoIdToken(idToken);
  } catch {
    cognitoPayload = null;
  }

  let legacyAuth = null;
  let uid = null;
  if (!cognitoPayload) {
    try {
      legacyAuth = await legacyFirebaseAuth();
      const decoded = await legacyAuth.verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      res.status(401).json({ ok: false, error: "Invalid or expired token" });
      return;
    }
  }

  /* ── DELETE: permanently delete this user's (legacy Firebase) account ──
     Only ever deletes the uid bound to the presented token. New clients
     delete through the Cognito SDK and never call this; it stays for
     already-installed APKs during the transition. */
  if (req.method === "DELETE") {
    if (!legacyAuth || !uid) { res.status(401).json({ ok: false, error: "Invalid or expired token" }); return; }
    try {
      await legacyAuth.deleteUser(uid);
      res.status(200).json({ ok: true });
    } catch (e) {
      if (e && e.code === "auth/user-not-found") {
        res.status(200).json({ ok: true });
        return;
      }
      console.error("account delete failed:", e && e.message);
      res.status(500).json({ ok: false, error: "Could not delete account" });
    }
    return;
  }

  /* ── POST ───────────────────────────────────────────────────────────── */

  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  const mode = body.mode === "check" ? "check"
    : body.mode === "plan" ? "plan"
    : body.mode === "plan-get" ? "plan-get"
    : "claim";

  /* ── Legacy Firebase claim path (old APKs): unchanged behavior ─────── */
  if (!cognitoPayload) {
    if (deviceId && !/^[A-Za-z0-9_-]{8,64}$/.test(deviceId)) {
      res.status(400).json({ ok: false, error: "Invalid deviceId" });
      return;
    }
    try {
      const user = await legacyAuth.getUser(uid);
      const claims = Object.assign({}, user.customClaims || {});
      if (claims.sessionDevice === deviceId) {
        res.status(200).json({ ok: true, claimed: false });
        return;
      }
      if (deviceId) {
        claims.sessionDevice = deviceId;
        await legacyAuth.setCustomUserClaims(uid, fitClaims(claims));
      }
      res.status(200).json({ ok: true, claimed: !!deviceId });
    } catch (e) {
      console.error("session claim failed:", e && e.message);
      res.status(500).json({ ok: false, error: "Could not claim session" });
    }
    return;
  }

  /* ── Cognito path: the MinuticsUsers DynamoDB row is the registry ──── */
  const sub = cognitoPayload.sub;
  const email = typeof cognitoPayload.email === "string" ? cognitoPayload.email : "";
  const now = Date.now();

  if (mode === "claim" && deviceId && !/^[A-Za-z0-9_-]{8,64}$/.test(deviceId)) {
    res.status(400).json({ ok: false, error: "Invalid deviceId" });
    return;
  }

  if (!ddbGuard()) {
    /* AWS keys not configured yet (admin panel shows its own banner for
       this): answer honestly so the client stops enforcing instead of
       kicking devices or looping. Auth itself is unaffected.
       "why" tells the owner's next "why isn't it saving?" report exactly
       which piece is missing — booleans only, never a secret. */
    res.status(200).json({
      ok: true, device: null, claimed: false, degraded: true,
      why: "missing-aws-env",
      hasKeyId: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecret: !!process.env.AWS_SECRET_ACCESS_KEY,
    });
    return;
  }

  try {
    if (mode === "check") {
      const got = await docClient().send(new GetCommand({ TableName: TABLE, Key: { pk: sub } }));
      const item = got.Item || null;
      /* Best-effort heartbeat so the admin panel's ledger shows activity. */
      try {
        await docClient().send(new UpdateCommand({
          TableName: TABLE,
          Key: { pk: sub },
          UpdateExpression: "SET lastSeenAt = :t",
          ConditionExpression: "attribute_exists(pk)",
          ExpressionAttributeValues: { ":t": now },
        }));
      } catch { /* heartbeat must never fail the check */ }
      res.status(200).json({
        ok: true,
        device: item && item.deviceId ? item.deviceId : null,
        /* The subscription rides along on every check so a paid plan heals
           (or is restored) within seconds of app open even if the one-shot
           sign-in reconcile was missed. */
        plan: item && typeof item.plan === "string" ? item.plan : null,
        planSince: item && item.planSince ? item.planSince : null,
      });
      return;
    }

    /* plan-get: the client asks AWS what subscription this account owns —
       the source of truth, so wiping the device's storage can never lose
       a purchase. Read-only; null when the account never bought anything. */
    if (mode === "plan-get") {
      const got = await docClient().send(new GetCommand({ TableName: TABLE, Key: { pk: sub } }));
      const item = got.Item || null;
      res.status(200).json({
        ok: true,
        plan: item && typeof item.plan === "string" ? item.plan : null,
        planSince: item && item.planSince ? item.planSince : null,
      });
      return;
    }

    /* plan: this device reports the plan it activated (purchases are
       device-local by design — this ledger write is what the admin panel
       shows and what plan-get restores after a storage wipe). Unknown
       values collapse to "free"; planSince records when the plan changed
       (kept across repeated reports of the same plan so expiry math stays
       correct across devices/wipes). No deviceId involved.
       NOTE: "plan" is a DynamoDB RESERVED WORD — it MUST be aliased
       (#plan) in the expression or every write dies with a
       ValidationException that the catch below would swallow as
       "degraded" (that is exactly how purchases silently never saved). */
    if (mode === "plan") {
      const PLAN_IDS = ["free", "basic", "yearly", "lifetime", "pro"];
      let plan = typeof body.plan === "string" ? body.plan.toLowerCase() : "free";
      if (!PLAN_IDS.includes(plan)) plan = "free";
      const prevRow = await docClient().send(new GetCommand({ TableName: TABLE, Key: { pk: sub } }));
      const prevItem = prevRow.Item || null;
      const prevPlan = prevItem && typeof prevItem.plan === "string" ? prevItem.plan : "";
      const changed = prevPlan !== plan;
      await docClient().send(new UpdateCommand({
        TableName: TABLE,
        Key: { pk: sub },
        UpdateExpression:
          "SET email = :e, #plan = :p, updatedAt = :t" +
          (changed ? ", planSince = :t" : ", planSince = if_not_exists(planSince, :t)") +
          ", #ifn = if_not_exists(#ifn, :t)",
        ExpressionAttributeValues: { ":e": email, ":p": plan, ":t": now },
        ExpressionAttributeNames: { "#plan": "plan", "#ifn": "createdAt" },
      }));
      /* An actual activation also lands in the Purchases ledger (what the
         admin panel's Purchases card reads) — best-effort: the plan write
         above is what matters, a receipt must never fail the response. */
      if (changed && plan !== "free") {
        try {
          const PURCHASES_TABLE = process.env.AWS_TABLE_PURCHASES || "MinuticsPurchases";
          const AMOUNTS = { basic: 1, yearly: 9, lifetime: 99, pro: 99 };
          const purchaseId = "purchase#" + sub + "#" + now;
          await docClient().send(new PutCommand({
            TableName: PURCHASES_TABLE,
            Item: {
              pk: purchaseId, id: purchaseId, uid: sub, userId: sub,
              email, plan, amount: AMOUNTS[plan] || 0,
              purchasedAt: now, createdAt: now, status: "paid",
            },
          }));
        } catch (e) {
          console.error("purchase receipt failed (plan itself saved):", e && e.message);
        }
      }
      res.status(200).json({
        ok: true,
        plan,
        planSince: changed ? now : (prevItem && prevItem.planSince ? prevItem.planSince : now),
      });
      return;
    }

    /* claim: last login wins — this write IS the claim */
    const prev = await docClient().send(new GetCommand({ TableName: TABLE, Key: { pk: sub } }));
    const prevDevice = prev.Item && prev.Item.deviceId ? prev.Item.deviceId : "";
    const claimed = !!deviceId && deviceId !== prevDevice;
    const upd = new UpdateCommand({
      TableName: TABLE,
      Key: { pk: sub },
      UpdateExpression:
        "SET email = :e, lastSeenAt = :t, updatedAt = :t, #ifn = if_not_exists(#ifn, :t)" +
        (deviceId ? ", deviceId = :d" : ""),
      ExpressionAttributeValues: Object.assign(
        { ":e": email, ":t": now },
        deviceId ? { ":d": deviceId } : {}
      ),
      ExpressionAttributeNames: { "#ifn": "createdAt" },
    });
    await docClient().send(upd);
    res.status(200).json({ ok: true, device: deviceId || prevDevice || null, claimed });
  } catch (e) {
    console.error("session/dynamo failed:", e && e.message);
    /* Never punish the client for a ledger hiccup — auth still works.
       "why" surfaces the root cause to the caller instead of hiding it
       (error name + truncated message only — never credentials). */
    res.status(200).json({
      ok: true, device: null, claimed: false, degraded: true,
      why: ((e && e.name) || "Error") + ": " + String((e && e.message) || "").slice(0, 160),
      region: process.env.AWS_REGION || "ap-south-1(default)",
    });
  }
}
