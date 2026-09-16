import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { actions, rooms, teams, teamStates, turns } from "@/lib/db/schema";
import { generateId } from "@/lib/tokens";
import { generateMarketPrices } from "@/engine/data/market";
import { createInitialTeamState } from "@/engine/initialState";
import { resolveTurn } from "@/engine/resolveTurn";
import type { TeamActions, TeamState } from "@/engine/types";
import { GameError, NotFoundError } from "./errors";
import { requireHost } from "./rooms";
import { MIN_TEAMS_TO_START, TRANSITION_DURATION_SECONDS } from "./constants";

type Room = typeof rooms.$inferSelect;

async function createTurnRow(room: Room, turnNumber: number) {
  const db = getDb();
  const market = generateMarketPrices(room.code, turnNumber, room.settings.difficulty);
  const eventId = room.settings.eventIds[turnNumber - 1] ?? "calme";

  const id = generateId();
  await db.insert(turns).values({
    id,
    roomId: room.id,
    turnNumber,
    materialBuyPrice: market.materialBuyPrice,
    goodsSellPrice: market.goodsSellPrice,
    trendIndex: market.trendIndex,
    eventId,
    resolved: false,
  });

  const now = new Date();
  const turnEndsAt = new Date(now.getTime() + room.settings.turnDurationSeconds * 1000);
  await db
    .update(rooms)
    .set({ status: "playing", currentTurn: turnNumber, turnStartedAt: now, turnEndsAt, paused: false, pausedRemainingSeconds: null })
    .where(eq(rooms.id, room.id));

  return { market, eventId };
}

export async function startGame(roomId: string, hostToken: string) {
  const db = getDb();
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) throw new NotFoundError("Salle introuvable");
  requireHost(room, hostToken);
  if (room.status !== "lobby") throw new GameError("La partie a déjà démarré.");

  const teamRows = await db.query.teams.findMany({ where: eq(teams.roomId, roomId) });
  if (teamRows.length < MIN_TEAMS_TO_START) {
    throw new GameError(`Il faut au moins ${MIN_TEAMS_TO_START} équipes pour démarrer.`);
  }

  for (const team of teamRows) {
    const initial = createInitialTeamState(team.id, room.settings.difficulty);
    await db.insert(teamStates).values({
      id: generateId(),
      roomId,
      teamId: team.id,
      cash: initial.cash,
      materials: initial.materials,
      finishedGoods: initial.finishedGoods,
      employees: initial.employees,
      debt: initial.debt,
      activeSanctions: initial.activeSanctions,
      everSanctioned: initial.everSanctioned,
      consecutiveFailures: initial.consecutiveFailures,
    });
  }

  await createTurnRow(room, 1);
}

/**
 * Fait avancer l'état de la salle si nécessaire : résout le tour courant si le temps est
 * écoulé ou si toutes les équipes ont validé, puis fait progresser la transition de 30s vers
 * le tour suivant (ou la fin de partie). Appelée au début de chaque route qui lit/modifie une
 * salle en cours de partie : il n'y a pas de tâche de fond côté serveur (Vercel serverless).
 */
export async function tickRoom(roomId: string): Promise<void> {
  const db = getDb();
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) return;

  if (room.status === "playing") {
    await maybeResolveCurrentTurn(room);
    return;
  }

  if (room.status === "transition") {
    const now = new Date();
    if (room.turnEndsAt && now >= room.turnEndsAt) {
      const freshRoom = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
      if (!freshRoom || freshRoom.status !== "transition") return;
      if (freshRoom.currentTurn >= freshRoom.settings.totalTurns) {
        await db.update(rooms).set({ status: "ended" }).where(eq(rooms.id, roomId));
      } else {
        await createTurnRow(freshRoom, freshRoom.currentTurn + 1);
      }
    }
  }
}

async function maybeResolveCurrentTurn(room: Room) {
  const db = getDb();
  const now = new Date();

  const timeUp = room.turnEndsAt ? now >= room.turnEndsAt : false;
  if (room.paused && !timeUp) return;

  let shouldResolve = timeUp;
  if (!shouldResolve) {
    const teamRows = await db.query.teams.findMany({ where: eq(teams.roomId, room.id) });
    if (teamRows.length > 0) {
      const actionRows = await db.query.actions.findMany({
        where: and(eq(actions.roomId, room.id), eq(actions.turnNumber, room.currentTurn)),
      });
      const validatedTeamIds = new Set(actionRows.filter((a) => a.validated).map((a) => a.teamId));
      shouldResolve = teamRows.every((t) => validatedTeamIds.has(t.id));
    }
  }
  if (!shouldResolve) return;

  await resolveCurrentTurnNow(room);
}

