import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Calls the secure read-only gateway to the iSchool production replica.
 * The browser only sends a query key + safe params — never SQL.
 */
export async function runReplicaQuery<T = Record<string, unknown>>(
  query: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const { data, error } = await supabase.functions.invoke("ischool-replica-query", {
    body: { query, params },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return (data?.rows ?? []) as T[];
}

export function useReplicaQuery<T = Record<string, unknown>>(
  query: string | null,
  params: Record<string, unknown> = {},
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled !== false && !!query;
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paramsKey = useMemo(() => JSON.stringify(params ?? {}), [params]);
  const reqId = useRef(0);

  const fetchRows = useCallback(async () => {
    if (!enabled || !query) return;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await runReplicaQuery<T>(query, JSON.parse(paramsKey));
      if (id === reqId.current) setRows(result);
    } catch (e) {
      if (id === reqId.current) {
        setError(e instanceof Error ? e.message : "Failed to load data");
        setRows([]);
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [enabled, query, paramsKey]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  return { rows, loading, error, refetch: fetchRows };
}
