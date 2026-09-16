// Contrats de données du moteur de jeu. TypeScript pur, jamais importé par les composants React.

export type Difficulty = "facile" | "normal" | "difficile";

export type SanctionType =
  | "emprunt_urgence"
  | "departs"
  | "capacite_reduite"
  | "marche_restreint";

export interface RoomSettings {
  /** Nombre de tours de la partie : 3, 5 ou 7. */
  totalTurns: 3 | 5 | 7;
  /** Durée d'un tour en secondes. */
  turnDurationSeconds: number;
  difficulty: Difficulty;
  /** Affiche les résultats détaillés à chaque équipe juste après résolution. */
  showResultsImmediately: boolean;
  /** Identifiants d'événements choisis par l'enseignant, un par tour (index 0 = tour 1). */
  eventIds: string[];
}

export interface MarketPrices {
  turn: number;
  /** Prix d'achat d'une unité de matière première. */
  materialBuyPrice: number;
  /** Prix de vente d'une unité de produit fini. */
  goodsSellPrice: number;
  /** Indice de tendance visible à l'avance (-1 baisse, 0 stable, 1 hausse), imprécis. */
  trendIndex: -1 | 0 | 1;
}

export interface GameEventDefinition {
  id: string;
  label: string;
  description: string;
  /** Effets appliqués lors de la résolution du tour où l'événement est actif. */
  effects: {
    materialBuyPriceMultiplier?: number;
    goodsSellPriceMultiplier?: number;
    energyCostMultiplier?: number;
    /** Bonus de trésorerie immédiat (commande exceptionnelle) ou négatif (panne). */
    cashDelta?: number;
    /** Réduit la capacité de production ce tour (panne machine, grève partielle). */
    capacityMultiplier?: number;
  };
}

export interface TeamState {
  teamId: string;
  cash: number;
  materials: number;
  finishedGoods: number;
  employees: number;
  debt: number;
  /** Sanctions actives pour le tour à venir (effet sur ce tour, puis retirées). */
  activeSanctions: SanctionType[];
  /** Vrai si l'équipe a un jour manqué un objectif : perd le bonus de régularité. */
  everSanctioned: boolean;
  /** Nombre d'échecs d'objectif consécutifs (0 si le dernier tour contrôlé était réussi). */
  consecutiveFailures: number;
}

export interface TeamActions {
  teamId: string;
  /** Quantité de matières premières achetées ce tour. */
  buyMaterials: number;
  /** Quantité de produits finis à fabriquer (plafonnée par le moteur). */
  produce: number;
  /** Quantité de produits finis vendus ce tour. */
  sellGoods: number;
  /** Delta d'effectif : positif = embauches, négatif = licenciements. */
  hireDelta: number;
  /** Vrai si l'équipe a validé son tour avant expiration du chrono. */
  validated: boolean;
}

export interface TurnObjective {
  minCash: number;
  minEmployees: number;
}

export interface TurnStepReport {
  step:
    | "achats"
    | "production"
    | "ventes"
    | "rh"
    | "charges"
    | "evenement"
    | "objectif"
    | "sanctions"
    | "classement";
  teamId: string;
  detail: string;
  cashDelta: number;
}

export interface TurnResolutionResult {
  turn: number;
  teamStates: TeamState[];
  /** Rapport détaillé par équipe et par étape, pour l'écran de transition et le récap final. */
  steps: TurnStepReport[];
  /** Équipes ayant échoué à l'objectif de ce tour (entrent en redressement au tour suivant). */
  sanctionedTeamIds: string[];
  /** Pour chaque équipe, la décision qui lui a coûté le plus cher ce tour (montant négatif). */
  costliestDecision: Record<string, { label: string; amount: number }>;
}

export const GAME_CONSTANTS = {
  unitsProducedPerEmployee: 4,
  materialsPerUnitProduced: 1,
  salaryPerEmployee: 80,
  rentPerTurn: 150,
  energyPerTurn: 100,
  debtInterestRate: 0.1,
  hireCostPerEmployee: 50,
  fireCostPerEmployee: 20,
  materialStockUnitValue: 5,
  goodsStockUnitValueRatio: 0.6, // valeur de stock = ratio * prix de vente courant
  employeeValue: 200,
  regularityBonus: 300,
} as const;
