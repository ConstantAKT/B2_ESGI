import { describe, expect, it } from "vitest";
import { resolveTurn } from "./resolveTurn";
import { createInitialTeamState } from "./initialState";
import { generateMarketPrices } from "./data/market";
import { computeScore } from "./rules/score";
import type { TeamActions } from "./types";

function noopActions(teamId: string, overrides: Partial<TeamActions> = {}): TeamActions {
  return {
    teamId,
    buyMaterials: 0,
    produce: 0,
    sellGoods: 0,
    hireDelta: 0,
    validated: true,
    ...overrides,
  };
}

describe("resolveTurn — tour normal", () => {
  it("achète, produit et vend correctement, dans l'ordre attendu", () => {
    const team = createInitialTeamState("equipeA", "normal");
    const market = generateMarketPrices("SALLE1", 1, "normal");

    const result = resolveTurn({
      turn: 1,
      difficulty: "normal",
      market,
      eventId: "calme",
      teams: [team],
      actions: {
        equipeA: noopActions("equipeA", { buyMaterials: 20, produce: 10, sellGoods: 0 }),
      },
    });

    const state = result.teamStates[0];
    // 20 matières achetées, 10 produites (consomme 10 matières) => reste 10.
    expect(state.materials).toBe(10);
    expect(state.finishedGoods).toBe(10);
    // Trésorerie de départ - coût des achats - charges (aucune vente ce tour).
    expect(state.cash).toBeLessThan(team.cash);

    const stepOrder = result.steps.map((s) => s.step);
    const firstOccurrence = (step: (typeof stepOrder)[number]) => stepOrder.indexOf(step);
    expect(firstOccurrence("achats")).toBeLessThan(firstOccurrence("production"));
    expect(firstOccurrence("production")).toBeLessThan(firstOccurrence("ventes"));
    expect(firstOccurrence("ventes")).toBeLessThan(firstOccurrence("charges"));
    expect(firstOccurrence("charges")).toBeLessThan(firstOccurrence("objectif"));
  });

  it("plafonne la production par la capacité (employés) et par les matières disponibles", () => {
    const team = { ...createInitialTeamState("equipeB", "normal"), employees: 2 };
    const market = generateMarketPrices("SALLE1", 1, "normal");

    const result = resolveTurn({
      turn: 1,
      difficulty: "normal",
      market,
      eventId: "calme",
      teams: [team],
      actions: {
        equipeB: noopActions("equipeB", { buyMaterials: 100, produce: 999 }),
      },
    });

    // Capacité = 2 employés * 4 unités = 8, malgré une demande de production de 999.
    expect(result.teamStates[0].finishedGoods).toBe(8);
  });
});

describe("resolveTurn — objectifs et sanctions", () => {
  it("déclenche un emprunt d'urgence quand la trésorerie finale est négative", () => {
    const team = { ...createInitialTeamState("equipeC", "normal"), cash: 50, employees: 5 };
    const market = generateMarketPrices("SALLE1", 1, "normal");

    const result = resolveTurn({
      turn: 1,
      difficulty: "normal",
      market,
      eventId: "calme",
      teams: [team],
      actions: {
        equipeC: noopActions("equipeC", {}),
      },
    });

    const state = result.teamStates[0];
    expect(result.sanctionedTeamIds).toContain("equipeC");
    expect(state.cash).toBeGreaterThanOrEqual(0);
    expect(state.debt).toBeGreaterThan(0);
    expect(state.everSanctioned).toBe(true);
  });

  it("aggrave la sanction en cas d'échecs consécutifs", () => {
    const team = {
      ...createInitialTeamState("equipeD", "normal"),
      cash: 50,
      employees: 5,
      consecutiveFailures: 1,
    };
    const market = generateMarketPrices("SALLE1", 2, "normal");

    const result = resolveTurn({
      turn: 2,
      difficulty: "normal",
      market,
      eventId: "calme",
      teams: [team],
      actions: { equipeD: noopActions("equipeD", {}) },
    });

    const state = result.teamStates[0];
    expect(state.activeSanctions).toContain("capacite_reduite");
    expect(state.activeSanctions).toContain("marche_restreint");
    expect(state.consecutiveFailures).toBe(2);
  });

  it("ne sanctionne pas une équipe qui atteint ses objectifs", () => {
    const team = { ...createInitialTeamState("equipeE", "facile"), cash: 5000, employees: 5 };
    const market = generateMarketPrices("SALLE1", 1, "facile");

    const result = resolveTurn({
      turn: 1,
      difficulty: "facile",
      market,
      eventId: "calme",
      teams: [team],
      actions: { equipeE: noopActions("equipeE", {}) },
    });

    expect(result.sanctionedTeamIds).not.toContain("equipeE");
    expect(result.teamStates[0].consecutiveFailures).toBe(0);
  });
});

