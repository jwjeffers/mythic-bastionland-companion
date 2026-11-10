// Mythic Bastionland — Referee Companion (iPad Pro & PDF Page Lightbox Edition)

const STORAGE_KEY = "MB_REFEREE_STATE_V1";

let state = {
  theme: "light",
  pageBg: "nobg", // "nobg" (clean white) or "bg" (parchment)
  day: 1,
  phase: "Morning",
  season: "Spring",
  age: "Young",
  playerView: false,
  selectedHex: "3,3",
  companyHex: "3,3",
  hexes: {},
  activeMyths: [],
  company: []
};
window.state = state;

let mapTouchMode = "inspect";
let combatPool = [8, 8];
let combatRolled = [];
let sparkCategoryFilter = "All";
let currentModalPage = 28;
let currentModalTitle = "";
let currentCustomSheetMode = null; // null | { prefix, count, idx, titles }

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function setBanner(html) {
  const el = document.getElementById("last-roll-banner");
  if (el) el.innerHTML = html;
}

function quickRoll(sides) {
  const r = rollDie(sides);
  setBanner(`<strong>d${sides}</strong> = <strong>${r}</strong>`);
}

function quickRoll6x12() {
  const d6 = rollDie(6);
  const d12 = rollDie(12);
  setBanner(`<strong>d6+d12</strong> = <strong>${d6}-${d12}</strong>`);
}

// PDF Page Image Path & Full-Screen Lightbox Modal (Always Clean No-BG Pages)
function getPageImgSrc(pageNum) {
  const padded = String(pageNum).padStart(3, "0");
  return `pages_nobg/p${padded}.jpg`;
}

function lookupPageTitle(pageNum) {
  const k = window.MB_DATA.knights.find(x => x.page === pageNum);
  if (k) return `[${k.id}] ${k.name} & ${k.seer.name} (Page ${pageNum})`;
  const m = window.MB_DATA.myths.find(x => x.page === pageNum);
  if (m) return `[${m.id}] ${m.name} (Page ${pageNum})`;
  if (pageNum === 172) return "The City Quest — Omens (Page 172)";
  if (pageNum === 173) return "The City Quest — Cast (Page 173)";
  return `Rulebook Page ${pageNum}`;
}

function openPdfModal(pageNum, customTitle) {
  currentCustomSheetMode = null;
  currentModalPage = pageNum;
  currentModalTitle = customTitle || lookupPageTitle(pageNum);
  const modal = document.getElementById("pdf-page-modal");
  const img = document.getElementById("pdf-modal-img");
  const titleEl = document.getElementById("pdf-modal-title");
  if (img) img.src = getPageImgSrc(pageNum);
  if (titleEl) titleEl.textContent = `${currentModalTitle} (p.${pageNum})`;
  if (modal) modal.classList.add("open");
}

function openSheetImgModal(imgSrc, customTitle) {
  const modal = document.getElementById("pdf-page-modal");
  const img = document.getElementById("pdf-modal-img");
  const titleEl = document.getElementById("pdf-modal-title");
  if (imgSrc.indexOf("blank_realm_page_") !== -1) {
    currentCustomSheetMode = {
      prefix: "stamps/blank_realm_page_",
      count: 3,
      idx: 1,
      titles: [
        "Blank Realm Sheet — Creating a Realm (Page 1)",
        "Blank Realm Sheet — Travel Procedures (Page 2)",
        "Blank Realm Sheet — Sites & Pointcrawls (Page 3)"
      ]
    };
  } else if (imgSrc.indexOf("sample_realm_page_") !== -1) {
    currentCustomSheetMode = {
      prefix: "stamps/sample_realm_page_",
      count: 2,
      idx: 1,
      titles: [
        "Official Sample Realm Sheet (Page 1)",
        "Official Sample Realm Sheet — Travel (Page 2)"
      ]
    };
  } else {
    currentCustomSheetMode = null;
  }
  if (img) img.src = imgSrc;
  if (titleEl) titleEl.textContent = customTitle || "Reference Sheet";
  if (modal) modal.classList.add("open");
}

function stepPdfModal(delta) {
  if (currentCustomSheetMode) {
    const nextIdx = Math.max(1, Math.min(currentCustomSheetMode.count, currentCustomSheetMode.idx + delta));
    currentCustomSheetMode.idx = nextIdx;
    const img = document.getElementById("pdf-modal-img");
    const titleEl = document.getElementById("pdf-modal-title");
    if (img) img.src = `${currentCustomSheetMode.prefix}${nextIdx}.jpg`;
    if (titleEl) titleEl.textContent = currentCustomSheetMode.titles[nextIdx - 1];
    return;
  }
  const next = Math.max(26, Math.min(173, currentModalPage + delta));
  openPdfModal(next, lookupPageTitle(next));
}

function closePdfModal(event) {
  if (event && event.target && event.target.id === "pdf-modal-img") return;
  const modal = document.getElementById("pdf-page-modal");
  if (modal) modal.classList.remove("open");
}

window.addEventListener("keydown", e => {
  const modal = document.getElementById("pdf-page-modal");
  if (!modal || !modal.classList.contains("open")) return;
  if (e.key === "Escape") closePdfModal();
  else if (e.key === "ArrowLeft") stepPdfModal(-1);
  else if (e.key === "ArrowRight") stepPdfModal(1);
});

// Theme Toggle (Light Paper vs Dark Slate)
function applyTheme() {
  if (state.theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  const btn = document.getElementById("theme-toggle-btn");
  if (btn) btn.textContent = state.theme === "dark" ? "☀️ Paper" : "🌙 Dark";
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
  renderRealmMap();
  saveState();
}

// Tab Navigation
function switchTab(tabId) {
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  const pane = document.getElementById(tabId);
  if (pane) pane.classList.add("active");
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add("active");

  if (tabId === "tab-realm") {
    renderRealmMap();
  }
}

// New Realm Confirmation Modal
function openNewRealmModal() {
  const modal = document.getElementById("new-realm-modal");
  if (modal) modal.classList.add("open");
}

function closeNewRealmModal(event) {
  if (event && event.target && event.target.id !== "new-realm-modal") return;
  const modal = document.getElementById("new-realm-modal");
  if (modal) modal.classList.remove("open");
}

function confirmGenerateNewRealm() {
  closeNewRealmModal();
  generateStarterRealm();
}

function saveState() {
  try {
    state.updatedAt = Date.now();
    const payload = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, payload);
    const el = document.getElementById("autosave-status");
    if (el) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      el.textContent = `✓ Saved ${timeStr}`;
    }
    // Also sync to local server (server.py) so Laptop & iPad share the same live Realm
    fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    }).catch(() => {});
  } catch (e) {
    console.warn("Could not save state", e);
  }
}

async function syncFromServerState() {
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) return;
    const serverData = await res.json();
    if (serverData && serverData.hexes && Object.keys(serverData.hexes).length > 0) {
      const localUpdated = state.updatedAt || 0;
      const serverUpdated = serverData.updatedAt || 1;
      if (serverUpdated >= localUpdated) {
        state = Object.assign(state, serverData);
        window.state = state;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        syncHeaderUI();
        renderRealmMap();
        renderSelectedHexInspector();
        renderActiveMyths();
        renderCompanyRoster();
      }
    } else if (state.hexes && Object.keys(state.hexes).length > 0) {
      // Push existing laptop state to server so the iPad receives it immediately
      saveState();
    }
  } catch (e) {
    // Static host fallback (localStorage only)
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = Object.assign(state, parsed);
      window.state = state;
      return true;
    }
  } catch (e) {
    console.warn("Could not load state", e);
  }
  window.state = state;
  return false;
}

function syncHeaderUI() {
  document.getElementById("day-display").textContent = state.day;
  document.querySelectorAll(".phase-pill").forEach(el => {
    el.classList.toggle("active", el.getAttribute("data-phase") === state.phase);
  });
  document.getElementById("season-select").value = state.season;
  document.getElementById("age-select").value = state.age;
  applyTheme();
}

function adjustDay(delta) {
  state.day = Math.max(1, state.day + delta);
  syncHeaderUI();
  saveState();
}

function setPhase(phase) {
  state.phase = phase;
  syncHeaderUI();
  saveState();
  if (phase === "Night") {
    setBanner("Night: Travel costs -d6 SPI");
  } else if (phase === "Morning") {
    setBanner("Morning: No sleep = -d6 CLA");
  } else {
    setBanner("Afternoon Phase");
  }
}

function advancePhase() {
  if (state.phase === "Morning") setPhase("Afternoon");
  else if (state.phase === "Afternoon") setPhase("Night");
  else {
    state.day += 1;
    setPhase("Morning");
  }
}

function setSeason(season) {
  state.season = season;
  saveState();
  setBanner(`Season: ${season}`);
}

function setAge(age) {
  state.age = age;
  saveState();
  setBanner(`Age: ${age}`);
}

// ==========================================
// PROCEDURE ROLLERS (TAB 1)
// ==========================================
function showProcedureBox(title, bodyHtml) {
  const box = document.getElementById("procedure-roll-output");
  box.style.display = "block";
  box.innerHTML = `<div class="roll-result-title"><span>${title}</span><button class="btn btn-sm" onclick="this.parentElement.parentElement.style.display='none'">✕</button></div><div>${bodyHtml}</div>`;
}

function getHexDistance(rc1, rc2) {
  const [r1, c1] = rc1.split(",").map(Number);
  const [r2, c2] = rc2.split(",").map(Number);
  // Flat-top hex grid where odd 0-indexed columns (Cols 2, 4, 6, 8, 10, 12) are shifted down by +0.5 row
  const x1 = c1;
  const z1 = r1 - (c1 - (c1 & 1)) / 2;
  const y1 = -x1 - z1;
  const x2 = c2;
  const z2 = r2 - (c2 - (c2 & 1)) / 2;
  const y2 = -x2 - z2;
  return (Math.abs(x1 - x2) + Math.abs(y1 - y2) + Math.abs(z1 - z2)) / 2;
}

function findNearestActiveMyth(fromHex) {
  let best = null;
  let bestDist = 999;
  state.activeMyths.forEach(am => {
    if (!am.resolved) {
      const d = getHexDistance(fromHex, am.hex);
      if (d < bestDist) {
        bestDist = d;
        best = am;
      }
    }
  });
  return { activeMyth: best, dist: bestDist };
}

function getMythById(id) {
  return window.MB_DATA.myths.find(m => m.id === id);
}

function getKnightById(id) {
  return window.MB_DATA.knights.find(k => k.id === id);
}

