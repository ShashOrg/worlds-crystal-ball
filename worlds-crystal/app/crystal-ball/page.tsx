import { prisma } from "@/lib/prisma";

async function getMostPicked(limit = 10) {
    const groups = await prisma.gameChampStats.groupBy({
        by: ["championId"],
        _count: { championId: true },
        orderBy: { _count: { championId: "desc" } },
        take: limit,
    });
    const champs = await prisma.champion.findMany({
        where: { id: { in: groups.map((g) => g.championId) } },
    });
    const map = new Map(champs.map((c) => [c.id, c]));
    return groups.map((g) => ({
        champion: map.get(g.championId)!,
        picks: g._count.championId,
    }));
}

async function getHighestWR(limit = 10, minGames = 5) {
    // totals per champ
    const totals = await prisma.gameChampStats.groupBy({
        by: ["championId"],
        _count: { _all: true },
    });
    // wins per champ
    const wins = await prisma.gameChampStats.groupBy({
        by: ["championId"],
        where: { win: true },
        _count: { _all: true },
    });
    const winMap = new Map(wins.map((w) => [w.championId, w._count._all]));
    const filtered = totals
        .filter((t) => t._count._all >= minGames)
        .map((t) => {
            const w = winMap.get(t.championId) ?? 0;
            return { championId: t.championId, games: t._count._all, wr: w / t._count._all };
        })
        .sort((a, b) => (b.wr === a.wr ? b.games - a.games : b.wr - a.wr))
        .slice(0, limit);

    const champs = await prisma.champion.findMany({
        where: { id: { in: filtered.map((f) => f.championId) } },
    });
    const cmap = new Map(champs.map((c) => [c.id, c]));
    return filtered.map((f) => ({ champion: cmap.get(f.championId)!, wr: f.wr, games: f.games }));
}

async function getTopKDA(limit = 20, minGames = 5) {
    const groups = await prisma.gameChampStats.groupBy({
        by: ["playerId"],
        _sum: { kills: true, deaths: true, assists: true },
        _count: { _all: true },
    });
    const players = await prisma.player.findMany({
        where: { id: { in: groups.map((g) => g.playerId!).filter(Boolean) as number[] } },
    });
    const pmap = new Map(players.map((p) => [p.id, p]));
    const computed = groups
        .filter((g) => g.playerId && g._count._all >= minGames)
        .map((g) => {
            const k = g._sum.kills ?? 0;
            const d = g._sum.deaths ?? 0;
            const a = g._sum.assists ?? 0;
            const kda = (k + a) / Math.max(1, d);
            return { playerId: g.playerId!, games: g._count._all, kda };
        })
        .sort((a, b) => b.kda - a.kda)
        .slice(0, limit)
        .map((r) => ({ player: pmap.get(r.playerId)!, kda: r.kda, games: r.games }));

    return computed;
}

async function wasTeemoPicked() {
    const teemo = await prisma.champion.findFirst({
        where: { OR: [{ key: "Teemo" }, { name: "Teemo" }] },
        select: { id: true },
    });
    if (!teemo) return false;
    const c = await prisma.gameChampStats.count({ where: { championId: teemo.id } });
    return c > 0;
}

export default async function CrystalBallPage() {
    const [mostPicked, highestWR, topKDA, teemo] = await Promise.all([
        getMostPicked(10),
        getHighestWR(10, 5),
        getTopKDA(20, 5),
        wasTeemoPicked(),
    ]);

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-10">
            <h1 className="text-3xl font-semibold">Crystal Ball — Live Stats</h1>

            <section>
                <h2 className="text-xl font-semibold mb-2">Most Picked Champions</h2>
                <table className="w-full text-sm border">
                    <thead>
                    <tr className="bg-gray-50">
                        <th className="p-2 text-left">Champion</th>
                        <th className="p-2 text-right">Picks</th>
                    </tr>
                    </thead>
                    <tbody>
                    {mostPicked.map((r) => (
                        <tr key={r.champion.id} className="border-t">
                            <td className="p-2">{r.champion.name}</td>
                            <td className="p-2 text-right">{r.picks}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </section>

            <section>
                <h2 className="text-xl font-semibold mb-2">Highest Win Rate (≥5 games)</h2>
                <table className="w-full text-sm border">
                    <thead>
                    <tr className="bg-gray-50">
                        <th className="p-2 text-left">Champion</th>
                        <th className="p-2 text-right">Win Rate</th>
                        <th className="p-2 text-right">Games</th>
                    </tr>
                    </thead>
                    <tbody>
                    {highestWR.map((r) => (
                        <tr key={r.champion.id} className="border-t">
                            <td className="p-2">{r.champion.name}</td>
                            <td className="p-2 text-right">{(r.wr * 100).toFixed(1)}%</td>
                            <td className="p-2 text-right">{r.games}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </section>

            <section>
                <h2 className="text-xl font-semibold mb-2">Top KDA (≥5 games)</h2>
                <table className="w-full text-sm border">
                    <thead>
                    <tr className="bg-gray-50">
                        <th className="p-2 text-left">Player</th>
                        <th className="p-2 text-right">KDA</th>
                        <th className="p-2 text-right">Games</th>
                    </tr>
                    </thead>
                    <tbody>
                    {topKDA.map((r) => (
                        <tr key={r.player.id} className="border-t">
                            <td className="p-2">{r.player.handle}</td>
                            <td className="p-2 text-right">{r.kda.toFixed(2)}</td>
                            <td className="p-2 text-right">{r.games}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </section>

            <section>
                <h2 className="text-xl font-semibold mb-2">Was Teemo picked?</h2>
                <div className="text-lg">{teemo ? "Yes 😈" : "Not yet 😇"}</div>
            </section>
        </div>
    );
}
