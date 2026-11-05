// Minimal Drizzle schema for the commune selector, reduced from ChatVote's
// packages/db/src/schema/political.ts (communes, institutions,
// institutionTypeEnum) and conseil.ts (institutionCommunes).
//
// Reduced on purpose: the original `communes` table also has mairie_siret,
// mairie_homepage, mairie_homepage_resolved_at and parent_id, and
// `institutions` also has siren and description. None of them is read by the
// selector or written by the seed scripts in ../seeds/scripts. Column names
// and types of the kept columns are identical, so the seeds and the three
// queries (search, getByCode, getInstitutions) run unchanged.
//
// Index names keep ChatVote's legacy "municipalities_" prefix; rename freely
// in a fresh database.

import {
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

export const institutionTypeEnum = pgEnum("institution_type", [
	"assemblee_nationale",
	"senat",
	"conseil_municipal",
	"gouvernement",
	"region",
	"departement",
	"europe",
	"communaute_de_communes",
	"syndicat",
	"agglomeration",
	"communaute_urbaine",
	"metropole",
]);

export const communes = pgTable(
	"communes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		communeCode: text("commune_code").notNull().unique(),
		name: text("name").notNull(),
		departmentCode: text("department_code"),
		departmentName: text("department_name"),
		regionName: text("region_name"),
		population: integer("population"),
		postalCodes: jsonb("postal_codes").$type<string[]>().default([]),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("municipalities_commune_code_idx").on(table.communeCode),
		index("municipalities_name_idx").on(table.name),
	]
);

export const institutions = pgTable("institutions", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	type: institutionTypeEnum("type").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const institutionCommunes = pgTable(
	"institution_communes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		institutionId: uuid("institution_id")
			.notNull()
			.references(() => institutions.id, { onDelete: "cascade" }),
		communeCode: text("commune_code")
			.notNull()
			.references(() => communes.communeCode),
		role: text("role").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		unique("institution_municipalities_unique").on(
			table.institutionId,
			table.communeCode
		),
		index("institution_municipalities_institution_idx").on(table.institutionId),
		index("institution_municipalities_municipality_idx").on(table.communeCode),
	]
);
