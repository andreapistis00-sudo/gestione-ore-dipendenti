/* ============ STORAGE ============ */
const STORAGE_KEY = "tt_app_data_v1";

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  return {
    pin: "1234",
    employees: [],
    schedules: [],     // { id, employeeId, date, oraInizio, oraFine, ore, note }
    timeEntries: [],   // { id, employeeId, date, oraInizio, oraFine, ore, tipo, note }
    adjustments: [],   // { id, employeeId, date, ore, motivo }
    closures: []        // { employeeId, month }
  };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = loadData();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ============ DATE HELPERS ============ */
const DAY_NAMES = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

function todayISO() {
  return toISODate(new Date());
}

function toISODate(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

function mondayOf(iso) {
  const d = parseISO(iso);
  const dow = d.getDay(); // 0=Sun..6=Sat
  const diff = (dow + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return toISODate(d);
}

function monthOf(iso) {
  return iso.slice(0, 7);
}

function currentMonthStr() {
  return monthOf(todayISO());
}

function formatDateIt(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function computeOreDaOrari(oraInizio, oraFine) {
  const a = timeToMinutes(oraInizio);
  const b = timeToMinutes(oraFine);
  if (a === null || b === null) return 0;
  let diffMin = b - a;
  if (diffMin <= 0) diffMin += 24 * 60; // turno che finisce oltre mezzanotte
  return Math.round((diffMin / 60) * 100) / 100;
}

function daysInMonth(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const out = [];
  for (let day = 1; day <= last; day++) {
    out.push(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return out;
}

/* ============ SESSION ============ */
let session = { role: null, employeeId: null };

/* ============ SCREENS ============ */
const screens = {
  home: document.getElementById("screenHome"),
  adminLogin: document.getElementById("screenAdminLogin"),
  employeeSelect: document.getElementById("screenEmployeeSelect"),
  admin: document.getElementById("screenAdmin"),
  employee: document.getElementById("screenEmployee")
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.hidden = true);
  screens[name].hidden = false;
  renderTopbarActions();
}

function renderTopbarActions() {
  const el = document.getElementById("topbarActions");
  el.innerHTML = "";
  if (session.role) {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "← Esci";
    btn.onclick = goHome;
    el.appendChild(btn);
  }
}

function goHome() {
  session = { role: null, employeeId: null };
  showScreen("home");
}

document.getElementById("goAdminBtn").onclick = () => showScreen("adminLogin");
document.getElementById("backHomeFromAdminLogin").onclick = goHome;
document.getElementById("goEmployeeBtn").onclick = () => {
  populateEmployeeSelect(document.getElementById("employeeSelect"), true);
  showScreen("employeeSelect");
};
document.getElementById("backHomeFromEmployeeSelect").onclick = goHome;

/* ============ TABS ============ */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const section = btn.closest("section");
    const nav = btn.closest(".tabs");
    nav.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    section.querySelectorAll(":scope > .tab-panel").forEach(p => p.hidden = true);
    const target = document.getElementById(btn.dataset.tab);
    target.hidden = false;
    onTabShown(btn.dataset.tab);
  });
});

function resetTabs(section) {
  const nav = section.querySelector(".tabs");
  const btns = [...nav.querySelectorAll(".tab-btn")];
  const panels = [...section.querySelectorAll(":scope > .tab-panel")];
  btns.forEach((b, i) => b.classList.toggle("active", i === 0));
  panels.forEach((p, i) => p.hidden = i !== 0);
  if (panels[0]) onTabShown(panels[0].id);
}

function onTabShown(tabId) {
  if (tabId === "tabDipendenti") renderEmployeesTable();
  if (tabId === "tabTurni") renderTurniTable();
  if (tabId === "tabOreMensili") renderOreMensili();
  if (tabId === "tabBancaOre") renderBancaOre();
  if (tabId === "empTabInserisci") { /* nothing */ }
  if (tabId === "empTabStorico") renderEmpStorico();
  if (tabId === "empTabTurni") renderEmpTurni();
  if (tabId === "empTabBanca") renderEmpBanca();
}

