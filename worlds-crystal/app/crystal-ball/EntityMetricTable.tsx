"use client";

import { useMemo, useState } from "react";
import { MetricEntityEntry } from "@/lib/metric-results";

const INITIAL_VISIBLE_COUNT = 5;

type EntitySelectionInfo = {
    type: "entity";
    label: string;
    matchId: string;
    entry: MetricEntityEntry | null;
};

interface EntityMetricTableProps {
    entries: MetricEntityEntry[];
    selection?: EntitySelectionInfo;
}

export function EntityMetricTable({ entries, selection }: EntityMetricTableProps) {
    const [showAll, setShowAll] = useState(false);

    const highlightId = selection?.matchId ?? null;

    const { visibleEntries, hasHighlightedRow, highlightInVisible } = useMemo(() => {
        const sliced = showAll ? entries : entries.slice(0, INITIAL_VISIBLE_COUNT);
        const highlightInAll = highlightId ? entries.some((entry) => entry.id === highlightId) : false;
        const highlightVisible = highlightId ? sliced.some((entry) => entry.id === highlightId) : false;
        return {
            visibleEntries: sliced,
            hasHighlightedRow: highlightInAll,
            highlightInVisible: highlightVisible,
        };
    }, [entries, highlightId, showAll]);

    const showHighlightRow = Boolean(highlightId && !highlightInVisible);
    const highlightRowMessage = highlightId
        ? hasHighlightedRow
            ? "Currently outside the top 5"
            : "Not currently in the top results"
        : null;

    const selectionNoteSuffix = highlightId
        ? hasHighlightedRow
            ? highlightInVisible
                ? ""
                : " (outside the current top 5)"
            : " (not currently in the top results)"
        : "";

    return (
        <div className="space-y-3">
            <table className="w-full text-sm border">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-right">Value</th>
                        <th className="p-2 text-right">Details</th>
                    </tr>
                </thead>
                <tbody>
                    {visibleEntries.map((entry) => {
                        const isHighlighted = highlightId === entry.id;
                        const rowClass = `border-t${isHighlighted ? " bg-blue-50" : ""}`;
                        const nameClass = `p-2${isHighlighted ? " font-semibold text-blue-700" : ""}`;
                        const valueClass = `p-2 text-right${isHighlighted ? " font-semibold text-blue-700" : ""}`;
                        const detailClass = isHighlighted
                            ? "p-2 text-right text-blue-600"
                            : "p-2 text-right text-gray-500";

                        return (
                            <tr key={entry.id} className={rowClass}>
                                <td className={nameClass}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span>{entry.name}</span>
                                        {isHighlighted ? (
                                            <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                                Your pick
                                            </span>
                                        ) : null}
                                    </div>
                                </td>
                                <td className={valueClass}>{entry.formattedValue}</td>
                                <td className={detailClass}>{entry.detail ?? "—"}</td>
                            </tr>
                        );
                    })}
                    {showHighlightRow && selection ? (
                        <tr className="border-t bg-blue-50">
                            <td className="p-2 font-semibold text-blue-700">
                                <div className="flex flex-col">
                                    <span>Your pick: {selection.label}</span>
                                    {highlightRowMessage ? (
                                        <span className="text-xs font-normal text-blue-600">{highlightRowMessage}</span>
                                    ) : null}
                                </div>
                            </td>
                            <td className="p-2 text-right font-semibold text-blue-700">
                                {selection.entry ? selection.entry.formattedValue : "—"}
                            </td>
                            <td className="p-2 text-right text-blue-600">
                                {selection.entry ? selection.entry.detail ?? "—" : "No live data"}
                            </td>
                        </tr>
                    ) : null}
                </tbody>
            </table>
            {entries.length > INITIAL_VISIBLE_COUNT ? (
                <div className="flex justify-end">
                    <button
                        type="button"
                        className="text-sm font-medium text-blue-700 hover:text-blue-800"
                        onClick={() => setShowAll((current) => !current)}
                    >
                        {showAll ? "Show less" : "Show more"}
                    </button>
                </div>
            ) : null}
            {selection ? (
                <p className="text-sm text-blue-700">
                    Your pick: <span className="font-semibold">{selection.label}</span>
                    {selectionNoteSuffix}
                </p>
            ) : null}
            {selection && !selection.entry ? (
                <p className="text-sm text-blue-700">Live data for your pick isn&apos;t available yet.</p>
            ) : null}
        </div>
    );
}
