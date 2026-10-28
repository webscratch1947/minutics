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
//   { mode: "forgot-send", email }  → email a 6-digit reset code through
//                                  Brevo SMTP (env BREVO_SMTP_KEY — never
//                                  in the repo, this file is server-only).
//                                  Only a HASH of the code is stored on
//                                  the user's MinuticsUsers row; the code
//                                  expires in 10 minutes and 5 wrong
//                                  attempts burn it. Resolves the email
//                                  alias to the pool's internal username.
//   { mode: "forgot-verify",       → check the code against that hash,
//     code, email, password }       then set the Cognito password
//                                  permanently and clear the hash — the
//                                  client logs in with it right after.
//   { mode: "set-password", ... }  → RETIRED: the old codeless reset let
//                                  anyone who knew an email take that
//                                  account. Old bundles get a clear
//                                  "update the app" error, never a hole.
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
import { CognitoIdentityProviderClient, AdminGetUserCommand, AdminSetUserPasswordCommand, AdminInitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
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

/* ── Password reset with an emailed 6-digit code ────────────────────────
   The pool's usernames are UUIDs with the email as an ALIAS: AdminGetUser
   accepts the alias and hands back the real username, which is what
   AdminSetUserPassword requires. Vercel key needs AdminGetUser +
   AdminSetUserPassword (the reset code itself never touches Cognito —
   it lives hashed on the MinuticsUsers ledger row).

   forgot-send   → 6 digits, emailed through Brevo SMTP. Only sha256(uid:
                   code) is stored, with a 10-minute expiry and an
                   attempt counter; 5 wrong tries destroy the code.
                   One code per minute per address, so the endpoint can't
                   flood an inbox. Unknown email → 404 (the same honest
                   message the old flow gave).
   forgot-verify → timing-safe hash compare, then AdminSetUserPassword
                   and the hash is wiped. Nobody can reset an account
                   anymore just by knowing the email address. */
const RESET_TTL_MS = 10 * 60 * 1000;   /* the code is good for 10 minutes */
const RESET_MAX_ATTEMPTS = 5;          /* wrong tries before it's burned */
const RESET_RESEND_MS = 60 * 1000;     /* one email per address per minute */

function resetHash(uid, code) {
  return crypto.createHash("sha256").update(uid + ":" + code).digest("hex");
}
function validResetInputs(email, code, password) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  if (!/^\d{6}$/.test(code)) return "Enter the 6-digit code from your email.";
  if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must be 8+ characters with an uppercase letter, a lowercase letter and a number.";
  }
  return null;
}
function resetAwsConfigured() {
  const region = POOL_ID.split("_")[0];
  if (!region || !process.env.AWS_ACCESS_KEY_ID) return false;
  return !!docClient();
}

/* The email: plain, small, brand-neutral cream card with the code in a
   dark box. It says once, quietly, that the request can be ignored —
   and never asks the reader to do anything (no links to click), so a
   reset code can't be phished out of this message. */
