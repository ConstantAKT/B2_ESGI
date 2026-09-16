import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { actions, rooms, teamStates } from "@/lib/db/schema";
import { generateId } from "@/lib/tokens";
import { GameError, NotFoundError, UnauthorizedError } from "./errors";
import { requirePlayer } from "./rooms";
import { RESTRICTED_MARKET_MAX_BUY } from "@/engine/rules/sanctions";

export interface ActionInput {
  buyMaterials?: number;
  produce?: number;
  sellGoods?: number;
  hireDelta?: number;
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

async function requireTeamMembership(roomId: string, playerToken: string, teamId: string) {
  const player = await requirePlayer(roomId, playerToken);
  if (player.teamId !== teamId) {
    throw new UnauthorizedError("Ce joueur n'appartient pas à cette équipe");
  }
  return player;
}

/** Soumet (ou met à jour) le brouillon d'actions d'une équipe pour le tour courant. Toute
 * équipe non validée peut modifier son brouillon jusqu'à l'expiration du chrono. */
export async function submitTeamActions(
  roomId: string,
  teamId: string,
  playerToken: string,
  input: ActionInput
) {
  const db = getDb();
  await requireTeamMembership(roomId, playerToken, teamId);

  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) throw new NotFoundError("Salle introuvable");
  if (room.status !== "playing") throw new GameError("Aucun tour en cours.");

  const existing = await db.query.actions.findFirst({
    where: and(eq(actions.roomId, roomId), eq(actions.teamId, teamId), eq(actions.turnNumber, room.currentTurn)),
  });
  if (existing?.validated) throw new GameError("Le tour a déjà été validé par l'équipe.");

  const state = await db.query.teamStates.findFirst({
    where: and(eq(teamStates.roomId, roomId), eq(teamStates.teamId, teamId)),
  });
  const restricted = state?.activeSanctions.includes("marche_restreint") ?? false;
  const maxBuy = restricted ? RESTRICTED_MARKET_MAX_BUY : 9999;

  const values = {
    buyMaterials: clampInt(input.buyMaterials, existing?.buyMaterials ?? 0, 0, maxBuy),
    produce: clampInt(input.produce, existing?.produce ?? 0, 0, 9999),
    sellGoods: clampInt(input.sellGoods, existing?.sellGoods ?? 0, 0, state?.finishedGoods ?? 9999),
    hireDelta: clampInt(input.hireDelta, existing?.hireDelta ?? 0, -(state?.employees ?? 0), 999),
  };

  if (existing) {
    await db.update(actions).set({ ...values, updatedAt: new Date() }).where(eq(actions.id, existing.id));
  } else {
    await db.insert(actions).values({
      id: generateId(),
      roomId,
      teamId,
      turnNumber: room.currentTurn,
      ...values,
      validated: false,
    });
  }
}

export async function validateTeamActions(roomId: string, teamId: string, playerToken: string) {
  const db = getDb();
  await requireTeamMembership(roomId, playerToken, teamId);

  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) throw new NotFoundError("Salle introuvable");
  if (room.status !== "playing") throw new GameError("Aucun tour en cours.");

  const existing = await db.query.actions.findFirst({
    where: and(eq(actions.roomId, roomId), eq(actions.teamId, teamId), eq(actions.turnNumber, room.currentTurn)),
  });

  if (existing) {
    await db.update(actions).set({ validated: true, updatedAt: new Date() }).where(eq(actions.id, existing.id));
  } else {
    await db.insert(actions).values({
      id: generateId(),
      roomId,
      teamId,
      turnNumber: room.currentTurn,
      buyMaterials: 0,
      produce: 0,
      sellGoods: 0,
      hireDelta: 0,
      validated: true,
    });
  }
}
