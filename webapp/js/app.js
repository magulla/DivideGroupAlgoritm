import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  collection,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import {
  QUARTERFINALS,
  SEMIFINALS,
  THIRD_PLACE,
  FINAL,
  QUARTERFINAL_TEAMS,
  SCORING,
  PICKS_FREEZE,
  BET_AMOUNT,
  isLocked,
  picksFrozen,
} from './matches.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const RESULTS_DOC = doc(db, 'tournament', 'results');
const PICKS_COL = collection(db, 'picks');

let currentUser = null; // { email, name }
let latestResults = {};
let latestPicks = {}; // by picksId

const EMPTY_RESULTS = {
  qf1: null, qf2: null, qf3: null, qf4: null,
  sf1: null, sf2: null,
  third: null, final: null,
};

function emailToId(email) {
  return email.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '');
}

function loadSession() {
  const raw = localStorage.getItem('wc-quiz-user');
  return raw ? JSON.parse(raw) : null;
}

function saveSession(user) {
  localStorage.setItem('wc-quiz-user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('wc-quiz-user');
}

function teamButton(matchId, side, teamName, currentPick, locked) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'team-btn' + (currentPick === teamName ? ' selected' : '');
  btn.textContent = teamName;
  btn.disabled = locked || teamName.startsWith('Winner of') || teamName.startsWith('Loser of');
  btn.addEventListener('click', () => {
    document.querySelectorAll(`[data-match="${matchId}"] .team-btn`).forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    draftPicks[matchId] = teamName;
  });
  return btn;
}

let draftPicks = {};

function renderMatchRow(container, matchId, label, teamA, teamB, kickoffIso, venue, currentPick) {
  const locked = isLocked(kickoffIso) || picksFrozen();
  const row = document.createElement('div');
  row.className = 'match-row' + (locked ? ' locked' : '');
  row.dataset.match = matchId;

  const meta = document.createElement('div');
  meta.className = 'match-meta';
  const kickoffDate = new Date(kickoffIso);
  meta.innerHTML = `<strong>${label}</strong><span>${venue} · ${kickoffDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}${locked ? ' · <em>locked</em>' : ''}</span>`;
  row.appendChild(meta);

  const buttons = document.createElement('div');
  buttons.className = 'team-buttons';
  buttons.appendChild(teamButton(matchId, 'A', teamA, currentPick, locked));
  const vs = document.createElement('span');
  vs.className = 'vs';
  vs.textContent = 'vs';
  buttons.appendChild(vs);
  buttons.appendChild(teamButton(matchId, 'B', teamB, currentPick, locked));
  row.appendChild(buttons);

  container.appendChild(row);
}

// Third-Place/Final let you pick any of the 8 quarterfinalists, independent
// of how earlier rounds turn out — a dropdown fits that better than a
// two-team head-to-head button pair.
function renderMatchSelect(container, matchId, label, kickoffIso, venue, options, currentPick) {
  const locked = isLocked(kickoffIso) || picksFrozen();
  const row = document.createElement('div');
  row.className = 'match-row' + (locked ? ' locked' : '');
  row.dataset.match = matchId;

  const meta = document.createElement('div');
  meta.className = 'match-meta';
  const kickoffDate = new Date(kickoffIso);
  meta.innerHTML = `<strong>${label}</strong><span>${venue} · ${kickoffDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}${locked ? ' · <em>locked</em>' : ''}</span>`;
  row.appendChild(meta);

  const select = document.createElement('select');
  select.disabled = locked;
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '-- choose a team --';
  select.appendChild(blank);
  options.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    if (currentPick === t) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => {
    draftPicks[matchId] = select.value;
  });
  row.appendChild(select);

  container.appendChild(row);
}

// Semifinals share one pool of 8 teams across 2 matches, so the same team
// can't be picked to win both — picking a team in one match removes it from
// the other's options.
function renderSemifinalSelects(container) {
  const selects = {};

  function refreshOptions() {
    SEMIFINALS.forEach((sf) => {
      const select = selects[sf.id];
      const currentVal = draftPicks[sf.id] || '';
      const takenBySibling = SEMIFINALS
        .filter((other) => other.id !== sf.id)
        .map((other) => draftPicks[other.id])
        .filter(Boolean);
      select.innerHTML = '';
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '-- choose a team --';
      select.appendChild(blank);
      QUARTERFINAL_TEAMS.forEach((t) => {
        if (takenBySibling.includes(t) && t !== currentVal) return;
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        if (currentVal === t) opt.selected = true;
        select.appendChild(opt);
      });
    });
  }

  SEMIFINALS.forEach((sf) => {
    const locked = isLocked(sf.kickoff) || picksFrozen();
    const row = document.createElement('div');
    row.className = 'match-row' + (locked ? ' locked' : '');
    row.dataset.match = sf.id;

    const meta = document.createElement('div');
    meta.className = 'match-meta';
    const kickoffDate = new Date(sf.kickoff);
    meta.innerHTML = `<strong>${sf.label}</strong><span>${sf.venue} · ${kickoffDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}${locked ? ' · <em>locked</em>' : ''}</span>`;
    row.appendChild(meta);

    const select = document.createElement('select');
    select.disabled = locked;
    select.addEventListener('change', () => {
      draftPicks[sf.id] = select.value;
      refreshOptions();
    });
    row.appendChild(select);
    selects[sf.id] = select;

    container.appendChild(row);
  });

  refreshOptions();
}

