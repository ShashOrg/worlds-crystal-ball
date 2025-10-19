export type WorldsEventSchedule = {
    /**
     * Matches that are guaranteed to be played based on the published
     * tournament schedule (e.g. play-in, Swiss, knockout rounds).
     */
    scheduledMatches: number;
    /**
     * Matches that may be required depending on bracket permutations or
     * additional decider scenarios. These are included when calculating the
     * maximum possible matches remaining.
     */
    potentialMatches: number;
};

const EVENT_SCHEDULE_BY_SEASON: Record<number, WorldsEventSchedule> = {
    /**
     * Worlds 2025 follows the same format introduced in 2024:
     *  - Play-In stage with two double-elimination groups (14 best-of series)
     *  - Swiss stage with a fixed 40 best-of series (5 rounds of eight matches)
     *  - Knockout stage with eight best-of five series
     *
     *  In addition to the scheduled series, format documentation includes two
     *  potential qualification tiebreakers for the Play-In stage. These only
     *  occur if groups require an extra decider, so we track them separately
     *  as potential matches.
     */
    2025: {
        scheduledMatches: 62,
        potentialMatches: 2,
    },
};

export function getWorldsEventSchedule(season: number): WorldsEventSchedule | null {
    return EVENT_SCHEDULE_BY_SEASON[season] ?? null;
}
