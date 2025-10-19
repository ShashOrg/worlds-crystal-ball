import { prisma } from "@/lib/prisma";
import { STATISTICS, groupStatisticsByCategory, StatisticDefinition } from "@/lib/statistics";

interface MetricEntityEntry {
    id: string;
    name: string;
    formattedValue: string;
    detail?: string;
}

type MetricResult =
    | { type: "entity"; entries: MetricEntityEntry[] }
    | { type: "number"; value: number | null; unit?: string }
    | { type: "boolean"; value: boolean | null }
    | { type: "unavailable"; message?: string };

type MetricComputation = (stat: StatisticDefinition) => Promise<MetricResult>;

const notAvailable = (message?: string): MetricResult => ({ type: "unavailable", message });

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
            formattedValue: `${g._count.championId} picks`,
        }));
        return { type: "entity", entries };
    },
    champion_total_bans: async () => notAvailable("Ban data has not been imported yet."),
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
            formattedValue: `${r.count} champions`,
        }));
        return { type: "entity", entries };
    },
    player_has_pentakill: async () => notAvailable("Pentakill data is not tracked yet."),
    player_first_bloods: async () => notAvailable("First blood data is not tracked yet."),
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
                formattedValue: `${g._max.kills ?? 0} kills`,
            }));
        return { type: "entity", entries };
    },
    team_elder_drakes_killed: async () => notAvailable("Objective stats are not available yet."),
    team_baron_steals: async () => notAvailable("Objective stats are not available yet."),
    team_shortest_win_game_time_seconds: async () => notAvailable("Game duration data is not available yet."),
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
            formattedValue: `${r.count} champions`,
        }));
        return { type: "entity", entries };
    },
    event_total_pentakills: async () => notAvailable("Pentakill data is not tracked yet."),
    event_total_baron_steals: async () => notAvailable("Baron steal data is not tracked yet."),
    event_knockout_reverse_sweeps: async () => notAvailable("Series results are not tracked yet."),
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
    const stats = STATISTICS;
    const groupedResults = groupStatisticsByCategory(stats);

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
        <div className="max-w-6xl mx-auto p-6 space-y-10">
            <h1 className="text-3xl font-semibold">Crystal Ball — Live Stats</h1>

            {categories.map((category) => {
                const items = resultsByCategory.get(category) ?? [];
                return (
                    <section key={category} className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-semibold">{category}</h2>
                            <p className="text-sm text-gray-600">Live results for {category.toLowerCase()} questions.</p>
                        </div>
                        <div className="space-y-6">
                            {items.map(({ stat, result }) => (
                                <article key={stat.key} className="border rounded-md">
                                    <header className="border-b px-4 py-3 bg-gray-50">
                                        <h3 className="font-semibold">{stat.question}</h3>
                                        <p className="text-xs text-gray-500">Worth {stat.points} points</p>
                                    </header>
                                    <div className="p-4">
                                        {(() => {
                                            switch (result.type) {
                                                case "entity": {
                                                    if (!result.entries.length) {
                                                        return <p className="text-sm text-gray-500">No data yet.</p>;
                                                    }
                                                    return (
                                                        <table className="w-full text-sm border">
                                                            <thead>
                                                                <tr className="bg-gray-100">
                                                                    <th className="p-2 text-left">Name</th>
                                                                    <th className="p-2 text-right">Value</th>
                                                                    <th className="p-2 text-right">Details</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {result.entries.map((entry) => (
                                                                    <tr key={entry.id} className="border-t">
                                                                        <td className="p-2">{entry.name}</td>
                                                                        <td className="p-2 text-right">{entry.formattedValue}</td>
                                                                        <td className="p-2 text-right text-gray-500">{entry.detail ?? "—"}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    );
                                                }
                                                case "number":
                                                    return (
                                                        <p className="text-lg">
                                                            {result.value === null ? "No data yet" : result.value}
                                                            {result.unit ? ` ${result.unit}` : ""}
                                                        </p>
                                                    );
                                                case "boolean":
                                                    return (
                                                        <p className="text-lg">
                                                            {result.value === null ? "No data yet" : result.value ? "Yes" : "No"}
                                                        </p>
                                                    );
                                                case "unavailable":
                                                default:
                                                    return (
                                                        <p className="text-sm text-gray-500">
                                                            {result.message ?? "This statistic is not available yet."}
                                                        </p>
                                                    );
                                            }
                                        })()}
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
