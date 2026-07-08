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
  third: 1,
  final: 3,
  championBonus: 5,
};

function qfById(id) {
  return QUARTERFINALS.find((m) => m.id === id);
}

function matchLabel(id) {
  const qf = qfById(id);
  return qf ? `${qf.teamA}/${qf.teamB}` : id;
}

// Given the results doc, figure out the two teams in a semifinal.
export function getSemifinalTeams(sf, results) {
  const [aSrc, bSrc] = sf.from;
  return {
    teamA: results[aSrc] || `Winner of ${matchLabel(aSrc)}`,
    teamB: results[bSrc] || `Winner of ${matchLabel(bSrc)}`,
    resolved: Boolean(results[aSrc] && results[bSrc]),
  };
}

// Given the results doc, figure out the two teams in the final (SF winners).
export function getFinalTeams(results) {
  const sf1Winner = results.sf1;
  const sf2Winner = results.sf2;
  return {
    teamA: sf1Winner || 'Winner of Semifinal 1',
    teamB: sf2Winner || 'Winner of Semifinal 2',
    resolved: Boolean(sf1Winner && sf2Winner),
  };
}

// Third place = loser of each semifinal. Needs the semifinal's two teams
// (derived from QF results) plus the semifinal winner to find the loser.
export function getThirdPlaceTeams(results) {
  function loserOf(sf) {
    const { teamA, teamB, resolved } = getSemifinalTeams(sf, results);
    const winner = results[sf.id];
    if (!resolved || !winner) return null;
    return winner === teamA ? teamB : teamA;
  }
  const loserA = loserOf(SEMIFINALS[0]);
  const loserB = loserOf(SEMIFINALS[1]);
  return {
    teamA: loserA || 'Loser of Semifinal 1',
    teamB: loserB || 'Loser of Semifinal 2',
    resolved: Boolean(loserA && loserB),
  };
}

export function isLocked(kickoffIso) {
  return Date.now() >= new Date(kickoffIso).getTime();
}
