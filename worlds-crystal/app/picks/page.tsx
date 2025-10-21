import Link from "next/link";
import { getServerSession } from "next-auth";

import QuestionCard from "@/components/ui/QuestionCard";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { isStatisticTableReady, isUserPickSelectionTableReady } from "@/lib/prisma-helpers";
import { groupStatisticsByCategory, StatisticDefinition } from "@/lib/statistics";

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
  const [champions, players, games, existing, statisticTableReady, selectionTableReady] = await Promise.all([
    prisma.champion.findMany({ orderBy: { name: "asc" } }),
    prisma.player.findMany({ orderBy: { handle: "asc" } }),
    prisma.game.findMany({ select: { blueTeam: true, redTeam: true, winnerTeam: true } }),
    prisma.userPick.findUnique({
      where: { userId_season: { userId: session.user.id, season } },
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

  const inputClasses =
    "w-full rounded-lg border-base bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 transition-colors";

  const renderInput = (stat: StatisticDefinition, describedBy?: string) => {
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
        <select
          id={stat.key}
          name={stat.key}
          defaultValue={defaultValue}
          className={inputClasses}
          aria-describedby={describedBy}
        >
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
          <select
            id={stat.key}
            name={stat.key}
            defaultValue={defaultValue}
            className={inputClasses}
            aria-describedby={describedBy}
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
            className={inputClasses}
            aria-describedby={describedBy}
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
        const defaultValue = selection?.valueText ?? "";
        return (
          <select
            id={stat.key}
            name={stat.key}
            defaultValue={defaultValue}
            className={inputClasses}
            aria-describedby={describedBy}
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
            className={inputClasses}
            aria-describedby={describedBy}
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
            className={inputClasses}
            aria-describedby={describedBy}
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

  const alerts: JSX.Element[] = [];

  if (missingSelectionDelegate) {
    alerts.push(
      <div
        key="selection-delegate"
        className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm shadow-sm"
      >
        <p className="font-semibold">Configuration required</p>
        <p>
          The server Prisma client has not been regenerated for the new Crystal Ball picks schema. Please run <code>pnpm prisma generate</code> (or the equivalent Prisma generate command) after pulling the latest code so selections can be saved and restored correctly.
        </p>
      </div>,
    );
  }

  if (missingStatisticTable) {
    alerts.push(
      <div
        key="missing-statistic"
        className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm shadow-sm"
      >
        <p className="font-semibold">Database migration required</p>
        <p>
          The database is missing the <code>Statistic</code> table that stores Crystal Ball questions. Apply the latest migrations with <code>pnpm prisma migrate deploy</code> (or <code>pnpm prisma migrate dev</code> in local development) and then regenerate the Prisma client.
        </p>
      </div>,
    );
  }

  if (!missingSelectionDelegate && missingSelectionTable) {
    alerts.push(
      <div
        key="missing-selection"
        className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm shadow-sm"
      >
        <p className="font-semibold">Database migration required</p>
        <p>
          The database is missing the <code>UserPickSelection</code> table that stores Crystal Ball statistic selections. Apply the latest migrations with <code>pnpm prisma migrate deploy</code> (or <code>pnpm prisma migrate dev</code> in local development) and then regenerate the Prisma client.
        </p>
      </div>,
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-8">
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          My Crystal Ball Picks — {season}
        </h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-300">
          Make your predictions for every question. Cards highlight when you have made a selection.
        </p>
      </header>

      {alerts.length > 0 ? <div className="mb-6 space-y-4">{alerts}</div> : null}

      <form action="/api/picks/save" method="post" className="space-y-10">
        <input type="hidden" name="season" value={season} />

        {Object.entries(statsByCategory).map(([category, stats]) => (
          <section key={category} className="space-y-4">
            <header>
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{category}</h2>
            </header>
            <div className="grid grid-cols-1 gap-4 sm:gap-5 md:gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {stats.map((stat) => {
                const selection = selectionMap.get(stat.key);
                const hasSelection = Boolean(
                  selection &&
                    (selection.valueText ||
                      selection.teamName ||
                      selection.championId ||
                      selection.playerId ||
                      (selection.valueNumber !== null && selection.valueNumber !== undefined) ||
                      (selection.valueBoolean !== null && selection.valueBoolean !== undefined)),
                );
                const headingId = `${stat.key}-title`;
                const minGames =
                  typeof stat.constraints?.min_games === "number" ? stat.constraints.min_games : undefined;
                const constraintId = minGames ? `${stat.key}-constraint` : undefined;
                const helper = minGames ? (
                  <p
                    id={constraintId}
                    className="text-xs text-neutral-500 dark:text-neutral-400"
                  >
                    Minimum games considered: {minGames}
                  </p>
                ) : null;

                return (
                  <QuestionCard
                    key={stat.key}
                    title={stat.question}
                    subtitle={`${stat.points} pts`}
                    selected={hasSelection}
                    data-testid={`question-${stat.key}`}
                    aria-labelledby={headingId}
                    titleId={headingId}
                  >
                    <div className="space-y-2">
                      <label htmlFor={stat.key} className="sr-only">
                        {stat.question}
                      </label>
                      {renderInput(stat, constraintId)}
                      {helper}
                    </div>
                  </QuestionCard>
                );
              })}
            </div>
          </section>
        ))}

        <button
          className="inline-flex items-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Save Picks
        </button>
      </form>

      <div className="mt-8">
        <Link className="text-sm font-medium text-indigo-600 underline dark:text-indigo-400" href="/crystal-ball">
          See Live Leaderboards
        </Link>
      </div>
    </div>
  );
}
