import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import {
  QUARTERFINALS,
  SEMIFINALS,
  THIRD_PLACE,
  FINAL,
  PICKS_FREEZE,
  picksFrozen,
} from './matches.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const PICKS_COL = collection(db, 'picks');

let latestPicks = {};
let revealed = false;

const COLUMNS = [
  ...QUARTERFINALS.map((m) => m.id),
  ...SEMIFINALS.map((sf) => sf.id),
  THIRD_PLACE.id,
  FINAL.id,
];

function renderTable() {
  const tbody = document.getElementById('picks-body');
  tbody.innerHTML = '';
  const entries = Object.values(latestPicks)
    .filter((entry) => !entry.archived)
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));

  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${COLUMNS.length + 1}">No picks submitted.</td></tr>`;
    return;
  }

  entries.forEach((entry) => {
    const picks = entry.picks || {};
    const tr = document.createElement('tr');
    const cells = COLUMNS.map((id) => `<td>${picks[id] || '—'}</td>`).join('');
    tr.innerHTML = `<td>${entry.name || entry.email}</td>${cells}`;
    tbody.appendChild(tr);
  });
}

function reveal() {
  if (revealed) return;
  revealed = true;
  document.getElementById('hidden-screen').classList.add('hidden');
  document.getElementById('reveal-screen').classList.remove('hidden');
  renderTable();
}

function tickCountdown() {
  const remaining = new Date(PICKS_FREEZE).getTime() - Date.now();
  if (remaining <= 0) {
    reveal();
    return;
  }
  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  document.getElementById('countdown').textContent = `${h}h ${m}m ${s}s`;
}

onSnapshot(PICKS_COL, (snap) => {
  latestPicks = {};
  snap.forEach((d) => { latestPicks[d.id] = d.data(); });
  if (revealed) renderTable();
});

if (picksFrozen()) {
  reveal();
} else {
  tickCountdown();
  setInterval(tickCountdown, 1000);
}
