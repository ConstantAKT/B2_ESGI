"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, StatTile, formatMoney, formatSeconds } from "@/components/ui";
import { apiPost } from "@/lib/client/api";
import { useHostToken } from "@/lib/client/storage";
import { usePolling } from "@/lib/client/usePolling";

interface TeamView {
  id: string;
  name: string;
  players: { id: string; pseudo: string }[];
  state: {
    cash: number;
    materials: number;
    finishedGoods: number;
    employees: number;
    debt: number;
    activeSanctions: string[];
    everSanctioned: boolean;
  } | null;
  actionValidated: boolean;
}

interface RankingEntry {
  teamId: string;
  name: string;
  cash: number;
  debt: number;
  employees: number;
  everSanctioned: boolean;
  value: number;
}

interface HostView {
  code: string;
  status: "lobby" | "playing" | "transition" | "ended";
  settings: { totalTurns: number; turnDurationSeconds: number; difficulty: string };
  currentTurn: number;
  totalTurns: number;
  paused: boolean;
  secondsRemaining: number;
  market: { materialBuyPrice: number; goodsSellPrice: number; trendIndex: -1 | 0 | 1 } | null;
  event: { label: string; description: string } | null;
  teams: TeamView[];
  unassignedPlayers: { id: string; pseudo: string }[];
  ranking: RankingEntry[];
  transition: {
    resolvedTurn: number;
    event: { label: string; description: string };
    report: { step: string; teamId: string; detail: string }[];
    costliestDecision: Record<string, { label: string; amount: number }>;
  } | null;
  finalRanking: RankingEntry[] | null;
  finalRecap: Record<string, { label: string; amount: number; turn: number }> | null;
}

export default function HostRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const hostToken = useHostToken(code);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (hostToken === null) router.replace("/host/new");
  }, [hostToken, router]);

  const { data, error, refresh } = usePolling<HostView>(
    hostToken ? `/api/rooms/${code}/host` : null,
    hostToken ? { "x-host-token": hostToken } : {},
    2000
  );

  async function call(path: string, body?: unknown) {
    if (!hostToken) return;
    setBusy(true);
    setActionError(null);
    try {
      await apiPost(`/api/rooms/${code}${path}`, body, { "x-host-token": hostToken });
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  }

  if (!hostToken) return null;
  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Card>
          <p className="text-rose-400">{error}</p>
        </Card>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center text-slate-500">Chargement…</main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Salle</p>
          <p className="font-mono text-4xl font-bold tracking-[0.3em]">{data.code}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={data.status === "playing" ? "success" : data.status === "ended" ? "default" : "warning"}>
            {statusLabel(data.status)}
          </Badge>
          {data.status === "playing" && (
            <span className="font-mono text-2xl">{formatSeconds(data.secondsRemaining)}</span>
          )}
        </div>
      </header>

      {actionError && <p className="text-sm text-rose-400">{actionError}</p>}

      {data.status === "lobby" && <LobbySection data={data} busy={busy} call={call} />}
      {data.status === "playing" && <PlayingSection data={data} busy={busy} call={call} />}
      {data.status === "transition" && <TransitionSection data={data} />}
      {data.status === "ended" && <EndedSection data={data} />}
    </main>
  );
}

function statusLabel(status: HostView["status"]) {
  switch (status) {
    case "lobby":
      return "Lobby";
    case "playing":
      return "Tour en cours";
    case "transition":
      return "Transition";
    case "ended":
      return "Partie terminée";
  }
}

function LobbySection({
  data,
  busy,
  call,
}: {
  data: HostView;
  busy: boolean;
  call: (path: string, body?: unknown) => Promise<void>;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Équipes</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.teams.map((team) => (
            <div key={team.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <p className="font-semibold">{team.name}</p>
              <ul className="mt-1 text-sm text-slate-400">
                {team.players.length === 0 && <li className="italic">Aucun membre</li>}
                {team.players.map((p) => (
                  <li key={p.id}>{p.pseudo}</li>
                ))}
              </ul>
            </div>
          ))}
          {data.teams.length === 0 && <p className="text-sm text-slate-500">Aucune équipe créée pour le moment.</p>}
        </div>

        {data.unassignedPlayers.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-slate-400">En attente d&apos;équipe :</p>
            <p className="text-sm text-slate-300">{data.unassignedPlayers.map((p) => p.pseudo).join(", ")}</p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => call("/host/auto-assign", {})}>
            Répartir automatiquement
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Contrôles</h2>
        <div className="flex flex-col gap-3 text-sm text-slate-400">
          <p>Tours : {data.settings.totalTurns}</p>
          <p>Durée d&apos;un tour : {Math.round(data.settings.turnDurationSeconds / 60)} min</p>
          <p>Difficulté : {data.settings.difficulty}</p>
        </div>
        <Button
          className="mt-4 w-full"
          disabled={busy || data.teams.length < 2}
          onClick={() => call("/host/start", {})}
        >
          Lancer la partie
        </Button>
        {data.teams.length < 2 && (
          <p className="mt-2 text-xs text-amber-400">Au moins 2 équipes sont nécessaires.</p>
        )}
      </Card>
    </div>
  );
}

