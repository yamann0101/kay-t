const titles = {
  dash: ["Özet", "Sistemin genel durumu"],
  visitors: ["Ziyaretçiler", "Kayıt, Excel, silme"],
  users: ["Kullanıcılar", "Ekle, güncelle, sil"],
  keys: ["Anahtarlar", "Bölüm, numara, isim ve sık kullanılan"],
  logs: ["Loglar", "Tüm işlem geçmişi"],
  announce: ["Duyurular", "Saha duyurularını yönet"],
  push: ["Bildirim", "Cihazlara anlık mesaj"],
  settings: ["Ayarlar", "Form, hatırlatma ve kopya metinleri"],
  backup: ["Yedekleme", "İndir, yükle veya veri temizle"],
};

let visitorFields = [];

function showAdmin(name) {
  document.querySelectorAll(".admin-view").forEach((v) => v.classList.remove("active"));
  document.getElementById(`view-${name}`).classList.add("active");
  document.querySelectorAll(".aside nav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === name);
  });
  document.getElementById("pageTitle").textContent = titles[name][0];
  document.getElementById("pageSub").textContent = titles[name][1];
  document.getElementById("aside").classList.remove("open");
  document.getElementById("asideBg").classList.add("hidden");
}

document.querySelectorAll(".aside nav button").forEach((b) => {
  b.onclick = () => {
    showAdmin(b.dataset.view);
    if (b.dataset.view === "users") loadUsers();
    if (b.dataset.view === "keys") {
      loadSections();
      loadKeys();
    }
    if (b.dataset.view === "logs") loadLogs();
    if (b.dataset.view === "announce") loadAnn();
    if (b.dataset.view === "settings") loadSettings();
    if (b.dataset.view === "visitors") loadVisitors();
  };
});

document.getElementById("openAside").onclick = () => {
  document.getElementById("aside").classList.add("open");
  document.getElementById("asideBg").classList.remove("hidden");
};
document.getElementById("asideBg").onclick = () => {
  document.getElementById("aside").classList.remove("open");
  document.getElementById("asideBg").classList.add("hidden");
};

document.getElementById("logout").onclick = async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  location.href = "/";
};

async function downloadUrl(url, filename) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("İndirme başarısız");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function uploadSheet(url, file) {
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".xlsx")) {
    throw new Error("xlsx yerine CSV veya panelden indirdiğiniz Excel (.xls) dosyasını yükleyin");
  }
  const text = await file.text();
  if (text.startsWith("PK")) {
    throw new Error("xlsx yerine CSV veya panelden indirdiğiniz Excel (.xls) dosyasını yükleyin");
  }
  return api(url, { method: "POST", body: { text } });
}

function bindFile(btnId, inputId, handler) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;
  btn.onclick = () => input.click();
  input.onchange = async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      await handler(file);
    } catch (err) {
      toast(err.message || "Yükleme başarısız");
    }
  };
}

async function loadDash() {
  const o = await api("/api/admin/overview");
  document.getElementById("k-users").textContent = o.users;
  document.getElementById("k-keys").textContent = o.keys;
  document.getElementById("k-visitors").textContent = o.visitors;
  document.getElementById("k-today").textContent = o.today;
  document.getElementById("k-logs").textContent = o.logs;
  const logs = await api("/api/admin/logs?limit=8");
  document.getElementById("dashLogs").innerHTML = logs.items
    .map(
      (l) =>
        `<tr><td>${fmtDateTime(l.created_at)}</td><td>${l.full_name || "—"}</td><td>${l.action}</td><td>${l.detail || ""}</td></tr>`
    )
    .join("");
}

