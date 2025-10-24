"use client";

import { useCallback, useEffect, useState } from "react";

type ProbabilityRow = {
  id: number;
  questionId: number;
  answerKey: string;
  probability: number;
  asOf: string;
  detailsJson: Record<string, unknown> | null;
};

export function useProbability(questionId: number) {
  const [data, setData] = useState<ProbabilityRow[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchData = useCallback(async () => {
    if (!questionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/probability/${questionId}`);
      if (!res.ok) throw new Error(`Failed to load probability (${res.status})`);
      const json = (await res.json()) as ProbabilityRow[];
      setData(json);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    error,
    loading,
    refresh: fetchData,
  };
}