/* ============ ADMIN LOGIN ============ */
document.getElementById("adminLoginBtn").onclick = () => {
  const pin = document.getElementById("adminPinInput").value;
  if (pin !== data.pin) {
    alert("PIN errato");
    return;
  }
  document.getElementById("adminPinInput").value = "";
  session = { role: "admin", employeeId: null };
  enterAdmin();
};

function enterAdmin() {
  showScreen("admin");
  resetTabs(screens.admin);
  populateEmployeeSelect(document.getElementById("turniEmployeeSelect"));
  populateEmployeeSelect(document.getElementById("oreMensiliEmployeeSelect"));
  document.getElementById("turniWeekInput").value = mondayOf(todayISO());
  document.getElementById("oreMensiliMeseInput").value = currentMonthStr();
  document.getElementById("adminEntryData").value = todayISO();
  renderEmployeesTable();
  renderTurniTable();
  renderOreMensili();
  renderBancaOre();
}

/* ============ EMPLOYEE LOGIN ============ */
document.getElementById("employeeEnterBtn").onclick = () => {
  const id = document.getElementById("employeeSelect").value;
  if (!id) { alert("Seleziona un dipendente"); return; }
  session = { role: "employee", employeeId: id };
  enterEmployee();
};

function enterEmployee() {
  const emp = getEmployee(session.employeeId);
  document.getElementById("empPanelName").textContent = emp ? `${emp.nome} ${emp.cognome}` : "";
  document.getElementById("empEntryData").value = todayISO();
  document.getElementById("empStoricoMese").value = currentMonthStr();
  document.getElementById("empTurniWeekInput").value = mondayOf(todayISO());
  showScreen("employee");
  resetTabs(screens.employee);
  renderEmpStorico();
  renderEmpTurni();
  renderEmpBanca();
}

function populateEmployeeSelect(select, activeOnly) {
  const emps = data.employees.filter(e => !activeOnly || e.attivo);
  select.innerHTML = emps.map(e => `<option value="${e.id}">${escapeHtml(e.nome + " " + e.cognome)}</option>`).join("");
}

