"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, StatTile, formatMoney, formatSeconds } from "@/components/ui";
import { apiPost } from "@/lib/client/api";
import { clearPlayerSession, setPlayerSession, usePlayerSession, type PlayerSession } from "@/lib/client/storage";
import { usePolling } from "@/lib/client/usePolling";

interface LobbyView {
  code: string;
  status: string;
  teams: { id: string; name: string; memberCount: number }[];
}

interface TeamState {
  cash: number;
  materials: number;
  finishedGoods: number;
  employees: number;
  debt: number;
  activeSanctions: string[];
  everSanctioned: boolean;
}

interface RankingEntry {
  teamId: string;
  name: string;
  value: number;
}

interface TeamViewData {
  room: {
    code: string;
    status: "lobby" | "playing" | "transition" | "ended";
    currentTurn: number;
    totalTurns: number;
    paused: boolean;
    secondsRemaining: number;
    showResultsImmediately: boolean;
  };
  team: { id: string; name: string };
  teammates: { id: string; pseudo: string }[];
  myAction: { buyMaterials: number; produce: number; sellGoods: number; hireDelta: number; validated: boolean } | null;
  state: TeamState | null;
  market: { materialBuyPrice: number; goodsSellPrice: number; trendIndex: -1 | 0 | 1 } | null;
  event: { label: string; description: string } | null;
  objective?: { minCash: number; minEmployees: number };
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

export default function PlayRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const session = usePlayerSession(code);

  useEffect(() => {
    if (session === null) router.replace("/");
  }, [session, router]);

  if (!session) return null;

  if (!session.teamId) {
    return (
      <TeamPicker
        code={code}
        session={session}
        onPicked={(teamId) => setPlayerSession(code, { ...session, teamId })}
      />
    );
  }

  return <TeamGame code={code} session={session} onKicked={() => {
    clearPlayerSession(code);
    router.replace("/");
  }} />;
}

