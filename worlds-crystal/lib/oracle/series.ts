export function parseSeriesFromOracleId(id: string) {
    const match = id.match(/(?:_G|[-_]?Game)(\d+)$/i);
    const gameNo = match ? Number.parseInt(match[1], 10) : 1;
    const seriesKey = id.replace(/(?:_G|[-_]?Game)\d+$/i, "");
    return { seriesKey, seriesGameNo: gameNo };
}