/** Résolution immédiate et inconditionnelle du tour courant (utilisée aussi par "forcer la résolution"). */
export async function resolveCurrentTurnNow(room: Room) {
  const db = getDb();

  // Compare-and-swap : ne résout qu'une fois même si deux requêtes arrivent en même temps.
  const turnRow = await db.query.turns.findFirst({
    where: and(eq(turns.roomId, room.id), eq(turns.turnNumber, room.currentTurn)),
  });
  if (!turnRow || turnRow.resolved) return;
  const claimed = await db
    .update(turns)
    .set({ resolved: true, resolvedAt: new Date() })
    .where(and(eq(turns.id, turnRow.id), eq(turns.resolved, false)))
    .returning({ id: turns.id });
  if (claimed.length === 0) return; // une autre requête a déjà pris la main

  const [teamRows, stateRows, actionRows] = await Promise.all([
    db.query.teams.findMany({ where: eq(teams.roomId, room.id) }),
    db.query.teamStates.findMany({ where: eq(teamStates.roomId, room.id) }),
    db.query.actions.findMany({ where: and(eq(actions.roomId, room.id), eq(actions.turnNumber, room.currentTurn)) }),
  ]);

  const teamStateByTeamId = new Map(stateRows.map((s) => [s.teamId, s]));
  const engineTeams: TeamState[] = teamRows.map((t) => {
    const s = teamStateByTeamId.get(t.id);
    return {
      teamId: t.id,
      cash: s?.cash ?? 0,
      materials: s?.materials ?? 0,
      finishedGoods: s?.finishedGoods ?? 0,
      employees: s?.employees ?? 0,
      debt: s?.debt ?? 0,
      activeSanctions: s?.activeSanctions ?? [],
      everSanctioned: s?.everSanctioned ?? false,
      consecutiveFailures: s?.consecutiveFailures ?? 0,
    };
  });

  const actionsByTeamId: Record<string, TeamActions> = {};
  for (const a of actionRows) {
    actionsByTeamId[a.teamId] = {
      teamId: a.teamId,
      buyMaterials: a.buyMaterials,
      produce: a.produce,
      sellGoods: a.sellGoods,
      hireDelta: a.hireDelta,
      validated: a.validated,
    };
  }

  const result = resolveTurn({
    turn: room.currentTurn,
    difficulty: room.settings.difficulty,
    market: {
      turn: room.currentTurn,
      materialBuyPrice: turnRow.materialBuyPrice,
      goodsSellPrice: turnRow.goodsSellPrice,
      trendIndex: turnRow.trendIndex as -1 | 0 | 1,
    },
    eventId: turnRow.eventId,
    teams: engineTeams,
    actions: actionsByTeamId,
  });

  for (const state of result.teamStates) {
    await db
      .update(teamStates)
      .set({
        cash: state.cash,
        materials: state.materials,
        finishedGoods: state.finishedGoods,
        employees: state.employees,
        debt: state.debt,
        activeSanctions: state.activeSanctions,
        everSanctioned: state.everSanctioned,
        consecutiveFailures: state.consecutiveFailures,
        updatedAt: new Date(),
      })
      .where(and(eq(teamStates.roomId, room.id), eq(teamStates.teamId, state.teamId)));
  }

  await db
    .update(turns)
    .set({ report: result.steps, costliestDecision: result.costliestDecision })
    .where(eq(turns.id, turnRow.id));

  const transitionEndsAt = new Date(Date.now() + TRANSITION_DURATION_SECONDS * 1000);
  await db
    .update(rooms)
    .set({ status: "transition", turnEndsAt: transitionEndsAt })
    .where(eq(rooms.id, room.id));
}

export async function hostPause(roomId: string, hostToken: string) {
  const db = getDb();
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) throw new NotFoundError("Salle introuvable");
  requireHost(room, hostToken);
  if (room.status !== "playing" || room.paused) return;
  const remaining = room.turnEndsAt ? Math.max(0, Math.round((room.turnEndsAt.getTime() - Date.now()) / 1000)) : 0;
  await db.update(rooms).set({ paused: true, pausedRemainingSeconds: remaining }).where(eq(rooms.id, roomId));
}

export async function hostResume(roomId: string, hostToken: string) {
  const db = getDb();
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) throw new NotFoundError("Salle introuvable");
  requireHost(room, hostToken);
  if (room.status !== "playing" || !room.paused) return;
  const remaining = room.pausedRemainingSeconds ?? 0;
  const turnEndsAt = new Date(Date.now() + remaining * 1000);
  await db.update(rooms).set({ paused: false, pausedRemainingSeconds: null, turnEndsAt }).where(eq(rooms.id, roomId));
}

export async function hostExtendTurn(roomId: string, hostToken: string, extraSeconds: number) {
  const db = getDb();
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) throw new NotFoundError("Salle introuvable");
  requireHost(room, hostToken);
  if (room.status !== "playing" || !room.turnEndsAt) return;
  const turnEndsAt = new Date(room.turnEndsAt.getTime() + extraSeconds * 1000);
  await db.update(rooms).set({ turnEndsAt }).where(eq(rooms.id, roomId));
}

export async function hostForceResolve(roomId: string, hostToken: string) {
  const db = getDb();
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) throw new NotFoundError("Salle introuvable");
  requireHost(room, hostToken);
  if (room.status !== "playing") return;
  await resolveCurrentTurnNow(room);
}

export async function hostEndGame(roomId: string, hostToken: string) {
  const db = getDb();
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) throw new NotFoundError("Salle introuvable");
  requireHost(room, hostToken);
  await db.update(rooms).set({ status: "ended" }).where(eq(rooms.id, roomId));
}
