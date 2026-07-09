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
} from './matches.js';

// Soft deterrent only — checked in the browser, not enforced by Firestore
// rules (this app has no real auth). Change this before sharing the link,
// and don't post admin.html publicly. See README for details.
const ADMIN_KEY = 'qwe';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const RESULTS_DOC = doc(db, 'tournament', 'results');
const PICKS_COL = collection(db, 'picks');

let latestResults = {};
let latestPicks = {}; // by picksId
const EMPTY_RESULTS = {
  qf1: null, qf2: null, qf3: null, qf4: null,
  sf1: null, sf2: null,
  third: null, final: null,
};

// `options` is the full list of teams that could plausibly win this stage.
// Every stage is independent — you can set a semifinal or final winner
// without having entered any other stage's result first.
function matchSelect(matchId, label, options, currentValue) {
  const wrap = document.createElement('div');
  wrap.className = 'match-row';
  const meta = document.createElement('div');
  meta.className = 'match-meta';
  meta.innerHTML = `<strong>${label}</strong>`;
  wrap.appendChild(meta);

  const select = document.createElement('select');
  select.dataset.match = matchId;
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '-- not decided yet --';
  select.appendChild(blank);
  options.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    if (currentValue === t) opt.selected = true;
    select.appendChild(opt);
  });
  wrap.appendChild(select);
  return wrap;
}

function renderForm() {
  const results = { ...EMPTY_RESULTS, ...latestResults };
  const container = document.getElementById('results-form');
  container.innerHTML = '';

  QUARTERFINALS.forEach((m) => {
    container.appendChild(matchSelect(m.id, m.label, [m.teamA, m.teamB], results[m.id]));
  });
  // The two semifinals share one pool of 8 teams — the same team can't
  // legitimately win both, so exclude whichever team is set as the other's
  // winner.
  SEMIFINALS.forEach((sf) => {
    const other = SEMIFINALS.find((s) => s.id !== sf.id);
    const otherWinner = results[other.id];
    const options = QUARTERFINAL_TEAMS.filter((t) => t !== otherWinner || t === results[sf.id]);
    container.appendChild(matchSelect(sf.id, sf.label, options, results[sf.id]));
  });
  container.appendChild(matchSelect(THIRD_PLACE.id, THIRD_PLACE.label, QUARTERFINAL_TEAMS, results[THIRD_PLACE.id]));
  container.appendChild(matchSelect(FINAL.id, FINAL.label, QUARTERFINAL_TEAMS, results[FINAL.id]));
}

async function saveResults() {
  const status = document.getElementById('admin-status');
  const payload = { ...EMPTY_RESULTS, ...latestResults };
  document.querySelectorAll('#results-form select').forEach((sel) => {
    payload[sel.dataset.match] = sel.value || null;
  });
  status.textContent = 'Saving...';
  try {
    await setDoc(RESULTS_DOC, payload);
    status.textContent = 'Saved ✓';
    setTimeout(() => { status.textContent = ''; }, 2500);
  } catch (err) {
    console.error(err);
    status.textContent = 'Error saving — check console.';
  }
}

// Archiving hides a player from the live leaderboard without deleting their
// picks — flip `archived` back off (Restore) to bring them back.
async function setArchived(picksId, archived) {
  const status = document.getElementById('admin-status');
  try {
    await setDoc(doc(db, 'picks', picksId), { archived }, { merge: true });
  } catch (err) {
    console.error(err);
    status.textContent = 'Error saving — check console.';
  }
}

function playerRow(id, entry, archived) {
  const row = document.createElement('div');
  row.className = 'match-row';
  const meta = document.createElement('div');
  meta.className = 'match-meta';
  meta.innerHTML = `<strong>${entry.name || entry.email}</strong><span>${entry.email}</span>`;
  row.appendChild(meta);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = archived ? 'primary' : 'link-btn';
  btn.textContent = archived ? 'Restore' : 'Archive';
  btn.addEventListener('click', () => setArchived(id, !archived));
  row.appendChild(btn);

  return row;
}

function renderPlayers() {
  const container = document.getElementById('players-list');
  container.innerHTML = '';
  const entries = Object.entries(latestPicks);
  if (entries.length === 0) {
    container.innerHTML = '<p class="hint">No one has submitted picks yet.</p>';
    return;
  }

  const active = entries.filter(([, entry]) => !entry.archived);
  const archived = entries.filter(([, entry]) => entry.archived);

  const activeHeading = document.createElement('h3');
  activeHeading.textContent = 'Active';
  container.appendChild(activeHeading);
  if (active.length === 0) {
    container.insertAdjacentHTML('beforeend', '<p class="hint">No active players.</p>');
  } else {
    active.forEach(([id, entry]) => container.appendChild(playerRow(id, entry, false)));
  }

  if (archived.length > 0) {
    const archivedHeading = document.createElement('h3');
    archivedHeading.textContent = 'Archived';
    container.appendChild(archivedHeading);
    archived.forEach(([id, entry]) => container.appendChild(playerRow(id, entry, true)));
  }
}

onSnapshot(RESULTS_DOC, (snap) => {
  latestResults = snap.exists() ? snap.data() : {};
  renderForm();
});

onSnapshot(PICKS_COL, (snap) => {
  latestPicks = {};
  snap.forEach((d) => { latestPicks[d.id] = d.data(); });
  renderPlayers();
});

document.getElementById('save-results').addEventListener('click', saveResults);

// Login gate — a soft deterrent (see ADMIN_KEY note above), not real auth.
// Once logged in on this device, it stays logged in until you log out.
function isLoggedIn() {
  return localStorage.getItem('wc-quiz-admin') === 'true';
}

function showPanel() {
  document.getElementById('admin-login-screen').classList.add('hidden');
  document.getElementById('admin-panel').classList.remove('hidden');
}

function showLogin() {
  document.getElementById('admin-panel').classList.add('hidden');
  document.getElementById('admin-login-screen').classList.remove('hidden');
}

if (isLoggedIn()) {
  showPanel();
}

document.getElementById('admin-login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const key = document.getElementById('admin-key').value;
  const error = document.getElementById('admin-login-error');
  if (key === ADMIN_KEY) {
    localStorage.setItem('wc-quiz-admin', 'true');
    error.textContent = '';
    showPanel();
  } else {
    error.textContent = 'Wrong admin key.';
  }
});

document.getElementById('admin-logout-btn').addEventListener('click', () => {
  localStorage.removeItem('wc-quiz-admin');
  showLogin();
});
