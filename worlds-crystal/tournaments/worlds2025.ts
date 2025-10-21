/**
 * Worlds 2025 format notes (sourced from official format posts / Liquipedia &
 * Leaguepedia summaries):
 *
 * Swiss stage: 16 teams, five rounds. All matches are best-of-one except for
 * qualification and elimination series which are best-of-three with no
 * rematches. A full slate comprises 20 Bo1 maps and 13 Bo3 series to complete
 * the bracket.
 *
 * Knockout stage: single-elimination bracket with four quarterfinals, two
 * semifinals, and one final — seven Bo5 series in total.
 */
export const WORLDS_2025_TOURNAMENT = {
  tournamentId: "113475452383887518",
  stageIds: {
    swiss: "113475482880934049",
    knockouts: undefined as string | undefined,
  },
  swiss: {
    teams: 16,
    rounds: 5,
    totalBo1: 20,
    totalBo3Series: 13,
  },
  knockouts: {
    totalBo5Series: 7,
  },
} as const;

export type Worlds2025TournamentConfig = typeof WORLDS_2025_TOURNAMENT;