function resetMail(code) {
  const body =
    '<div style="background:#FDFBF7;padding:32px 20px;font-family:Helvetica,Arial,sans-serif;color:#111827">' +
      '<div style="max-width:460px;margin:0 auto;background:#fff;border:1px solid #E7E2D6;border-radius:16px;padding:30px 28px">' +
        '<p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#6B7280;margin:0 0 10px">Minutics</p>' +
        '<h1 style="font-size:20px;margin:0 0 10px;color:#111827">Your password reset code</h1>' +
        '<p style="font-size:14px;color:#4B5563;margin:0 0 18px;line-height:1.5">Enter this code in the app, then choose a new password:</p>' +
        '<p style="font-size:30px;font-weight:700;letter-spacing:.4em;text-align:center;background:#111827;color:#FDFBF7;border-radius:12px;padding:16px 0;margin:0 0 18px">' + code + '</p>' +
        '<p style="font-size:13px;color:#6B7280;margin:0 0 6px;line-height:1.5">It expires in 10 minutes, and each code works once.</p>' +
        '<p style="font-size:13px;color:#6B7280;margin:0;line-height:1.5">Didn\'t request this? You can safely ignore this email — your password stays exactly as it is.</p>' +
      '</div>' +
    '</div>';
  return {
    from: process.env.BREVO_RESET_FROM || "Minutics <info@minutics.com>",
    subject: "Your Minutics password reset code",
    text:
      "Your Minutics password reset code is: " + code + "\n\n" +
      "It expires in 10 minutes, and each code works once.\n" +
      "Didn't request this? You can safely ignore this email — your password stays exactly as it is.\n",
    html: body,
  };
}
async function sendResetEmail(to, code) {
  /* Dynamic import: the mailer only loads when a code actually goes out,
     keeping every other call to this function cheap to start. */
  const nodemailer = (await import("nodemailer")).default;
  const smtpPort = Number(process.env.BREVO_SMTP_PORT) || 587;
  const transport = nodemailer.createTransport({
    host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
    port: smtpPort,
    secure: smtpPort === 465,           /* 587 = STARTTLS, 465 = direct TLS */
    auth: {
      user: process.env.BREVO_SMTP_USER || "c05038001@smtp-brevo.com",
      pass: process.env.BREVO_SMTP_KEY || "",
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  });
  await transport.sendMail(Object.assign({ to }, resetMail(code)));
}

async function handleForgotSend(body, res) {
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ ok: false, error: "Enter a valid email address." });
    return;
  }
  if (!process.env.BREVO_SMTP_KEY) {
    res.status(200).json({ ok: false, degraded: true, error: "Password reset email is unavailable right now — try again later." });
    return;
  }
  if (!resetAwsConfigured()) {
    res.status(200).json({ ok: false, degraded: true, error: "Password reset is unavailable right now." });
    return;
  }
  try {
    const region = POOL_ID.split("_")[0];
    const cog = new CognitoIdentityProviderClient({ region });
    let uid = null;
    try {
      const got = await cog.send(new AdminGetUserCommand({ UserPoolId: POOL_ID, Username: email }));
      uid = got && got.Username ? got.Username : email;
    } catch (e) {
      if (e && (e.name || e.Code) === "UserNotFoundException") {
        res.status(404).json({ ok: false, error: "No account with that email — register first." });
        return;
      }
      throw e;
    }

    /* One code a minute per address — a resend double-tap (or someone
       else poking the endpoint) can never flood a real inbox. Answered
       as ok so the button never looks broken. */
    try {
      const got = await docClient().send(new GetCommand({ TableName: TABLE, Key: { uid } }));
      const sentAt = got.Item && typeof got.Item.pwResetAt === "number" ? got.Item.pwResetAt : 0;
      if (Date.now() - sentAt < RESET_RESEND_MS) {
        res.status(200).json({ ok: true, cooldown: true });
        return;
      }
    } catch (e) {
      console.error("forgot-send cooldown read failed:", e && e.name, e && e.message);
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    await sendResetEmail(email, code);   /* send FIRST: never store a code that was never delivered */

    /* Only the hash lands in the ledger — the code itself exists exactly
       once, in the email. if_not_exists keeps any pre-existing address. */
    await docClient().send(new UpdateCommand({
      TableName: TABLE,
      Key: { uid },
      UpdateExpression: "SET email = if_not_exists(email, :e), pwResetHash = :h, pwResetExp = :x, pwResetAtt = :a, pwResetAt = :t",
      ExpressionAttributeValues: {
        ":e": email,
        ":h": resetHash(uid, code),
        ":x": Date.now() + RESET_TTL_MS,
        ":a": 0,
        ":t": Date.now(),
      },
    }));
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("forgot-send failed:", (e && (e.name || e.code)) || "", e && e.message);
    res.status(500).json({ ok: false, error: "Could not send the code — try again in a minute." });
  }
}

/* Same-password rejection: a reset must not accept the account's OWN
   current password ("you can't add the same password in the reset" —
   other users are free to pick anything, including a shared one; Cognito
   never exposes password hashes, so the only probe is to try to AUTH
   with the candidate: success ⇒ it IS the current password → reject,
   NotAuthorized ⇒ it's different → proceed. Anything else (IAM key
   missing the permission, pool flow disabled) fails OPEN: a reset is
   never bricked by the guard itself, it just falls back to no check. */
async function probeIsCurrentPassword(cog, uid, password) {
  try {
    await cog.send(new AdminInitiateAuthCommand({
      UserPoolId: POOL_ID,
      ClientId: CLIENT_ID,
      AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: uid, PASSWORD: password },
    }));
    return true;    /* authenticated with the candidate ⇒ it's the current one */
  } catch (e) {
    const name = (e && (e.name || e.Code)) || "";
    if (name === "NotAuthorizedException" || name === "UserNotFoundException") return false;
    console.error("same-password probe skipped:", name, e && e.message);
    return false;   /* fail open — never block a reset over the probe */
  }
}