function getEmployee(id) {
  return data.employees.find(e => e.id === id);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/* ============ DIPENDENTI (ADMIN) ============ */
const employeeForm = document.getElementById("employeeForm");

employeeForm.addEventListener("submit", e => {
  e.preventDefault();
  const id = document.getElementById("empId").value;
  const emp = {
    id: id || uid(),
    nome: document.getElementById("empNome").value.trim(),
    cognome: document.getElementById("empCognome").value.trim(),
    email: document.getElementById("empEmail").value.trim(),
    telefono: document.getElementById("empTelefono").value.trim(),
    codiceFiscale: document.getElementById("empCF").value.trim(),
    dataAssunzione: document.getElementById("empDataAssunzione").value,
    ruolo: document.getElementById("empRuolo").value.trim(),
    tipoContratto: document.getElementById("empTipoContratto").value,
    pagaOraria: parseFloat(document.getElementById("empPagaOraria").value) || 0,
    oreSettimanali: parseFloat(document.getElementById("empOreSettimanali").value) || 0,
    iban: document.getElementById("empIban").value.trim(),
    note: document.getElementById("empNote").value.trim(),
    attivo: document.getElementById("empAttivo").checked
  };
  if (!emp.nome || !emp.cognome) { alert("Nome e cognome sono obbligatori"); return; }

  if (id) {
    const idx = data.employees.findIndex(x => x.id === id);
    data.employees[idx] = emp;
  } else {
    data.employees.push(emp);
  }
  saveData();
  resetEmployeeForm();
  renderEmployeesTable();
  populateEmployeeSelect(document.getElementById("turniEmployeeSelect"));
  populateEmployeeSelect(document.getElementById("oreMensiliEmployeeSelect"));
});

document.getElementById("empCancelEdit").onclick = resetEmployeeForm;

function resetEmployeeForm() {
  employeeForm.reset();
  document.getElementById("empId").value = "";
  document.getElementById("empAttivo").checked = true;
  document.getElementById("empFormTitle").textContent = "Nuovo dipendente";
  document.getElementById("empCancelEdit").hidden = true;
}

function fillEmployeeForm(emp) {
  document.getElementById("empId").value = emp.id;
  document.getElementById("empNome").value = emp.nome;
  document.getElementById("empCognome").value = emp.cognome;
  document.getElementById("empEmail").value = emp.email || "";
  document.getElementById("empTelefono").value = emp.telefono || "";
  document.getElementById("empCF").value = emp.codiceFiscale || "";
  document.getElementById("empDataAssunzione").value = emp.dataAssunzione || "";
  document.getElementById("empRuolo").value = emp.ruolo || "";
  document.getElementById("empTipoContratto").value = emp.tipoContratto || "indeterminato";
  document.getElementById("empPagaOraria").value = emp.pagaOraria || 0;
  document.getElementById("empOreSettimanali").value = emp.oreSettimanali || 0;
  document.getElementById("empIban").value = emp.iban || "";
  document.getElementById("empNote").value = emp.note || "";
  document.getElementById("empAttivo").checked = !!emp.attivo;
  document.getElementById("empFormTitle").textContent = `Modifica ${emp.nome} ${emp.cognome}`;
  document.getElementById("empCancelEdit").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderEmployeesTable() {
  const tbody = document.getElementById("employeesTableBody");
  tbody.innerHTML = "";
  data.employees.forEach(emp => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(emp.nome + " " + emp.cognome)}</td>
      <td>${escapeHtml(emp.ruolo || "-")}</td>
      <td>${escapeHtml(emp.tipoContratto || "-")}</td>
      <td>${(emp.pagaOraria || 0).toFixed(2)} €</td>
      <td>${emp.oreSettimanali || 0}</td>
      <td>${emp.attivo ? '<span class="badge pagata">Attivo</span>' : '<span class="badge non-pagata">Inattivo</span>'}</td>
      <td>
        <button class="btn small" data-action="edit">Modifica</button>
        <button class="btn small" data-action="toggle">${emp.attivo ? "Disattiva" : "Attiva"}</button>
        <button class="btn small danger" data-action="delete">Elimina</button>
      </td>
    `;
    tr.querySelector('[data-action="edit"]').onclick = () => fillEmployeeForm(emp);
    tr.querySelector('[data-action="toggle"]').onclick = () => {
      emp.attivo = !emp.attivo;
      saveData();
      renderEmployeesTable();
    };
    tr.querySelector('[data-action="delete"]').onclick = () => {
      if (!confirm(`Eliminare definitivamente ${emp.nome} ${emp.cognome}? Verranno rimossi anche ore, turni e rettifiche associate.`)) return;
      data.employees = data.employees.filter(e => e.id !== emp.id);
      data.schedules = data.schedules.filter(s => s.employeeId !== emp.id);
      data.timeEntries = data.timeEntries.filter(t => t.employeeId !== emp.id);
      data.adjustments = data.adjustments.filter(a => a.employeeId !== emp.id);
      data.closures = data.closures.filter(c => c.employeeId !== emp.id);
      saveData();
      renderEmployeesTable();
      populateEmployeeSelect(document.getElementById("turniEmployeeSelect"));
      populateEmployeeSelect(document.getElementById("oreMensiliEmployeeSelect"));
    };
    tbody.appendChild(tr);
  });
}

/* ============ TURNI SETTIMANALI (ADMIN) ============ */
document.getElementById("turniEmployeeSelect").addEventListener("change", renderTurniTable);
document.getElementById("turniWeekInput").addEventListener("change", e => {
  e.target.value = mondayOf(e.target.value);
  renderTurniTable();
});

function renderTurniTable() {
  const employeeId = document.getElementById("turniEmployeeSelect").value;
  const monday = document.getElementById("turniWeekInput").value || mondayOf(todayISO());
  const tbody = document.getElementById("turniTableBody");
  tbody.innerHTML = "";
  if (!employeeId) return;

  let total = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const existing = data.schedules.find(s => s.employeeId === employeeId && s.date === date);
    const oraInizio = existing ? (existing.oraInizio || "") : "";
    const oraFine = existing ? (existing.oraFine || "") : "";
    const ore = existing ? (existing.ore || 0) : 0;
    total += ore;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${DAY_NAMES[i]}<br><small>${formatDateIt(date)}</small></td>
      <td><input type="time" class="turno-inizio" data-date="${date}" value="${oraInizio}"></td>
      <td><input type="time" class="turno-fine" data-date="${date}" value="${oraFine}"></td>
      <td><span class="turno-ore-calc" data-date="${date}">${ore}</span></td>
      <td><input type="text" class="turno-note" data-date="${date}" value="${existing ? escapeHtml(existing.note || "") : ""}"></td>
    `;
    tbody.appendChild(tr);
  }
  document.getElementById("turniTotale").textContent = total;

  function recalcRow(date) {
    const inizio = tbody.querySelector(`.turno-inizio[data-date="${date}"]`).value;
    const fine = tbody.querySelector(`.turno-fine[data-date="${date}"]`).value;
    const ore = computeOreDaOrari(inizio, fine);
    tbody.querySelector(`.turno-ore-calc[data-date="${date}"]`).textContent = ore;
    let sum = 0;
    tbody.querySelectorAll(".turno-ore-calc").forEach(el => sum += parseFloat(el.textContent) || 0);
    document.getElementById("turniTotale").textContent = Math.round(sum * 100) / 100;
  }

  tbody.querySelectorAll(".turno-inizio, .turno-fine").forEach(inp => {
    inp.addEventListener("input", () => recalcRow(inp.dataset.date));
  });
}

document.getElementById("salvaTurniBtn").onclick = () => {
  const employeeId = document.getElementById("turniEmployeeSelect").value;
  if (!employeeId) { alert("Seleziona un dipendente"); return; }
  const tbody = document.getElementById("turniTableBody");
  tbody.querySelectorAll(".turno-inizio").forEach(inp => {
    const date = inp.dataset.date;
    const oraInizio = inp.value;
    const oraFine = tbody.querySelector(`.turno-fine[data-date="${date}"]`).value;
    const note = tbody.querySelector(`.turno-note[data-date="${date}"]`).value.trim();
    const ore = computeOreDaOrari(oraInizio, oraFine);
    let existing = data.schedules.find(s => s.employeeId === employeeId && s.date === date);
    if (existing) {
      existing.oraInizio = oraInizio;
      existing.oraFine = oraFine;
      existing.ore = ore;
      existing.note = note;
    } else {
      data.schedules.push({ id: uid(), employeeId, date, oraInizio, oraFine, ore, note });
    }
  });
  saveData();
  alert("Orari settimana salvati");
  renderBancaOre();
};

/* ============ ORE MENSILI (ADMIN) ============ */
document.getElementById("oreMensiliEmployeeSelect").addEventListener("change", renderOreMensili);
document.getElementById("oreMensiliMeseInput").addEventListener("change", renderOreMensili);

function isMonthClosed(employeeId, month) {
  return data.closures.some(c => c.employeeId === employeeId && c.month === month);
}

function updateAdminEntryOreCalc() {
  const oraInizio = document.getElementById("adminEntryInizio").value;
  const oraFine = document.getElementById("adminEntryFine").value;
  document.getElementById("adminEntryOreCalc").value = computeOreDaOrari(oraInizio, oraFine);
}
document.getElementById("adminEntryInizio").addEventListener("input", updateAdminEntryOreCalc);
document.getElementById("adminEntryFine").addEventListener("input", updateAdminEntryOreCalc);

document.getElementById("adminEntryForm").addEventListener("submit", e => {
  e.preventDefault();
  const employeeId = document.getElementById("oreMensiliEmployeeSelect").value;
  if (!employeeId) { alert("Seleziona un dipendente"); return; }
  const dateInput = document.getElementById("adminEntryData").value;
  if (!dateInput) return;
  if (isMonthClosed(employeeId, monthOf(dateInput))) {
    alert("Il mese è chiuso: riapri il mese per modificare le ore.");
    return;
  }
  const oraInizio = document.getElementById("adminEntryInizio").value;
  const oraFine = document.getElementById("adminEntryFine").value;
  data.timeEntries.push({
    id: uid(),
    employeeId,
    date: dateInput,
    oraInizio,
    oraFine,
    ore: computeOreDaOrari(oraInizio, oraFine),
    tipo: document.getElementById("adminEntryTipo").value,
    note: document.getElementById("adminEntryNote").value.trim()
  });
  saveData();
  document.getElementById("adminEntryForm").reset();
  document.getElementById("adminEntryData").value = todayISO();
  document.getElementById("adminEntryOreCalc").value = "0";
  renderOreMensili();
});

function renderOreMensili() {
  const employeeId = document.getElementById("oreMensiliEmployeeSelect").value;
  const month = document.getElementById("oreMensiliMeseInput").value || currentMonthStr();
  const tbody = document.getElementById("oreMensiliTableBody");
  tbody.innerHTML = "";
  if (!employeeId) return;

  const closed = isMonthClosed(employeeId, month);
  const entries = data.timeEntries
    .filter(t => t.employeeId === employeeId && monthOf(t.date) === month)
    .sort((a, b) => a.date.localeCompare(b.date));

  let totOre = 0, totPagate = 0, totNonPagate = 0;

  entries.forEach(entry => {
    totOre += entry.ore;
    if (entry.tipo === "pagata") totPagate += entry.ore; else totNonPagate += entry.ore;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDateIt(entry.date)}</td>
      <td>${entry.oraInizio && entry.oraFine ? `${entry.oraInizio}–${entry.oraFine}` : "-"}</td>
      <td>${entry.ore}</td>
      <td>
        <select class="tipo-select" ${closed ? "disabled" : ""}>
          <option value="non pagata" ${entry.tipo === "non pagata" ? "selected" : ""}>Non pagata</option>
          <option value="pagata" ${entry.tipo === "pagata" ? "selected" : ""}>Pagata</option>
        </select>
      </td>
      <td>${escapeHtml(entry.note || "")}</td>
      <td>${closed ? "-" : '<button class="btn small danger" data-action="del">Elimina</button>'}</td>
    `;
    tr.querySelector(".tipo-select").addEventListener("change", ev => {
      entry.tipo = ev.target.value;
      saveData();
      renderOreMensili();
    });
    const delBtn = tr.querySelector('[data-action="del"]');
    if (delBtn) {
      delBtn.onclick = () => {
        data.timeEntries = data.timeEntries.filter(t => t.id !== entry.id);
        saveData();
        renderOreMensili();
      };
    }
    tbody.appendChild(tr);
  });

  document.getElementById("totOreMese").textContent = totOre;
  document.getElementById("totOrePagate").textContent = totPagate;
  document.getElementById("totOreNonPagate").textContent = totNonPagate;

  document.getElementById("chiudiMeseBtn").hidden = closed;
  document.getElementById("riapriMeseBtn").hidden = !closed;
  document.getElementById("meseStatoLabel").textContent = closed
    ? `Mese ${month} chiuso: le ore non sono più modificabili.`
    : `Mese ${month} aperto.`;
}

document.getElementById("chiudiMeseBtn").onclick = () => {
  const employeeId = document.getElementById("oreMensiliEmployeeSelect").value;
  const month = document.getElementById("oreMensiliMeseInput").value || currentMonthStr();
  if (!employeeId) return;
  if (!confirm(`Chiudere il mese ${month}? Le ore non saranno più modificabili finché non riapri il mese.`)) return;
  data.closures.push({ employeeId, month });
  saveData();
  renderOreMensili();
};

document.getElementById("riapriMeseBtn").onclick = () => {
  const employeeId = document.getElementById("oreMensiliEmployeeSelect").value;
  const month = document.getElementById("oreMensiliMeseInput").value || currentMonthStr();
  data.closures = data.closures.filter(c => !(c.employeeId === employeeId && c.month === month));
  saveData();
  renderOreMensili();
};

/* ============ BANCA ORE (ADMIN) ============ */
function calcBanca(employeeId) {
  const worked = data.timeEntries.filter(t => t.employeeId === employeeId).reduce((s, t) => s + t.ore, 0);
  const today = todayISO();
  const scheduled = data.schedules
    .filter(s => s.employeeId === employeeId && s.date <= today)
    .reduce((s, x) => s + x.ore, 0);
  const adjustments = data.adjustments.filter(a => a.employeeId === employeeId).reduce((s, a) => s + a.ore, 0);
  return { worked, scheduled, adjustments, saldo: worked - scheduled + adjustments };
}

function renderBancaOre() {
  const tbody = document.getElementById("bancaOreTableBody");
  tbody.innerHTML = "";
  data.employees.forEach(emp => {
    const b = calcBanca(emp.id);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(emp.nome + " " + emp.cognome)}</td>
      <td>${b.worked}</td>
      <td>${b.scheduled}</td>
      <td>${b.adjustments >= 0 ? "+" : ""}${b.adjustments}</td>
      <td><strong>${b.saldo >= 0 ? "+" : ""}${b.saldo.toFixed(2)} h</strong></td>
      <td><button class="btn small" data-action="rettifica">+ Rettifica</button></td>
    `;
    tr.querySelector('[data-action="rettifica"]').onclick = () => openRettificaForm(emp);
    tbody.appendChild(tr);
  });
  renderRettificheTable();
}

