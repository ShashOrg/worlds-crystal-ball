// scripts/ingest-oracle.ts
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import {prisma} from "@/lib/prisma";

// ---- Config you can tweak
const YEAR = process.env.ORACLE_YEAR ?? "2025";
const DOWNLOAD_URL =
    process.env.ORACLE_CSV_URL // if you want to pin a URL explicitly
    ?? `https://oracleselixir.com/tools/downloads`; // we'll accept a pre-downloaded file too

// If you prefer to keep a local copy, set ORACLE_CSV_PATH to a .csv you downloaded manually.
const LOCAL_PATH = process.env.ORACLE_CSV_PATH ?? "";

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
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
