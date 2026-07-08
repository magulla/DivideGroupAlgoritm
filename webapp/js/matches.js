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

export function isLocked(kickoffIso) {
  return Date.now() >= new Date(kickoffIso).getTime();
}
