import type { Difficulty, MarketPrices } from "../types";
import { DIFFICULTY_PROFILES } from "./difficulty";

/** PRNG déterministe (mulberry32) : mêmes prix pour toutes les équipes d'une même salle. */
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Génère les prix du marché pour un tour donné, identiques pour toute la salle.
 * `roomSeed` est typiquement le code de la salle : deux salles ont des marchés différents,
 * une même salle a un marché reproductible tour après tour.
 */
export function generateMarketPrices(
  roomSeed: string,
  turn: number,
  difficulty: Difficulty
): MarketPrices {
  const profile = DIFFICULTY_PROFILES[difficulty];
  const rand = mulberry32(hashSeed(`${roomSeed}:${turn}`));

  const materialVariation = (rand() * 2 - 1) * profile.priceVolatility;
  const goodsVariation = (rand() * 2 - 1) * profile.priceVolatility;

  const materialBuyPrice = round2(profile.baseMaterialPrice * (1 + materialVariation));
  const goodsSellPrice = round2(profile.baseGoodsPrice * (1 + goodsVariation));

  // Tendance annoncée à l'avance pour le tour suivant : imprécise (signe correct 70% du temps).
  const nextRand = mulberry32(hashSeed(`${roomSeed}:${turn + 1}`));
  const nextMaterialVariation = (nextRand() * 2 - 1) * profile.priceVolatility;
  const noise = rand() < 0.3 ? -1 : 1;
  const trendIndex = Math.sign(nextMaterialVariation * noise) as -1 | 0 | 1;

  return { turn, materialBuyPrice, goodsSellPrice, trendIndex };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
