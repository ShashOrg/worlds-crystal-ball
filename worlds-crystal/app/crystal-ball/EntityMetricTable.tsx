"use client";

import { useMemo, useState } from "react";
import { MetricEntityEntry } from "@/lib/metric-results";
import { cn } from "@/lib/utils";

const STANDARD_UNIT_SUFFIXES = [
    "picks",
    "pick",
    "bans",
    "ban",
    "first bloods",
    "first blood",
    "firstbloods",
    "firstblood",
    "elder dragons",
    "elder dragon",
    "elder",
    "elders",
    "baron steals",
    "baron steal",
    "steals",
    "steal",
    "kills",
    "kill",
    "games",
    "game",
    "champions",
    "champion",
];

function normalizeUnitCandidate(raw: string | undefined | null): string | null {
    if (!raw) {
        return null;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
        return null;
    }
    return trimmed.toLowerCase().replace(/\s+/g, " ");
}

function singularizeWord(word: string): string {
    if (word.endsWith("ies")) {
        return `${word.slice(0, -3)}y`;
    }
    if (/(?:ses|xes|zes|ches|shes)$/.test(word)) {
        return word.slice(0, -2);
    }
    if (word.endsWith("s") && !word.endsWith("ss")) {
        return word.slice(0, -1);
    }
    return word;
}

function addUnitVariants(target: Set<string>, raw?: string | null) {
    const normalized = normalizeUnitCandidate(raw);
    if (!normalized) {
        return;
    }

    const variations = new Set<string>();
    variations.add(normalized);

    const words = normalized.split(" ");
    const lastWord = words[words.length - 1];
    const singularLast = singularizeWord(lastWord);
    if (singularLast !== lastWord) {
        variations.add([...words.slice(0, -1), singularLast].join(" "));
    }

    if (normalized.endsWith("ies")) {
        variations.add(`${normalized.slice(0, -3)}y`);
    }
    if (normalized.endsWith("es")) {
        variations.add(normalized.slice(0, -2));
    }
    if (normalized.endsWith("s")) {
        variations.add(normalized.slice(0, -1));
    }

    for (const variation of variations) {
        const cleaned = normalizeUnitCandidate(variation);
        if (cleaned) {
            target.add(cleaned);
        }
    }
}

function extractTrailingUnit(value: string | undefined | null): string | null {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    const match = trimmed.match(/^[-+]?\d+(?:[.,]\d+)?\s+([a-z][a-z\s\/-]*)$/i);
    if (!match) {
        return null;
    }
    return match[1];
}

function stripUnitSuffix(value: string, unitCandidates: Set<string>): string {
    const trimmed = value.trim();
    if (!trimmed) {
        return trimmed;
    }

    const match = trimmed.match(/^([-+]?\d+(?:[.,]\d+)?)(?:\s+([a-z][a-z\s\/-]*))?$/i);
    if (!match) {
        return trimmed;
    }

    const [, numericPart, unitPart] = match;
    if (!unitPart) {
        return numericPart;
    }

    const normalizedUnit = normalizeUnitCandidate(unitPart);
    if (normalizedUnit && unitCandidates.has(normalizedUnit)) {
        return numericPart;
    }

    return trimmed;
}

const INITIAL_VISIBLE_COUNT = 5;

type EntitySelectionInfo = {
    type: "entity";
    label: string;
    matchId: string;
    entry: MetricEntityEntry | null;
};

export interface EntityMetricTableColumns {
    name: string;
    value: string;
    detail?: string;
}

interface EntityMetricTableProps {
    entries: MetricEntityEntry[];
    selection?: EntitySelectionInfo;
    columns: EntityMetricTableColumns;
}

