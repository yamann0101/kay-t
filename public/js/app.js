let me = null;
let defaultVisitType = "calisma";
let currentVisitType = "calisma";
let copyTemplates = {
  sevkiyat: "SEVKİYAT YAPMAK İÇİN GİRİŞ YAPTI KONTROLLER YAPILDI İLGİLİ KİŞİLER BİLGİLENDİRİLDİ VE GİRİŞ YAPTI",
  gorusme: "GÖRÜŞME YAPMAK İÇİN GİRİŞ YAPTI KONTROLLER YAPILDI İLGİLİ KİŞİLER BİLGİLENDİRİLDİ VE GİRİŞ YAPTI",
  calisma: "ÇALIŞMA YAPMAK İÇİN GİRİŞ YAPTI KONTROLLER YAPILDI İLGİLİ KİŞİLER BİLGİLENDİRİLDİ VE GİRİŞ YAPTI",
  kargo_al: "KARGOYU TESLİM ALMAK İÇİN GİRİŞ YAPTI KONTROLLER YAPILDI VE GİRİŞ YAPTI",
  kargo_ver: "KARGO TESLİM ETMEK İÇİN GİRİŞ YAPTI KONTROLLER YAPILDI VE GİRİŞ YAPTI",
  yemek: "YEMEK FİRMASI PERSONELLERE YEMEK GETİRDİ KONTROLLER YAPILDI VE ÇIKIŞ YAPTI",
};
let shiftReminders = { enabled: true, morning: "08:00", lunch: "12:00", evening: "18:00" };
let lastNotifStamp = "";

const FORM_SKIP = new Set(["record_no", "visit_type", "entry_type", "vehicle_status"]);

const FIELD_ICONS = {
  first_name: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
  last_name: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
  company: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 21V8l8-4 8 4v13"/><path d="M9 21v-6h6v6"/><path d="M9 10h.01M15 10h.01"/></svg>`,
  plate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 13l2-6h14l2 6"/><path d="M5 13h14v6H5z"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/></svg>`,
  visit_date: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>`,
  entry_time: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  exit_time: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  notes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 3h8l5 5v13H7z"/><path d="M15 3v5h5"/></svg>`,
  default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M4 12h16M4 17h10"/></svg>`,
};

function fieldEl(key) {
  return document.querySelector(`[name="${key}"]`);
}

const VISIT_META = {
  sevkiyat: {
    title: "Sevkiyat",
    desc: "Malzeme, araç veya ürün teslimatı için gelen ziyaretçiler.",
    first: "Ahmet",
    last: "Yılmaz",
    company: "ABC Lojistik",
    notes: "Not ekleyebilirsiniz...",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7h11v10H3z"/><path d="M14 11h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`,
    hint: true,
    info: true,
    checkout: true,
  },
  gorusme: {
    title: "Görüşme",
    desc: "Firma yetkilisi veya personel ile görüşme yapmak için gelen ziyaretçiler.",
    first: "Mehmet",
    last: "Kaya",
    company: "Yaman Group",
    notes: "Görüşme yapılacak kişi, bölüm vb.",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
    hint: true,
    info: true,
    checkout: false,
  },
  calisma: {
    title: "Ziyaretçi Bilgileri",
    desc: "Ziyaretçi bilgilerini eksiksiz doldurun.",
    first: "Adı Soyadı",
    last: "Soyad",
    company: "Firma Adı",
    notes: "Çalışma yapılacak alan, kişi, bölüm vb.",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    hint: true,
    info: true,
    checkout: false,
  },
  kargo: {
    title: "Kargo",
    desc: "Kargo teslim alma veya teslim etme için gelen ziyaretçiler.",
    first: "Can",
    last: "Yıldız",
    company: "Yurtiçi Kargo",
    notes: "Teslim alacak / teslim edecek seçin",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5"/></svg>`,
    hint: true,
    info: true,
    checkout: true,
    cargo: true,
  },
  yemek: {
    title: "Yemek Siparişi",
    desc: "Personellere yemek getiren firma kayıtları.",
    first: "Ayşe",
    last: "Kaya",
    company: "Lezzet Yemek",
    notes: "Personellere yemek getirdi",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 3v8M6 11v10M4 3v5a2 2 0 0 0 4 0V3"/><path d="M18 3v7a2 2 0 0 1-2 2h0V21"/><path d="M16 3h4"/></svg>`,
    hint: false,
    info: false,
    checkout: true,
    food: true,
  },
};

let lastMainView = "home";

function persistView(name) {
  try {
    localStorage.setItem("s360_view", name);
    sessionStorage.setItem("s360_view", name);
  } catch {
    /* ignore */
  }
}

function showView(name) {
  if (name === "chat") {
    openChatPanel();
    return;
  }
  closeChatPanel(false);
  lastMainView = name;
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const el = document.getElementById(`view-${name}`);
  if (el) el.classList.add("active");
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", name !== "visitor-form" && t.dataset.view === name);
  });
  document.querySelectorAll(".drawer nav [data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === name);
  });
  document.getElementById("openRegisterMenu")?.classList.toggle("active", name === "visitor-form");
  document.querySelector(".fab-slot")?.classList.toggle("active", name === "visitor-form");
  document.querySelector(".app-root")?.classList.toggle("reg-mode", name === "visitor-form");
  document.getElementById("chatFab")?.classList.toggle("hidden", name === "visitor-form");
  persistView(name);
  syncChatSwState();
  closeDrawer();
  if (name === "keys") loadKeys();
  if (name === "visitors") {
    visQuick = "in";
    loadVisitors();
  }
  if (name === "alerts") loadAlerts();
  if (name === "directory") loadDirectory();
  if (name === "notifications") loadNotifs();
  if (name === "patrol") loadPatrols();
  if (name === "announcements") loadAnn();
  if (name === "profile") loadProfile();
  if (name === "reminders") loadReminders();
  if (name === "visitor-form") {
    const hasFields = Boolean(document.querySelector("#regFields input, #regFields textarea, #regFields select"));
    if (!hasFields) {
      loadSettings()
        .then(() => {
          renderRegFields();
          fillNowFields();
          bindAlertMatchLive();
        })
        .catch(() => {});
    } else {
      bindAlertMatchLive();
    }
  }
  if (name === "bulk-exit") loadBulkExitPage();
  if (name === "inside") loadInsidePage();
  applyRoleUi();
}

function openChatPanel() {
  window.chatOpen = true;
  const panel = document.getElementById("chatPanel");
  panel?.classList.add("open");
  panel?.setAttribute("aria-hidden", "false");
  document.getElementById("chatFab")?.classList.add("hidden");
  persistView("chat");
  syncChatSwState();
  closeDrawer();
  loadChat();
  bindChatKeyboard();
}

function closeChatPanel(restoreView = true) {
  window.chatOpen = false;
  const panel = document.getElementById("chatPanel");
  panel?.classList.remove("open");
  panel?.setAttribute("aria-hidden", "true");
  document.getElementById("chatSettings")?.classList.add("hidden");
  const onForm = document.getElementById("view-visitor-form")?.classList.contains("active");
  document.getElementById("chatFab")?.classList.toggle("hidden", Boolean(onForm));
  syncChatSwState();
  if (restoreView) {
    const v = lastMainView || "home";
    persistView(v);
  }
}

function bindChatKeyboard() {
  bindGlobalKeyboard();
}

function applyRoleUi() {
  const role = window.currentUser?.role || "guard";
  const root = document.querySelector(".app-root");
  root?.classList.toggle("viewer-mode", role === "viewer");
  root?.classList.toggle("admin-mode", role === "admin");
  document.querySelectorAll(".admin-only").forEach((el) => {
    el.classList.toggle("hidden", role !== "admin");
  });
  const fabFace = document.querySelector(".fab-face");
  const fabSmall = document.querySelector(".fab-slot small");
  if (role === "viewer") {
    if (fabFace) fabFace.textContent = "●";
    if (fabSmall) fabSmall.textContent = "Canlı";
    document.getElementById("fabRegister")?.setAttribute("aria-label", "Canlı Takip");
  } else {
    if (fabFace) fabFace.textContent = "+";
    if (fabSmall) fabSmall.textContent = "Kayıt";
    document.getElementById("fabRegister")?.setAttribute("aria-label", "Ziyaretçi Kaydı");
  }
  // viewer tabs: left visitors, center live/home, right directory
  const tabs = document.querySelectorAll(".tabbar-row > .tab");
  if (tabs.length >= 4 && role === "viewer") {
    tabs[0].dataset.view = "visitors";
    tabs[0].querySelector("span").textContent = "Ziyaret";
    tabs[1].classList.add("hidden");
    tabs[2].dataset.view = "directory";
    tabs[2].querySelector("span").textContent = "Rehber";
    // 4th may be directory originally - hide duplicate
    if (tabs[3]) tabs[3].classList.add("hidden");
  } else if (tabs.length >= 4) {
    tabs[0].dataset.view = "home";
    tabs[0].querySelector("span").textContent = "Ana Sayfa";
    tabs[1].classList.remove("hidden");
    tabs[1].dataset.view = "visitors";
    tabs[1].querySelector("span").textContent = "Ziyaret";
    tabs[2].dataset.view = "announcements";
    tabs[2].querySelector("span").textContent = "Raporlar";
    if (tabs[3]) {
      tabs[3].classList.remove("hidden");
      tabs[3].dataset.view = "directory";
      tabs[3].querySelector("span").textContent = "Rehber";
    }
  }
  document.querySelectorAll(".write-only").forEach((el) => {
    el.classList.toggle("hidden", role === "viewer");
  });
}

function roleLabelOf(role) {
  if (role === "admin") return "Admin";
  if (role === "viewer") return "İzleyici";
  if (role === "supervisor") return "Süpervizör";
  return "Güvenlik";
}

function syncChatSwState() {
  try {
    const open = Boolean(window.chatOpen && document.visibilityState === "visible");
    navigator.serviceWorker?.controller?.postMessage({ type: "CHAT_STATE", open });
  } catch {
    /* ignore */
  }
}

document.addEventListener("visibilitychange", () => syncChatSwState());

function closeDrawer() {
  document.getElementById("drawer").classList.remove("open");
  document.getElementById("drawerBg").classList.remove("open");
}

function openDrawer() {
  document.getElementById("drawer").classList.add("open");
  document.getElementById("drawerBg").classList.add("open");
}

document.getElementById("openMenu").onclick = openDrawer;
document.getElementById("drawerBg").onclick = closeDrawer;
document.getElementById("openNotif").onclick = () => {
  showView("notifications");
  loadNotifs({ markRead: true });
};

document.querySelectorAll("[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

document.querySelectorAll("[data-reg-type]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    if (isViewer()) return toast("İzleyici modunda kayıt yapılamaz");
    await openVisitorRegister();
    setVisitTab(btn.dataset.regType || "calisma");
  });
});
document.getElementById("homeMenuCargo")?.addEventListener("click", async () => {
  if (isViewer()) return toast("İzleyici modunda kayıt yapılamaz");
  await openVisitorRegister();
  setVisitTab("kargo");
});
document.getElementById("homeMenuRegister")?.addEventListener("click", async () => {
  if (isViewer()) return toast("İzleyici modunda kayıt yapılamaz");
  await openVisitorRegister();
});
document.getElementById("homePatrolBtn")?.addEventListener("click", () => showView("patrol"));

document.getElementById("logoutBtn").onclick = async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  cacheSession(null);
  location.href = "/";
};

function greetWord(hour) {
  if (hour >= 5 && hour < 12) return "Günaydın";
  if (hour >= 12 && hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

function ensureDutyStart() {
  try {
    const key = "s360_duty_start";
    let raw = sessionStorage.getItem(key);
    if (!raw) {
      raw = String(Date.now());
      sessionStorage.setItem(key, raw);
    }
    return Number(raw) || Date.now();
  } catch {
    return Date.now();
  }
}

function updateDutyWidgets() {
  const start = ensureDutyStart();
  const mins = Math.max(0, Math.floor((Date.now() - start) / 60000));
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");
  const elapsed = document.getElementById("dutyElapsed");
  if (elapsed) elapsed.textContent = `${hh}:${mm}`;
  const dutyDate = document.getElementById("dutyDate");
  const tp = trParts();
  if (dutyDate) dutyDate.textContent = `${String(tp.day).padStart(2, "0")}.${String(tp.m).padStart(2, "0")}.${tp.y}`;

  const morning = String(shiftReminders.morning || "08:00");
  const evening = String(shiftReminders.evening || "18:00");
  const nowHm = trHm();
  const night = nowHm >= evening || nowHm < morning;
  const shiftName = document.getElementById("shiftName");
  const shiftHours = document.getElementById("shiftHours");
  if (shiftName) shiftName.textContent = night ? "Gece Vardiyası" : "Gündüz Vardiyası";
  if (shiftHours) {
    shiftHours.textContent = night ? `${evening} - ${morning}` : `${morning} - ${evening}`;
  }
}

function updateWeatherStub() {
  const temp = "24°C";
  const desc = "Açık Hava";
  const loc = "Çayırova / Kocaeli";
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set("weatherTemp", temp);
  set("weatherDesc", desc);
  set("weatherLoc", loc);
  set("regWeatherTemp", temp);
}

async function loadHomeAnnounce() {
  const el = document.getElementById("homeAnnounceText");
  if (!el) return;
  try {
    const { items } = await api("/api/app/announcements");
    const first = (items || [])[0];
    el.textContent = first ? `${first.title}${first.body ? ` — ${first.body}` : ""}` : "Duyuru yok";
  } catch {
    el.textContent = "Duyuru yok";
  }
}

function tickClock() {
  const p = nowParts();
  const tp = trParts();
  const dateEl = document.getElementById("dateLine");
  const timeEl = document.getElementById("timeLine");
  if (dateEl) dateEl.textContent = `${tp.day} ${months[tp.m - 1]} ${tp.y} • ${days[tp.weekday]}`;
  if (timeEl) timeEl.textContent = p.time;
  const greet = document.querySelector(".home-greet");
  if (greet) {
    const name = document.getElementById("helloName")?.textContent || "...";
    const hour = Number(tp.hour);
    greet.innerHTML = `${greetWord(Number.isFinite(hour) ? hour : new Date().getHours())}, <b id="helloName">${escHtml(name)}</b>`;
  }
  const full = `${tp.day} ${months[tp.m - 1]} ${tp.y}`;
  document.querySelectorAll(".js-date-full").forEach((el) => {
    el.textContent = full;
  });
  document.querySelectorAll(".js-date-week").forEach((el) => {
    el.textContent = days[tp.weekday];
  });
  updateDutyWidgets();
}

function personIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`;
}

function arrow(dir) {
  if (dir === "giris") {
    return `<svg class="dir" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.4"><path d="M7 17L17 7M9 7h8v8"/></svg>`;
  }
  return `<svg class="dir" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.4"><path d="M17 7L7 17M15 17H7V9"/></svg>`;
}

async function loadHome() {
  const [sum, act] = await Promise.all([
    api("/api/app/summary"),
    api("/api/app/activity").catch(() => ({ items: [] })),
  ]);
  document.getElementById("st-total-giris").textContent = sum.total_giris ?? 0;
  const totalCikisEl = document.getElementById("st-total-cikis");
  if (totalCikisEl) totalCikisEl.textContent = sum.total_cikis ?? 0;
  const stCikis = document.getElementById("st-cikis");
  if (stCikis) stCikis.textContent = sum.cikis ?? 0;
  document.getElementById("st-month-giris").textContent = sum.month_giris ?? 0;
  document.getElementById("st-month-sevkiyat").textContent = sum.month_sevkiyat ?? 0;
  document.getElementById("st-month-gorusme").textContent = sum.month_gorusme ?? 0;
  document.getElementById("st-month-calisma").textContent = sum.month_calisma ?? 0;
  document.getElementById("st-month-kargo").textContent = sum.month_kargo ?? 0;
  document.getElementById("st-month-yemek").textContent = sum.month_yemek ?? 0;
  document.getElementById("st-giris").textContent = sum.giris ?? 0;
  document.getElementById("st-sevkiyat").textContent = sum.sevkiyat ?? 0;
  document.getElementById("st-gorusme").textContent = sum.gorusme ?? 0;
  document.getElementById("st-calisma").textContent = sum.calisma ?? 0;
  document.getElementById("st-kargo").textContent = sum.kargo ?? 0;
  document.getElementById("st-yemek").textContent = sum.yemek ?? 0;

  const items = (act.items || []).slice(0, 6);
  document.getElementById("moves").innerHTML = items.length
    ? items
        .map((row) => {
          if (row.kind === "key") {
            const who = `${row.holder_first_name || ""} ${row.holder_last_name || ""}`.trim() || row.holder_name || "—";
            const isOut = row.action === "iade";
            const actLabel = isOut ? "İade" : row.action === "iptal" ? "İptal" : "Teslim";
            return `
      <div class="move" data-home-key-edit="${row.id}">
        <div class="av">${personIcon()}</div>
        <div class="nm">${escHtml(row.code || "Anahtar")}<small>${escHtml(who)}${row.holder_company ? ` · ${escHtml(row.holder_company)}` : ""}</small></div>
        <div class="move-side">
          <span class="st ${isOut ? "out" : "in"}">${isOut ? "↙" : "↗"} ${escHtml(actLabel)}</span>
          <span class="t">${fmtTime(row.at || row.taken_at)}</span>
        </div>
      </div>`;
          }
          const inside = visInside(row);
          return `
      <div class="move" data-home-edit="${row.id}">
        <div class="av">${personIcon()}</div>
        <div class="nm">${escHtml(row.full_name || "—")}<small>${escHtml(row.company || row.category || "")}</small></div>
        <div class="move-side">
          <span class="st ${inside ? "in" : "out"}">${inside ? "↗ Giriş" : "↙ Çıkış"}</span>
          <span class="t">${row.entry_time || fmtTime(row.created_at || row.at)}</span>
        </div>
      </div>`;
        })
        .join("")
    : `<div class="move"><div class="nm" style="grid-column:1/-1;color:#7a8aa3;font-weight:600">Henüz hareket yok</div></div>`;

  document.querySelectorAll("[data-home-edit]").forEach((b) => {
    b.onclick = () => openVisitorSheet(b.dataset.homeEdit, "edit");
  });
  document.querySelectorAll("[data-home-key-edit]").forEach((b) => {
    b.onclick = async () => {
      if (!(keyCache.items || []).length) await loadKeys();
      openKeyEditSheet(b.dataset.homeKeyEdit);
    };
  });
  loadHomeNotes();
  loadHomeAnnounce().catch(() => {});
  updateWeatherStub();
  updateDutyWidgets();
}

