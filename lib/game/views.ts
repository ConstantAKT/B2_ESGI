import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { actions, players, rooms, teams, teamStates, turns } from "@/lib/db/schema";
import { computeScore } from "@/engine/rules/score";
import { getEventById } from "@/engine/data/events";
import { getTurnObjective } from "@/engine/data/difficulty";
import type { MarketPrices } from "@/engine/types";
import { NotFoundError, UnauthorizedError } from "./errors";
import { requirePlayer } from "./rooms";

function secondsRemaining(turnEndsAt: Date | null, paused: boolean, pausedRemaining: number | null) {
  if (paused) return pausedRemaining ?? 0;
  if (!turnEndsAt) return 0;
  return Math.max(0, Math.round((turnEndsAt.getTime() - Date.now()) / 1000));
}

async function loadRoomBundle(roomId: string) {
  const db = getDb();
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) throw new NotFoundError("Salle introuvable");

  const [teamRows, stateRows, playerRows, currentTurnRow] = await Promise.all([
    db.query.teams.findMany({ where: eq(teams.roomId, roomId) }),
    db.query.teamStates.findMany({ where: eq(teamStates.roomId, roomId) }),
    db.query.players.findMany({ where: eq(players.roomId, roomId) }),
    room.currentTurn > 0
      ? db.query.turns.findFirst({ where: and(eq(turns.roomId, roomId), eq(turns.turnNumber, room.currentTurn)) })
      : Promise.resolve(undefined),
  ]);

  // Pendant la transition, currentTurnRow EST le tour qui vient d'être résolu (le numéro de
  // tour n'avance qu'à la fin des 30 secondes, cf. tick.ts::createTurnRow).
  return { room, teamRows, stateRows, playerRows, currentTurnRow };
}

function marketFromTurnRow(row: { turnNumber: number; materialBuyPrice: number; goodsSellPrice: number; trendIndex: number }): MarketPrices {
  return {
    turn: row.turnNumber,
    materialBuyPrice: row.materialBuyPrice,
    goodsSellPrice: row.goodsSellPrice,
    trendIndex: row.trendIndex as -1 | 0 | 1,
  };
}

function rankTeams(
  stateRows: (typeof teamStates.$inferSelect)[],
  teamRows: (typeof teams.$inferSelect)[],
  market: MarketPrices | undefined
) {
  const teamById = new Map(teamRows.map((t) => [t.id, t]));
  return stateRows
    .map((s) => {
      const score = market ? computeScore(s, market) : undefined;
      return {
        teamId: s.teamId,
        name: teamById.get(s.teamId)?.name ?? "Équipe",
        cash: s.cash,
        debt: s.debt,
        employees: s.employees,
        everSanctioned: s.everSanctioned,
        value: score?.total ?? s.cash - s.debt,
      };
    })
    .sort((a, b) => b.value - a.value);
}

/** Vue publique du lobby, sans jeton : liste des équipes pour que les élèves puissent choisir. */
export async function buildLobbyView(roomId: string) {
  const db = getDb();
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) throw new NotFoundError("Salle introuvable");

  const [teamRows, playerRows] = await Promise.all([
    db.query.teams.findMany({ where: eq(teams.roomId, roomId) }),
    db.query.players.findMany({ where: eq(players.roomId, roomId) }),
  ]);

  return {
    code: room.code,
    status: room.status,
    teams: teamRows.map((t) => ({
      id: t.id,
      name: t.name,
      memberCount: playerRows.filter((p) => p.teamId === t.id).length,
    })),
  };
}

/** Récapitulatif de fin de partie : pour chaque équipe, la décision la plus coûteuse de toute
 * la partie (section 2.4 : "un récapitulatif de la décision qui a le plus coûté à chacune"). */
export async function buildFinalRecap(roomId: string) {
  const db = getDb();
  const allTurns = await db.query.turns.findMany({ where: eq(turns.roomId, roomId) });

  const worst: Record<string, { label: string; amount: number; turn: number }> = {};
  for (const turn of allTurns) {
    const costliest = turn.costliestDecision ?? {};
    for (const [teamId, decision] of Object.entries(costliest)) {
      if (!worst[teamId] || decision.amount < worst[teamId].amount) {
        worst[teamId] = { ...decision, turn: turn.turnNumber };
      }
    }
  }
  return worst;
}

