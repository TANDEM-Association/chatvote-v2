/**
 * Active ou désactive le chat pour une commune ou une institution.
 *
 *   bun scripts/set-availability.ts commune 69123 on
 *   bun scripts/set-availability.ts commune 69123 off
 *   bun scripts/set-availability.ts institution 200046977 on   # SIREN de l'EPCI
 *   bun scripts/set-availability.ts list
 *
 * Échoue bruyamment si la cible n'existe pas (pas de no-op silencieux).
 * Nécessite DATABASE_URL.
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { isValidCommuneCode } from "../../extracted/commune-code";
import * as schema from "../schema";

const { communes, institutions } = schema;

const USAGE =
	"Usage: set-availability.ts <commune|institution> <code|siren> <on|off>  |  list";
const SIREN_REGEX = /^\d{9}$/;

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
	fail("DATABASE_URL is not set.");
}
const db = drizzle(url, { schema });

const [kind, key, state] = process.argv.slice(2);

if (kind === "list") {
	const c = await db
		.select({ code: communes.communeCode, name: communes.name })
		.from(communes)
		.where(eq(communes.chatAvailable, true));
	const i = await db
		.select({ siren: institutions.siren, name: institutions.name })
		.from(institutions)
		.where(eq(institutions.chatAvailable, true));
	console.log("Communes disponibles :");
	for (const row of c) {
		console.log(`  ${row.code}  ${row.name}`);
	}
	console.log("Institutions disponibles :");
	for (const row of i) {
		console.log(`  ${row.siren}  ${row.name}`);
	}
	process.exit(0);
}

if (!(kind && key && (state === "on" || state === "off"))) {
	fail(USAGE);
}
const chatAvailable = state === "on";

if (kind === "commune") {
	if (!isValidCommuneCode(key)) {
		fail(`Code INSEE invalide : ${key}`);
	}
	const rows = await db
		.update(communes)
		.set({ chatAvailable })
		.where(eq(communes.communeCode, key))
		.returning({ name: communes.name });
	if (rows.length === 0) {
		fail(`Aucune commune avec le code ${key}. Le seed communes a-t-il tourné ?`);
	}
	console.log(`${rows[0]?.name} (${key}) → chat ${state}`);
} else if (kind === "institution") {
	if (!SIREN_REGEX.test(key)) {
		fail(`SIREN invalide (9 chiffres attendus) : ${key}`);
	}
	const rows = await db
		.update(institutions)
		.set({ chatAvailable })
		.where(eq(institutions.siren, key))
		.returning({ name: institutions.name });
	if (rows.length === 0) {
		fail(`Aucune institution avec le SIREN ${key}. Le seed EPCI a-t-il tourné ?`);
	}
	console.log(`${rows[0]?.name} (${key}) → chat ${state}`);
} else {
	fail(USAGE);
}
process.exit(0);
