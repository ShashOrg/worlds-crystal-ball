export interface MetricEntityEntry {
    id: string;
    name: string;
    formattedValue: string;
    value?: number | string;
    valueUnit?: string;
    detail?: string;
}

export type MetricResult =
    | { type: "entity"; entries: MetricEntityEntry[] }
    | { type: "number"; value: number | null; unit?: string }
    | { type: "boolean"; value: boolean | null }
    | { type: "unavailable"; message?: string };
