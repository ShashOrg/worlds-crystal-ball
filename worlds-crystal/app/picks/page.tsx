import { prisma } from "@/lib/prisma";
import { groupStatisticsByCategory, StatisticDefinition } from "@/lib/statistics";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function renderConstraintHelper(stat: StatisticDefinition) {
    const minGames = typeof stat.constraints?.min_games === "number" ? stat.constraints.min_games : undefined;
    if (!minGames) return null;
    return <p className="text-xs text-gray-500">Minimum games considered: {minGames}</p>;
}

export default async function PicksPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return (
            <div className="p-6">
                <p>
                    Please <Link className="underline" href="/api/auth/signin">sign in</Link> to save your picks.
                </p>
            </div>
        );
    }

    const season = 2025; // make this dynamic later
    const [champions, players, games, existing] = await Promise.all([
        prisma.champion.findMany({ orderBy: { name: "asc" } }),
        prisma.player.findMany({ orderBy: { handle: "asc" } }),
        prisma.game.findMany({ select: { blueTeam: true, redTeam: true, winnerTeam: true } }),
        prisma.userPick.findUnique({
            where: { userId_season: { userId: session.user.id, season } },
        }),
    ]);

    const selections = existing
        ? await prisma.userPickSelection.findMany({
              where: { userPickId: existing.id },
          })
        : [];

    const teamNames = new Set<string>();
    for (const player of players) {
        if (player.team) teamNames.add(player.team);
    }
    for (const game of games) {
        if (game.blueTeam) teamNames.add(game.blueTeam);
        if (game.redTeam) teamNames.add(game.redTeam);
        if (game.winnerTeam) teamNames.add(game.winnerTeam);
    }
    const teams = Array.from(teamNames).filter(Boolean).sort((a, b) => a.localeCompare(b));

    const selectionMap = new Map(selections.map((s) => [s.statisticKey, s]));
    const statsByCategory = groupStatisticsByCategory();

    const renderInput = (stat: StatisticDefinition) => {
        const selection = selectionMap.get(stat.key);
        switch (stat.entity_type) {
            case "champion": {
                const defaultValue = selection?.championId ? String(selection.championId) : "";
                return (
                    <select
                        id={stat.key}
                        name={stat.key}
                        defaultValue={defaultValue}
                        className="border rounded p-2 w-full"
                    >
                        <option value="">—</option>
                        {champions.map((champ) => (
                            <option key={champ.id} value={champ.id}>
                                {champ.name}
                            </option>
                        ))}
                    </select>
                );
            }
            case "player": {
                const defaultValue = selection?.playerId ? String(selection.playerId) : "";
                return (
                    <select
                        id={stat.key}
                        name={stat.key}
                        defaultValue={defaultValue}
                        className="border rounded p-2 w-full"
                    >
                        <option value="">—</option>
                        {players.map((player) => (
                            <option key={player.id} value={player.id}>
                                {player.handle}
                            </option>
                        ))}
                    </select>
                );
            }
            case "team": {
                const defaultValue = selection?.teamName ?? selection?.valueText ?? "";
                return (
                    <select
                        id={stat.key}
                        name={stat.key}
                        defaultValue={defaultValue}
                        className="border rounded p-2 w-full"
                    >
                        <option value="">—</option>
                        {teams.map((team) => (
                            <option key={team} value={team}>
                                {team}
                            </option>
                        ))}
                    </select>
                );
            }
            case "event_total": {
                const defaultValue = selection?.valueNumber ?? "";
                return (
                    <input
                        id={stat.key}
                        name={stat.key}
                        type="number"
                        defaultValue={defaultValue === "" ? "" : defaultValue}
                        min={0}
                        className="border rounded p-2 w-full"
                    />
                );
            }
            case "boolean": {
                const defaultValue =
                    selection?.valueBoolean === undefined || selection?.valueBoolean === null
                        ? ""
                        : selection.valueBoolean
                            ? "true"
                            : "false";
                return (
                    <select
                        id={stat.key}
                        name={stat.key}
                        defaultValue={defaultValue}
                        className="border rounded p-2 w-full"
                    >
                        <option value="">—</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                );
            }
            default:
                return null;
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-semibold">My Crystal Ball Picks — {season}</h1>

            <form action="/api/picks/save" method="post" className="space-y-6">
                <input type="hidden" name="season" value={season} />

                {Object.entries(statsByCategory).map(([category, stats]) => (
                    <section key={category} className="space-y-4">
                        <h2 className="text-xl font-semibold">{category}</h2>
                        <div className="space-y-4">
                            {stats.map((stat) => (
                                <div key={stat.key} className="space-y-2">
                                    <label htmlFor={stat.key} className="block font-medium">
                                        {stat.question}
                                        <span className="ml-2 text-xs text-gray-500">{stat.points} pts</span>
                                    </label>
                                    {renderInput(stat)}
                                    {renderConstraintHelper(stat)}
                                </div>
                            ))}
                        </div>
                    </section>
                ))}

                <button className="border rounded px-4 py-2">Save Picks</button>
            </form>

            <Link className="underline" href="/crystal-ball">
                See Live Leaderboards
            </Link>
        </div>
    );
}
