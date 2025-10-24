export type StatsHeaderProps = {
    numberOfSeries: number;
    numberOfGames: number;
    numberOfRemainingSeries: number;
    numberOfRemainingGames: number;
};

export function StatsHeader({
    numberOfSeries,
    numberOfGames,
    numberOfRemainingSeries,
    numberOfRemainingGames,
}: StatsHeaderProps) {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border p-4 shadow-sm">
                <h3 className="text-sm font-medium opacity-70">Series</h3>
                <div className="mt-2 flex items-baseline justify-between">
                    <div>
                        <div className="text-3xl font-semibold">{numberOfSeries.toLocaleString()}</div>
                        <div className="text-xs opacity-70">Played</div>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-semibold">{numberOfRemainingSeries.toLocaleString()}</div>
                        <div className="text-xs opacity-70">Remaining</div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border p-4 shadow-sm">
                <h3 className="text-sm font-medium opacity-70">Games</h3>
                <div className="mt-2 flex items-baseline justify-between">
                    <div>
                        <div className="text-3xl font-semibold">{numberOfGames.toLocaleString()}</div>
                        <div className="text-xs opacity-70">Played</div>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-semibold">{numberOfRemainingGames.toLocaleString()}</div>
                        <div className="text-xs opacity-70">Remaining</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