async function loadUsers() {
  const { items } = await api("/api/admin/users");
  document.getElementById("userRows").innerHTML = items
    .map(
      (u) => `
      <tr>
        <td>${u.full_name}</td>
        <td>${u.username}</td>
        <td><span class="badge ${u.role}">${u.role}</span></td>
        <td><input type="checkbox" data-chat-mgr="${u.id}" ${u.chat_manager || u.role === "admin" || u.role === "supervisor" ? "checked" : ""} ${u.role === "admin" || u.role === "supervisor" ? "disabled" : ""} title="Sohbet yöneticisi"/></td>
        <td><button class="btn danger small" data-del-user="${u.id}">Sil</button></td>
      </tr>`
    )
    .join("");
  document.querySelectorAll("[data-del-user]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Kullanıcı silinsin mi?")) return;
      try {
        await api(`/api/admin/users/${b.dataset.delUser}`, { method: "DELETE" });
        toast("Silindi");
        loadUsers();
        loadDash();
      } catch (err) {
        toast(err.message);
      }
    };
  });
  document.querySelectorAll("[data-chat-mgr]").forEach((b) => {
    b.onchange = async () => {
      try {
        await api(`/api/admin/users/${b.dataset.chatMgr}`, {
          method: "PATCH",
          body: { chat_manager: b.checked },
        });
        toast(b.checked ? "Sohbet yöneticisi eklendi" : "Sohbet yöneticisi kaldırıldı");
      } catch (err) {
        toast(err.message);
        b.checked = !b.checked;
      }
    };
  });
}

document.getElementById("userForm").onsubmit = async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target).entries());
  try {
    await api("/api/admin/users", { method: "POST", body });
    e.target.reset();
    toast("Kullanıcı eklendi");
    loadUsers();
  } catch (err) {
    toast(err.message);
  }
};

const KEY_STATUS_TR = { available: "Ofiste", taken: "Teslimde", lost: "Kayıp / Bakım" };

async function loadSections() {
  const { items } = await api("/api/admin/key-sections");
  const sel = document.getElementById("keySectionSelect");
  const cur = sel.value;
  sel.innerHTML =
    `<option value="">Bölüm seç</option>` +
    (items || []).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
  if (cur) sel.value = cur;
  document.getElementById("sectionRows").innerHTML = (items || [])
    .map(
      (s) => `
      <div class="section-item">
        <b>${esc(s.name)}</b>
        <button class="btn danger small" type="button" data-del-sec="${s.id}">Sil</button>
      </div>`
    )
    .join("") || `<p class="muted">Henüz bölüm yok</p>`;
  document.querySelectorAll("[data-del-sec]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Bölüm silinsin mi? Anahtarlar silinmez.")) return;
      await api(`/api/admin/key-sections/${b.dataset.delSec}`, { method: "DELETE" });
      toast("Bölüm silindi");
      loadSections();
      loadKeys();
    };
  });
}

async function loadKeys() {
  const { items } = await api("/api/admin/keys");
  document.getElementById("keyRows").innerHTML = items
    .map(
      (k) => `
      <tr>
        <td>${esc(k.code)}</td>
        <td>${esc(k.name)}${k.holder_name ? " · " + esc(k.holder_name) : ""}</td>
        <td>${esc(k.section_name || "—")}</td>
        <td>${KEY_STATUS_TR[k.status] || k.status}</td>
        <td><button class="star-btn${k.pinned ? " on" : ""}" type="button" data-pin="${k.id}" data-on="${k.pinned ? "1" : ""}">${k.pinned ? "★" : "☆"}</button></td>
        <td><button class="btn danger small" data-del-key="${k.id}">Sil</button></td>
      </tr>`
    )
    .join("");
  document.querySelectorAll("[data-del-key]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Anahtar silinsin mi?")) return;
      await api(`/api/admin/keys/${b.dataset.delKey}`, { method: "DELETE" });
      toast("Silindi");
      loadKeys();
    };
  });
  document.querySelectorAll("[data-pin]").forEach((b) => {
    b.onclick = async () => {
      await api(`/api/admin/keys/${b.dataset.pin}`, {
        method: "PATCH",
        body: { pinned: b.dataset.on !== "1" },
      });
      loadKeys();
    };
  });
}

document.getElementById("sectionForm").onsubmit = async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target).entries());
  try {
    await api("/api/admin/key-sections", { method: "POST", body });
    e.target.reset();
    toast("Bölüm eklendi");
    loadSections();
  } catch (err) {
    toast(err.message);
  }
};

document.getElementById("keyForm").onsubmit = async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target).entries());
  body.pinned = Boolean(body.pinned);
  body.section_id = body.section_id || null;
  try {
    await api("/api/admin/keys", { method: "POST", body });
    e.target.reset();
    toast("Anahtar eklendi");
    loadKeys();
  } catch (err) {
    toast(err.message);
  }
};

