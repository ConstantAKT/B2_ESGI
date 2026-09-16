"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { apiPost } from "@/lib/client/api";
import { setHostToken } from "@/lib/client/storage";
import { GAME_EVENTS, DEFAULT_EVENT_SEQUENCE } from "@/engine/data/events";
import type { Difficulty, RoomSettings } from "@/engine/types";

const TURN_OPTIONS: RoomSettings["totalTurns"][] = [3, 5, 7];
const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "facile", label: "Facile" },
  { value: "normal", label: "Normal" },
  { value: "difficile", label: "Difficile" },
];

export default function NewRoomPage() {
  const router = useRouter();
  const [totalTurns, setTotalTurns] = useState<RoomSettings["totalTurns"]>(5);
  const [turnMinutes, setTurnMinutes] = useState(6);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [showResultsImmediately, setShowResultsImmediately] = useState(true);
  const [eventIds, setEventIds] = useState<string[]>(DEFAULT_EVENT_SEQUENCE.slice(0, 5));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activeEventIds = useMemo(() => {
    const next = [...eventIds];
    while (next.length < totalTurns) next.push(DEFAULT_EVENT_SEQUENCE[next.length % DEFAULT_EVENT_SEQUENCE.length]);
    return next.slice(0, totalTurns);
  }, [eventIds, totalTurns]);

  async function handleCreate() {
    setError(null);
    setLoading(true);
    try {
      const settings: Partial<RoomSettings> = {
        totalTurns,
        turnDurationSeconds: turnMinutes * 60,
        difficulty,
        showResultsImmediately,
        eventIds: activeEventIds,
      };
      const result = await apiPost<{ roomId: string; code: string; hostToken: string }>(
        "/api/rooms",
        settings
      );
      setHostToken(result.code, result.hostToken);
      router.push(`/host/${result.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer la salle");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-bold">Créer une salle</h1>
        <p className="mt-1 text-sm text-slate-400">Réglages de la partie, à définir avant le lancement.</p>
      </div>

      <Card className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Nombre de tours</label>
            <select
              value={totalTurns}
              onChange={(e) => setTotalTurns(Number(e.target.value) as RoomSettings["totalTurns"])}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            >
              {TURN_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t} tours
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Durée d&apos;un tour</label>
            <select
              value={turnMinutes}
              onChange={(e) => setTurnMinutes(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            >
              {[5, 6, 7, 8].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Difficulté</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={showResultsImmediately}
                onChange={(e) => setShowResultsImmediately(e.target.checked)}
                className="h-4 w-4"
              />
              Afficher les résultats détaillés après chaque tour
            </label>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-400">
            Événements ({activeEventIds.length} tours)
          </label>
          <div className="flex flex-col gap-2">
            {activeEventIds.map((id, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs text-slate-500">Tour {index + 1}</span>
                <select
                  value={id}
                  onChange={(e) => {
                    const next = [...activeEventIds];
                    next[index] = e.target.value;
                    setEventIds(next);
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                >
                  {GAME_EVENTS.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <Button onClick={handleCreate} disabled={loading}>
          {loading ? "Création…" : "Créer la salle"}
        </Button>
      </Card>
    </main>
  );
}
