import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import {
  QUARTERFINALS,
  SEMIFINALS,
  THIRD_PLACE,
  FINAL,
  TEAM_WIN_PROBABILITY,
  ODDS_SNAPSHOT_DATE,
} from './matches.js';
import { simulatePoolWinProbabilities } from './simulate.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const RESULTS_DOC = doc(db, 'tournament', 'results');
const PICKS_COL = collection(db, 'picks');

const EMPTY_RESULTS = {
  qf1: null, qf2: null, qf3: null, qf4: null,
  sf1: null, sf2: null,
  third: null, final: null,
};

let latestResults = {};
let latestPicks = {};

function renderOdds() {
  document.getElementById('odds-note').textContent =
    `Moneyline odds to win it all, snapshot from ${ODDS_SNAPSHOT_DATE}, vig removed. Ask to refresh these as the tournament progresses.`;
  const tbody = document.getElementById('odds-body');
  tbody.innerHTML = '';
  Object.entries(TEAM_WIN_PROBABILITY)
    .sort((a, b) => b[1] - a[1])
    .forEach(([team, p]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${team}</td><td>${(p * 100).toFixed(2)}%</td>`;
      tbody.appendChild(tr);
    });
}

const ALL_STAGES = [...QUARTERFINALS.map((m) => m.id), ...SEMIFINALS.map((sf) => sf.id), THIRD_PLACE.id, FINAL.id];

function renderResultsNote(results) {
  const decided = ALL_STAGES.filter((id) => results[id]);
  const note = document.getElementById('results-note');
  note.textContent = decided.length === 0
    ? 'No match results in yet — this is a full-tournament simulation from today\'s odds.'
    : `${decided.length} of ${ALL_STAGES.length} stages already decided — those are locked in, only the rest is simulated.`;
}

function renderProbabilities() {
  const results = { ...EMPTY_RESULTS, ...latestResults };
  renderResultsNote(results);

  const people = Object.values(latestPicks)
    .filter((entry) => !entry.archived)
    .map((entry) => ({ name: entry.name || entry.email, picks: entry.picks || {} }));

  const tbody = document.getElementById('prob-body');
  tbody.innerHTML = '';
  if (people.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3">No picks submitted yet.</td></tr>';
    return;
  }

  const ranked = simulatePoolWinProbabilities(people, results, 20000);
  ranked.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i + 1}</td><td>${r.name}</td><td>${(r.probability * 100).toFixed(2)}%</td>`;
    tbody.appendChild(tr);
  });
}

renderOdds();

onSnapshot(RESULTS_DOC, (snap) => {
  latestResults = snap.exists() ? snap.data() : {};
  renderProbabilities();
});

onSnapshot(PICKS_COL, (snap) => {
  latestPicks = {};
  snap.forEach((d) => { latestPicks[d.id] = d.data(); });
  renderProbabilities();
});
