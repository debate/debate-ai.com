// @ts-nocheck
import { sql } from 'kysely';
import type { Database } from '../../data/database.js';
import logger from '../../helpers/logger.js';

// Tables that have a matching <table>_setting table keyed by <table>
const SETTINGS_TABLES = new Set([
	'category',
	'chapter',
	'circuit',
	'entry',
	'event',
	'jpool',
	'judge',
	'panel',
	'person',
	'protocol',
	'region',
	'round',
	'rpool',
	'school',
	'student',
	'tourn',
]);

type SettingRow = {
	tag: string;
	value: string | null;
	value_text: string | null;
	value_date: Date | null;
};

/**
 * Decodes setting rows: dates and text
 * come from their own columns, json is parsed, empty values and
 * nsda_membership are skipped, and tags are in alphabetical order.
 */
function decodeSettings(rows: SettingRow[]) {
	const settings: Record<string, unknown> = {};

	[...rows]
		.sort((a, b) => (a.tag > b.tag ? 1 : -1))
		.forEach((item) => {
			if (item.tag === 'nsda_membership') {
				return;
			}
			if (item.value === 'date') {
				if (item.value_date !== null) {
					settings[item.tag] = item.value_date;
				}
			} else if (item.value === 'json') {
				if (item.value_text) {
					try {
						settings[item.tag] = JSON.parse(item.value_text);
					} catch (err) {
						logger.error(item.tag);
						logger.error(err);
					}
				}
			} else if (item.value === 'text') {
				if (item.value_text !== null) {
					settings[item.tag] = item.value_text;
				}
			} else {
				settings[item.tag] = item.value;
			}
		});

	return settings;
}

/**
 * Fetch a row by id with its settings decoded into a settings object, and the
 * table name attached. Returns undefined when no row is found.
 */
export async function summon(db: Database, table: string, id: number | string) {

	if (id === undefined || id === null || id === '') {
		logger.error(`NOTHING FOUND: No ${table} record found with key ${id}`);
		return;
	}

	const { rows } = await sql<Record<string, unknown>>`
		select * from ${sql.table(table)} where id = ${id}
	`.execute(db);

	const row = rows[0];

	if (!row) {
		logger.error(`NOTHING FOUND: No ${table} record found with key ${id}`);
		return;
	}

	const summoned: Record<string, unknown> = { ...row, table };

	if (SETTINGS_TABLES.has(table)) {
		const { rows: settingRows } = await sql<SettingRow>`
			select tag, value, value_text, value_date
			from ${sql.table(`${table}_setting`)}
			where ${sql.ref(table)} = ${id}
		`.execute(db);

		summoned.settings = decodeSettings(settingRows);
	}

	return summoned;
}

export default summon;
