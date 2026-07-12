// World Cup 2026 knockout bracket, from the quarterfinals onward.
// Real matchups/dates as of 2026-07-08. Update TEAMS/kickoff times here if
// FIFA reschedules anything; the app derives everything else from results.

export const QUARTERFINALS = [
  {
    id: 'qf1',
    label: 'Quarterfinal 1',
    teamA: 'France',
    teamB: 'Morocco',
    kickoff: '2026-07-09T20:00:00Z', // 4:00 PM ET
    venue: 'Gillette Stadium, Foxborough',
  },
  {
    id: 'qf2',
    label: 'Quarterfinal 2',
    teamA: 'Spain',
    teamB: 'Belgium',
    kickoff: '2026-07-10T19:00:00Z', // 3:00 PM ET
    venue: 'SoFi Stadium, Inglewood',
  },
  {
    id: 'qf3',
    label: 'Quarterfinal 3',
    teamA: 'Norway',
    teamB: 'England',
    kickoff: '2026-07-11T21:00:00Z', // 5:00 PM ET
    venue: 'Hard Rock Stadium, Miami Gardens',
  },
  {
    id: 'qf4',
    label: 'Quarterfinal 4',
    teamA: 'Argentina',
    teamB: 'Switzerland',
    kickoff: '2026-07-12T01:00:00Z', // 9:00 PM ET on July 11
    venue: 'Arrowhead Stadium, Kansas City',
  },
];

export const SEMIFINALS = [
  {
    id: 'sf1',
    label: 'Semifinal 1',
    from: ['qf1', 'qf2'],
    kickoff: '2026-07-15T00:00:00Z', // 8:00 PM ET on July 14
    venue: 'AT&T Stadium, Arlington',
  },
  {
    id: 'sf2',
    label: 'Semifinal 2',
    from: ['qf3', 'qf4'],
    kickoff: '2026-07-16T00:00:00Z', // 8:00 PM ET on July 15
    venue: 'Mercedes-Benz Stadium, Atlanta',
  },
];

export const THIRD_PLACE = {
  id: 'third',
  label: 'Third-Place Match',
  from: ['sf1', 'sf2'], // loser of each
  kickoff: '2026-07-18T21:00:00Z', // 5:00 PM ET
  venue: 'Hard Rock Stadium, Miami Gardens',
};

export const FINAL = {
  id: 'final',
  label: 'Final',
  from: ['sf1', 'sf2'], // winner of each
  kickoff: '2026-07-19T19:00:00Z', // 3:00 PM ET
  venue: 'MetLife Stadium, East Rutherford',
};

export const QUARTERFINAL_TEAMS = QUARTERFINALS.flatMap((m) => [m.teamA, m.teamB]);

export const SCORING = {
  qf: 1,
  sf: 2,
  third: 3,
  final: 3,
};

// Hard cutoff: every pick locks at this moment regardless of individual
// match kickoff times. Temporarily reopened for a 10-minute editing
// window on request.
export const PICKS_FREEZE = '2026-07-10T01:55:42Z';

export function isLocked(kickoffIso) {
  return Date.now() >= new Date(kickoffIso).getTime();
}

export function picksFrozen() {
  return Date.now() >= new Date(PICKS_FREEZE).getTime();
}

export const BET_AMOUNT = 10;

// "Win it all" moneyline odds pulled 2026-07-09 (quarterfinal stage), vig
// removed and normalized to sum to 100%. This is a static pre-tournament
// prior — it does NOT need manual edits as results come in. Elimination is
// derived live from entered results (see computeLiveTeamOdds below), which
// zeroes out eliminated teams and renormalizes the rest automatically.
export const ODDS_SNAPSHOT_DATE = '2026-07-09 (pre-quarterfinal market odds)';
export const TEAM_WIN_PROBABILITY = {
  France: 0.3303,
  Spain: 0.1969,
  Argentina: 0.1888,
  England: 0.1653,
  Norway: 0.0617,
  Belgium: 0.0299,
  Switzerland: 0.0272,
  Morocco: 0,
};

// Teams still alive to win the whole tournament, given entered results.
// Semifinal/third/final picks are free-form (any of the 8 teams), so we
// don't track who actually played whom there — but the real bracket
// topology (`from`) always feeds the actual QF winners into each
// semifinal, so eliminations can still be derived correctly by combining
// that fixed topology with whichever results are entered so far.
function computeAliveTeams(results) {
  const alive = new Set(QUARTERFINAL_TEAMS);

  QUARTERFINALS.forEach((m) => {
    const winner = results[m.id];
    if (!winner) return;
    alive.delete(winner === m.teamA ? m.teamB : m.teamA);
  });

  SEMIFINALS.forEach((sf) => {
    const [aSrc, bSrc] = sf.from;
    const teamA = results[aSrc];
    const teamB = results[bSrc];
    const winner = results[sf.id];
    if (!teamA || !teamB || !winner) return;
    alive.delete(winner === teamA ? teamB : teamA);
  });

  const sf1Winner = results.sf1;
  const sf2Winner = results.sf2;
  const finalWinner = results.final;
  if (sf1Winner && sf2Winner && finalWinner) {
    alive.delete(finalWinner === sf1Winner ? sf2Winner : sf1Winner);
  }

  return alive;
}

// Renormalizes the static market-strength baseline down to just the teams
// still alive per entered results, so eliminated teams always show 0%
// without anyone needing to hand-edit the snapshot after every match.
export function computeLiveTeamOdds(results) {
  const alive = computeAliveTeams(results);
  const aliveSum = Array.from(alive).reduce((sum, t) => sum + (TEAM_WIN_PROBABILITY[t] || 0), 0);
  return QUARTERFINAL_TEAMS
    .map((team) => {
      const isAlive = alive.has(team);
      const raw = TEAM_WIN_PROBABILITY[team] || 0;
      return { team, alive: isAlive, probability: isAlive && aliveSum > 0 ? raw / aliveSum : 0 };
    })
    .sort((a, b) => b.probability - a.probability);
}
