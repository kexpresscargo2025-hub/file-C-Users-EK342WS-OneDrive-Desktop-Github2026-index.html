const MILESTONES = [
  10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000,
  120000, 160000, 200000, 240000, 280000, 300000,
];

const DUE_SOON_KM = 2000;
const STORAGE_KEY = "vehicleServicePlanner";
const SORT_KEY = "vehicleServicePlannerSort";
const VIEW_KEY = "vehicleServicePlannerView";
const INSTALL_DISMISS_KEY = "vehicleServicePlannerInstallDismissed";
const STATUS_ORDER = { overdue: 0, soon: 1, ok: 2 };

let deferredInstallPrompt = null;

let vehicles = loadVehicles();
let editingId = null;
let searchQuery = "";
let sortBy = loadSortPreference();
let viewMode = loadViewMode();

const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const mobileList = document.getElementById("mobileList");
const summary = document.getElementById("summary");
const vehicleDialog = document.getElementById("vehicleDialog");
const vehicleForm = document.getElementById("vehicleForm");
const milestoneChecks = document.getElementById("milestoneChecks");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");

document.getElementById("addVehicleBtn").addEventListener("click", () => openDialog());
document.getElementById("addVehicleBtnDesktop")?.addEventListener("click", () => openDialog());
document.getElementById("cancelBtn").addEventListener("click", () => vehicleDialog.close());
document.getElementById("exportBtn").addEventListener("click", exportCsv);
document.getElementById("exportBtnDesktop")?.addEventListener("click", exportCsv);
document.getElementById("importInput").addEventListener("change", importCsv);
document.getElementById("importInputDesktop")?.addEventListener("change", importCsv);
vehicleForm.addEventListener("submit", saveVehicle);
searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  render();
});
sortSelect.value = sortBy;
sortSelect.addEventListener("change", () => {
  sortBy = sortSelect.value;
  localStorage.setItem(SORT_KEY, sortBy);
  render();
});

document.querySelectorAll(".view-btn").forEach((btn) => {
  btn.addEventListener("click", () => setViewMode(btn.dataset.view));
});

init();

function init() {
  setViewMode(viewMode, false);
  buildMilestoneChecks();
  render();
  registerServiceWorker();
  setupInstallPrompt();
}

function loadViewMode() {
  const saved = localStorage.getItem(VIEW_KEY);
  if (saved === "mobile" || saved === "desktop" || saved === "auto") return saved;
  return "auto";
}

function setViewMode(mode, save = true) {
  if (!["auto", "mobile", "desktop"].includes(mode)) mode = "auto";
  viewMode = mode;

  document.body.classList.remove("view-auto", "view-mobile", "view-desktop");
  document.body.classList.add(`view-${mode}`);

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === mode);
  });

  if (save) localStorage.setItem(VIEW_KEY, mode);
}

function loadSortPreference() {
  const saved = localStorage.getItem(SORT_KEY);
  if (saved === "status-urgent" || saved === "status-ok" || saved === "default") {
    return saved;
  }
  return "default";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function isAppInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

function setupInstallPrompt() {
  const banner = document.getElementById("installBanner");
  const installBtn = document.getElementById("installBtn");
  const installBarBtn = document.getElementById("installBarBtn");
  const dismissBtn = document.getElementById("installDismiss");
  const title = document.getElementById("installBannerTitle");
  const desc = document.getElementById("installBannerDesc");

  if (!banner || isAppInstalled()) return;

  const dismissed = localStorage.getItem(INSTALL_DISMISS_KEY) === "1";

  function showBanner(titleText, descText, showNativeInstall) {
    title.textContent = titleText;
    desc.textContent = descText;
    banner.hidden = false;
    installBtn.hidden = !showNativeInstall;
    installBarBtn.hidden = false;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (!dismissed) {
      showBanner("Install Service Planner", "Add this app to your home screen for offline access.", true);
    } else {
      installBarBtn.hidden = false;
    }
  });

  async function triggerInstall() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (outcome === "accepted") {
        banner.hidden = true;
        installBarBtn.hidden = true;
      }
      return;
    }

    if (isIOS()) {
      title.textContent = "Install on iPhone";
      desc.textContent = "Tap Share (↑) in Safari, then choose “Add to Home Screen”.";
      banner.hidden = false;
      installBtn.hidden = true;
    } else if (isAndroid()) {
      title.textContent = "Install on Android";
      desc.textContent = "Open browser menu (⋮) and tap “Install app” or “Add to Home screen”. Use HTTPS for best results.";
      banner.hidden = false;
      installBtn.hidden = true;
    }
  }

  installBtn?.addEventListener("click", triggerInstall);
  installBarBtn?.addEventListener("click", triggerInstall);

  dismissBtn?.addEventListener("click", () => {
    banner.hidden = true;
    localStorage.setItem(INSTALL_DISMISS_KEY, "1");
  });

  if (!dismissed && isIOS()) {
    showBanner(
      "Install on iPhone",
      "Tap Share (↑) in Safari, then “Add to Home Screen”.",
      false
    );
  }

  if (!dismissed && isAndroid() && !deferredInstallPrompt) {
    setTimeout(() => {
      if (!deferredInstallPrompt && !isAppInstalled() && banner.hidden) {
        showBanner(
          "Install on Android",
          "Use Chrome menu (⋮) → Install app. HTTPS required for install prompt.",
          false
        );
      }
    }, 2000);
  }
}

