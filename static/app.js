const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) { tg.ready(); tg.expand(); }

const MAX_LEVEL = 100;
function levelThreshold(level) { return 100 * level * (level - 1); }
function computeLevel(coins) {
  let level = 1;
  for (let L = 2; L <= MAX_LEVEL; L++) {
    if (coins >= levelThreshold(L)) level = L; else break;
  }
  return level;
}
function coinsPerTap(level) { return level; }
function levelProgress(coins, level) {
  if (level >= MAX_LEVEL) return { progress: 1, nextTh: null };
  const prev = levelThreshold(level);
  const next = levelThreshold(level + 1);
  const span = next - prev;
  const progress = span ? (coins - prev) / span : 1;
  return { progress: Math.max(0, Math.min(1, progress)), nextTh: next };
}

function getUser() {
  const tgUser = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
  if (tgUser) {
    return { id: tgUser.id, first_name: tgUser.first_name || "لاعب", photo_url: tgUser.photo_url || "" };
  }
  let guestId = localStorage.getItem("cc_guest_id");
  if (!guestId) {
    guestId = String(Math.floor(Math.random() * 1e9));
    localStorage.setItem("cc_guest_id", guestId);
  }
  return { id: Number(guestId), first_name: "ضيف", photo_url: "" };
}

const user = getUser();

// ===== الحالة المحلية (للتحديث اللحظي) =====
let S = {
  coins: 0, energy: 100, max_energy: 100, seconds_to_refill: 0,
  level: 1, coins_per_tap: 1, squares: [], total_taps: 0, ads_watched: 0,
};

let pendingTaps = 0;
let sendTimer = null;
let sendInFlight = false;
let lastAdClientTime = 0;

const els = {
  avatar: document.getElementById("avatar"),
  userName: document.getElementById("userName"),
  levelNum: document.getElementById("levelNum"),
  topCoins: document.getElementById("topCoins"),
  coinCount: document.getElementById("coinCount"),
  energyNum: document.getElementById("energyNum"),
  energyMax: document.getElementById("energyMax"),
  energyFill: document.getElementById("energyFill"),
  energyRefill: document.getElementById("energyRefill"),
  perTap: document.getElementById("perTap"),
  coinBtn: document.getElementById("coinBtn"),
  particles: document.getElementById("particles"),
  skyline: document.getElementById("skyline"),
  cityList: document.getElementById("cityList"),
  levelBarNum: document.getElementById("levelBarNum"),
  levelBarNext: document.getElementById("levelBarNext"),
  levelBarFill: document.getElementById("levelBarFill"),
  adBtn: document.getElementById("adBtn"),
  adOverlay: document.getElementById("adOverlay"),
  adProgressFill: document.getElementById("adProgressFill"),
  tasksList: document.getElementById("tasksList"),
  boardList: document.getElementById("boardList"),
  myRank: document.getElementById("myRank"),
};

function formatNum(n) { return Math.floor(n).toLocaleString("en-US"); }

function renderProfile() {
  els.userName.textContent = user.first_name;
  if (user.photo_url) {
    els.avatar.innerHTML = `<img src="${user.photo_url}" alt="">`;
  } else {
    els.avatar.textContent = (user.first_name || "؟").trim().charAt(0);
  }
}

function renderCore() {
  els.levelNum.textContent = S.level;
  els.topCoins.textContent = formatNum(S.coins);
  els.coinCount.textContent = formatNum(S.coins);
  els.energyNum.textContent = S.energy;
  els.energyMax.textContent = S.max_energy;
  els.energyFill.style.width = `${(S.energy / S.max_energy) * 100}%`;
  els.perTap.textContent = S.coins_per_tap;
  renderRefillCountdown();

  const { progress, nextTh } = levelProgress(S.coins, S.level);
  els.levelBarNum.textContent = S.level;
  els.levelBarFill.style.width = `${progress * 100}%`;
  els.levelBarNext.textContent = S.level >= MAX_LEVEL
    ? "وصلت لأقصى مستوى! 🎉"
    : `${formatNum(nextTh - S.coins)} CCL للمستوى الجاي`;
}

