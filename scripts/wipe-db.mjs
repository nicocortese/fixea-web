#!/usr/bin/env node
/**
 * Vacía por completo las colecciones `users`, `projects` y `tickets`.
 *
 * Uso:
 *   npm run db:wipe              -> muestra a qué base apunta y cuántos documentos
 *                                   hay, SIN borrar nada.
 *   npm run db:wipe -- --yes     -> borra los documentos de las tres colecciones.
 *
 * Lee MONGODB_URI y MONGODB_DB de .env.local / .env (igual que la app).
 * Es irreversible: hacé un export desde Atlas antes si necesitás algo.
 */
import { config } from "dotenv";
import { MongoClient } from "mongodb";

config({ path: ".env.local" });
config();

const COLLECTIONS = ["users", "projects", "tickets"];
const confirmed = process.argv.includes("--yes");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "fixea";

if (!uri) {
  console.error("Falta MONGODB_URI (en .env.local o en el entorno).");
  process.exit(1);
}

// Nunca imprimimos la URI completa: lleva usuario y contraseña.
function describeTarget(rawUri) {
  try {
    const url = new URL(rawUri);
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return "(URI no parseable)";
  }
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

try {
  await client.connect();
  const db = client.db(dbName);

  console.log(`Base: ${dbName} en ${describeTarget(uri)}`);

  for (const name of COLLECTIONS) {
    const count = await db.collection(name).countDocuments();
    console.log(`  ${name.padEnd(9)} ${count} documento(s)`);
  }

  if (!confirmed) {
    console.log(
      "\nNo se borró nada. Para vaciar las colecciones corré:\n  npm run db:wipe -- --yes",
    );
    process.exit(0);
  }

  for (const name of COLLECTIONS) {
    const { deletedCount } = await db.collection(name).deleteMany({});
    console.log(`Borrados ${deletedCount} documento(s) de ${name}`);
  }

  console.log("\nListo: base vacía.");
} catch (error) {
  console.error("Error al limpiar la base:", error?.message || error);
  process.exitCode = 1;
} finally {
  await client.close();
}