document.getElementById("exportKeysXls").onclick = async () => {
  await downloadUrl("/api/admin/keys/export", `s360-anahtarlar-${Date.now()}.xls`);
};
document.getElementById("exportKeysCsv").onclick = async () => {
  await downloadUrl("/api/admin/keys/export?format=csv", `s360-anahtarlar-${Date.now()}.csv`);
};
bindFile("importKeysBtn", "importKeysFile", async (file) => {
  const r = await uploadSheet("/api/admin/keys/import", file);
  toast(`${r.added} anahtar eklendi`);
  loadKeys();
  loadDash();
});

async function loadLogs() {
  const { items } = await api("/api/admin/logs?limit=200");
  document.getElementById("logRows").innerHTML = items
    .map(
      (l) =>
        `<tr><td>${fmtDateTime(l.created_at)}</td><td>${l.full_name || "—"}</td><td>${l.action}</td><td>${l.detail || ""}</td><td>${l.ip || ""}</td></tr>`
    )
    .join("");
}

async function loadAnn() {
  const { items } = await api("/api/app/announcements");
  document.getElementById("annRows").innerHTML = items
    .map(
      (a) => `
      <div class="item-row" style="border-bottom:1px solid rgba(255,255,255,.06);padding:10px 0">
        <div><b>${a.title}</b><div class="muted">${a.body}</div></div>
        <button class="btn danger small" data-del-ann="${a.id}">Sil</button>
      </div>`
    )
    .join("");
  document.querySelectorAll("[data-del-ann]").forEach((b) => {
    b.onclick = async () => {
      await api(`/api/admin/announcements/${b.dataset.delAnn}`, { method: "DELETE" });
      loadAnn();
    };
  });
}

document.getElementById("annForm").onsubmit = async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target).entries());
  await api("/api/admin/announcements", { method: "POST", body });
  e.target.reset();
  toast("Duyuru yayınlandı");
  loadAnn();
};

document.getElementById("pushForm").onsubmit = async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target).entries());
  const r = await api("/api/admin/notify", { method: "POST", body });
  toast(`Gönderildi (${r.sent} cihaz)`);
};

async function loadVisitors() {
  const q = document.getElementById("visitorSearch").value.trim();
  const url = q ? `/api/admin/visitors?q=${encodeURIComponent(q)}` : "/api/admin/visitors";
  const { items, fields } = await api(url);
  visitorFields = fields || visitorFields;
  const cols = (fields || []).filter((f) => f.enabled);
  document.getElementById("visitorHead").innerHTML = `<tr>${cols
    .map((f) => `<th>${f.label}</th>`)
    .join("")}<th></th></tr>`;
  document.getElementById("visitorRows").innerHTML = items.length
    ? items
        .map(
          (v) => `<tr>${cols
            .map((f) => `<td>${esc(v[f.key] ?? "")}</td>`)
            .join("")}<td><button class="btn danger small" data-del-vis="${v.id}">Sil</button></td></tr>`
        )
        .join("")
    : `<tr><td colspan="${cols.length + 1}">Kayıt yok</td></tr>`;
  document.querySelectorAll("[data-del-vis]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Ziyaretçi kaydı silinsin mi?")) return;
      await api(`/api/admin/visitors/${b.dataset.delVis}`, { method: "DELETE" });
      toast("Silindi");
      loadVisitors();
      loadDash();
    };
  });
}

function esc(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

let searchTimer = 0;
document.getElementById("visitorSearch").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadVisitors, 250);
});

async function exportVisitors(format) {
  const ext = format === "csv" ? "csv" : "xls";
  const q = format === "csv" ? "?format=csv" : "";
  await downloadUrl(`/api/admin/visitors/export${q}`, `s360-ziyaretciler-${Date.now()}.${ext}`);
}

document.getElementById("exportVisitorsXls").onclick = () => exportVisitors("xls");
document.getElementById("exportVisitorsCsv").onclick = () => exportVisitors("csv");
document.getElementById("backupExportXls").onclick = () => exportVisitors("xls");
document.getElementById("backupExportCsv").onclick = () => exportVisitors("csv");
bindFile("importVisitorsBtn", "importVisitorsFile", async (file) => {
  const r = await uploadSheet("/api/admin/visitors/import", file);
  toast(`${r.added} kayıt yüklendi${r.failed ? `, ${r.failed} hatalı` : ""}`);
  loadVisitors();
  loadDash();
});