function PlayingSection({
  data,
  busy,
  call,
}: {
  data: HostView;
  busy: boolean;
  call: (path: string, body?: unknown) => Promise<void>;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Tour {data.currentTurn} / {data.totalTurns}
          </h2>
          {data.event && <Badge tone="warning">{data.event.label}</Badge>}
        </div>
        {data.market && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <StatTile label="Prix matière" value={formatMoney(data.market.materialBuyPrice)} />
            <StatTile label="Prix de vente" value={formatMoney(data.market.goodsSellPrice)} />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2">Équipe</th>
                <th>Trésorerie</th>
                <th>Employés</th>
                <th>Dette</th>
                <th>Validé</th>
              </tr>
            </thead>
            <tbody>
              {data.teams.map((t) => (
                <tr key={t.id} className="border-t border-slate-800">
                  <td className="py-2 font-medium">{t.name}</td>
                  <td className={t.state && t.state.cash < 0 ? "text-rose-400" : ""}>
                    {t.state ? formatMoney(t.state.cash) : "—"}
                  </td>
                  <td>{t.state?.employees ?? "—"}</td>
                  <td>{t.state ? formatMoney(t.state.debt) : "—"}</td>
                  <td>{t.actionValidated ? <Badge tone="success">✓</Badge> : <Badge>en cours</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Contrôles</h2>
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => call(data.paused ? "/host/resume" : "/host/pause", {})}
          >
            {data.paused ? "Reprendre" : "Mettre en pause"}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => call("/host/extend", { seconds: 60 })}>
            + 60 secondes
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => call("/host/force-resolve", {})}>
            Forcer la résolution du tour
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => call("/host/end", {})}>
            Terminer la partie
          </Button>
        </div>
      </Card>
    </div>
  );
}

function TransitionSection({ data }: { data: HostView }) {
  const t = data.transition;
  return (
    <Card>
      <h2 className="text-lg font-semibold">Résultats du tour {t?.resolvedTurn}</h2>
      <p className="mt-1 text-sm text-slate-400">Prochain tour dans {formatSeconds(data.secondsRemaining)}</p>

      <h3 className="mt-6 text-sm font-semibold text-slate-300">Classement provisoire</h3>
      <RankingTable ranking={data.ranking} />

      {t && Object.keys(t.costliestDecision).length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-300">Décision la plus coûteuse du tour</h3>
          <ul className="mt-2 text-sm text-slate-400">
            {Object.entries(t.costliestDecision).map(([teamId, decision]) => {
              const team = data.teams.find((tm) => tm.id === teamId);
              return (
                <li key={teamId}>
                  {team?.name ?? teamId} — {decision.label} ({formatMoney(decision.amount)})
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

function EndedSection({ data }: { data: HostView }) {
  return (
    <Card>
      <h2 className="text-xl font-bold">🏁 Classement final</h2>
      <RankingTable ranking={data.finalRanking ?? []} />

      {data.finalRecap && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-300">La décision qui a le plus coûté à chaque équipe</h3>
          <ul className="mt-2 text-sm text-slate-400">
            {Object.entries(data.finalRecap).map(([teamId, decision]) => {
              const team = data.teams.find((tm) => tm.id === teamId);
              return (
                <li key={teamId}>
                  {team?.name ?? teamId} — {decision.label} au tour {decision.turn} ({formatMoney(decision.amount)})
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

function RankingTable({ ranking }: { ranking: RankingEntry[] }) {
  return (
    <table className="mt-2 w-full text-sm">
      <thead className="text-left text-slate-500">
        <tr>
          <th className="py-2">#</th>
          <th>Équipe</th>
          <th>Valeur d&apos;entreprise</th>
        </tr>
      </thead>
      <tbody>
        {ranking.map((r, i) => (
          <tr key={r.teamId} className="border-t border-slate-800">
            <td className="py-2">{i + 1}</td>
            <td className="font-medium">{r.name}</td>
            <td className={i === 0 ? "text-emerald-400 font-semibold" : ""}>{formatMoney(r.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
