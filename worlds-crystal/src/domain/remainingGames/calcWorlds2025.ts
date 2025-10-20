import { WORLDS_2025_TOURNAMENT } from "@/tournaments/worlds2025";
import { getStageSchedule, type Match } from "@/src/lib/lolesportsClient";

export type RemainingBreakdown = {
  swiss: {
    min: number;
    max: number;
    details: {
      bo1Left: number;
      bo3SeriesLeft: number;
      liveBo1: number;
      liveBo3RemainingMaps: number;
    };
  };
  knockouts: {
    min: number;
    max: number;
    details: {
      seriesLeft: number;
      liveBo5RemainingMaps: number;
    };
  };
  total: {
    min: number;
    max: number;
  };
};

const SWISS_STAGE_ID = WORLDS_2025_TOURNAMENT.stageIds.swiss;
const KNOCKOUT_STAGE_ID = WORLDS_2025_TOURNAMENT.stageIds.knockouts;

const SWISS_TOTAL_BO1 = WORLDS_2025_TOURNAMENT.swiss.totalBo1;
const SWISS_TOTAL_BO3_SERIES = WORLDS_2025_TOURNAMENT.swiss.totalBo3Series;
const KNOCKOUT_TOTAL_BO5_SERIES = WORLDS_2025_TOURNAMENT.knockouts.totalBo5Series;

const WINS_REQUIRED_BY_SERIES: Record<Match["bestOf"], number> = {
  1: 1,
  3: 2,
  5: 3,
};
const SWISS_BO3_MAX_MAPS_PER_SERIES = 3;
const KNOCKOUT_BO5_MAX_MAPS_PER_SERIES = 5;

function clampMatches<T>(matches: T[], allowed: number): T[] {
  const normalizedAllowed = Math.max(0, Math.floor(allowed));
  if (normalizedAllowed === 0) {
    return [];
  }
  return matches.slice(0, normalizedAllowed);
}

function calculateRemainingMaps(matches: Match[], bestOf: 3 | 5): number {
  const winsNeeded = WINS_REQUIRED_BY_SERIES[bestOf];
  return matches.reduce((total, match) => {
    const highestScore = Math.max(match.score.a, match.score.b);
    const remaining = winsNeeded - highestScore;
    return total + Math.max(remaining, 0);
  }, 0);
}

function splitMatchesByLength(matches: Match[]) {
  return {
    bo1: matches.filter((match) => match.bestOf === 1),
    bo3: matches.filter((match) => match.bestOf === 3),
    bo5: matches.filter((match) => match.bestOf === 5),
  };
}

function partitionByState(matches: Match[]) {
  return {
    completed: matches.filter((match) => match.state === "completed"),
    inProgress: matches.filter((match) => match.state === "inProgress"),
    unstarted: matches.filter((match) => match.state === "unstarted"),
  };
}

export async function computeRemainingGamesWorlds2025(): Promise<RemainingBreakdown> {
  const swissSchedule = await getStageSchedule(SWISS_STAGE_ID);
  const { bo1: swissBo1Matches, bo3: swissBo3Matches } = splitMatchesByLength(
    swissSchedule.matches,
  );

  const swissBo1States = partitionByState(swissBo1Matches);
  const completedBo1 = Math.min(swissBo1States.completed.length, SWISS_TOTAL_BO1);
  const bo1Left = Math.max(SWISS_TOTAL_BO1 - completedBo1, 0);
  const bo1LiveCount = Math.min(swissBo1States.inProgress.length, bo1Left);
  const bo1UnstartedCount = Math.max(bo1Left - bo1LiveCount, 0);

  const swissBo3States = partitionByState(swissBo3Matches);
  const completedBo3 = Math.min(
    swissBo3States.completed.length,
    SWISS_TOTAL_BO3_SERIES,
  );
  const bo3SeriesLeft = Math.max(SWISS_TOTAL_BO3_SERIES - completedBo3, 0);
  const effectiveBo3Live = clampMatches(swissBo3States.inProgress, bo3SeriesLeft);
  const bo3RemainingUnstarted = Math.max(
    bo3SeriesLeft - effectiveBo3Live.length,
    0,
  );
  const liveBo3RemainingMaps = calculateRemainingMaps(effectiveBo3Live, 3);

  const swissMin =
    bo1LiveCount * WINS_REQUIRED_BY_SERIES[1] +
    bo1UnstartedCount * WINS_REQUIRED_BY_SERIES[1] +
    liveBo3RemainingMaps +
    bo3RemainingUnstarted * WINS_REQUIRED_BY_SERIES[3];

  const swissMax =
    bo1LiveCount * WINS_REQUIRED_BY_SERIES[1] +
    bo1UnstartedCount * WINS_REQUIRED_BY_SERIES[1] +
    liveBo3RemainingMaps +
    bo3RemainingUnstarted * SWISS_BO3_MAX_MAPS_PER_SERIES;

  const knockoutMatches = await getKnockoutMatches();
  const knockoutStates = partitionByState(knockoutMatches);
  const completedBo5 = Math.min(
    knockoutStates.completed.length,
    KNOCKOUT_TOTAL_BO5_SERIES,
  );
  const bo5SeriesLeft = Math.max(KNOCKOUT_TOTAL_BO5_SERIES - completedBo5, 0);
  const effectiveBo5Live = clampMatches(knockoutStates.inProgress, bo5SeriesLeft);
  const bo5RemainingUnstarted = Math.max(
    bo5SeriesLeft - effectiveBo5Live.length,
    0,
  );
  const liveBo5RemainingMaps = calculateRemainingMaps(effectiveBo5Live, 5);

  const knockoutsMin =
    liveBo5RemainingMaps +
    bo5RemainingUnstarted * WINS_REQUIRED_BY_SERIES[5];

  const knockoutsMax =
    liveBo5RemainingMaps +
    bo5RemainingUnstarted * KNOCKOUT_BO5_MAX_MAPS_PER_SERIES;

  const totalMin = swissMin + knockoutsMin;
  const totalMax = swissMax + knockoutsMax;

  return {
    swiss: {
      min: swissMin,
      max: swissMax,
      details: {
        bo1Left,
        bo3SeriesLeft,
        liveBo1: bo1LiveCount,
        liveBo3RemainingMaps,
      },
    },
    knockouts: {
      min: knockoutsMin,
      max: knockoutsMax,
      details: {
        seriesLeft: bo5SeriesLeft,
        liveBo5RemainingMaps,
      },
    },
    total: {
      min: totalMin,
      max: totalMax,
    },
  };
}

async function getKnockoutMatches(): Promise<Match[]> {
  if (!KNOCKOUT_STAGE_ID) {
    return [];
  }

  const knockoutSchedule = await getStageSchedule(KNOCKOUT_STAGE_ID);
  const { bo5 } = splitMatchesByLength(knockoutSchedule.matches);
  return bo5;
}