function openRettificaForm(emp) {
  document.getElementById("rettificaTitle").hidden = false;
  document.getElementById("rettificaForm").hidden = false;
  document.getElementById("rettificaEmpName").textContent = `${emp.nome} ${emp.cognome}`;
  document.getElementById("rettificaEmpId").value = emp.id;
  document.getElementById("rettificaData").value = todayISO();
  document.getElementById("rettificaOre").value = "";
  document.getElementById("rettificaMotivo").value = "";
  document.getElementById("rettificaForm").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("rettificaAnnulla").onclick = () => {
  document.getElementById("rettificaTitle").hidden = true;
  document.getElementById("rettificaForm").hidden = true;
};

document.getElementById("rettificaForm").addEventListener("submit", e => {
  e.preventDefault();
  const employeeId = document.getElementById("rettificaEmpId").value;
  data.adjustments.push({
    id: uid(),
    employeeId,
    date: document.getElementById("rettificaData").value || todayISO(),
    ore: parseFloat(document.getElementById("rettificaOre").value) || 0,
    motivo: document.getElementById("rettificaMotivo").value.trim()
  });
  saveData();
  document.getElementById("rettificaTitle").hidden = true;
  document.getElementById("rettificaForm").hidden = true;
  renderBancaOre();
});

function renderRettificheTable() {
  const tbody = document.getElementById("rettificheTableBody");
  tbody.innerHTML = "";
  data.adjustments
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach(adj => {
      const emp = getEmployee(adj.employeeId);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${emp ? escapeHtml(emp.nome + " " + emp.cognome) : "-"}</td>
        <td>${formatDateIt(adj.date)}</td>
        <td>${adj.ore >= 0 ? "+" : ""}${adj.ore}</td>
        <td>${escapeHtml(adj.motivo || "-")}</td>
        <td><button class="btn small danger" data-action="del">Elimina</button></td>
      `;
      tr.querySelector('[data-action="del"]').onclick = () => {
        data.adjustments = data.adjustments.filter(a => a.id !== adj.id);
        saveData();
        renderBancaOre();
      };
      tbody.appendChild(tr);
    });
}

/* ============ IMPOSTAZIONI (ADMIN) ============ */
document.getElementById("salvaPinBtn").onclick = () => {
  const val = document.getElementById("nuovoPinInput").value.trim();
  if (!val) { alert("Inserisci un nuovo PIN"); return; }
  data.pin = val;
  saveData();
  document.getElementById("nuovoPinInput").value = "";
  alert("PIN aggiornato");
};

/* ============ DIPENDENTE: INSERISCI ORE ============ */
function updateEmpEntryOreCalc() {
  const oraInizio = document.getElementById("empEntryInizio").value;
  const oraFine = document.getElementById("empEntryFine").value;
  document.getElementById("empEntryOreCalc").value = computeOreDaOrari(oraInizio, oraFine);
}
document.getElementById("empEntryInizio").addEventListener("input", updateEmpEntryOreCalc);
document.getElementById("empEntryFine").addEventListener("input", updateEmpEntryOreCalc);

document.getElementById("employeeEntryForm").addEventListener("submit", e => {
  e.preventDefault();
  const employeeId = session.employeeId;
  const date = document.getElementById("empEntryData").value;
  if (!date) return;
  if (isMonthClosed(employeeId, monthOf(date))) {
    document.getElementById("empEntryMsg").textContent = "Il mese selezionato è già stato chiuso dall'amministratore: non puoi più registrare ore per questa data.";
    return;
  }
  const oraInizio = document.getElementById("empEntryInizio").value;
  const oraFine = document.getElementById("empEntryFine").value;
  data.timeEntries.push({
    id: uid(),
    employeeId,
    date,
    oraInizio,
    oraFine,
    ore: computeOreDaOrari(oraInizio, oraFine),
    tipo: "non pagata",
    note: document.getElementById("empEntryNote").value.trim()
  });
  saveData();
  document.getElementById("employeeEntryForm").reset();
  document.getElementById("empEntryData").value = todayISO();
  document.getElementById("empEntryOreCalc").value = "0";
  document.getElementById("empEntryMsg").textContent = "Ore registrate correttamente.";
});

/* ============ DIPENDENTE: STORICO ============ */
document.getElementById("empStoricoMese").addEventListener("change", renderEmpStorico);

function renderEmpStorico() {
  const employeeId = session.employeeId;
  if (!employeeId) return;
  const month = document.getElementById("empStoricoMese").value || currentMonthStr();
  const closed = isMonthClosed(employeeId, month);
  const entries = data.timeEntries
    .filter(t => t.employeeId === employeeId && monthOf(t.date) === month)
    .sort((a, b) => a.date.localeCompare(b.date));

  const tbody = document.getElementById("empStoricoTableBody");
  tbody.innerHTML = "";
  let totOre = 0, totPagate = 0, totNonPagate = 0;
  entries.forEach(entry => {
    totOre += entry.ore;
    if (entry.tipo === "pagata") totPagate += entry.ore; else totNonPagate += entry.ore;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDateIt(entry.date)}</td>
      <td>${entry.oraInizio && entry.oraFine ? `${entry.oraInizio}–${entry.oraFine}` : "-"}</td>
      <td>${entry.ore}</td>
      <td><span class="badge ${entry.tipo === 'pagata' ? 'pagata' : 'non-pagata'}">${entry.tipo}</span></td>
      <td>${closed ? '<span class="badge chiuso">Chiuso</span>' : 'Aperto'}</td>
      <td>${escapeHtml(entry.note || "")}</td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById("empTotOre").textContent = totOre;
  document.getElementById("empTotOrePagate").textContent = totPagate;
  document.getElementById("empTotOreNonPagate").textContent = totNonPagate;
}

/* ============ DIPENDENTE: TURNI ============ */
document.getElementById("empTurniWeekInput").addEventListener("change", e => {
  e.target.value = mondayOf(e.target.value);
  renderEmpTurni();
});

function renderEmpTurni() {
  const employeeId = session.employeeId;
  if (!employeeId) return;
  const monday = document.getElementById("empTurniWeekInput").value || mondayOf(todayISO());
  const tbody = document.getElementById("empTurniTableBody");
  tbody.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const existing = data.schedules.find(s => s.employeeId === employeeId && s.date === date);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${DAY_NAMES[i]}<br><small>${formatDateIt(date)}</small></td>
      <td>${existing && existing.oraInizio ? existing.oraInizio : "-"}</td>
      <td>${existing && existing.oraFine ? existing.oraFine : "-"}</td>
      <td>${existing ? existing.ore : 0}</td>
      <td>${existing ? escapeHtml(existing.note || "") : ""}</td>
    `;
    tbody.appendChild(tr);
  }
}

/* ============ DIPENDENTE: BANCA ORE ============ */
function renderEmpBanca() {
  const employeeId = session.employeeId;
  if (!employeeId) return;
  const b = calcBanca(employeeId);
  const el = document.getElementById("empSaldoBanca");
  el.textContent = `${b.saldo >= 0 ? "+" : ""}${b.saldo.toFixed(2)} h`;

  const tbody = document.getElementById("empRettificheTableBody");
  tbody.innerHTML = "";
  data.adjustments
    .filter(a => a.employeeId === employeeId)
    .sort((a, b2) => b2.date.localeCompare(a.date))
    .forEach(adj => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatDateIt(adj.date)}</td>
        <td>${adj.ore >= 0 ? "+" : ""}${adj.ore}</td>
        <td>${escapeHtml(adj.motivo || "-")}</td>
      `;
      tbody.appendChild(tr);
    });
}

/* ============ INIT ============ */
showScreen("home");
