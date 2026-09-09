const $ = (id) => document.getElementById(id);

$("togglePass").addEventListener("click", () => {
  const p = $("password");
  p.type = p.type === "password" ? "text" : "password";
});

const remembered = localStorage.getItem("s360_user");
if (remembered) $("username").value = remembered;

const savedBoot = typeof readSavedLogin === "function" ? readSavedLogin() : null;
if (savedBoot?.u) $("username").value = savedBoot.u;

fetch("/api/auth/me", { credentials: "include" })
  .then((r) => (r.ok ? r.json() : null))
  .then((d) => {
    if (d?.user) location.replace("/app");
  })
  .catch(() => {});

$("forgot").addEventListener("click", (e) => {
  e.preventDefault();
  toast("Şifre sıfırlama yöneticiniz üzerinden yapılır.");
});

async function biometricLogin({ silent = false } = {}) {
  const savedLogin = readSavedLogin();
  if (!window.PublicKeyCredential) {
    if (!silent) toast("Bu cihaz biyometriyi desteklemiyor.");
    return false;
  }
  const credId = localStorage.getItem("s360_webauthn_cred") || "";
  const username = (
    $("username").value ||
    savedLogin?.u ||
    localStorage.getItem("s360_user") ||
    ""
  ).trim();
  if (!credId && !username) {
    if (!silent) toast("Önce profilden parmak izi / desen ekleyin.");
    return false;
  }
  try {
    const options = await api("/api/auth/webauthn/login/options", {
      method: "POST",
      body: { credId, username },
    });
    const assertion = await window.waGet(options);

    if (savedLogin?.u && savedLogin?.p) {
      $("username").value = savedLogin.u;
      $("password").value = savedLogin.p;
      await api("/api/auth/login", {
        method: "POST",
        body: { username: savedLogin.u, password: savedLogin.p },
      });
      localStorage.setItem("s360_user", savedLogin.u);
      if (assertion?.id) localStorage.setItem("s360_webauthn_cred", assertion.id);
      location.href = "/app";
      return true;
    }

    const data = await api("/api/auth/webauthn/login/verify", {
      method: "POST",
      body: { userId: options.userId, response: assertion },
    });
    if (data.user) {
      if (assertion?.id) localStorage.setItem("s360_webauthn_cred", assertion.id);
      location.href = "/app";
      return true;
    }
  } catch (err) {
    if (!silent) toast(err.message || "Biyometrik giriş başarısız");
  }
  return false;
}

$("bio").addEventListener("click", () => biometricLogin({ silent: false }));

if ((localStorage.getItem("s360_webauthn_cred") || readSavedLogin()) && window.PublicKeyCredential) {
  setTimeout(() => {
    if (document.visibilityState === "visible") biometricLogin({ silent: true });
  }, 450);
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("error").textContent = "";
  try {
    const username = $("username").value;
    const password = $("password").value;
    await api("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    if ($("remember").checked) localStorage.setItem("s360_user", username);
    else localStorage.removeItem("s360_user");
    if (localStorage.getItem("s360_webauthn_cred") || readSavedLogin()) {
      saveLocalLogin(username, password);
    }
    location.href = "/app";
  } catch (err) {
    $("error").textContent = err.message;
  }
});
