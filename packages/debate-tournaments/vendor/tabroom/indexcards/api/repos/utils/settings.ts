// @ts-nocheck
import { sql } from 'kysely';

import type { Database } from '../../data/database.js';
/** Possible types for a setting value. Can be a string, a Date, an object, or null.*/
type SettingValue = string | number | Date | object | null;
export type Settings = Record<string, SettingValue>;
/** Tables that have a corresponding settings table */
type SettingsTable = 
	'category' |
	'chapter' |
	'circuit' |
	'entry' |
	'event' |
	'jpool' |
	'judge' |
	'panel' |
	'person' |
	'protocol' |
	'region' |
	'round' |
	'rpool' |
	'school' |
	'student' |
	'tourn';

type SaveSettingsArgs = {
	db: Database;
	table: SettingsTable;
	settings: Settings;
	/** the ID of the owner row in the corresponding table */
	ownerId: number;
};

type SettingsSelectArgs = {
	/** which table to select settings from */
	table: SettingsTable;
	/** if the table is aliased in the query, provide the alias here */
	tableAs?: string;
	/** what settings to select, either all (true) or specific keys (string[]) */
	settings: boolean | string[];
	/** what alias to use for the resulting settings column default: settings */
	as?: string;
};
/**
 * Represents an insertable row in a *_setting table
 */
type SettingInsert = {
	value: string | null;
	value_text: string | null;
	value_date: Date | null;
	tag: string;
};

const settingConfig = {
	category: {
		table: "category_setting",
		ownerKey: "category",
		createdAtKey: "created_at",
		timestampKey: "timestamp",
	},
	chapter: {
		table: "chapter_setting",
		ownerKey: "chapter",
		createdAtKey: "created_at",
		timestampKey: "timestamp",
	},
	circuit: {
		table: "circuit_setting",
		ownerKey: "circuit",
		createdAtKey: "created_at",
		timestampKey: "timestamp",
	},
	entry: {
		table: "entry_setting",
		ownerKey: "entry",
		createdAtKey: "created_at",
		timestampKey: "timestamp",
	},
	event: {
		table: "event_setting",
		ownerKey: "event",
		createdAtKey: "created_at",
		timestampKey: "timestamp",
	},
	jpool: {
		table: "jpool_setting",
		ownerKey: "jpool",
		createdAtKey: "created_at",
		timestampKey: "timestamp",
	},
	judge: {
		table: "judge_setting",
		ownerKey: "judge",
		createdAtKey: "created_at",
		timestampKey: "timestamp",
	},
	panel: {
		table: "panel_setting",
		ownerKey: "panel",
		createdAtKey: null,
		timestampKey: "timestamp",
	},
	person: {
		table: "person_setting",
		ownerKey: "person",
		createdAtKey: "created_at",
		timestampKey: "timestamp",
	},
	protocol: {
		table: "protocol_setting",
		ownerKey: "protocol",
		createdAtKey: null,
		timestampKey: "timestamp",
	},
	region: {
		table: "region_setting",
		ownerKey: "region",
		createdAtKey: "created_at",
		timestampKey: "timestamp",
	},
	round: {
		table: "round_setting",
		ownerKey: "round",
		createdAtKey: null,
		timestampKey: "timestamp",
	},
	rpool: {
		table: "rpool_setting",
		ownerKey: "rpool",
		createdAtKey: null,
		timestampKey: "timestamp",
	},
	school: {
		table: "school_setting",
		ownerKey: "school",
		createdAtKey: null,
		timestampKey: "timestamp",
	},
	student: {
		table: "student_setting",
		ownerKey: "student",
		createdAtKey: "created_at",
		timestampKey: "timestamp",
	},
	tourn: {
		table: "tourn_setting",
		ownerKey: "tourn",
		createdAtKey: null,
		timestampKey: "timestamp",
	},
} as const;


/**
 * Saves settings for a specific owner in the corresponding *_setting table
 */
export async function saveSettings({
	db,
	table,
	settings,
	ownerId,
}: SaveSettingsArgs) {
	const config = settingConfig[table];

	const rows = buildSettingsRows({
		settings,
		ownerKey: config.ownerKey,
		ownerId,
	});

	if (!rows.length) {
		return;
	}

	await db
		.insertInto(config.table)
		.values(rows)
		.onDuplicateKeyUpdate({
			value: sql`VALUES(value)`,
			value_text: sql`VALUES(value_text)`,
			value_date: sql`VALUES(value_date)`,
		})
		.execute();
}

