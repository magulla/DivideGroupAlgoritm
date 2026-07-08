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
  isLocked,
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
  const locked = isLocked(kickoffIso);
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

// Semifinals/Third-Place/Final let you pick any of the 8 quarterfinalists,
// independent of how earlier rounds turn out — a dropdown fits that better
// than a two-team head-to-head button pair.
function renderMatchSelect(container, matchId, label, kickoffIso, venue, options, currentPick) {
  const locked = isLocked(kickoffIso);
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

function renderPicksForm() {
  const container = document.getElementById('picks-form');
  container.innerHTML = '';
  const results = { ...EMPTY_RESULTS, ...latestResults };
  const myId = emailToId(currentUser.email);
  const existing = (latestPicks[myId] && latestPicks[myId].picks) || {};
  draftPicks = { ...existing };

  const qfSection = document.createElement('section');
  qfSection.innerHTML = '<h3>Quarterfinals <span class="pts">1 pt each</span></h3>';
  container.appendChild(qfSection);
  QUARTERFINALS.forEach((m) => {
    renderMatchRow(qfSection, m.id, m.label, m.teamA, m.teamB, m.kickoff, m.venue, existing[m.id]);
  });

  const sfSection = document.createElement('section');
  sfSection.innerHTML = '<h3>Semifinals <span class="pts">2 pts each</span></h3><p class="hint">Pick any of the 8 quarterfinalists to win — not limited to a specific bracket matchup.</p>';
  container.appendChild(sfSection);
  SEMIFINALS.forEach((sf) => {
    renderMatchSelect(sfSection, sf.id, sf.label, sf.kickoff, sf.venue, QUARTERFINAL_TEAMS, existing[sf.id]);
  });

  const thirdSection = document.createElement('section');
  thirdSection.innerHTML = '<h3>Third-Place Match <span class="pts">1 pt</span></h3>';
  container.appendChild(thirdSection);
  renderMatchSelect(thirdSection, THIRD_PLACE.id, THIRD_PLACE.label, THIRD_PLACE.kickoff, THIRD_PLACE.venue, QUARTERFINAL_TEAMS, existing[THIRD_PLACE.id]);

  const finalSection = document.createElement('section');
  finalSection.innerHTML = '<h3>Final <span class="pts">3 pts</span></h3>';
  container.appendChild(finalSection);
  renderMatchSelect(finalSection, FINAL.id, FINAL.label, FINAL.kickoff, FINAL.venue, QUARTERFINAL_TEAMS, existing[FINAL.id]);

  const championSection = document.createElement('section');
  championSection.innerHTML = `<h3>Bold Champion Pick <span class="pts">${SCORING.championBonus} pts</span></h3><p class="hint">Pick the overall winner right now, before the quarterfinals kick off, for a big bonus.</p>`;
  container.appendChild(championSection);
  const champLocked = isLocked(QUARTERFINALS[0].kickoff);
  const select = document.createElement('select');
  select.id = 'champion-select';
  select.disabled = champLocked;
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '-- choose a team --';
  select.appendChild(blank);
  QUARTERFINAL_TEAMS.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    if (existing.championEarly === t) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => {
    draftPicks.championEarly = select.value;
  });
  championSection.appendChild(select);
  if (champLocked) {
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = 'Locked — quarterfinals have started.';
    championSection.appendChild(note);
  }

  const saveBar = document.createElement('div');
  saveBar.className = 'save-bar';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save My Picks';
  saveBtn.className = 'primary';
  saveBtn.addEventListener('click', savePicks);
  saveBar.appendChild(saveBtn);
  const status = document.createElement('span');
  status.id = 'save-status';
  saveBar.appendChild(status);
  container.appendChild(saveBar);
}

async function savePicks() {
  const status = document.getElementById('save-status');
  status.textContent = 'Saving...';
  try {
    const id = emailToId(currentUser.email);
    await setDoc(doc(db, 'picks', id), {
      email: currentUser.email,
      name: currentUser.name,
      picks: draftPicks,
      updatedAt: new Date().toISOString(),
    });
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
  if (results.final && picks.championEarly === results.final) {
    points += SCORING.championBonus;
    breakdown.push(`Bold Champion: +${SCORING.championBonus}`);
  }
  return { points, breakdown };
}

function renderLeaderboard() {
  const results = { ...EMPTY_RESULTS, ...latestResults };
  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '';
  const rows = Object.values(latestPicks).map((entry) => {
    const { points, breakdown } = computePoints(entry.picks || {}, results);
    return { name: entry.name || entry.email, points, breakdown };
  });
  rows.sort((a, b) => b.points - a.points);
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    const detail = r.breakdown.length ? r.breakdown.join(', ') : '—';
    tr.innerHTML = `<td>${i + 1}</td><td>${r.name}</td><td>${r.points}</td><td class="detail">${detail}</td>`;
    tbody.appendChild(tr);
  });
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">No picks submitted yet.</td></tr>';
  }
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