function renderRefillCountdown() {
  if (S.energy >= S.max_energy) {
    els.energyRefill.textContent = "طاقة كاملة";
  } else {
    const m = Math.floor(S.seconds_to_refill / 60);
    const s = S.seconds_to_refill % 60;
    els.energyRefill.textContent = `تجديد كامل بعد ${m}:${String(s).padStart(2, "0")}`;
  }
}

const PLOT_ICONS = ["⛺", "🏠", "🏡", "🏢", "🏬", "🕌", "🎡", "🗼", "🏟️", "🌆"];

function renderCity() {
  if (!S.squares || S.squares.length === 0) return;

  els.skyline.innerHTML = "";
  S.squares.forEach((sq) => {
    const div = document.createElement("div");
    const heightPct = sq.status === "locked" ? 6 : Math.max(10, sq.progress * 100);
    div.className = `sky-building ${sq.status}`;
    div.style.height = `${heightPct}%`;
    div.textContent = sq.status === "locked" ? "" : sq.icon;
    els.skyline.appendChild(div);
  });

  els.cityList.innerHTML = "";
  S.squares.forEach((sq) => {
    const row = document.createElement("div");
    row.className = `city-row ${sq.status}`;
    const statusIcon = sq.status === "built" ? "✅" : sq.status === "building" ? "🚧" : "🔒";
    row.innerHTML = `
      <span class="city-row-icon">${sq.icon}</span>
      <div class="city-row-info">
        <div class="city-row-name">${sq.name} <span style="color:var(--text-muted);font-weight:400;">(مستوى ${sq.level_range})</span></div>
        ${sq.status !== "locked" ? `<div class="city-row-bar"><div class="city-row-bar-fill" style="width:${Math.round(sq.progress * 100)}%"></div></div>` : ""}
      </div>
      <span class="city-row-status">${statusIcon}</span>
    `;
    els.cityList.appendChild(row);
  });
}

function spawnParticle() {
  const p = document.createElement("span");
  p.className = "particle";
  p.textContent = `+${S.coins_per_tap}`;
  const offsetX = (Math.random() - 0.5) * 60;
  p.style.left = `calc(50% + ${offsetX}px)`;
  p.style.top = "40%";
  els.particles.appendChild(p);
  setTimeout(() => p.remove(), 800);
}

// ===== مزامنة مع السيرفر =====
function applyServerState(state) {
  S = {
    coins: state.coins, energy: state.energy, max_energy: state.max_energy,
    seconds_to_refill: state.seconds_to_refill, level: state.level,
    coins_per_tap: state.coins_per_tap, squares: state.squares,
    total_taps: state.total_taps, ads_watched: state.ads_watched,
  };
  renderCore();
  renderCity();
}

async function fetchState() {
  const params = new URLSearchParams({ user_id: user.id, first_name: user.first_name, photo_url: user.photo_url });
  const res = await fetch(`/api/state?${params.toString()}`);
  const state = await res.json();
  applyServerState(state);
}

async function sendPendingTaps() {
  if (pendingTaps === 0 || sendInFlight) return;
  const count = pendingTaps;
  pendingTaps = 0;
  sendInFlight = true;
  try {
    const res = await fetch("/api/tap_batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, first_name: user.first_name, photo_url: user.photo_url, count }),
    });
    const state = await res.json();
    applyServerState(state);
    if (state.leveled_up && tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
  } catch (e) {
    pendingTaps += count; // رجّع العدّاد لو الاتصال فشل
  } finally {
    sendInFlight = false;
    if (pendingTaps > 0) sendTimer = setTimeout(sendPendingTaps, 300);
  }
}

// ===== الضغط اللحظي =====
els.coinBtn.addEventListener("click", () => {
  if (S.energy <= 0) {
    els.coinBtn.style.transform = "scale(0.96)";
    setTimeout(() => (els.coinBtn.style.transform = ""), 100);
    return;
  }
  S.energy -= 1;
  S.coins += S.coins_per_tap;
  S.total_taps += 1;
  const newLevel = computeLevel(S.coins);
  if (newLevel > S.level) {
    S.level = newLevel;
    S.coins_per_tap = coinsPerTap(newLevel);
  }
  renderCore();
  spawnParticle();
  if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");

  pendingTaps += 1;
  clearTimeout(sendTimer);
  sendTimer = setTimeout(sendPendingTaps, 250);
});