async function loadHomeNotes() {
  const box = document.getElementById("homeNotes");
  if (!box) return;
  try {
    const { items } = await api("/api/app/notes");
    const list = (items || []).slice(0, 4);
    box.innerHTML = list.length
      ? list
          .map(
            (n) =>
              `<div class="hn-item"><b>${escHtml(n.kind === "cargo" ? "Kargo" : "Not")}</b> · ${escHtml(n.created_by_name || "")}: ${escHtml(n.title)}${n.body ? ` — ${escHtml(n.body)}` : ""}${n.photo_url ? ` <img class="hn-thumb" src="${escHtml(n.photo_url)}" alt="" />` : ""}</div>`
          )
          .join("")
      : `<small style="color:#999">Kargo / not yok</small>`;
  } catch {
    box.innerHTML = `<small style="color:#999">Kargo / not yok</small>`;
  }
}

function openNoteSheet(kind) {
  const isCargo = kind === "cargo";
  openSheet(
    isCargo ? "Kargo Bildirimi" : "Not",
    `<form class="sheet-form" id="noteForm">
      <label>Başlık</label>
      <input name="title" value="${isCargo ? "Kargo" : "Not"}" required />
      <label>Açıklama</label>
      <textarea name="body" rows="3" placeholder="Detay yazın"></textarea>
      <label>Fotoğraf</label>
      <div class="note-photo-acts">
        <label class="vis-act note-pick">Galeriden seç
          <input type="file" id="notePhotoGallery" accept="image/*" hidden />
        </label>
        <label class="vis-act note-pick">Kamera
          <input type="file" id="notePhotoCam" accept="image/*" capture="environment" hidden />
        </label>
      </div>
      <img id="notePhotoPrev" class="note-photo-prev hidden" alt="" />
      <button class="sheet-save" type="submit">Herkese Bildir</button>
    </form>`
  );
  let photoData = "";
  const prev = document.getElementById("notePhotoPrev");
  const bindPhoto = (el) => {
    el?.addEventListener("change", () => {
      const f = el.files?.[0];
      if (!f) return;
      if (f.size > 1_800_000) return toast("Fotoğraf 1.5MB altında olmalı");
      const reader = new FileReader();
      reader.onload = () => {
        photoData = String(reader.result || "");
        if (prev) {
          prev.src = photoData;
          prev.classList.remove("hidden");
        }
      };
      reader.readAsDataURL(f);
    });
  };
  bindPhoto(document.getElementById("notePhotoGallery"));
  bindPhoto(document.getElementById("notePhotoCam"));
  document.getElementById("noteForm").onsubmit = async (e) => {
    e.preventDefault();
    if (isViewer()) return toast("İzleyici modunda işlem yapılamaz");
    const fd = new FormData(e.target);
    try {
      await enablePush(true);
      await api("/api/app/notes", {
        method: "POST",
        body: {
          kind: isCargo ? "cargo" : "note",
          title: String(fd.get("title") || "").trim(),
          body: String(fd.get("body") || "").trim(),
          photo_url: photoData || null,
        },
      });
      toast(isCargo ? "Kargo bildirimi gönderildi" : "Not iletildi");
      closeSheet();
      loadHomeNotes();
      loadNotifs();
    } catch (err) {
      toast(err.message || "Gönderilemedi");
    }
  };
}

function isViewer() {
  return window.currentUser?.role === "viewer";
}

function canWrite() {
  return !isViewer();
}

function upsertVisitorCache(v) {
  if (!v?.id) return;
  const i = visitorCache.findIndex((x) => String(x.id) === String(v.id));
  if (i >= 0) visitorCache[i] = { ...visitorCache[i], ...v };
  else visitorCache.unshift(v);
}

const KEY_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="15" r="4"/><path d="M11.5 13.5L21 4v4"/><path d="M17 8h3"/></svg>`;
const STAR_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.6l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.2 7.2 18.5l.9-5.4L4.2 9.3l5.4-.8z"/></svg>`;
let keyCache = { items: [], sections: [] };
let keySectionFilter = "all";
let keyStatusFilter = "all";
let keyAccOpen = {};

function escHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isFav(k) {
  return Boolean(k.favorite) || Boolean(k.pinned);
}

function keyStatusMeta(status) {
  if (status === "taken") return { label: "Teslimde", cls: "teslim" };
  if (status === "lost") return { label: "Kayıp / Bakım", cls: "lost" };
  return { label: "Ofiste", cls: "ofis" };
}

function keyRowHtml(k) {
  const st = keyStatusMeta(k.status);
  const holderName = `${k.holder_first_name || ""} ${k.holder_last_name || ""}`.trim() || k.holder_name || "";
  const holder = holderName ? ` · ${holderName}` : "";
  const company = k.holder_company ? ` · ${k.holder_company}` : "";
  const when = k.status === "taken" && k.taken_at ? ` · ${fmtDateTime(k.taken_at)}` : "";
  return `
    <div class="key-row" data-key-id="${k.id}">
      <div class="ico">${KEY_SVG}</div>
      <div class="key-main" data-key-open="${k.id}">
        <b>${escHtml(k.code)}</b>
        <small>${escHtml(k.name)}${escHtml(holder)}${escHtml(company)}${escHtml(when)}${k.status === "taken" && k.notify_time ? ` · hatırlatma ${escHtml(k.notify_time)}` : ""}</small>
      </div>
      <div class="acts">
        <div class="btns">
          <button type="button" class="key-star${k.favorite ? " on" : ""}" data-fav="${k.id}" aria-label="Favori">${STAR_SVG}</button>
          <span class="key-badge ${st.cls}">${st.label}</span>
        </div>
        <div class="btns">
          <button type="button" class="key-btn" data-act="take" data-key="${k.id}" ${k.status !== "available" ? "disabled" : ""}>Ver</button>
          <button type="button" class="key-btn" data-act="return" data-key="${k.id}" ${k.status !== "taken" ? "disabled" : ""}>Al</button>
        </div>
      </div>
    </div>`;
}

function filteredKeys() {
    const q = foldSearch(document.getElementById("keySearch")?.value || "");
  return (keyCache.items || []).filter((k) => {
    if (keySectionFilter !== "all" && String(k.section_id || "") !== String(keySectionFilter)) return false;
    if (keyStatusFilter !== "all" && k.status !== keyStatusFilter) return false;
    if (!q) return true;
    const blob = foldSearch(`${k.code} ${k.name} ${k.location || ""} ${k.section_name || ""}`);
    return blob.includes(q);
  });
}

function bindKeyActions(root) {
  root.querySelectorAll("[data-act]").forEach((b) => {
    b.onclick = async (e) => {
      e.stopPropagation();
      if (b.disabled) return;
      if (b.dataset.act === "take") {
        openKeyTakeSheet(b.dataset.key);
        return;
      }
      if (b.dataset.act === "return") {
        openKeyReturnSheet(b.dataset.key);
        return;
      }
    };
  });
  root.querySelectorAll("[data-fav]").forEach((b) => {
    b.onclick = async (e) => {
      e.stopPropagation();
      try {
        await api(`/api/app/keys/${b.dataset.fav}/favorite`, { method: "POST" });
        loadKeys();
      } catch (err) {
        toast(err.message || "Favori güncellenemedi");
      }
    };
  });
  root.querySelectorAll("[data-key-open]").forEach((el) => {
    el.onclick = () => openKeyDetailSheet(el.dataset.keyOpen);
  });
}

