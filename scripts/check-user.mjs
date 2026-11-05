#!/usr/bin/env node
/**
 * Diagnóstico de login: confirma si un usuario quedó guardado en la MISMA
 * base que usa `next dev` y, opcionalmente, si una contraseña coincide con
 * su hash. No modifica nada.
 *
 * Uso:
 *   npm run db:check-user -- vos@mail.com
 *   npm run db:check-user -- vos@mail.com "la contraseña"
 */
import nextEnv from "@next/env";
import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

const [rawEmail, password] = process.argv.slice(2);
const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

if (!email) {
  console.error('Uso: npm run db:check-user -- vos@mail.com ["contraseña"]');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "fixea";

if (!uri) {
  console.error("Falta MONGODB_URI (en .env.local o en el entorno).");
  process.exit(1);
}

function describeTarget(rawUri) {
  try {
    return `${new URL(rawUri).protocol}//${new URL(rawUri).hostname}`;
  } catch {
    return "(URI no parseable)";
  }
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

try {
  await client.connect();
  const users = client.db(dbName).collection("users");

  console.log(`Base: ${dbName} en ${describeTarget(uri)}`);
  console.log(`Usuarios en la base: ${await users.countDocuments()}`);

  const user = await users.findOne({ email });

  if (!user) {
    // Ayuda a detectar mayúsculas/espacios guardados por código viejo.
    const similar = await users
      .find({ email: { $regex: email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } })
      .project({ email: 1 })
      .limit(5)
      .toArray();
    console.log(`\nNO existe un usuario con email "${email}".`);
    if (similar.length) {
      console.log("Parecidos:", similar.map((u) => JSON.stringify(u.email)).join(", "));
    }
    console.log(
      "\n=> El registro no llegó a ESTA base. Revisá que la app y este script usen el mismo MONGODB_URI/MONGODB_DB.",
    );
    process.exit(2);
  }

  const hash = typeof user.password === "string" ? user.password : "";
  console.log(`\nUsuario encontrado: ${user.email} (rol ${user.role}, creado ${user.createdAt?.toISOString?.() || user.createdAt})`);
  console.log(`Hash de contraseña: ${/^\$2[aby]\$\d{2}\$.{53}$/.test(hash) ? "bcrypt válido" : `INVÁLIDO (${hash ? hash.length + " caracteres" : "vacío"})`}`);

  if (password !== undefined) {
    const ok = await bcrypt.compare(password, hash);
    console.log(`La contraseña indicada ${ok ? "COINCIDE" : "NO coincide"} con la guardada.`);
    if (!ok && password !== password.trim()) {
      console.log("Ojo: la contraseña que pasaste tiene espacios al inicio o al final.");
    }
    process.exitCode = ok ? 0 : 3;
  }
} catch (error) {
  console.error("Error al consultar la base:", error?.message || error);
  process.exitCode = 1;
} finally {
  await client.close();
}