function TeamPicker({
  code,
  session,
  onPicked,
}: {
  code: string;
  session: PlayerSession;
  onPicked: (teamId: string) => void;
}) {
  const { data, refresh } = usePolling<LobbyView>(`/api/rooms/${code}/lobby`, {}, 2000);
  const [newTeamName, setNewTeamName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function joinTeam(teamId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiPost(
        `/api/rooms/${code}/teams/${teamId}/join`,
        { playerId: session.playerId },
        { "x-player-token": session.token }
      );
      onPicked(teamId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de rejoindre l'équipe");
    } finally {
      setBusy(false);
    }
  }

  async function createAndJoin() {
    if (!newTeamName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const team = await apiPost<{ teamId: string }>(`/api/rooms/${code}/teams`, { name: newTeamName });
      await joinTeam(team.teamId);
      setNewTeamName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer l'équipe");
    } finally {
      setBusy(false);
      refresh();
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-bold">Choisis ton équipe</h1>
        <p className="text-sm text-slate-400">Salut {session.pseudo} 👋 — salle {code}</p>
      </div>

      <Card>
        <div className="flex flex-col gap-2">
          {data?.teams.map((t) => (
            <button
              key={t.id}
              disabled={busy}
              onClick={() => joinTeam(t.id)}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-left hover:border-emerald-500"
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-sm text-slate-500">{t.memberCount} membre(s)</span>
            </button>
          ))}
          {data && data.teams.length === 0 && (
            <p className="text-sm text-slate-500">Aucune équipe pour l&apos;instant, crée la première !</p>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Nom de la nouvelle usine"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <Button variant="secondary" disabled={busy} onClick={createAndJoin}>
            Créer
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
      </Card>
    </main>
  );
}

function TeamGame({
  code,
  session,
  onKicked,
}: {
  code: string;
  session: PlayerSession;
  onKicked: () => void;
}) {
  const { data, error, refresh } = usePolling<TeamViewData>(
    `/api/rooms/${code}/team/${session.teamId}`,
    { "x-player-token": session.token },
    2000
  );

  useEffect(() => {
    if (error) onKicked();
  }, [error, onKicked]);

  if (!data) return <main className="flex flex-1 items-center justify-center text-slate-500">Chargement…</main>;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{data.team.name}</p>
          <p className="text-xs text-slate-600">{data.teammates.map((t) => t.pseudo).join(", ")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge>{statusLabel(data.room.status)}</Badge>
          {data.room.status === "playing" && (
            <span className="font-mono text-2xl">{formatSeconds(data.room.secondsRemaining)}</span>
          )}
        </div>
      </header>

      {data.room.status === "lobby" && (
        <Card>
          <p className="text-slate-300">En attente que l&apos;enseignant lance la partie…</p>
        </Card>
      )}

      {data.room.status === "playing" && data.state && (
        <PlayingView code={code} session={session} data={data} refresh={refresh} />
      )}

      {data.room.status === "transition" && <TransitionView data={data} />}

      {data.room.status === "ended" && <EndedView data={data} />}
    </main>
  );
}

function statusLabel(status: string) {
  switch (status) {
    case "lobby":
      return "Lobby";
    case "playing":
      return "Tour en cours";
    case "transition":
      return "Transition";
    case "ended":
      return "Partie terminée";
    default:
      return status;
  }
}

function PlayingView({
  code,
  session,
  data,
  refresh,
}: {
  code: string;
  session: PlayerSession;
  data: TeamViewData;
  refresh: () => void;
}) {
  const state = data.state!;
  const [buyMaterials, setBuyMaterials] = useState(data.myAction?.buyMaterials ?? 0);
  const [produce, setProduce] = useState(data.myAction?.produce ?? 0);
  const [sellGoods, setSellGoods] = useState(data.myAction?.sellGoods ?? 0);
  const [hireDelta, setHireDelta] = useState(data.myAction?.hireDelta ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validated = data.myAction?.validated ?? false;

  const market = data.market;
  const purchaseCost = market ? buyMaterials * market.materialBuyPrice : 0;
  const saleRevenue = market ? sellGoods * market.goodsSellPrice : 0;

  async function saveDraft() {
    setBusy(true);
    setError(null);
    try {
      await apiPost(
        `/api/rooms/${code}/actions`,
        { teamId: session.teamId, buyMaterials, produce, sellGoods, hireDelta },
        { "x-player-token": session.token }
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action refusée");
    } finally {
      setBusy(false);
    }
  }

  async function validateTurn() {
    setBusy(true);
    setError(null);
    try {
      await saveDraft();
      await apiPost(`/api/rooms/${code}/validate`, { teamId: session.teamId }, { "x-player-token": session.token });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation refusée");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {data.event && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <p className="text-sm font-semibold text-amber-300">{data.event.label}</p>
          <p className="text-sm text-amber-200/80">{data.event.description}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Trésorerie" value={formatMoney(state.cash)} tone={state.cash < 0 ? "danger" : "default"} />
        <StatTile label="Matières" value={state.materials} />
        <StatTile label="Produits finis" value={state.finishedGoods} />
        <StatTile label="Employés" value={state.employees} />
        <StatTile label="Dette" value={formatMoney(state.debt)} tone={state.debt > 0 ? "warning" : "default"} />
        {market && <StatTile label="Prix matière" value={formatMoney(market.materialBuyPrice)} />}
        {market && <StatTile label="Prix de vente" value={formatMoney(market.goodsSellPrice)} />}
        {data.objective && (
          <StatTile
            label="Objectif trésorerie"
            value={formatMoney(data.objective.minCash)}
            tone={state.cash < data.objective.minCash ? "danger" : "success"}
          />
        )}
      </div>

      {state.activeSanctions.length > 0 && (
        <Card className="border-rose-500/30 bg-rose-500/5">
          <p className="text-sm font-semibold text-rose-300">En redressement ce tour</p>
          <p className="text-sm text-rose-200/80">{state.activeSanctions.join(", ")}</p>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Décisions du tour</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label={`Acheter des matières (coût ${formatMoney(purchaseCost)})`}
            value={buyMaterials}
            onChange={setBuyMaterials}
            disabled={validated}
            min={0}
          />
          <NumberField
            label={`Produire (capacité max ${state.employees * 4})`}
            value={produce}
            onChange={setProduce}
            disabled={validated}
            min={0}
          />
          <NumberField
            label={`Vendre des produits (recette ${formatMoney(saleRevenue)})`}
            value={sellGoods}
            onChange={setSellGoods}
            disabled={validated}
            min={0}
            max={state.finishedGoods}
          />
          <NumberField
            label="Embaucher (+) / Licencier (-)"
            value={hireDelta}
            onChange={setHireDelta}
            disabled={validated}
            min={-state.employees}
          />
        </div>

        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

        <div className="mt-4 flex gap-3">
          <Button variant="secondary" disabled={busy || validated} onClick={saveDraft}>
            Enregistrer
          </Button>
          <Button disabled={busy || validated} onClick={validateTurn}>
            {validated ? "Tour validé ✓" : "Valider mon tour"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-400">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-emerald-500 disabled:opacity-50"
      />
    </label>
  );
}

function TransitionView({ data }: { data: TeamViewData }) {
  const t = data.transition;
  const myDecision = t ? t.costliestDecision[data.team.id] : undefined;
  return (
    <Card>
      <h2 className="text-lg font-semibold">Résultats du tour {t?.resolvedTurn}</h2>
      <p className="mt-1 text-sm text-slate-400">Prochain tour dans {formatSeconds(data.room.secondsRemaining)}</p>

      {myDecision && (
        <p className="mt-4 text-sm text-amber-300">
          Décision la plus coûteuse : {myDecision.label} ({formatMoney(myDecision.amount)})
        </p>
      )}

      <h3 className="mt-6 text-sm font-semibold text-slate-300">Classement provisoire</h3>
      <RankingList ranking={data.ranking} highlightTeamId={data.team.id} />
    </Card>
  );
}

function EndedView({ data }: { data: TeamViewData }) {
  const myRecap = data.finalRecap?.[data.team.id];
  return (
    <Card>
      <h2 className="text-xl font-bold">🏁 Classement final</h2>
      <RankingList ranking={data.finalRanking ?? []} highlightTeamId={data.team.id} />
      {myRecap && (
        <p className="mt-4 text-sm text-slate-400">
          Votre décision la plus coûteuse : {myRecap.label} au tour {myRecap.turn} ({formatMoney(myRecap.amount)})
        </p>
      )}
    </Card>
  );
}

function RankingList({ ranking, highlightTeamId }: { ranking: RankingEntry[]; highlightTeamId: string }) {
  return (
    <ol className="mt-2 flex flex-col gap-1 text-sm">
      {ranking.map((r, i) => (
        <li
          key={r.teamId}
          className={`flex justify-between rounded-lg px-3 py-2 ${
            r.teamId === highlightTeamId ? "bg-emerald-500/10 text-emerald-300" : "text-slate-300"
          }`}
        >
          <span>
            {i + 1}. {r.name}
          </span>
          <span>{formatMoney(r.value)}</span>
        </li>
      ))}
    </ol>
  );
}
