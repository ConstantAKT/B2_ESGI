import type { SanctionType, TeamState } from "../types";
import { GAME_CONSTANTS } from "../types";

/** Capacité de production maximale d'une équipe pour ce tour, avant effet d'événement. */
export function computeCapacity(
  team: TeamState,
  activeSanctions: SanctionType[]
): number {
  let capacity = team.employees * GAME_CONSTANTS.unitsProducedPerEmployee;
  if (activeSanctions.includes("capacite_reduite")) {
    capacity = Math.floor(capacity * 0.5);
  }
  return Math.max(0, capacity);
}

/**
 * Quantité réellement produite : plafonnée par la capacité, les matières disponibles,
 * et la quantité demandée par l'équipe.
 */
export function computeActualProduction(
  requestedQuantity: number,
  materialsAvailable: number,
  capacity: number,
  eventCapacityMultiplier = 1
): number {
  const effectiveCapacity = Math.floor(capacity * eventCapacityMultiplier);
  const materialLimit = Math.floor(materialsAvailable / GAME_CONSTANTS.materialsPerUnitProduced);
  return Math.max(0, Math.min(requestedQuantity, effectiveCapacity, materialLimit));
}