function loadVehicles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
}

function uid() {
  return crypto.randomUUID();
}

function formatKm(value) {
  return Number(value).toLocaleString("en-US");
}

function formatKmShort(value) {
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
}

function nextMilestone(currentOdo, serviceInterval) {
  const fromMilestones = MILESTONES.find((m) => m > currentOdo);
  const fromInterval = Math.ceil((currentOdo + 1) / serviceInterval) * serviceInterval;

  if (fromMilestones == null) return fromInterval;
  return Math.min(fromMilestones, fromInterval);
}

function getStatus(remainingKm) {
  if (remainingKm <= 0) return "overdue";
  if (remainingKm <= DUE_SOON_KM) return "soon";
  return "ok";
}

function statusLabel(status) {
  return { ok: "OK", soon: "Due Soon", overdue: "Overdue" }[status];
}

function isMilestoneDone(vehicle, milestone) {
  if (vehicle.completedMilestones?.includes(milestone)) return true;
  return vehicle.currentOdo >= milestone;
}

function computeVehicle(vehicle) {
  const nextDue = nextMilestone(vehicle.currentOdo, vehicle.serviceInterval);
  const remaining = nextDue - vehicle.currentOdo;
  const status = getStatus(remaining);
  return { ...vehicle, nextDue, remaining, status };
}

function filterRows(rows) {
  if (!searchQuery) return rows;
  return rows.filter(
    (v) =>
      v.regNo.toLowerCase().includes(searchQuery) ||
      v.model.toLowerCase().includes(searchQuery)
  );
}

function sortRows(rows) {
  if (sortBy === "default") return rows;

  const urgentFirst = sortBy === "status-urgent";
  return [...rows].sort((a, b) => {
    const rankA = urgentFirst ? STATUS_ORDER[a.status] : 2 - STATUS_ORDER[a.status];
    const rankB = urgentFirst ? STATUS_ORDER[b.status] : 2 - STATUS_ORDER[b.status];

    if (rankA !== rankB) return rankA - rankB;

    if (urgentFirst) {
      return a.remaining - b.remaining;
    }
    return b.remaining - a.remaining;
  });
}

function buildMilestoneChecks(selected = []) {
  milestoneChecks.innerHTML = MILESTONES.map((m) => {
    const checked = selected.includes(m) ? "checked" : "";
    return `
      <label>
        <input type="checkbox" name="milestone" value="${m}" ${checked} />
        ${formatKm(m)} KM
      </label>
    `;
  }).join("");
}

function renderHead() {
  const fixedCols = [
    "Vehicle Reg No",
    "Vehicle Model",
    "Current ODO",
    "Service Interval (KM)",
    "Next Service Due",
    "Remaining KM",
    "Status",
    "Actions",
  ];

  tableHead.innerHTML = [
    ...fixedCols.map((c) => `<th>${c}</th>`),
    ...MILESTONES.map((m) => `<th class="milestone">${formatKm(m)}</th>`),
  ].join("");
}

