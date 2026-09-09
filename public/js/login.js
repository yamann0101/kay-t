const $ = (id) => document.getElementById(id);

$("togglePass").addEventListener("click", () => {
  const p = $("password");
  p.type = p.type === "password" ? "text" : "password";
});

const remembered = localStorage.getItem("s360_user");
if (remembered) $("username").value = remembered;

fetch("/api/auth/me", { credentials: "include" })
  .then((r) => (r.ok ? r.json() : null))
  .then((d) => {
    if (d?.user) {
      try {
        cacheSession(d.user);
      } catch {
        /* ignore */
      }
      location.href = "/app";
    }
  })
  .catch(() => {});

$("forgot").addEventListener("click", (e) => {
  e.preventDefault();
  toast("Şifre sıfırlama yöneticiniz üzerinden yapılır.");
});

async function biometricLogin({ silent = false } = {}) {
  if (!window.PublicKeyCredential) {
    if (!silent) toast("Bu cihaz biyometriyi desteklemiyor.");
    return false;
  }
  const credId = localStorage.getItem("s360_webauthn_cred") || "";
  const username = ($("username").value || localStorage.getItem("s360_user") || "").trim();
  if (!credId && !username) {
    if (!silent) toast("Önce kullanıcı adı girin veya profilden parmak izi ekleyin.");
    return false;
  }
  try {
    const options = await api("/api/auth/webauthn/login/options", {
      method: "POST",
      body: { credId, username },
    });
    const assertion = await window.waGet(options);
    const data = await api("/api/auth/webauthn/login/verify", {
      method: "POST",
      body: { userId: options.userId, response: assertion },
    });
    if (data.user) {
      cacheSession(data.user);
      if (assertion.id) localStorage.setItem("s360_webauthn_cred", assertion.id);
      location.href = "/app";
      return true;
    }
  } catch (err) {
    if (!silent) toast(err.message || "Biyometrik giriş başarısız");
  }
  return false;
}

$("bio").addEventListener("click", () => biometricLogin({ silent: false }));

// Kayıtlı parmak izi varsa otomatik dene (telefon PWA)
if (localStorage.getItem("s360_webauthn_cred") && window.PublicKeyCredential) {
  setTimeout(() => {
    if (document.visibilityState === "visible") biometricLogin({ silent: true });
  }, 400);
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("error").textContent = "";
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: {
        username: $("username").value,
        password: $("password").value,
      },
    });
    if ($("remember").checked) localStorage.setItem("s360_user", $("username").value);
    else localStorage.removeItem("s360_user");
    cacheSession(data.user);
    location.href = "/app";
  } catch (err) {
    $("error").textContent = err.message;
  }
});
