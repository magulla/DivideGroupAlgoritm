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
// match kickoff times. Set for 4:05 PM ET on July 9, 2026 (5 minutes after
// QF1 kicks off).
export const PICKS_FREEZE = '2026-07-09T20:05:00Z';

export function isLocked(kickoffIso) {
  return Date.now() >= new Date(kickoffIso).getTime();
}

export function picksFrozen() {
  return Date.now() >= new Date(PICKS_FREEZE).getTime();
}

export const BET_AMOUNT = 10;

// "Win it all" moneyline odds pulled 2026-07-09 (quarterfinal stage), vig
// removed and normalized to sum to 100%. Not live-updating — ask to refresh
// as the tournament progresses if you want fresher numbers baked in.
export const ODDS_SNAPSHOT_DATE = '2026-07-09';
export const TEAM_WIN_PROBABILITY = {
  France: 0.3198,
  Spain: 0.1906,
  Argentina: 0.1828,
  England: 0.1600,
  Norway: 0.0597,
  Morocco: 0.0320,
  Belgium: 0.0289,
  Switzerland: 0.0263,
};