function renderKeys() {
  const items = filteredKeys();
  const sections = keyCache.sections || [];
  const stats = keyCache.items || [];
  const total = stats.length;
  const taken = stats.filter((k) => k.status === "taken").length;
  const office = stats.filter((k) => k.status === "available").length;
  const lost = stats.filter((k) => k.status === "lost").length;
  document.getElementById("keyStats").innerHTML = `
    <div class="key-stat gold"><i>${KEY_SVG}</i><div><b>${total}</b><span>Toplam Anahtar</span></div></div>
    <div class="key-stat ok"><i>${KEY_SVG}</i><div><b>${taken}</b><span>Teslimde</span></div></div>
    <div class="key-stat blue"><i>${KEY_SVG}</i><div><b>${office}</b><span>Ofiste</span></div></div>
    <div class="key-stat bad"><i>${KEY_SVG}</i><div><b>${lost}</b><span>Kayıp / Bakım</span></div></div>`;

  document.getElementById("keyPills").innerHTML = [
    `<button type="button" class="vis-pill${keySectionFilter === "all" ? " active" : ""}" data-sec="all">${KEY_SVG} Tümü</button>`,
    ...sections.map(
      (s) =>
        `<button type="button" class="vis-pill${String(keySectionFilter) === String(s.id) ? " active" : ""}" data-sec="${s.id}">${KEY_SVG} ${escHtml(s.name)}</button>`
    ),
  ].join("");
  document.querySelectorAll("#keyPills [data-sec]").forEach((b) => {
    b.onclick = () => {
      keySectionFilter = b.dataset.sec;
      renderKeys();
    };
  });

  const statusBox = document.getElementById("keyStatusFilters");
  statusBox.innerHTML = [
    ["all", "Tümü"],
    ["available", "Ofiste"],
    ["taken", "Teslimde"],
    ["lost", "Kayıp / Bakım"],
  ]
    .map(
      ([id, label]) =>
        `<button type="button" class="vis-pill${keyStatusFilter === id ? " active" : ""}" data-kst="${id}">${label}</button>`
    )
    .join("");
  statusBox.querySelectorAll("[data-kst]").forEach((b) => {
    b.onclick = () => {
      keyStatusFilter = b.dataset.kst;
      renderKeys();
    };
  });

  const favs = items.filter(isFav);
  const groups = [];
  for (const s of sections) {
    const list = items.filter((k) => String(k.section_id || "") === String(s.id));
    if (list.length) groups.push({ id: s.id, name: s.name, items: list });
  }
  const other = items.filter((k) => !k.section_id);
  if (other.length) groups.push({ id: "other", name: "Diğer", items: other });

  const chev = `<svg class="acc-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;
  let html = "";
  if (favs.length) {
    const favOpen = keyAccOpen.fav === true ? " open" : "";
    html += `<details class="key-acc key-fav" data-acc="fav"${favOpen}>
      <summary><svg class="acc-ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.6l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.2 7.2 18.5l.9-5.4L4.2 9.3l5.4-.8z"/></svg><em>Favori / Sık Kullanılan</em><span>${favs.length} Anahtar</span>${chev}</summary>
      ${favs.map(keyRowHtml).join("")}
    </details>`;
  }
  if (!items.length) {
    html += `<div class="key-empty">Anahtar bulunamadı</div>`;
  } else {
    html += groups
      .map((g) => {
        const title = /anahtar/i.test(g.name) ? g.name : `${g.name} Anahtarları`;
        const opened = keyAccOpen[g.id] === true ? " open" : "";
        return `<details class="key-acc" data-acc="${g.id}"${opened}>
          <summary><svg class="acc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="15" r="4"/><path d="M11.5 13.5L21 4v4"/><path d="M17 8h3"/></svg><em>${escHtml(title)}</em><span>${g.items.length} Anahtar</span>${chev}</summary>
          ${g.items.map(keyRowHtml).join("")}
        </details>`;
      })
      .join("");
  }
  const list = document.getElementById("keysList");
  list.innerHTML = html;
  list.querySelectorAll("details.key-acc").forEach((d) => {
    d.addEventListener("toggle", () => {
      keyAccOpen[d.dataset.acc] = d.open;
    });
  });
  bindKeyActions(list);
}

async function loadKeys() {
  const data = await api("/api/app/keys");
  keyCache = { items: data.items || [], sections: data.sections || [] };
  renderKeys();
}

function toLocalInputValue(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(v) {
  if (!v) return new Date();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function copyKeyText(k) {
  const name = `${k.holder_first_name || ""} ${k.holder_last_name || ""}`.trim() || k.holder_name || "-";
  const when = k.taken_at ? fmtDateTime(k.taken_at) : "-";
  return [
    "ANAHTAR TESLİMİ",
    `Anahtar: ${k.code || "-"} · ${k.name || "-"}`,
    `Alan: ${name}`,
    `Firma: ${k.holder_company || "-"}`,
    `Veriş tarihi/saati: ${when}`,
  ].join("\n");
}

async function copyText(text) {
  let ok = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch {
    ok = false;
  }
  if (!ok) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ok = document.execCommand("copy");
      ta.remove();
    } catch {
      ok = false;
    }
  }
  if (ok) {
    toast("Kopyalandı");
    if (window.haptic) window.haptic("ok");
  } else toast("Kopyalanamadı");
}

function bindSheetPersonSuggest(form) {
  const fields = ["first_name", "last_name", "company"];
  fields.forEach((key) => {
    const el = form.querySelector(`[name="${key}"]`);
    const box = form.querySelector(`[data-suggest-for="${key}"]`);
    if (!el || !box) return;
    let t = null;
    el.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const q = String(el.value || "").trim();
        if (q.length < 1) {
          box.classList.add("hidden");
          return;
        }
        try {
          const { items } = await api(
            `/api/app/visitors/suggest?q=${encodeURIComponent(q)}&field=${encodeURIComponent(key)}`
          );
          if (!items?.length) {
            box.classList.add("hidden");
            return;
          }
          box.innerHTML = items
            .map(
              (it) => `<button type="button" class="suggest-item" data-sid="${it.id}">
              <b>${escHtml(it.full_name || `${it.first_name || ""} ${it.last_name || ""}`)}</b>
              <span>${escHtml([it.company, it.plate].filter(Boolean).join(" · "))}</span>
            </button>`
            )
            .join("");
          box.classList.remove("hidden");
          box.querySelectorAll(".suggest-item").forEach((btn) => {
            btn.onmousedown = (e) => e.preventDefault();
            btn.onclick = () => {
              const item = items.find((x) => String(x.id) === String(btn.dataset.sid));
              if (!item) return;
              form.querySelector('[name="first_name"]').value = (item.first_name || "").toLocaleUpperCase("tr-TR");
              form.querySelector('[name="last_name"]').value = (item.last_name || "").toLocaleUpperCase("tr-TR");
              form.querySelector('[name="company"]').value = (item.company || "").toLocaleUpperCase("tr-TR");
              box.classList.add("hidden");
            };
          });
        } catch {
          box.classList.add("hidden");
        }
      }, 180);
    });
    el.addEventListener("blur", () => setTimeout(() => box.classList.add("hidden"), 180));
  });
}

function openKeyTakeSheet(id) {
  const key = (keyCache.items || []).find((k) => String(k.id) === String(id));
  openSheet(
    "Anahtar Ver",
    `<form class="sheet-form" id="keyTakeForm">
      <p class="sheet-lead">${escHtml(key ? `${key.code} · ${key.name}` : "Anahtar")}</p>
      <label class="reg-field">
        <span>Adı</span>
        <div class="reg-input"><input name="first_name" autocomplete="off" required /></div>
        <div class="suggest-box hidden" data-suggest-for="first_name"></div>
      </label>
      <label class="reg-field">
        <span>Soyadı</span>
        <div class="reg-input"><input name="last_name" autocomplete="off" required /></div>
        <div class="suggest-box hidden" data-suggest-for="last_name"></div>
      </label>
      <label class="reg-field">
        <span>Firma</span>
        <div class="reg-input"><input name="company" autocomplete="off" /></div>
        <div class="suggest-box hidden" data-suggest-for="company"></div>
      </label>
      <label>Veriş tarihi / saati</label>
      <input type="datetime-local" name="taken_at" value="${toLocalInputValue()}" />
      <label>Bildirim saati</label>
      <input type="time" name="notify_time" value="06:00" />
      <small>Boş bırakılırsa 06:00. Saat gelince bildirim düşer.</small>
      <button class="sheet-save" type="submit">Teslim Et</button>
    </form>`
  );
  const form = document.getElementById("keyTakeForm");
  bindUppercase(form);
  bindSheetPersonSuggest(form);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const notifyTime = String(fd.get("notify_time") || "").trim() || "06:00";
    const taken = fromLocalInputValue(fd.get("taken_at"));
    try {
      await enablePush(true);
      await api(`/api/app/keys/${id}/take`, {
        method: "POST",
        body: {
          notify_time: notifyTime,
          first_name: String(fd.get("first_name") || "").trim(),
          last_name: String(fd.get("last_name") || "").trim(),
          company: String(fd.get("company") || "").trim(),
          taken_at: taken.toISOString(),
        },
      });
      toast(`Teslim edildi · hatırlatma ${notifyTime}`);
      closeSheet();
      loadKeys();
    } catch (err) {
      toast(err.message || "Teslim başarısız");
    }
  };
}

function openKeyReturnSheet(id) {
  const key = (keyCache.items || []).find((k) => String(k.id) === String(id));
  if (!key) return;
  const takenVal = key.taken_at ? toLocalInputValue(new Date(key.taken_at)) : toLocalInputValue();
  openSheet(
    "Anahtar Al",
    `<form class="sheet-form" id="keyReturnForm">
      <p class="sheet-lead">${escHtml(`${key.code} · ${key.name}`)}</p>
      <div class="sheet-kv">
        <div><span>Alan</span><b>${escHtml(`${key.holder_first_name || ""} ${key.holder_last_name || ""}`.trim() || "—")}</b></div>
        <div><span>Firma</span><b>${escHtml(key.holder_company || "—")}</b></div>
      </div>
      <label>Veriş tarihi / saati</label>
      <input type="datetime-local" name="taken_show" value="${takenVal}" />
      <label>İade tarihi / saati</label>
      <input type="datetime-local" name="returned_at" value="${toLocalInputValue()}" />
      <button class="sheet-save" type="submit">İade Al</button>
    </form>`
  );
  document.getElementById("keyReturnForm").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const returned = fromLocalInputValue(fd.get("returned_at"));
    const takenShow = fromLocalInputValue(fd.get("taken_show"));
    try {
      if (key.taken_at && takenShow.toISOString() !== new Date(key.taken_at).toISOString()) {
        await api(`/api/app/keys/${id}/holder`, {
          method: "PATCH",
          body: { taken_at: takenShow.toISOString() },
        });
      }
      await api(`/api/app/keys/${id}/return`, {
        method: "POST",
        body: { returned_at: returned.toISOString() },
      });
      toast("Anahtar iade alındı");
      closeSheet();
      loadKeys();
    } catch (err) {
      toast(err.message || "İade başarısız");
    }
  };
}

function openKeyDetailSheet(id) {
  const key = (keyCache.items || []).find((k) => String(k.id) === String(id));
  if (!key) return;
  const name = `${key.holder_first_name || ""} ${key.holder_last_name || ""}`.trim() || key.holder_name || "—";
  openSheet(
    "Anahtar Detayı",
    `<div class="sheet-kv">
      <div><span>Anahtar</span><b>${escHtml(key.code)} · ${escHtml(key.name)}</b></div>
      <div><span>Durum</span><b>${escHtml(keyStatusMeta(key.status).label)}</b></div>
      <div><span>Alan</span><b>${escHtml(name)}</b></div>
      <div><span>Firma</span><b>${escHtml(key.holder_company || "—")}</b></div>
      <div><span>Veriş</span><b>${key.taken_at ? escHtml(fmtDateTime(key.taken_at)) : "—"}</b></div>
    </div>
    <div class="vis-acts" style="margin-top:10px;flex-wrap:wrap">
      <button type="button" class="vis-act" id="keyCopyBtn">Kopyala</button>
      ${key.status === "taken" ? `<button type="button" class="vis-act edit" id="keyEditBtn">Düzenle</button>` : ""}
      ${key.status === "taken" ? `<button type="button" class="vis-act exit" id="keyReturnBtn">Al</button>` : ""}
      ${key.status === "taken" ? `<button type="button" class="vis-act" id="keyDelBtn" style="border-color:rgba(239,68,68,.5);color:#f87171">Sil</button>` : ""}
      ${key.status === "available" ? `<button type="button" class="vis-act edit" id="keyGiveBtn">Ver</button>` : ""}
    </div>`
  );
  document.getElementById("keyCopyBtn").onclick = () => copyText(copyKeyText(key));
  document.getElementById("keyEditBtn")?.addEventListener("click", () => openKeyEditSheet(id));
  document.getElementById("keyReturnBtn")?.addEventListener("click", () => openKeyReturnSheet(id));
  document.getElementById("keyGiveBtn")?.addEventListener("click", () => openKeyTakeSheet(id));
  document.getElementById("keyDelBtn")?.addEventListener("click", async () => {
    if (!confirm("Teslim kaydı silinsin mi?")) return;
    try {
      await api(`/api/app/keys/${id}/cancel-take`, { method: "POST" });
      toast("Teslim kaydı silindi");
      closeSheet();
      loadKeys();
    } catch (err) {
      toast(err.message || "Silinemedi");
    }
  });
}

function openKeyEditSheet(id) {
  const key = (keyCache.items || []).find((k) => String(k.id) === String(id));
  if (!key) return;
  openSheet(
    "Teslim Düzenle",
    `<form class="sheet-form" id="keyEditForm">
      <label class="reg-field"><span>Adı</span><div class="reg-input"><input name="first_name" value="${escHtml(key.holder_first_name || "")}" /></div><div class="suggest-box hidden" data-suggest-for="first_name"></div></label>
      <label class="reg-field"><span>Soyadı</span><div class="reg-input"><input name="last_name" value="${escHtml(key.holder_last_name || "")}" /></div><div class="suggest-box hidden" data-suggest-for="last_name"></div></label>
      <label class="reg-field"><span>Firma</span><div class="reg-input"><input name="company" value="${escHtml(key.holder_company || "")}" /></div><div class="suggest-box hidden" data-suggest-for="company"></div></label>
      <label>Veriş tarihi / saati</label>
      <input type="datetime-local" name="taken_at" value="${key.taken_at ? toLocalInputValue(new Date(key.taken_at)) : toLocalInputValue()}" />
      <button class="sheet-save" type="submit">Kaydet</button>
    </form>`
  );
  const form = document.getElementById("keyEditForm");
  bindUppercase(form);
  bindSheetPersonSuggest(form);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api(`/api/app/keys/${id}/holder`, {
        method: "PATCH",
        body: {
          first_name: String(fd.get("first_name") || "").trim(),
          last_name: String(fd.get("last_name") || "").trim(),
          company: String(fd.get("company") || "").trim(),
          taken_at: fromLocalInputValue(fd.get("taken_at")).toISOString(),
        },
      });
      toast("Güncellendi");
      closeSheet();
      loadKeys();
    } catch (err) {
      toast(err.message || "Güncellenemedi");
    }
  };
}

function openNewKeySheet() {
  const opts = (keyCache.sections || [])
    .map((s) => `<option value="${s.id}">${escHtml(s.name)}</option>`)
    .join("");
  openSheet(
    "Yeni Anahtar",
    `<form class="sheet-form" id="newKeyForm">
      <label>Numara / Kod</label>
      <input name="code" placeholder="Ü-1" required />
      <label>Anahtar adı</label>
      <input name="name" placeholder="Ana giriş" required />
      <label>Bölüm</label>
      <select name="section_id"><option value="">Bölüm seç</option>${opts}</select>
      <label>Konum</label>
      <input name="location" />
      <label class="check-row"><input type="checkbox" name="pinned" /> Sık kullanılanlara ekle</label>
      <button type="submit" class="sheet-save">Kaydet</button>
    </form>`
  );
  document.getElementById("newKeyForm").onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.pinned = Boolean(body.pinned);
    body.section_id = body.section_id || null;
    try {
      await api("/api/admin/keys", { method: "POST", body });
      closeSheet();
      toast("Anahtar eklendi");
      loadKeys();
    } catch (err) {
      toast(err.message || "Eklenemedi");
    }
  };
}

function foldSearch(value) {
  const map = {
    Ş: "S",
    ş: "S",
    İ: "I",
    I: "I",
    ı: "I",
    i: "I",
    Ü: "U",
    ü: "U",
    Ö: "O",
    ö: "O",
    Ç: "C",
    ç: "C",
    Ğ: "G",
    ğ: "G",
  };
  let out = "";
  for (const ch of String(value || "")) {
    out += map[ch] || ch;
  }
  return out
    .toLocaleUpperCase("en-US")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function showMatchBanner({ title, body, willEnter, kind }) {
  const box = document.getElementById("matchBanner");
  if (!box) return;
  const mode = kind || (willEnter === false ? "no" : willEnter === true ? "yes" : "info");
  box.classList.remove("hidden");
  box.className = `match-banner open ${mode}`;
  box.innerHTML = `
    <div class="match-banner-ico">●</div>
    <div class="match-banner-txt">
      <b>${escHtml(title || "Bildirim")}</b>
      <span>${escHtml(body || "")}</span>
    </div>
    <button type="button" class="match-banner-x" aria-label="Kapat">×</button>`;
  box.querySelector(".match-banner-x").onclick = () => {
    box.classList.remove("open");
    box.classList.add("hidden");
  };
  clearTimeout(window.__matchBannerTimer);
  window.__matchBannerTimer = setTimeout(() => {
    box.classList.remove("open");
    box.classList.add("hidden");
  }, 16000);
  if (window.haptic) window.haptic("ok");
  if (typeof playNotifyBeep === "function") playNotifyBeep();
}

function showLivePushBanner({ title, body, notifType }) {
  if (notifType === "chat" && window.chatOpen) return;
  if (notifType === "alert" || /beklenen/i.test(String(title || ""))) {
    const willEnter = !/GİRMEYECEK|GIRMEYECEK/i.test(String(body || ""));
    showMatchBanner({ title, body, willEnter });
    return;
  }
  const kind =
    notifType === "emergency" || notifType === "admin" ? "no" : notifType === "cargo" || notifType === "key" ? "yes" : "info";
  showMatchBanner({ title: title || "S-360", body, kind });
}

let alertMatchTimer = 0;
let lastAlertMatchKey = "";

async function checkAlertMatchLive() {
  const first = String(fieldEl("first_name")?.value || "").trim();
  const last = String(fieldEl("last_name")?.value || "").trim();
  const company = String(fieldEl("company")?.value || "").trim();
  const plate = String(fieldEl("plate")?.value || "").trim();
  const notes = String(fieldEl("notes")?.value || "").trim();
  // Her alandan en az 2 karakter yazılınca eşleşme dene
  if (first.length < 2 && last.length < 2 && company.length < 2 && plate.length < 2 && notes.length < 2) {
    return;
  }
  const key = `${foldSearch(first)}|${foldSearch(last)}|${foldSearch(company)}|${foldSearch(plate)}|${foldSearch(notes)}`;
  if (key === lastAlertMatchKey) return;
  lastAlertMatchKey = key;
  try {
    const q = new URLSearchParams({
      first_name: first,
      last_name: last,
      company,
      plate,
      notes,
    });
    const { items } = await api(`/api/app/alerts/match?${q}`);
    if (!items?.length) return;
    const a = items[0];
    const willEnter = !(a.will_enter === false || a.will_enter === "false" || a.will_enter === 0);
    const name = [a.first_name, a.last_name].filter(Boolean).join(" ") || a.full_name || "";
    showMatchBanner({
      title: willEnter ? "Haber Ver eşleşti · İçeri GİRECEK" : "Haber Ver eşleşti · İçeri GİRMEYECEK",
      body: `${name}${a.company ? ` · ${a.company}` : ""}${a.notes ? ` · ${a.notes}` : ""}`,
      willEnter,
    });
  } catch {
    /* ignore */
  }
}

function bindAlertMatchLive() {
  const form = document.getElementById("visitorForm");
  if (!form) return;
  if (form.dataset.alertMatchBound === "1") return;
  form.dataset.alertMatchBound = "1";
  const kick = () => {
    clearTimeout(alertMatchTimer);
    lastAlertMatchKey = "";
    alertMatchTimer = setTimeout(() => checkAlertMatchLive(), 200);
  };
  form.addEventListener("input", (e) => {
    const n = e.target?.name;
    if (!n) return;
    if (["first_name", "last_name", "company", "plate", "notes", "host", "phone"].includes(n)) kick();
  });
}

function bindUppercase(root = document) {
  const skip = new Set(["notes", "message", "password", "phone", "id_no", "full_name"]);
  const skipId = new Set(["visSearch", "keySearch", "dirSearch", "pfName", "pfPhone", "pfId", "pfShoe", "pfPants", "pfShirt", "pfCoat", "pfSweater", "bioPassword"]);
  (root.querySelectorAll ? root : document).querySelectorAll("input, textarea").forEach((el) => {
    if (el.closest("#profileForm") || el.closest("#passwordForm")) return;
    if (["password", "date", "time", "hidden", "checkbox", "radio", "file", "email", "tel"].includes(el.type)) return;
    if (skip.has(el.name) || skipId.has(el.id)) return;
    if (el.dataset.upperBound) return;
    el.dataset.upperBound = "1";
    el.addEventListener("input", () => {
      const s = el.selectionStart;
      const e = el.selectionEnd;
      const next = String(el.value || "").toLocaleUpperCase("tr-TR");
      if (el.value === next) return;
      el.value = next;
      try {
        el.setSelectionRange(s, e);
      } catch {
        /* ignore */
      }
    });
  });
}

const TYPE_TR = {
  sevkiyat: "Sevkiyat",
  gorusme: "Görüşme",
  calisma: "Çalışma",
  kargo: "Kargo",
  yemek: "Yemek Siparişi",
};
let visitorCache = [];
let visPage = 1;
const VIS_PAGE = 8;
let visTypeFilter = "all";
let visQuick = "in";
window.currentUser = null;
window.chatOpen = false;
let chatReplyTo = null;
let lastChatStamp = "";

function visTypeOf(v) {
  if (["gorusme", "calisma", "sevkiyat", "kargo", "yemek"].includes(v.visit_type)) return v.visit_type;
  const c = String(v.category || "").toLowerCase();
  if (c.includes("görüş") || c.includes("gorus")) return "gorusme";
  if (c.includes("çalış") || c.includes("calis")) return "calisma";
  if (c.includes("kargo")) return "kargo";
  if (c.includes("yemek")) return "yemek";
  return "sevkiyat";
}

function visInside(v) {
  return !v.exited_at && !v.exited;
}

function visToday(v) {
  const stamp = trTodayStamp();
  if (v.last_visit_date && String(v.last_visit_date).includes(stamp.slice(0, 5))) return true;
  if (v.visit_date && String(v.visit_date).includes(stamp.slice(0, 5))) return true;
  const created = new Date(v.last_visit_at || v.created_at);
  if (Number.isNaN(created.getTime())) return false;
  const c = trParts(created);
  const t = trParts();
  return c.y === t.y && c.m === t.m && c.day === t.day;
}

function visEntry(v) {
  if (String(v.plate || "").trim()) return "ARAÇLI";
  const t = String(v.entry_type || "").toLocaleUpperCase("tr-TR");
  if (t === "ARAÇLI" || t === "ARACLI") return "ARAÇLI";
  return "YAYAN";
}

function visEntryKind(v) {
  return visEntry(v) === "ARAÇLI" ? "car" : "walk";
}

function visEntryLabel(v) {
  return visEntryKind(v) === "car" ? "Araçlı giriş" : "Yayan giriş";
}

function filteredVisitors() {
  const q = foldSearch(document.getElementById("visSearch")?.value || "");
  const typeBtn = visTypeFilter || "all";
  const status = document.getElementById("visStatus")?.value || "all";
  const entry = document.getElementById("visEntry")?.value || "all";
  const date = document.getElementById("visDate")?.value || "";
  const sort = document.getElementById("visSort")?.value || "new";
  let list = visitorCache.slice();
  if (typeBtn !== "all") list = list.filter((v) => visTypeOf(v) === typeBtn);
  if (status === "in" || visQuick === "in") list = list.filter(visInside);
  if (status === "out") list = list.filter((v) => !visInside(v));
  if (visQuick === "today") list = list.filter(visToday);
  if (visQuick === "car" || entry === "ARAÇLI") list = list.filter((v) => visEntryKind(v) === "car");
  if (visQuick === "walk" || entry === "YAYAN") list = list.filter((v) => visEntryKind(v) === "walk");
  if (date) {
    const [y, m, d] = date.split("-");
    const stamp = `${d}.${m}.${y}`;
    list = list.filter(
      (v) =>
        String(v.last_visit_date || "").includes(stamp) ||
        String(v.first_visit_date || "").includes(stamp) ||
        String(v.visit_date || "").includes(stamp) ||
        String(v.created_at || "").startsWith(date)
    );
  }
  if (q) {
    list = list.filter((v) =>
      foldSearch([v.full_name, v.first_name, v.last_name, v.company, v.plate, v.notes, v.host, v.record_no].join(" ")).includes(q)
    );
  }
  list.sort((a, b) => {
    if (sort === "visits") return (b.visit_count || 0) - (a.visit_count || 0);
    const da = new Date(a.last_visit_at || a.created_at).getTime();
    const db = new Date(b.last_visit_at || b.created_at).getTime();
    return sort === "old" ? da - db : db - da;
  });
  return list;
}

function visIcon(type) {
  if (type === "gorusme") return VISIT_META.gorusme.icon;
  if (type === "calisma") return VISIT_META.calisma.icon;
  if (type === "kargo") return VISIT_META.kargo.icon;
  if (type === "yemek") return VISIT_META.yemek.icon;
  return VISIT_META.sevkiyat.icon;
}

function renderVisitors() {
  const all = visitorCache;
  const counts = {
    all: all.length,
    sevkiyat: all.filter((v) => visTypeOf(v) === "sevkiyat").length,
    gorusme: all.filter((v) => visTypeOf(v) === "gorusme").length,
    calisma: all.filter((v) => visTypeOf(v) === "calisma").length,
    kargo: all.filter((v) => visTypeOf(v) === "kargo").length,
    yemek: all.filter((v) => visTypeOf(v) === "yemek").length,
  };
  const active = visTypeFilter || "all";
  document.getElementById("visPills").innerHTML = [
    ["all", "Tümü", counts.all, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`],
    ["sevkiyat", "Sevkiyat", counts.sevkiyat, visIcon("sevkiyat")],
    ["gorusme", "Görüşme", counts.gorusme, visIcon("gorusme")],
    ["calisma", "Çalışma", counts.calisma, visIcon("calisma")],
    ["kargo", "Kargo", counts.kargo, visIcon("kargo")],
    ["yemek", "Yemek", counts.yemek, visIcon("yemek")],
  ]
    .map(
      ([key, label, n, ico]) =>
        `<button type="button" class="vis-pill ${active === key ? "active" : ""}" data-type="${key}">${ico}<em>${label}</em><b>${n}</b></button>`
    )
    .join("");
  document.querySelectorAll("#visPills .vis-pill").forEach((b) => {
    b.onclick = () => {
      visTypeFilter = b.dataset.type;
      visPage = 1;
      renderVisitors();
    };
  });

  const inN = all.filter(visInside).length;
  const todayN = all.filter(visToday).length;
  const carN = all.filter((v) => visEntryKind(v) === "car").length;
  const walkN = all.filter((v) => visEntryKind(v) === "walk").length;
  document.getElementById("visStats").innerHTML = `
    <button type="button" class="vis-stat in${visQuick === "in" ? " on" : ""}" data-quick="in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><b>${inN}</b><span>İçeride</span></button>
    <button type="button" class="vis-stat today${visQuick === "today" ? " on" : ""}" data-quick="today"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg><b>${todayN}</b><span>Bugün</span></button>
    <button type="button" class="vis-stat car${visQuick === "car" ? " on" : ""}" data-quick="car"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 13l2-6h14l2 6"/><path d="M5 13h14v6H5z"/></svg><b>${carN}</b><span>Araçlı</span></button>
    <button type="button" class="vis-stat walk${visQuick === "walk" ? " on" : ""}" data-quick="walk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 13l2-6h14l2 6"/><path d="M5 13h14v6H5z"/><path d="M4 5l16 14"/></svg><b>${walkN}</b><span>Yayan</span></button>`;
  document.querySelectorAll("#visStats [data-quick]").forEach((b) => {
    b.onclick = () => {
      visQuick = visQuick === b.dataset.quick ? "all" : b.dataset.quick;
      visPage = 1;
      renderVisitors();
    };
  });

  const list = filteredVisitors();
  const shown = Math.min(list.length, visPage * VIS_PAGE);
  const slice = list.slice(0, shown);
  document.getElementById("visListTitle").textContent = `Son Ziyaretçiler`;
  const chev = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>`;
  document.getElementById("visitorsList").innerHTML = slice.length
    ? slice
        .map((v) => {
          const type = visTypeOf(v);
          const inside = visInside(v);
          const kind = visEntryKind(v);
          const vid = visitIdOf(v);
          const when = v.last_visit_date || v.visit_date || "";
          const t1 = v.entry_time || (v.created_at ? fmtTime(v.created_at) : "");
          const t2 = v.exit_time || "";
          return `
          <article class="vis-card ${type}" data-vis-open="${vid || ""}">
            <div class="type">${visIcon(type)}</div>
            <div class="who">
              <b>${escHtml(v.full_name || "—")}</b>
              <small>${escHtml(v.company || "Firma yok")}</small>
              <div class="meta">
                ${v.plate ? `<span class="vis-plate">${escHtml(v.plate)}</span>` : `<span class="vis-mode ${kind}">${kind === "car" ? "Araçlı" : "Yayan"}</span>`}
                <span>${TYPE_TR[type]}</span>
              </div>
            </div>
            <div class="vis-side">
              <span class="vis-when">${escHtml(when)}${t1 ? `<small>${escHtml(t1)}${t2 ? ` - ${escHtml(t2)}` : ""}</small>` : ""}</span>
              <span class="vis-badge ${inside ? "in" : "out"}">${inside ? "İçeride" : "Çıktı"}</span>
              <div class="vis-card-acts">
                <button type="button" class="vis-copy-mini" data-vis-copy="${vid || v.id}">Kopyala</button>
                ${vid && canEditVisitor(v) ? `<button type="button" class="edit" data-vis-edit="${vid}">Düzenle</button>` : ""}
                ${vid && canEditVisitor(v) ? `<button type="button" class="del" data-vis-del="${vid}">Sil</button>` : ""}
                ${vid && inside && canExitVisitor() ? `<button type="button" data-vis-exit="${vid}">Çıkış</button>` : ""}
              </div>
              <span class="vis-chev">${chev}</span>
            </div>
          </article>`;
        })
        .join("")
    : `<div class="dir-info"><span>Kayıt bulunamadı.</span></div>`;

  document.getElementById("visPager").innerHTML =
    shown < list.length
      ? `<button type="button" class="vis-more" id="visMore"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg> Daha Fazla Göster</button>
         ${canWrite() ? `<button type="button" class="vis-more" id="visBulkExit" style="margin-top:6px">Toplu Çıkış</button>` : ""}`
      : list.length
        ? `<span>Toplam ${list.length} kişi</span>${canWrite() ? `<button type="button" class="vis-more" id="visBulkExit" style="margin-top:6px">Toplu Çıkış</button>` : ""}`
        : "";
  document.getElementById("visMore")?.addEventListener("click", () => {
    visPage += 1;
    renderVisitors();
  });
  document.getElementById("visBulkExit")?.addEventListener("click", () => {
    if (!canWrite()) return toast("İzleyici modunda işlem yok");
    openBulkExitSheet();
  });
  document.querySelectorAll("[data-vis-open]").forEach((card) => {
    card.onclick = (e) => {
      if (e.target.closest("[data-vis-copy],[data-vis-edit],[data-vis-del],[data-vis-exit]")) return;
      openVisitorSheet(card.dataset.visOpen, "detail");
    };
  });
  document.querySelectorAll("[data-vis-copy]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const v = visitorCache.find((x) => String(x.id) === String(b.dataset.visCopy));
      if (v) copyVisitor(v);
    };
  });
  document.querySelectorAll("[data-vis-edit]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      openVisitorSheet(b.dataset.visEdit, "edit");
    };
  });
  document.querySelectorAll("[data-vis-del]").forEach((b) => {
    b.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("Bu ziyaret kaydı silinsin mi? (Geçmiş diğer kayıtlar kalır)")) return;
      try {
        await api(`/api/app/visitors/${b.dataset.visDel}`, { method: "DELETE" });
        toast("Kayıt silindi");
        visitorCache = visitorCache.filter((x) => String(x.id) !== String(b.dataset.visDel) && String(x.visit_id) !== String(b.dataset.visDel));
        await refreshVisitors();
        loadHome();
      } catch (err) {
        toast(err.message || "Silinemedi");
      }
    };
  });
  document.querySelectorAll("[data-vis-exit]").forEach((b) => {
    b.onclick = async (e) => {
      e.stopPropagation();
      try {
        await api(`/api/app/visitors/${b.dataset.visExit}/exit`, { method: "POST" });
        toast("Çıkış kaydedildi");
        await refreshVisitors();
        loadHome();
      } catch (err) {
        toast(err.message || "Çıkış başarısız");
      }
    };
  });
}

function canEditVisitor(v) {
  const me = window.currentUser;
  if (!me || me.role === "viewer") return false;
  if (me.role === "admin" || me.role === "supervisor" || me.role === "guard") return true;
  return String(v.created_by || "") === String(me.id);
}

function visitIdOf(v) {
  return v?.visit_id || v?.id || null;
}

function canExitVisitor() {
  return canWrite();
}

async function openBulkExitSheet() {
  showView("bulk-exit");
  await loadBulkExitPage();
}

async function loadBulkExitPage() {
  const box = document.getElementById("bulkExitList");
  if (!box) return;
  box.innerHTML = `<div class="dir-info"><span>Yükleniyor…</span></div>`;
  try {
    const { items } = await api("/api/app/visitors/inside-companies");
    window.__bulkCompanies = items || [];
    if (!items?.length) {
      box.innerHTML = `<div class="dir-info"><span>İçeride kimse yok</span></div>`;
      return;
    }
    box.innerHTML = items
      .map(
        (c, i) => `<div class="bulk-row">
          <div><b>${escHtml(c.company)}</b><small>${c.n} kişi içeride</small></div>
          ${
            canWrite()
              ? `<button type="button" class="btn-gold bulk-exit-btn" data-bulk-i="${i}">Çıkış Yap</button>`
              : `<span class="act out">İzleyici</span>`
          }
        </div>`
      )
      .join("");
    box.querySelectorAll("[data-bulk-i]").forEach((b) => {
      b.onclick = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!canWrite()) return toast("İzleyici modunda işlem yok");
        const co = window.__bulkCompanies?.[Number(b.dataset.bulkI)];
        if (!co) return;
        if (!confirm(`${co.company} firmasındaki herkes çıkış yapsın mı?`)) return;
        try {
          const r = await api("/api/app/visitors/bulk-exit", {
            method: "POST",
            body: { company: co.company },
          });
          toast(`${r.count || 0} kişi çıkış yaptı`);
          await loadBulkExitPage();
          await loadInsidePage().catch(() => {});
          await refreshVisitors().catch(() => {});
          loadHome().catch(() => {});
        } catch (err) {
          toast(err.message || "Toplu çıkış başarısız");
        }
      };
    });
  } catch (err) {
    box.innerHTML = `<div class="dir-info"><span>${escHtml(err.message || "Liste alınamadı")}</span></div>`;
  }
}

async function loadInsidePage() {
  const box = document.getElementById("insideList");
  if (!box) return;
  box.innerHTML = `<div class="dir-info"><span>Yükleniyor…</span></div>`;
  try {
    const { items } = await api("/api/app/visitors/inside");
    window.__insideList = items || [];
    if (!items?.length) {
      box.innerHTML = `<div class="dir-info"><span>İçeride kimse yok</span></div>`;
      return;
    }
    box.innerHTML = items
      .map(
        (v, i) => `<div class="bulk-row">
          <div>
            <b>${escHtml(v.full_name || `${v.first_name || ""} ${v.last_name || ""}`.trim() || "—")}</b>
            <small>${escHtml(v.company || "Firmasız")}${v.plate ? ` · ${escHtml(v.plate)}` : ""}${
              v.entry_time ? ` · ${escHtml(v.entry_time)}` : ""
            }</small>
          </div>
          ${
            canWrite()
              ? `<button type="button" class="btn-gold bulk-exit-btn" data-inside-i="${i}">Çıkış</button>`
              : ""
          }
        </div>`
      )
      .join("");
    box.querySelectorAll("[data-inside-i]").forEach((b) => {
      b.onclick = async (ev) => {
        ev.preventDefault();
        if (!canWrite()) return;
        const v = window.__insideList?.[Number(b.dataset.insideI)];
        if (!v?.id) return;
        try {
          await api(`/api/app/visitors/${v.id}/exit`, { method: "POST" });
          toast("Çıkış kaydedildi");
          await loadInsidePage();
          loadHome().catch(() => {});
          refreshVisitors().catch(() => {});
        } catch (err) {
          toast(err.message || "Çıkış başarısız");
        }
      };
    });
  } catch (err) {
    box.innerHTML = `<div class="dir-info"><span>${escHtml(err.message || "Liste alınamadı")}</span></div>`;
  }
}

async function refreshVisitors() {
  const { items } = await api("/api/app/visitors?limit=200");
  visitorCache = items || [];
  renderVisitors();
}

async function loadVisitors() {
  await refreshVisitors();
}

function isoToTr(iso) {
  const s = String(iso || "");
  if (!s || !s.includes("-")) return s;
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

async function loadAlerts() {
  try {
    const data = await api("/api/app/alerts");
    const items = data.items || [];
    document.getElementById("alertListTitle").textContent = `Beklenen listesi (${items.length})`;
    document.getElementById("alertsList").innerHTML = items.length
      ? items
          .map((a) => {
            const willEnter = !(a.will_enter === false || a.will_enter === "false" || a.will_enter === 0);
            const arrived = a.matched_at ? "Geldi" : a.active === false ? "Kaldırıldı" : "Bekleniyor";
            const name = [a.first_name, a.last_name].filter(Boolean).join(" ") || a.full_name;
            return `<article class="alert-card">
              <div class="who">
                <div class="who-top">
                  <b>${escHtml(name)}</b>
                  <span class="vis-badge ${a.matched_at ? "out" : "in"}">${arrived}</span>
                </div>
                <small>${escHtml(a.company || "Firma yok")}</small>
                <div class="meta"><span class="enter-flag ${willEnter ? "yes" : "no"}">${willEnter ? "İçeri GİRECEK" : "İçeri GİRMEYECEK"}</span></div>
                ${a.notes ? `<div class="hist">${escHtml(a.notes)}</div>` : ""}
              </div>
              <button type="button" class="vis-act exit" data-alert-del="${a.id}">Sil</button>
            </article>`;
          })
          .join("")
      : `<div class="dir-info"><span>Henüz beklenen ziyaretçi yok.</span></div>`;
    document.querySelectorAll("[data-alert-del]").forEach((b) => {
      b.onclick = async () => {
        await api(`/api/app/alerts/${b.dataset.alertDel}`, { method: "DELETE" });
        toast("Kayıt silindi");
        loadAlerts();
      };
    });
  } catch (err) {
    toast(err.message || "Liste alınamadı");
  }
}

function openSheet(title, html) {
  document.getElementById("sheetTitle").textContent = title || "";
  document.getElementById("sheetBody").innerHTML = html;
  document.getElementById("sheet").classList.add("open");
  document.getElementById("sheet").setAttribute("aria-hidden", "false");
  document.getElementById("sheetBg").classList.remove("hidden");
}

function closeSheet() {
  document.getElementById("sheet").classList.remove("open");
  document.getElementById("sheet").setAttribute("aria-hidden", "true");
  document.getElementById("sheetBg").classList.add("hidden");
  document.getElementById("sheetTitle").textContent = "";
  document.getElementById("sheetBody").innerHTML = "";
}

async function getVisitorById(id) {
  try {
    const data = await api(`/api/app/visitors/${id}`);
    return data.item;
  } catch {
    const local = visitorCache.find(
      (x) => String(x.id) === String(id) || String(x.visit_id) === String(id)
    );
    if (local?.visit_id && String(local.visit_id) !== String(id)) {
      try {
        const data = await api(`/api/app/visitors/${local.visit_id}`);
        return data.item;
      } catch {
        /* fallthrough */
      }
    }
    return local || null;
  }
}

async function openVisitorSheet(id, mode) {
  const v = await getVisitorById(id);
  if (!v) return toast("Kayıt bulunamadı");
  const vid = visitIdOf(v) || id;
  if (mode === "detail") {
    const extra = parseVisitorExtra(v);
    const comps = Array.isArray(extra.companions) ? extra.companions : v.companions || [];
    const rows = [
      ["Kayıt No", v.record_no],
      ["Ad Soyad", v.full_name],
      ["Firma", v.company],
      ["Plaka", v.plate],
      ["Tür", TYPE_TR[visTypeOf(v)]],
      ["Giriş Şekli", visEntryLabel(v)],
      ["Bu kayıt tarihi", v.visit_date || (v.created_at ? fmtDateTime(v.created_at) : "")],
      ["Giriş saati", v.entry_time],
      ["Çıkış", v.exit_time || (visInside(v) ? "—" : "")],
      ["Durum", visInside(v) ? "İçeride" : "Çıktı"],
      ["Kişi toplam giriş", v.visit_count ? `${v.visit_count}` : ""],
      ["Açıklama", v.notes],
      ["Ek kişiler", comps.map((c) => `${c.first_name || ""} ${c.last_name || ""}`.trim()).filter(Boolean).join(", ")],
    ]
      .filter(([, val]) => val)
      .map(([k, val]) => `<div><span>${k}</span><b>${escHtml(val)}</b></div>`)
      .join("");
    openSheet(
      "Ziyaret Kaydı",
      `<div class="sheet-kv">${rows}</div>
       <p class="sheet-note">Silme yalnızca bu kaydı kaldırır; aynı kişinin diğer ziyaretleri kalır.</p>
       <div class="vis-acts" style="margin-top:10px;flex-wrap:wrap">
         <button type="button" class="vis-act" id="sheetCopyBtn">Kopyala</button>
         ${canEditVisitor(v) ? `<button type="button" class="vis-act edit" id="sheetEditBtn">Düzenle</button>` : ""}
         ${canEditVisitor(v) ? `<button type="button" class="vis-act" id="sheetDelBtn" style="border-color:rgba(239,68,68,.5);color:#f87171">Bu Kaydı Sil</button>` : ""}
         ${visInside(v) && canExitVisitor() ? `<button type="button" class="vis-act exit" id="sheetExitBtn">Çıkış</button>` : ""}
       </div>`
    );
    document.getElementById("sheetCopyBtn").onclick = () => copyVisitor(v);
    document.getElementById("sheetEditBtn")?.addEventListener("click", () => openVisitorSheet(vid, "edit"));
    document.getElementById("sheetDelBtn")?.addEventListener("click", async () => {
      if (!confirm("Bu ziyaret kaydı silinsin mi? (Geçmiş diğer kayıtlar kalır)")) return;
      try {
        await api(`/api/app/visitors/${vid}`, { method: "DELETE" });
        toast("Kayıt silindi");
        closeSheet();
        visitorCache = visitorCache.filter((x) => String(x.id) !== String(vid) && String(x.visit_id) !== String(vid));
        await refreshVisitors();
        loadHome();
      } catch (err) {
        toast(err.message || "Silinemedi");
      }
    });
    document.getElementById("sheetExitBtn")?.addEventListener("click", async () => {
      try {
        await api(`/api/app/visitors/${vid}/exit`, { method: "POST" });
        toast("Çıkış kaydedildi");
        closeSheet();
        await refreshVisitors();
        loadHome();
      } catch (err) {
        toast(err.message || "Çıkış başarısız");
      }
    });
    return;
  }
  openSheet(
    "Ziyaretçi Düzenle",
    `<form class="sheet-form" id="visEditForm">
      <label>İsim</label><input name="first_name" value="${escHtml(v.first_name || "")}" />
      <label>Soyisim</label><input name="last_name" value="${escHtml(v.last_name || "")}" />
      <label>Firma</label><input name="company" value="${escHtml(v.company || "")}" />
      <label>Plaka</label><input name="plate" value="${escHtml(v.plate || "")}" />
      <label>Açıklama</label><textarea name="notes" rows="3">${escHtml(v.notes || "")}</textarea>
      <button class="sheet-save" type="submit">Kaydet</button>
    </form>`
  );
  document.getElementById("visEditForm").onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api(`/api/app/visitors/${vid}`, { method: "PATCH", body });
      toast("Kayıt güncellendi");
      closeSheet();
      await refreshVisitors();
      loadHome();
    } catch (err) {
      toast(err.message || "Güncellenemedi");
    }
  };
}

const DIR_GROUPS_FALLBACK = [
  { key: "yonetim", tab: "yonetim", title: "Yönetim Kadrosu", sub: "Proje yönetimi ve idari birimler", units: ["Yönetim", "Merkez", "İdari"] },
  { key: "guvenlik", tab: "yonetim", title: "Güvenlik Birimi", sub: "Vardiya amirleri ve güvenlik personeli", units: ["Saha", "Güvenlik"] },
  { key: "teknik", tab: "teknik", title: "Teknik Servis", sub: "Bakım - Onarım - Teknik destek", units: ["Teknik"] },
  { key: "temizlik", tab: "diger", title: "Temizlik Ekibi", sub: "Temizlik sorumluları", units: ["Temizlik"] },
  { key: "taseron", tab: "diger", title: "Taşeron Firmalar", sub: "Sahada görev yapan firmalar", units: ["Taşeron"] },
  { key: "tedarik", tab: "diger", title: "Tedarikçi / Sevkiyat", sub: "Malzeme ve lojistik firmalar", units: ["Tedarikçi"] },
  { key: "bilgi", tab: "diger", title: "Önemli Bilgiler", sub: "Talimatlar, kurallar, formlar", units: ["Bilgi"] },
  { key: "acil", tab: "acil", title: "Acil Durum Numaraları", sub: "Hızlı arama için önemli numaralar", units: ["Acil"] },
];
let DIR_GROUPS = DIR_GROUPS_FALLBACK.slice();

const DIR_ICONS = {
  yonetim: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 21V8l8-4 8 4v13"/><path d="M9 21v-6h6v6"/></svg>`,
  guvenlik: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 4v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/></svg>`,
  teknik: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 7l3 3-8 8H6v-3z"/><path d="M5 20l2-2"/></svg>`,
  temizlik: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  taseron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/><path d="M8 5l-2-2M16 5l2-2"/></svg>`,
  tedarik: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7h11v10H3z"/><path d="M14 11h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`,
  bilgi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h8l5 5v13H7z"/><path d="M15 3v5h5"/></svg>`,
  acil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.5a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2.1z"/></svg>`,
};

