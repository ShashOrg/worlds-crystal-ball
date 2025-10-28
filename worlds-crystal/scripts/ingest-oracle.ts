// scripts/ingest-oracle.ts
import "dotenv/config";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { MetricResult } from "@/lib/metric-results";
import { prisma } from "@/lib/prisma";
import { recomputeAndStoreCrystalBallSummary } from "@/lib/crystal-ball-summary";
import { rebuildTournamentElo } from "@/lib/probability/eloRebuild";
import { buildSeriesId } from "@/utils/series";

async function ensureExternalMetricTable() {
    const exists = await prisma.$queryRaw<{exists: boolean}[]>`
        SELECT to_regclass('"ExternalMetric"') IS NOT NULL AS "exists"
    `;

    if (!exists[0]?.exists) {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "ExternalMetric" (
                "id" SERIAL PRIMARY KEY,
                "metricId" TEXT NOT NULL UNIQUE,
                "data" JSONB NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
            );
        `);
        await prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "ExternalMetric_metricId_key"
            ON "ExternalMetric"("metricId");
        `);
    }
}

// ---- Config you can tweak
const YEAR = process.env.ORACLE_YEAR ?? "2025";
const SEASON = Number.parseInt(YEAR, 10);

const COMMUNITY_DRIVE_FILE_ID = process.env.COMMUNITY_DRIVE_FILE_ID ?? "1xt2vnIOPW1J7e9xYCyLDKAbqJiF7r1jMg7BeLPyeaDc";
const COMMUNITY_CSV_URL = process.env.COMMUNITY_CSV_URL ?? "";
const COMMUNITY_CSV_PATH = process.env.COMMUNITY_CSV_PATH ?? "";

if (Number.isNaN(SEASON)) {
    throw new Error(`Invalid ORACLE_YEAR value: ${YEAR}`);
}

