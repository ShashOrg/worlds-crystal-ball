import { prisma } from "@/lib/prisma";
import { MetricEntityEntry, MetricResult } from "@/lib/metric-results";
import { STATISTICS, STATISTICS_BY_KEY, groupStatisticsByCategory, StatisticDefinition } from "@/lib/statistics";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { EntityMetricTable, type EntityMetricTableColumns } from "./EntityMetricTable";

const CURRENT_SEASON = 2025;

type SelectionWithRelations = Prisma.UserPickSelectionGetPayload<{
    include: { champion: true; player: true };
}>;

type UserSelectionInfo =
    | {
          type: "entity";
          label: string;
          matchId: string;
          entry: MetricEntityEntry | null;
      }
    | {
          type: "value";
          label: string;
      };

function isMissingExternalMetricTableError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const code = (error as { code?: string }).code;
    const meta = (error as { meta?: { code?: string } }).meta;
    return code === "P2010" && meta?.code === "42P01";
}

type MetricComputation = (stat: StatisticDefinition) => Promise<MetricResult>;

const notAvailable = (message?: string): MetricResult => ({ type: "unavailable", message });

async function getExternalMetricResult(metricId: string): Promise<MetricResult | null> {
    try {
        const rows = await prisma.$queryRaw<{ data: unknown }[]>`
            SELECT "data"
            FROM "ExternalMetric"
            WHERE "metricId" = ${metricId}
            LIMIT 1
        `;
        if (!rows.length) return null;
        return rows[0].data as MetricResult;
    } catch (error) {
        if (isMissingExternalMetricTableError(error)) {
            console.warn("[external-metric] ExternalMetric table missing, returning null metric result");
            return null;
        }
        throw error;
    }
}

async function buildSelectionInfo(stat: StatisticDefinition, selection: SelectionWithRelations): Promise<UserSelectionInfo | null> {
    switch (stat.entity_type) {
        case "champion": {
            if (!selection.championId) return null;
            const name = selection.champion?.name ?? selection.valueText ?? `Champion ${selection.championId}`;
            const matchId = String(selection.championId);
            const entry = await getChampionSelectionEntry(stat, selection.championId, name);
            return { type: "entity", label: name, matchId, entry };
        }
        case "player": {
            if (!selection.playerId) return null;
            const name = selection.player?.handle ?? selection.valueText ?? `Player ${selection.playerId}`;
            const matchId = String(selection.playerId);
            const entry = await getPlayerSelectionEntry(stat, selection.playerId, name);
            return { type: "entity", label: name, matchId, entry };
        }
        case "team": {
            const teamName = selection.teamName ?? selection.valueText;
            if (!teamName) return null;
            const entry = await getTeamSelectionEntry(stat, teamName);
            return { type: "entity", label: teamName, matchId: teamName, entry };
        }
        case "event_total": {
            const value =
                selection.valueText ??
                (selection.valueNumber !== null && selection.valueNumber !== undefined
                    ? String(selection.valueNumber)
                    : null);
            if (!value) return null;
            return { type: "value", label: value };
        }
        case "boolean": {
            if (selection.valueBoolean === null || selection.valueBoolean === undefined) return null;
            return { type: "value", label: selection.valueBoolean ? "Yes" : "No" };
        }
        default:
            return null;
    }
}

async function getChampionSelectionEntry(
    stat: StatisticDefinition,
    championId: number,
    name: string,
): Promise<MetricEntityEntry | null> {
    switch (stat.metric_id) {
        case "champion_total_picks": {
            const picks = await prisma.gameChampStats.count({ where: { championId } });
            return {
                id: String(championId),
                name,
                value: picks,
                valueUnit: "picks",
                formattedValue: `${picks} picks`,
            };
        }
        case "champion_total_kills": {
            const kills = await prisma.gameChampStats.aggregate({
                where: { championId },
                _sum: { kills: true },
            });
            return {
                id: String(championId),
                name,
                value: kills._sum.kills ?? 0,
                valueUnit: "kills",
                formattedValue: `${kills._sum.kills ?? 0} kills`,
            };
        }
        case "champion_winrate_min5":
        case "champion_winrate_min5_low": {
            const [games, wins] = await Promise.all([
                prisma.gameChampStats.count({ where: { championId } }),
                prisma.gameChampStats.count({ where: { championId, win: true } }),
            ]);
            if (games === 0) {
                return {
                    id: String(championId),
                    name,
                    value: "0.0%",
                    formattedValue: "0.0%",
                    detail: "0 games",
                };
            }
            const wr = (wins / games) * 100;
            return {
                id: String(championId),
                name,
                value: `${wr.toFixed(1)}%`,
                formattedValue: `${wr.toFixed(1)}%`,
                detail: `${games} games`,
            };
        }
        default:
            return null;
    }
}