// Existing picks saved before this feature existed have no `bet` field —
// treat that as already in the pool rather than silently dropping them.
function isInPool(entry) {
  return entry.bet !== false;
}

async function saveBet(inPool) {
  const status = document.getElementById('save-status');
  try {
    await setDoc(doc(db, 'picks', emailToId(currentUser.email)), {
      email: currentUser.email,
      name: currentUser.name,
      picks: draftPicks,
      bet: inPool,
    }, { merge: true });
  } catch (err) {
    console.error(err);
    if (status) status.textContent = 'Error saving — check console.';
  }
}

// New bets can't be placed after the freeze, but removing one is always
// allowed — so the checkbox stays interactive even once picks are frozen,
// it just refuses to flip from unchecked to checked.
function renderBetCheckbox(container, existing) {
  const wasIn = isInPool(existing);
  const section = document.createElement('section');
  const row = document.createElement('div');
  row.className = 'match-row';

  const label = document.createElement('label');
  label.style.display = 'flex';
  label.style.alignItems = 'center';
  label.style.gap = '0.6rem';
  label.style.marginBottom = '0';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = wasIn;
  checkbox.style.width = 'auto';

  const text = document.createElement('span');
  text.textContent = `I'm in for the $${BET_AMOUNT} pool`;

  label.appendChild(checkbox);
  label.appendChild(text);
  row.appendChild(label);

  checkbox.addEventListener('change', () => {
    if (checkbox.checked && picksFrozen()) {
      checkbox.checked = false;
      const status = document.getElementById('save-status');
      if (status) status.textContent = 'Betting closed — no new bets after the freeze.';
      return;
    }
    saveBet(checkbox.checked);
  });

  section.appendChild(row);
  container.appendChild(section);
}

function renderPicksForm() {
  const container = document.getElementById('picks-form');
  container.innerHTML = '';
  const results = { ...EMPTY_RESULTS, ...latestResults };
  const myId = emailToId(currentUser.email);
  const existing = (latestPicks[myId] && latestPicks[myId].picks) || {};
  draftPicks = { ...existing };

  const frozen = picksFrozen();
  if (frozen) {
    const banner = document.createElement('p');
    banner.className = 'hint';
    banner.innerHTML = `<strong>Picks are frozen</strong> as of ${new Date(PICKS_FREEZE).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} — no more changes allowed.`;
    container.appendChild(banner);
  }

  renderBetCheckbox(container, existing);

  const qfSection = document.createElement('section');
  qfSection.innerHTML = '<h3>Quarterfinals <span class="pts">1 pt each</span></h3>';
  container.appendChild(qfSection);
  QUARTERFINALS.forEach((m) => {
    renderMatchRow(qfSection, m.id, m.label, m.teamA, m.teamB, m.kickoff, m.venue, existing[m.id]);
  });

  const sfSection = document.createElement('section');
  sfSection.innerHTML = '<h3>Semifinals <span class="pts">2 pts each</span></h3><p class="hint">Pick any of the 8 quarterfinalists to win — the same team can\'t win both semifinals.</p>';
  container.appendChild(sfSection);
  renderSemifinalSelects(sfSection);

  const thirdSection = document.createElement('section');
  thirdSection.innerHTML = '<h3>Third-Place Match <span class="pts">3 pts</span></h3>';
  container.appendChild(thirdSection);
  renderMatchSelect(thirdSection, THIRD_PLACE.id, THIRD_PLACE.label, THIRD_PLACE.kickoff, THIRD_PLACE.venue, QUARTERFINAL_TEAMS, existing[THIRD_PLACE.id]);

  const finalSection = document.createElement('section');
  finalSection.innerHTML = '<h3>Final <span class="pts">3 pts</span></h3>';
  container.appendChild(finalSection);
  renderMatchSelect(finalSection, FINAL.id, FINAL.label, FINAL.kickoff, FINAL.venue, QUARTERFINAL_TEAMS, existing[FINAL.id]);

  const saveBar = document.createElement('div');
  saveBar.className = 'save-bar';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save My Picks';
  saveBtn.className = 'primary';
  saveBtn.disabled = frozen;
  saveBtn.addEventListener('click', savePicks);
  saveBar.appendChild(saveBtn);
  const status = document.createElement('span');
  status.id = 'save-status';
  saveBar.appendChild(status);
  container.appendChild(saveBar);
}