async function handleForgotVerify(body, res) {
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const bad = validResetInputs(email, code, password);
  if (bad) { res.status(400).json({ ok: false, error: bad }); return; }
  if (!resetAwsConfigured()) {
    res.status(200).json({ ok: false, degraded: true, error: "Password reset is unavailable right now." });
    return;
  }
  try {
    const region = POOL_ID.split("_")[0];
    const cog = new CognitoIdentityProviderClient({ region });
    let uid = null;
    try {
      const got = await cog.send(new AdminGetUserCommand({ UserPoolId: POOL_ID, Username: email }));
      uid = got && got.Username ? got.Username : email;
    } catch (e) {
      if (e && (e.name || e.Code) === "UserNotFoundException") {
        res.status(404).json({ ok: false, error: "No account with that email — register first." });
        return;
      }
      throw e;
    }

    const clearCode = () => docClient().send(new UpdateCommand({
      TableName: TABLE,
      Key: { uid },
      UpdateExpression: "REMOVE pwResetHash, pwResetExp, pwResetAtt, pwResetAt",
    }));
    const got = await docClient().send(new GetCommand({ TableName: TABLE, Key: { uid } }));
    const item = got.Item || null;
    if (!item || !item.pwResetHash || typeof item.pwResetHash !== "string") {
      res.status(400).json({ ok: false, error: "That code has expired — send a new one." });
      return;
    }
    if (typeof item.pwResetExp !== "number" || Date.now() > item.pwResetExp) {
      try { await clearCode(); } catch { /* already gone */ }
      res.status(400).json({ ok: false, error: "That code has expired — send a new one." });
      return;
    }
    const attempts = typeof item.pwResetAtt === "number" ? item.pwResetAtt : 0;
    if (attempts >= RESET_MAX_ATTEMPTS) {
      try { await clearCode(); } catch { /* already gone */ }
      res.status(400).json({ ok: false, error: "Too many attempts — send a new code." });
      return;
    }

    /* Timing-safe compare of the two hashes (equal length is guaranteed —
       both are hex digests of sha256). */
    const want = Buffer.from(item.pwResetHash, "utf8");
    const have = Buffer.from(resetHash(uid, code), "utf8");
    const match = want.length === have.length && crypto.timingSafeEqual(want, have);
    if (!match) {
      try {
        await docClient().send(new UpdateCommand({
          TableName: TABLE,
          Key: { uid },
          UpdateExpression: "SET pwResetAtt = :a",
          ExpressionAttributeValues: { ":a": attempts + 1 },
        }));
      } catch { /* the attempt cap is best-effort hardening, not the lock */ }
      res.status(400).json({ ok: false, error: "That code didn't match — check the email and try again." });
      return;
    }

    /* The code is right — now the one password rule a reset can still
       enforce: it can't be the account's current password. Checked
       BEFORE anything is consumed, so a rejected "same password" keeps
       the code fully usable for a real new choice. */
    const same = await probeIsCurrentPassword(cog, uid, password);
    if (same) {
      res.status(400).json({ ok: false, error: "You can't use the same password in a reset — choose a new one." });
      return;
    }

    await cog.send(new AdminSetUserPasswordCommand({
      UserPoolId: POOL_ID, Username: uid, Password: password, Permanent: true,
    }));
    try { await clearCode(); } catch { /* the password is set — never fail over cleanup */ }
    res.status(200).json({ ok: true });
  } catch (e) {
    const name = (e && (e.name || e.Code)) || "";
    if (name === "UserNotFoundException") {
      res.status(404).json({ ok: false, error: "No account with that email — register first." });
      return;
    }
    console.error("forgot-verify failed:", name, e && e.message);
    res.status(500).json({ ok: false, error: "Could not reset the password — try again." });
  }
}

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST" && req.method !== "DELETE") { res.status(405).json({ ok: false, error: "Method not allowed" }); return; }

  /* Body first — the password reset runs WITHOUT a token (the whole
     point: the user is locked out), so it dispatches before the token
     gate below. */
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  body = body || {};
  if (req.method === "POST" && body.mode === "forgot-send") { await handleForgotSend(body, res); return; }
  if (req.method === "POST" && body.mode === "forgot-verify") { await handleForgotVerify(body, res); return; }
  if (req.method === "POST" && body.mode === "set-password") {
    /* RETIRED, on purpose: this mode used to set any account's password
       with no email check at all — anyone who knew an address could take
       the account over. Already-shipped bundles still call it, so they
       get a clear nudge instead of a silent 404 (and never a hole). */
    res.status(403).json({
      ok: false,
      error: "This reset step was upgraded for security — update the app (or reset your password on the website) to continue.",
    });
    return;
  }

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
      /* Also tombstone the ledger row — an old client's delete must not
         leave a visible ghost in the admin panel either. Best-effort. */
      try {
        await docClient().send(new UpdateCommand({
          TableName: TABLE,
          Key: { uid },
          UpdateExpression: "SET deletedAt = :t REMOVE #p, email, planSince, deviceId, lastSeenAt, createdAt, updatedAt",
          ExpressionAttributeNames: { "#p": "plan" },
          ExpressionAttributeValues: { ":t": Date.now() },
        }));
      } catch (e) {
        console.error("legacy ledger cleanup failed:", e && e.name, e && e.message);
      }
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
    : body.mode === "cleanup" ? "cleanup"
    : "claim";

  /* cleanup exists only to remove the ledger row OF THE DELETED COGNITO
     ACCOUNT — it needs a Cognito token. Legacy Firebase deletes go through
     the DELETE method below (which now cleans the ledger too). */
  if (mode === "cleanup" && !cognitoPayload) {
    res.status(400).json({ ok: false, error: "cleanup requires a Cognito session" });
    return;
  }

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
    /* cleanup: this account was just deleted through Cognito (the app's
       Settings → Delete account) — hide its ledger row from the admin
       panel too, so a deleted account can never linger. Only ever the row
       of the sub inside THIS token. Tombstone, not DeleteItem: the
       server key is guaranteed UpdateItem (claim/check/plan use it
       constantly) but may lack dynamodb:DeleteItem — deletion must never
       be blockable by IAM. Purchase receipts stay — sales history. */
    if (mode === "cleanup") {
      try {
        await docClient().send(new UpdateCommand({
          TableName: TABLE,
          Key: { uid: sub },
          UpdateExpression: "SET deletedAt = :t REMOVE #p, email, planSince, deviceId, lastSeenAt, createdAt, updatedAt",
          ExpressionAttributeNames: { "#p": "plan" },
          ExpressionAttributeValues: { ":t": now },
        }));
      } catch (e) {
        console.error("ledger cleanup failed:", e && e.name, e && e.message);
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (mode === "check") {
      const got = await docClient().send(new GetCommand({ TableName: TABLE, Key: { uid: sub } }));
      const item = got.Item || null;
      /* Best-effort heartbeat so the admin panel's ledger shows activity. */
      try {
        await docClient().send(new UpdateCommand({
          TableName: TABLE,
          Key: { uid: sub },
          UpdateExpression: "SET lastSeenAt = :t",
          ConditionExpression: "attribute_exists(uid)",
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
      const got = await docClient().send(new GetCommand({ TableName: TABLE, Key: { uid: sub } }));
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
      const prevRow = await docClient().send(new GetCommand({ TableName: TABLE, Key: { uid: sub } }));
      const prevItem = prevRow.Item || null;
      const prevPlan = prevItem && typeof prevItem.plan === "string" ? prevItem.plan : "";
      const changed = prevPlan !== plan;
      await docClient().send(new UpdateCommand({
        TableName: TABLE,
        Key: { uid: sub },
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
          /* MinuticsPurchases key = uid (HASH) + purchasedAt (RANGE, string).
             purchasedAt MUST be the ISO string — the table's sort key is type S. */
          const purchaseId = "purchase#" + sub + "#" + now;
          await docClient().send(new PutCommand({
            TableName: PURCHASES_TABLE,
            Item: {
              uid: sub, purchasedAt: new Date(now).toISOString(),
              id: purchaseId, userId: sub,
              email, plan, amount: AMOUNTS[plan] || 0,
              createdAt: now, status: "paid",
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
    const prev = await docClient().send(new GetCommand({ TableName: TABLE, Key: { uid: sub } }));
    const prevDevice = prev.Item && prev.Item.deviceId ? prev.Item.deviceId : "";
    const claimed = !!deviceId && deviceId !== prevDevice;
    const upd = new UpdateCommand({
      TableName: TABLE,
      Key: { uid: sub },
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
