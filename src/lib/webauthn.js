import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

const challenges = new Map();

function putChallenge(key, challenge) {
  challenges.set(key, { challenge, exp: Date.now() + 5 * 60 * 1000 });
}

function takeChallenge(key) {
  const row = challenges.get(key);
  challenges.delete(key);
  if (!row || row.exp < Date.now()) return null;
  return row.challenge;
}

export function rpFromReq(req) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost")
    .split(",")[0]
    .trim();
  const hostname = host.replace(/:\d+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http"))
    .split(",")[0]
    .trim();
  const rpID = hostname === "127.0.0.1" ? "localhost" : hostname;
  return { rpID, rpName: "S-360", origin: `${proto}://${host}` };
}

function userIdBytes(user) {
  const raw = String(user.id || user.username || "user");
  return new TextEncoder().encode(raw).slice(0, 64);
}

export async function regOptions(req, user) {
  const { rpID, rpName } = rpFromReq(req);
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.username,
    userDisplayName: user.full_name || user.username,
    userID: userIdBytes(user),
    attestationType: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "preferred",
    },
    excludeCredentials: user.webauthn_cred_id
      ? [{ id: user.webauthn_cred_id, transports: ["internal"] }]
      : [],
  });
  putChallenge(`reg:${user.id}`, options.challenge);
  return options;
}

export async function regVerify(req, user, response) {
  const { rpID, origin } = rpFromReq(req);
  const expectedChallenge = takeChallenge(`reg:${user.id}`);
  if (!expectedChallenge) {
    const err = new Error("Doğrulama süresi doldu");
    err.status = 400;
    throw err;
  }
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });
  if (!verification.verified || !verification.registrationInfo) {
    const err = new Error("Parmak izi kaydı başarısız");
    err.status = 400;
    throw err;
  }
  const { credential } = verification.registrationInfo;
  return {
    credId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter || 0,
  };
}

export async function authOptions(req, user) {
  const { rpID } = rpFromReq(req);
  if (!user?.webauthn_cred_id) {
    const err = new Error("Parmak izi tanımlı değil");
    err.status = 400;
    throw err;
  }
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: [{ id: user.webauthn_cred_id, transports: ["internal"] }],
  });
  putChallenge(`auth:${user.id}`, options.challenge);
  putChallenge(`authcred:${user.webauthn_cred_id}`, options.challenge);
  return options;
}

export async function authVerify(req, user, response) {
  const { rpID, origin } = rpFromReq(req);
  const expectedChallenge =
    takeChallenge(`auth:${user.id}`) || takeChallenge(`authcred:${user.webauthn_cred_id}`);
  if (!expectedChallenge) {
    const err = new Error("Doğrulama süresi doldu");
    err.status = 400;
    throw err;
  }
  if (!user.webauthn_cred_id || !user.webauthn_public_key) {
    const err = new Error("Parmak izi tanımlı değil");
    err.status = 400;
    throw err;
  }
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: user.webauthn_cred_id,
      publicKey: Buffer.from(user.webauthn_public_key, "base64url"),
      counter: Number(user.webauthn_counter || 0),
      transports: ["internal"],
    },
  });
  if (!verification.verified) {
    const err = new Error("Parmak izi doğrulanamadı");
    err.status = 401;
    throw err;
  }
  return verification.authenticationInfo?.newCounter ?? Number(user.webauthn_counter || 0);
}