const DIR_TABS = [
  { key: "all", label: "Tümü", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg>` },
  { key: "yonetim", label: "Yönetim", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>` },
  { key: "teknik", label: "Teknik", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 7l3 3-8 8H6v-3z"/></svg>` },
  { key: "acil", label: "Acil", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1A19.5 19.5 0 0 1 3.1 7.9 2 2 0 0 1 5 2h3"/></svg>` },
  { key: "diger", label: "Diğer", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg>` },
];

let dirTab = "all";
let dirGroup = null;
let dirPeople = [];

function peopleForGroup(group) {
  return dirPeople.filter((p) => group.units.includes(p.unit));
}

function renderDirectory() {
  document.getElementById("dirCats").innerHTML = DIR_TABS.map(
    (t) =>
      `<button type="button" class="dir-cat ${dirTab === t.key ? "active" : ""}" data-dir-tab="${t.key}"><i>${t.icon}</i>${t.label}</button>`
  ).join("");
  document.querySelectorAll("[data-dir-tab]").forEach((b) => {
    b.onclick = () => {
      dirTab = b.dataset.dirTab;
      dirGroup = null;
      renderDirectory();
    };
  });
  const q = String(document.getElementById("dirSearch")?.value || "").trim().toLocaleLowerCase("tr-TR");
  if (dirGroup) {
    let people = peopleForGroup(dirGroup);
    if (q) {
      people = people.filter((p) =>
        [p.name, p.title, p.phone, p.unit].join(" ").toLocaleLowerCase("tr-TR").includes(q)
      );
    }
    document.getElementById("contactsList").innerHTML = people.length
      ? people
          .map(
            (p) => `
          <div class="dir-tile dir-person">
            <div class="av">${String(p.name || "?").slice(0, 1)}</div>
            <div><b>${p.name}</b><span>${p.title || ""} ${p.unit ? "· " + p.unit : ""}</span></div>
            ${p.phone ? `<a class="dir-call" href="tel:${p.phone}">Ara</a>` : ""}
          </div>`
          )
          .join("")
      : `<div class="dir-info"><span>Bu birimde kayıt yok.</span></div>`;
    return;
  }
  let groups = DIR_GROUPS.filter((g) => dirTab === "all" || g.tab === dirTab);
  if (q) {
    const peopleHits = dirPeople.filter((p) =>
      [p.name, p.title, p.phone, p.unit].join(" ").toLocaleLowerCase("tr-TR").includes(q)
    );
    groups = groups.filter(
      (g) =>
        g.title.toLocaleLowerCase("tr-TR").includes(q) ||
        g.sub.toLocaleLowerCase("tr-TR").includes(q) ||
        peopleHits.some((p) => g.units.includes(p.unit))
    );
  }
  document.getElementById("contactsList").innerHTML = groups
    .map(
      (g) => `
      <button type="button" class="dir-tile" data-dir-group="${g.key}">
        <div class="ico">${DIR_ICONS[g.key]}</div>
        <div><b>${g.title}</b><span>${g.sub}</span></div>
        <span class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></span>
      </button>`
    )
    .join("");
  document.querySelectorAll("[data-dir-group]").forEach((b) => {
    b.onclick = () => {
      dirGroup = DIR_GROUPS.find((g) => g.key === b.dataset.dirGroup);
      renderDirectory();
    };
  });
}

async function loadDirectory() {
  try {
    const [{ items }, sec] = await Promise.all([
      api("/api/app/contacts"),
      api("/api/app/contact-sections").catch(() => ({ items: [] })),
    ]);
    dirPeople = items || [];
    if (sec.items?.length) {
      DIR_GROUPS = sec.items.map((s) => ({
        key: s.key,
        tab: s.tab || "diger",
        title: s.title,
        sub: s.sub || "",
        units: Array.isArray(s.units) ? s.units : [],
      }));
    } else {
      DIR_GROUPS = DIR_GROUPS_FALLBACK.slice();
    }
  } catch {
    dirPeople = [];
    DIR_GROUPS = DIR_GROUPS_FALLBACK.slice();
  }
  dirGroup = null;
  dirTab = "all";
  renderDirectory();
}

async function loadNotifs(opts = {}) {
  const limit = opts.all ? 100 : 40;
  const { items } = await api(`/api/app/notifications?limit=${limit}`);
  document.getElementById("notifList").innerHTML = items.length
    ? items
        .map(
          (n) => `
        <div class="item-row">
          <div><b>${escHtml(n.title)}</b><span>${escHtml(n.body)}</span></div>
          <span class="pill">${fmtDateTime(n.created_at)}</span>
        </div>`
        )
        .join("")
    : `<div class="item-row"><span>Bildirim yok</span></div>`;
  const lastRead = localStorage.getItem("s360_notif_read") || "";
  const unread = items.some((n) => String(n.created_at || "") > lastRead);
  document.getElementById("notifDot").style.display = unread ? "block" : "none";
  const newest = items[0]?.created_at || "";
  if (lastNotifStamp && newest && newest > lastNotifStamp) {
    document.getElementById("openNotif")?.classList.add("ring");
    if (window.haptic) window.haptic("ok");
    if (typeof playNotifyBeep === "function" && !window.chatOpen) playNotifyBeep();
    setTimeout(() => document.getElementById("openNotif")?.classList.remove("ring"), 2800);
    // Push gelmese bile üstten canlı banner (uygulama açıkken)
    const fresh = items.find((n) => String(n.created_at || "") > lastNotifStamp);
    if (fresh && !opts.silentBanner) {
      showLivePushBanner({
        title: fresh.title,
        body: fresh.body,
        notifType: fresh.type || "info",
      });
    }
  }
  if (newest) lastNotifStamp = newest;
  if (opts.markRead) {
    if (newest) localStorage.setItem("s360_notif_read", newest);
    document.getElementById("notifDot").style.display = "none";
    await api("/api/app/notifications/read-all", { method: "POST" });
  }
}

function visitorPeopleNames(v) {
  const names = [];
  const lead = String(v.full_name || `${v.first_name || ""} ${v.last_name || ""}`).trim();
  if (lead) names.push(lead);
  const extra = parseVisitorExtra(v);
  const comps = Array.isArray(v.companions) ? v.companions : extra.companions || [];
  for (const c of comps) {
    const n = `${c.first_name || ""} ${c.last_name || ""}`.trim();
    if (n && !names.includes(n)) names.push(n);
  }
  return names;
}

function copyVisitorText(v) {
  const type = visTypeOf(v);
  const names = visitorPeopleNames(v);
  let desc = String(v.notes || "").trim();
  if (!desc) {
    if (type === "kargo") {
      const n = foldSearch(v.notes || v.category || "");
      desc = n.includes("TESLIM ET") || n.includes("TESLİM ET")
        ? copyTemplates.kargo_ver
        : copyTemplates.kargo_al;
    } else if (type === "yemek") {
      desc = copyTemplates.yemek || "";
    } else {
      desc = copyTemplates[type] || copyTemplates.calisma || "";
    }
  }
  if (names.length > 1) desc = desc.replace(/YAPTI(?!LAR)/gi, "YAPTILAR");
  desc = sentenceCaseTr(desc);
  const time = v.entry_time || (v.created_at ? fmtTime(v.created_at) : "");
  return [
    `FİRMA: ${v.company || "-"}`,
    ...names,
    `GİRİŞ SAATİ: ${time}`.trim(),
    `AÇIKLAMA: ${desc}`,
  ].join("\n");
}

function sentenceCaseTr(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  const lower = t.toLocaleLowerCase("tr-TR");
  return lower.charAt(0).toLocaleUpperCase("tr-TR") + lower.slice(1);
}

async function copyVisitor(v) {
  const text = copyVisitorText(v);
  let ok = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch {
    ok = false;
  }
  if (!ok) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ok = document.execCommand("copy");
      ta.remove();
    } catch {
      ok = false;
    }
  }
  if (ok) {
    toast("Kopyalandı");
    if (window.haptic) window.haptic("ok");
  } else {
    toast("Kopyalanamadı");
  }
}

function checkShiftTicker() {
  const el = document.getElementById("homeTicker");
  if (!el) return;
  if (shiftReminders.enabled === false) {
    el.classList.add("hidden");
    return;
  }
  const d = new Date();
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const slots = [
    [shiftReminders.morning, shiftReminders.morning_text || "İş başı — hayırlı sabahlar"],
    [shiftReminders.lunch, shiftReminders.lunch_text || "Öğle molası"],
    [shiftReminders.evening, shiftReminders.evening_text || "Mesai bitişi"],
  ];
  const hit = slots.find(([t]) => {
    const s = String(t || "").slice(0, 5);
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return false;
    const slot = Number(m[1]) * 60 + Number(m[2]);
    return nowMin >= slot && nowMin < slot + 3;
  });
  if (!hit) {
    if (!el.dataset.hold) el.classList.add("hidden");
    return;
  }
  const stamp = String(hit[0]).slice(0, 5);
  if (el.dataset.shown === stamp) return;
  el.dataset.shown = stamp;
  el.dataset.hold = "1";
  el.textContent = hit[1];
  el.classList.remove("hidden");
  setTimeout(() => {
    el.classList.add("hidden");
    el.dataset.hold = "";
  }, 45000);
}

async function loadPatrols() {
  const { items } = await api("/api/app/patrols");
  document.getElementById("patrolList").innerHTML = items
    .map(
      (p) => `
      <div class="item-row">
        <div><b>${p.name}</b><span>${p.checkpoint}</span></div>
        ${
          p.status === "done"
            ? `<span class="pill ok">Tamam</span>`
            : `<button class="btn-gold" style="width:auto;height:34px;padding:0 10px;font-size:12px" data-patrol="${p.id}">İşaretle</button>`
        }
      </div>`
    )
    .join("");
  document.querySelectorAll("[data-patrol]").forEach((b) => {
    b.onclick = async () => {
      await api(`/api/app/patrols/${b.dataset.patrol}/check`, { method: "POST" });
      toast("Devriye işaretlendi");
      loadPatrols();
    };
  });
}

async function loadAnn() {
  const { items } = await api("/api/app/announcements");
  document.getElementById("annList").innerHTML = items
    .map(
      (a) => `
      <div class="item-row">
        <div><b>${a.title}</b><span>${a.body}</span></div>
      </div>`
    )
    .join("");
}

async function loadSettings() {
  try {
    const s = await api("/api/app/settings");
    defaultVisitType = s.default_visitor_type || "sevkiyat";
    visitorFields = Array.isArray(s.visitor_fields) ? s.visitor_fields : [];
    if (s.copy_templates) copyTemplates = { ...copyTemplates, ...s.copy_templates };
    if (s.shift_reminders) shiftReminders = { ...shiftReminders, ...s.shift_reminders };
    try {
      localStorage.setItem(
        "s360_settings",
        JSON.stringify({
          defaultVisitType,
          visitorFields,
          copyTemplates,
          shiftReminders,
        })
      );
    } catch {
      /* ignore */
    }
  } catch {
    try {
      const cached = JSON.parse(localStorage.getItem("s360_settings") || "null");
      if (cached) {
        defaultVisitType = cached.defaultVisitType || "sevkiyat";
        visitorFields = Array.isArray(cached.visitorFields) ? cached.visitorFields : [];
        if (cached.copyTemplates) copyTemplates = { ...copyTemplates, ...cached.copyTemplates };
        if (cached.shiftReminders) shiftReminders = { ...shiftReminders, ...cached.shiftReminders };
        return;
      }
    } catch {
      /* ignore */
    }
    defaultVisitType = "sevkiyat";
  }
}

function fieldHtml(f, meta) {
  const id = `vf-${f.key}`;
  const ph =
    f.key === "first_name" ? meta.first :
    f.key === "last_name" ? meta.last :
    f.key === "company" ? meta.company :
    f.key === "notes" ? meta.notes :
    f.key === "plate" ? "34 ABC 123" :
    f.key === "visit_date" ? "" :
    f.key === "entry_time" ? "" :
    f.key === "exit_time" ? "Seçiniz" : "";
  const req = f.required ? " required" : "";
  const star = f.required ? " <i>*</i>" : "";
  const icon = FIELD_ICONS[f.key] || FIELD_ICONS.default;
  const isPicker = f.key === "visit_date" || f.key === "entry_time" || f.key === "exit_time";
  const clr = f.type === "textarea" || isPicker
    ? ""
    : `<button type="button" class="clr" data-clear="${id}" aria-label="Temizle">×</button>`;
  const chevron = isPicker
    ? `<span class="reg-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg></span>`
    : "";
  const suggest = ["first_name", "last_name", "company", "plate"].includes(f.key);
  const hint =
    f.key === "visit_date" || f.key === "entry_time"
      ? `<small class="reg-note">Takvim / saat seçiciden değiştirilebilir.</small>`
      : "";
  let input;
  if (f.type === "textarea") {
    input = `<textarea name="${f.key}" id="${id}" rows="2" placeholder="${ph}"${req}></textarea>`;
  } else if (f.key === "visit_date") {
    input = `<input type="date" name="${f.key}" id="${id}"${req} />`;
  } else if (f.key === "entry_time" || f.key === "exit_time") {
    input = `<input type="time" name="${f.key}" id="${id}"${f.key === "exit_time" ? "" : req} placeholder="${ph}" />`;
  } else {
    input = `<input name="${f.key}" id="${id}" placeholder="${ph}" autocomplete="off"${req} ${suggest ? `data-suggest="${f.key}"` : ""} />`;
  }
  const full = f.type === "textarea" || f.key === "notes" ? " full" : "";
  const picker = isPicker ? " picker" : "";
  return `
    <label class="reg-field${full}${picker}">
      <span>${f.label}${star}</span>
      <div class="reg-input${f.type === "textarea" ? " area" : ""}${picker}">
        ${icon}
        ${input}
        ${clr}
        ${chevron}
      </div>
      ${suggest ? `<div class="suggest-box hidden" data-suggest-for="${f.key}"></div>` : ""}
      ${hint}
    </label>`;
}

function companionBlock() {
  return `
    <div class="companion-wrap" id="companionWrap">
      <button type="button" class="companion-add" id="addCompanionBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        Kişi Ekle
      </button>
      <div id="companionList"></div>
    </div>`;
}

function companionRowHtml(c = {}) {
  return `
    <div class="companion-row">
      <input data-cf placeholder="İsim" value="${escHtml(c.first_name || "")}" />
      <input data-cl placeholder="Soyisim" value="${escHtml(c.last_name || "")}" />
      <button type="button" class="companion-del" aria-label="Kaldır">×</button>
    </div>`;
}

function bindCompanionRows() {
  document.querySelectorAll(".companion-del").forEach((b) => {
    b.onclick = () => {
      b.closest(".companion-row")?.remove();
    };
  });
}

function setCompanions(list) {
  const box = document.getElementById("companionList");
  if (!box) return;
  box.innerHTML = (list || []).map((c) => companionRowHtml(c)).join("");
  bindCompanionRows();
}

function readCompanions() {
  return [...document.querySelectorAll(".companion-row")]
    .map((row) => ({
      first_name: String(row.querySelector("[data-cf]")?.value || "").trim(),
      last_name: String(row.querySelector("[data-cl]")?.value || "").trim(),
    }))
    .filter((c) => c.first_name || c.last_name);
}

function parseVisitorExtra(v) {
  if (!v) return {};
  if (v.extra && typeof v.extra === "object" && !Array.isArray(v.extra)) return v.extra;
  if (typeof v.extra === "string") {
    try {
      return JSON.parse(v.extra) || {};
    } catch {
      return {};
    }
  }
  return {};
}

let suggestTimer = null;
let suggestLock = false;

function hideSuggest(key) {
  const box = document.querySelector(`[data-suggest-for="${key}"]`);
  if (box) box.classList.add("hidden");
}

function hideAllSuggest() {
  document.querySelectorAll(".suggest-box").forEach((el) => el.classList.add("hidden"));
}

function applySuggestion(item) {
  suggestLock = true;
  hideAllSuggest();
  const vt = item.visit_type || item.last_visit_type;
  if (vt && VISIT_META[vt]) setVisitTab(vt);
  const set = (key, val) => {
    const el = fieldEl(key);
    if (el && val != null) el.value = val;
  };
  set("first_name", (item.first_name || "").toLocaleUpperCase("tr-TR"));
  set("last_name", (item.last_name || "").toLocaleUpperCase("tr-TR"));
  set("company", (item.company || "").toLocaleUpperCase("tr-TR"));
  set("plate", (item.plate || "").toLocaleUpperCase("tr-TR"));
  if (item.phone) set("phone", item.phone);
  if (item.host) set("host", item.host);
  if (item.notes) set("notes", item.notes);
  const comps = Array.isArray(item.companions) ? item.companions : parseVisitorExtra(item).companions;
  setCompanions(comps || []);
  fillNowFields();
  const outEl = fieldEl("exit_time");
  if (outEl) outEl.value = "";
  syncEntryType();
  setTimeout(() => {
    suggestLock = false;
  }, 300);
}

async function runSuggest(field, value) {
  const q = String(value || "").trim();
  const box = document.querySelector(`[data-suggest-for="${field}"]`);
  if (!box) return;
  if (suggestLock || q.length < 1) {
    box.classList.add("hidden");
    return;
  }
  try {
    const { items } = await api(`/api/app/visitors/suggest?q=${encodeURIComponent(q)}&field=${encodeURIComponent(field)}`);
    if (!items?.length) {
      box.classList.add("hidden");
      return;
    }
    box.innerHTML = items
      .map((it) => {
        const extra = (it.companions || []).length ? ` · +${it.companions.length} kişi` : "";
        return `<button type="button" class="suggest-item" data-sid="${it.id}">
          <b>${escHtml(it.full_name || `${it.first_name || ""} ${it.last_name || ""}`)}</b>
          <span>${escHtml([it.company, it.plate].filter(Boolean).join(" · "))}${extra}</span>
        </button>`;
      })
      .join("");
    box.classList.remove("hidden");
    box.querySelectorAll(".suggest-item").forEach((btn) => {
      btn.onmousedown = (e) => e.preventDefault();
      btn.onclick = () => {
        const item = items.find((x) => String(x.id) === String(btn.dataset.sid));
        if (item) applySuggestion(item);
      };
    });
  } catch {
    box.classList.add("hidden");
  }
}

function bindSuggest() {
  ["first_name", "last_name", "company", "plate"].forEach((key) => {
    const el = fieldEl(key);
    if (!el) return;
    el.addEventListener("input", () => {
      if (suggestLock) return;
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(() => runSuggest(key, el.value), 180);
    });
    el.addEventListener("blur", () => setTimeout(() => hideSuggest(key), 180));
  });
}

function bindRegQuickSearch() {
  const el = document.getElementById("regQuickSearch");
  const box = document.getElementById("regQuickSuggest");
  if (!el || !box || el.dataset.bound) return;
  el.dataset.bound = "1";
  let t = null;
  el.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const q = String(el.value || "").trim();
      if (q.length < 1) {
        box.classList.add("hidden");
        return;
      }
      try {
        const { items } = await api(`/api/app/visitors/suggest?q=${encodeURIComponent(q)}`);
        if (!items?.length) {
          box.classList.add("hidden");
          return;
        }
        box.innerHTML = items
          .map((it) => {
            const type = it.visit_type || it.last_visit_type || "";
            const typeLabel = TYPE_TR[type] || type || "";
            return `<button type="button" class="suggest-item" data-sid="${it.id}">
              <b>${escHtml(it.full_name || `${it.first_name || ""} ${it.last_name || ""}`)}</b>
              <span>${escHtml([it.company, typeLabel].filter(Boolean).join(" · "))}</span>
            </button>`;
          })
          .join("");
        box.classList.remove("hidden");
        box.querySelectorAll(".suggest-item").forEach((btn) => {
          btn.onmousedown = (e) => e.preventDefault();
          btn.onclick = () => {
            const item = items.find((x) => String(x.id) === String(btn.dataset.sid));
            if (item) {
              applySuggestion(item);
              el.value = "";
              box.classList.add("hidden");
            }
          };
        });
      } catch {
        box.classList.add("hidden");
      }
    }, 180);
  });
  el.addEventListener("blur", () => setTimeout(() => box.classList.add("hidden"), 180));
}

