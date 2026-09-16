import type { GameEventDefinition, TeamState } from "../types";
import { GAME_CONSTANTS } from "../types";

export interface ChargesBreakdown {
  salaries: number;
  rent: number;
  energy: number;
  debtInterest: number;
  total: number;
}

/** Prélèvement des charges fixes et de l'intérêt de la dette (étape 4 de la résolution). */
export function computeCharges(
  team: TeamState,
  event: GameEventDefinition | undefined
): ChargesBreakdown {
  const salaries = team.employees * GAME_CONSTANTS.salaryPerEmployee;
  const rent = GAME_CONSTANTS.rentPerTurn;
  const energyMultiplier = event?.effects.energyCostMultiplier ?? 1;
  const energy = GAME_CONSTANTS.energyPerTurn * energyMultiplier;
  const debtInterest = Math.round(team.debt * GAME_CONSTANTS.debtInterestRate * 100) / 100;

  return {
    salaries,
    rent,
    energy,
    debtInterest,
    total: salaries + rent + energy + debtInterest,
  };
}
