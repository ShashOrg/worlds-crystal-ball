"use client";

import { useState } from "react";

export default function ImportPage() {
    const [csv, setCsv] = useState("");
    const [result, setResult] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setResult(null);

        const res = await fetch("/api/import/csv", {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: csv,
        });

        const data = await res.json();
        setResult(JSON.stringify(data, null, 2));
        setLoading(false);
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Admin: CSV Import</h1>
            <p className="text-sm text-gray-600">
                Paste CSV with columns:
                <code className="ml-2">tournament,stage,dateUtc,patch,blueTeam,redTeam,winnerTeam,side,player,team,championKey,kills,deaths,assists,win</code>
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={14}
            className="w-full border rounded-md p-3 font-mono text-sm"
            placeholder="Paste CSV here…"
        />
                <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                    {loading ? "Importing…" : "Import CSV"}
                </button>
            </form>
            {result && (
                <pre className="bg-gray-50 rounded-md p-3 overflow-auto text-sm">{result}</pre>
            )}
        </div>
    );
}
