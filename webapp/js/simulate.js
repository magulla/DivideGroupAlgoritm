import {
  QUARTERFINALS,
  SEMIFINALS,
  THIRD_PLACE,
  FINAL,
  TEAM_WIN_PROBABILITY,
  SCORING,
} from './matches.js';

// Bradley-Terry style approximation: derive a per-match win probability
// from each team's "win it all" market strength. Not bookmaker-grade for
// individual fixtures, but a reasonable relative-strength estimate.
function beat(teamA, teamB, rng) {
  const pa = TEAM_WIN_PROBABILITY[teamA] ?? 0.01;
  const pb = TEAM_WIN_PROBABILITY[teamB] ?? 0.01;
  return rng() < pa / (pa + pb) ? teamA : teamB;
}

// Simulates one full bracket outcome, respecting any already-known match
// results (so as the tournament progresses, only genuinely undecided
// matches are randomized).
function simulateOnce(results, rng) {
  const res = {};
  QUARTERFINALS.forEach((m) => {
    res[m.id] = results[m.id] || beat(m.teamA, m.teamB, rng);
  });
  SEMIFINALS.forEach((sf) => {
    const [aSrc, bSrc] = sf.from;
    res[sf.id] = results[sf.id] || beat(res[aSrc], res[bSrc], rng);
  });

  function loserOf(sfId) {
    const sf = SEMIFINALS.find((s) => s.id === sfId);
    const [aSrc, bSrc] = sf.from;
    const teamA = res[aSrc];
    const teamB = res[bSrc];
    return res[sfId] === teamA ? teamB : teamA;
  }

  const [thirdASrc, thirdBSrc] = THIRD_PLACE.from;
  res[THIRD_PLACE.id] = results[THIRD_PLACE.id] || beat(loserOf(thirdASrc), loserOf(thirdBSrc), rng);

  const [finalASrc, finalBSrc] = FINAL.from;
  res[FINAL.id] = results[FINAL.id] || beat(res[finalASrc], res[finalBSrc], rng);

  return res;
}

function scorePicks(picks, res) {
  let score = 0;
  QUARTERFINALS.forEach((m) => { if (picks[m.id] === res[m.id]) score += SCORING.qf; });
  SEMIFINALS.forEach((sf) => { if (picks[sf.id] === res[sf.id]) score += SCORING.sf; });
  if (picks[THIRD_PLACE.id] === res[THIRD_PLACE.id]) score += SCORING.third;
  if (picks[FINAL.id] === res[FINAL.id]) score += SCORING.final;
  return score;
}

// `people` is [{ name, picks }]. Never returns anything about what anyone
// picked — just each person's share of simulated tournaments where they'd
// have the strictly-highest (or tied-highest, split evenly) score.
export function simulatePoolWinProbabilities(people, results, trials = 20000) {
  const wins = {};
  people.forEach((p) => { wins[p.name] = 0; });

  for (let t = 0; t < trials; t += 1) {
    const res = simulateOnce(results, Math.random);
    let bestScore = -1;
    let leaders = [];
    people.forEach((p) => {
      const score = scorePicks(p.picks || {}, res);
      if (score > bestScore) {
        bestScore = score;
        leaders = [p.name];
      } else if (score === bestScore) {
        leaders.push(p.name);
      }
    });
    const credit = 1 / leaders.length;
    leaders.forEach((name) => { wins[name] += credit; });
  }

  return people
    .map((p) => ({ name: p.name, probability: wins[p.name] / trials }))
    .sort((a, b) => b.probability - a.probability);
}
