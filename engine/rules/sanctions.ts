import type { SanctionType, TeamState } from "../types";
import { GAME_CONSTANTS } from "../types";

export interface SanctionApplication {
  sanctions: SanctionType[];
  cashDelta: number;
  employeesDelta: number;
  debtDelta: number;
  descriptions: string[];
}

/**
 * Détermine les sanctions déclenchées par un échec d'objectif (étape 7).
 * Les échecs consécutifs aggravent la sanction (section 3.5 : "deux échecs consécutifs sont lourds").
 */
export function determineSanctions(
  cashOk: boolean,
  employeesOk: boolean,
  consecutiveFailuresBefore: number
): SanctionType[] {
  const sanctions: SanctionType[] = [];
  if (!cashOk) sanctions.push("emprunt_urgence");
  if (!employeesOk) sanctions.push("departs");
  if (!cashOk || !employeesOk) {
    // Deuxième échec consécutif (ou pire) : sanctions supplémentaires plus lourdes.
    if (consecutiveFailuresBefore >= 1) {
      sanctions.push("capacite_reduite", "marche_restreint");
    }
  }
  return sanctions;
}

/** Applique les effets immédiats des sanctions choisies. Les effets différés (capacité, marché
 * restreint) sont appliqués au tour suivant via `team.activeSanctions`. */
export function applySanctions(
  team: TeamState,
  sanctions: SanctionType[]
): SanctionApplication {
  let cashDelta = 0;
  let employeesDelta = 0;
  let debtDelta = 0;
  const descriptions: string[] = [];

  if (sanctions.includes("emprunt_urgence") && team.cash < 0) {
    // Le déficit devient une dette avec intérêts ; la trésorerie est ramenée à zéro.
    const deficit = -team.cash;
    debtDelta += deficit;
    cashDelta += deficit;
    descriptions.push(
      `Emprunt d'urgence : ${deficit.toFixed(2)} € de déficit converti en dette`
    );
  }

  if (sanctions.includes("departs")) {
    const departures = Math.max(1, Math.ceil(team.employees * 0.25));
    employeesDelta -= departures;
    descriptions.push(`Départs : ${departures} employé(s) démissionnent`);
  }

  if (sanctions.includes("capacite_reduite")) {
    descriptions.push("Capacité de production réduite au tour suivant");
  }

  if (sanctions.includes("marche_restreint")) {
    descriptions.push("Marché restreint au tour suivant : achats plafonnés");
  }

  return { sanctions, cashDelta, employeesDelta, debtDelta, descriptions };
}

export const RESTRICTED_MARKET_MAX_BUY = GAME_CONSTANTS.materialsPerUnitProduced * 40;
