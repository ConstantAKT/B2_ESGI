import type { Difficulty, TeamState } from "./types";
import { DIFFICULTY_PROFILES } from "./data/difficulty";

export function createInitialTeamState(teamId: string, difficulty: Difficulty): TeamState {
  const profile = DIFFICULTY_PROFILES[difficulty];
  return {
    teamId,
    cash: profile.startingCash,
    materials: 0,
    finishedGoods: 0,
    employees: profile.startingEmployees,
    debt: 0,
    activeSanctions: [],
    everSanctioned: false,
    consecutiveFailures: 0,
  };
}