function rollWildernessCheck(targetHexKey) {
  const hexKey = targetHexKey || state.companyHex || "3,3";
  const hex = state.hexes[hexKey] || {};
  const r = rollDie(6);
  setBanner(`Wilderness Roll = <strong>${r}</strong>`);

  if (hex.mythSlot) {
    const am = state.activeMyths.find(m => m.slot === Number(hex.mythSlot));
    const mythObj = am ? getMythById(am.mythId) : null;
    if (mythObj) {
      const nextIdx = am.omensDone.findIndex(done => !done);
      const omenText = nextIdx >= 0 ? mythObj.omens[nextIdx] : "All 6 Omens already encountered.";
      showProcedureBox(
        `Inside Myth #${am.slot} Hex (${mythObj.name}) — Automatic Omen`,
        `<p><strong>Omen ${nextIdx >= 0 ? nextIdx + 1 : 6}:</strong> ${omenText}</p>
         <div style="margin-top:0.5rem;display:flex;gap:0.4rem;">
           <button class="btn btn-sm" onclick="openPdfModal(${mythObj.page}, '${mythObj.name.replace(/'/g, "\\'")}')">📄 View Myth Page (p.${mythObj.page})</button>
         </div>`
      );
      return;
    }
  }

  if (r === 1) {
    const unresolved = state.activeMyths.filter(m => !m.resolved);
    const chosen = unresolved.length ? unresolved[Math.floor(Math.random() * unresolved.length)] : state.activeMyths[0];
    const mythObj = chosen ? getMythById(chosen.mythId) : null;
    const nextIdx = chosen ? chosen.omensDone.findIndex(d => !d) : 0;
    const omenText = (mythObj && nextIdx >= 0) ? mythObj.omens[nextIdx] : "All Omens completed.";
    showProcedureBox(
      `Wilderness Roll [1] — Random Myth Omen (${mythObj ? mythObj.name : ""})`,
      `<p><strong>Omen #${nextIdx >= 0 ? nextIdx + 1 : 6}:</strong> ${omenText}</p>
       <div style="margin-top:0.5rem;display:flex;gap:0.45rem;flex-wrap:wrap;">
         ${chosen && nextIdx >= 0 ? `<button class="btn btn-sm btn-primary" onclick="markOmenDone(${chosen.slot - 1}, ${nextIdx});this.textContent='✓ Marked Omen #${nextIdx+1} Done'">Check Off Omen #${nextIdx + 1}</button>` : ""}
         ${mythObj ? `<button class="btn btn-sm" onclick="openPdfModal(${mythObj.page}, '${mythObj.name.replace(/'/g, "\\'")}')">📄 View Myth Page (p.${mythObj.page})</button>` : ""}
       </div>`
    );
  } else if (r === 2 || r === 3) {
    const { activeMyth, dist } = findNearestActiveMyth(hexKey);
    const mythObj = activeMyth ? getMythById(activeMyth.mythId) : null;
    const nextIdx = activeMyth ? activeMyth.omensDone.findIndex(d => !d) : 0;
    const omenText = (mythObj && nextIdx >= 0) ? mythObj.omens[nextIdx] : "All Omens completed.";
    showProcedureBox(
      `Wilderness Roll [${r}] — Nearest Myth Omen (${mythObj ? mythObj.name : ""}, ${dist} hexes away)`,
      `<p><strong>Omen #${nextIdx >= 0 ? nextIdx + 1 : 6}:</strong> ${omenText}</p>
       <div style="margin-top:0.5rem;display:flex;gap:0.45rem;flex-wrap:wrap;">
         ${activeMyth && nextIdx >= 0 ? `<button class="btn btn-sm btn-primary" onclick="markOmenDone(${activeMyth.slot - 1}, ${nextIdx});this.textContent='✓ Marked Omen #${nextIdx+1} Done'">Check Off Omen #${nextIdx + 1}</button>` : ""}
         ${mythObj ? `<button class="btn btn-sm" onclick="openPdfModal(${mythObj.page}, '${mythObj.name.replace(/'/g, "\\'")}')">📄 View Myth Page (p.${mythObj.page})</button>` : ""}
       </div>`
    );
  } else {
    const lm = hex.landmark ? `<strong>${hex.landmark}:</strong> ${hex.label || "Uncharted feature"}` : "No Landmark in this Hex — All Clear.";
    showProcedureBox(
      `Wilderness Roll [${r}] — Hex Landmark (${formatHexCoord(hexKey)})`,
      `<p>${lm}</p>`
    );
  }
}

function rollProcedureTable(type) {
  const r = rollDie(6);
  const tables = {
    luck: {
      title: `Luck Roll (1d6): [${r}]`,
      1: "<strong>1 — Crisis:</strong> Something immediately bad happens.",
      2: "<strong>2–3 — Problem:</strong> Something potentially bad develops.",
      3: "<strong>2–3 — Problem:</strong> Something potentially bad develops.",
      4: "<strong>4–6 — Blessing:</strong> A welcome result favours the players.",
      5: "<strong>4–6 — Blessing:</strong> A welcome result favours the players.",
      6: "<strong>4–6 — Blessing:</strong> A welcome result favours the players."
    },
    blind: {
      title: `Travelling Blind (1d6): [${r}]`,
      1: "<strong>1 — Circle Back:</strong> Circle back to where you started.",
      2: "<strong>2 — Drift Left:</strong> Drift a Hex to the Left.",
      3: "<strong>3 — Drift Right:</strong> Drift a Hex to the Right.",
      4: "<strong>4–6 — Progress as Planned:</strong> Hold your course.",
      5: "<strong>4–6 — Progress as Planned:</strong> Hold your course.",
      6: "<strong>4–6 — Progress as Planned:</strong> Hold your course."
    },
    weather: {
      title: `Dire Weather (1d6): [${r}]`,
      1: "<strong>1 — Dire Weather:</strong> Cannot leave Hex this Phase and cannot get proper sleep.",
      2: "<strong>2–3 — Looming Threat:</strong> If rolled a 2nd consecutive time, treat as Dire Weather.",
      3: "<strong>2–3 — Looming Threat:</strong> If rolled a 2nd consecutive time, treat as Dire Weather.",
      4: "<strong>4–6 — Fine Weather:</strong> Clear for travel.",
      5: "<strong>4–6 — Fine Weather:</strong> Clear for travel.",
      6: "<strong>4–6 — Fine Weather:</strong> Clear for travel."
    },
    mood: {
      title: `Local Mood (1d6): [${r}]`,
      1: "<strong>1 — Woe:</strong> Occupied by a looming or recent woe.",
      2: "<strong>2–3 — In Decline:</strong> A sense of things in decline.",
      3: "<strong>2–3 — In Decline:</strong> A sense of things in decline.",
      4: "<strong>4–6 — Fine Mood:</strong> All seems well enough.",
      5: "<strong>4–6 — Fine Mood:</strong> All seems well enough.",
      6: "<strong>4–6 — Fine Mood:</strong> All seems well enough."
    },
    crisis: {
      title: `Domain Crisis Roll (1d6): [${r}]`,
      1: `<strong>1 — Calamity:</strong> Gain <strong>2 Crises</strong> (1. Chaos, 2. Debt, 3. Famine, 4. Misery, 5. Panic, 6. Doubt). Random: <strong>#${rollDie(6)}</strong> & <strong>#${rollDie(6)}</strong>.`,
      2: `<strong>2–3 — Dilemma:</strong> Choose between <strong>2 Crises</strong> (Random: <strong>#${rollDie(6)}</strong> or <strong>#${rollDie(6)}</strong>).`,
      3: `<strong>2–3 — Dilemma:</strong> Choose between <strong>2 Crises</strong> (Random: <strong>#${rollDie(6)}</strong> or <strong>#${rollDie(6)}</strong>).`,
      4: "<strong>4–6 — Prosperity:</strong> Times are good.",
      5: "<strong>4–6 — Prosperity:</strong> Times are good.",
      6: "<strong>4–6 — Prosperity:</strong> Times are good."
    },
    drama: {
      title: `Court Drama (1d6): [${r}]`,
      1: "<strong>1 — Personally Involved:</strong> Directly at the centre of the conflict.",
      2: "<strong>2–3 — Involved by Association:</strong> Allies or retainers pull you in.",
      3: "<strong>2–3 — Involved by Association:</strong> Allies or retainers pull you in.",
      4: "<strong>4–6 — Not Involved:</strong> Drama stays among other courtiers.",
      5: "<strong>4–6 — Not Involved:</strong> Drama stays among other courtiers.",
      6: "<strong>4–6 — Not Involved:</strong> Drama stays among other courtiers."
    },
    collections: {
      title: `Increased Collections (1d6): [${r}]`,
      1: "<strong>1 — Immediate Misrule:</strong> Vassals revolt, Knights leave.",
      2: "<strong>2–3 — Coffers Filled, Take a Crisis:</strong> Treasury stocked, but causes a Crisis.",
      3: "<strong>2–3 — Coffers Filled, Take a Crisis:</strong> Treasury stocked, but causes a Crisis.",
      4: "<strong>4–6 — Paid Willingly:</strong> Vassals pay willingly, mostly.",
      5: "<strong>4–6 — Paid Willingly:</strong> Vassals pay willingly, mostly.",
      6: "<strong>4–6 — Paid Willingly:</strong> Vassals pay willingly, mostly."
    },
    unresolved: {
      title: `Unresolved Situation (1d6): [${r}]`,
      1: "<strong>1 — Disaster:</strong> Goes as bad as it could possibly go.",
      2: "<strong>2–3 — Worse:</strong> It gets worse.",
      3: "<strong>2–3 — Worse:</strong> It gets worse.",
      4: "<strong>4–6 — Better:</strong> It gets better.",
      5: "<strong>4–6 — Better:</strong> It gets better.",
      6: "<strong>4–6 — Better:</strong> It gets better."
    }
  };
  const entry = tables[type];
  if (entry) {
    setBanner(entry.title);
    showProcedureBox(entry.title, `<p>${entry[r]}</p>`);
  }
}

function rollScarTable() {
  const r = rollDie(12);
  const sub = rollDie(6);
  const scars = [
    null,
    `<strong>1 — Distress:</strong> Lose <code>d6 SPI</code> (Rolled: <strong>${rollDie(6)} SPI</strong>).`,
    `<strong>2 — Disfigurement:</strong> Mark [d6=${sub}]: <strong>${["","Eye","Cheek","Neck","Torso","Nose","Jaw"][sub]}</strong>. If max GD ≤ 2, <code>+d6 max GD</code> (+${rollDie(6)}).`,
    `<strong>3 — Smash:</strong> Lose <code>d6 VIG</code> (Rolled: <strong>${rollDie(6)} VIG</strong>).`,
    `<strong>4 — Stun:</strong> Lose <code>d6 CLA</code> (Rolled: <strong>${rollDie(6)} CLA</strong>). If max GD ≤ 4, <code>+d6 max GD</code> (+${rollDie(6)}).`,
    `<strong>5 — Rupture:</strong> Lose <code>2d6 VIG</code> (Rolled: <strong>${rollDie(6)+rollDie(6)} VIG</strong>).`,
    `<strong>6 — Gouge:</strong> When stitched up, if max GD ≤ 6, <code>+d6 max GD</code> (+${rollDie(6)}).`,
    `<strong>7 — Concussion:</strong> Lose <code>2d6 CLA</code> (Rolled: <strong>${rollDie(6)+rollDie(6)} CLA</strong>).`,
    `<strong>8 — Tear:</strong> Lost [d6=${sub}]: <strong>${["","Nose","Ear","Finger","Thumb","Eye","Chunk of Scalp"][sub]}</strong>. When patched, if max GD ≤ 8, <code>+d6 max GD</code> (+${rollDie(6)}).`,
    `<strong>9 — Agony:</strong> Lose <code>2d6 SPI</code> (Rolled: <strong>${rollDie(6)+rollDie(6)} SPI</strong>).`,
    `<strong>10 — Mutilation:</strong> Limb [d6=${sub}]: <strong>${sub <= 2 ? "Leg" : sub <= 4 ? "Shield Arm" : "Sword Arm"}</strong>. By next Season if max GD ≤ 10, <code>+d6 max GD</code> (+${rollDie(6)}).`,
    `<strong>11 — Doom:</strong> If you take a Mortal Wound this Season you are <strong>Slain</strong> instead.`,
    `<strong>12 — Humiliation:</strong> When you achieve revenge, if max GD ≤ 12, <code>+d6 max GD</code> (+${rollDie(6)}).`
  ];
  setBanner(`Scar Roll = <strong>#${r}</strong>`);
  showProcedureBox(`Scar Roll [${r}]`, `<p>${scars[r]}</p>`);
}