function renderRegFields() {
  const meta = VISIT_META[currentVisitType] || VISIT_META.calisma;
  const list = (visitorFields || []).filter((f) => f.enabled && !FORM_SKIP.has(f.key));
  const html = [companionBlock()];
  let i = 0;
  let plateHintDone = false;
  while (i < list.length) {
    const f = list[i];
    const next = list[i + 1];
    const pair = f.type !== "textarea" && next && next.type !== "textarea";
    if (pair) {
      html.push(`<div class="reg-grid">${fieldHtml(f, meta)}${fieldHtml(next, meta)}</div>`);
      if (!plateHintDone && (f.key === "plate" || next.key === "plate")) {
        html.push(`<small class="reg-hint" id="plateHint">Plaka yoksa yayan giriş, varsa araçlı giriş kaydedilir.</small>`);
        plateHintDone = true;
      }
      i += 2;
    } else {
      html.push(fieldHtml(f, meta));
      if (!plateHintDone && f.key === "plate") {
        html.push(`<small class="reg-hint" id="plateHint">Plaka yoksa yayan giriş, varsa araçlı giriş kaydedilir.</small>`);
        plateHintDone = true;
      }
      i += 1;
    }
  }
  html.push(`
    <label class="reg-check" id="exitCheckWrap" style="display:none">
      <input type="checkbox" name="exited" id="vExited" />
      <div>
        <b>Çıkış Yapıldı</b>
        <span>Ziyaret çıkışında işaretleyin.</span>
      </div>
    </label>
    <div class="reg-info" id="regInfo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>
      <span>Plaka girilmediyse yayan giriş, plaka varsa araçlı giriş olarak kaydedilir.</span>
    </div>`);
  document.getElementById("regFields").innerHTML = html.join("");
  document.querySelectorAll("[data-clear]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const el = document.getElementById(btn.dataset.clear);
      if (el) el.value = "";
      el?.focus();
      if (btn.dataset.clear === "vf-plate") syncEntryType();
      hideAllSuggest();
    });
  });
  fieldEl("plate")?.addEventListener("input", syncEntryType);
  document.getElementById("addCompanionBtn")?.addEventListener("click", () => {
    const box = document.getElementById("companionList");
    if (!box) return;
    box.insertAdjacentHTML("beforeend", companionRowHtml());
    bindCompanionRows();
    bindUppercase(box.querySelector(".companion-row:last-child"));
    box.querySelector(".companion-row:last-child [data-cf]")?.focus();
  });
  bindSuggest();
  bindUppercase(document.getElementById("regFields"));
}

