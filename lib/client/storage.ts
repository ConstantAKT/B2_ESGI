"use client";

import { useSyncExternalStore } from "react";

export interface PlayerSession {
  playerId: string;
  token: string;
  teamId: string | null;
  pseudo: string;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage indisponible (navigation privée, etc.) : la session ne persiste pas au reload.
  }
  notify();
}

function safeRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
  notify();
}

// Petit pub-sub pour que useHostToken / usePlayerSession se remettent à jour immédiatement
// après un setHostToken/setPlayerSession dans le même onglet (l'évènement natif "storage" ne
// se déclenche que pour les *autres* onglets).
type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function getHostToken(code: string): string | null {
  return safeGet(`usine:host:${code}`);
}

export function setHostToken(code: string, token: string) {
  safeSet(`usine:host:${code}`, token);
}

function parsePlayerSession(raw: string): PlayerSession | null {
  try {
    return JSON.parse(raw) as PlayerSession;
  } catch {
    return null;
  }
}

export function getPlayerSession(code: string): PlayerSession | null {
  const raw = safeGet(`usine:player:${code}`);
  return raw ? parsePlayerSession(raw) : null;
}

export function setPlayerSession(code: string, session: PlayerSession) {
  safeSet(`usine:player:${code}`, JSON.stringify(session));
}

export function clearPlayerSession(code: string) {
  safeRemove(`usine:player:${code}`);
}

/** `undefined` tant que le rendu serveur n'a pas encore été remplacé par le rendu client
 * (le localStorage n'existe pas côté serveur) ; `null` si aucun jeton n'est stocké. */
export function useHostToken(code: string): string | null | undefined {
  return useSyncExternalStore(subscribe, () => getHostToken(code), () => undefined);
}

// `getPlayerSession` parse du JSON et renverrait un nouvel objet à chaque appel : sans cache,
// useSyncExternalStore le verrait "changer" à chaque rendu (comparaison par référence) et
// boucler indéfiniment. On ne recrée l'objet que si la valeur brute en localStorage a changé.
const playerSessionCache = new Map<string, { raw: string | null; value: PlayerSession | null }>();

function getCachedPlayerSession(code: string): PlayerSession | null {
  const raw = safeGet(`usine:player:${code}`);
  const cached = playerSessionCache.get(code);
  if (cached && cached.raw === raw) return cached.value;
  const value = raw ? parsePlayerSession(raw) : null;
  playerSessionCache.set(code, { raw, value });
  return value;
}

export function usePlayerSession(code: string): PlayerSession | null | undefined {
  return useSyncExternalStore(subscribe, () => getCachedPlayerSession(code), () => undefined);
}