function renderSummary(rows) {
  const counts = { ok: 0, soon: 0, overdue: 0 };
  rows.forEach((r) => counts[r.status]++);

  summary.innerHTML = `
    <div class="summary-card"><strong>${rows.length}</strong><span>Total</span></div>
    <div class="summary-card"><strong>${counts.ok}</strong><span>OK</span></div>
    <div class="summary-card"><strong>${counts.soon}</strong><span>Due Soon</span></div>
    <div class="summary-card"><strong>${counts.overdue}</strong><span>Overdue</span></div>
  `;
}

function renderMobileCards(rows) {
  if (rows.length === 0) {
    const msg = vehicles.length === 0
      ? 'No vehicles yet. Tap <strong>Add</strong> below to get started.'
      : 'No vehicles match your search.';
    mobileList.innerHTML = `<div class="empty-state">${msg}</div>`;
    return;
  }

  mobileList.innerHTML = rows.map((v) => {
    const doneCount = MILESTONES.filter((m) => isMilestoneDone(v, m)).length;
    const milestonePills = MILESTONES.map((m) => {
      const done = isMilestoneDone(v, m);
      return `<div class="milestone-pill ${done ? "done" : ""}">${formatKmShort(m)}</div>`;
    }).join("");

    return `
      <article class="vehicle-card" data-id="${v.id}">
        <div class="vehicle-card-header">
          <div>
            <h3>${escapeHtml(v.regNo)}</h3>
            <p>${escapeHtml(v.model)}</p>
          </div>
          <span class="status ${v.status}">${statusLabel(v.status)}</span>
        </div>
        <div class="stats-grid">
          <div class="stat-item">
            <span>Current ODO</span>
            <strong>${formatKm(v.currentOdo)}</strong>
          </div>
          <div class="stat-item">
            <span>Next Due</span>
            <strong>${formatKm(v.nextDue)}</strong>
          </div>
          <div class="stat-item">
            <span>Remaining</span>
            <strong>${formatKm(v.remaining)} KM</strong>
          </div>
          <div class="stat-item">
            <span>Interval</span>
            <strong>${formatKm(v.serviceInterval)}</strong>
          </div>
        </div>
        <button type="button" class="milestones-toggle" data-toggle="${v.id}">
          Milestones <span>${doneCount}/${MILESTONES.length} done</span>
        </button>
        <div class="milestones-panel" id="milestones-${v.id}">
          ${milestonePills}
        </div>
        <div class="card-actions">
          <button type="button" class="icon-btn" data-edit="${v.id}">Edit</button>
          <button type="button" class="icon-btn danger" data-delete="${v.id}">Delete</button>
        </div>
      </article>
    `;
  }).join("");

  mobileList.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = document.getElementById(`milestones-${btn.dataset.toggle}`);
      panel?.classList.toggle("open");
    });
  });

  bindRowActions(mobileList);
}