function fillNowFields() {
  const pad = (n) => String(n).padStart(2, "0");
  const dateEl = fieldEl("visit_date");
  const inEl = fieldEl("entry_time");
  const outEl = fieldEl("exit_time");
  if (dateEl) {
    if (dateEl.type === "date") {
      dateEl.value = trIsoDate();
    } else {
      dateEl.value = trTodayStamp();
    }
  }
  if (inEl) inEl.value = trHm();
  if (outEl) outEl.value = "";
  const p = nowParts();
  const tp = trParts();
  document.getElementById("regDateDay").textContent = p.date;
  document.getElementById("regDateWeek").textContent = days[tp.weekday];
  syncEntryType();
}

function syncEntryType() {
  const plate = String(fieldEl("plate")?.value || "").trim();
  const status = plate ? "ARAÇLI" : "YAYAN";
  document.getElementById("entryType").value = status;
  document.getElementById("vehicleStatus").value = status;
}

function setVisitTab(type) {
  currentVisitType = VISIT_META[type] ? type : "sevkiyat";
  const meta = VISIT_META[currentVisitType];
  document.getElementById("visitType").value = currentVisitType;
  document.querySelectorAll(".reg-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.type === currentVisitType);
  });
  document.getElementById("regTypeTitle").textContent = meta.title;
  document.getElementById("regTypeDesc").textContent = meta.desc;
  document.getElementById("regTypeIco").innerHTML = meta.icon;
  const first = fieldEl("first_name");
  const last = fieldEl("last_name");
  const company = fieldEl("company");
  const notes = fieldEl("notes");
  if (first) first.placeholder = meta.first;
  if (last) last.placeholder = meta.last;
  if (company) company.placeholder = meta.company;
  if (notes) notes.placeholder = meta.notes;
  const wrap = document.getElementById("exitCheckWrap");
  if (wrap) wrap.style.display = meta.checkout ? "flex" : "none";
  const exited = document.getElementById("vExited");
  if (!meta.checkout && exited) exited.checked = false;
  if (meta.food && exited) exited.checked = true;
  const hint = document.getElementById("plateHint");
  const info = document.getElementById("regInfo");
  if (hint) hint.style.display = meta.hint && fieldEl("plate") ? "" : "none";
  if (info) info.style.display = meta.info && fieldEl("plate") ? "" : "none";
  const cargoOpts = document.getElementById("regCargoOpts");
  if (cargoOpts) cargoOpts.classList.toggle("hidden", !meta.cargo);
  document.getElementById("cargoAction").value = "";
  document.querySelectorAll(".cargo-act").forEach((b) => b.classList.remove("on"));
  if (meta.food && notes) {
    notes.value = copyTemplates.yemek || meta.notes;
  }
}

function applyCargoAction(kind) {
  const notes = fieldEl("notes");
  const key = kind === "ver" ? "kargo_ver" : "kargo_al";
  const text = copyTemplates[key] || (kind === "ver"
    ? "KARGO TESLİM ETMEK İÇİN GİRİŞ YAPTI"
    : "KARGOYU TESLİM ALMAK İÇİN GİRİŞ YAPTI");
  if (notes) notes.value = text;
  document.getElementById("cargoAction").value = kind;
  document.querySelectorAll(".cargo-act").forEach((b) => {
    b.classList.toggle("on", b.dataset.cargo === kind);
  });
}

async function openVisitorRegister() {
  await loadSettings();
  document.getElementById("visitorForm").reset();
  const qs = document.getElementById("regQuickSearch");
  if (qs) qs.value = "";
  lastAlertMatchKey = "";
  renderRegFields();
  fillNowFields();
  setVisitTab("calisma");
  bindRegQuickSearch();
  bindAlertMatchLive();
  try {
    const n = await api("/api/app/visitors/next-no");
    document.getElementById("regNo").textContent = `#${n.record_no}`;
  } catch {
    document.getElementById("regNo").textContent = "#ZK-0001";
  }
  showView("visitor-form");
}

document.querySelectorAll(".reg-tab").forEach((btn) => {
  btn.addEventListener("click", () => setVisitTab(btn.dataset.type));
});
document.querySelectorAll(".cargo-act").forEach((btn) => {
  btn.addEventListener("click", () => applyCargoAction(btn.dataset.cargo));
});
document.getElementById("fabRegister").onclick = () => {
  if (isViewer()) showView("home");
  else openVisitorRegister();
};
document.getElementById("openRegisterMenu").onclick = () => {
  if (isViewer()) return toast("İzleyici modunda kayıt yapılamaz");
  openVisitorRegister();
};
document.getElementById("regBack").onclick = () => showView("home");

document.getElementById("visitorForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  syncEntryType();
  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd.entries());
  body.visit_type = currentVisitType;
  body.exited = Boolean(document.getElementById("vExited")?.checked);
  body.plate = String(body.plate || "").trim();
  body.entry_type = body.plate ? "ARAÇLI" : "YAYAN";
  body.vehicle_status = body.entry_type;
  body.companions = readCompanions();
  if (currentVisitType === "kargo") {
    const act = document.getElementById("cargoAction")?.value;
    if (!act) {
      toast("Kargo için Teslim Alacak veya Teslim Edecek seçin");
      return;
    }
    if (!String(body.notes || "").trim()) {
      applyCargoAction(act);
      body.notes = fieldEl("notes")?.value || "";
    }
  }
  if (currentVisitType === "yemek" && !String(body.notes || "").trim()) {
    body.notes = copyTemplates.yemek || "";
  }
  if (body.visit_date && String(body.visit_date).includes("-")) {
    body.visit_date = isoToTr(body.visit_date);
  }
  const firstName = String(body.first_name || "").trim();
  const lastName = String(body.last_name || "").trim();
  if (!firstName || !lastName) {
    toast("İsim ve soyisim zorunlu");
    return;
  }
  try {
    const data = await api("/api/app/visitors", { method: "POST", body });
    const extra = body.companions.length ? ` (+${body.companions.length} kişi)` : "";
    const alerts = data.alerts || [];
    const alertN = alerts.length;
    toast(
      alertN
        ? `Beklenen ziyaretçi geldi · bildirim gönderildi${extra}`
        : body.entry_type === "ARAÇLI"
          ? `Araçlı giriş kaydedildi${extra}`
          : `Yayan giriş kaydedildi${extra}`
    );
    if (alertN) {
      const a = alerts[0];
      const willEnter = !(a.will_enter === false || a.will_enter === "false" || a.will_enter === 0);
      showMatchBanner({
        title: willEnter ? "Beklenen · İçeri GİRECEK" : "Beklenen · İçeri GİRMEYECEK",
        body: `${data.item?.full_name || a.full_name || ""}${a.company || data.item?.company ? ` · ${a.company || data.item?.company}` : ""}${a.notes ? ` · ${a.notes}` : ""}`,
        willEnter,
      });
    }
    clearVisitorForm(e.target);
    showView("home");
    loadHome().catch(() => {});
  } catch (err) {
    toast(err.message || "Kayıt başarısız · sunucuya erişilemiyor olabilir");
  }
});

