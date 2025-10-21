const API_HOST = "https://esports-api.lolesports.com/persisted/gw";
const DEFAULT_LOCALE = "en-US";
const API_KEY =
  process.env.LOLESPORTS_API_KEY ?? process.env.LOLESports_API_KEY ?? undefined;

let loggedKeyPresence = false;

function logKeyPresenceOnce() {
  if (!loggedKeyPresence) {
    const masked = API_KEY ? `yes (${API_KEY.slice(0, 4)}****)` : "no";
    console.log("[lolesports] key present:", masked);
    loggedKeyPresence = true;
  }
}

function requireKey() {
  logKeyPresenceOnce();
  if (!API_KEY) {
    throw new Error("Missing LOLESPORTS_API_KEY");
  }
}

async function fetchGw(path: string, retries = 2): Promise<Response> {
  requireKey();

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${API_HOST}${path}`, {
        method: "GET",
        headers: {
          "x-api-key": API_KEY!,
          Origin: "https://lolesports.com",
          Referer: "https://lolesports.com/",
          "User-Agent": "Mozilla/5.0 worlds-crystal-ball (Next.js server)",
        },
      });

      if (response.ok) {
        return response;
      }

      if (response.status === 403) {
        console.warn(
          "[lolesports] 403 – check LOLESPORTS_API_KEY, and that Origin/Referer headers are set",
        );
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(String(lastError));
}

type RawScheduleResponse = {
  data?: {
    schedule?: {
      events?: Array<{
        id?: string | null;
        startTime?: string | null;
        state?: string | null;
        match?: {
          id?: string | null;
          state?: string | null;
          strategy?: {
            count?: number | null;
          } | null;
          teams?: Array<{
            result?: {
              gameWins?: number | null;
            } | null;
          }> | null;
          stage?: {
            id?: string | null;
          } | null;
          tournament?: {
            id?: string | null;
          } | null;
        } | null;
      }> | null;
    } | null;
  } | null;
};

export type MatchState = "unstarted" | "inProgress" | "completed";

export type Match = {
  id: string;
  stageId: string;
  bestOf: 1 | 3 | 5;
  state: MatchState;
  score: { a: number; b: number };
  startTime?: string;
};

export type LolesportsStageSchedule = {
  stageId: string;
  matches: Match[];
};

export type ScheduleArgs = {
  tournamentId?: string;
  stageId?: string;
};

const VALID_SERIES_LENGTHS = new Set<Match["bestOf"]>([1, 3, 5]);

function normalizeState(value: string | null | undefined): MatchState {
  const normalized = (value ?? "").toLowerCase();
  switch (normalized) {
    case "completed":
      return "completed";
    case "inprogress":
    case "in_progress":
    case "live":
      return "inProgress";
    default:
      return "unstarted";
  }
}

function toScoreValue(value: number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  return 0;
}

function normalizeSchedule(
  payload: RawScheduleResponse,
  filterStageId?: string,
): LolesportsStageSchedule {
  const events = payload.data?.schedule?.events ?? [];
  const matches: Match[] = [];
  let derivedStageId = filterStageId ?? "";

  for (const event of events) {
    const match = event.match;
    if (!match?.id) {
      continue;
    }

    const bestOf = match.strategy?.count ?? undefined;
    if (!VALID_SERIES_LENGTHS.has(bestOf as Match["bestOf"])) {
      continue;
    }

    const normalizedBestOf = bestOf as Match["bestOf"];
    const stageFromPayload = match.stage?.id ?? undefined;

    if (filterStageId && stageFromPayload && stageFromPayload !== filterStageId) {
      continue;
    }

    const normalizedStageId = stageFromPayload ?? filterStageId ?? "";

    if (!derivedStageId && normalizedStageId) {
      derivedStageId = normalizedStageId;
    }

    matches.push({
      id: match.id,
      stageId: normalizedStageId,
      bestOf: normalizedBestOf,
      state: normalizeState(match.state ?? event.state ?? undefined),
      score: {
        a: toScoreValue(match.teams?.[0]?.result?.gameWins ?? null),
        b: toScoreValue(match.teams?.[1]?.result?.gameWins ?? null),
      },
      startTime: event.startTime ?? undefined,
    });
  }

  return {
    stageId: derivedStageId,
    matches,
  };
}

export async function getStageSchedule(
  args: ScheduleArgs,
): Promise<LolesportsStageSchedule> {
  if (!args.tournamentId && !args.stageId) {
    throw new Error(
      "Either tournamentId or stageId is required to fetch a LoLEsports schedule",
    );
  }

  const params = new URLSearchParams({ hl: DEFAULT_LOCALE });
  if (args.tournamentId) {
    params.set("tournamentId", args.tournamentId);
  } else if (args.stageId) {
    params.set("stageId", args.stageId);
  }

  const path = `/getSchedule?${params.toString()}`;

  try {
    const response = await fetchGw(path, 2);
    const payload = (await response.json()) as RawScheduleResponse;
    return normalizeSchedule(payload, args.stageId);
  } catch (error) {
    console.warn("[lolesports] schedule fetch fallback to empty:", error);
    return { stageId: args.stageId ?? "", matches: [] };
  }
}