document.getElementById("downloadBackup").onclick = async () => {
  await downloadUrl("/api/admin/backup", `s360-yedek-${Date.now()}.json`);
};

bindFile("restoreBackupBtn", "restoreBackupFile", async (file) => {
  if (!confirm("Yedek yüklenecek. Ziyaretçi, anahtar ve hareket verileri değişir. Devam?")) return;
  const data = JSON.parse(await file.text());
  if (!data.tables) throw new Error("Geçersiz yedek dosyası");
  const r = await api("/api/admin/backup/restore", { method: "POST", body: data });
  toast(`Yedek yüklendi (${r.restored?.visitors || 0} ziyaretçi)`);
  loadDash();
});

document.querySelectorAll("[data-purge]").forEach((b) => {
  b.onclick = async () => {
    if (!confirm("Bu veriler kalıcı silinecek. Emin misiniz?")) return;
    await api("/api/admin/purge", { method: "POST", body: { target: b.dataset.purge } });
    toast("Silindi");
    loadDash();
    if (document.getElementById("view-visitors").classList.contains("active")) loadVisitors();
  };
});

const TYPE_LABELS = { sevkiyat: "Sevkiyat", gorusme: "Görüşme", calisma: "Çalışma" };

function renderFields() {
  document.getElementById("fieldRows").innerHTML = visitorFields
    .map(
      (f, i) => `
      <div class="field-row" data-idx="${i}">
        <button type="button" class="icon-btn" data-up="${i}" ${i === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="icon-btn" data-down="${i}" ${i === visitorFields.length - 1 ? "disabled" : ""}>↓</button>
        <input type="text" data-label="${i}" value="${esc(f.label)}" placeholder="Başlık" />
        <select data-type="${i}" ${f.builtin ? "disabled" : ""}>
          <option value="text" ${f.type !== "textarea" ? "selected" : ""}>Metin</option>
          <option value="textarea" ${f.type === "textarea" ? "selected" : ""}>Uzun metin</option>
        </select>
        <label class="chk"><input type="checkbox" data-req="${i}" ${f.required ? "checked" : ""} ${f.readonly ? "disabled" : ""}/> Zorunlu</label>
        <label class="chk"><input type="checkbox" data-en="${i}" ${f.enabled ? "checked" : ""}/> Görünür</label>
        ${
          f.builtin
            ? `<span class="muted">Sistem</span>`
            : `<button type="button" class="btn danger small" data-del-field="${i}">Sil</button>`
        }
      </div>`
    )
    .join("");

  document.querySelectorAll("[data-up]").forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.up);
      if (i < 1) return;
      [visitorFields[i - 1], visitorFields[i]] = [visitorFields[i], visitorFields[i - 1]];
      renderFields();
    };
  });
  document.querySelectorAll("[data-down]").forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.down);
      if (i >= visitorFields.length - 1) return;
      [visitorFields[i + 1], visitorFields[i]] = [visitorFields[i], visitorFields[i + 1]];
      renderFields();
    };
  });
  document.querySelectorAll("[data-label]").forEach((el) => {
    el.oninput = () => {
      visitorFields[Number(el.dataset.label)].label = el.value;
    };
  });
  document.querySelectorAll("[data-type]").forEach((el) => {
    el.onchange = () => {
      visitorFields[Number(el.dataset.type)].type = el.value;
    };
  });
  document.querySelectorAll("[data-req]").forEach((el) => {
    el.onchange = () => {
      visitorFields[Number(el.dataset.req)].required = el.checked;
    };
  });
  document.querySelectorAll("[data-en]").forEach((el) => {
    el.onchange = () => {
      visitorFields[Number(el.dataset.en)].enabled = el.checked;
    };
  });
  document.querySelectorAll("[data-del-field]").forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.delField);
      if (visitorFields[i]?.builtin) return;
      visitorFields.splice(i, 1);
      renderFields();
    };
  });
}

