"use client";

import { useMemo, useState } from "react";
import { MetricEntityEntry } from "@/lib/metric-results";

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
            <table className="w-full text-sm border-base">
                <thead>
                    <tr className="bg-card">
                        <th className="p-2 text-left">{columns.name}</th>
                        <th className="p-2 text-right">{columns.value}</th>
                        {showDetailColumn ? (
                            <th className="p-2 text-right">{columns.detail}</th>
                        ) : null}
                    </tr>
                </thead>
                <tbody>
                    {visibleEntries.map((entry) => {
                        const isHighlighted = highlightId === entry.id;
                        const rowClass = [
                            "border-t border-border",
                            isHighlighted ? "bg-accent/10" : "",
                        ]
                            .filter(Boolean)
                            .join(" ");
                        const nameClass = [
                            "p-2",
                            isHighlighted ? "font-semibold text-accent" : "",
                        ]
                            .filter(Boolean)
                            .join(" ");
                        const valueClass = [
                            "p-2 text-right",
                            isHighlighted ? "font-semibold text-accent" : "",
                        ]
                            .filter(Boolean)
                            .join(" ");
                        const detailClass = isHighlighted
                            ? "p-2 text-right text-accent"
                            : "p-2 text-right text-muted";

                        return (
                            <tr key={entry.id} className={rowClass}>
                                <td className={nameClass}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span>{entry.name}</span>
                                        {isHighlighted ? (
                                            <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                                                Your pick
                                            </span>
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
                        <tr className="border-t border-border bg-accent/10">
                            <td className="p-2 font-semibold text-accent">
                                <div className="flex flex-col">
                                    <span>Your pick: {selection.label}</span>
                                    {highlightRowMessage ? (
                                        <span className="text-xs font-normal text-accent">{highlightRowMessage}</span>
                                    ) : null}
                                </div>
                            </td>
                            <td className="p-2 text-right font-semibold text-accent">
                                {selection.entry ? getValueDisplay(selection.entry) : "—"}
                            </td>
                            {showDetailColumn ? (
                                <td className="p-2 text-right text-accent">
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
