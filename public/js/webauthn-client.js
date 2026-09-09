function waB64urlToBuf(s) {
  const str = String(s || "");
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

function waBufToB64url(buf) {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i += 1) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function waPrepCreateOptions(opts) {
  const o = JSON.parse(JSON.stringify(opts));
  o.challenge = waB64urlToBuf(o.challenge);
  if (o.user?.id) o.user.id = typeof o.user.id === "string" ? waB64urlToBuf(o.user.id) : o.user.id;
  if (Array.isArray(o.excludeCredentials)) {
    o.excludeCredentials = o.excludeCredentials.map((c) => ({
      ...c,
      id: typeof c.id === "string" ? waB64urlToBuf(c.id) : c.id,
    }));
  }
  return o;
}

function waPrepGetOptions(opts) {
  const o = JSON.parse(JSON.stringify(opts));
  o.challenge = waB64urlToBuf(o.challenge);
  if (Array.isArray(o.allowCredentials)) {
    o.allowCredentials = o.allowCredentials.map((c) => ({
      ...c,
      id: typeof c.id === "string" ? waB64urlToBuf(c.id) : c.id,
    }));
  }
  return o;
}

function waCredentialToJSON(cred) {
  const response = cred.response;
  const out = {
    id: cred.id,
    rawId: waBufToB64url(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults?.() || {},
  };
  if (response.attestationObject) {
    out.response = {
      clientDataJSON: waBufToB64url(response.clientDataJSON),
      attestationObject: waBufToB64url(response.attestationObject),
      transports: response.getTransports?.() || ["internal"],
    };
  } else {
    out.response = {
      clientDataJSON: waBufToB64url(response.clientDataJSON),
      authenticatorData: waBufToB64url(response.authenticatorData),
      signature: waBufToB64url(response.signature),
      userHandle: response.userHandle ? waBufToB64url(response.userHandle) : null,
    };
  }
  return out;
}

window.waCreate = async function waCreate(optionsJSON) {
  const cred = await navigator.credentials.create({
    publicKey: waPrepCreateOptions(optionsJSON),
  });
  return waCredentialToJSON(cred);
};

window.waGet = async function waGet(optionsJSON) {
  const cred = await navigator.credentials.get({
    publicKey: waPrepGetOptions(optionsJSON),
  });
  return waCredentialToJSON(cred);
};