function renderTable(rows) {
  if (rows.length === 0) {
    const msg = vehicles.length === 0
      ? "No vehicles yet. Click Add Vehicle to start."
      : "No vehicles match your search.";
    tableBody.innerHTML = `
      <tr>
        <td colspan="${8 + MILESTONES.length}" class="empty-state">${msg}</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = rows.map((v) => {
    const milestoneCells = MILESTONES.map((m) => {
      const done = isMilestoneDone(v, m);
      return `<td class="milestone ${done ? "done" : "pending"}">${done ? "✓" : "—"}</td>`;
    }).join("");

    return `
      <tr>
        <td>${escapeHtml(v.regNo)}</td>
        <td>${escapeHtml(v.model)}</td>
        <td>${formatKm(v.currentOdo)}</td>
        <td>${formatKm(v.serviceInterval)}</td>
        <td>${formatKm(v.nextDue)}</td>
        <td>${formatKm(v.remaining)}</td>
        <td><span class="status ${v.status}">${statusLabel(v.status)}</span></td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-edit="${v.id}">Edit</button>
            <button class="icon-btn danger" data-delete="${v.id}">Delete</button>
          </div>
        </td>
        ${milestoneCells}
      </tr>
    `;
  }).join("");

  bindRowActions(tableBody);
}

function bindRowActions(container) {
  container.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openDialog(btn.dataset.edit));
  });
  container.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteVehicle(btn.dataset.delete));
  });
}

function render() {
  renderHead();
  const allRows = vehicles.map(computeVehicle);
  const rows = sortRows(filterRows(allRows));

  renderSummary(allRows);
  renderMobileCards(rows);
  renderTable(rows);
}

function openDialog(id = null) {
  editingId = id;
  const vehicle = vehicles.find((v) => v.id === id);

  document.getElementById("dialogTitle").textContent = vehicle ? "Edit Vehicle" : "Add Vehicle";
  vehicleForm.regNo.value = vehicle?.regNo ?? "";
  vehicleForm.model.value = vehicle?.model ?? "";
  vehicleForm.currentOdo.value = vehicle?.currentOdo ?? "";
  vehicleForm.serviceInterval.value = vehicle?.serviceInterval ?? 10000;

  buildMilestoneChecks(vehicle?.completedMilestones ?? []);
  vehicleDialog.showModal();
}

function saveVehicle(event) {
  event.preventDefault();

  const form = new FormData(vehicleForm);
  const completedMilestones = [...vehicleForm.querySelectorAll('input[name="milestone"]:checked')]
    .map((el) => Number(el.value));

  const payload = {
    id: editingId ?? uid(),
    regNo: String(form.get("regNo")).trim(),
    model: String(form.get("model")).trim(),
    currentOdo: Number(form.get("currentOdo")),
    serviceInterval: Number(form.get("serviceInterval")),
    completedMilestones,
  };

  if (editingId) {
    vehicles = vehicles.map((v) => (v.id === editingId ? payload : v));
  } else {
    vehicles.push(payload);
  }

  persist();
  vehicleDialog.close();
  render();
}

function deleteVehicle(id) {
  const vehicle = vehicles.find((v) => v.id === id);
  if (!vehicle) return;

  const ok = confirm(`Delete vehicle ${vehicle.regNo}?`);
  if (!ok) return;

  vehicles = vehicles.filter((v) => v.id !== id);
  persist();
  render();
}

function exportCsv() {
  const headers = [
    "Vehicle Reg No",
    "Vehicle Model",
    "Current ODO",
    "Service Interval (KM)",
    "Next Service Due",
    "Remaining KM",
    "Status",
    ...MILESTONES.map((m) => String(m)),
  ];

  const rows = vehicles.map(computeVehicle).map((v) => [
    v.regNo,
    v.model,
    v.currentOdo,
    v.serviceInterval,
    v.nextDue,
    v.remaining,
    statusLabel(v.status),
    ...MILESTONES.map((m) => (isMilestoneDone(v, m) ? "Done" : "")),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  downloadFile("vehicle-service-planner.csv", csv);
}

function importCsv(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseCsv(String(reader.result));
    if (parsed.length === 0) {
      alert("No valid rows found in CSV.");
      return;
    }
    vehicles = parsed;
    persist();
    render();
  };
  reader.readAsText(file);
  event.target.value = "";
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  const idx = (name) => headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());

  const regIdx = idx("Vehicle Reg No");
  const modelIdx = idx("Vehicle Model");
  const odoIdx = idx("Current ODO");
  const intervalIdx = idx("Service Interval (KM)");

  if ([regIdx, modelIdx, odoIdx, intervalIdx].some((i) => i < 0)) {
    alert("CSV must include: Vehicle Reg No, Vehicle Model, Current ODO, Service Interval (KM)");
    return [];
  }

  return lines.slice(1).filter(Boolean).map((line) => {
    const cols = splitCsvLine(line);
    const completedMilestones = MILESTONES.filter((m) => {
      const mIdx = headers.findIndex((h) => h.replace(/,/g, "") === String(m));
      if (mIdx < 0) return false;
      const val = (cols[mIdx] || "").trim().toLowerCase();
      return val === "done" || val === "✓" || val === "yes" || val === "1" || val === "true";
    });

    return {
      id: uid(),
      regNo: cols[regIdx]?.trim() ?? "",
      model: cols[modelIdx]?.trim() ?? "",
      currentOdo: Number(cols[odoIdx]) || 0,
      serviceInterval: Number(cols[intervalIdx]) || 10000,
      completedMilestones,
    };
  }).filter((v) => v.regNo);
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
