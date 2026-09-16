import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { players, rooms, teams } from "@/lib/db/schema";
import { generateId, generateRoomCode, generateToken } from "@/lib/tokens";
import { GameError, NotFoundError, UnauthorizedError } from "./errors";
import { DEFAULT_ROOM_SETTINGS, MIN_TEAMS_TO_START } from "./constants";
import type { RoomSettings } from "@/engine/types";

export async function createRoom(partialSettings: Partial<RoomSettings> = {}) {
  const db = getDb();
  const settings: RoomSettings = { ...DEFAULT_ROOM_SETTINGS, ...partialSettings };

  // Le code doit être unique ; en pratique une collision sur 6 caractères (33 possibilités) est
  // extrêmement rare, mais on retente proprement si ça arrive.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const existing = await db.query.rooms.findFirst({ where: eq(rooms.code, code) });
    if (existing) continue;

    const id = generateId();
    const hostToken = generateToken();
    await db.insert(rooms).values({ id, code, hostToken, status: "lobby", settings });
    return { roomId: id, code, hostToken };
  }
  throw new GameError("Impossible de générer un code de salle unique, réessayez.", 500);
}

export async function getRoomByCode(code: string) {
  const db = getDb();
  const room = await db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) });
  if (!room) throw new NotFoundError("Salle introuvable");
  return room;
}

export function requireHost(room: { hostToken: string }, hostToken: string | null) {
  if (!hostToken || hostToken !== room.hostToken) {
    throw new UnauthorizedError("Jeton enseignant invalide");
  }
}

export async function requirePlayer(roomId: string, playerToken: string | null) {
  if (!playerToken) throw new UnauthorizedError("Jeton joueur manquant");
  const db = getDb();
  const player = await db.query.players.findFirst({
    where: and(eq(players.roomId, roomId), eq(players.token, playerToken)),
  });
  if (!player) throw new UnauthorizedError("Jeton joueur invalide");
  return player;
}

export async function joinRoom(code: string, pseudo: string) {
  const trimmed = pseudo.trim().slice(0, 24);
  if (!trimmed) throw new GameError("Pseudo requis");

  const room = await getRoomByCode(code);
  if (room.status !== "lobby") {
    throw new GameError("La partie a déjà commencé, impossible de rejoindre.");
  }

  const db = getDb();
  const id = generateId();
  const token = generateToken();
  await db.insert(players).values({ id, roomId: room.id, pseudo: trimmed, token });
  return { playerId: id, token, roomId: room.id, roomCode: room.code };
}

export async function createTeam(roomId: string, name: string) {
  const trimmed = name.trim().slice(0, 32);
  if (!trimmed) throw new GameError("Nom d'équipe requis");
  const db = getDb();
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) throw new NotFoundError("Salle introuvable");
  if (room.status !== "lobby") throw new GameError("Impossible de créer une équipe après le lancement.");

  const id = generateId();
  await db.insert(teams).values({ id, roomId, name: trimmed });
  return { teamId: id, name: trimmed };
}

export async function joinTeam(roomId: string, playerId: string, playerToken: string, teamId: string) {
  const db = getDb();
  const player = await requirePlayer(roomId, playerToken);
  if (player.id !== playerId) throw new UnauthorizedError();

  const team = await db.query.teams.findFirst({ where: and(eq(teams.id, teamId), eq(teams.roomId, roomId)) });
  if (!team) throw new NotFoundError("Équipe introuvable");

  await db.update(players).set({ teamId }).where(eq(players.id, playerId));
}

export async function updateSettings(roomId: string, hostToken: string, partial: Partial<RoomSettings>) {
  const db = getDb();
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) throw new NotFoundError("Salle introuvable");
  requireHost(room, hostToken);
  if (room.status !== "lobby") throw new GameError("Réglages modifiables uniquement dans le lobby.");

  const settings: RoomSettings = { ...room.settings, ...partial };
  await db.update(rooms).set({ settings }).where(eq(rooms.id, roomId));
  return settings;
}

export async function removePlayer(roomId: string, hostToken: string, playerId: string) {
  const db = getDb();
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) throw new NotFoundError("Salle introuvable");
  requireHost(room, hostToken);
  await db.delete(players).where(and(eq(players.id, playerId), eq(players.roomId, roomId)));
}

export async function autoAssignTeams(roomId: string, hostToken: string) {
  const db = getDb();
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  if (!room) throw new NotFoundError("Salle introuvable");
  requireHost(room, hostToken);
  if (room.status !== "lobby") throw new GameError("Répartition possible uniquement dans le lobby.");

  const [allPlayers, existingTeams] = await Promise.all([
    db.query.players.findMany({ where: eq(players.roomId, roomId) }),
    db.query.teams.findMany({ where: eq(teams.roomId, roomId) }),
  ]);

  const unassigned = allPlayers.filter((p) => !p.teamId);
  if (unassigned.length === 0) return;

  let teamPool = existingTeams;
  if (teamPool.length === 0) {
    const teamCount = Math.max(MIN_TEAMS_TO_START, Math.ceil(unassigned.length / 4));
    const created = [];
    for (let i = 0; i < teamCount; i++) {
      const id = generateId();
      const name = `Usine ${i + 1}`;
      await db.insert(teams).values({ id, roomId, name });
      created.push({ id, roomId, name, createdAt: new Date() });
    }
    teamPool = created as typeof existingTeams;
  }

  for (let i = 0; i < unassigned.length; i++) {
    const team = teamPool[i % teamPool.length];
    await db.update(players).set({ teamId: team.id }).where(eq(players.id, unassigned[i].id));
  }
}