async function loadSettings() {
  const s = await api("/api/admin/settings");
  const cur = s.default_visitor_type || "sevkiyat";
  document.getElementById("currentDefault").textContent = TYPE_LABELS[cur] || cur;
  document.querySelectorAll(".pick").forEach((b) => {
    b.classList.toggle("active", b.dataset.type === cur);
  });
  visitorFields = s.visitor_fields || [];
  renderFields();
  const shift = s.shift_reminders || {};
  document.getElementById("shiftEnabled").checked = shift.enabled !== false;
  document.getElementById("shiftMorning").value = shift.morning || "08:00";
  document.getElementById("shiftLunch").value = shift.lunch || "12:00";
  document.getElementById("shiftEvening").value = shift.evening || "18:00";
  document.getElementById("shiftMorningText").value = shift.morning_text || "";
  document.getElementById("shiftLunchText").value = shift.lunch_text || "";
  document.getElementById("shiftEveningText").value = shift.evening_text || "";
  const copy = s.copy_templates || {};
  document.getElementById("copySevkiyat").value = copy.sevkiyat || "";
  document.getElementById("copyGorusme").value = copy.gorusme || "";
  document.getElementById("copyCalisma").value = copy.calisma || "";
  const chatOnly = document.getElementById("adminChatManagersOnly");
  if (chatOnly) chatOnly.checked = Boolean(s.chat_managers_only);
}

document.getElementById("addFieldBtn").onclick = () => {
  const n = visitorFields.filter((f) => !f.builtin).length + 1;
  visitorFields.push({
    key: `c_yeni_${Date.now()}`,
    label: `Yeni sütun ${n}`,
    type: "text",
    required: false,
    enabled: true,
    builtin: false,
  });
  renderFields();
  document.querySelector(".field-row:last-child input[type='text']")?.focus();
};

document.getElementById("saveFieldsBtn").onclick = async () => {
  const r = await api("/api/admin/settings", {
    method: "PATCH",
    body: { visitor_fields: visitorFields },
  });
  visitorFields = r.visitor_fields || visitorFields;
  renderFields();
  toast("Sütunlar kaydedildi");
};

document.querySelectorAll(".pick").forEach((b) => {
  b.onclick = async () => {
    const r = await api("/api/admin/settings", {
      method: "PATCH",
      body: { default_visitor_type: b.dataset.type },
    });
    toast("Varsayılan ekran güncellendi");
    document.getElementById("currentDefault").textContent = TYPE_LABELS[r.default_visitor_type];
    document.querySelectorAll(".pick").forEach((x) => {
      x.classList.toggle("active", x.dataset.type === r.default_visitor_type);
    });
  };
});

document.getElementById("saveShiftBtn").onclick = async () => {
  await api("/api/admin/settings", {
    method: "PATCH",
    body: {
      shift_reminders: {
        enabled: document.getElementById("shiftEnabled").checked,
        morning: document.getElementById("shiftMorning").value,
        lunch: document.getElementById("shiftLunch").value,
        evening: document.getElementById("shiftEvening").value,
        morning_text: document.getElementById("shiftMorningText").value,
        lunch_text: document.getElementById("shiftLunchText").value,
        evening_text: document.getElementById("shiftEveningText").value,
      },
    },
  });
  toast("Hatırlatmalar kaydedildi");
};

document.getElementById("saveCopyBtn").onclick = async () => {
  await api("/api/admin/settings", {
    method: "PATCH",
    body: {
      copy_templates: {
        sevkiyat: document.getElementById("copySevkiyat").value,
        gorusme: document.getElementById("copyGorusme").value,
        calisma: document.getElementById("copyCalisma").value,
      },
    },
  });
  toast("Kopya şablonları kaydedildi");
};

document.getElementById("saveChatAdminBtn")?.addEventListener("click", async () => {
  await api("/api/admin/settings", {
    method: "PATCH",
    body: { chat_managers_only: document.getElementById("adminChatManagersOnly").checked },
  });
  toast("Sohbet ayarı kaydedildi");
});

(async function boot() {
  try {
    const { user } = await api("/api/auth/me");
    if (user.role !== "admin") {
      location.href = "/app";
      return;
    }
  } catch {
    location.href = "/";
    return;
  }
  loadDash();
})();
