import { db } from "@chatvote/db";
import { institutionCommunes } from "@chatvote/db/schema/conseil";
import { communes, institutions } from "@chatvote/db/schema/political";
import { TRPCError } from "@trpc/server";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import z from "zod";
import { publicProcedure, router } from "../index";
import {
	getCandidatesForCommune,
	getElectoralDataForCommune,
	IncompleteElectoralDataError,
} from "../lib/modules/municipal-election";

export const communeRouter = router({
	getByCode: publicProcedure
		.input(z.object({ communeCode: z.string().regex(/^\d{5}$/) }))
		.query(async ({ input }) => {
			const [result] = await db
				.select({
					name: communes.name,
					departmentName: communes.departmentName,
				})
				.from(communes)
				.where(eq(communes.communeCode, input.communeCode))
				.limit(1);
			return result ?? null;
		}),

	search: publicProcedure
		.input(z.object({ query: z.string().min(2).max(100) }))
		.query(async ({ input }) => {
			const term = input.query.trim();

			// NOTE: If this query fails with "relation communes does not exist",
			// the political schema tables have not been created yet. Run:
			//   cd packages/db && bun run drizzle-kit push
			// or generate and apply migrations:
			//   cd packages/db && bun run drizzle-kit generate && bun run drizzle-kit migrate
			try {
				const rows = await db
					.select({
						communeCode: communes.communeCode,
						name: communes.name,
						departmentCode: communes.departmentCode,
						departmentName: communes.departmentName,
						regionName: communes.regionName,
						postalCodes: communes.postalCodes,
						epciId: institutions.id,
						epciName: institutions.name,
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
							inArray(institutions.type, [
								"communaute_de_communes",
								"agglomeration",
								"syndicat",
							])
						)
					)
					.where(
						or(
							ilike(communes.name, `%${term}%`),
							ilike(communes.communeCode, `${term}%`),
							sql`${communes.postalCodes}::text ilike ${`%${term}%`}`
						)
					)
					.limit(20);

				const mapped = rows.map((row) => ({
					communeCode: row.communeCode,
					name: row.name,
					departmentCode: row.departmentCode,
					departmentName: row.departmentName,
					regionName: row.regionName,
					postalCodes: row.postalCodes,
					epci:
						row.epciId != null && row.epciName != null
							? { id: row.epciId, name: row.epciName }
							: null,
				}));
				// The joins emit one row per institution membership, so a commune
				// with both its own conseil municipal AND an EPCI appears twice
				// (the conseil_municipal row carries no EPCI → a badge-less
				// duplicate). Collapse to ONE entry per commune, preferring the
				// row that carries the EPCI so the badge is shown.
				const byCommune = new Map<string, (typeof mapped)[number]>();
				for (const hit of mapped) {
					const existing = byCommune.get(hit.communeCode);
					if (!existing || (existing.epci == null && hit.epci != null)) {
						byCommune.set(hit.communeCode, hit);
					}
				}
				return [...byCommune.values()];
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				const cause =
					error instanceof Error &&
					(error as Error & { cause?: unknown }).cause;
				const causeMsg = cause instanceof Error ? cause.message : String(cause);
				process.stderr.write(
					`commune.search failed: ${message}\nCAUSE: ${causeMsg}\n`
				);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Municipality search failed",
				});
			}
		}),

	getCandidates: publicProcedure
		.input(z.object({ communeCode: z.string().regex(/^\d{5}$/) }))
		.query(({ input }) => getCandidatesForCommune(db, input)),

	getInstitutions: publicProcedure
		.input(z.object({ communeCode: z.string().regex(/^\d{5}$/) }))
		.query(async ({ input }) => {
			return await db
				.select({
					institutionId: institutionCommunes.institutionId,
					role: institutionCommunes.role,
					institutionName: institutions.name,
					institutionType: institutions.type,
				})
				.from(institutionCommunes)
				.innerJoin(
					institutions,
					eq(institutions.id, institutionCommunes.institutionId)
				)
				.where(eq(institutionCommunes.communeCode, input.communeCode));
		}),

	// Reverse of getInstitutions: all member communes of an institution (e.g. an
	// EPCI / communauté de communes). Used by the ingestion console to add every
	// commune of an intercommunalité at once.
	getCommunesByInstitution: publicProcedure
		.input(z.object({ institutionId: z.string().uuid() }))
		.query(async ({ input }) => {
			return await db
				.selectDistinct({
					communeCode: institutionCommunes.communeCode,
					name: communes.name,
				})
				.from(institutionCommunes)
				.innerJoin(
					communes,
					eq(communes.communeCode, institutionCommunes.communeCode)
				)
				.where(eq(institutionCommunes.institutionId, input.institutionId));
		}),

	getElectoralData: publicProcedure
		.input(z.object({ communeCode: z.string().regex(/^\d{5}$/) }))
		.query(async ({ input }) => {
			try {
				return await getElectoralDataForCommune(db, input);
			} catch (error) {
				// The module stays framework-free and throws a plain Error for the
				// orphaned-candidate data-quality guard; re-wrap into the identical
				// TRPCError (same code/message/cause) the procedure used to throw.
				if (error instanceof IncompleteElectoralDataError) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: error.message,
						cause: error.cause,
					});
				}
				throw error;
			}
		}),
});