function clearVisitorForm(form) {
  form?.reset();
  setCompanions([]);
  fillNowFields();
  const outEl = fieldEl("exit_time");
  if (outEl) outEl.value = "";
  const exited = document.getElementById("vExited");
  if (exited) exited.checked = false;
  syncEntryType();
}

function isRegFormDirty() {
  if (!document.getElementById("view-visitor-form")?.classList.contains("active")) return false;
  const keys = ["first_name", "last_name", "company", "plate", "notes", "host", "phone"];
  for (const k of keys) {
    if (String(fieldEl(k)?.value || "").trim()) return true;
  }
  if (readCompanions().length) return true;
  return false;
}

function confirmRefreshIfDirty() {
  if (!isRegFormDirty()) return true;
  return confirm("Kayıt formu dolu. Yenilerseniz yazdıklarınız silinir. Devam edilsin mi?");
}

function doAppReload() {
  const onReg = document.getElementById("view-visitor-form")?.classList.contains("active");
  // Kayıt ekranında hard reload textbox'ları siler — soft yenile (form korunur)
  if (onReg) {
    softRefreshApp();
    return;
  }
  if (!confirmRefreshIfDirty()) {
    try {
      window.hidePtr?.();
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    const view = lastMainView || localStorage.getItem("s360_view") || "home";
    localStorage.setItem("s360_view", view);
    sessionStorage.setItem("s360_view", view);
  } catch {
    /* ignore */
  }
  location.reload();
}

async function softRefreshApp() {
  window.softRefreshApp = softRefreshApp;
  // Güncellemede oturumu düşürmemek için soft yenileme; PTR/buton hard reload kullanır
  try {
    window.showPtrRefreshing?.();
  } catch {
    /* ignore */
  }
  const view = lastMainView || (() => {
    try {
      return localStorage.getItem("s360_view") || "home";
    } catch {
      return "home";
    }
  })();
  try {
    await api("/api/auth/me")
      .then((d) => {
        if (d?.user) {
          me = d.user;
          window.currentUser = me;
        }
      })
      .catch(() => {});
    await loadSettings().catch(() => {});
    await loadHome().catch(() => {});
    await loadNotifs().catch(() => {});
    if (view === "visitors") await loadVisitors().catch(() => {});
    else if (view === "keys") await loadKeys().catch(() => {});
    else if (view === "alerts") await loadAlerts().catch(() => {});
    else if (view === "directory") await loadDirectory().catch(() => {});
    else if (view === "patrol") await loadPatrols().catch(() => {});
    else if (view === "announcements") await loadAnn().catch(() => {});
    else if (view === "profile") await loadProfile().catch(() => {});
    else if (view === "reminders") await loadReminders().catch(() => {});
    if (view && view !== "home" && view !== "chat") {
      const el = document.getElementById(`view-${view}`);
      if (el && !el.classList.contains("active")) showView(view);
    }
    toast("Yenilendi");
  } finally {
    try {
      window.hidePtr?.();
    } catch {
      /* ignore */
    }
  }
}

document.getElementById("alertForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const first = String(fd.get("first_name") || "").trim();
  const last = String(fd.get("last_name") || "").trim();
  const body = {
    first_name: first,
    last_name: last,
    full_name: `${first} ${last}`.trim(),
    company: String(fd.get("company") || "").trim(),
    notes: String(fd.get("notes") || "").trim(),
    will_enter: String(fd.get("will_enter") || "1") !== "0",
  };
  if (!body.first_name || !body.last_name) return toast("Ad ve soyad gerekli");
  try {
    await enablePush(true).catch(() => {});
    await api("/api/app/alerts", { method: "POST", body });
    toast("Haber verildi · bildirim gönderildi");
    e.target.reset();
    const yes = e.target.querySelector('input[name="will_enter"][value="1"]');
    if (yes) yes.checked = true;
    loadAlerts().catch(() => {});
  } catch (err) {
    toast(err.message || "Kayıt başarısız · sunucuya erişilemiyor olabilir");
  }
});
document.getElementById("visOpenMenu").onclick = openDrawer;
document.getElementById("alertOpenMenu")?.addEventListener("click", openDrawer);
document.getElementById("keyOpenMenu").onclick = openDrawer;
document.getElementById("keyNewBtn").onclick = openNewKeySheet;
document.getElementById("keySearch").addEventListener("input", renderKeys);
document.getElementById("keyFilterBtn").onclick = () => {
  document.getElementById("keyStatusFilters").classList.toggle("hidden");
};
document.querySelector(".drawer .who").onclick = () => showView("profile");
document.getElementById("visNewBtn").onclick = () => openVisitorRegister();
document.getElementById("visFilterToggle").onclick = () => {
  const box = document.getElementById("visFilters");
  box.classList.toggle("hidden");
  document.getElementById("visFilterToggle").classList.toggle("on", !box.classList.contains("hidden"));
};
document.getElementById("visSearch").addEventListener("input", () => {
  visPage = 1;
  renderVisitors();
});
["visStatus", "visEntry", "visDate", "visSort"].forEach((id) => {
  document.getElementById(id).addEventListener("change", () => {
    visPage = 1;
    renderVisitors();
  });
});
document.getElementById("visClear").onclick = () => {
  document.getElementById("visSearch").value = "";
  document.getElementById("visStatus").value = "all";
  document.getElementById("visEntry").value = "all";
  document.getElementById("visDate").value = "";
  document.getElementById("visSort").value = "new";
  visTypeFilter = "all";
  visQuick = "in";
  visPage = 1;
  renderVisitors();
};
document.getElementById("dirBack").onclick = () => {
  if (dirGroup) {
    dirGroup = null;
    renderDirectory();
    return;
  }
  showView("home");
};
document.getElementById("dirSearch").addEventListener("input", renderDirectory);
document.getElementById("sheetClose").onclick = closeSheet;
document.getElementById("sheetBg").onclick = closeSheet;

document.getElementById("emergencyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  await api("/api/app/emergency", { method: "POST", body: { message: fd.get("message") } });
  toast("Acil bildirim gönderildi");
});

async function enablePush(force) {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      if (force) toast("Bu tarayıcı / PWA bildirimi desteklemiyor (iOS’ta Ana Ekrana ekleyin)");
      return false;
    }
    const { publicKey } = await api("/api/auth/vapid");
    if (!publicKey) {
      if (force) toast("Sunucu VAPID anahtarı yok");
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    let perm = Notification.permission;
    if (perm !== "granted") {
      // Mobilde kullanıcı jesti gerekir
      perm = await Notification.requestPermission();
    }
    if (perm !== "granted") {
      if (force) toast("Bildirim izni verilmedi — Ayarlar’dan izin verin");
      return false;
    }
    const savedKey = localStorage.getItem("s360_vapid") || "";
    let sub = await reg.pushManager.getSubscription();
    const needFresh = !sub || (savedKey && savedKey !== publicKey) || force;
    if (needFresh && sub && savedKey && savedKey !== publicKey) {
      try {
        await sub.unsubscribe();
      } catch {
        /* ignore */
      }
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    const json = typeof sub.toJSON === "function" ? sub.toJSON() : sub;
    await api("/api/app/push/subscribe", {
      method: "POST",
      body: {
        endpoint: json.endpoint,
        keys: json.keys,
      },
    });
    localStorage.setItem("s360_vapid", publicKey);
    localStorage.setItem("s360_push_ok", "1");
    return true;
  } catch (err) {
    console.warn("enablePush", err);
    if (force) toast(err?.message || "Bildirim açılamadı");
    return false;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function boot() {
  // Eski çevrimdışı kuyrukları temizle
  try {
    localStorage.removeItem("s360_outbox_visitors");
    localStorage.removeItem("s360_outbox_alerts");
  } catch {
    /* ignore */
  }

  let data = null;
  let lastErr = null;
  for (let i = 0; i < 3; i += 1) {
    try {
      data = await api("/api/auth/me");
      break;
    } catch (err) {
      lastErr = err;
      if (err?.status === 401) {
        location.href = "/";
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!data?.user) {
    const ban = document.getElementById("serverBanner");
    if (ban) {
      ban.classList.add("show");
      ban.innerHTML = `${lastErr?.message || "Sunucuya erişilemiyor"} · <button type="button" id="serverRetryBtn">Yenile</button>`;
      document.getElementById("serverRetryBtn")?.addEventListener("click", () => location.reload());
    }
    toast(lastErr?.message || "Sunucuya erişilemiyor");
    return;
  }
  me = data.user;
  window.currentUser = me;
  const roleLabel = roleLabelOf(me.role);
  document.getElementById("helloName").textContent = me.full_name;
  document.getElementById("drawerName").textContent = me.full_name;
  document.getElementById("drawerRole").textContent = roleLabel;
  const daysEl = document.getElementById("homeDays");
  if (daysEl) daysEl.textContent = me.days_worked ?? "—";
  const initials = String(me.full_name || "S")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  document.getElementById("whoAv").textContent = initials;
  const chip = document.getElementById("openProfile");
  if (chip) {
    const letter = initials?.slice(0, 1) || "S";
    const firstName = String(me.full_name || "").trim().split(/\s+/)[0] || "—";
    chip.innerHTML = me.photo_url
      ? `<img src="${escHtml(me.photo_url)}" alt="" /><span class="profile-chip-meta"><b id="headerUserName">${escHtml(firstName)}</b><small id="headerUserRole">${escHtml(roleLabel)}</small></span>`
      : `<span id="headerAvatarLetter">${escHtml(letter)}</span><span class="profile-chip-meta"><b id="headerUserName">${escHtml(firstName)}</b><small id="headerUserRole">${escHtml(roleLabel)}</small></span>`;
  }
  if (me.role === "admin") {
    document.getElementById("adminLink")?.classList.remove("hidden");
    document.getElementById("keyNewBtn")?.classList.remove("hidden");
    document.getElementById("remindersMenuBtn")?.classList.remove("hidden");
  }
  applyRoleUi();
  tickClock();
  setInterval(tickClock, 30_000);
  let restored = "home";
  try {
    restored = localStorage.getItem("s360_view") || sessionStorage.getItem("s360_view") || "home";
  } catch {
    restored = "home";
  }
  if (location.hash.startsWith("#chat-")) {
    openChatPanel();
  } else if (restored === "chat") {
    openChatPanel();
  } else if (restored && restored !== "home") {
    showView(restored);
  } else if (isViewer()) {
    showView("home");
  }
  await loadSettings().catch(() => {});
  if (restored === "visitor-form") {
    renderRegFields();
    fillNowFields();
    bindAlertMatchLive();
  }
  await loadHome().catch(() => {});
  if (daysEl && window.currentUser?.days_worked != null) {
    daysEl.textContent = window.currentUser.days_worked;
  }
  await loadNotifs().catch(() => {});
  enablePush();
  bindUppercase(document);
  bindGlobalKeyboard();
  checkShiftTicker();
  setInterval(() => {
    loadNotifs().catch(() => {});
    checkShiftTicker();
    loadChat({ silent: true }).catch(() => {});
  }, 12_000);
  document.getElementById("enableNotifBtn")?.addEventListener("click", async () => {
    const ok = await enablePush(true);
    if (ok) toast("Canlı bildirim açıldı · test için acil/kargo gönderin");
  });
  document.getElementById("btnRefresh")?.addEventListener("click", () => doAppReload());
  document.getElementById("openProfile")?.addEventListener("click", () => showView("profile"));
  document.getElementById("openPasswordView")?.addEventListener("click", () => showView("password"));
  document.getElementById("bioAddBtn")?.addEventListener("click", registerWebAuthn);
  document.getElementById("bioRemoveBtn")?.addEventListener("click", removeWebAuthn);
  document.getElementById("homeBulkExit")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isViewer()) return toast("İzleyici modunda işlem yok");
    openBulkExitSheet();
  });
  document.getElementById("homeCargoBtn")?.addEventListener("click", () => {
    if (isViewer()) return toast("İzleyici modunda işlem yok");
    openNoteSheet("cargo");
  });
  document.getElementById("homeNoteBtn")?.addEventListener("click", () => {
    if (isViewer()) return toast("İzleyici modunda işlem yok");
    openNoteSheet("note");
  });
  document.getElementById("chatFab")?.addEventListener("click", () => openChatPanel());
  document.getElementById("chatClose")?.addEventListener("click", () => closeChatPanel(true));
  document.getElementById("chatCloseX")?.addEventListener("click", () => closeChatPanel(true));
  document.getElementById("chatSettingsBtn")?.addEventListener("click", () => openChatSettings());
  document.getElementById("chatSettingsSave")?.addEventListener("click", () => saveChatSettings());
  document.getElementById("chatClearAll")?.addEventListener("click", async () => {
    if (window.currentUser?.role !== "admin") return;
    if (!confirm("Tüm sohbet mesajları silinsin mi?")) return;
    try {
      await api("/api/app/chat", { method: "DELETE" });
      toast("Sohbet temizlendi");
      document.getElementById("chatSettings")?.classList.add("hidden");
      loadChat();
    } catch (err) {
      toast(err.message || "Temizlenemedi");
    }
  });
  document.getElementById("notifReadAll")?.addEventListener("click", async () => {
    await loadNotifs({ markRead: true, all: true });
    toast("Tümü okundu");
  });
  document.getElementById("notifSeeAll")?.addEventListener("click", () => loadNotifs({ all: true }));
  document.getElementById("profileForm")?.addEventListener("submit", saveProfile);
  document.getElementById("passwordForm")?.addEventListener("submit", savePassword);
  document.getElementById("reminderForm")?.addEventListener("submit", saveReminder);
  document.getElementById("chatForm")?.addEventListener("submit", sendChat);
  document.getElementById("chatReplyCancel")?.addEventListener("click", () => {
    chatReplyTo = null;
    document.getElementById("chatReplyBar")?.classList.add("hidden");
  });
  document.getElementById("pfPhotoFile")?.addEventListener("change", () => {
    const f = document.getElementById("pfPhotoFile").files?.[0];
    if (!f) return;
    if (f.size > 1_800_000) return toast("Fotoğraf çok büyük");
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById("pfPhoto").value = String(reader.result || "");
      window.__profilePhotoDirty = true;
    };
    reader.readAsDataURL(f);
  });
  navigator.serviceWorker?.addEventListener("message", (ev) => {
    if (ev.data?.type === "OPEN_CHAT") {
      openChatPanel();
      if (ev.data.chatId) setTimeout(() => jumpToChatMessage(ev.data.chatId), 350);
    }
    if (ev.data?.type === "PUSH_EVENT" && !ev.data.silent) {
      showLivePushBanner({
        title: ev.data.title,
        body: ev.data.body,
        notifType: ev.data.notifType || ev.data.type || "info",
      });
      loadNotifs({ silentBanner: true }).catch(() => {});
    }
    if (ev.data?.type === "ALERT_MATCH") {
      const body = String(ev.data.body || "");
      const willEnter = !/GİRMEYECEK|GIRMEYECEK/i.test(body);
      showMatchBanner({
        title: ev.data.title || "Beklenen ziyaretçi",
        body,
        willEnter,
      });
      loadNotifs({ silentBanner: true }).catch(() => {});
    }
  });
  if (location.hash.startsWith("#chat-")) {
    const id = location.hash.slice(6);
    setTimeout(() => jumpToChatMessage(id), 400);
  }
  updateBioUi(Boolean(me.has_webauthn) || Boolean(readSavedLogin()));
}

function bindGlobalKeyboard() {
  if (window.__kbNavBound || !window.visualViewport) return;
  window.__kbNavBound = true;
  const sync = () => {
    const vv = window.visualViewport;
    const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    // Klavye üstüne navbar çıkmasın — --kb ile tabbar yükseltme
    document.documentElement.style.setProperty("--kb", "0px");
    document.documentElement.classList.toggle("kb-open", inset > 80);
    document.querySelector(".app-root")?.classList.toggle("kb-open-root", inset > 80);
  };
  window.visualViewport.addEventListener("resize", sync);
  window.visualViewport.addEventListener("scroll", sync);
  sync();
}