export function EntityMetricTable({ entries, selection, columns }: EntityMetricTableProps) {
    const [showAll, setShowAll] = useState(false);

    const highlightId = selection?.matchId ?? null;

    const unitCandidates = useMemo(() => {
        const candidates = new Set<string>();

        addUnitVariants(candidates, columns.value);

        for (const unit of STANDARD_UNIT_SUFFIXES) {
            addUnitVariants(candidates, unit);
        }

        const allEntries = [...entries, selection?.entry].filter(Boolean) as MetricEntityEntry[];
        for (const entry of allEntries) {
            addUnitVariants(candidates, entry.valueUnit);
            if (typeof entry.value === "string") {
                addUnitVariants(candidates, extractTrailingUnit(entry.value));
            }
            addUnitVariants(candidates, extractTrailingUnit(entry.formattedValue));
        }

        return candidates;
    }, [columns.value, entries, selection?.entry]);

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

    const showDetailColumn = Boolean(columns.detail);

    const getValueDisplay = (entry: MetricEntityEntry) => {
        if (entry.value !== undefined && entry.value !== null) {
            if (typeof entry.value === "number") {
                return entry.value.toLocaleString();
            }
            if (typeof entry.value === "string") {
                return stripUnitSuffix(entry.value, unitCandidates);
            }
            return entry.value;
        }
        if (entry.formattedValue) {
            return stripUnitSuffix(entry.formattedValue, unitCandidates);
        }
        return entry.formattedValue ?? "—";
    };
    return (
        <div className="space-y-3">
            <table
                className="stat-table w-full overflow-hidden rounded-xl border border-neutral-200 text-sm dark:border-neutral-700"
            >
                <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-200">
                    <tr>
                        <th className="px-3 py-2.5 text-left font-medium">{columns.name}</th>
                        <th className="px-3 py-2.5 text-right font-medium">{columns.value}</th>
                        {showDetailColumn ? (
                            <th className="px-3 py-2.5 text-right font-medium">{columns.detail}</th>
                        ) : null}
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-neutral-800 dark:divide-neutral-800 dark:text-neutral-100">
                    {visibleEntries.map((entry) => {
                        const isHighlighted = highlightId === entry.id;
                        const rowClass = cn(isHighlighted && "tr-your-pick");
                        const nameClass = cn(
                            "px-3 py-2.5",
                            isHighlighted && "font-semibold text-neutral-900 dark:text-neutral-50",
                        );
                        const valueClass = cn(
                            "px-3 py-2.5 text-right",
                            isHighlighted && "font-semibold text-neutral-900 dark:text-neutral-50",
                        );
                        const detailClass = cn(
                            "px-3 py-2.5 text-right text-neutral-500 dark:text-neutral-400",
                            isHighlighted && "font-semibold text-neutral-900 dark:text-neutral-50",
                        );

                        return (
                            <tr key={entry.id} className={rowClass}>
                                <td className={nameClass}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span>{entry.name}</span>
                                        {isHighlighted ? (
                                            <span className="your-pick-badge">YOUR PICK</span>
                                        ) : null}
                                    </div>
                                </td>
                                <td className={valueClass}>{getValueDisplay(entry)}</td>
                                {showDetailColumn ? (
                                    <td className={detailClass}>{entry.detail ?? "—"}</td>
                                ) : null}
                            </tr>
                        );
                    })}
                    {showHighlightRow && selection ? (
                        <tr className="tr-your-pick">
                            <td className="px-3 py-2.5">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">{selection.label}</span>
                                        <span className="your-pick-badge">YOUR PICK</span>
                                    </div>
                                    {highlightRowMessage ? (
                                        <span className="text-xs text-muted">{highlightRowMessage}</span>
                                    ) : null}
                                </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold">
                                {selection.entry ? getValueDisplay(selection.entry) : "—"}
                            </td>
                            {showDetailColumn ? (
                                <td className="px-3 py-2.5 text-right font-semibold">
                                    {selection.entry ? selection.entry.detail ?? "—" : "0"}
                                </td>
                            ) : null}
                        </tr>
                    ) : null}
                </tbody>
            </table>
            {entries.length > INITIAL_VISIBLE_COUNT ? (
                <div className="flex justify-end">
                    <button
                        type="button"
                        className="text-sm font-medium text-accent transition-opacity hover:opacity-80"
                        onClick={() => setShowAll((current) => !current)}
                    >
                        {showAll ? "Show less" : "Show more"}
                    </button>
                </div>
            ) : null}
        </div>
    );
}