async function savePicks() {
  const status = document.getElementById('save-status');
  if (picksFrozen()) {
    status.textContent = 'Picks are frozen — no more changes allowed.';
    return;
  }
  status.textContent = 'Saving...';
  try {
    const id = emailToId(currentUser.email);
    await setDoc(doc(db, 'picks', id), {
      email: currentUser.email,
      name: currentUser.name,
      picks: draftPicks,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    status.textContent = 'Saved ✓';
    setTimeout(() => { status.textContent = ''; }, 2500);
  } catch (err) {
    console.error(err);
    status.textContent = 'Error saving — check console.';
  }
}

function computePoints(picks, results) {
  let points = 0;
  const breakdown = [];
  QUARTERFINALS.forEach((m) => {
    if (results[m.id] && picks[m.id] === results[m.id]) {
      points += SCORING.qf;
      breakdown.push(`${m.label}: +${SCORING.qf}`);
    }
  });
  SEMIFINALS.forEach((sf) => {
    if (results[sf.id] && picks[sf.id] === results[sf.id]) {
      points += SCORING.sf;
      breakdown.push(`${sf.label}: +${SCORING.sf}`);
    }
  });
  if (results.third && picks.third === results.third) {
    points += SCORING.third;
    breakdown.push(`Third Place: +${SCORING.third}`);
  }
  if (results.final && picks.final === results.final) {
    points += SCORING.final;
    breakdown.push(`Final: +${SCORING.final}`);
  }
  return { points, breakdown };
}

function renderLeaderboard() {
  const results = { ...EMPTY_RESULTS, ...latestResults };
  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '';
  const rows = Object.values(latestPicks)
    .filter((entry) => !entry.archived)
    .map((entry) => {
      const { points, breakdown } = computePoints(entry.picks || {}, results);
      return { name: entry.name || entry.email, points, breakdown, inPool: isInPool(entry) };
    });
  rows.sort((a, b) => b.points - a.points);
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    const detail = r.breakdown.length ? r.breakdown.join(', ') : '—';
    tr.innerHTML = `<td>${i + 1}</td><td>${r.name}${r.inPool ? ' 💰' : ''}</td><td>${r.points}</td><td class="detail">${detail}</td>`;
    tbody.appendChild(tr);
  });
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">No picks submitted yet.</td></tr>';
  }

  renderBettingPool(rows.filter((r) => r.inPool));
}

function renderBettingPool(bettors) {
  const container = document.getElementById('betting-pool');
  if (!container) return;
  const totalBank = bettors.length * BET_AMOUNT;
  let html = `<p>Total bank: <strong>$${totalBank}</strong> (${bettors.length} player${bettors.length === 1 ? '' : 's'} in at $${BET_AMOUNT} each)</p>`;
  html += bettors.length > 0
    ? `<p class="hint">Winner takes all — whoever's #1 on the leaderboard when the tournament ends wins $${totalBank}.</p>`
    : '<p class="hint">No one has bet in yet.</p>';
  container.innerHTML = html;
}

function subscribeToData() {
  onSnapshot(RESULTS_DOC, (snap) => {
    latestResults = snap.exists() ? snap.data() : {};
    if (currentUser) renderPicksForm();
    renderLeaderboard();
  });
  onSnapshot(PICKS_COL, (snap) => {
    latestPicks = {};
    snap.forEach((d) => { latestPicks[d.id] = d.data(); });
    renderLeaderboard();
  });
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('welcome').textContent = `Playing as ${currentUser.name} (${currentUser.email})`;
  renderPicksForm();
}

function initLogin() {
  const existing = loadSession();
  if (existing) {
    currentUser = existing;
    showApp();
  }

  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('login-name').value.trim();
    const email = document.getElementById('login-email').value.trim();
    if (!name || !email) return;
    currentUser = { name, email };
    saveSession(currentUser);
    showApp();
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    clearSession();
    currentUser = null;
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
  });
}

initLogin();
subscribeToData();
