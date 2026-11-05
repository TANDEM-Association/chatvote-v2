/**
 * Seed des EPCI depuis geo.api.gouv.fr dans `institutions` + `institution_communes`.
 *
 *   /epcis (≈1 255)  +  /communes?fields=code,nom,codeEpci  → regroupés par codeEpci
 *
 * Idempotent. Clé d'upsert : `siren` (le `code` d'un EPCI dans l'API).
 * À la mise à jour, SEUL name/type sont réécrits : `chat_available` posé par
 * l'admin est préservé. Prérequis : les communes sont déjà seedées.
 *
 *   bun scripts/seed-epcis.ts
 *   bun scripts/seed-epcis.ts --dry-run
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "../schema";

const { communes, institutions, institutionCommunes } = schema;

const EPCIS_URL = "https://geo.api.gouv.fr/epcis?fields=code,nom,type&limit=2000";
const COMMUNES_URL =
	"https://geo.api.gouv.fr/communes?fields=code,nom,codeEpci&limit=40000";
const BATCH_SIZE = 1000;

interface GeoEpci {
	code: string; // SIREN
	nom: string;
	type: string;
}
interface GeoCommune {
	code: string;
	codeEpci?: string;
}

type InstitutionType = (typeof schema.institutionTypeEnum.enumValues)[number];

// Échoue sur un type inconnu plutôt que de l'inventer.
function mapType(geoType: string): InstitutionType {
	switch (geoType) {
		case "CC":
			return "communaute_de_communes";
		case "CA":
			return "agglomeration";
		case "CU":
			return "communaute_urbaine";
		case "METRO":
		case "MET69": // Métropole de Lyon : statut propre, même type ici
			return "metropole";
		default:
			throw new Error(`Type d'EPCI inconnu dans l'API geo : "${geoType}"`);
	}
}

async function getJson<T>(url: string): Promise<T> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`${url} → ${res.status} ${res.statusText}`);
	}
	return (await res.json()) as T;
}

const dryRun = process.argv.includes("--dry-run");
const url = process.env.DATABASE_URL;
if (!url) {
	throw new Error("DATABASE_URL is not set.");
}
const db = drizzle(url, { schema });

console.log("Téléchargement des EPCI et des communes…");
const [epcis, geoCommunes] = await Promise.all([
	getJson<GeoEpci[]>(EPCIS_URL),
	getJson<GeoCommune[]>(COMMUNES_URL),
]);

const membersByEpci = new Map<string, string[]>();
for (const c of geoCommunes) {
	if (c.codeEpci) {
		const list = membersByEpci.get(c.codeEpci) ?? [];
		list.push(c.code);
		membersByEpci.set(c.codeEpci, list);
	}
}
const totalMembers = [...membersByEpci.values()].reduce((n, m) => n + m.length, 0);
console.log(`${epcis.length} EPCI, ${totalMembers} appartenances.`);

if (dryRun) {
	console.log("--dry-run : aucune écriture.");
	process.exit(0);
}

// Les communes doivent exister (clé étrangère). On ne les crée pas ici.
const known = new Set(
	(await db.select({ code: communes.communeCode }).from(communes)).map(
		(r) => r.code
	)
);
if (known.size === 0) {
	throw new Error("Table communes vide : lance d'abord le seed des communes.");
}

let skipped = 0;
let linked = 0;
for (const epci of epcis) {
	const [inst] = await db
		.insert(institutions)
		.values({ siren: epci.code, name: epci.nom, type: mapType(epci.type) })
		.onConflictDoUpdate({
			target: institutions.siren,
			// chat_available volontairement absent : préserve la valeur admin.
			set: { name: sql`excluded.name`, type: sql`excluded.type` },
		})
		.returning({ id: institutions.id });
	if (!inst) {
		throw new Error(`Upsert sans résultat pour l'EPCI ${epci.code}`);
	}

	const codes = membersByEpci.get(epci.code) ?? [];
	const valid = codes.filter((code) => known.has(code));
	skipped += codes.length - valid.length;

	for (let i = 0; i < valid.length; i += BATCH_SIZE) {
		const rows = valid.slice(i, i + BATCH_SIZE).map((communeCode) => ({
			institutionId: inst.id,
			communeCode,
			role: "membre",
		}));
		await db.insert(institutionCommunes).values(rows).onConflictDoNothing();
		linked += rows.length;
	}
}

console.log(`Terminé : ${epcis.length} institutions, ${linked} liens traités.`);
if (skipped > 0) {
	console.warn(
		`ATTENTION : ${skipped} appartenances ignorées (commune absente de la table communes).`
	);
}
process.exit(0);
