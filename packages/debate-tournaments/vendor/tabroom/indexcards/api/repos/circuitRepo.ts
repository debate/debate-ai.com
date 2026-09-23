// @ts-nocheck
import { saveSettings, selectSettings, type Settings } from './utils/settings.js';
import { sql } from 'kysely';
import type { Database } from '../data/database.js';
import type { Insertable } from 'kysely';
import type { Circuit } from '../data/schema.js';

type queryOpts = {
	limit?: number;
	offset?: number;
	active?: boolean;
	state?: string | null;
	country?: string | null;
	tourn?: number;
	settings?: boolean | string[]
};
function buildCircuitQuery(db: Database, opts: queryOpts = {}) {
	let query = db.selectFrom('circuit')
	.$if(opts.settings !== undefined && opts.settings !== false, (qb) => 
		qb.select(selectSettings({
			table: 'circuit',
			settings: opts.settings ?? false
		})))

	if(opts.active) query = query.where('circuit.active', '=', 1); 
	if(opts.state !== undefined) query = query.where('circuit.state', '=', opts.state);
	if(opts.country !== undefined) query = query.where('circuit.country', '=', opts.country);
	if(opts.limit) query = query.limit(opts.limit);
	if(opts.offset) query = query.offset(opts.offset);
	if(opts.tourn){
		query = query.innerJoin('tourn_circuit', 'circuit.id', 'tourn_circuit.circuit')
		.where('tourn_circuit.tourn', '=', opts.tourn);
	}

	return query;
}

async function getCircuit(db: Database, id: number, opts: queryOpts = {}) {
	return await buildCircuitQuery(db, opts)
	.where('id', '=', id)
	.selectAll('circuit')
	.executeTakeFirst();
}

async function getCircuits(db: Database, opts: queryOpts = {}){
	return await buildCircuitQuery(db, opts)
	.selectAll('circuit').execute();
}

export async function createCircuit(db: Database, data: Insertable<Circuit> & { settings?: Settings }) {
	const { settings, ...circuitData } = data;

	return await db.transaction().execute(async (trx) => {
		const circuit = await trx
			.insertInto('circuit')
			.values(circuitData)
			.returningAll()
			.executeTakeFirstOrThrow();

		if (settings) {
			await saveSettings({
				db: trx,
				table: 'circuit',
				settings,
				ownerId: circuit.id,
			});
		}

		return circuit;
	});
}

/** Returns active circuits and the number of approved tournaments in the given date range.
 * used for the circuits page
 */
async function getActiveCircuits(db: Database, params: queryOpts & { startDate: Date; endDate: Date }){
	if (!params.startDate || !params.endDate) {
		throw new Error('getActiveCircuits: startDate and endDate are required');
	}

	return await buildCircuitQuery(db, params)
		.innerJoin('tourn_circuit as tc', 'circuit.id', 'tc.circuit')
		.innerJoin('tourn as t', 'tc.tourn', 't.id')
		.select([
			'circuit.id',
			'circuit.abbr',
			'circuit.name',
			'circuit.state',
			'circuit.country',
			sql<number>`COUNT(DISTINCT tc.id)`.as('tourns')
		])
		.where((eb) => eb.and([
			eb('tc.approved', '=', 1),
			eb('t.start', '>', params.startDate),
			eb('t.start', '<', params.endDate)
		]))
		.groupBy(['circuit.id', 'circuit.abbr', 'circuit.name', 'circuit.state', 'circuit.country'])
		.orderBy('circuit.name', 'asc')
		.execute();
}

export default {
	getCircuits,
	getActiveCircuits,
	getCircuit,
	createCircuit,
};