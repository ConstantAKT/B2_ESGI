import type { Difficulty, TurnObjective } from "../types";

interface DifficultyProfile {
  /** Prix de base au tour 1. */
  baseMaterialPrice: number;
  baseGoodsPrice: number;
  /** Amplitude de variation des prix d'un tour à l'autre (fraction du prix de base). */
  priceVolatility: number;
  /** Trésorerie de départ et objectif du tour 1. */
  startingCash: number;
  baseCashObjective: number;
  /** Croissance de l'objectif de trésorerie par tour. */
  cashObjectiveGrowthPerTurn: number;
  baseEmployeeObjective: number;
  startingEmployees: number;
}

export const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  facile: {
    baseMaterialPrice: 10,
    baseGoodsPrice: 25,
    priceVolatility: 0.1,
    startingCash: 1200,
    baseCashObjective: 200,
    cashObjectiveGrowthPerTurn: 120,
    baseEmployeeObjective: 2,
    startingEmployees: 3,
  },
  normal: {
    baseMaterialPrice: 12,
    baseGoodsPrice: 25,
    priceVolatility: 0.18,
    startingCash: 1000,
    baseCashObjective: 300,
    cashObjectiveGrowthPerTurn: 180,
    baseEmployeeObjective: 2,
    startingEmployees: 3,
  },
  difficile: {
    baseMaterialPrice: 14,
    baseGoodsPrice: 24,
    priceVolatility: 0.28,
    startingCash: 800,
    baseCashObjective: 350,
    cashObjectiveGrowthPerTurn: 250,
    baseEmployeeObjective: 3,
    startingEmployees: 3,
  },
};

export function getTurnObjective(difficulty: Difficulty, turn: number): TurnObjective {
  const profile = DIFFICULTY_PROFILES[difficulty];
  return {
    minCash: profile.baseCashObjective + profile.cashObjectiveGrowthPerTurn * (turn - 1),
    minEmployees: profile.baseEmployeeObjective,
  };
}
