import { useCallback, useEffect, useState } from "react";
import { isAbortError } from "../api";

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface Settled<T> {
  fn: (signal: AbortSignal) => Promise<T>;
  nonce: number;
  error: string | null;
}

export function useApi<T>(fn: (signal: AbortSignal) => Promise<T>): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [nonce, setNonce] = useState(0);
  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    fn(ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setData(d);
        setSettled({ fn, nonce, error: null });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted || isAbortError(e)) return;
        setSettled({ fn, nonce, error: e instanceof Error ? e.message : String(e) });
      });
    return () => ctrl.abort();
  }, [fn, nonce]);

  const current = settled !== null && settled.fn === fn && settled.nonce === nonce;
  return {
    data,
    loading: !current,
    error: current ? settled.error : null,
    refetch,
  };
}
