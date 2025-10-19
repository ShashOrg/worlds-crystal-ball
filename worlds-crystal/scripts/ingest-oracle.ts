// scripts/ingest-oracle.ts
import "dotenv/config";
import Papa from "papaparse";
import {MetricResult} from "@/lib/metric-results";
import {prisma} from "@/lib/prisma";

// ---- Config you can tweak
const YEAR = process.env.ORACLE_YEAR ?? "2025";

const COMMUNITY_DRIVE_FILE_ID = process.env.COMMUNITY_DRIVE_FILE_ID ?? "1xt2vnIOPW1J7e9xYCyLDKAbqJiF7r1jMg7BeLPyeaDc";
const COMMUNITY_CSV_URL = process.env.COMMUNITY_CSV_URL ?? "";
const COMMUNITY_CSV_PATH = process.env.COMMUNITY_CSV_PATH ?? "";

type Row = {
    gameid: string;
    date?: string;           // "2025-01-11 11:11:24"
    league?: string;         // e.g. "LFL2"
    year?: string | number;  // e.g. "2025"
    split?: string;          // e.g. "Winter"
    patch?: string;

    side?: "Blue" | "Red" | string;
    position?: string;
    playername?: string;     // <-- from CSV
    teamname?: string;       // <-- from CSV
    champion?: string;

    result?: "Win" | "Loss" | "0" | "1" | string;
    kills?: string | number;
    deaths?: string | number;
    assists?: string | number;
};