type Row = {
    gameid: string;
    game?: string | number;
    date?: string;           // "2025-01-11 11:11:24"
    league?: string;         // e.g. "LFL2"
    year?: string | number;  // e.g. "2025"
    split?: string;          // e.g. "Winter"
    playoffs?: string;
    patch?: string;
    url?: string;

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

type CommunityData = { workbook: XLSX.WorkBook } | { csvText: string };

function isProbablyXlsx(buffer: Buffer, contentType?: string | null) {
    if (buffer.length < 4) return false;
    if (contentType && /spreadsheetml|application\/vnd.openxmlformats-officedocument/i.test(contentType)) {
        return true;
    }
    // XLSX files are ZIP archives that start with "PK".
    return buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function parseCommunityBuffer(buffer: Buffer, contentType?: string | null): CommunityData | null {
    if (buffer.length === 0) return null;

    if (isProbablyXlsx(buffer, contentType)) {
        try {
            const workbook = XLSX.read(buffer, { type: "buffer" });
            return { workbook };
        } catch (error) {
            console.warn("[community] failed to parse workbook", error);
            return null;
        }
    }

    return { csvText: buffer.toString("utf-8") };
}

async function downloadCommunityWorkbookFromDrive(fileId: string): Promise<Buffer> {
    const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(fileId)}/export?format=xlsx`;

    let url = base;
    let res = await fetch(url, { redirect: "manual" });
    let cookie = res.headers.get("set-cookie") ?? "";

    while (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, url).toString();
        res = await fetch(url, {
            redirect: "manual",
            headers: cookie ? { cookie } : undefined,
        });
        cookie = res.headers.get("set-cookie") ?? cookie;
    }

    let contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
        const body = await res.text();
        const confirmMatch =
            body.match(/confirm=([0-9A-Za-z_]+)[^"]*/) ||
            body.match(/name="confirm" value="([0-9A-Za-z_]+)"/);

        if (!confirmMatch) {
            console.log("[community] workbook download returned HTML, sample:", body.slice(0, 300).replace(/\n/g, "\\n"));
            throw new Error("Drive returned HTML instead of XLSX. Ensure the sheet is publicly accessible.");
        }

        const confirm = confirmMatch[1];
        const confirmedUrl = `${base}&confirm=${confirm}`;
        res = await fetch(confirmedUrl, {
            redirect: "manual",
            headers: cookie ? { cookie } : undefined,
        });

        while (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
            const nextUrl = new URL(res.headers.get("location")!, confirmedUrl).toString();
            res = await fetch(nextUrl, {
                redirect: "manual",
                headers: cookie ? { cookie } : undefined,
            });
        }

        contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("text/html")) {
            const body2 = await res.text();
            console.log("[community] confirm download still HTML, sample:", body2.slice(0, 300).replace(/\n/g, "\\n"));
            throw new Error("Drive confirm download returned HTML. Ensure the sheet is publicly accessible.");
        }
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(
        `[community] downloaded workbook from drive (${(buffer.length / 1024).toFixed(1)} KiB, ${contentType || "unknown"})`
    );
    return buffer;
}

async function loadCommunityData(): Promise<CommunityData | null> {
    try {
        if (COMMUNITY_CSV_URL) {
            const res = await fetch(COMMUNITY_CSV_URL);
            if (!res.ok) throw new Error(`Failed to fetch community sheet (${res.status})`);
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            return parseCommunityBuffer(buffer, res.headers.get("content-type"));
        }

        if (COMMUNITY_CSV_PATH) {
            const fs = await import("node:fs/promises");
            const path = await import("node:path");
            const resolved = path.isAbsolute(COMMUNITY_CSV_PATH)
                ? COMMUNITY_CSV_PATH
                : path.join(process.cwd(), COMMUNITY_CSV_PATH);
            const buffer = await fs.readFile(resolved);
            return parseCommunityBuffer(buffer, undefined);
        }

        if (COMMUNITY_DRIVE_FILE_ID) {
            const buffer = await downloadCommunityWorkbookFromDrive(COMMUNITY_DRIVE_FILE_ID);
            return parseCommunityBuffer(buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        }
    } catch (error) {
        console.warn("[community] failed to load community data", error);
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

function parseGameInSeries(row: Row, gameId: string): number {
    const raw = row.game;
    if (raw !== undefined && raw !== null) {
        const value = Number.parseInt(String(raw), 10);
        if (!Number.isNaN(value) && value > 0) {
            return value;
        }
    }

    const hyphenMatch = gameId.match(/-(\d+)$/);
    if (hyphenMatch) {
        const parsed = Number.parseInt(hyphenMatch[1], 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
            return parsed;
        }
    }

    const trailingDigits = gameId.match(/(\d+)(?!.*\d)/);
    if (trailingDigits) {
        const parsed = Number.parseInt(trailingDigits[1], 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
            return parsed;
        }
    }

    return 1;
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
            value: entry.count,
            valueUnit: "bans",
            formattedValue: `${entry.count} bans`,
        })),
    };

    const pentakillers = parsePlayerSection(matrix, "🔗 Pentakillers");
    metrics["player_has_pentakill"] = {
        type: "entity",
        entries: pentakillers.map((entry) => ({
            id: entry.player,
            name: entry.player,
            value: entry.count,
            valueUnit: `pentakill${entry.count === 1 ? "" : "s"}`,
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
            value: entry.count,
            valueUnit: `first blood${entry.count === 1 ? "" : "s"}`,
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
            value: entry.count,
            valueUnit: `elder${entry.count === 1 ? "" : "s"}`,
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
            value: entry.count,
            valueUnit: `steal${entry.count === 1 ? "" : "s"}`,
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
            value: entry.time,
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

type SheetMatrix = string[][];

function sheetToMatrix(workbook: XLSX.WorkBook, sheetName: string): SheetMatrix {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
        header: 1,
        raw: false,
        blankrows: false,
    });

    return rows.map((row) =>
        row.map((cell) => {
            if (cell === undefined || cell === null) return "";
            if (typeof cell === "string") return cell.trim();
            return String(cell).trim();
        })
    );
}

function parseWorkbookChampionSection(matrix: SheetMatrix, header: string) {
    if (matrix.length < 2) return [] as { name: string; count: number }[];
    const headerRow = matrix[1];
    const baseCol = headerRow.findIndex((cell) => cell === header);
    if (baseCol === -1) return [];

    const entries: { name: string; count: number }[] = [];
    for (let r = 2; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row) continue;
        const name = row[baseCol + 2]?.trim();
        const countCell = row[baseCol + 3]?.trim();
        if (!name && !countCell) break;
        if (!name) continue;

        const count = Number((countCell ?? "").replace(/[^0-9.]/g, ""));
        if (Number.isNaN(count)) continue;

        entries.push({ name, count });
    }

    return entries;
}

function parseWorkbookPlayerSection(matrix: SheetMatrix, header: string) {
    if (matrix.length < 2) return [] as { player: string; region: string; team: string; count: number }[];
    const headerRow = matrix[1];
    const baseCol = headerRow.findIndex((cell) => cell === header);
    if (baseCol === -1) return [];

    const entries: { player: string; region: string; team: string; count: number }[] = [];
    for (let r = 2; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row) continue;
        const player = row[baseCol + 4]?.trim();
        const countCell = row[baseCol + 5]?.trim();
        if (!player && !countCell) break;
        if (!player) continue;

        const count = Number((countCell ?? "").replace(/[^0-9.]/g, ""));
        if (Number.isNaN(count)) continue;

        const region = row[baseCol + 1]?.trim() ?? "";
        const team = row[baseCol + 3]?.trim() ?? "";
        entries.push({ player, region, team, count });
    }

    return entries;
}

function parseWorkbookTeamSection(matrix: SheetMatrix, header: string) {
    if (matrix.length < 2) return [] as { team: string; region: string; count: number }[];
    const headerRow = matrix[1];
    const baseCol = headerRow.findIndex((cell) => cell === header);
    if (baseCol === -1) return [];

    const entries: { team: string; region: string; count: number }[] = [];
    for (let r = 2; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row) continue;
        const team = row[baseCol + 3]?.trim();
        const countCell = row[baseCol + 4]?.trim();
        if (!team && !countCell) break;
        if (!team) continue;

        const count = Number((countCell ?? "").replace(/[^0-9.]/g, ""));
        if (Number.isNaN(count)) continue;

        const region = row[baseCol + 1]?.trim() ?? "";
        entries.push({ team, region, count });
    }

    return entries;
}

function parseWorkbookFastestWins(matrix: SheetMatrix, header: string) {
    if (matrix.length < 2) return [] as {
        team: string;
        region: string;
        opponentRegion: string;
        opponentTeam: string;
        time: string;
    }[];
    const headerRow = matrix[1];
    const baseCol = headerRow.findIndex((cell) => cell === header);
    if (baseCol === -1) return [];

    const entries: {
        team: string;
        region: string;
        opponentRegion: string;
        opponentTeam: string;
        time: string;
    }[] = [];

    for (let r = 2; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row) continue;
        const team = row[baseCol + 3]?.trim();
        const time = row[baseCol + 8]?.trim();
        if (!team && !time) break;
        if (!team || !time) continue;

        const region = row[baseCol + 1]?.trim() ?? "";
        const opponentRegion = row[baseCol + 5]?.trim() ?? "";
        const opponentTeam = row[baseCol + 7]?.trim() ?? "";

        entries.push({ team, region, opponentRegion, opponentTeam, time });
    }

    return entries;
}

function parseWorkbookEventTotal(matrix: SheetMatrix, header: string) {
    if (matrix.length < 2) return null as { value: number | null; message?: string } | null;
    const row = matrix[1];
    const baseCol = row.findIndex((cell) => cell === header);
    if (baseCol === -1) return null;

    for (let c = baseCol + 1; c < row.length; c++) {
        const cell = row[c]?.trim();
        if (!cell) continue;
        const value = Number(cell.replace(/[^0-9.]/g, ""));
        if (Number.isNaN(value)) continue;
        return { value, message: undefined };
    }

    return null;
}

function buildCommunityMetricResultsFromWorkbook(workbook: XLSX.WorkBook): Record<string, MetricResult> {
    const metrics: Record<string, MetricResult> = {};

    const championMatrix = sheetToMatrix(workbook, "2-Champions");
    const bans = parseWorkbookChampionSection(championMatrix, "Most banned");
    metrics["champion_total_bans"] = {
        type: "entity",
        entries: bans.map((entry) => ({
            id: entry.name,
            name: entry.name,
            value: entry.count,
            valueUnit: "bans",
            formattedValue: `${entry.count} bans`,
        })),
    };

    const playerMatrix = sheetToMatrix(workbook, "3-Players");
    const pentakillers = parseWorkbookPlayerSection(playerMatrix, "Pentakillers");
    metrics["player_has_pentakill"] = {
        type: "entity",
        entries: pentakillers.map((entry) => ({
            id: entry.player,
            name: entry.player,
            value: entry.count,
            valueUnit: `pentakill${entry.count === 1 ? "" : "s"}`,
            formattedValue: `${entry.count} pentakill${entry.count === 1 ? "" : "s"}`,
            detail: [entry.team, entry.region].filter(Boolean).join(" • ") || undefined,
        })),
    };

    const firstBloods = parseWorkbookPlayerSection(playerMatrix, "Most First Bloods");
    metrics["player_first_bloods"] = {
        type: "entity",
        entries: firstBloods.map((entry) => ({
            id: entry.player,
            name: entry.player,
            value: entry.count,
            valueUnit: `first blood${entry.count === 1 ? "" : "s"}`,
            formattedValue: `${entry.count} first blood${entry.count === 1 ? "" : "s"}`,
            detail: [entry.team, entry.region].filter(Boolean).join(" • ") || undefined,
        })),
    };

    const teamMatrix = sheetToMatrix(workbook, "4-Teams");
    const elderDrakes = parseWorkbookTeamSection(teamMatrix, "Most Elder Dragons");
    metrics["team_elder_drakes_killed"] = {
        type: "entity",
        entries: elderDrakes.map((entry) => ({
            id: entry.team,
            name: entry.team,
            value: entry.count,
            valueUnit: `elder${entry.count === 1 ? "" : "s"}`,
            formattedValue: `${entry.count} elder${entry.count === 1 ? "" : "s"}`,
            detail: entry.region || undefined,
        })),
    };

    const baronSteals = parseWorkbookTeamSection(teamMatrix, "Most Baron Steals");
    metrics["team_baron_steals"] = {
        type: "entity",
        entries: baronSteals.map((entry) => ({
            id: entry.team,
            name: entry.team,
            value: entry.count,
            valueUnit: `steal${entry.count === 1 ? "" : "s"}`,
            formattedValue: `${entry.count} steal${entry.count === 1 ? "" : "s"}`,
            detail: entry.region || undefined,
        })),
    };

    const fastestWins = parseWorkbookFastestWins(teamMatrix, "Fastest win");
    metrics["team_shortest_win_game_time_seconds"] = {
        type: "entity",
        entries: fastestWins.map((entry) => ({
            id: `${entry.team}-${entry.time}`,
            name: entry.team,
            value: entry.time,
            formattedValue: entry.time,
            detail:
                [entry.region, "vs", entry.opponentTeam, entry.opponentRegion]
                    .filter(Boolean)
                    .join(" ") || undefined,
        })),
    };

    const eventMatrix = sheetToMatrix(workbook, "5-Event");
    const pentakillTotal = parseWorkbookEventTotal(eventMatrix, "Pentakills");
    metrics["event_total_pentakills"] = {
        type: "number",
        value: pentakillTotal?.value ?? null,
    };

    const baronTotal = parseWorkbookEventTotal(eventMatrix, "Baron Steals");
    metrics["event_total_baron_steals"] = {
        type: "number",
        value: baronTotal?.value ?? null,
    };

    const reverseSweeps = parseWorkbookEventTotal(eventMatrix, "Reverse sweeps");
    metrics["event_knockout_reverse_sweeps"] = {
        type: "number",
        value: reverseSweeps?.value ?? null,
    };

    return metrics;
}

const teamLookupCache = new Map<string, number | null>();

function normalizeTeamName(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function resolveTeamId(name: string) {
    if (!name) return null;
    const key = normalizeTeamName(name);
    if (teamLookupCache.has(key)) {
        return teamLookupCache.get(key) ?? null;
    }

    const team = await prisma.team.findFirst({
        where: {
            OR: [
                { slug: key },
                { slug: name.toLowerCase() },
                { displayName: { equals: name, mode: "insensitive" } },
            ],
        },
    });

    const id = team?.id ?? null;
    teamLookupCache.set(key, id);
    return id;
}

function winsNeeded(bestOf: number) {
    return Math.floor(bestOf / 2) + 1;
}

async function updateSeriesStatuses(seriesIds: number[]) {
    for (const seriesId of seriesIds) {
        const series = await prisma.series.findUnique({
            where: { id: seriesId },
            include: { matches: true },
        });
        if (!series) continue;

        const blueWins = series.matches.filter((m) => m.winnerTeamId === series.blueTeamId).length;
        const redWins = series.matches.filter((m) => m.winnerTeamId === series.redTeamId).length;
        const needed = winsNeeded(series.bestOf);

        let status = series.status;
        let winnerTeamId: number | null = series.winnerTeamId;
        if (blueWins >= needed && series.blueTeamId) {
            winnerTeamId = series.blueTeamId;
            status = "completed";
        } else if (redWins >= needed && series.redTeamId) {
            winnerTeamId = series.redTeamId;
            status = "completed";
        } else {
            const completedGames = series.matches.filter((m) => m.status === "completed").length;
            if (completedGames > 0) status = "in_progress";
        }

        await prisma.series.update({
            where: { id: series.id },
            data: {
                blueTeamId: series.blueTeamId,
                redTeamId: series.redTeamId,
                winnerTeamId,
                status,
            },
        });
    }
}

async function syncMatchesFromOracle() {
    const matches = await prisma.match.findMany({
        where: { oracleGameId: { not: null } },
        include: { series: { include: { stage: true } } },
    });

    if (matches.length === 0) return;

    const games = await prisma.game.findMany({
        where: { oracleGameId: { in: matches.map((m) => m.oracleGameId!).filter(Boolean) } },
    });
    const gameByOracleId = new Map(games.map((g) => [g.oracleGameId!, g]));

    const seriesToUpdate = new Set<number>();
    const tournaments = new Set<number>();

    for (const match of matches) {
        if (!match.oracleGameId) continue;
        const game = gameByOracleId.get(match.oracleGameId);
        if (!game) continue;

        let winnerTeamId: number | null = match.winnerTeamId ?? null;
        if (!winnerTeamId) {
            winnerTeamId = await resolveTeamId(game.winnerTeam);
        }

        let blueTeamId = match.blueTeamId;
        if (!blueTeamId) {
            blueTeamId = await resolveTeamId(game.blueTeam);
        }

        let redTeamId = match.redTeamId;
        if (!redTeamId) {
            redTeamId = await resolveTeamId(game.redTeam);
        }

        const updateData: Record<string, unknown> = {};
        if (winnerTeamId) updateData.winnerTeamId = winnerTeamId;
        if (blueTeamId) updateData.blueTeamId = blueTeamId;
        if (redTeamId) updateData.redTeamId = redTeamId;
        if (winnerTeamId) updateData.status = "completed";

        if (Object.keys(updateData).length > 0) {
            await prisma.match.update({ where: { id: match.id }, data: updateData });
            seriesToUpdate.add(match.seriesId);
            tournaments.add(match.series.stage.tournamentId);
        }
    }

    await updateSeriesStatuses(Array.from(seriesToUpdate));

    for (const tournamentId of tournaments) {
        const result = await rebuildTournamentElo(tournamentId);
        console.log(
            `[ratings] tournament ${tournamentId} Elo updated: teams=${result.teamsUpdated} matches=${result.matchesProcessed}`,
        );
    }
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

type GameMetadata = {
    tournament: string;
    stage: string;
    dateUtc: Date;
    patch: string | null;
    blueTeam: string;
    redTeam: string;
    winnerTeam: string;
    seriesId: string;
    gameInSeries: number;
};

    const metadataByGame = new Map<string, GameMetadata>();
    for (const [gid, group] of games) {
        const g0 = group[0];
        const tournament = g0.league ?? "Unknown";
        const stage = g0.split ?? g0.playoffs ?? "Regular";
        const dateUtc = toUtcDate(g0.date);
        const patch = g0.patch ?? null;
        const blueTeam = group.find((r) => (r.side ?? "").toLowerCase() === "blue")?.teamname ?? "Blue";
        const redTeam = group.find((r) => (r.side ?? "").toLowerCase() === "red")?.teamname ?? "Red";
        const winnerTeam = group.find((r) => toBoolWin(r.result))?.teamname ?? blueTeam;
        const gameInSeries = Math.max(1, parseGameInSeries(g0, gid));
        const seriesId = buildSeriesId({
            league: tournament,
            year: g0.year,
            stage,
            dateUtc,
            blueTeam,
            redTeam,
        });
        metadataByGame.set(gid, {
            tournament,
            stage,
            dateUtc,
            patch,
            blueTeam,
            redTeam,
            winnerTeam,
            seriesId,
            gameInSeries,
        });
    }

    let created = 0,
        updated = 0,
        statsInserted = 0;

    for (const [gid, group] of games) {
        const meta = metadataByGame.get(gid);
        if (!meta) continue;
        const gameData = {
            tournament: meta.tournament,
            stage: meta.stage,
            dateUtc: meta.dateUtc,
            patch: meta.patch,
            blueTeam: meta.blueTeam,
            redTeam: meta.redTeam,
            winnerTeam: meta.winnerTeam,
            seriesId: meta.seriesId,
            gameInSeries: meta.gameInSeries,
        } satisfies Parameters<typeof prisma.game.create>[0]["data"];

        const existing = await prisma.game.findUnique({ where: { oracleGameId: gid } });
        let gameId: bigint;
        if (existing) {
            await prisma.game.update({ where: { id: existing.id }, data: gameData });
            gameId = existing.id;
            updated++;
        } else {
            const g = await prisma.game.create({
                data: {
                    oracleGameId: gid,
                    ...gameData,
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

    await ensureExternalMetricTable();
    const summary = await recomputeAndStoreCrystalBallSummary(SEASON);
    console.log(
        `[crystal-ball] summary updated: games=${summary.totalGames}, matches=${summary.totalMatches}, maxRemaining=${summary.maxRemainingMatches ?? "n/a"}`,
    );

    const communityData = await loadCommunityData();
    if (communityData) {
        const communityMetrics =
            "workbook" in communityData
                ? buildCommunityMetricResultsFromWorkbook(communityData.workbook)
                : buildCommunityMetricResults(parseCommunityMatrix(communityData.csvText.replace(/^\uFEFF/, "")));
        const entries = Object.entries(communityMetrics);
        type ExternalMetricDataValue = Parameters<
            typeof prisma.externalMetric.upsert
        >[0]["create"]["data"];

        for (const [metricId, data] of entries) {
            const payload = data as unknown as ExternalMetricDataValue;
            await prisma.externalMetric.upsert({
                where: { metricId },
                create: { metricId, data: payload }, // Prisma sets createdAt; updatedAt managed automatically
                update: { data: payload },
            });
        }

        console.log(`[community] synced ${entries.length} metrics from community sheet`);
    } else {
        console.warn("[community] skipped syncing metrics (no data available)");
    }

    await syncMatchesFromOracle();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
