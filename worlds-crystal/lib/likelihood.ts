export function binomialChanceToFinishTop(
    current: number,           // current picks for target
    leader: number,            // current leader picks
    gamesLeft: number,         // remaining games (estimate)
    meanPickRate: number       // baseline pick prob for the target champ (0..1)
) {
    // minimal, conservative: chance to get >= (leader - current + 1) additional picks
    const needed = Math.max(0, leader - current + 1);
    let p = 0;
    for (let k = needed; k <= gamesLeft; k++) {
        p += nCr(gamesLeft, k) * Math.pow(meanPickRate, k) * Math.pow(1 - meanPickRate, gamesLeft - k);
    }
    return p;
}

function nCr(n: number, r: number) {
    if (r < 0 || r > n) return 0;
    r = Math.min(r, n - r);
    let num = 1, den = 1;
    for (let i = 1; i <= r; i++) { num *= (n - r + i); den *= i; }
    return num / den;
}
