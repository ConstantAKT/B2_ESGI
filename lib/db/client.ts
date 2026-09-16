import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let cachedClient: PostgresJsDatabase<typeof schema> | undefined;

/**
 * Client DB créé à la demande (jamais au chargement du module) : `next build` ne doit pas
 * exiger de connexion réseau à une base de données.
 */
export function getDb() {
  if (!cachedClient) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL n'est pas définie. Voir README pour la configuration.");
    }
    const client = postgres(connectionString, { max: 1 });
    cachedClient = drizzle(client, { schema });
  }
  return cachedClient;
}