/** 
 * Generates a SQL snippet for selecting settings as a JSON object from a *_setting table.
 */
export function selectSettings<A extends string = 'settings'>(
	{
		table,
		tableAs,
		settings,
		as,
	}: SettingsSelectArgs & { as?: A },
) {
	const config = settingConfig[table];
	const ownerRefResolved = tableAs ? `${tableAs}.id` : `${table}.id`;
	const alias = as ?? 'settings';
	const tags = Array.isArray(settings) ? settings : undefined;

	const tagFilter = tags?.length
		? sql` AND setting_row_internal.tag IN (${sql.join(tags)})`
		: sql``;

	const where = sql`
		WHERE ${sql.ref(`setting_row_internal.${config.ownerKey}`)}
			= ${sql.ref(ownerRefResolved)}
		${tagFilter}
	`;

	const timestampFields = [
		config.createdAtKey
			? sql`'created_at', ${sql.ref(`setting_row_internal.${config.createdAtKey}`)}`
			: undefined,
		config.timestampKey
			? sql`'timestamp', ${sql.ref(`setting_row_internal.${config.timestampKey}`)}`
			: undefined,
	].filter((field): field is NonNullable<typeof field> => field !== undefined);

	return [
		sql<Record<string, string> | null>`
			(
				SELECT JSON_OBJECTAGG(
					setting_row_internal.tag,
					CASE
						WHEN setting_row_internal.value = 'date'
							THEN setting_row_internal.value_date
						WHEN setting_row_internal.value = 'text'
							THEN setting_row_internal.value_text
						WHEN setting_row_internal.value = 'json'
							AND JSON_VALID(setting_row_internal.value_text)
							THEN JSON_EXTRACT(setting_row_internal.value_text, '$')
						WHEN setting_row_internal.value = 'json'
							THEN setting_row_internal.value_text
						ELSE setting_row_internal.value
					END
				)
				FROM ${sql.table(config.table)} setting_row_internal
				${where}
			)
		`.as(alias as A),

		sql<Record<string, {
			created_at?: Date | null;
			timestamp?: Date | null;
		}> | null>`
			(
				SELECT JSON_OBJECTAGG(
					setting_row_internal.tag,
					JSON_OBJECT(
						${sql.join(timestampFields, sql`, `)}
					)
				)
				FROM ${sql.table(config.table)} setting_row_internal
				${where}
			)
		`.as('settingsTimestamps'),
	];
}
/**
 * Build rows for bulk upsert into a *_setting table
 */
function buildSettingsRows({
	settings,
	ownerKey,
	ownerId,
}: {
	settings: Settings;
	ownerKey: string;
	ownerId: number;
}): SettingInsert[] {
	if (!settings || typeof settings !== 'object') return [];

	return Object.entries(settings).map(([tag, value]) => ({
		[ownerKey]: ownerId,
		tag,
		...encodeSettingValue(value, tag),
	}));
}

/**
 *  converts a setting value into appropriate DB fields
 * @param {*} value  - the setting value
 * @returns an object with keys: value, value_text, value_date
 */
function encodeSettingValue(value: unknown, tag: string) {
	const VALUE_TEXT_TAGS = ['livedoc_url'];
	// null / undefined -> clear all value fields
	if (value === null || value === undefined) {
		return {
			value: null,
			value_text: null,
			value_date: null,
		};
	}

	// Date → value_date
	if (value instanceof Date) {
		return {
			value: 'date',
			value_text: null,
			value_date: value,
		};
	}

	// Boolean → string
	if (typeof value === 'boolean') {
		return {
			value: value ? '1' : '0',
			value_text: null,
			value_date: null,
		};
	}

	// Number → string
	if (typeof value === 'number') {
		return {
			value: String(value),
			value_text: null,
			value_date: null,
		};
	}

	// String → value or value_text
	if (typeof value === 'string') {
		if (value.length <= 64 && !VALUE_TEXT_TAGS.includes(tag)) {
			return {
				value,
				value_text: null,
				value_date: null,
			};
		}

		return {
			value: 'text',
			value_text: value,
			value_date: null,
		};
	}

	// Object / Array → JSON in value_text
	return {
		value: 'json',
		value_text: JSON.stringify(value),
		value_date: null,
	};
}
