import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, setDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import {
  QUARTERFINALS,
  SEMIFINALS,
  THIRD_PLACE,
  FINAL,
  getSemifinalTeams,
  getFinalTeams,
  getThirdPlaceTeams,
} from './matches.js';

// Soft deterrent only — checked in the browser, not enforced by Firestore
// rules (this app has no real auth). Change this before sharing the link,
// and don't post admin.html publicly. See README for details.
const ADMIN_KEY = 'change-me';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const RESULTS_DOC = doc(db, 'tournament', 'results');

let latestResults = {};
const EMPTY_RESULTS = {
  qf1: null, qf2: null, qf3: null, qf4: null,
  sf1: null, sf2: null,
  third: null, final: null,
};

function matchSelect(matchId, teamA, teamB, currentValue) {
  const wrap = document.createElement('div');
  wrap.className = 'match-row';
  const meta = document.createElement('div');
  meta.className = 'match-meta';
  meta.innerHTML = `<strong>${matchId.toUpperCase()}</strong>`;
  wrap.appendChild(meta);

  const select = document.createElement('select');
  select.dataset.match = matchId;
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '-- not decided yet --';
  select.appendChild(blank);
  [teamA, teamB].forEach((t) => {
    if (t.startsWith('Winner of') || t.startsWith('Loser of')) return;
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
    container.appendChild(matchSelect(m.id, m.teamA, m.teamB, results[m.id]));
  });
  SEMIFINALS.forEach((sf) => {
    const { teamA, teamB } = getSemifinalTeams(sf, results);
    container.appendChild(matchSelect(sf.id, teamA, teamB, results[sf.id]));
  });
  {
    const { teamA, teamB } = getThirdPlaceTeams(results);
    container.appendChild(matchSelect(THIRD_PLACE.id, teamA, teamB, results[THIRD_PLACE.id]));
  }
  {
    const { teamA, teamB } = getFinalTeams(results);
    container.appendChild(matchSelect(FINAL.id, teamA, teamB, results[FINAL.id]));
  }
}

async function saveResults() {
  const status = document.getElementById('admin-status');
  const key = document.getElementById('admin-key').value;
  if (key !== ADMIN_KEY) {
    status.textContent = 'Wrong admin key.';
    return;
  }
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

onSnapshot(RESULTS_DOC, (snap) => {
  latestResults = snap.exists() ? snap.data() : {};
  renderForm();
});

document.getElementById('save-results').addEventListener('click', saveResults);