async function getPlayerSelectionEntry(
    stat: StatisticDefinition,
    playerId: number,
    name: string,
): Promise<MetricEntityEntry | null> {
    switch (stat.metric_id) {
        case "player_kda_highest": {
            const aggregate = await prisma.gameChampStats.aggregate({
                where: { playerId },
                _sum: { kills: true, assists: true, deaths: true },
                _count: { _all: true },
            });
            const kills = aggregate._sum.kills ?? 0;
            const assists = aggregate._sum.assists ?? 0;
            const deaths = aggregate._sum.deaths ?? 0;
            const games = aggregate._count?._all ?? 0;
            const kda = (kills + assists) / Math.max(1, deaths);
            return {
                id: String(playerId),
                name,
                value: kda.toFixed(2),
                formattedValue: kda.toFixed(2),
                detail: `${games} games`,
            };
        }
        case "player_unique_champions": {
            const champions = await prisma.gameChampStats.findMany({
                where: { playerId },
                distinct: ["championId"],
                select: { championId: true },
            });
            return {
                id: String(playerId),
                name,
                value: champions.length,
                valueUnit: "champions",
                formattedValue: `${champions.length} champions`,
            };
        }
        case "player_max_kills_single_game": {
            const aggregate = await prisma.gameChampStats.aggregate({
                where: { playerId },
                _max: { kills: true },
            });
            const kills = aggregate._max.kills ?? 0;
            return {
                id: String(playerId),
                name,
                value: kills,
                valueUnit: "kills",
                formattedValue: `${kills} kills`,
            };
        }
        default:
            return null;
    }
}

async function getTeamSelectionEntry(stat: StatisticDefinition, teamName: string): Promise<MetricEntityEntry | null> {
    switch (stat.metric_id) {
        case "team_total_kills": {
            const aggregate = await prisma.gameChampStats.aggregate({
                where: { player: { team: teamName } },
                _sum: { kills: true },
            });
            return {
                id: teamName,
                name: teamName,
                value: aggregate._sum.kills ?? 0,
                valueUnit: "kills",
                formattedValue: `${aggregate._sum.kills ?? 0} kills`,
            };
        }
        case "team_unique_champions_played": {
            const champions = await prisma.gameChampStats.findMany({
                where: { player: { team: teamName } },
                distinct: ["championId"],
                select: { championId: true },
            });
            return {
                id: teamName,
                name: teamName,
                value: champions.length,
                valueUnit: "champions",
                formattedValue: `${champions.length} champions`,
            };
        }
        default:
            return null;
    }
}

