"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { apiPost } from "@/lib/client/api";
import { setPlayerSession } from "@/lib/client/storage";

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode.length !== 6) {
      setError("Le code de salle fait 6 caractères.");
      return;
    }
    if (!pseudo.trim()) {
      setError("Choisis un pseudo.");
      return;
    }
    setLoading(true);
    try {
      const result = await apiPost<{ playerId: string; token: string }>(
        `/api/rooms/${normalizedCode}/join`,
        { pseudo }
      );
      setPlayerSession(normalizedCode, {
        playerId: result.playerId,
        token: result.token,
        teamId: null,
        pseudo,
      });
      router.push(`/play/${normalizedCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de rejoindre la salle");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="" className="h-12 w-12" />
          <h1 className="text-3xl font-bold tracking-tight">Usine</h1>
        </div>
        <p className="mt-2 text-slate-400">Jeu de gestion d&apos;usine en équipes, pour la classe.</p>
      </div>

      <Card className="w-full max-w-sm">
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Code de la salle</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="AB3XYZ"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center text-2xl font-mono tracking-[0.3em] uppercase outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Pseudo</label>
            <input
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              maxLength={24}
              placeholder="Ton pseudo"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Connexion…" : "Rejoindre la salle"}
          </Button>
        </form>
      </Card>

      <div className="text-center text-sm text-slate-500">
        Enseignant ?{" "}
        <Link href="/host/new" className="text-emerald-400 hover:underline">
          Créer une salle
        </Link>
      </div>
    </main>
  );
}
