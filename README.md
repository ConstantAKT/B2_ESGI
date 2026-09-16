# Usine — jeu de gestion en classe

Jeu de gestion d'usine multi-équipes, en temps limité, pour une classe (cf. `cahier des
charges`). Un enseignant crée une salle et obtient un code à 6 caractères ; les élèves
rejoignent depuis leur navigateur, forment des équipes, et jouent plusieurs tours
chronométrés et résolus simultanément pour toute la classe.

## Stack

| Couche | Choix |
| --- | --- |
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind CSS |
| Moteur de jeu | TypeScript pur dans `/engine`, sans dépendance React (cf. section 5.1 du CDC) |
| Backend | Routes API Next.js (`/app/api`), toute validation faite côté serveur |
| Base de données | PostgreSQL via Drizzle ORM (compatible Neon ou Supabase) |
| Temps réel | Polling toutes les 2 secondes (choix par défaut recommandé en section 5.6) |
| Déploiement | Vercel |

## Structure du dépôt

```
/engine          règles du jeu, TypeScript pur (types, marché, événements, difficulté,
                  production, charges, objectifs, sanctions, score, resolveTurn)
/lib/db          schéma Drizzle + client Postgres (connexion créée à la demande)
/lib/game        logique serveur : salles, équipes, joueurs, tick/résolution, actions, vues
/lib/client      utilitaires côté navigateur (polling, stockage local, appels API)
/app/api         routes serveur (salles, lobby, actions, contrôles enseignant)
/app             écrans : accueil, création de salle, écran enseignant, écran équipe
/components      composants d'interface partagés
```

## Développement local

### 1. Base de données

Il faut une base Postgres accessible. Deux options :

- **Neon** ou **Supabase** (gratuits, compatibles Vercel) : créez un projet, récupérez la
  chaîne de connexion Postgres.
- **Postgres local** (si installé) : `createdb usine_dev`.

Copiez `.env.example` vers `.env.local` et renseignez `DATABASE_URL`.

### 2. Installation et migration

```bash
npm install
npm run db:push   # applique le schéma (lib/db/schema.ts) à la base configurée
```

`npm run db:generate` régénère les fichiers de migration SQL dans `/drizzle` après une
modification du schéma ; `npm run db:migrate` les applique (utile en production plutôt que
`db:push`, qui est pratique en développement).

### 3. Lancer le serveur

```bash
npm run dev
```

- Écran d'accueil : `/`
- Créer une salle (enseignant) : `/host/new`
- Rejoindre une salle (élève) : depuis `/`, avec le code à 6 caractères

### 4. Tests du moteur

```bash
npm test
```

Les règles de résolution d'un tour (achats → production → ventes → RH → charges →
événement → objectif → sanctions → classement) sont testées unitairement, en console,
sans dépendance à la base de données — conformément à la phase 1 du planning (section 7).

## Déploiement sur Vercel

1. Importer le dépôt GitHub dans Vercel (Next.js est détecté automatiquement, aucune
   configuration `vercel.json` n'est nécessaire).
2. Renseigner la variable d'environnement `DATABASE_URL` dans les réglages du projet
   Vercel (Production et Preview), pointant vers votre base Neon ou Supabase.
3. Appliquer le schéma à la base de production avant le premier déploiement :
   ```bash
   DATABASE_URL=... npm run db:push
   ```
4. Déployer. Le build (`next build`) ne nécessite aucune connexion à la base : le client
   Postgres n'est créé qu'à la demande, au premier appel API.

## Comment fonctionne la résolution des tours

Vercel exécute des fonctions serverless sans tâche de fond persistante : il n'y a pas de
minuteur serveur qui déclenche lui-même la résolution d'un tour. À la place, chaque requête
qui touche une salle en cours de partie (`GET /api/rooms/[code]/host`,
`GET /api/rooms/[code]/team/[teamId]`, une action, une validation) appelle d'abord
`tickRoom()` (`lib/game/tick.ts`), qui résout le tour courant si le temps est écoulé ou si
toutes les équipes ont validé, puis fait avancer la transition de 30 secondes vers le tour
suivant. Le polling des écrans (toutes les 2 secondes) garantit que ce mécanisme tourne tant
qu'au moins un écran est ouvert.

## Choix et simplifications faits pour cette V1

Le cahier des charges laisse volontairement plusieurs points à définir pendant le
développement (section 9, « Décisions à prendre », listée dans le sommaire mais restée
vierge dans le document fourni) ou à calibrer en observant une vraie classe (section 7,
phase 5-6). Voici les choix faits pour cette première version, à ajuster ensemble :

- **Équilibrage économique** (prix de départ, salaires, loyer, énergie, seuils
  d'objectif, coûts d'embauche/licenciement...) : valeurs par défaut raisonnables dans
  `engine/types.ts` (`GAME_CONSTANTS`) et `engine/data/difficulty.ts`. À recalibrer après
  un test en conditions réelles, comme le prévoit le CDC.
- **RH (embauche/licenciement)** : le CDC liste la décision RH dans la boucle du tour
  (section 3.2) mais pas dans l'ordre de résolution strict (qui ne compte que 8 étapes).
  Elle est appliquée après les ventes et avant les charges, pour que les nouveaux salaires
  soient prélevés le tour où l'embauche est décidée, mais sans augmenter la capacité de
  production du tour en cours (la production utilise l'effectif en début de tour).
- **Authentification** : pas de compte, conformément à la section 6.3. L'enseignant reçoit
  un jeton secret à la création de la salle (stocké dans son navigateur) ; chaque élève
  reçoit un jeton de session à la connexion. Perdre le jeton (autre navigateur, cache vidé)
  signifie perdre l'accès à la salle en tant qu'hôte ou joueur.
- **Écran de transition** : fixé à 30 secondes entre chaque tour (section 2.3), non
  paramétrable dans cette V1.
- **Formation des équipes** : les élèves peuvent créer une équipe ou rejoindre une équipe
  existante librement ; l'enseignant peut aussi répartir automatiquement les joueurs non
  assignés.
- **Interface** : construite directement (pas de génération via v0, non disponible dans cet
  environnement). Le moteur (`/engine`) reste isolé de l'UI comme demandé en section 5.1,
  donc une régénération future de l'interface via v0 n'a pas besoin de le toucher.

## Ce qui n'est pas fait dans cette V1

Conformément au périmètre défini en section 6 :

- Rôles distincts dans une équipe, plusieurs produits, export CSV, historique des parties
  (section 6.2, "si le temps le permet") ne sont pas implémentés.
- Aucun test n'a pu être fait en conditions réelles avec une classe (phase 5 du planning) :
  l'équilibrage des prix et des seuils est donc à valider et ajuster ensemble.
- Testé localement avec une vraie base Postgres et un scénario de bout en bout (création de
  salle, lobby, plusieurs tours, sanctions, contrôles enseignant, fin de partie), mais pas
  encore déployé sur une instance Vercel réelle avec Neon/Supabase.