const metricHandlers: Record<string, MetricComputation> = {
    champion_total_picks: async () => {
        const groups = await prisma.gameChampStats.groupBy({
            by: ["championId"],
            _count: { championId: true },
            orderBy: { _count: { championId: "desc" } },
            take: 10,
        });
        if (!groups.length) return { type: "entity", entries: [] };
        const champions = await prisma.champion.findMany({
            where: { id: { in: groups.map((g) => g.championId) } },
        });
        const cmap = new Map(champions.map((c) => [c.id, c.name]));
        const entries = groups.map((g) => ({
            id: g.championId.toString(),
            name: cmap.get(g.championId) ?? `Champion ${g.championId}`,
            value: g._count.championId,
            valueUnit: "picks",
            formattedValue: `${g._count.championId} picks`,
        }));
        return { type: "entity", entries };
    },
    champion_total_bans: async () =>
        (await getExternalMetricResult("champion_total_bans")) ??
        notAvailable("Ban data has not been imported yet."),
    champion_winrate_min5: async (stat) => {
        const minGames = typeof stat.constraints?.min_games === "number" ? stat.constraints.min_games : 5;
        const totals = await prisma.gameChampStats.groupBy({
            by: ["championId"],
            _count: { _all: true },
        });
        if (!totals.length) return { type: "entity", entries: [] };
        const wins = await prisma.gameChampStats.groupBy({
            by: ["championId"],
            where: { win: true },
            _count: { _all: true },
        });
        const winMap = new Map(wins.map((w) => [w.championId, w._count._all]));
        const ranked = totals
            .filter((t) => t._count._all >= minGames)
            .map((t) => {
                const winsForChamp = winMap.get(t.championId) ?? 0;
                const wr = winsForChamp / t._count._all;
                return { championId: t.championId, games: t._count._all, wr };
            })
            .sort((a, b) => (b.wr === a.wr ? b.games - a.games : b.wr - a.wr))
            .slice(0, 10);
        const champions = await prisma.champion.findMany({
            where: { id: { in: ranked.map((r) => r.championId) } },
        });
        const cmap = new Map(champions.map((c) => [c.id, c.name]));
        const entries = ranked.map((r) => ({
            id: r.championId.toString(),
            name: cmap.get(r.championId) ?? `Champion ${r.championId}`,
            value: `${(r.wr * 100).toFixed(1)}%`,
            formattedValue: `${(r.wr * 100).toFixed(1)}%`,
            detail: `${r.games} games`,
        }));
        return { type: "entity", entries };
    },
    champion_winrate_min5_low: async (stat) => {
        const minGames = typeof stat.constraints?.min_games === "number" ? stat.constraints.min_games : 5;
        const totals = await prisma.gameChampStats.groupBy({
            by: ["championId"],
            _count: { _all: true },
        });
        if (!totals.length) return { type: "entity", entries: [] };
        const wins = await prisma.gameChampStats.groupBy({
            by: ["championId"],
            where: { win: true },
            _count: { _all: true },
        });
        const winMap = new Map(wins.map((w) => [w.championId, w._count._all]));
        const ranked = totals
            .filter((t) => t._count._all >= minGames)
            .map((t) => {
                const winsForChamp = winMap.get(t.championId) ?? 0;
                const wr = winsForChamp / t._count._all;
                return { championId: t.championId, games: t._count._all, wr };
            })
            .sort((a, b) => (a.wr === b.wr ? b.games - a.games : a.wr - b.wr))
            .slice(0, 10);
        const champions = await prisma.champion.findMany({
            where: { id: { in: ranked.map((r) => r.championId) } },
        });
        const cmap = new Map(champions.map((c) => [c.id, c.name]));
        const entries = ranked.map((r) => ({
            id: r.championId.toString(),
            name: cmap.get(r.championId) ?? `Champion ${r.championId}`,
            value: `${(r.wr * 100).toFixed(1)}%`,
            formattedValue: `${(r.wr * 100).toFixed(1)}%`,
            detail: `${r.games} games`,
        }));
        return { type: "entity", entries };
    },
    champion_total_kills: async () => {
        const groups = await prisma.gameChampStats.groupBy({
            by: ["championId"],
            _sum: { kills: true },
            orderBy: { _sum: { kills: "desc" } },
            take: 10,
        });
        if (!groups.length) return { type: "entity", entries: [] };
        const champions = await prisma.champion.findMany({
            where: { id: { in: groups.map((g) => g.championId) } },
        });
        const cmap = new Map(champions.map((c) => [c.id, c.name]));
        const entries = groups.map((g) => ({
            id: g.championId.toString(),
            name: cmap.get(g.championId) ?? `Champion ${g.championId}`,
            value: g._sum.kills ?? 0,
            valueUnit: "kills",
            formattedValue: `${g._sum.kills ?? 0} kills`,
        }));
        return { type: "entity", entries };
    },
    player_kda_highest: async () => {
        const groups = await prisma.gameChampStats.groupBy({
            by: ["playerId"],
            where: { playerId: { not: null } },
            _sum: { kills: true, deaths: true, assists: true },
            _count: { _all: true },
        });
        if (!groups.length) return { type: "entity", entries: [] };
        const valid = groups
            .filter((g) => g.playerId !== null && g._count._all > 0)
            .map((g) => {
                const kills = g._sum.kills ?? 0;
                const deaths = g._sum.deaths ?? 0;
                const assists = g._sum.assists ?? 0;
                const kda = (kills + assists) / Math.max(1, deaths);
                return { playerId: g.playerId as number, games: g._count._all, kda };
            })
            .sort((a, b) => (b.kda === a.kda ? b.games - a.games : b.kda - a.kda))
            .slice(0, 10);
        const players = await prisma.player.findMany({
            where: { id: { in: valid.map((v) => v.playerId) } },
        });
        const pmap = new Map(players.map((p) => [p.id, p.handle]));
        const entries = valid.map((v) => ({
            id: v.playerId.toString(),
            name: pmap.get(v.playerId) ?? `Player ${v.playerId}`,
            value: v.kda.toFixed(2),
            formattedValue: v.kda.toFixed(2),
            detail: `${v.games} games`,
        }));
        return { type: "entity", entries };
    },
    player_unique_champions: async () => {
        const stats = await prisma.gameChampStats.findMany({
            where: { playerId: { not: null } },
            select: { playerId: true, championId: true },
        });
        if (!stats.length) return { type: "entity", entries: [] };
        const counts = new Map<number, Set<number>>();
        for (const row of stats) {
            if (!row.playerId) continue;
            if (!counts.has(row.playerId)) counts.set(row.playerId, new Set());
            counts.get(row.playerId)!.add(row.championId);
        }
        const ranked = Array.from(counts.entries())
            .map(([playerId, champs]) => ({ playerId, count: champs.size }))
            .sort((a, b) => (b.count === a.count ? a.playerId - b.playerId : b.count - a.count))
            .slice(0, 10);
        const players = await prisma.player.findMany({
            where: { id: { in: ranked.map((r) => r.playerId) } },
        });
        const pmap = new Map(players.map((p) => [p.id, p.handle]));
        const entries = ranked.map((r) => ({
            id: r.playerId.toString(),
            name: pmap.get(r.playerId) ?? `Player ${r.playerId}`,
            value: r.count,
            valueUnit: "champions",
            formattedValue: `${r.count} champions`,
        }));
        return { type: "entity", entries };
    },
    player_has_pentakill: async () =>
        (await getExternalMetricResult("player_has_pentakill")) ??
        notAvailable("Pentakill data is not tracked yet."),
    player_first_bloods: async () =>
        (await getExternalMetricResult("player_first_bloods")) ??
        notAvailable("First blood data is not tracked yet."),
    player_max_kills_single_game: async () => {
        const groups = await prisma.gameChampStats.groupBy({
            by: ["playerId"],
            where: { playerId: { not: null } },
            _max: { kills: true },
            orderBy: { _max: { kills: "desc" } },
            take: 10,
        });
        if (!groups.length) return { type: "entity", entries: [] };
        const players = await prisma.player.findMany({
            where: { id: { in: groups.map((g) => g.playerId as number) } },
        });
        const pmap = new Map(players.map((p) => [p.id, p.handle]));
        const entries = groups
            .filter((g) => g.playerId !== null)
            .map((g) => ({
                id: (g.playerId as number).toString(),
                name: pmap.get(g.playerId as number) ?? `Player ${g.playerId}`,
                value: g._max.kills ?? 0,
                valueUnit: "kills",
                formattedValue: `${g._max.kills ?? 0} kills`,
            }));
        return { type: "entity", entries };
    },
    team_elder_drakes_killed: async () =>
        (await getExternalMetricResult("team_elder_drakes_killed")) ??
        notAvailable("Objective stats are not available yet."),
    team_baron_steals: async () =>
        (await getExternalMetricResult("team_baron_steals")) ??
        notAvailable("Objective stats are not available yet."),
    team_shortest_win_game_time_seconds: async () =>
        (await getExternalMetricResult("team_shortest_win_game_time_seconds")) ??
        notAvailable("Game duration data is not available yet."),
    team_total_kills: async () => {
        const stats = await prisma.gameChampStats.findMany({
            where: { playerId: { not: null } },
            select: {
                kills: true,
                player: { select: { team: true, id: true } },
            },
        });
        if (!stats.length) return { type: "entity", entries: [] };
        const totals = new Map<string, number>();
        for (const row of stats) {
            const team = row.player?.team;
            if (!team) continue;
            totals.set(team, (totals.get(team) ?? 0) + row.kills);
        }
        const ranked = Array.from(totals.entries())
            .map(([team, kills]) => ({ team, kills }))
            .sort((a, b) => b.kills - a.kills)
            .slice(0, 10);
        const entries = ranked.map((r) => ({
            id: r.team,
            name: r.team,
            value: r.kills,
            valueUnit: "kills",
            formattedValue: `${r.kills} kills`,
        }));
        return { type: "entity", entries };
    },
    team_unique_champions_played: async () => {
        const stats = await prisma.gameChampStats.findMany({
            where: { playerId: { not: null } },
            select: {
                championId: true,
                player: { select: { team: true } },
            },
        });
        if (!stats.length) return { type: "entity", entries: [] };
        const unique = new Map<string, Set<number>>();
        for (const row of stats) {
            const team = row.player?.team;
            if (!team) continue;
            if (!unique.has(team)) unique.set(team, new Set());
            unique.get(team)!.add(row.championId);
        }
        const ranked = Array.from(unique.entries())
            .map(([team, champs]) => ({ team, count: champs.size }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        const entries = ranked.map((r) => ({
            id: r.team,
            name: r.team,
            value: r.count,
            valueUnit: "champions",
            formattedValue: `${r.count} champions`,
        }));
        return { type: "entity", entries };
    },
    event_total_pentakills: async () =>
        (await getExternalMetricResult("event_total_pentakills")) ??
        notAvailable("Pentakill data is not tracked yet."),
    event_total_baron_steals: async () =>
        (await getExternalMetricResult("event_total_baron_steals")) ??
        notAvailable("Baron steal data is not tracked yet."),
    event_knockout_reverse_sweeps: async () =>
        (await getExternalMetricResult("event_knockout_reverse_sweeps")) ??
        notAvailable("Series results are not tracked yet."),
    event_total_unique_champions_picked: async () => {
        const champs = await prisma.gameChampStats.findMany({
            distinct: ["championId"],
            select: { championId: true },
        });
        return { type: "number", value: champs.length };
    },
    event_teemo_picked: async () => {
        const teemo = await prisma.champion.findFirst({
            where: { OR: [{ key: "Teemo" }, { name: "Teemo" }] },
            select: { id: true },
        });
        if (!teemo) return { type: "boolean", value: null };
        const count = await prisma.gameChampStats.count({ where: { championId: teemo.id } });
        return { type: "boolean", value: count > 0 };
    },
};

export default async function CrystalBallPage() {
    const session = await getServerSession(authOptions);
    const stats = STATISTICS;
    const groupedResults = groupStatisticsByCategory(stats);

    const userSelections = new Map<string, UserSelectionInfo>();

    if (session?.user?.id) {
        const userPick = await prisma.userPick.findUnique({
            where: { userId_season: { userId: session.user.id, season: CURRENT_SEASON } },
            include: { selections: { include: { champion: true, player: true } } },
        });

        if (userPick?.selections?.length) {
            const selectionEntries = await Promise.all(
                userPick.selections.map(async (selection) => {
                    const stat = STATISTICS_BY_KEY.get(selection.statisticKey);
                    if (!stat) return null;
                    const info = await buildSelectionInfo(stat, selection);
                    if (!info) return null;
                    return [stat.key, info] as const;
                }),
            );

            for (const entry of selectionEntries) {
                if (!entry) continue;
                userSelections.set(entry[0], entry[1]);
            }
        }
    }

    const results = await Promise.all(
        stats.map(async (stat) => {
            const handler = metricHandlers[stat.metric_id] ?? (async () => notAvailable());
            const result = await handler(stat);
            return { stat, result };
        }),
    );

    const resultsByCategory = new Map<string, { stat: StatisticDefinition; result: MetricResult }[]>();
    for (const entry of results) {
        if (!resultsByCategory.has(entry.stat.category)) {
            resultsByCategory.set(entry.stat.category, []);
        }
        resultsByCategory.get(entry.stat.category)!.push(entry);
    }

    const categories = Object.keys(groupedResults);

    return (
        <div className="mx-auto max-w-screen-2xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-semibold">Crystal Ball — Live Stats</h1>

            {categories.map((category) => {
                const items = resultsByCategory.get(category) ?? [];
                return (
                    <section key={category} className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-semibold">{category}</h2>
                            <p className="text-sm text-gray-600">Live results for {category.toLowerCase()} questions.</p>
                        </div>
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                            {items.map(({ stat, result }) => (
                                <article key={stat.key} className="border rounded-md flex flex-col h-full">
                                    <header className="border-b px-4 py-3 bg-gray-50">
                                        <h3 className="font-semibold">{stat.question}</h3>
                                        <p className="text-xs text-gray-500">Worth {stat.points} points</p>
                                    </header>
                                    <div className="p-4 flex-1">
                                        <MetricResultDisplay
                                            stat={stat}
                                            result={result}
                                            selection={userSelections.get(stat.key)}
                                        />
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}

function getEntityTableColumns(stat: StatisticDefinition): EntityMetricTableColumns {
    const baseName =
        stat.entity_type === "champion"
            ? "Champion"
            : stat.entity_type === "player"
            ? "Player"
            : stat.entity_type === "team"
            ? "Team"
            : "Name";

    const withDetail = (value: string, detail: string = "Details"): EntityMetricTableColumns => ({
        name: baseName,
        value,
        detail,
    });

    switch (stat.metric_id) {
        case "champion_total_picks":
            return withDetail("Picks");
        case "champion_total_bans":
            return withDetail("Bans");
        case "champion_winrate_min5":
        case "champion_winrate_min5_low":
            return withDetail("Win Rate", "Games Played");
        case "champion_total_kills":
            return withDetail("Kills");
        case "player_kda_highest":
            return withDetail("KDA", "Games Played");
        case "player_unique_champions":
            return withDetail("Champions Played");
        case "player_has_pentakill":
            return withDetail("Pentakills");
        case "player_first_bloods":
            return withDetail("First Bloods");
        case "player_max_kills_single_game":
            return withDetail("Kills (Single Game)");
        case "team_elder_drakes_killed":
            return withDetail("Elder Dragons");
        case "team_baron_steals":
            return withDetail("Baron Steals");
        case "team_shortest_win_game_time_seconds":
            return withDetail("Duration", "Matchup");
        case "team_total_kills":
            return withDetail("Kills");
        case "team_unique_champions_played":
            return withDetail("Champions Played");
        default:
            return withDetail("Value");
    }
}

function MetricResultDisplay({
    stat,
    result,
    selection,
}: {
    stat: StatisticDefinition;
    result: MetricResult;
    selection?: UserSelectionInfo;
}) {
    if (result.type === "entity") {
        if (!result.entries.length) {
            return (
                <div className="space-y-2">
                    <p className="text-sm text-gray-500">No data yet.</p>
                    {selection ? (
                        <p className="text-sm text-blue-700">
                            Your pick: <span className="font-semibold">{selection.label}</span>
                        </p>
                    ) : null}
                </div>
            );
        }

        return (
            <EntityMetricTable
                entries={result.entries}
                selection={selection?.type === "entity" ? selection : undefined}
                columns={getEntityTableColumns(stat)}
            />
        );
    }

    if (result.type === "number") {
        return (
            <div className="space-y-2">
                <p className="text-lg">
                    {result.value === null ? "No data yet" : result.value}
                    {result.unit ? ` ${result.unit}` : ""}
                </p>
                {selection ? (
                    <p className="text-sm text-blue-700">
                        Your pick: <span className="font-semibold">{selection.label}</span>
                    </p>
                ) : null}
            </div>
        );
    }

    if (result.type === "boolean") {
        return (
            <div className="space-y-2">
                <p className="text-lg">
                    {result.value === null ? "No data yet" : result.value ? "Yes" : "No"}
                </p>
                {selection ? (
                    <p className="text-sm text-blue-700">
                        Your pick: <span className="font-semibold">{selection.label}</span>
                    </p>
                ) : null}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <p className="text-sm text-gray-500">{result.message ?? "This statistic is not available yet."}</p>
            {selection ? (
                <p className="text-sm text-blue-700">
                    Your pick: <span className="font-semibold">{selection.label}</span>
                </p>
            ) : null}
        </div>
    );
}