// ===== الإعلان الحقيقي (Monetag) =====
const AD_SDK_FN = "show_11673059"; // اسم الدالة اللي جابها Monetag

els.adBtn.addEventListener("click", () => {
  const now = Date.now();
  if (now - lastAdClientTime < 15000) return;
  if (typeof window[AD_SDK_FN] !== "function") {
    alert("الإعلانات لسه بتتحمّل، جرب تاني بعد شوية.");
    return;
  }
  lastAdClientTime = now;

  els.adBtn.disabled = true;
  els.adOverlay.classList.remove("hidden");
  els.adProgressFill.style.width = "60%";

  window[AD_SDK_FN]()
    .then(() => {
      finishAdWatch();
    })
    .catch(() => {
      els.adOverlay.classList.add("hidden");
      els.adBtn.disabled = false;
      lastAdClientTime = 0;
    });
});

async function finishAdWatch() {
  els.adOverlay.classList.add("hidden");
  els.adBtn.disabled = false;
  try {
    const res = await fetch("/api/watch_ad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, first_name: user.first_name, photo_url: user.photo_url }),
    });
    const state = await res.json();
    if (res.ok) {
      applyServerState(state);
      if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
    }
  } catch (e) { /* تجاهل */ }
}

// ===== المهام =====
async function loadTasks() {
  const res = await fetch(`/api/tasks?user_id=${user.id}`);
  const tasks = await res.json();
  els.tasksList.innerHTML = "";
  tasks.forEach((t) => {
    const card = document.createElement("div");
    card.className = "task-card";
    const btnLabel = t.status === "claimed" ? "تم ✓" : t.status === "available" ? "استلم" : "مقفول";
    card.innerHTML = `
      <div class="task-info">
        <div class="task-title">${t.title}</div>
        <div class="task-reward">+${t.reward} CCL</div>
      </div>
      <button class="task-btn ${t.status}" ${t.status !== "available" ? "disabled" : ""} data-id="${t.id}">${btnLabel}</button>
    `;
    els.tasksList.appendChild(card);
  });

  els.tasksList.querySelectorAll(".task-btn.available").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const res = await fetch("/api/tasks/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, task_id: btn.dataset.id }),
      });
      const state = await res.json();
      if (res.ok) {
        applyServerState(state);
        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
        loadTasks();
      } else {
        btn.disabled = false;
      }
    });
  });
}

// ===== الصدارة =====
async function loadLeaderboard() {
  const res = await fetch(`/api/leaderboard?user_id=${user.id}`);
  const data = await res.json();
  els.myRank.innerHTML = data.my_rank ? `ترتيبك الحالي: <b>#${data.my_rank}</b>` : "";
  els.boardList.innerHTML = "";
  data.leaderboard.forEach((p) => {
    const row = document.createElement("div");
    const topClass = p.rank <= 3 ? `top${p.rank}` : "";
    row.className = `board-row ${topClass}`;
    const medal = p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : p.rank;
    const avatarContent = p.photo_url ? `<img src="${p.photo_url}">` : (p.first_name || "؟").charAt(0);
    row.innerHTML = `
      <span class="board-rank">${medal}</span>
      <span class="board-avatar">${avatarContent}</span>
      <span class="board-name">${p.first_name}</span>
      <span class="board-coins">${formatNum(p.coins)} CCL</span>
    `;
    els.boardList.appendChild(row);
  });
}

// ===== تبديل التابات =====
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
    document.getElementById(`screen-${btn.dataset.tab}`).classList.remove("hidden");

    if (btn.dataset.tab === "tasks") loadTasks();
    if (btn.dataset.tab === "leaderboard") loadLeaderboard();
  });
});

// ===== عداد الطاقة كل ثانية =====
setInterval(() => {
  if (S.seconds_to_refill > 0) {
    S.seconds_to_refill -= 1;
    renderRefillCountdown();
    if (S.seconds_to_refill <= 0) fetchState();
  }
}, 1000);

renderProfile();
fetchState();
setInterval(fetchState, 10000);
