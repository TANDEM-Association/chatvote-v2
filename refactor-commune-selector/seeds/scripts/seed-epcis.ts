/**
 * Seed all French EPCIs from geo.api.gouv.fr into prod DB.
 *
 * Source: https://geo.api.gouv.fr/epcis?fields=code,nom,type,membres
 *   → 1,255 EPCIs (CC, CA, CU, METRO, MET69) + their member communes.
 *
 * Inserts (idempotent — safe to re-run):
 *   - 1 institution per EPCI
 *   - N rows in institution_communes (one per member commune)
 *
 * Type mapping (constrained by existing institution_type enum):
 *   - CC      → communaute_de_communes
 *   - CA, CU,
 *     METRO,
 *     MET69   → agglomeration
 *
 * IMPORTANT: This script only writes structural metadata (institutions +
 * commune mappings). It does NOT trigger ZAQ ingestion, LLM calls, or PV
 * discovery. PV discovery for each EPCI only runs lazily when a visitor
 * navigates to the corresponding council page (see getCouncilReport →
 * processUntilDone). Cost: zero embeddings, zero LLM tokens.
 *
 * Usage:
 *   bun run scripts/seed-epcis.ts
 *   bun run scripts/seed-epcis.ts --dry-run
 */

import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(import.meta.dirname, "../apps/web/.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("DATABASE_URL is not set. Check apps/web/.env");
	process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Types from geo.api.gouv.fr
// ---------------------------------------------------------------------------

interface GeoEpci {
	code: string; // SIREN
	nom: string;
	type: "CC" | "CA" | "CU" | "METRO" | "MET69";
}

interface GeoCommune {
	code: string;
	nom: string;
	codeEpci?: string;
}

interface EpciWithMembers extends GeoEpci {
	membres: { code: string; nom: string }[];
}

type InstitutionType =
	| "communaute_de_communes"
	| "agglomeration"
	| "communaute_urbaine"
	| "metropole";

function mapType(geoType: GeoEpci["type"]): InstitutionType {
	if (geoType === "CC") return "communaute_de_communes";
	if (geoType === "CA") return "agglomeration";
	if (geoType === "CU") return "communaute_urbaine";
	// METRO + MET69 (Métropole de Lyon — its own statut juridique)
	return "metropole";
}

// ---------------------------------------------------------------------------
// Fetch — two queries, group client-side
// ---------------------------------------------------------------------------

async function fetchAllEpcisWithMembers(): Promise<EpciWithMembers[]> {
	console.log("Fetching EPCIs from geo.api.gouv.fr...");
	const epciRes = await fetch(
		"https://geo.api.gouv.fr/epcis?fields=code,nom,type&limit=2000"
	);
	if (!epciRes.ok) {
		throw new Error(`/epcis returned ${epciRes.status}`);
	}
	const epcis = (await epciRes.json()) as GeoEpci[];
	console.log(`  Fetched ${epcis.length} EPCIs.`);

	console.log("Fetching all communes with codeEpci...");
	const communesRes = await fetch(
		"https://geo.api.gouv.fr/communes?fields=code,nom,codeEpci&limit=40000"
	);
	if (!communesRes.ok) {
		throw new Error(`/communes returned ${communesRes.status}`);
	}
	const communes = (await communesRes.json()) as GeoCommune[];
	console.log(`  Fetched ${communes.length} communes.\n`);

	// Group communes by EPCI code.
	const membersByEpci = new Map<string, { code: string; nom: string }[]>();
	for (const c of communes) {
		if (!c.codeEpci) {
			continue;
		}
		const list = membersByEpci.get(c.codeEpci) ?? [];
		list.push({ code: c.code, nom: c.nom });
		membersByEpci.set(c.codeEpci, list);
	}

	return epcis.map((e) => ({
		...e,
		membres: membersByEpci.get(e.code) ?? [],
	}));
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
	const epcis = await fetchAllEpcisWithMembers();

	const typeBuckets: Record<string, number> = {};
	for (const e of epcis) {
		typeBuckets[e.type] = (typeBuckets[e.type] ?? 0) + 1;
	}
	console.log("Types:", typeBuckets);
	console.log(
		`Total members across all EPCIs: ${epcis.reduce((s, e) => s + e.membres.length, 0)}`
	);

	if (dryRun) {
		console.log("\n--dry-run — exiting before any writes.");
		process.exit(0);
	}

	// Use plain pg.Client (Scaleway TLS handled via NODE_TLS_REJECT_UNAUTHORIZED=0
	// or rejectUnauthorized:false at call-site).
	const { Client } = await import("pg");
	const c = new Client({
		connectionString: DATABASE_URL,
		ssl: { rejectUnauthorized: false },
	});
	await c.connect();
	console.log("\nConnected to DB.");

	let institutionsInserted = 0;
	let institutionsExisting = 0;
	let bindingsInserted = 0;
	let bindingsExisting = 0;
	let bindingsFailed = 0;

	const t0 = Date.now();

	let i = 0;
	for (const e of epcis) {
		i++;
		const dbType = mapType(e.type);

		// institutions has no unique constraint on (name, type) — emulate
		// upsert with SELECT-then-INSERT. Look up by name only so we catch
		// rows whose `type` drifted (e.g. seeded as "agglomeration" before
		// migration 0013 introduced "metropole" / "communaute_urbaine").
		let institutionId: string | undefined;
		const existing = await c.query<{ id: string; type: string }>(
			`SELECT id, type FROM institutions WHERE name = $1 LIMIT 1`,
			[e.nom]
		);
		if (existing.rows[0]) {
			institutionId = existing.rows[0].id;
			institutionsExisting++;
			if (existing.rows[0].type !== dbType) {
				await c.query(
					`UPDATE institutions SET type = $1::institution_type WHERE id = $2`,
					[dbType, institutionId]
				);
			}
		} else {
			const inserted = await c.query<{ id: string }>(
				`INSERT INTO institutions (name, type) VALUES ($1, $2::institution_type) RETURNING id`,
				[e.nom, dbType]
			);
			institutionId = inserted.rows[0]?.id;
			if (institutionId) {
				institutionsInserted++;
			}
		}
		if (!institutionId) {
			console.log(`  ✗ failed to upsert institution ${e.nom}`);
			continue;
		}

		// Bulk-insert member bindings — paramaterised batch.
		if (e.membres.length === 0) {
			continue;
		}
		const values: string[] = [];
		const params: unknown[] = [];
		let p = 1;
		for (const m of e.membres) {
			values.push(`($${p++}, $${p++}, 'membre')`);
			params.push(institutionId, m.code);
		}
		try {
			const b = await c.query(
				`
					INSERT INTO institution_communes (institution_id, commune_code, role)
					VALUES ${values.join(",")}
					ON CONFLICT DO NOTHING
				`,
				params
			);
			bindingsInserted += b.rowCount ?? 0;
			bindingsExisting += e.membres.length - (b.rowCount ?? 0);
		} catch (err) {
			bindingsFailed += e.membres.length;
			console.log(
				`  ✗ batch failed for ${e.nom}: ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`
			);
		}

		if (i % 100 === 0 || i === epcis.length) {
			const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
			process.stdout.write(
				`\r  progress: ${i}/${epcis.length}  inst+${institutionsInserted}/${institutionsExisting}  bind+${bindingsInserted}/${bindingsExisting}  ${elapsed}s`
			);
		}
	}

	const dt = ((Date.now() - t0) / 1000).toFixed(1);
	console.log(
		`\n\nDone in ${dt}s.\n  institutions inserted: ${institutionsInserted}\n  institutions existing: ${institutionsExisting}\n  bindings inserted:     ${bindingsInserted}\n  bindings existing:     ${bindingsExisting}\n  bindings failed:       ${bindingsFailed}`
	);

	// Verify
	const verify = await c.query(
		`SELECT type, count(*)::int AS n FROM institutions GROUP BY type ORDER BY n DESC`
	);
	console.log("\ninstitutions by type:");
	for (const row of verify.rows) {
		console.log(`  ${(row.type as string).padEnd(28)} ${row.n}`);
	}

	const epciTotal = await c.query(
		`SELECT count(*)::int AS n FROM institution_communes WHERE institution_id IN (SELECT id FROM institutions WHERE type IN ('communaute_de_communes', 'agglomeration'))`
	);
	console.log(
		`\ninstitution_communes (EPCI members): ${epciTotal.rows[0].n}`
	);

	await c.end();
}

main().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
