import type { GameEventDefinition } from "../types";

/**
 * Liste fixe et connue d'événements (section 3.7 du cahier des charges) : pas de génération
 * aléatoire pure, pour qu'un enseignant puisse anticiper le déroulé de sa séance.
 */
export const GAME_EVENTS: GameEventDefinition[] = [
  {
    id: "calme",
    label: "Calme plat",
    description: "Aucun événement particulier ce tour-ci.",
    effects: {},
  },
  {
    id: "hausse_energie",
    label: "Hausse du prix de l'énergie",
    description: "Le coût de l'énergie double pour ce tour.",
    effects: { energyCostMultiplier: 2 },
  },
  {
    id: "commande_exceptionnelle",
    label: "Commande exceptionnelle",
    description: "Un client passe une grosse commande : trésorerie bonus immédiate.",
    effects: { cashDelta: 200 },
  },
  {
    id: "panne_machine",
    label: "Panne machine",
    description: "Une ligne de production tombe en panne : capacité réduite de moitié.",
    effects: { capacityMultiplier: 0.5 },
  },
  {
    id: "greve",
    label: "Grève",
    description: "Mouvement social : capacité de production réduite au tiers.",
    effects: { capacityMultiplier: 0.33 },
  },
  {
    id: "effondrement_prix_vente",
    label: "Effondrement du prix de vente",
    description: "Le marché est saturé : le prix de vente chute fortement.",
    effects: { goodsSellPriceMultiplier: 0.6 },
  },
  {
    id: "penurie_matieres",
    label: "Pénurie de matières premières",
    description: "Les fournisseurs sont sous tension : le prix d'achat s'envole.",
    effects: { materialBuyPriceMultiplier: 1.6 },
  },
  {
    id: "prime_qualite",
    label: "Prime qualité",
    description: "Un label qualité obtenu fait grimper le prix de vente.",
    effects: { goodsSellPriceMultiplier: 1.3 },
  },
  {
    id: "avarie_stock",
    label: "Avarie de stock",
    description: "Un incident endommage le matériel : coût immédiat de remise en état.",
    effects: { cashDelta: -150 },
  },
];

export function getEventById(id: string): GameEventDefinition {
  const event = GAME_EVENTS.find((e) => e.id === id);
  if (!event) {
    throw new Error(`Événement inconnu : ${id}`);
  }
  return event;
}

/** Séquence par défaut proposée à l'enseignant dans le lobby, une entrée par tour possible. */
export const DEFAULT_EVENT_SEQUENCE: string[] = [
  "calme",
  "hausse_energie",
  "commande_exceptionnelle",
  "panne_machine",
  "effondrement_prix_vente",
  "penurie_matieres",
  "greve",
];