async function loadProfile() {
  try {
    const { user } = await api("/api/app/profile");
    window.currentUser = user;
    me = user;
    document.getElementById("profileName").textContent = user.full_name || "—";
    document.getElementById("profileRole").textContent = roleLabelOf(user.role);
    const titleEl = document.getElementById("profileTitle");
    if (titleEl) titleEl.textContent = user.title_name || "";
    const homeDays = document.getElementById("homeDays");
    if (homeDays) homeDays.textContent = user.days_worked ?? 0;
    const av = document.getElementById("profileAvatar");
    if (user.photo_url) av.innerHTML = `<img src="${escHtml(user.photo_url)}" alt="" />`;
    else {
      av.textContent = String(user.full_name || "S")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
    }
    document.getElementById("pfName").value = user.full_name || "";
    const pfPhone = document.getElementById("pfPhone");
    if (pfPhone) pfPhone.value = user.phone || "";
    document.getElementById("pfId").value = user.id_no || "";
    document.getElementById("pfGender").value = user.gender || "";
    document.getElementById("pfMarital").value = user.marital_status || "";
    document.getElementById("pfBlood").value = user.blood_type || "";
    document.getElementById("pfArmed").value = user.armed || "";
    document.getElementById("pfShoe").value = user.shoe_size || "";
    document.getElementById("pfPants").value = user.pants_size || "";
    document.getElementById("pfShirt").value = user.shirt_size || "";
    document.getElementById("pfCoat").value = user.coat_size || "";
    document.getElementById("pfSweater").value = user.sweater_size || "";
    document.getElementById("pfStart").value = user.start_date
      ? String(user.start_date).slice(0, 10)
      : "";
    document.getElementById("pfPhoto").value = user.photo_url || "";
    window.__profilePhotoDirty = false;
    updateBioUi(Boolean(user.has_webauthn) || Boolean(readSavedLogin()));
  } catch (err) {
    toast(err.message || "Profil yüklenemedi");
  }
}

function updateBioUi(has) {
  const enabled = Boolean(has) || Boolean(readSavedLogin()) || Boolean(localStorage.getItem("s360_webauthn_cred"));
  const status = document.getElementById("bioStatus");
  const addBtn = document.getElementById("bioAddBtn");
  const removeBtn = document.getElementById("bioRemoveBtn");
  const passWrap = document.getElementById("bioPassWrap");
  if (status) {
    status.textContent = enabled
      ? "Tanımlı · parmak/desen ile kullanıcı adı ve şifre otomatik girilir"
      : "Yok · şifrenizi yazıp parmak/desen ekleyin (sadece 1 adet)";
  }
  if (addBtn) addBtn.classList.toggle("hidden", enabled);
  if (removeBtn) removeBtn.classList.toggle("hidden", !enabled);
  if (passWrap) passWrap.classList.toggle("hidden", enabled);
}

async function registerWebAuthn() {
  if (!window.PublicKeyCredential) return toast("Bu cihaz parmak/desen desteklemiyor");
  const password = String(document.getElementById("bioPassword")?.value || "").trim();
  if (!password) return toast("Önce hesap şifrenizi yazın");
  const username = me?.username || window.currentUser?.username;
  if (!username) return toast("Oturum bulunamadı");
  try {
    // Şifreyi doğrula
    await api("/api/auth/login", { method: "POST", body: { username, password } });
    // Varsa eski kaydı temizle
    try {
      await api("/api/auth/webauthn", { method: "DELETE" });
    } catch {
      /* ignore */
    }
    const options = await api("/api/auth/webauthn/register/options", { method: "POST", body: {} });
    const attestation = await window.waCreate(options);
    const data = await api("/api/auth/webauthn/register/verify", {
      method: "POST",
      body: attestation,
    });
    const credId = data.credId || attestation.id;
    if (credId) localStorage.setItem("s360_webauthn_cred", credId);
    saveLocalLogin(username, password);
    localStorage.setItem("s360_user", username);
    if (me) me.has_webauthn = true;
    const pw = document.getElementById("bioPassword");
    if (pw) pw.value = "";
    updateBioUi(true);
    toast("Parmak izi / desen eklendi");
  } catch (err) {
    toast(err.message || "Eklenemedi");
  }
}

async function removeWebAuthn() {
  if (!confirm("Parmak izi / desen silinsin mi?")) return;
  let serverOk = false;
  try {
    await api("/api/auth/webauthn", { method: "DELETE" });
    serverOk = true;
  } catch (err) {
    try {
      await api("/api/auth/webauthn/clear", { method: "POST", body: {} });
      serverOk = true;
    } catch {
      toast(err.message || "Sunucudan silinemedi · yerel kayıt temizlendi");
    }
  }
  clearLocalLogin();
  localStorage.removeItem("s360_webauthn_cred");
  if (me) me.has_webauthn = false;
  updateBioUi(false);
  if (serverOk) toast("Parmak izi silindi");
}

async function saveProfile(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd.entries());
  // Boş alanlar Postgres'teki mevcut değeri silmesin
  for (const k of Object.keys(body)) {
    if (body[k] === "" || body[k] == null) delete body[k];
  }
  if (!window.__profilePhotoDirty) delete body.photo_url;
  if (!body.photo_url) delete body.photo_url;
  try {
    const { user } = await api("/api/app/profile", { method: "PATCH", body });
    window.currentUser = user;
    me = user;
    cacheSession(user);
    toast("Profil kaydedildi");
    await loadProfile();
  } catch (err) {
    toast(err.message || "Kaydedilemedi");
  }
}

async function savePassword(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await api("/api/app/profile/password", {
      method: "POST",
      body: { current: fd.get("current"), next: fd.get("next") },
    });
    toast("Şifre güncellendi");
    e.target.reset();
    showView("profile");
  } catch (err) {
    toast(err.message || "Şifre değiştirilemedi");
  }
}

async function loadReminders() {
  if (window.currentUser?.role !== "admin") {
    toast("Sadece yönetici");
    return showView("home");
  }
  try {
    const { items } = await api("/api/app/reminders");
    const box = document.getElementById("reminderList");
    if (!box) return;
    box.innerHTML = items?.length
      ? items
          .map(
            (r) => `<div class="item-row rem-row">
          <div>
            <b>${escHtml(r.title)}</b>
            <span>${escHtml(r.start_time || "")}${r.end_time ? `–${escHtml(r.end_time)}` : ""} · ${r.interval_min || 120} dk · ${escHtml(r.days || "everyday")}</span>
            ${r.body ? `<small>${escHtml(r.body)}</small>` : ""}
          </div>
          <button type="button" class="vis-act" data-rem-del="${r.id}" style="border-color:rgba(239,68,68,.5);color:#f87171">Sil</button>
        </div>`
          )
          .join("")
      : `<div class="item-row"><span>Henüz hatırlatıcı yok</span></div>`;
    box.querySelectorAll("[data-rem-del]").forEach((b) => {
      b.onclick = async () => {
        if (!confirm("Hatırlatıcı silinsin mi?")) return;
        try {
          await api(`/api/app/reminders/${b.dataset.remDel}`, { method: "DELETE" });
          toast("Silindi");
          loadReminders();
        } catch (err) {
          toast(err.message || "Silinemedi");
        }
      };
    });
  } catch (err) {
    toast(err.message || "Liste alınamadı");
  }
}

async function saveReminder(e) {
  e.preventDefault();
  if (window.currentUser?.role !== "admin") return toast("Sadece yönetici");
  const fd = new FormData(e.target);
  try {
    await api("/api/app/reminders", {
      method: "POST",
      body: {
        title: String(fd.get("title") || "").trim(),
        body: String(fd.get("body") || "").trim(),
        start_time: fd.get("start_time"),
        end_time: fd.get("end_time") || null,
        interval_min: Number(fd.get("interval_min") || 120),
        days: fd.get("days") || "everyday",
      },
    });
    toast("Hatırlatıcı eklendi");
    e.target.reset();
    document.querySelector('#reminderForm [name="start_time"]').value = "20:00";
    document.querySelector('#reminderForm [name="end_time"]').value = "06:00";
    document.querySelector('#reminderForm [name="interval_min"]').value = "120";
    loadReminders();
  } catch (err) {
    toast(err.message || "Eklenemedi");
  }
}

async function loadChat(opts = {}) {
  const data = await api("/api/app/chat");
  const items = data.items || [];
  const box = document.getElementById("chatList");
  if (!box) return;
  const meId = window.currentUser?.id;
  const newest = items?.[items.length - 1]?.created_at || "";
  const isNew = Boolean(newest && lastChatStamp && newest > lastChatStamp);
  if (isNew && !window.chatOpen) {
    document.getElementById("chatDot").style.display = "block";
    if (typeof playNotifyBeep === "function") playNotifyBeep();
    if (window.haptic) window.haptic("ok");
  }
  if (newest) lastChatStamp = newest;
  if (window.chatOpen) document.getElementById("chatDot").style.display = "none";
  if (opts.silent && !window.chatOpen) return;

  const canPost = data.can_post !== false;
  const input = document.getElementById("chatInput");
  const sendBtn = document.querySelector("#chatForm .chat-send");
  if (input) {
    input.disabled = !canPost;
    input.placeholder = canPost ? "Mesaj yaz..." : "Sadece yöneticiler yazabilir";
  }
  if (sendBtn) sendBtn.disabled = !canPost;
  const sub = document.getElementById("chatSub");
  if (sub) sub.textContent = data.managers_only ? "Sadece yöneticiler yazabilir" : "Ekip mesajları";

  box.innerHTML = items.length
    ? items
        .map((m) => {
          const mine = String(m.user_id) === String(meId);
          const deleted = Boolean(m.deleted_at);
          const canDel = !deleted && (mine || window.currentUser?.role === "admin");
          const av = m.photo_url
            ? `<img class="chat-av" src="${escHtml(m.photo_url)}" alt="" />`
            : `<span class="chat-av letter">${escHtml(String(m.user_name || "?").trim().charAt(0).toUpperCase())}</span>`;
          return `<div class="chat-bubble${mine ? " mine" : ""}${deleted ? " deleted" : ""}" data-mid="${m.id}" data-reply-to="${m.reply_to || ""}">
        <div class="chat-head">${av}<div class="chat-head-txt">
          ${m.title_name ? `<div class="chat-title">${escHtml(m.title_name)}</div>` : ""}
          <div class="who">${escHtml(m.user_name || "—")}</div>
        </div></div>
        ${!deleted && m.reply_body ? `<button type="button" class="reply-ref" data-jump="${m.reply_to || ""}">${escHtml(m.reply_user_name || "")}: ${escHtml(m.reply_body)}</button>` : ""}
        <div class="chat-body">${deleted ? "Bu mesaj silindi" : escHtml(m.body)}</div>
        <div class="chat-meta">${fmtDateTime(m.created_at)}${
          !deleted && Array.isArray(m.seen_by) && m.seen_by.filter((n) => n && n !== m.user_name).length
            ? `<span class="chat-seen"> · Görüldü: ${escHtml(m.seen_by.filter((n) => n && n !== m.user_name).join(", "))}</span>`
            : !deleted && mine
              ? `<span class="chat-seen"> · Görülmedi</span>`
              : ""
        }</div>
        ${
          deleted
            ? ""
            : `<div class="chat-acts">
          <button type="button" class="vis-act" data-reply="${m.id}">Cevapla</button>
          ${canDel ? `<button type="button" class="vis-act" data-cdel="${m.id}">Sil</button>` : ""}
        </div>`
        }
      </div>`;
        })
        .join("")
    : `<div class="dir-info" style="padding:20px;text-align:center;color:#888">Henüz mesaj yok</div>`;

  box.querySelectorAll("[data-reply]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      setChatReply(b.dataset.reply);
    };
  });
  box.querySelectorAll("[data-cdel]").forEach((b) => {
    b.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("Mesaj herkesten silinsin mi?")) return;
      try {
        await api(`/api/app/chat/${b.dataset.cdel}`, { method: "DELETE" });
        loadChat();
      } catch (err) {
        toast(err.message || "Silinemedi");
      }
    };
  });
  box.querySelectorAll("[data-jump]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      if (b.dataset.jump) jumpToChatMessage(b.dataset.jump);
    };
  });
  bindChatSwipe(box);
  if (!opts.silent) box.scrollTop = box.scrollHeight;
  // Alta indi = tüm mesajları gördü
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 48;
  if (window.chatOpen && (atBottom || !opts.silent)) {
    const ids = items.filter((m) => !m.deleted_at).map((m) => m.id);
    if (ids.length) {
      api("/api/app/chat/read", { method: "POST", body: { message_ids: ids } }).catch(() => {});
    }
  }
  if (!box.dataset.seenScrollBound) {
    box.dataset.seenScrollBound = "1";
    box.addEventListener("scroll", () => {
      if (!window.chatOpen) return;
      if (box.scrollHeight - box.scrollTop - box.clientHeight > 40) return;
      const ids = [...box.querySelectorAll("[data-mid]")].map((el) => el.dataset.mid).filter(Boolean);
      if (ids.length) api("/api/app/chat/read", { method: "POST", body: { message_ids: ids } }).catch(() => {});
    });
  }
}

async function openChatSettings() {
  const box = document.getElementById("chatSettings");
  if (!box) return;
  box.classList.toggle("hidden");
  if (box.classList.contains("hidden")) return;
  const clearBtn = document.getElementById("chatClearAll");
  if (clearBtn) clearBtn.classList.toggle("hidden", window.currentUser?.role !== "admin");
  if (window.currentUser?.role !== "admin") {
    document.getElementById("chatManagersOnlyRow").style.display = "none";
    document.getElementById("chatManagerList").innerHTML =
      '<p style="font-size:12px;color:#999">Ayarları sadece yönetici değiştirebilir.</p>';
    document.getElementById("chatSettingsSave").style.display = "none";
    return;
  }
  document.getElementById("chatManagersOnlyRow").style.display = "";
  document.getElementById("chatSettingsSave").style.display = "";
  try {
    const data = await api("/api/app/chat/settings");
    document.getElementById("chatManagersOnly").checked = Boolean(data.managers_only);
    document.getElementById("chatManagerList").innerHTML = (data.users || [])
      .map(
        (u) =>
          `<label><input type="checkbox" data-cm="${u.id}" ${
            u.chat_manager || u.role === "admin" || u.role === "supervisor" ? "checked" : ""
          } ${u.role === "admin" || u.role === "supervisor" ? "disabled" : ""}/> ${escHtml(
            u.full_name
          )} <small style="color:#888">(${escHtml(u.role)})</small></label>`
      )
      .join("");
  } catch (err) {
    toast(err.message || "Ayarlar alınamadı");
  }
}

async function saveChatSettings() {
  if (window.currentUser?.role !== "admin") return;
  const managers_only = Boolean(document.getElementById("chatManagersOnly")?.checked);
  const manager_ids = [...document.querySelectorAll("[data-cm]:checked")]
    .map((el) => el.dataset.cm)
    .filter(Boolean);
  try {
    await api("/api/app/chat/settings", {
      method: "PATCH",
      body: { managers_only, manager_ids },
    });
    toast("Sohbet ayarları kaydedildi");
    document.getElementById("chatSettings")?.classList.add("hidden");
    loadChat();
  } catch (err) {
    toast(err.message || "Kaydedilemedi");
  }
}

function setChatReply(id) {
  chatReplyTo = id;
  const input = document.getElementById("chatInput");
  input?.focus();
  const bar = document.getElementById("chatReplyBar");
  if (bar) {
    bar.classList.remove("hidden");
    bar.querySelector("span").textContent = "Cevap yazılıyor…";
  }
  toast("Cevap modu");
}

function jumpToChatMessage(id) {
  const safe = String(id || "").replace(/"/g, "");
  const el = document.querySelector(`#chatList [data-mid="${safe}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 1400);
}

function bindChatSwipe(box) {
  box.querySelectorAll(".chat-bubble").forEach((bubble) => {
    let x0 = 0;
    let dragging = false;
    bubble.addEventListener(
      "touchstart",
      (e) => {
        x0 = e.touches[0].clientX;
        dragging = true;
        bubble.style.transition = "none";
      },
      { passive: true }
    );
    bubble.addEventListener(
      "touchmove",
      (e) => {
        if (!dragging) return;
        const dx = Math.max(0, Math.min(88, e.touches[0].clientX - x0));
        bubble.style.transform = `translateX(${dx}px)`;
      },
      { passive: true }
    );
    bubble.addEventListener(
      "touchend",
      (e) => {
        if (!dragging) return;
        dragging = false;
        const dx = e.changedTouches[0].clientX - x0;
        bubble.style.transition = "transform 0.22s ease";
        bubble.style.transform = "";
        if (dx > 56) setChatReply(bubble.dataset.mid);
      },
      { passive: true }
    );
  });
}

async function sendChat(e) {
  e.preventDefault();
  const input = document.getElementById("chatInput");
  const body = String(input.value || "").trim();
  if (!body) return;
  try {
    await api("/api/app/chat", { method: "POST", body: { body, reply_to: chatReplyTo } });
    input.value = "";
    chatReplyTo = null;
    document.getElementById("chatReplyBar")?.classList.add("hidden");
    loadChat();
  } catch (err) {
    toast(err.message || "Gönderilemedi");
  }
}

boot();