describe("resolveTurn — RH", () => {
  it("embauche avant le calcul des charges : le salaire du nouvel employé est prélevé ce tour", () => {
    const team = { ...createInitialTeamState("equipeF", "normal"), employees: 1, cash: 5000 };
    const market = generateMarketPrices("SALLE1", 1, "normal");

    const result = resolveTurn({
      turn: 1,
      difficulty: "normal",
      market,
      eventId: "calme",
      teams: [team],
      actions: { equipeF: noopActions("equipeF", { hireDelta: 2 }) },
    });

    expect(result.teamStates[0].employees).toBe(3);
    const chargeStep = result.steps.find((s) => s.step === "charges" && s.teamId === "equipeF");
    expect(chargeStep?.detail).toContain("240"); // 3 employés * 80 = 240 de salaires
  });

  it("ne peut pas produire au-delà de la capacité de début de tour même en embauchant ce tour-ci", () => {
    const team = { ...createInitialTeamState("equipeG", "normal"), employees: 1, cash: 5000 };
    const market = generateMarketPrices("SALLE1", 1, "normal");

    const result = resolveTurn({
      turn: 1,
      difficulty: "normal",
      market,
      eventId: "calme",
      teams: [team],
      actions: {
        equipeG: noopActions("equipeG", { buyMaterials: 50, produce: 20, hireDelta: 4 }),
      },
    });

    // Capacité basée sur 1 employé en début de tour = 4 unités, malgré 5 employés en fin de tour.
    expect(result.teamStates[0].finishedGoods).toBe(4);
  });
});

describe("resolveTurn — événements", () => {
  it("applique le bonus de trésorerie d'une commande exceptionnelle", () => {
    const team = createInitialTeamState("equipeH", "normal");
    const market = generateMarketPrices("SALLE1", 1, "normal");

    const result = resolveTurn({
      turn: 1,
      difficulty: "normal",
      market,
      eventId: "commande_exceptionnelle",
      teams: [team],
      actions: { equipeH: noopActions("equipeH", {}) },
    });

    const eventStep = result.steps.find((s) => s.step === "evenement");
    expect(eventStep?.cashDelta).toBe(200);
  });

  it("réduit la capacité de production en cas de panne machine", () => {
    const team = { ...createInitialTeamState("equipeI", "normal"), employees: 4 };
    const market = generateMarketPrices("SALLE1", 1, "normal");

    const result = resolveTurn({
      turn: 1,
      difficulty: "normal",
      market,
      eventId: "panne_machine",
      teams: [team],
      actions: { equipeI: noopActions("equipeI", { buyMaterials: 50, produce: 16 }) },
    });

    // Capacité normale = 16, panne machine = multiplicateur 0.5 => 8.
    expect(result.teamStates[0].finishedGoods).toBe(8);
  });
});

describe("computeScore", () => {
  it("accorde le bonus de régularité à une équipe jamais sanctionnée", () => {
    const team = createInitialTeamState("equipeJ", "normal");
    const market = generateMarketPrices("SALLE1", 1, "normal");
    const score = computeScore(team, market);
    expect(score.regularityBonus).toBeGreaterThan(0);
  });

  it("retire le bonus de régularité dès qu'une équipe a été sanctionnée une fois", () => {
    const team = { ...createInitialTeamState("equipeK", "normal"), everSanctioned: true };
    const market = generateMarketPrices("SALLE1", 1, "normal");
    const score = computeScore(team, market);
    expect(score.regularityBonus).toBe(0);
  });
});

describe("generateMarketPrices", () => {
  it("est déterministe pour une salle et un tour donnés", () => {
    const a = generateMarketPrices("ABC123", 3, "normal");
    const b = generateMarketPrices("ABC123", 3, "normal");
    expect(a).toEqual(b);
  });

  it("diffère selon la salle (seed)", () => {
    const a = generateMarketPrices("ABC123", 3, "normal");
    const b = generateMarketPrices("XYZ999", 3, "normal");
    expect(a.materialBuyPrice).not.toBe(b.materialBuyPrice);
  });
});
