import type { MarketPrices, TeamState } from "../types";
import { GAME_CONSTANTS } from "../types";

export interface ScoreBreakdown {
  cash: number;
  materialsValue: number;
  goodsValue: number;
  employeesValue: number;
  debt: number;
  regularityBonus: number;
  total: number;
}

/**
 * Valeur d'entreprise (section 3.6) : trésorerie + valeur du stock + valeur des employés
 * - dette, avec un bonus de régularité pour les équipes jamais sanctionnées.
 */
export function computeScore(team: TeamState, market: MarketPrices): ScoreBreakdown {
  const materialsValue = team.materials * GAME_CONSTANTS.materialStockUnitValue;
  const goodsValue =
    team.finishedGoods * market.goodsSellPrice * GAME_CONSTANTS.goodsStockUnitValueRatio;
  const employeesValue = team.employees * GAME_CONSTANTS.employeeValue;
  const regularityBonus = team.everSanctioned ? 0 : GAME_CONSTANTS.regularityBonus;

  const total =
    team.cash + materialsValue + goodsValue + employeesValue - team.debt + regularityBonus;

  return {
    cash: team.cash,
    materialsValue,
    goodsValue,
    employeesValue,
    debt: team.debt,
    regularityBonus,
    total,
  };
}
