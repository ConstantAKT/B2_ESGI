import type { Difficulty, TeamState, TurnObjective } from "../types";
import { getTurnObjective } from "../data/difficulty";

export interface ObjectiveCheckResult {
  objective: TurnObjective;
  cashOk: boolean;
  employeesOk: boolean;
  passed: boolean;
}

/** Contrôle de l'objectif du tour (étape 6) : trésorerie minimale et effectif minimal. */
export function checkObjective(
  team: TeamState,
  difficulty: Difficulty,
  turn: number
): ObjectiveCheckResult {
  const objective = getTurnObjective(difficulty, turn);
  const cashOk = team.cash >= objective.minCash;
  const employeesOk = team.employees >= objective.minEmployees;
  return { objective, cashOk, employeesOk, passed: cashOk && employeesOk };
}
