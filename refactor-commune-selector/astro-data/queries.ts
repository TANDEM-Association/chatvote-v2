// Requêtes communes / institutions, sans framework. Prennent `db` en paramètre :
// appelle-les depuis une page .astro, un endpoint src/pages/api/*, ou un middleware.
// `isValidCommuneCode` vient de ../extracted/commune-code.ts (accepte la Corse).

import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { isValidCommuneCode } from "../extracted/commune-code";
import * as schema from "./schema";

const { communes, institutions, institutionCommunes } = schema;

export type Db = NodePgDatabase<typeof schema>;

const SEARCH_LIMIT = 20;
const SEARCH_MIN = 2;
const SEARCH_MAX = 100;
// Types affichés comme "intercommunalité" dans la recherche (comme ChatVote).
const SEARCH_EPCI_TYPES = [
	"communaute_de_communes",
	"agglomeration",
	"communaute_urbaine",
	"metropole",
	"syndicat",
] as const;

// Échappe % _ \ pour que la saisie utilisateur soit un texte littéral dans ILIKE.
function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, "\\$&");
}

// ── Disponibilité : source de vérité unique ────────────────────────────────

export type Availability =
	| { status: "unknown" } // code mal formé ou absent de la base → 404
	| { status: "unavailable"; name: string } // page d'erreur dédiée
	| { status: "available"; name: string }; // le chat

export async function getCommuneAvailability(
	db: Db,
	communeCode: string
): Promise<Availability> {
	if (!isValidCommuneCode(communeCode)) {
		return { status: "unknown" };
	}
	const [row] = await db
		.select({ name: communes.name, chatAvailable: communes.chatAvailable })
		.from(communes)
		.where(eq(communes.communeCode, communeCode))
		.limit(1);
	if (!row) {
		return { status: "unknown" };
	}
	return {
		status: row.chatAvailable ? "available" : "unavailable",
		name: row.name,
	};
}

export async function getInstitutionAvailability(
	db: Db,
	institutionId: string
): Promise<Availability> {
	const [row] = await db
		.select({
			name: institutions.name,
			chatAvailable: institutions.chatAvailable,
		})
		.from(institutions)
		.where(eq(institutions.id, institutionId))
		.limit(1);
	if (!row) {
		return { status: "unknown" };
	}
	return {
		status: row.chatAvailable ? "available" : "unavailable",
		name: row.name,
	};
}

// ── Lecture ────────────────────────────────────────────────────────────────

export async function getCommuneByCode(db: Db, communeCode: string) {
	if (!isValidCommuneCode(communeCode)) {
		return null;
	}
	const [row] = await db
		.select({
			communeCode: communes.communeCode,
			name: communes.name,
			departmentName: communes.departmentName,
			chatAvailable: communes.chatAvailable,
		})
		.from(communes)
		.where(eq(communes.communeCode, communeCode))
		.limit(1);
	return row ?? null;
}

export async function getInstitutionsOfCommune(db: Db, communeCode: string) {
	if (!isValidCommuneCode(communeCode)) {
		return [];
	}
	return await db
		.select({
			institutionId: institutionCommunes.institutionId,
			role: institutionCommunes.role,
			institutionName: institutions.name,
			institutionType: institutions.type,
			chatAvailable: institutions.chatAvailable,
		})
		.from(institutionCommunes)
		.innerJoin(
			institutions,
			eq(institutions.id, institutionCommunes.institutionId)
		)
		.where(eq(institutionCommunes.communeCode, communeCode));
}

export async function getCommunesOfInstitution(db: Db, institutionId: string) {
	return await db
		.select({
			communeCode: communes.communeCode,
			name: communes.name,
			chatAvailable: communes.chatAvailable,
		})
		.from(institutionCommunes)
		.innerJoin(communes, eq(communes.communeCode, institutionCommunes.communeCode))
		.where(eq(institutionCommunes.institutionId, institutionId))
		.orderBy(asc(communes.name));
}

export async function listAvailableCommunes(db: Db) {
	return await db
		.select({ communeCode: communes.communeCode, name: communes.name })
		.from(communes)
		.where(eq(communes.chatAvailable, true))
		.orderBy(asc(communes.name));
}

export async function listAvailableInstitutions(db: Db) {
	return await db
		.select({ id: institutions.id, name: institutions.name, type: institutions.type })
		.from(institutions)
		.where(eq(institutions.chatAvailable, true))
		.orderBy(asc(institutions.name));
}

// ── Recherche ──────────────────────────────────────────────────────────────

export interface CommuneSearchHit {
	chatAvailable: boolean;
	communeCode: string;
	departmentCode: string | null;
	departmentName: string | null;
	epci: { id: string; name: string; chatAvailable: boolean } | null;
	name: string;
	postalCodes: string[];
	regionName: string | null;
}

/**
 * Nom, code INSEE (préfixe) ou code postal. Les communes disponibles sortent
 * en premier, puis par population décroissante. Une ligne par commune.
 */
export async function searchCommunes(
	db: Db,
	query: string
): Promise<CommuneSearchHit[]> {
	const term = query.trim();
	if (term.length < SEARCH_MIN || term.length > SEARCH_MAX) {
		return [];
	}
	const like = escapeLike(term);

	const rows = await db
		.select({
			communeCode: communes.communeCode,
			name: communes.name,
			departmentCode: communes.departmentCode,
			departmentName: communes.departmentName,
			regionName: communes.regionName,
			postalCodes: communes.postalCodes,
			chatAvailable: communes.chatAvailable,
			epciId: institutions.id,
			epciName: institutions.name,
			epciAvailable: institutions.chatAvailable,
		})
		.from(communes)
		.leftJoin(
			institutionCommunes,
			eq(institutionCommunes.communeCode, communes.communeCode)
		)
		.leftJoin(
			institutions,
			and(
				eq(institutions.id, institutionCommunes.institutionId),
				inArray(institutions.type, [...SEARCH_EPCI_TYPES])
			)
		)
		.where(
			or(
				ilike(communes.name, `%${like}%`),
				ilike(communes.communeCode, `${like}%`),
				sql`${communes.postalCodes}::text ilike ${`%${like}%`}`
			)
		)
		.orderBy(
			desc(communes.chatAvailable),
			desc(sql`coalesce(${communes.population}, 0)`),
			asc(communes.name)
		)
		// Marge : une commune peut sortir plusieurs fois avant dédoublonnage.
		.limit(SEARCH_LIMIT * 3);

	// Dédoublonnage : une seule entrée par commune, en préférant la ligne qui
	// porte l'EPCI. Map conserve l'ordre d'insertion, donc le tri SQL.
	const byCommune = new Map<string, CommuneSearchHit>();
	for (const row of rows) {
		const hit: CommuneSearchHit = {
			communeCode: row.communeCode,
			name: row.name,
			departmentCode: row.departmentCode,
			departmentName: row.departmentName,
			regionName: row.regionName,
			postalCodes: row.postalCodes,
			chatAvailable: row.chatAvailable,
			epci:
				row.epciId != null && row.epciName != null
					? {
							id: row.epciId,
							name: row.epciName,
							chatAvailable: row.epciAvailable ?? false,
						}
					: null,
		};
		const existing = byCommune.get(row.communeCode);
		if (!existing || (existing.epci == null && hit.epci != null)) {
			byCommune.set(row.communeCode, hit);
		}
	}
	return [...byCommune.values()].slice(0, SEARCH_LIMIT);
}
