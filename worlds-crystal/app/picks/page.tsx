import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import Link from "next/link";
import {authOptions} from "@/app/api/auth/[...nextauth]/route";

export default async function PicksPage() {
    const session = await getServerSession(authOptions); // <-- pass options
    if (!session?.user?.id) {
        return (
            <div className="p-6">
                <p>
                    Please <a className="underline" href="/api/auth/signin">sign in</a> to save your picks.
                </p>
            </div>
        );
    }

    const season = 2025; // make this dynamic later
    const champions = await prisma.champion.findMany({ orderBy: { name: "asc" } });
    const players = await prisma.player.findMany({ orderBy: { handle: "asc" } });
    const existing = await prisma.userPick.findUnique({
        where: { userId_season: { userId: session.user.id, season } },
        include: { mostPickedChampion: true, highestWrChampion: true, highestKdaPlayer: true },
    });

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-semibold">My Crystal Ball Picks — {season}</h1>

            <form action="/api/picks/save" method="post" className="space-y-4">
                <input type="hidden" name="season" value={season} />

                <div>
                    <label className="block font-medium">Most Picked Champion</label>
                    <select name="mostPickedChampionId" defaultValue={existing?.mostPickedChampionId ?? ""} className="border rounded p-2 w-full">
                        <option value="">—</option>
                        {champions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block font-medium">Highest Win Rate (≥5)</label>
                    <select name="highestWrChampionId" defaultValue={existing?.highestWrChampionId ?? ""} className="border rounded p-2 w-full">
                        <option value="">—</option>
                        {champions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block font-medium">Highest KDA (Player)</label>
                    <select name="highestKdaPlayerId" defaultValue={existing?.highestKdaPlayerId ?? ""} className="border rounded p-2 w-full">
                        <option value="">—</option>
                        {players.map(p => <option key={p.id} value={p.id}>{p.handle}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <input id="teemo" type="checkbox" name="teemoPicked" defaultChecked={existing?.teemoPicked ?? false} />
                    <label htmlFor="teemo">Teemo will be picked</label>
                </div>

                <button className="border rounded px-4 py-2">Save Picks</button>
            </form>

            <Link className="underline" href="/crystal-ball">See Live Leaderboards</Link>
        </div>
    );
}
