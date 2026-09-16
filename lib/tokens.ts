import { customAlphabet } from "nanoid";

// Pas de O, 0, I, 1 : caractères ambigus à l'oral/à l'écran, comme demandé en section 2.1.
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const generateRoomCode = customAlphabet(ROOM_CODE_ALPHABET, 6);

const secretAlphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const generateSecretRaw = customAlphabet(secretAlphabet, 32);

/** Jeton opaque utilisé comme secret de session (hôte ou joueur), stocké côté client. */
export function generateToken(): string {
  return generateSecretRaw();
}

const generateIdRaw = customAlphabet(secretAlphabet, 21);

export function generateId(): string {
  return generateIdRaw();
}
