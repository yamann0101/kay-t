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
    if (d?.user) location.href = "/app";
  })
  .catch(() => {});

$("forgot").addEventListener("click", (e) => {
  e.preventDefault();
  toast("Şifre sıfırlama yöneticiniz üzerinden yapılır.");
});

$("bio").addEventListener("click", async () => {
  if (!window.PublicKeyCredential) {
    toast("Bu cihaz biyometriyi desteklemiyor.");
    return;
  }
  toast("Biyometrik giriş bir sonraki adımda aktifleştirilecek.");
});

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
    location.href = data.user.role === "admin" ? "/app" : "/app";
  } catch (err) {
    $("error").textContent = err.message;
  }
});
