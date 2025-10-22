import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { isStatisticTableReady, isUserPickSelectionTableReady } from "@/lib/prisma-helpers";
import { groupStatisticsByCategory, StatisticDefinition } from "@/lib/statistics";

function renderConstraintHelper(stat: StatisticDefinition) {
  const minGames = typeof stat.constraints?.min_games === "number" ? stat.constraints.min_games : undefined;
  if (!minGames) return null;
  return <p className="text-xs text-muted">Minimum games considered: {minGames}</p>;
}

export default async function PicksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const userId = session.user.id;

  const season = 2025; // make this dynamic later
  const [champions, players, games, existing, statisticTableReady, selectionTableReady] = await Promise.all([
    prisma.champion.findMany({ orderBy: { name: "asc" } }),
    prisma.player.findMany({ orderBy: { handle: "asc" } }),
    prisma.game.findMany({ select: { blueTeam: true, redTeam: true, winnerTeam: true } }),
    prisma.userPick.findUnique({
      where: { userId_season: { userId, season } },
    }),
    isStatisticTableReady(),
    isUserPickSelectionTableReady(),
  ]);

  const userPickSelectionDelegate = (prisma as unknown as {
    userPickSelection?: typeof prisma.userPickSelection;
  }).userPickSelection;

  const selections = existing && userPickSelectionDelegate && selectionTableReady
    ? await userPickSelectionDelegate.findMany({
        where: { userPickId: existing.id },
      })
    : [];

  const missingSelectionDelegate = !userPickSelectionDelegate;
  const missingStatisticTable = !statisticTableReady;
  const missingSelectionTable = !selectionTableReady;

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

    if (stat.options?.length) {
      const defaultValue =
        selection?.valueText ??
        (selection?.valueNumber !== null && selection?.valueNumber !== undefined
          ? String(selection.valueNumber)
          : "");
      const options = [...stat.options];
      if (defaultValue && !options.includes(defaultValue)) {
        options.push(defaultValue);
      }
      return (
        <select id={stat.key} name={stat.key} defaultValue={defaultValue} className="w-full rounded-md border-base bg-card p-2">
          <option value="">—</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    switch (stat.entity_type) {
      case "champion": {
        const defaultValue = selection?.championId ? String(selection.championId) : "";
        return (
          <select id={stat.key} name={stat.key} defaultValue={defaultValue} className="w-full rounded-md border-base bg-card p-2">
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
          <select id={stat.key} name={stat.key} defaultValue={defaultValue} className="w-full rounded-md border-base bg-card p-2">
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
        const defaultValue = selection?.valueText ?? "";
        return (
          <select id={stat.key} name={stat.key} defaultValue={defaultValue} className="w-full rounded-md border-base bg-card p-2">
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
        const defaultValue =
          selection?.valueNumber !== null && selection?.valueNumber !== undefined
            ? String(selection.valueNumber)
            : "";
        return (
          <input
            id={stat.key}
            name={stat.key}
            type="number"
            defaultValue={defaultValue}
            min={0}
            className="w-full rounded-md border-base bg-card p-2"
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
          <select id={stat.key} name={stat.key} defaultValue={defaultValue} className="w-full rounded-md border-base bg-card p-2">
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
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">My Crystal Ball Picks — {season}</h1>

      {missingSelectionDelegate ? (
        <div className="rounded border border-accent/40 bg-accent/10 p-4 text-sm">
          <p className="font-semibold">Configuration required</p>
          <p>
            The server Prisma client has not been regenerated for the new Crystal Ball picks schema. Please run <code>pnpm prisma generate</code> (or the equivalent Prisma generate command) after pulling the latest code so selections can be saved and restored correctly.
          </p>
        </div>
      ) : null}

      {missingStatisticTable ? (
        <div className="rounded border border-accent/40 bg-accent/10 p-4 text-sm">
          <p className="font-semibold">Database migration required</p>
          <p>
            The database is missing the <code>Statistic</code> table that stores Crystal Ball questions. Apply the latest migrations with <code>pnpm prisma migrate deploy</code> (or <code>pnpm prisma migrate dev</code> in local development) and then regenerate the Prisma client.
          </p>
        </div>
      ) : null}

      {!missingSelectionDelegate && missingSelectionTable ? (
        <div className="rounded border border-accent/40 bg-accent/10 p-4 text-sm">
          <p className="font-semibold">Database migration required</p>
          <p>
            The database is missing the <code>UserPickSelection</code> table that stores Crystal Ball statistic selections. Apply the latest migrations with <code>pnpm prisma migrate deploy</code> (or <code>pnpm prisma migrate dev</code> in local development) and then regenerate the Prisma client.
          </p>
        </div>
      ) : null}

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
                    <span className="ml-2 text-xs text-muted">{stat.points} pts</span>
                  </label>
                  {renderInput(stat)}
                  {renderConstraintHelper(stat)}
                </div>
              ))}
            </div>
          </section>
        ))}

        <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
          Save Picks
        </button>
      </form>

      <Link className="underline" href="/crystal-ball">
        See Live Leaderboards
      </Link>
    </div>
  );
}