export async function buildHostView(roomId: string) {
  const db = getDb();
  const { room, teamRows, stateRows, playerRows, currentTurnRow } = await loadRoomBundle(roomId);

  const market = currentTurnRow ? marketFromTurnRow(currentTurnRow) : undefined;
  const ranking = rankTeams(stateRows, teamRows, market);

  const currentActionRows =
    room.status === "playing"
      ? await db.query.actions.findMany({
          where: and(eq(actions.roomId, roomId), eq(actions.turnNumber, room.currentTurn)),
        })
      : [];
  const validatedTeamIds = new Set(currentActionRows.filter((a) => a.validated).map((a) => a.teamId));

  const teamsView = teamRows.map((t) => {
    const state = stateRows.find((s) => s.teamId === t.id);
    const actionValidated = validatedTeamIds.has(t.id);
    return {
      id: t.id,
      name: t.name,
      players: playerRows.filter((p) => p.teamId === t.id).map((p) => ({ id: p.id, pseudo: p.pseudo })),
      state: state
        ? {
            cash: state.cash,
            materials: state.materials,
            finishedGoods: state.finishedGoods,
            employees: state.employees,
            debt: state.debt,
            activeSanctions: state.activeSanctions,
            everSanctioned: state.everSanctioned,
          }
        : null,
      actionValidated,
    };
  });

  const unassignedPlayers = playerRows.filter((p) => !p.teamId).map((p) => ({ id: p.id, pseudo: p.pseudo }));

  let transition: ReturnType<typeof buildTransitionPayload> | null = null;
  if (room.status === "transition" && currentTurnRow) {
    transition = buildTransitionPayload(currentTurnRow);
  }

  return {
    code: room.code,
    status: room.status,
    settings: room.settings,
    currentTurn: room.currentTurn,
    totalTurns: room.settings.totalTurns,
    paused: room.paused,
    secondsRemaining: secondsRemaining(room.turnEndsAt, room.paused, room.pausedRemainingSeconds),
    market,
    event: currentTurnRow ? getEventById(currentTurnRow.eventId) : null,
    teams: teamsView,
    unassignedPlayers,
    ranking,
    transition,
    finalRanking: room.status === "ended" ? ranking : null,
    finalRecap: room.status === "ended" ? await buildFinalRecap(roomId) : null,
  };
}

function buildTransitionPayload(
  resolvedTurnRow: NonNullable<Awaited<ReturnType<typeof loadRoomBundle>>["currentTurnRow"]>
) {
  return {
    resolvedTurn: resolvedTurnRow.turnNumber,
    event: getEventById(resolvedTurnRow.eventId),
    report: resolvedTurnRow.report ?? [],
    costliestDecision: resolvedTurnRow.costliestDecision ?? {},
  };
}

export async function buildTeamView(roomId: string, teamId: string, playerToken: string) {
  const player = await requirePlayer(roomId, playerToken);
  if (player.teamId !== teamId) throw new UnauthorizedError("Ce joueur n'appartient pas à cette équipe");

  const db = getDb();
  const { room, teamRows, stateRows, playerRows, currentTurnRow } = await loadRoomBundle(roomId);
  const team = teamRows.find((t) => t.id === teamId);
  if (!team) throw new NotFoundError("Équipe introuvable");
  const state = stateRows.find((s) => s.teamId === teamId);

  const market = currentTurnRow ? marketFromTurnRow(currentTurnRow) : undefined;
  const objective =
    room.status === "playing" && room.currentTurn > 0
      ? getTurnObjective(room.settings.difficulty, room.currentTurn)
      : undefined;

  const actionRow =
    room.status === "playing"
      ? await db.query.actions.findFirst({
          where: and(eq(actions.roomId, roomId), eq(actions.teamId, teamId), eq(actions.turnNumber, room.currentTurn)),
        })
      : undefined;

  const teammates = playerRows.filter((p) => p.teamId === teamId).map((p) => ({ id: p.id, pseudo: p.pseudo }));
  const ranking = rankTeams(stateRows, teamRows, market);

  let transition: ReturnType<typeof buildTransitionPayload> | null = null;
  if (room.status === "transition" && currentTurnRow) {
    transition = buildTransitionPayload(currentTurnRow);
  }

  return {
    room: {
      code: room.code,
      status: room.status,
      currentTurn: room.currentTurn,
      totalTurns: room.settings.totalTurns,
      paused: room.paused,
      secondsRemaining: secondsRemaining(room.turnEndsAt, room.paused, room.pausedRemainingSeconds),
      showResultsImmediately: room.settings.showResultsImmediately,
    },
    team: { id: team.id, name: team.name },
    teammates,
    myAction: actionRow
      ? {
          buyMaterials: actionRow.buyMaterials,
          produce: actionRow.produce,
          sellGoods: actionRow.sellGoods,
          hireDelta: actionRow.hireDelta,
          validated: actionRow.validated,
        }
      : null,
    state: state ?? null,
    market,
    event: currentTurnRow ? getEventById(currentTurnRow.eventId) : null,
    objective,
    ranking,
    transition,
    finalRanking: room.status === "ended" ? ranking : null,
    finalRecap: room.status === "ended" ? await buildFinalRecap(roomId) : null,
  };
}
