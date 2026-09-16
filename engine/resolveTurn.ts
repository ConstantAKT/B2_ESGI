import type {
  Difficulty,
  MarketPrices,
  TeamActions,
  TeamState,
  TurnResolutionResult,
  TurnStepReport,
} from "./types";
import { GAME_CONSTANTS } from "./types";
import { getEventById } from "./data/events";
import { computeActualProduction, computeCapacity } from "./rules/production";
import { computeCharges } from "./rules/charges";
import { checkObjective } from "./rules/objectives";
import { applySanctions, determineSanctions, RESTRICTED_MARKET_MAX_BUY } from "./rules/sanctions";

export interface ResolveTurnInput {
  turn: number;
  difficulty: Difficulty;
  market: MarketPrices;
  eventId: string;
  teams: TeamState[];
  actions: Record<string, TeamActions>;
}

/**
 * Résolution d'un tour pour toute la salle, dans l'ordre strict du cahier des charges (3.2) :
 * achats → production → ventes → (RH, cf. boucle du tour en 3.2) → charges → événement →
 * objectif → sanctions → classement.
 */
export function resolveTurn(input: ResolveTurnInput): TurnResolutionResult {
  const { turn, difficulty, market, eventId, teams, actions } = input;
  const event = getEventById(eventId);

  const steps: TurnStepReport[] = [];
  const sanctionedTeamIds: string[] = [];
  const costliestDecision: TurnResolutionResult["costliestDecision"] = {};
  const nextStates: TeamState[] = [];

  const effectiveMaterialBuyPrice =
    market.materialBuyPrice * (event.effects.materialBuyPriceMultiplier ?? 1);
  const effectiveGoodsSellPrice =
    market.goodsSellPrice * (event.effects.goodsSellPriceMultiplier ?? 1);

  for (const team of teams) {
    const teamActions: TeamActions = actions[team.teamId] ?? {
      teamId: team.teamId,
      buyMaterials: 0,
      produce: 0,
      sellGoods: 0,
      hireDelta: 0,
      validated: false,
    };

    let cash = team.cash;
    let materials = team.materials;
    let finishedGoods = team.finishedGoods;
    let employees = team.employees;
    let debt = team.debt;
    const decisionCosts: { label: string; amount: number }[] = [];

    // 1. Achats
    const restrictedMarket = team.activeSanctions.includes("marche_restreint");
    const maxBuy = restrictedMarket
      ? Math.min(teamActions.buyMaterials, RESTRICTED_MARKET_MAX_BUY)
      : teamActions.buyMaterials;
    const buyQuantity = Math.max(0, Math.floor(maxBuy));
    const purchaseCost = round2(buyQuantity * effectiveMaterialBuyPrice);
    cash -= purchaseCost;
    materials += buyQuantity;
    steps.push({
      step: "achats",
      teamId: team.teamId,
      detail: `Achat de ${buyQuantity} matière(s) à ${effectiveMaterialBuyPrice.toFixed(2)} €`,
      cashDelta: -purchaseCost,
    });
    if (purchaseCost > 0) decisionCosts.push({ label: "Achats de matières", amount: -purchaseCost });

    // 2. Production (capacité basée sur l'effectif en début de tour, avant décision RH)
    const capacity = computeCapacity(team, team.activeSanctions);
    const actualProduction = computeActualProduction(
      Math.max(0, Math.floor(teamActions.produce)),
      materials,
      capacity,
      event.effects.capacityMultiplier ?? 1
    );
    materials -= actualProduction * GAME_CONSTANTS.materialsPerUnitProduced;
    finishedGoods += actualProduction;
    steps.push({
      step: "production",
      teamId: team.teamId,
      detail: `Production de ${actualProduction} unité(s) (capacité ${capacity})`,
      cashDelta: 0,
    });

    // 3. Ventes
    const sellQuantity = Math.max(0, Math.min(Math.floor(teamActions.sellGoods), finishedGoods));
    const revenue = round2(sellQuantity * effectiveGoodsSellPrice);
    cash += revenue;
    finishedGoods -= sellQuantity;
    steps.push({
      step: "ventes",
      teamId: team.teamId,
      detail: `Vente de ${sellQuantity} unité(s) à ${effectiveGoodsSellPrice.toFixed(2)} €`,
      cashDelta: revenue,
    });

    // RH : embauche ou licenciement, finalisé avant le calcul des charges du tour.
    const hireDelta = Math.trunc(teamActions.hireDelta);
    let rhCost = 0;
    if (hireDelta > 0) {
      rhCost = round2(hireDelta * GAME_CONSTANTS.hireCostPerEmployee);
      employees += hireDelta;
    } else if (hireDelta < 0) {
      const fired = Math.min(-hireDelta, employees);
      rhCost = round2(fired * GAME_CONSTANTS.fireCostPerEmployee);
      employees -= fired;
    }
    cash -= rhCost;
    if (rhCost > 0) {
      steps.push({
        step: "rh",
        teamId: team.teamId,
        detail:
          hireDelta > 0
            ? `Embauche de ${hireDelta} employé(s)`
            : `Licenciement de ${-hireDelta} employé(s)`,
        cashDelta: -rhCost,
      });
      decisionCosts.push({ label: "Mouvement RH", amount: -rhCost });
    }

    // 4. Charges
    const charges = computeCharges({ ...team, employees, debt }, event);
    cash -= charges.total;
    steps.push({
      step: "charges",
      teamId: team.teamId,
      detail: `Salaires ${charges.salaries.toFixed(2)} € + loyer ${charges.rent.toFixed(2)} € + énergie ${charges.energy.toFixed(2)} € + intérêts ${charges.debtInterest.toFixed(2)} €`,
      cashDelta: -charges.total,
    });
    decisionCosts.push({ label: "Charges", amount: -charges.total });

    // 5. Événement (effet en trésorerie du tour, ex. commande exceptionnelle, avarie)
    const eventCashDelta = event.effects.cashDelta ?? 0;
    cash += eventCashDelta;
    if (eventCashDelta !== 0) {
      steps.push({
        step: "evenement",
        teamId: team.teamId,
        detail: `${event.label} : ${eventCashDelta > 0 ? "+" : ""}${eventCashDelta.toFixed(2)} €`,
        cashDelta: eventCashDelta,
      });
    }

    // 6. Contrôle de l'objectif
    const provisionalTeam: TeamState = {
      ...team,
      cash,
      materials,
      finishedGoods,
      employees,
      debt,
    };
    const objectiveResult = checkObjective(provisionalTeam, difficulty, turn);
    steps.push({
      step: "objectif",
      teamId: team.teamId,
      detail: objectiveResult.passed
        ? "Objectif atteint"
        : `Objectif manqué (trésorerie min ${objectiveResult.objective.minCash} €, effectif min ${objectiveResult.objective.minEmployees})`,
      cashDelta: 0,
    });

    // 7. Sanctions éventuelles
    const sanctions = objectiveResult.passed
      ? []
      : determineSanctions(objectiveResult.cashOk, objectiveResult.employeesOk, team.consecutiveFailures);
    let everSanctioned = team.everSanctioned;
    let consecutiveFailures = team.consecutiveFailures;

    if (!objectiveResult.passed) {
      sanctionedTeamIds.push(team.teamId);
      everSanctioned = true;
      consecutiveFailures += 1;
      const application = applySanctions(provisionalTeam, sanctions);
      cash += application.cashDelta;
      debt += application.debtDelta;
      employees = Math.max(0, employees + application.employeesDelta);
      for (const description of application.descriptions) {
        steps.push({ step: "sanctions", teamId: team.teamId, detail: description, cashDelta: 0 });
      }
      if (application.debtDelta > 0) {
        decisionCosts.push({ label: "Emprunt d'urgence", amount: -application.debtDelta });
      }
    } else {
      consecutiveFailures = 0;
    }

    nextStates.push({
      teamId: team.teamId,
      cash: round2(cash),
      materials,
      finishedGoods,
      employees,
      debt: round2(debt),
      activeSanctions: sanctions,
      everSanctioned,
      consecutiveFailures,
    });

    const costliest = decisionCosts.sort((a, b) => a.amount - b.amount)[0];
    if (costliest) {
      costliestDecision[team.teamId] = costliest;
    }
  }

  // 8. Mise à jour du classement (délégué à l'appelant via computeScore, cf. rules/score.ts)
  steps.push({
    step: "classement",
    teamId: "*",
    detail: "Classement mis à jour",
    cashDelta: 0,
  });

  return { turn, teamStates: nextStates, steps, sanctionedTeamIds, costliestDecision };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
