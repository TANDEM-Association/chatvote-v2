/**
 * Seed ALL French communes (~35k) into the communes table (commune search).
 *
 * Reads the pinned geo.api.gouv.fr snapshot in data/seeds/communes-all.json.gz,
 * verifies its sha256 against communes-all.meta.json, then upserts. Skips when
 * the table holds at least as many rows as the snapshot, so `bun run setup`
 * can call it on every run without network access.
 *
 *   bun run seed:communes             # load the snapshot (no-op when loaded)
 *   bun run seed:communes --refresh   # re-fetch the API, rewrite the snapshot, load it
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../packages/db/src/schema";

// Load env from apps/web/.env
config({ path: resolve(import.meta.dir, "../apps/web/.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("DATABASE_URL is not set. Check apps/web/.env");
	process.exit(1);
}

const db = drizzle(DATABASE_URL, { schema });

const SOURCE_URL =
	"https://geo.api.gouv.fr/communes?fields=code,nom,codesPostaux,population,departement,region&limit=40000";
const SNAPSHOT = resolve(import.meta.dir, "../data/seeds/communes-all.json.gz");
const META = resolve(import.meta.dir, "../data/seeds/communes-all.meta.json");

// ---------------------------------------------------------------------------
// Types for the geo.api.gouv.fr response
// ---------------------------------------------------------------------------

interface GeoCommune {
	code: string; // commune code e.g. "75056"
	codesPostaux: string[]; // postal codes
	departement?: {
		code: string;
		nom: string;
	};
	nom: string; // name e.g. "Paris"
	population?: number;
	region?: {
		code: string;
		nom: string;
	};
}

const sha256 = (bytes: Uint8Array) =>
	createHash("sha256").update(bytes).digest("hex");

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

async function refreshSnapshot(): Promise<void> {
	console.log("Fetching all communes from geo.api.gouv.fr...");
	const res = await fetch(SOURCE_URL);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch communes: ${res.status} ${res.statusText}`
		);
	}
	const body = new Uint8Array(await res.arrayBuffer());
	const count = (JSON.parse(new TextDecoder().decode(body)) as GeoCommune[])
		.length;
	const gz = gzipSync(body, { level: 9 });
	writeFileSync(SNAPSHOT, gz);
	writeFileSync(
		META,
		`${JSON.stringify(
			{
				sourceUrl: SOURCE_URL,
				retrievedAt: new Date().toISOString().slice(0, 10),
				count,
				sha256: sha256(gz),
			},
			null,
			"\t"
		)}\n`
	);
	console.log(`  Wrote ${count} communes to data/seeds/communes-all.json.gz.\n`);
}

function readSnapshot(): GeoCommune[] {
	const meta = JSON.parse(readFileSync(META, "utf8")) as { sha256: string };
	const gz = readFileSync(SNAPSHOT);
	if (sha256(gz) !== meta.sha256) {
		throw new Error(
			"data/seeds/communes-all.json.gz does not match its sha256 in communes-all.meta.json"
		);
	}
	return JSON.parse(gunzipSync(gz).toString("utf8")) as GeoCommune[];
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
	const refresh = process.argv.slice(2).includes("--refresh");
	if (refresh) {
		await refreshSnapshot();
	}
	const communes = readSnapshot();

	const [row] = await db
		.select({ loaded: sql<number>`count(*)::int` })
		.from(schema.communes);
	const loaded = row?.loaded ?? 0;
	if (loaded >= communes.length && !refresh) {
		console.log(`All ${loaded} communes already loaded.`);
		process.exit(0);
	}

	const values = communes.map((c) => ({
		communeCode: c.code,
		name: c.nom,
		departmentCode: c.departement?.code ?? null,
		departmentName: c.departement?.nom ?? null,
		regionName: c.region?.nom ?? null,
		population: c.population ?? null,
		postalCodes: c.codesPostaux ?? [],
	}));

	// Insert in batches of 1000 to avoid hitting parameter limits
	const BATCH_SIZE = 1000;
	let inserted = 0;

	console.log(
		`Inserting ${values.length} communes in batches of ${BATCH_SIZE}...`
	);

	for (let i = 0; i < values.length; i += BATCH_SIZE) {
		const batch = values.slice(i, i + BATCH_SIZE);

		await db
			.insert(schema.communes)
			.values(batch)
			.onConflictDoUpdate({
				target: schema.communes.communeCode,
				set: {
					name: sql`excluded.name`,
					departmentCode: sql`excluded.department_code`,
					departmentName: sql`excluded.department_name`,
					regionName: sql`excluded.region_name`,
					population: sql`excluded.population`,
					postalCodes: sql`excluded.postal_codes`,
				},
			});

		inserted += batch.length;
		process.stdout.write(`\r  Progress: ${inserted}/${values.length}`);
	}

	console.log(`\n\nDone! Inserted/updated ${inserted} communes.`);
	process.exit(0);
}

main().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
