const API_HOST = "https://esports-api.lolesports.com/persisted/gw";
const DEFAULT_LOCALE = "en-US";
const API_KEY =
  process.env.LOLESPORTS_API_KEY ?? process.env.LOLESports_API_KEY ?? undefined;

function assertApiKey() {
  if (!API_KEY) {
    throw new Error("Missing LOLESPORTS_API_KEY");
  }
}

async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  assertApiKey();

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "x-api-key": API_KEY!,
        },
      });

      if (response.ok) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 250 * (attempt + 1)),
    );
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
        id?: string;
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

export async function getStageSchedule(
  stageId: string,
): Promise<LolesportsStageSchedule> {
  if (!stageId) {
    throw new Error("Stage ID is required to fetch a LoLEsports schedule");
  }

  try {
    const url = new URL(`${API_HOST}/getSchedule`);
    url.searchParams.set("hl", DEFAULT_LOCALE);
    url.searchParams.set("stageId", stageId);

    const response = await fetchWithRetry(url.toString(), 2);

    const payload = (await response.json()) as RawScheduleResponse;
    const events = payload.data?.schedule?.events ?? [];

    const matches = events
      .map((event) => {
        const match = event.match;
        if (!match?.id) {
          return null;
        }

        const bestOf = match.strategy?.count ?? undefined;
        if (!VALID_SERIES_LENGTHS.has(bestOf as Match["bestOf"])) {
          return null;
        }

        const normalizedBestOf = bestOf as Match["bestOf"];
        const state = normalizeState(match.state ?? event.state ?? undefined);
        const scoreA = toScoreValue(match.teams?.[0]?.result?.gameWins ?? null);
        const scoreB = toScoreValue(match.teams?.[1]?.result?.gameWins ?? null);

        return {
          id: match.id,
          stageId,
          bestOf: normalizedBestOf,
          state,
          score: { a: scoreA, b: scoreB },
          startTime: event.startTime ?? undefined,
        } satisfies Match;
      })
      .filter((match): match is Match => Boolean(match));

    return { stageId, matches };
  } catch (error) {
    console.warn("[lolesports] failed to fetch stage schedule", stageId, error);
    return { stageId, matches: [] };
  }
}