// put this near the top of scripts/ingest-oracle.ts
async function downloadFromGoogleDrive(fileId: string): Promise<string> {
    // First, try "export=download" (works for normal files)
    const base = "https://drive.google.com/uc?export=download";
    const url = `${base}&id=${encodeURIComponent(fileId)}`;

    let res = await fetch(url, { redirect: "manual" });
    while (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        res = await fetch(new URL(res.headers.get("location")!, url).toString(), {
            redirect: "manual",
            headers: { cookie: res.headers.get("set-cookie") ?? "" },
        });
    }

    const ct = res.headers.get("content-type") || "";
    const body = await res.text();

    // If it's already text/csv or text/plain, return it
    if (ct.includes("text/csv") || ct.includes("text/plain")) {
        console.log("[drive] content-type:", ct);
        console.log("[drive] sample:", body.slice(0, 300).replace(/\n/g, "\\n"));
        return body;
    }

    // If HTML, it might be a confirm page (large file) or a Google Sheet
    if (ct.includes("text/html")) {
        // large-file confirm token path
        const confirmMatch =
            body.match(/confirm=([0-9A-Za-z_]+)[^"]*/) ||
            body.match(/name="confirm" value="([0-9A-Za-z_]+)"/);

        if (confirmMatch) {
            const confirm = confirmMatch[1];
            const cookie = res.headers.get("set-cookie") ?? "";
            const confirmedUrl = `${base}&id=${encodeURIComponent(fileId)}&confirm=${confirm}`;
            let res2 = await fetch(confirmedUrl, {
                headers: { cookie },
                redirect: "manual",
            });
            while (res2.status >= 300 && res2.status < 400 && res2.headers.get("location")) {
                res2 = await fetch(new URL(res2.headers.get("location")!, confirmedUrl).toString(), {
                    redirect: "manual",
                    headers: { cookie: res2.headers.get("set-cookie") ?? cookie },
                });
            }
            const text2 = await res2.text();
            console.log("[drive] confirm page → fetched, sample:", text2.slice(0, 300).replace(/\n/g, "\\n"));
            return text2;
        }

        // If it’s actually a Google Sheet, export it as CSV
        // (Works when the fileId belongs to a Sheets doc)
        const sheetsUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
            fileId
        )}/export?format=csv`;
        const res3 = await fetch(sheetsUrl);
        if (res3.ok) {
            const csv = await res3.text();
            console.log("[drive] sheets export detected, sample:", csv.slice(0, 300).replace(/\n/g, "\\n"));
            return csv;
        }

        console.log("[drive] got HTML (not CSV). First 300 chars:", body.slice(0, 300).replace(/\n/g, "\\n"));
        throw new Error("Drive returned HTML instead of CSV. Ensure the file is public or try Sheets export.");
    }

    console.log("[drive] unexpected content-type:", ct, "sample:", body.slice(0, 300));
    return body; // last resort
}

async function loadCsvText(): Promise<string> {
    // Option 1: Google Drive public file
    if (process.env.ORACLE_DRIVE_FILE_ID) {
        return downloadFromGoogleDrive(process.env.ORACLE_DRIVE_FILE_ID);
    }

    // Option 2: direct CSV URL (if you have one)
    if (process.env.ORACLE_CSV_URL) {
        const res = await fetch(process.env.ORACLE_CSV_URL);
        if (!res.ok) throw new Error(`Failed to fetch CSV (${res.status})`);
        return await res.text();
    }

    // Option 3: local file (for dev)
    if (process.env.ORACLE_CSV_PATH) {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const p = path.isAbsolute(process.env.ORACLE_CSV_PATH)
            ? process.env.ORACLE_CSV_PATH
            : path.join(process.cwd(), process.env.ORACLE_CSV_PATH);
        return fs.readFile(p, "utf-8");
    }

    throw new Error(
        "Provide ORACLE_DRIVE_FILE_ID or ORACLE_CSV_URL (or ORACLE_CSV_PATH) to load the CSV."
    );
}

async function loadCommunityCsvText(): Promise<string | null> {
    try {
        if (COMMUNITY_CSV_URL) {
            const res = await fetch(COMMUNITY_CSV_URL);
            if (!res.ok) throw new Error(`Failed to fetch community CSV (${res.status})`);
            return await res.text();
        }

        if (COMMUNITY_CSV_PATH) {
            const fs = await import("node:fs/promises");
            const path = await import("node:path");
            const resolved = path.isAbsolute(COMMUNITY_CSV_PATH)
                ? COMMUNITY_CSV_PATH
                : path.join(process.cwd(), COMMUNITY_CSV_PATH);
            return await fs.readFile(resolved, "utf-8");
        }

        if (COMMUNITY_DRIVE_FILE_ID) {
            return await downloadFromGoogleDrive(COMMUNITY_DRIVE_FILE_ID);
        }
    } catch (error) {
        console.warn("[community] failed to load CSV", error);
        return null;
    }

    return null;
}

// Configurable filters via env
const LEAGUE_REGEX = new RegExp(process.env.ORACLE_LEAGUE_REGEX ?? "(world|wcs|wrld|worlds|champ)", "i");
const YEAR_FILTER = process.env.ORACLE_YEAR_FILTER ? Number(process.env.ORACLE_YEAR_FILTER) : undefined;
const SPLIT_REGEX = process.env.ORACLE_SPLIT_REGEX ? new RegExp(process.env.ORACLE_SPLIT_REGEX, "i") : undefined;

function rowPassesFilters(r: Row) {
    // year column is present in this CSV
    if (YEAR_FILTER && Number(r.year) !== YEAR_FILTER) return false;

    const league = String(r.league ?? "");
    const split  = String(r.split ?? "");

    // league must match regex (default looks for worlds-like strings)
    if (!LEAGUE_REGEX.test(league)) return false;

    // optional split regex (e.g., for MSI/Playoffs/etc.)
    if (SPLIT_REGEX && !SPLIT_REGEX.test(split)) return false;

    return true;
}

function toUtcDate(s?: string) {
    if (!s) return new Date(`${YEAR}-01-01T00:00:00Z`);
    // If already ISO-ish with time
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(s)) {
        return new Date(`${s.replace(/\s+/, "T")}Z`);
    }
    // Try native parse (covers M/D/YYYY HH:mm, etc.)
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    // Fallback: just the date part
    const onlyDate = s.split(" ")[0]?.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, (_,$m,$d,$y)=>`${$y}-${$m.padStart(2,"0")}-${$d.padStart(2,"0")}`);
    return new Date(`${onlyDate}T00:00:00Z`);
}


function toBoolWin(result?: string) {
    const v = String(result ?? "").toLowerCase();
    // oracle sometimes had "Fail" historically; treat as loss
    return v === "win" || v === "1" || v === "true" || v === "yes";
}

function detectDelimiter(text: string) {
    // naive: if more semicolons than commas in the first line, use ';'
    const firstLine = text.split(/\r?\n/, 1)[0] || "";
    const commas = (firstLine.match(/,/g) || []).length;
    const semis = (firstLine.match(/;/g) || []).length;
    return semis > commas ? ";" : ",";
}

type CsvMatrix = string[][];

function normalizeCell(value: unknown): string {
    if (typeof value === "string") return value.trim();
    if (value === undefined || value === null) return "";
    return String(value).trim();
}

function parseCommunityMatrix(csvText: string): CsvMatrix {
    const parsed = Papa.parse<string[]>(csvText, {
        header: false,
        skipEmptyLines: false,
    });

    return parsed.data.map((row) => row.map(normalizeCell));
}

function findHeader(matrix: CsvMatrix, header: string): { row: number; col: number } | null {
    for (let r = 0; r < matrix.length; r++) {
        const row = matrix[r];
        const col = row.findIndex((cell) => cell === header);
        if (col !== -1) {
            return { row: r, col };
        }
    }
    return null;
}

function parseChampionSection(matrix: CsvMatrix, header: string) {
    const loc = findHeader(matrix, header);
    if (!loc) return [] as { rank: string; name: string; count: number }[];

    const entries: { rank: string; name: string; count: number }[] = [];
    for (let r = loc.row + 1; r < matrix.length; r++) {
        const row = matrix[r];
        const rank = row[loc.col];
        if (!rank || rank.startsWith("🔗")) break;

        const name = row[loc.col + 1] ?? "";
        const countCell = row[loc.col + 3] ?? row[loc.col + 2] ?? "";
        const count = Number(countCell.replace(/[^0-9.]/g, ""));
        if (!name) continue;
        if (Number.isNaN(count)) continue;

        entries.push({ rank, name, count });
    }

    return entries;
}

function parsePlayerSection(matrix: CsvMatrix, header: string) {
    const loc = findHeader(matrix, header);
    if (!loc) return [] as { rank: string; region: string; team: string; player: string; count: number }[];

    const entries: { rank: string; region: string; team: string; player: string; count: number }[] = [];
    for (let r = loc.row + 1; r < matrix.length; r++) {
        const row = matrix[r];
        const rank = row[loc.col];
        if (!rank || rank.startsWith("🔗")) break;

        const player = row[loc.col + 4] ?? "";
        if (!player) continue;

        const region = row[loc.col + 1] ?? "";
        const team = row[loc.col + 3] ?? "";
        const countCell = row[loc.col + 5] ?? "";
        const count = Number(countCell.replace(/[^0-9.]/g, ""));
        if (Number.isNaN(count)) continue;

        entries.push({ rank, region, team, player, count });
    }

    return entries;
}

function parseTeamSection(matrix: CsvMatrix, header: string) {
    const loc = findHeader(matrix, header);
    if (!loc) return [] as { rank: string; region: string; team: string; count: number }[];

    const entries: { rank: string; region: string; team: string; count: number }[] = [];
    for (let r = loc.row + 1; r < matrix.length; r++) {
        const row = matrix[r];
        const rank = row[loc.col];
        if (!rank || rank.startsWith("🔗")) break;

        const team = row[loc.col + 3] ?? "";
        if (!team) continue;

        const region = row[loc.col + 1] ?? "";
        const countCell = row[loc.col + 8] ?? "";
        const count = Number(countCell.replace(/[^0-9.]/g, ""));
        if (Number.isNaN(count)) continue;

        entries.push({ rank, region, team, count });
    }

    return entries;
}

function parseFastestWinSection(matrix: CsvMatrix, header: string) {
    const loc = findHeader(matrix, header);
    if (!loc) return [] as {
        rank: string;
        region: string;
        team: string;
        opponentRegion: string;
        opponentTeam: string;
        time: string;
    }[];

    const entries: {
        rank: string;
        region: string;
        team: string;
        opponentRegion: string;
        opponentTeam: string;
        time: string;
    }[] = [];

    for (let r = loc.row + 1; r < matrix.length; r++) {
        const row = matrix[r];
        const rank = row[loc.col];
        if (!rank || rank.startsWith("🔗")) break;

        const team = row[loc.col + 3] ?? "";
        const time = row[loc.col + 8] ?? "";
        if (!team || !time) continue;

        const region = row[loc.col + 1] ?? "";
        const opponentRegion = row[loc.col + 5] ?? "";
        const opponentTeam = row[loc.col + 7] ?? "";

        entries.push({ rank, region, team, opponentRegion, opponentTeam, time });
    }

    return entries;
}

function parseEventTotal(matrix: CsvMatrix, header: string) {
    const loc = findHeader(matrix, header);
    if (!loc) return null as { value: number | null; message?: string } | null;

    const row = matrix[loc.row];
    let value: number | null = null;
    for (let c = row.length - 1; c > loc.col; c--) {
        const cell = row[c];
        if (cell) {
            const parsed = Number(cell.replace(/[^0-9.]/g, ""));
            value = Number.isNaN(parsed) ? null : parsed;
            break;
        }
    }

    const nextRow = matrix[loc.row + 1];
    let message: string | undefined;
    if (nextRow) {
        for (let c = loc.col; c < nextRow.length; c++) {
            const cell = nextRow[c];
            if (cell) {
                message = cell;
                break;
            }
        }
    }

    return { value, message };
}

function buildCommunityMetricResults(matrix: CsvMatrix): Record<string, MetricResult> {
    const metrics: Record<string, MetricResult> = {};

    const bans = parseChampionSection(matrix, "🔗 Most Banned");
    metrics["champion_total_bans"] = {
        type: "entity",
        entries: bans.map((entry) => ({
            id: entry.name,
            name: entry.name,
            formattedValue: `${entry.count} bans`,
        })),
    };

    const pentakillers = parsePlayerSection(matrix, "🔗 Pentakillers");
    metrics["player_has_pentakill"] = {
        type: "entity",
        entries: pentakillers.map((entry) => ({
            id: entry.player,
            name: entry.player,
            formattedValue: `${entry.count} pentakill${entry.count === 1 ? "" : "s"}`,
            detail: [entry.team, entry.region].filter(Boolean).join(" • ") || undefined,
        })),
    };

    const firstBloods = parsePlayerSection(matrix, "🔗 Most First Blood kills");
    metrics["player_first_bloods"] = {
        type: "entity",
        entries: firstBloods.map((entry) => ({
            id: entry.player,
            name: entry.player,
            formattedValue: `${entry.count} first blood${entry.count === 1 ? "" : "s"}`,
            detail: [entry.team, entry.region].filter(Boolean).join(" • ") || undefined,
        })),
    };

    const elderDrakes = parseTeamSection(matrix, "🔗 Most Elder Dragons");
    metrics["team_elder_drakes_killed"] = {
        type: "entity",
        entries: elderDrakes.map((entry) => ({
            id: entry.team,
            name: entry.team,
            formattedValue: `${entry.count} elder${entry.count === 1 ? "" : "s"}`,
            detail: entry.region || undefined,
        })),
    };

    const baronSteals = parseTeamSection(matrix, "🔗 Most Baron Steals");
    metrics["team_baron_steals"] = {
        type: "entity",
        entries: baronSteals.map((entry) => ({
            id: entry.team,
            name: entry.team,
            formattedValue: `${entry.count} steal${entry.count === 1 ? "" : "s"}`,
            detail: entry.region || undefined,
        })),
    };

    const fastestWins = parseFastestWinSection(matrix, "🔗 Fastest win");
    metrics["team_shortest_win_game_time_seconds"] = {
        type: "entity",
        entries: fastestWins.map((entry) => ({
            id: `${entry.team}-${entry.time}`,
            name: entry.team,
            formattedValue: entry.time,
            detail: ["vs", entry.opponentTeam, entry.opponentRegion].filter(Boolean).join(" ") || undefined,
        })),
    };

    const pentakillTotal = parseEventTotal(matrix, "🔗 Pentakills");
    metrics["event_total_pentakills"] = {
        type: "number",
        value: pentakillTotal?.value ?? null,
        unit: pentakillTotal?.message && pentakillTotal.value === 0 ? pentakillTotal.message : undefined,
    };

    const baronTotal = parseEventTotal(matrix, "🔗 Baron Steals");
    metrics["event_total_baron_steals"] = {
        type: "number",
        value: baronTotal?.value ?? null,
        unit: baronTotal?.message && baronTotal.value === 0 ? baronTotal.message : undefined,
    };

    const reverseSweeps = parseEventTotal(matrix, "🔗 Reverse Sweeps");
    metrics["event_knockout_reverse_sweeps"] = {
        type: "number",
        value: reverseSweeps?.value ?? null,
        unit: reverseSweeps?.message && reverseSweeps.value === 0 ? reverseSweeps.message : undefined,
    };

    return metrics;
}

async function main() {
    const raw = await loadCsvText();
    // Strip UTF-8 BOM if present
    const csvText = raw.replace(/^\uFEFF/, "");

    const delimiter = detectDelimiter(csvText);
    console.log(`[parse] using delimiter "${delimiter}"`);

    const parsed = Papa.parse<Row>(csvText, {
        header: true,
        skipEmptyLines: true,
        delimiter,
        dynamicTyping: false,
        transformHeader: (h: string) =>
            h.trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, ""),
    });


    if (parsed.errors?.length) {
        console.log("[parse] first error:", parsed.errors[0]);
    }

    const allRows = parsed.data.filter((r) => r && Object.keys(r).length > 0);
    console.log("[parse] total rows parsed:", allRows.length);

    // after building allRows
    const headerKeys = Object.keys(allRows[0] ?? {});
    console.log("[parse] header keys:", headerKeys);

// quick tournament/league tallies to confirm Worlds detection
    const lCounts = new Map<string, number>();
    for (const r of allRows) {
        const l = String(r.league ?? "").slice(0, 40);
        lCounts.set(l, (lCounts.get(l) ?? 0) + 1);
    }
    console.log("[parse] top leagues:", [...lCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6));

    // Sample a row before filtering
    if (allRows.length > 0) {
        console.log("[parse] sample row 0:", allRows[0]);
    }

    // Worlds filter
    const rows = allRows.filter((r) => r.gameid && rowPassesFilters(r));
    console.log("[parse] rows after filters:", rows.length);

    if (rows.length === 0) {
        console.log(
            "[hint] No Worlds rows detected. Check which column contains Worlds label (tournament? league? split?)."
        );
        // Try a backup filter: sometimes the 'league' column contains 'Worlds'
        const leagueWorlds = allRows.filter((r) =>
            String(r.league ?? "").toLowerCase().includes("world")
        );
        console.log("[parse] league-worlds rows:", leagueWorlds.length);
        // If leagueWorlds > 0, swap:
        if (leagueWorlds.length > 0) {
            rows.push(...leagueWorlds);
        }
    }

    // group rows by gameid
    const games = new Map<string, Row[]>();
    for (const r of rows) {
        if (!games.has(r.gameid)) games.set(r.gameid, []);
        games.get(r.gameid)!.push(r);
    }

    let created = 0, updated = 0, statsInserted = 0;

    for (const [gid, group] of games) {
        const g0 = group[0];

        // Infer teams by side
        const blueTeam = group.find(r => (r.side ?? "").toLowerCase() === "blue")?.teamname ?? "Blue";
        const redTeam  = group.find(r => (r.side ?? "").toLowerCase() === "red")?.teamname  ?? "Red";
        const winnerTeam = group.find(r => toBoolWin(r.result))?.teamname ?? blueTeam;

        // Upsert the game by oracleGameId
        const existing = await prisma.game.findUnique({ where: { oracleGameId: gid } });
        let gameId: bigint;
        if (existing) {
            gameId = existing.id;
            updated++;
        } else {
            const g = await prisma.game.create({
                data: {
                    oracleGameId: gid,
                    tournament: g0.league ?? "Unknown",     // use league
                    stage: g0.split ?? "Regular",           // use split
                    dateUtc: toUtcDate(g0.date),
                    patch: g0.patch ?? null,
                    blueTeam,
                    redTeam,
                    winnerTeam,
                },
            });
            gameId = g.id;
            created++;
        }

        // Insert 10 player rows
        for (const r of group) {
            // champions
            // champions
            const champKey = r.champion ?? "";
            if (!champKey) continue;

            const champ = await prisma.champion.upsert({
                where: { key: champKey },
                update: { name: champKey },
                create: { key: champKey, name: champKey },
            });

            // players (use playername + teamname)
            const handle = r.playername ?? "";
            if (!handle) continue; // skip bad rows defensively

            const player = await prisma.player.upsert({
                where: { handle },
                update: { team: r.teamname ?? null },
                create: { handle, team: r.teamname ?? null },
            });


            const sideUpper = (r.side ?? "").toUpperCase();
            const sideValue = sideUpper === "BLUE" ? "BLUE" : "RED";

            await prisma.gameChampStats.upsert({
                where: { game_player_unique: { gameId, playerId: player.id } },
                update: {
                    side: sideValue,
                    championId: champ.id,
                    kills: Number(r.kills ?? 0),
                    deaths: Number(r.deaths ?? 0),
                    assists: Number(r.assists ?? 0),
                    win: toBoolWin(r.result),
                },
                create: {
                    gameId,
                    side: sideValue,
                    playerId: player.id,
                    championId: champ.id,
                    kills: Number(r.kills ?? 0),
                    deaths: Number(r.deaths ?? 0),
                    assists: Number(r.assists ?? 0),
                    win: toBoolWin(r.result),
                },
            });

            statsInserted++;
        }
    }

    console.log(`Games created: ${created}, updated: ${updated}, player-rows inserted: ${statsInserted}`);

    const communityCsv = await loadCommunityCsvText();
    if (communityCsv) {
        const matrix = parseCommunityMatrix(communityCsv.replace(/^\uFEFF/, ""));
        const communityMetrics = buildCommunityMetricResults(matrix);
        const entries = Object.entries(communityMetrics);

        for (const [metricId, data] of entries) {
            await prisma.externalMetric.upsert({
                where: { metricId },
                update: { data },
                create: { metricId, data },
            });
        }

        console.log(`[community] synced ${entries.length} metrics from community sheet`);
    } else {
        console.warn("[community] skipped syncing metrics (no CSV available)");
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