// ==========================================
// COMBAT ATTACK & GAMBIT CALCULATOR
// ==========================================
function updateCombatPoolSummary() {
  const counts = {};
  combatPool.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
  const parts = Object.keys(counts).sort((a,b)=>Number(b)-Number(a)).map(s => `${counts[s]}d${s}`);
  document.getElementById("combat-pool-summary").textContent = parts.length ? `Pool: ${parts.join(" + ")}` : "Pool empty";
}

function addCombatDie(sides) {
  combatPool.push(sides);
  updateCombatPoolSummary();
  rollCombatPool();
}

function clearCombatPool() {
  combatPool = [];
  combatRolled = [];
  updateCombatPoolSummary();
  document.getElementById("combat-rolled-tray").innerHTML = "";
  document.getElementById("combat-damage-summary").innerHTML = "";
}

function rollCombatPool() {
  if (!combatPool.length) {
    combatPool = [8];
    updateCombatPoolSummary();
  }
  combatRolled = combatPool.map(sides => ({
    sides,
    val: rollDie(sides),
    usedForGambit: false
  }));
  recalcCombatPool();
}

function toggleDieGambit(idx) {
  if (!combatRolled[idx] || combatRolled[idx].val < 4) return;
  combatRolled[idx].usedForGambit = !combatRolled[idx].usedForGambit;
  recalcCombatPool();
}

function recalcCombatPool() {
  const tray = document.getElementById("combat-rolled-tray");
  const summary = document.getElementById("combat-damage-summary");
  if (!combatRolled.length) return;

  const armour = Number(document.getElementById("combat-target-armour").value || 0);

  let highestIdx = -1;
  let highestVal = -1;
  combatRolled.forEach((d, idx) => {
    if (!d.usedForGambit && d.val > highestVal) {
      highestVal = d.val;
      highestIdx = idx;
    }
  });

  const gambitsUsed = combatRolled.filter(d => d.usedForGambit).length;
  const strongGambitsUsed = combatRolled.filter(d => d.usedForGambit && d.val >= 8).length;

  tray.innerHTML = combatRolled.map((d, idx) => {
    const isHighest = idx === highestIdx;
    let cls = "rolled-die-chip";
    let tag = `d${d.sides}`;
    if (d.usedForGambit) {
      cls += d.val >= 8 ? " strong-gambit" : " gambit";
      tag = d.val >= 8 ? "Strong Gambit" : "Gambit Used";
    } else if (isHighest) {
      cls += " highest";
      tag = `Damage (d${d.sides})`;
    } else if (d.val >= 8) {
      cls += " strong-gambit";
      tag = `d${d.sides} • Tap: Strong`;
    } else if (d.val >= 4) {
      cls += " gambit";
      tag = `d${d.sides} • Tap: Gambit`;
    }
    return `<div class="${cls}" onclick="toggleDieGambit(${idx})" style="cursor:${d.val>=4?'pointer':'default'};">
      <span class="rolled-die-val">${d.val}</span>
      <span class="rolled-die-tag">${tag}</span>
    </div>`;
  }).join("");

  const rawDamage = highestVal > 0 ? highestVal : 0;
  const finalDamage = Math.max(0, rawDamage - armour);
  summary.innerHTML = `
    <div style="background:var(--bg-subtle);padding:0.65rem 0.85rem;border-radius:7px;font-size:0.9rem;">
      Highest Die (<strong>${rawDamage}</strong>) − Armour (<strong>A${armour}</strong>) = 
      <strong style="color:var(--danger);font-size:1.05rem;">${finalDamage} Damage</strong>
      ${gambitsUsed ? ` • <strong>${gambitsUsed} Gambit(s)</strong> (${strongGambitsUsed} Strong)` : ""}
    </div>
  `;
}

// ==========================================
// TAB 2: 12x12 REALM HEX MAP & ACTIVE MYTHS
// (Official Mythic Bastionland Blank Realm.pdf Edition)
// ==========================================
const BLANK_COL_X0 = [26.58, 60.47, 94.37, 128.26, 162.16, 196.05, 229.94, 263.84, 297.32, 331.22, 365.11, 399.01];
const BLANK_ODD_COL_Y0 = [27.41, 65.07, 102.73, 140.39, 178.05, 215.71, 253.51, 291.17, 328.83, 366.49, 404.15, 441.37];
const BLANK_EVEN_COL_Y0 = [46.24, 83.90, 121.56, 159.22, 196.88, 234.68, 272.34, 310.00, 347.66, 385.32, 422.54, 459.76];
const BLANK_HEX_W = 45.05;
const BLANK_HEX_H = 37.55;

const TERRAIN_STAMPS = {
  Marsh: "stamps/terrain_01_Marsh.png",
  Heath: "stamps/terrain_02_Heath.png",
  Crag: "stamps/terrain_03_Crag.png",
  Peaks: "stamps/terrain_04_Peaks.png",
  Forest: "stamps/terrain_05_Forest.png",
  Valley: "stamps/terrain_06_Valley.png",
  Hills: "stamps/terrain_07_Hills.png",
  Meadow: "stamps/terrain_08_Meadow.png",
  Bog: "stamps/terrain_09_Bog.png",
  Lake: "stamps/terrain_10_Lake.png",
  Glade: "stamps/terrain_11_Glade.png",
  Plains: "stamps/terrain_12_Plains.png"
};

const HOLDING_STAMPS = {
  "Seat of Power": "stamps/holding_Castle.png",
  Castle: "stamps/holding_Castle.png",
  Fortress: "stamps/holding_Fortress.png",
  Town: "stamps/holding_Town.png",
  Tower: "stamps/holding_Tower.png",
  Holding: "stamps/holding_Fortress.png"
};

const LANDMARK_STAMPS = {
  Dwelling: "stamps/landmark_Dwelling.png",
  Sanctum: "stamps/landmark_Sanctum.png",
  Monument: "stamps/landmark_Monument.png",
  Hazard: "stamps/landmark_Hazard.png",
  Curse: "stamps/landmark_Curse.png",
  Ruin: "stamps/landmark_Ruin.png"
};

function normalizeTerrain(t) {
  if (!t) return "Plains";
  if (t === "Swamp") return "Marsh";
  if (t === "Mountains") return "Peaks";
  if (t === "Water") return "Lake";
  return TERRAIN_STAMPS[t] ? t : "Plains";
}

function normalizeHolding(h) {
  if (!h) return "";
  if (h === "Holding") return "Fortress";
  return h;
}

function getBlankRealmHexBox(r, c) {
  const x0 = BLANK_COL_X0[c] || 26.58;
  const y0 = (c % 2 === 0 ? BLANK_ODD_COL_Y0[r] : BLANK_EVEN_COL_Y0[r]) || 27.41;
  const w = BLANK_HEX_W;
  const h = BLANK_HEX_H;
  const cx = x0 + w * 0.5;
  const cy = y0 + h * 0.5;
  const verts = [
    [x0 + w * 0.25, y0],
    [x0 + w * 0.75, y0],
    [x0 + w, y0 + h * 0.5],
    [x0 + w * 0.75, y0 + h],
    [x0 + w * 0.25, y0 + h],
    [x0, y0 + h * 0.5]
  ];
  return { x0, y0, w, h, cx, cy, verts };
}

function setMapTouchMode(mode) {
  mapTouchMode = mode;
  document.getElementById("touch-mode-inspect").classList.toggle("active", mode === "inspect");
  document.getElementById("touch-mode-move").classList.toggle("active", mode === "move");
}

function handleHexTap(key) {
  if (mapTouchMode === "move") {
    moveCompanyToHex(key);
  } else {
    selectHex(key);
  }
}

const HEX_SIDE_LABELS = ["N", "NE", "SE", "S", "SW", "NW"];

// Weighted spatial dispersion for 6 Myth locations:
// - Avoids Holdings (min distance >= 2, strongly weighted toward larger distance from nearest Holding)
// - Dispersed from other Myths (min distance >= 3, weighted toward larger distance from already-placed Myths)
// - Slight preference for remote/outer borderland hexes
function pickDispersedMythHexes(holdingCoords) {
  const placedMyths = [];

  for (let slot = 0; slot < 6; slot++) {
    let candidates = [];

    // Try strict separation first (minHoldDist >= 2, minMythDist >= 3), relax slightly only if needed
    for (const [minHold, minMyth] of [[2, 3], [2, 2], [1, 2]]) {
      candidates = [];
      for (let r = 0; r < 12; r++) {
        for (let c = 0; c < 12; c++) {
          const key = `${r},${c}`;
          const hex = state.hexes[key];
          if (!hex || hex.holding || hex.terrain === "Lake") continue;
          if (placedMyths.includes(key)) continue;

          let nearestHoldDist = 99;
          for (const hc of holdingCoords) {
            const d = getHexDistance(key, hc);
            if (d < nearestHoldDist) nearestHoldDist = d;
          }
          if (nearestHoldDist < minHold) continue;

          let nearestMythDist = 99;
          for (const mc of placedMyths) {
            const d = getHexDistance(key, mc);
            if (d < nearestMythDist) nearestMythDist = d;
          }
          if (nearestMythDist < minMyth) continue;

          const edgeDist = Math.min(r, 11 - r, c, 11 - c); // 0 on border, 5 in center
          const holdFactor = Math.pow(nearestHoldDist, 2.5);
          const mythFactor = placedMyths.length > 0 ? Math.pow(Math.min(nearestMythDist, 7), 2.2) : 1.0;
          const remoteFactor = 1.0 + 0.28 * (5 - edgeDist);

          candidates.push({
            key,
            weight: holdFactor * mythFactor * remoteFactor
          });
        }
      }
      if (candidates.length > 0) break;
    }

    // Roulette-wheel weighted random selection
    const totalWeight = candidates.reduce((sum, item) => sum + item.weight, 0);
    let pick = Math.random() * totalWeight;
    let chosenKey = candidates[candidates.length - 1].key;
    for (const item of candidates) {
      pick -= item.weight;
      if (pick <= 0) {
        chosenKey = item.key;
        break;
      }
    }
    placedMyths.push(chosenKey);
  }

  return placedMyths;
}

