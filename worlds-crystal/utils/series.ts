export function normTeamName(name?: string) {
    return (name ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

export function buildSeriesId(opts: {
    league?: string;
    year?: number | string;
    stage?: string;
    dateUtc: Date;
    blueTeam?: string;
    redTeam?: string;
}) {
    const league = (opts.league ?? "").toUpperCase();
    const year = opts.year !== undefined && opts.year !== null ? String(opts.year).trim() : "";
    const stage = (opts.stage ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
    const day = opts.dateUtc.toISOString().slice(0, 10);

    const teams = [normTeamName(opts.blueTeam), normTeamName(opts.redTeam)]
        .map((team, index) => (team ? team : `TEAM${index + 1}`))
        .sort();
    const pair = teams.join("_");

    return [league || "LOL", year, stage || "MAIN", day, pair]
        .filter(Boolean)
        .join("_");
}
