"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface PollingResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * Interroge une URL toutes les `intervalMs` (2000 par défaut, cf. section 5.6 : le polling est
 * le choix par défaut pour la synchronisation temps réel).
 */
export function usePolling<T>(
  url: string | null,
  headers: Record<string, string> = {},
  intervalMs = 2000
): PollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Sérialisé pour servir de dépendance stable : `headers` est un objet littéral recréé à
  // chaque rendu côté appelant.
  const headersKey = JSON.stringify(headers);
  const stableHeaders = useMemo(() => headers, [headersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOnce = useCallback(async () => {
    if (!url) return;
    try {
      const res = await fetch(url, { headers: stableHeaders, cache: "no-store" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Erreur");
        return;
      }
      setData(body as T);
      setError(null);
    } catch {
      setError("Connexion au serveur impossible");
    } finally {
      setLoading(false);
    }
  }, [url, stableHeaders]);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      if (cancelled) return;
      await fetchOnce();
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    }
    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url, intervalMs, fetchOnce]);

  return { data, error, loading, refresh: fetchOnce };
}
