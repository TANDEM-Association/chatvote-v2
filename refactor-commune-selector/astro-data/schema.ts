// Schéma Drizzle pour l'app Astro : communes + institutions (EPCI) + jointure,
// avec un drapeau de disponibilité du chat sur communes ET institutions.
//
// Différences avec ChatVote (voir ../schema/commune-schema.ts) :
//   - chat_available (boolean, défaut false) sur communes et institutions
//   - institutions.siren UNIQUE : clé naturelle de l'API geo (champ `code` d'un EPCI).
//     ChatVote dédoublonnait par nom, ce qui est fragile.
//   - index renommés sans le préfixe historique "municipalities_"

import {
	boolean,
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

// Réduit aux types réellement utilisés. Ajoute des valeurs ici si besoin
// (ex. "conseil_municipal"), puis génère une migration.
export const institutionTypeEnum = pgEnum("institution_type", [
	"communaute_de_communes",
	"agglomeration",
	"communaute_urbaine",
	"metropole",
	"syndicat",
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
		postalCodes: jsonb("postal_codes").$type<string[]>().notNull().default([]),
		// Géré à la main par l'admin. false = page "non disponible".
		chatAvailable: boolean("chat_available").notNull().default(false),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("communes_name_idx").on(table.name),
		index("communes_chat_available_idx").on(table.chatAvailable),
	]
);

export const institutions = pgTable("institutions", {
	id: uuid("id").primaryKey().defaultRandom(),
	siren: text("siren").notNull().unique(),
	name: text("name").notNull(),
	type: institutionTypeEnum("type").notNull(),
	chatAvailable: boolean("chat_available").notNull().default(false),
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
		role: text("role").notNull().default("membre"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		unique("institution_communes_unique").on(
			table.institutionId,
			table.communeCode
		),
		index("institution_communes_institution_idx").on(table.institutionId),
		index("institution_communes_commune_idx").on(table.communeCode),
	]
);