function rollRandomBarrierSides() {
  const count = rollDie(6); // 1 to 6 sides of the hex blocked
  const pool = [0, 1, 2, 3, 4, 5];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

function generateLandmarkNote(lmType, mythIndexHint) {
  const activeIds = new Set((state.activeMyths || []).map(m => m.mythId));
  if (lmType === "Ruin") {
    // Rulebook p.14: "Ruins hint at a random Myth not currently active in the Realm, though it may return."
    const inactiveMyths = window.MB_DATA.myths.filter(m => !activeIds.has(m.id));
    const chosenMyth = inactiveMyths.length
      ? inactiveMyths[Math.floor(Math.random() * inactiveMyths.length)]
      : window.MB_DATA.myths[Math.floor(Math.random() * window.MB_DATA.myths.length)];
    const ruinPrompt = (chosenMyth.landmarks && chosenMyth.landmarks.Ruin) ? chosenMyth.landmarks.Ruin : "Ancient ruin";
    return `${ruinPrompt} (Echoes [${chosenMyth.id}] ${chosenMyth.name}, p.${chosenMyth.page})`;
  }

  const activeList = state.activeMyths || [];
  const refActive = activeList.length
    ? activeList[(mythIndexHint !== undefined ? mythIndexHint : Math.floor(Math.random() * activeList.length)) % activeList.length]
    : null;
  const refMyth = refActive ? getMythById(refActive.mythId) : window.MB_DATA.myths[Math.floor(Math.random() * 72)];
  const lmPrompt = (refMyth && refMyth.landmarks && refMyth.landmarks[lmType]) ? refMyth.landmarks[lmType] : lmType;

  if (lmType === "Sanctum") {
    // Rulebook p.14: "Sanctums: Each the sacred home to a Seer. Roll on the Knight table (p26) to find which Seer lives at each Sanctum."
    const seerKnight = window.MB_DATA.knights[Math.floor(Math.random() * 72)];
    return `${lmPrompt} (${seerKnight.seer.name}, p.${seerKnight.page})`;
  }
  return `${lmPrompt} (${refMyth ? refMyth.name : "Wilds"})`;
}

function generateStarterRealm() {
  state.hexes = {};
  const allTerrains = [
    "Marsh", "Heath", "Crag", "Peaks", "Forest", "Valley",
    "Hills", "Meadow", "Bog", "Glade", "Plains", "Plains"
  ];

  // Drop 15 Voronoi cluster seeds across the 12x12 grid (Blank Realm: "Draw clusters of d12 hexes of the same terrain type")
  const seeds = [];
  for (let i = 0; i < 15; i++) {
    seeds.push({
      r: Math.floor(Math.random() * 12),
      c: Math.floor(Math.random() * 12),
      t: allTerrains[Math.floor(Math.random() * allTerrains.length)]
    });
  }

  for (let r = 0; r < 12; r++) {
    for (let c = 0; c < 12; c++) {
      let bestT = "Plains";
      let bestD = 999;
      seeds.forEach(s => {
        const d = Math.hypot(r - s.r, c - s.c);
        if (d < bestD) { bestD = d; bestT = s.t; }
      });
      // Rulebook p.14 / Blank Realm: "Draw thick outlines for Barriers around the outside of 1-in-6 Hexes"
      const hasBarrier = rollDie(6) === 1;
      state.hexes[`${r},${c}`] = {
        terrain: bestT,
        holding: "",
        landmark: "",
        mythSlot: "",
        label: "",
        river: false,
        barrier: hasBarrier,
        barrierSides: hasBarrier ? rollRandomBarrierSides() : []
      };
    }
  }

  // Add a Lake cluster (2-3 connected hexes: "and a few large lakes spanning whole or multiple Hexes")
  const lakeR = 5 + Math.floor(Math.random() * 4);
  const lakeC = 6 + Math.floor(Math.random() * 4);
  [[lakeR, lakeC], [lakeR + 1, lakeC], [lakeR, lakeC + 1]].forEach(([lr, lc]) => {
    if (lr >= 0 && lr < 12 && lc >= 0 && lc < 12) {
      state.hexes[`${lr},${lc}`].terrain = "Lake";
      state.hexes[`${lr},${lc}`].barrier = false;
      state.hexes[`${lr},${lc}`].barrierSides = [];
    }
  });

  // Navigable River passing through the Realm from North-West to South/South-East
  let rr = 0;
  let rc = 2 + Math.floor(Math.random() * 3);
  while (rr < 12 && rc < 12) {
    const h = state.hexes[`${rr},${rc}`];
    if (h) {
      h.river = true;
      h.barrier = false;
      h.barrierSides = [];
    }
    if (rr === 11) break;
    const stepRoll = Math.random();
    if (stepRoll < 0.58) {
      rr++;
    } else if (stepRoll < 0.82 && rc < 10) {
      rc++;
      if (Math.random() < 0.5 && rr < 11) rr++;
    } else if (rc > 1) {
      rc--;
      rr++;
    } else {
      rr++;
    }
  }

  // 4 Holdings placed in the 4 quadrants with random jitter so they are well-spaced but vary each Realm
  const randInRange = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
  const holdingTypes = ["Fortress", "Tower", "Town"].sort(() => Math.random() - 0.5);
  const holdingConfigs = [
    { coord: `${randInRange(2, 4)},${randInRange(2, 4)}`, type: "Seat of Power" },
    { coord: `${randInRange(2, 4)},${randInRange(7, 9)}`, type: holdingTypes[0] },
    { coord: `${randInRange(7, 9)},${randInRange(2, 4)}`, type: holdingTypes[1] },
    { coord: `${randInRange(7, 9)},${randInRange(7, 9)}`, type: holdingTypes[2] }
  ];
  const holdingSpark = window.MB_DATA.sparkTables.Civilisation.Holding.rows;
  holdingConfigs.forEach(cfg => {
    const h = state.hexes[cfg.coord];
    h.holding = cfg.type;
    h.barrier = false;
    h.barrierSides = [];
    if (h.terrain === "Lake") h.terrain = "Plains";
    const sp1 = holdingSpark[rollDie(12) - 1][0];
    const sp2 = holdingSpark[rollDie(12) - 1][1];
    h.label = `${sp1} ${sp2}`;
  });
  state.companyHex = holdingConfigs[0].coord;
  state.selectedHex = holdingConfigs[0].coord;

  // 6 Active Myths dispersed randomly across the Realm (repelled from Holdings and from each other)
  const holdingCoords = holdingConfigs.map(cfg => cfg.coord);
  const mythHexCoords = pickDispersedMythHexes(holdingCoords);

  const chosenMyths = [];
  const usedMythIds = new Set();
  while (chosenMyths.length < 6) {
    const d6 = rollDie(6);
    const d12 = rollDie(12);
    const id = `${d6}-${d12}`;
    if (!usedMythIds.has(id)) {
      usedMythIds.add(id);
      chosenMyths.push(id);
    }
  }

  state.activeMyths = chosenMyths.map((mythId, idx) => {
    const coord = mythHexCoords[idx];
    const slot = idx + 1;
    state.hexes[coord].mythSlot = String(slot);
    state.hexes[coord].barrier = false;
    state.hexes[coord].barrierSides = [];
    const mythObj = getMythById(mythId);
    state.hexes[coord].label = mythObj ? mythObj.name : `Myth #${slot}`;
    return {
      slot,
      mythId,
      omensDone: [false, false, false, false, false, false],
      resolved: false,
      hex: coord
    };
  });

  // 3 of each of the 6 Landmark types
  const landmarkTypes = ["Sanctum", "Dwelling", "Monument", "Hazard", "Curse", "Ruin"];
  landmarkTypes.forEach((lmType, typeIdx) => {
    for (let i = 0; i < 3; i++) {
      let attempts = 0;
      while (attempts < 40) {
        attempts++;
        const r = Math.floor(Math.random() * 12);
        const c = Math.floor(Math.random() * 12);
        const key = `${r},${c}`;
        const hex = state.hexes[key];
        if (!hex.holding && !hex.mythSlot && !hex.landmark && hex.terrain !== "Lake") {
          hex.landmark = lmType;
          hex.label = generateLandmarkNote(lmType, typeIdx + i);
          break;
        }
      }
    }
  });

  renderRealmMap();
  renderSelectedHexInspector();
  renderActiveMyths();
  saveState();
  setBanner("Generated new 12×12 Blank Realm Map");
}

function togglePlayerView() {
  state.playerView = !state.playerView;
  const btn = document.getElementById("toggle-player-view-btn");
  btn.textContent = state.playerView ? "Player View (Hidden)" : "Referee View";
  renderRealmMap();
  saveState();
}

// Convert array of {x, y} points into a smooth Catmull-Rom Cubic Bezier SVG path
function buildCatmullRomSvgPath(pts) {
  if (!pts || pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function buildRealmSvgInnerMarkup(forcePlayerClean) {
  const hideSecrets = forcePlayerClean || !!state.playerView;
  let terrainLayer = "";
  let barrierLayer = "";
  let featureLayer = "";
  let selectionLayer = "";
  let hitLayer = "";
  const riverPts = [];

  for (let r = 0; r < 12; r++) {
    for (let c = 0; c < 12; c++) {
      const key = `${r},${c}`;
      const hex = state.hexes[key] || { terrain: "Plains" };
      const tName = normalizeTerrain(hex.terrain);
      const hName = normalizeHolding(hex.holding);
      const box = getBlankRealmHexBox(r, c);
      const ptsStr = box.verts.map(v => `${v[0].toFixed(2)},${v[1].toFixed(2)}`).join(" ");

      const hasHolding = !!hName;
      const hasSecretMark = !hideSecrets && (hex.mythSlot || hex.landmark);

      // 1. Official Blank Realm Terrain Stamp (1-12)
      const tStamp = TERRAIN_STAMPS[tName] || TERRAIN_STAMPS.Plains;
      if (!hasHolding) {
        const tOpacity = hasSecretMark ? "0.28" : (hex.river ? "0.45" : "0.94");
        terrainLayer += `<image href="${tStamp}" x="${(box.x0 + 1.2).toFixed(2)}" y="${(box.y0 + 1.0).toFixed(2)}" width="${(box.w - 2.4).toFixed(2)}" height="${(box.h - 2.0).toFixed(2)}" opacity="${tOpacity}" preserveAspectRatio="xMidYMid meet" pointer-events="none" />`;
      }

      // 2. Collect River Waypoints
      if (hex.river) {
        riverPts.push({ r, c, x: box.cx, y: box.cy });
      }

      // 3. Red-Ink Barrier Hex Edges (1-6 randomly chosen sides of the hex, Referee View only)
      if (!hideSecrets && hex.barrier) {
        if (!Array.isArray(hex.barrierSides) || hex.barrierSides.length === 0) {
          hex.barrierSides = rollRandomBarrierSides();
        }
        hex.barrierSides.forEach(sideIdx => {
          const s = Number(sideIdx) % 6;
          const pA = box.verts[s];
          const pB = box.verts[(s + 1) % 6];
          barrierLayer += `<line x1="${pA[0].toFixed(1)}" y1="${pA[1].toFixed(1)}" x2="${pB[0].toFixed(1)}" y2="${pB[1].toFixed(1)}" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" pointer-events="none" />`;
        });
      }

      // 4. Holdings, Myths (1-6), and Red-Ink Landmarks
      if (hasHolding) {
        const hStamp = HOLDING_STAMPS[hName] || HOLDING_STAMPS.Fortress;
        featureLayer += `<circle cx="${box.cx.toFixed(1)}" cy="${box.cy.toFixed(1)}" r="15.5" fill="#ffffff" opacity="0.92" pointer-events="none" />`;
        featureLayer += `<image href="${hStamp}" x="${(box.x0 + 2.5).toFixed(2)}" y="${(box.y0 + 1.0).toFixed(2)}" width="${(box.w - 5.0).toFixed(2)}" height="${(box.h - 3.0).toFixed(2)}" preserveAspectRatio="xMidYMid meet" pointer-events="none" />`;
        if (hName === "Seat of Power") {
          featureLayer += `
            <rect x="${(box.cx - 12).toFixed(1)}" y="${(box.y0 + box.h - 8.5).toFixed(1)}" width="24" height="7.5" rx="2.5" fill="#b45309" stroke="#ffffff" stroke-width="0.8" pointer-events="none" />
            <text x="${box.cx.toFixed(1)}" y="${(box.y0 + box.h - 3.3).toFixed(1)}" text-anchor="middle" font-size="5.2" font-weight="800" fill="#ffffff" pointer-events="none">★ SEAT</text>
          `;
        }
      } else if (!hideSecrets && hex.mythSlot) {
        featureLayer += `
          <circle cx="${box.cx.toFixed(1)}" cy="${box.cy.toFixed(1)}" r="11.2" fill="#ffffff" stroke="#dc2626" stroke-width="2.0" pointer-events="none" />
          <circle cx="${box.cx.toFixed(1)}" cy="${box.cy.toFixed(1)}" r="8.8" fill="none" stroke="#dc2626" stroke-width="0.7" stroke-dasharray="2,1.5" pointer-events="none" />
          <text x="${box.cx.toFixed(1)}" y="${(box.cy + 3.8).toFixed(1)}" text-anchor="middle" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#dc2626" pointer-events="none">${hex.mythSlot}</text>
        `;
      } else if (!hideSecrets && hex.landmark && LANDMARK_STAMPS[hex.landmark]) {
        const lStamp = LANDMARK_STAMPS[hex.landmark];
        featureLayer += `<circle cx="${box.cx.toFixed(1)}" cy="${box.cy.toFixed(1)}" r="12.5" fill="#ffffff" opacity="0.82" pointer-events="none" />`;
        featureLayer += `<image href="${lStamp}" x="${(box.cx - 12.5).toFixed(2)}" y="${(box.cy - 11.0).toFixed(2)}" width="25" height="22" preserveAspectRatio="xMidYMid meet" pointer-events="none" />`;
      }

      // 5. Company Marker & Selected Hex Outline
      if (!forcePlayerClean && state.selectedHex === key) {
        selectionLayer += `<polygon points="${ptsStr}" class="hex-selected-poly" />`;
      }
      if (!forcePlayerClean && state.companyHex === key) {
        const badgeX = box.cx + 12.5;
        const badgeY = box.cy - 10.5;
        selectionLayer += `
          <g pointer-events="none">
            <circle cx="${badgeX.toFixed(1)}" cy="${badgeY.toFixed(1)}" r="7.5" fill="#1d4ed8" stroke="#ffffff" stroke-width="1.5" />
            <text x="${badgeX.toFixed(1)}" y="${(badgeY + 2.8).toFixed(1)}" text-anchor="middle" font-size="7.5" fill="#ffffff">🛡️</text>
          </g>
        `;
      }

      // 6. Interactive Hex Hit Polygon
      if (!forcePlayerClean) {
        hitLayer += `<polygon points="${ptsStr}" class="hex-hit-poly" onclick="handleHexTap('${key}')" />`;
      }
    }
  }

  // Build Hand-Inked River (Twin black ink banks + white water channel + ink water ripples, matching Sample Realm Sheet)
  let riverLayer = "";
  if (riverPts.length >= 2) {
    riverPts.sort((a, b) => (a.r * 1.2 + a.c * 0.4) - (b.r * 1.2 + b.c * 0.4));
    const pathPts = riverPts.map(p => ({ x: p.x, y: p.y }));
    if (riverPts[0].r === 0) {
      pathPts.unshift({ x: riverPts[0].x - 4, y: riverPts[0].y - 17 });
    }
    const lastPt = riverPts[riverPts.length - 1];
    if (lastPt.r === 11 || lastPt.c === 11) {
      pathPts.push({ x: lastPt.x + 5, y: lastPt.y + 17 });
    }
    const d = buildCatmullRomSvgPath(pathPts);
    const ripples = riverPts.map(p => `
      <line x1="${(p.x - 2.6).toFixed(1)}" y1="${(p.y - 1.5).toFixed(1)}" x2="${(p.x + 2.6).toFixed(1)}" y2="${(p.y - 1.5).toFixed(1)}" stroke="#18181b" stroke-width="0.75" stroke-linecap="round" />
      <line x1="${(p.x - 1.8).toFixed(1)}" y1="${(p.y + 1.8).toFixed(1)}" x2="${(p.x + 2.2).toFixed(1)}" y2="${(p.y + 1.8).toFixed(1)}" stroke="#18181b" stroke-width="0.75" stroke-linecap="round" />
    `).join("");

    riverLayer = `
      <g pointer-events="none">
        <path d="${d}" fill="none" stroke="#18181b" stroke-width="10.2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="${d}" fill="none" stroke="#ffffff" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round" />
        ${ripples}
      </g>
    `;
  } else if (riverPts.length === 1) {
    const p = riverPts[0];
    riverLayer = `
      <g pointer-events="none">
        <ellipse cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" rx="9" ry="5.5" fill="#ffffff" stroke="#18181b" stroke-width="1.8" />
        <line x1="${(p.x - 4).toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${(p.x + 4).toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="#18181b" stroke-width="0.8" />
      </g>
    `;
  }

  return `
    <image href="stamps/blank_realm_grid.png" x="10" y="10" width="438" height="492" preserveAspectRatio="none" pointer-events="none" />
    ${terrainLayer}
    ${riverLayer}
    ${barrierLayer}
    ${featureLayer}
    ${selectionLayer}
    ${hitLayer}
  `;
}

function renderRealmMap() {
  const svg = document.getElementById("hex-map-svg");
  if (!svg) return;
  svg.innerHTML = buildRealmSvgInnerMarkup(false);
}

function printPlayerRealmPDF() {
  const sheet = document.getElementById("printable-player-sheet");
  if (!sheet) return;

  const terrainKeyOrder = [
    ["1 Marsh", "Marsh"], ["2 Heath", "Heath"], ["3 Crag", "Crag"], ["4 Peaks", "Peaks"],
    ["5 Forest", "Forest"], ["6 Valley", "Valley"], ["7 Hills", "Hills"], ["8 Meadow", "Meadow"],
    ["9 Bog", "Bog"], ["10 Lake", "Lake"], ["11 Glade", "Glade"], ["12 Plains", "Plains"]
  ];
  const terrainStripHtml = terrainKeyOrder.map(([lbl, key]) =>
    `<span><img src="${TERRAIN_STAMPS[key]}" alt="${lbl}" /> ${lbl}</span>`
  ).join("");

  const holdingKeyOrder = [
    ["Castle / Seat of Power", "Castle"],
    ["Fortress", "Fortress"],
    ["Town", "Town"],
    ["Tower", "Tower"]
  ];
  const holdingStripHtml = holdingKeyOrder.map(([lbl, key]) =>
    `<span><img src="${HOLDING_STAMPS[key]}" alt="${lbl}" /> ${lbl}</span>`
  ).join("");

  sheet.innerHTML = `
    <div class="print-map-only-wrap">
      <svg viewBox="10 10 438 492" xmlns="http://www.w3.org/2000/svg">
        ${buildRealmSvgInnerMarkup(true)}
      </svg>
      <div class="print-terrain-strip">
        ${terrainStripHtml}
      </div>
      <div class="print-terrain-strip" style="margin-top:6px;">
        ${holdingStripHtml}
      </div>
    </div>
  `;

  setTimeout(() => {
    window.print();
  }, 120);
}

// 2D Blank Realm Map Zoom & Pan Controls
let map2DScale = 1.0;
let map2DPanX = 0;
let map2DPanY = 0;
let map2DInitialized = false;

function apply2DMapTransform() {
  const stage = document.getElementById("realm-2d-stage");
  const viewport = document.getElementById("realm-2d-viewport");
  const label = document.getElementById("map-zoom-label");
  if (!stage || !viewport) return;

  if (map2DScale <= 1.01) {
    map2DScale = 1.0;
    map2DPanX = 0;
    map2DPanY = 0;
  } else {
    const maxPanX = viewport.clientWidth * (map2DScale - 1);
    const maxPanY = viewport.clientHeight * (map2DScale - 1);
    map2DPanX = Math.max(-maxPanX, Math.min(0, map2DPanX));
    map2DPanY = Math.max(-maxPanY, Math.min(0, map2DPanY));
  }

  stage.style.transform = `translate(${map2DPanX.toFixed(1)}px, ${map2DPanY.toFixed(1)}px) scale(${map2DScale.toFixed(3)})`;
  if (label) label.textContent = `${Math.round(map2DScale * 100)}%`;
}

function zoom2DMap(delta, focalX, focalY) {
  const viewport = document.getElementById("realm-2d-viewport");
  if (!viewport) return;
  const oldScale = map2DScale;
  const newScale = Math.max(1.0, Math.min(3.2, oldScale + delta));
  if (Math.abs(newScale - oldScale) < 0.001) return;

  const fx = focalX !== undefined ? focalX : viewport.clientWidth * 0.5;
  const fy = focalY !== undefined ? focalY : viewport.clientHeight * 0.5;

  map2DPanX = fx - ((fx - map2DPanX) / oldScale) * newScale;
  map2DPanY = fy - ((fy - map2DPanY) / oldScale) * newScale;
  map2DScale = newScale;
  apply2DMapTransform();
}

function reset2DMapZoom() {
  map2DScale = 1.0;
  map2DPanX = 0;
  map2DPanY = 0;
  apply2DMapTransform();
}

function setup2DMapZoomPan() {
  if (map2DInitialized) return;
  const viewport = document.getElementById("realm-2d-viewport");
  if (!viewport) return;
  map2DInitialized = true;

  let isPanning = false;
  let lastX = 0;
  let lastY = 0;

  viewport.addEventListener("wheel", e => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const fx = e.clientX - rect.left;
    const fy = e.clientY - rect.top;
    const step = e.deltaY < 0 ? 0.18 : -0.18;
    zoom2DMap(step, fx, fy);
  }, { passive: false });

  viewport.addEventListener("pointerdown", e => {
    if (map2DScale > 1.02) {
      isPanning = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });

  window.addEventListener("pointermove", e => {
    if (!isPanning) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    map2DPanX += dx;
    map2DPanY += dy;
    apply2DMapTransform();
  });

  window.addEventListener("pointerup", () => {
    isPanning = false;
  });
}

function selectHex(key) {
  state.selectedHex = key;
  renderRealmMap();
  renderSelectedHexInspector();
}

function moveCompanyToHex(key) {
  state.companyHex = key;
  state.selectedHex = key;
  renderRealmMap();
  renderSelectedHexInspector();
  saveState();
  setBanner(`Company moved to ${formatHexCoord(key)}`);
}

function moveCompanyToSelected() {
  moveCompanyToHex(state.selectedHex);
}

function rollWildernessForSelected() {
  rollWildernessCheck(state.selectedHex);
  switchTab("tab-cheatsheet");
}

function formatHexCoord(key) {
  const [r, c] = key.split(",").map(Number);
  return `${String(c + 1).padStart(2, "0")}.${String(r + 1).padStart(2, "0")}`;
}

function renderSelectedHexInspector() {
  const key = state.selectedHex;
  const hex = state.hexes[key] || { terrain: "Plains", holding: "", landmark: "", mythSlot: "", label: "", river: false, barrier: false, barrierSides: [] };
  document.getElementById("selected-hex-title").textContent = `Hex ${formatHexCoord(key)} ${state.companyHex === key ? "(🛡️ Company)" : ""}`;
  document.getElementById("hex-terrain-edit").value = normalizeTerrain(hex.terrain);
  document.getElementById("hex-holding-edit").value = normalizeHolding(hex.holding);
  document.getElementById("hex-landmark-edit").value = hex.landmark || "";
  document.getElementById("hex-myth-edit").value = hex.mythSlot || "";
  document.getElementById("hex-label-edit").value = hex.label || "";
  document.getElementById("hex-river-edit").checked = !!hex.river;
  document.getElementById("hex-barrier-edit").checked = !!hex.barrier;

  const sidesEditor = document.getElementById("barrier-sides-editor");
  if (sidesEditor) {
    if (hex.barrier) {
      if (!Array.isArray(hex.barrierSides) || hex.barrierSides.length === 0) {
        hex.barrierSides = rollRandomBarrierSides();
      }
      sidesEditor.style.display = "inline-flex";
      const pills = HEX_SIDE_LABELS.map((lbl, idx) => {
        const active = hex.barrierSides.includes(idx);
        return `<button type="button" class="btn btn-sm" style="min-height:26px;padding:0.1rem 0.38rem;font-size:0.72rem;${active ? 'background:#dc2626;color:#fff;border-color:#dc2626;' : ''}" onclick="toggleSelectedBarrierSide(${idx})">${lbl}</button>`;
      }).join("");
      sidesEditor.innerHTML = `<span style="font-size:0.75rem;color:var(--text-muted);">Sides (${hex.barrierSides.length}/6):</span> ${pills} <button type="button" class="btn btn-sm" style="min-height:26px;padding:0.1rem 0.45rem;font-size:0.72rem;" onclick="rerollSelectedBarrierSides()" title="Randomly pick 1–6 blocked sides">🎲 1–6</button>`;
    } else {
      sidesEditor.style.display = "none";
      sidesEditor.innerHTML = "";
    }
  }

  const { activeMyth, dist } = findNearestActiveMyth(key);
  const mythObj = activeMyth ? getMythById(activeMyth.mythId) : null;
  const folkloreEl = document.getElementById("selected-hex-folklore");
  if (mythObj) {
    folkloreEl.innerHTML = `<strong>Nearest Myth:</strong> #${activeMyth.slot} ${mythObj.name} (${dist} hexes away at ${formatHexCoord(activeMyth.hex)}).`;
  } else {
    folkloreEl.innerHTML = "";
  }
}

function toggleSelectedHexBarrier() {
  const key = state.selectedHex;
  if (!state.hexes[key]) state.hexes[key] = {};
  const hex = state.hexes[key];
  const checked = document.getElementById("hex-barrier-edit").checked;
  hex.barrier = checked;
  if (checked && (!Array.isArray(hex.barrierSides) || hex.barrierSides.length === 0)) {
    hex.barrierSides = rollRandomBarrierSides();
  }
  renderRealmMap();
  renderSelectedHexInspector();
  saveState();
}

function toggleSelectedBarrierSide(sideIdx) {
  const key = state.selectedHex;
  const hex = state.hexes[key];
  if (!hex) return;
  if (!Array.isArray(hex.barrierSides)) hex.barrierSides = [];
  if (hex.barrierSides.includes(sideIdx)) {
    hex.barrierSides = hex.barrierSides.filter(s => s !== sideIdx);
    if (hex.barrierSides.length === 0) {
      hex.barrier = false;
    }
  } else {
    hex.barrierSides.push(sideIdx);
    hex.barrierSides.sort((a, b) => a - b);
    hex.barrier = true;
  }
  renderRealmMap();
  renderSelectedHexInspector();
  saveState();
}

function rerollSelectedBarrierSides() {
  const key = state.selectedHex;
  const hex = state.hexes[key];
  if (!hex) return;
  hex.barrier = true;
  hex.barrierSides = rollRandomBarrierSides();
  renderRealmMap();
  renderSelectedHexInspector();
  saveState();
}

function updateSelectedHex() {
  const key = state.selectedHex;
  if (!state.hexes[key]) state.hexes[key] = {};
  const hex = state.hexes[key];
  const prevLandmark = hex.landmark || "";
  hex.terrain = document.getElementById("hex-terrain-edit").value;
  hex.holding = document.getElementById("hex-holding-edit").value;
  hex.landmark = document.getElementById("hex-landmark-edit").value;
  hex.mythSlot = document.getElementById("hex-myth-edit").value;
  hex.label = document.getElementById("hex-label-edit").value;
  hex.river = document.getElementById("hex-river-edit").checked;
  hex.barrier = document.getElementById("hex-barrier-edit").checked;

  // If the user just selected a new Landmark and the notes box was empty, auto-roll a book prompt/Seer
  if (hex.landmark && hex.landmark !== prevLandmark && !hex.label.trim()) {
    hex.label = generateLandmarkNote(hex.landmark);
    document.getElementById("hex-label-edit").value = hex.label;
  }

  if (hex.mythSlot) {
    const slotNum = Number(hex.mythSlot);
    const am = state.activeMyths.find(m => m.slot === slotNum);
    if (am) am.hex = key;
  }

  renderRealmMap();
  renderSelectedHexInspector();
  renderActiveMyths();
  saveState();
}

function renderActiveMyths() {
  const container = document.getElementById("active-myths-container");
  if (!container) return;

  container.innerHTML = state.activeMyths.map((am, idx) => {
    const m = getMythById(am.mythId);
    if (!m) return "";
    const nextOmenIdx = am.omensDone.findIndex(d => !d);
    const safeTitle = m.name.replace(/'/g, "\\'");

    return `
      <div class="active-myth-card ${am.resolved ? 'resolved' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;">
          <div>
            <span class="tag">#${am.slot}</span>
            <strong style="font-size:1rem;margin-left:0.25rem;">${m.name}</strong>
            <span class="page-ref">${m.id} • p.${m.page} • Hex ${formatHexCoord(am.hex)}</span>
          </div>
          <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
            <button class="btn btn-sm" onclick="openPdfModal(${m.page}, '${safeTitle}')">📄 Full Screen Page</button>
            <button class="btn btn-sm" onclick="selectHex('${am.hex}')">Hex</button>
            <button class="btn btn-sm" onclick="rerollActiveMyth(${idx})">Swap</button>
            <button class="btn btn-sm ${am.resolved ? 'btn-primary' : ''}" onclick="toggleMythResolved(${idx})">
              ${am.resolved ? "✓ Resolved" : "Resolve"}
            </button>
          </div>
        </div>

        <div class="grid-2" style="grid-template-columns:1.25fr 1fr;gap:0.75rem;margin-top:0.55rem;align-items:start;">
          <ul class="omen-list" style="margin-top:0;">
            ${m.omens.map((omenTxt, oIdx) => {
              const done = am.omensDone[oIdx];
              const isNext = !done && oIdx === nextOmenIdx;
              return `
                <li class="omen-item ${done ? 'done' : ''} ${isNext ? 'next-up' : ''}" onclick="markOmenDone(${idx}, ${oIdx})">
                  <input type="checkbox" ${done ? 'checked' : ''} onclick="event.stopPropagation();markOmenDone(${idx}, ${oIdx})" />
                  <div><strong>Omen ${oIdx + 1}</strong> ${isNext ? '<span class="tag" style="margin-left:0.3rem;">Next</span>' : ''}</div>
                </li>
              `;
            }).join("")}
          </ul>

          <div class="pdf-page-thumb-wrap" onclick="openPdfModal(${m.page}, '${safeTitle}')" title="Tap to open Page ${m.page} in full screen">
            <img class="pdf-page-thumb" src="${getPageImgSrc(m.page)}" alt="${m.name} (Page ${m.page})" loading="lazy" />
            <span class="pdf-tap-hint">⤢ Tap Full Screen</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function markOmenDone(mythIdx, omenIdx) {
  const am = state.activeMyths[mythIdx];
  if (!am) return;
  am.omensDone[omenIdx] = !am.omensDone[omenIdx];
  renderActiveMyths();
  saveState();
}

function toggleMythResolved(mythIdx) {
  const am = state.activeMyths[mythIdx];
  if (!am) return;
  am.resolved = !am.resolved;
  renderActiveMyths();
  saveState();
}

function rerollActiveMyth(mythIdx) {
  const am = state.activeMyths[mythIdx];
  if (!am) return;
  const randomMyth = window.MB_DATA.myths[Math.floor(Math.random() * 72)];
  am.mythId = randomMyth.id;
  am.omensDone = [false, false, false, false, false, false];
  am.resolved = false;
  if (state.hexes[am.hex]) state.hexes[am.hex].label = randomMyth.name;
  renderRealmMap();
  renderActiveMyths();
  saveState();
}

function exportRealmJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mythic-bastionland-day${state.day}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importRealmJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      state = Object.assign(state, imported);
      syncHeaderUI();
      renderRealmMap();
      renderSelectedHexInspector();
      renderActiveMyths();
      renderCompanyRoster();
      saveState();
      setBanner("Imported JSON");
    } catch (err) {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
}

// ==========================================
// TAB 3: COMPANY ROSTER & 72 KNIGHTS/SEERS
// ==========================================
const KNIGHT_PROMPT_KEYS = ["Person", "Name", "Characteristic", "Object", "Beast", "State", "Theme"];

// Roll an independent d6 + d12 (1-1 to 6-12) to select one of the 7 footer prompts from the 72 Knight pages
function rollKnightPromptSingle(promptKey) {
  const d6 = rollDie(6);
  const d12 = rollDie(12);
  const id = `${d6}-${d12}`;
  const k = getKnightById(id) || window.MB_DATA.knights[Math.floor(Math.random() * 72)];
  const val = (k && k.prompts && k.prompts[promptKey]) ? k.prompts[promptKey] : promptKey;
  return { d6, d12, id: k ? k.id : id, page: k ? k.page : 28, val };
}

function createKnightEntry(startMode, forcedKnightObj) {
  // Roll d6+d12 for the Knight archetype (unless a specific Knight was clicked)
  const kRollId = `${rollDie(6)}-${rollDie(12)}`;
  const kObj = forcedKnightObj || getKnightById(kRollId) || window.MB_DATA.knights[Math.floor(Math.random() * 72)];
  // Roll an independent d6+d12 across the 72 Knight pages to choose the Knight's Name
  const nameRoll = rollKnightPromptSingle("Name");

  let vig, cla, spi, gd, glory = 0;
  if (startMode === "Courtier") {
    vig = rollDie(12) + 6;
    cla = rollDie(12) + 6;
    spi = rollDie(12) + 6;
    gd = rollDie(6) + rollDie(6);
    glory = 3;
  } else if (startMode === "Ruler") {
    vig = rollDie(12) + 6;
    cla = rollDie(12) + 6;
    spi = rollDie(12) + 6;
    gd = rollDie(6) + 6;
    glory = 6;
  } else {
    vig = rollDie(12) + rollDie(6);
    cla = rollDie(12) + rollDie(6);
    spi = rollDie(12) + rollDie(6);
    gd = rollDie(6);
    glory = 0;
  }

  return {
    uid: Date.now() + Math.floor(Math.random() * 10000),
    playerName: nameRoll.val,
    nameRollId: nameRoll.id,
    knightId: kObj.id,
    title: kObj.name,
    page: kObj.page,
    vig, maxVig: vig,
    cla, maxCla: cla,
    spi, maxSpi: spi,
    gd, maxGd: gd,
    armour: 2,
    glory,
    fatigued: false,
    exhausted: false,
    wounded: false
  };
}

function rerollRosterKnightName(idx) {
  if (!state.company[idx]) return;
  const nameRoll = rollKnightPromptSingle("Name");
  state.company[idx].playerName = nameRoll.val;
  state.company[idx].nameRollId = nameRoll.id;
  renderCompanyRoster();
  saveState();
  setBanner(`Name Roll [${nameRoll.id}] (p.${nameRoll.page}) = <strong>${nameRoll.val}</strong>`);
}

function rollNewPlayerKnight(forcedId) {
  const startMode = document.getElementById("new-knight-start").value || "Wanderer";
  const forcedObj = forcedId ? getKnightById(forcedId) : null;
  const entry = createKnightEntry(startMode, forcedObj);
  state.company.push(entry);
  renderCompanyRoster();
  saveState();
  setBanner(`Added ${entry.title}`);
}

function restAllCompany() {
  state.company.forEach(k => {
    k.gd = k.maxGd;
    k.fatigued = false;
  });
  renderCompanyRoster();
  saveState();
  setBanner("Restored Guard & cleared Fatigued");
}

function updateRosterField(idx, field, val) {
  if (!state.company[idx]) return;
  state.company[idx][field] = val;
  saveState();
}

function toggleRosterStatus(idx, field) {
  if (!state.company[idx]) return;
  state.company[idx][field] = !state.company[idx][field];
  renderCompanyRoster();
  saveState();
}

function removeRosterKnight(idx) {
  state.company.splice(idx, 1);
  renderCompanyRoster();
  saveState();
}

function renderCompanyRoster() {
  const grid = document.getElementById("company-roster-grid");
  if (!grid) return;

  if (!state.company.length) {
    grid.innerHTML = `<div style="color:var(--text-muted);font-size:0.9rem;">No Knights in the Company yet. Tap "+ Roll Knight" above.</div>`;
    return;
  }

  grid.innerHTML = state.company.map((k, idx) => {
    const safeTitle = (k.title || "Knight").replace(/'/g, "\\'");
    return `
      <div class="roster-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.35rem;">
          <div style="display:flex;align-items:center;gap:0.25rem;flex:1;">
            <input type="text" value="${k.playerName}" oninput="updateRosterField(${idx}, 'playerName', this.value)" style="font-weight:700;width:100%;" />
            <button class="btn btn-sm" onclick="rerollRosterKnightName(${idx})" title="Roll d6+d12 on Book Name Table" style="padding:0.25rem 0.45rem;">🎲</button>
          </div>
          <span class="tag">${k.title} (p.${k.page})</span>
          <button class="btn btn-sm btn-danger" onclick="removeRosterKnight(${idx})">✕</button>
        </div>

        <div class="virtue-boxes">
          <div class="virtue-box">
            <label>VIG (${k.maxVig})</label>
            <input type="number" value="${k.vig}" min="0" max="19" oninput="updateRosterField(${idx}, 'vig', Number(this.value))" />
          </div>
          <div class="virtue-box">
            <label>CLA (${k.maxCla})</label>
            <input type="number" value="${k.cla}" min="0" max="19" oninput="updateRosterField(${idx}, 'cla', Number(this.value))" />
          </div>
          <div class="virtue-box">
            <label>SPI (${k.maxSpi})</label>
            <input type="number" value="${k.spi}" min="0" max="19" oninput="updateRosterField(${idx}, 'spi', Number(this.value))" />
          </div>
          <div class="virtue-box">
            <label>GD (${k.maxGd})</label>
            <input type="number" value="${k.gd}" min="0" max="30" oninput="updateRosterField(${idx}, 'gd', Number(this.value))" />
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.84rem;">
          <label>Armour: <input type="number" value="${k.armour}" min="0" max="6" style="width:58px;" oninput="updateRosterField(${idx}, 'armour', Number(this.value))" /></label>
          <label>Glory: <input type="number" value="${k.glory}" min="0" max="20" style="width:62px;" oninput="updateRosterField(${idx}, 'glory', Number(this.value))" /></label>
        </div>

        <div class="status-pills">
          <span class="status-pill ${k.fatigued ? 'active-warn' : ''}" onclick="toggleRosterStatus(${idx}, 'fatigued')">Fatigued</span>
          <span class="status-pill ${k.exhausted ? 'active-warn' : ''}" onclick="toggleRosterStatus(${idx}, 'exhausted')">Exhausted</span>
          <span class="status-pill ${k.wounded ? 'active-danger' : ''}" onclick="toggleRosterStatus(${idx}, 'wounded')">Mortal Wound</span>
        </div>

        <!-- Appended PDF Page with Full-Screen Modal Option -->
        <div class="pdf-page-thumb-wrap" style="margin-top:0.35rem;" onclick="openPdfModal(${k.page}, '${safeTitle}')" title="Tap to view Page ${k.page} in full screen">
          <img class="pdf-page-thumb" src="${getPageImgSrc(k.page)}" alt="${k.title} (Page ${k.page})" loading="lazy" />
          <span class="pdf-tap-hint">⤢ Tap Full Screen (p.${k.page})</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderKnightsCompendium(highlightId) {
  const grid = document.getElementById("knights-compendium-grid");
  if (!grid) return;
  const q = (document.getElementById("knight-search-input").value || "").toLowerCase().trim();

  const list = window.MB_DATA.knights.filter(k => {
    if (highlightId && k.id === highlightId) return true;
    if (!q) return true;
    const blob = `${k.id} ${k.name} ${k.property.join(" ")} ${k.ability.name} ${k.ability.text} ${k.passion.name} ${k.passion.text} ${k.seer.name} ${k.seer.bullets.join(" ")}`.toLowerCase();
    return blob.includes(q);
  });

  grid.innerHTML = list.map(k => {
    const safeTitle = `${k.name} & ${k.seer.name}`.replace(/'/g, "\\'");
    return `
      <div class="compendium-card" id="knight-card-${k.id}">
        <div class="compendium-header">
          <div>
            <span class="roll-badge">${k.id}</span>
            <strong class="compendium-title" style="margin-left:0.3rem;">${k.name}</strong>
          </div>
          <div style="display:flex;gap:0.35rem;align-items:center;">
            <span class="page-ref">p.${k.page}</span>
            <button class="btn btn-sm btn-primary" onclick="rollNewPlayerKnight('${k.id}')">+ Roster</button>
          </div>
        </div>
        <div class="pdf-page-thumb-wrap" onclick="openPdfModal(${k.page}, '${safeTitle}')">
          <img class="pdf-page-thumb" src="${getPageImgSrc(k.page)}" alt="${k.name} (Page ${k.page})" loading="lazy" />
          <span class="pdf-tap-hint">⤢ Full Screen</span>
        </div>
      </div>
    `;
  }).join("");
}

function rollRandomKnightLookup() {
  const d6 = rollDie(6);
  const d12 = rollDie(12);
  const id = `${d6}-${d12}`;
  const k = getKnightById(id);
  document.getElementById("knight-search-input").value = id;
  renderKnightsCompendium(id);
  setBanner(`Rolled [${id}] ${k.name}`);
  openPdfModal(k.page, `[${k.id}] ${k.name}`);
}

// ==========================================
// TAB 4: ALL 72 MYTHS & THE CITY QUEST
// ==========================================
function initCityQuestPanel() {
  const cq = window.MB_DATA.cityQuest;
  if (!cq) return;
  document.getElementById("city-quest-rules").textContent = cq.rules;
}

function rollCityQuestOmen() {
  const seenInput = document.getElementById("city-omens-seen");
  const seen = Number(seenInput.value || 0);
  const d12 = rollDie(12);
  const idx = Math.min(24, d12 + seen);
  const omenText = window.MB_DATA.cityQuest.omens[idx - 1];
  seenInput.value = seen + 1;
  const box = document.getElementById("city-quest-roll-box");
  box.style.display = "block";
  box.innerHTML = `
    <div class="roll-result-title">
      <span>City Quest Omen #${idx} (d12=${d12} + ${seen} seen)</span>
      ${idx >= 18 ? `<span class="tag">Omen 18+ Reached: City Quest Ends</span>` : ""}
    </div>
    <p>${omenText}</p>
  `;
}

function renderMythsCompendium() {
  const grid = document.getElementById("myths-compendium-grid");
  if (!grid) return;
  const q = (document.getElementById("myth-search-input").value || "").toLowerCase().trim();

  const list = window.MB_DATA.myths.filter(m => {
    if (!q) return true;
    const blob = `${m.id} ${m.name} ${m.omens.join(" ")} ${m.cast} ${Object.values(m.landmarks || {}).join(" ")}`.toLowerCase();
    return blob.includes(q);
  });

  grid.innerHTML = list.map(m => {
    const safeTitle = m.name.replace(/'/g, "\\'");
    return `
      <div class="compendium-card">
        <div class="compendium-header">
          <div>
            <span class="roll-badge">${m.id}</span>
            <strong class="compendium-title" style="margin-left:0.3rem;">${m.name}</strong>
          </div>
          <div style="display:flex;gap:0.35rem;align-items:center;">
            <span class="page-ref">p.${m.page}</span>
            <button class="btn btn-sm" onclick="assignMythToActiveSlot('${m.id}')">Use in Realm</button>
          </div>
        </div>
        <div class="pdf-page-thumb-wrap" onclick="openPdfModal(${m.page}, '${safeTitle}')">
          <img class="pdf-page-thumb" src="${getPageImgSrc(m.page)}" alt="${m.name} (Page ${m.page})" loading="lazy" />
          <span class="pdf-tap-hint">⤢ Full Screen</span>
        </div>
      </div>
    `;
  }).join("");
}

function rollRandomMythLookup() {
  const d6 = rollDie(6);
  const d12 = rollDie(12);
  const id = `${d6}-${d12}`;
  const m = getMythById(id);
  document.getElementById("myth-search-input").value = id;
  renderMythsCompendium();
  setBanner(`Rolled [${id}] ${m.name}`);
  openPdfModal(m.page, `[${m.id}] ${m.name}`);
}

function assignMythToActiveSlot(mythId) {
  const slotStr = prompt("Assign this Myth to which Active Realm Myth slot (1 to 6)?", "1");
  const slot = Number(slotStr);
  if (slot >= 1 && slot <= 6) {
    const am = state.activeMyths[slot - 1];
    if (am) {
      am.mythId = mythId;
      am.omensDone = [false, false, false, false, false, false];
      am.resolved = false;
      const mObj = getMythById(mythId);
      if (state.hexes[am.hex] && mObj) state.hexes[am.hex].label = mObj.name;
      renderRealmMap();
      renderActiveMyths();
      saveState();
      setBanner(`Assigned ${mObj.name} to Slot #${slot}`);
    }
  }
}

// ==========================================
// TAB 5: SPARK TABLES (2d12) & SITE BUILDER
// ==========================================
function rollSparkSingle(cat, tableName) {
  const tbl = window.MB_DATA.sparkTables[cat][tableName];
  const r1 = rollDie(12);
  const r2 = rollDie(12);
  const w1 = tbl.rows[r1 - 1][0];
  const w2 = tbl.rows[r2 - 1][1];
  return { r1, r2, w1, w2, combined: `${w1} ${w2}` };
}

function triggerSparkCardRoll(cat, tableName) {
  const res = rollSparkSingle(cat, tableName);
  const el = document.getElementById(`spark-res-${cat}-${tableName}`);
  if (el) {
    el.innerHTML = `[${res.r1}, ${res.r2}] ➔ <strong>${res.combined}</strong>`;
  }
  setBanner(`${tableName}: <strong>${res.combined}</strong>`);
}

function triggerKnightPromptCardRoll(promptKey) {
  const res = rollKnightPromptSingle(promptKey);
  const el = document.getElementById(`spark-res-Knight-${promptKey}`);
  if (el) {
    el.innerHTML = `[${res.id}] (p.${res.page}) ➔ <strong>${res.val}</strong>`;
  }
  setBanner(`Knight ${promptKey} [${res.id}]: <strong>${res.val}</strong>`);
}

function filterSparkCategory(cat) {
  sparkCategoryFilter = cat;
  renderSparkTables();
}

function renderSparkTables() {
  const grid = document.getElementById("spark-tables-grid");
  if (!grid) return;

  let html = "";
  Object.entries(window.MB_DATA.sparkTables).forEach(([cat, tables]) => {
    if (sparkCategoryFilter !== "All" && sparkCategoryFilter !== cat) return;
    Object.entries(tables).forEach(([tName, tData]) => {
      const initRoll = rollSparkSingle(cat, tName);
      html += `
        <div class="card" style="margin-bottom:0;background:var(--bg-subtle);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.45rem;">
            <div>
              <span class="tag" style="background:var(--bg-surface);">${cat}</span>
              <strong style="margin-left:0.25rem;">${tName}</strong>
            </div>
            <button class="btn btn-sm btn-primary" onclick="triggerSparkCardRoll('${cat}','${tName}')">Roll 2d12</button>
          </div>
          <div id="spark-res-${cat}-${tName}" style="background:var(--bg-surface);padding:0.5rem 0.65rem;border-radius:6px;border:1px solid var(--border);font-size:0.9rem;margin-bottom:0.4rem;">
            [${initRoll.r1}, ${initRoll.r2}] ➔ <strong>${initRoll.combined}</strong>
          </div>
          <details style="font-size:0.78rem;">
            <summary style="cursor:pointer;color:var(--text-secondary);">Table (${tData.col1} + ${tData.col2})</summary>
            <table class="ref-table" style="font-size:0.76rem;margin-top:0.25rem;">
              <thead><tr><th>d12</th><th>${tData.col1}</th><th>${tData.col2}</th></tr></thead>
              <tbody>
                ${tData.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("")}
              </tbody>
            </table>
          </details>
        </div>
      `;
    });
  });

  // Render the 7 Knight Page Prompt Tables (d6+d12: Person, Name, Characteristic, Object, Beast, State, Theme)
  if (sparkCategoryFilter === "All" || sparkCategoryFilter === "Knight") {
    KNIGHT_PROMPT_KEYS.forEach(pKey => {
      const initRoll = rollKnightPromptSingle(pKey);
      const rowsHtml = window.MB_DATA.knights.map(k => {
        const val = (k.prompts && k.prompts[pKey]) ? k.prompts[pKey] : "";
        return `<tr><td><strong>${k.id}</strong></td><td>${val}</td><td style="color:var(--text-muted);">p.${k.page}</td></tr>`;
      }).join("");

      html += `
        <div class="card" style="margin-bottom:0;background:var(--bg-subtle);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.45rem;">
            <div>
              <span class="tag" style="background:var(--bg-surface);">Knight</span>
              <strong style="margin-left:0.25rem;">${pKey}</strong>
            </div>
            <button class="btn btn-sm btn-primary" onclick="triggerKnightPromptCardRoll('${pKey}')">Roll d6+d12</button>
          </div>
          <div id="spark-res-Knight-${pKey}" style="background:var(--bg-surface);padding:0.5rem 0.65rem;border-radius:6px;border:1px solid var(--border);font-size:0.9rem;margin-bottom:0.4rem;">
            [${initRoll.id}] (p.${initRoll.page}) ➔ <strong>${initRoll.val}</strong>
          </div>
          <details style="font-size:0.78rem;">
            <summary style="cursor:pointer;color:var(--text-secondary);">All 72 Entries (d6+d12 Book Table)</summary>
            <div style="max-height:240px;overflow-y:auto;margin-top:0.25rem;">
              <table class="ref-table" style="font-size:0.76rem;">
                <thead><tr><th>d6+d12</th><th>${pKey}</th><th>Page</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </div>
          </details>
        </div>
      `;
    });
  }

  grid.innerHTML = html;
}

function rollSparkCombo(type) {
  const box = document.getElementById("spark-combo-output");
  box.style.display = "block";

  if (type === "npc") {
    box.innerHTML = `
      <div class="roll-result-title"><span>Instant NPC</span><button class="btn btn-sm" onclick="rollSparkCombo('npc')">Reroll</button></div>
      <div class="grid-3" style="font-size:0.88rem;gap:0.5rem;margin-top:0.35rem;">
        <div><strong>Appearance:</strong> ${rollSparkSingle("People", "Appearance").combined}</div>
        <div><strong>Voice:</strong> ${rollSparkSingle("People", "Voice").combined}</div>
        <div><strong>Personality:</strong> ${rollSparkSingle("People", "Personality").combined}</div>
        <div><strong>Desire:</strong> ${rollSparkSingle("People", "Desire").combined}</div>
        <div><strong>Task:</strong> ${rollSparkSingle("People", "Task").combined}</div>
        <div><strong>Heraldry:</strong> ${rollSparkSingle("People", "Heraldry").combined}</div>
      </div>
    `;
  } else if (type === "holding") {
    box.innerHTML = `
      <div class="roll-result-title"><span>Instant Holding</span><button class="btn btn-sm" onclick="rollSparkCombo('holding')">Reroll</button></div>
      <div class="grid-3" style="font-size:0.88rem;gap:0.5rem;margin-top:0.35rem;">
        <div><strong>Holding:</strong> ${rollSparkSingle("Civilisation", "Holding").combined}</div>
        <div><strong>Bailey:</strong> ${rollSparkSingle("Civilisation", "Bailey").combined}</div>
        <div><strong>Keep:</strong> ${rollSparkSingle("Civilisation", "Keep").combined}</div>
        <div><strong>Goods:</strong> ${rollSparkSingle("Civilisation", "Goods").combined}</div>
        <div><strong>Drama:</strong> ${rollSparkSingle("Civilisation", "Drama").combined}</div>
        <div><strong>Woe:</strong> ${rollSparkSingle("Civilisation", "Woe").combined}</div>
      </div>
    `;
  } else if (type === "hex") {
    box.innerHTML = `
      <div class="roll-result-title"><span>Wilderness Hex</span><button class="btn btn-sm" onclick="rollSparkCombo('hex')">Reroll</button></div>
      <div class="grid-3" style="font-size:0.88rem;gap:0.5rem;margin-top:0.35rem;">
        <div><strong>Land:</strong> ${rollSparkSingle("Nature", "Land").combined}</div>
        <div><strong>Sky:</strong> ${rollSparkSingle("Nature", "Sky").combined}</div>
        <div><strong>Weather:</strong> ${rollSparkSingle("Nature", "Weather").combined}</div>
        <div><strong>Flora:</strong> ${rollSparkSingle("Nature", "Flora").combined}</div>
        <div><strong>Fauna:</strong> ${rollSparkSingle("Nature", "Fauna").combined}</div>
        <div><strong>Feature:</strong> ${rollSparkSingle("Nature", "Feature").combined}</div>
      </div>
    `;
  } else if (type === "battle") {
    box.innerHTML = `
      <div class="roll-result-title"><span>Battle / Duel</span><button class="btn btn-sm" onclick="rollSparkCombo('battle')">Reroll</button></div>
      <div class="grid-3" style="font-size:0.88rem;gap:0.5rem;margin-top:0.35rem;">
        <div><strong>Battlefield:</strong> ${rollSparkSingle("Combat", "Battlefield").combined}</div>
        <div><strong>Forces:</strong> ${rollSparkSingle("Combat", "Soldier").combined}</div>
        <div><strong>Deployment:</strong> ${rollSparkSingle("Combat", "Deployment").combined}</div>
        <div><strong>Strategy:</strong> ${rollSparkSingle("Combat", "Strategy").combined}</div>
        <div><strong>Event:</strong> ${rollSparkSingle("Combat", "Event").combined}</div>
        <div><strong>Duel:</strong> ${rollSparkSingle("Combat", "Duel").combined}</div>
      </div>
    `;
  }
}

// ==========================================
// HEX SITE / POINTCRAWL GENERATOR (Page 15)
// ==========================================
function generatePointcrawlSite() {
  const container = document.getElementById("pointcrawl-container");
  if (!container) return;

  const rawPositions = [
    { x: 180, y: 40 },
    { x: 300, y: 105 },
    { x: 300, y: 235 },
    { x: 180, y: 300 },
    { x: 60, y: 235 },
    { x: 60, y: 105 },
    { x: 180, y: 170 }
  ];
  const erasedIdx = Math.floor(Math.random() * 7);
  const nodes = rawPositions.filter((_, idx) => idx !== erasedIdx);

  const nodeTypes = [
    { type: "Feature", symbol: "●" },
    { type: "Feature", symbol: "●" },
    { type: "Feature", symbol: "●" },
    { type: "Danger", symbol: "▲" },
    { type: "Danger", symbol: "▲" },
    { type: "Treasure", symbol: "◆" }
  ].sort(() => Math.random() - 0.5);

  const nodeDetails = nodes.map((pos, i) => {
    const nt = nodeTypes[i];
    let prompt = "";
    if (nt.type === "Feature") {
      prompt = `${rollSparkSingle("Nature", "Feature").combined} (${rollSparkSingle("Nature", "Wonder").combined})`;
    } else if (nt.type === "Danger") {
      prompt = `${rollSparkSingle("Combat", "Soldier").combined} / ${rollSparkSingle("Civilisation", "Woe").combined}`;
    } else {
      prompt = `${rollSparkSingle("Civilisation", "Luxuries").combined} & ${rollSparkSingle("Combat", "Weapon").combined}`;
    }
    return {
      num: i + 1,
      x: pos.x,
      y: pos.y,
      type: nt.type,
      symbol: nt.symbol,
      prompt
    };
  });

  const routeTypes = [
    { label: "Open Route", dash: "" },
    { label: "Open Route", dash: "" },
    { label: "Open Route", dash: "" },
    { label: "Closed / Blocked (✕)", dash: "8,5" },
    { label: "Closed / Blocked (✕)", dash: "8,5" },
    { label: "Hidden Route (•••)", dash: "2,5" }
  ].sort(() => Math.random() - 0.5);

  const edges = [];
  for (let i = 0; i < 6; i++) {
    edges.push({ a: nodeDetails[i], b: nodeDetails[(i + 1) % 6], rt: routeTypes[i] });
  }

  const linesSvg = edges.map(e => `
    <line x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}" style="stroke:var(--text-secondary)" stroke-width="2.5" ${e.rt.dash ? `stroke-dasharray="${e.rt.dash}"` : ""} />
  `).join("");

  const nodesSvg = nodeDetails.map(n => `
    <circle cx="${n.x}" cy="${n.y}" r="22" style="fill:var(--bg-surface);stroke:var(--text-primary)" stroke-width="2" />
    <text x="${n.x}" y="${n.y + 5}" text-anchor="middle" style="fill:var(--text-primary)" font-size="13" font-weight="700">${n.num}${n.symbol}</text>
  `).join("");

  container.innerHTML = `
    <div style="text-align:center;background:var(--bg-subtle);padding:0.75rem;border-radius:8px;">
      <svg viewBox="0 0 360 340" style="max-width:320px;width:100%;height:auto;">
        ${linesSvg}
        ${nodesSvg}
      </svg>
      <div style="font-size:0.78rem;color:var(--text-secondary);">
        Solid = Open • Dashed = Closed • Dotted = Hidden
      </div>
    </div>
    <div>
      <ul style="list-style:none;font-size:0.86rem;">
        ${nodeDetails.map((n, idx) => `
          <li style="padding:0.45rem 0;border-bottom:1px solid var(--border);">
            <strong>${n.num}. ${n.symbol} ${n.type}:</strong> ${n.prompt}
            <div style="font-size:0.78rem;color:var(--text-muted);">To Point ${(idx + 1) % 6 + 1}: ${edges[idx].rt.label}</div>
          </li>
        `).join("")}
      </ul>
    </div>
  `;
}

// ==========================================
// INITIALIZATION
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
  const hadSaved = loadState();
  if (!state.theme) state.theme = "light";
  if (!state.pageBg) state.pageBg = "nobg";
  if (!hadSaved || !Object.keys(state.hexes).length) {
    generateStarterRealm();
  } else {
    renderRealmMap();
    renderSelectedHexInspector();
    renderActiveMyths();
  }

  if (!state.company || !state.company.length) {
    state.company = [
      createKnightEntry("Wanderer", window.MB_DATA.knights[0]),
      createKnightEntry("Wanderer", window.MB_DATA.knights[9])
    ];
    saveState();
  }

  syncHeaderUI();
  setup2DMapZoomPan();
  updateCombatPoolSummary();
  rollCombatPool();
  renderCompanyRoster();
  renderKnightsCompendium();
  initCityQuestPanel();
  renderMythsCompendium();
  renderSparkTables();
  generatePointcrawlSite();

  // Sync shared state between Laptop and iPad via server.py
  syncFromServerState();
  window.addEventListener("focus", syncFromServerState);
});
