export type StatisticEntityType = "champion" | "player" | "team" | "event_total" | "boolean";

export interface StatisticDefinition {
    key: string;
    category: string;
    points: number;
    question: string;
    entity_type: StatisticEntityType;
    metric_id: string;
    constraints?: {
        min_games?: number;
        [key: string]: unknown;
    };
    options?: string[];
}

export const STATISTICS: StatisticDefinition[] = [
    {
        key: "champions_most_picked",
        category: "Champions",
        points: 50,
        question: "Which champion will be picked the most?",
        entity_type: "champion",
        metric_id: "champion_total_picks",
    },
    {
        key: "champions_most_banned",
        category: "Champions",
        points: 50,
        question: "Which champion will be banned the most?",
        entity_type: "champion",
        metric_id: "champion_total_bans",
    },
    {
        key: "champions_highest_winrate_min5",
        category: "Champions",
        points: 50,
        question: "Which champion will have the highest winrate? (minimum 5 games played)",
        entity_type: "champion",
        metric_id: "champion_winrate_min5",
        constraints: { min_games: 5 },
    },
    {
        key: "champions_lowest_winrate_min5",
        category: "Champions",
        points: 50,
        question: "Which champion will have the lowest winrate? (minimum 5 games played)",
        entity_type: "champion",
        metric_id: "champion_winrate_min5_low",
        constraints: { min_games: 5 },
    },
    {
        key: "champions_most_kills",
        category: "Champions",
        points: 50,
        question: "Which champion will have the most kills?",
        entity_type: "champion",
        metric_id: "champion_total_kills",
    },
    {
        key: "players_highest_kda",
        category: "Players",
        points: 50,
        question: "Which pro will have the highest KDA?",
        entity_type: "player",
        metric_id: "player_kda_highest",
    },
    {
        key: "players_most_unique_champions",
        category: "Players",
        points: 50,
        question: "Which pro will play the most different Champions?",
        entity_type: "player",
        metric_id: "player_unique_champions",
    },
    {
        key: "players_any_pentakill",
        category: "Players",
        points: 100,
        question: "Which pro will get at least one Pentakill?",
        entity_type: "player",
        metric_id: "player_has_pentakill",
    },
    {
        key: "players_most_first_bloods",
        category: "Players",
        points: 50,
        question: "Which pro will get the most First Bloods?",
        entity_type: "player",
        metric_id: "player_first_bloods",
    },
    {
        key: "players_most_kills_single_game",
        category: "Players",
        points: 50,
        question: "Which pro will get the most Kills in a single game?",
        entity_type: "player",
        metric_id: "player_max_kills_single_game",
    },
    {
        key: "teams_most_elders",
        category: "Teams",
        points: 50,
        question: "Which team will kill the most Elder Dragons?",
        entity_type: "team",
        metric_id: "team_elder_drakes_killed",
    },
    {
        key: "teams_most_baron_steals",
        category: "Teams",
        points: 50,
        question: "Which team will have the most Baron Steals?",
        entity_type: "team",
        metric_id: "team_baron_steals",
    },
    {
        key: "teams_shortest_game_win",
        category: "Teams",
        points: 50,
        question: "Which team will win the shortest game (duration)?",
        entity_type: "team",
        metric_id: "team_shortest_win_game_time_seconds",
    },
    {
        key: "teams_most_kills_total",
        category: "Teams",
        points: 50,
        question: "Which team will get the most kills?",
        entity_type: "team",
        metric_id: "team_total_kills",
    },
    {
        key: "teams_most_unique_champions",
        category: "Teams",
        points: 50,
        question: "Which team will play the most unique Champions (largest champion pool)?",
        entity_type: "team",
        metric_id: "team_unique_champions_played",
    },
    {
        key: "event_pentakills_total",
        category: "Event",
        points: 50,
        question: "How many Pentakills will there be?",
        entity_type: "event_total",
        metric_id: "event_total_pentakills",
        options: ["0-1", "2-3", "4-5", "6+"],
    },
    {
        key: "event_baron_steals_total",
        category: "Event",
        points: 50,
        question: "How many Baron steals will there be?",
        entity_type: "event_total",
        metric_id: "event_total_baron_steals",
        options: ["0-2", "3-5", "6-8", "9+"],
    },
    {
        key: "event_reverse_sweeps_knockouts",
        category: "Event",
        points: 50,
        question: "How many reverse sweeps will there be in the Worlds Knockout Stage (out of 7 total Bo5s)?",
        entity_type: "event_total",
        metric_id: "event_knockout_reverse_sweeps",
        options: ["0", "1", "2+"],
    },
    {
        key: "event_unique_champions_picked_total",
        category: "Event",
        points: 50,
        question: "How many unique champions will be picked?",
        entity_type: "event_total",
        metric_id: "event_total_unique_champions_picked",
        options: ["Less than 105", "105-109", "110-114", "115-119", "120+"],
    },
    {
        key: "event_teemo_picked_boolean",
        category: "Event",
        points: 100,
        question: "Will Teemo be picked?",
        entity_type: "boolean",
        metric_id: "event_teemo_picked",
    },
];

export const STATISTICS_BY_KEY = new Map(STATISTICS.map((stat) => [stat.key, stat]));
export const STATISTICS_BY_METRIC = new Map(STATISTICS.map((stat) => [stat.metric_id, stat]));

export function groupStatisticsByCategory(stats: StatisticDefinition[] = STATISTICS) {
    return stats.reduce<Record<string, StatisticDefinition[]>>((acc, stat) => {
        if (!acc[stat.category]) {
            acc[stat.category] = [];
        }
        acc[stat.category].push(stat);
        return acc;
    }, {});
}
