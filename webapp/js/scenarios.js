import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { QUARTERFINALS, SEMIFINALS, THIRD_PLACE, FINAL, SCORING } from './matches.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const RESULTS_DOC = doc(db, 'tournament', 'results');
const PICKS_COL = collection(db, 'picks');

const EMPTY_RESULTS = {
  qf1: null, qf2: null, qf3: null, qf4: null,
  sf1: null, sf2: null,
  third: null, final: null,
};

const ALL_STAGES = [
  ...QUARTERFINALS.map((m) => ({ id: m.id, label: m.label })),
  ...SEMIFINALS.map((sf) => ({ id: sf.id, label: sf.label })),
  { id: THIRD_PLACE.id, label: THIRD_PLACE.label },
  { id: FINAL.id, label: FINAL.label },
];

function stageDef(stageId) {
  const qf = QUARTERFINALS.find((m) => m.id === stageId);
  if (qf) return { type: 'qf', teams: [qf.teamA, qf.teamB] };
  const sf = SEMIFINALS.find((s) => s.id === stageId);
  if (sf) return { type: 'sf', from: sf.from };
  if (stageId === THIRD_PLACE.id) return { type: 'third', from: THIRD_PLACE.from };
  return { type: 'final', from: FINAL.from };
}

function scoringKeyFor(stageId) {
  if (stageId.startsWith('qf')) return 'qf';
  if (stageId.startsWith('sf')) return 'sf';
  return stageId; // 'third' or 'final'
}

// Given the outcome fixed so far for earlier stages (in dependency order),
// figure out the two teams that will actually play this stage. Mirrors the
// same bracket topology simulate.js uses to lock in decided matches.
function participantsFor(stageId, partial) {
  const def = stageDef(stageId);
  if (def.type === 'qf') return def.teams;
  if (def.type === 'sf' || def.type === 'final') return def.from.map((srcId) => partial[srcId]);
  // third place = losers of both semifinals
  return def.from.map((sfId) => {
    const { from: [aSrc, bSrc] } = stageDef(sfId);
    const a = partial[aSrc];
    const b = partial[bSrc];
    return partial[sfId] === a ? b : a;
  });
}

// Enumerates every fully consistent outcome for the stages not yet decided
// (at most 2^8 = 256, always tractable — no Monte Carlo needed). Already-
// decided stages are fixed to their real result.
function enumerateOutcomes(results) {
  const outcomes = [];
  function recurse(idx, partial) {
    if (idx === ALL_STAGES.length) {
      outcomes.push({ ...partial });
      return;
    }
    const { id } = ALL_STAGES[idx];
    const fixed = results[id];
    if (fixed) {
      recurse(idx + 1, { ...partial, [id]: fixed });
      return;
    }
    const [a, b] = participantsFor(id, partial);
    recurse(idx + 1, { ...partial, [id]: a });
    recurse(idx + 1, { ...partial, [id]: b });
  }
  recurse(0, {});
  return outcomes;
}

function scorePicks(picks, outcome) {
  let score = 0;
  ALL_STAGES.forEach(({ id }) => {
    if (picks[id] && picks[id] === outcome[id]) {
      score += SCORING[scoringKeyFor(id)];
    }
  });
  return score;
}

// For each person, every remaining-outcome combination where they come out
// strictly on top or tied for the top score — i.e. actually wins the pool
// (or a share of it), not just their own personal best case.
function computeWinningScenarios(results, people) {
  const outcomes = enumerateOutcomes(results);
  const undecidedStages = ALL_STAGES.filter((s) => !results[s.id]);

  const winsByName = {};
  people.forEach((p) => { winsByName[p.name] = []; });

  outcomes.forEach((outcome) => {
    const scores = people.map((p) => ({ name: p.name, score: scorePicks(p.picks, outcome) }));
    const top = Math.max(...scores.map((s) => s.score));
    const leaders = scores.filter((s) => s.score === top).map((s) => s.name);
    leaders.forEach((name) => {
      winsByName[name].push({
        cells: undecidedStages.map((s) => outcome[s.id]),
        score: top,
        sharedWith: leaders.filter((n) => n !== name),
      });
    });
  });

  return { winsByName, undecidedStages };
}

let latestResults = {};
let latestPicks = {};

function renderScenarios() {
  const results = { ...EMPTY_RESULTS, ...latestResults };
  const people = Object.values(latestPicks)
    .filter((entry) => !entry.archived && entry.bet !== false)
    .map((entry) => ({ name: entry.name || entry.email, picks: entry.picks || {} }));

  const container = document.getElementById('scenarios');
  container.innerHTML = '';

  if (people.length === 0) {
    container.innerHTML = '<p class="hint">No one in the pool yet.</p>';
    return;
  }

  const { winsByName, undecidedStages } = computeWinningScenarios(results, people);

  if (undecidedStages.length === 0) {
    container.innerHTML = '<p class="hint">Every stage is decided — check the leaderboard for the final result.</p>';
    return;
  }

  people
    .slice()
    .sort((a, b) => winsByName[b.name].length - winsByName[a.name].length)
    .forEach((p) => {
      const wins = winsByName[p.name];
      const section = document.createElement('section');
      section.className = 'card';
      const heading = document.createElement('h3');
      heading.textContent = p.name;
      section.appendChild(heading);

      if (wins.length === 0) {
        const msg = document.createElement('p');
        msg.className = 'hint';
        msg.textContent = 'No outcome of the remaining games gives them the win (or a share of it).';
        section.appendChild(msg);
      } else {
        const wrap = document.createElement('div');
        wrap.className = 'table-scroll';
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        thead.innerHTML = `<tr>${undecidedStages.map((s) => `<th>${s.label}</th>`).join('')}<th>Score</th><th>Sharing with</th></tr>`;
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        wins.forEach((w) => {
          const tr = document.createElement('tr');
          const cells = w.cells.map((winner) => `<td>${winner}</td>`).join('');
          const sharing = w.sharedWith.length ? w.sharedWith.join(', ') : '—';
          tr.innerHTML = `${cells}<td>${w.score}</td><td>${sharing}</td>`;
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        section.appendChild(wrap);
      }

      container.appendChild(section);
    });
}

onSnapshot(RESULTS_DOC, (snap) => {
  latestResults = snap.exists() ? snap.data() : {};
  renderScenarios();
});

onSnapshot(PICKS_COL, (snap) => {
  latestPicks = {};
  snap.forEach((d) => { latestPicks[d.id] = d.data(); });
  renderScenarios();
});
