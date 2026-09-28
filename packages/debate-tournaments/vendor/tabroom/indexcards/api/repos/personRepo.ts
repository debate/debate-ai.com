// @ts-nocheck
import type { DBSchema, Database } from '../data/database.js';
import { saveSettings, selectSettings, type Settings } from './utils/settings.js';
import type { Person } from '../data/schema.js';
import type { Insertable, ExpressionBuilder } from 'kysely';

type queryOpts = {
	settings?: boolean | string[];
	excludeBanned?: boolean;
	excludeUnconfirmedEmail?: boolean;
	hasValidParadigm?: boolean;
	hasJudged?: boolean;
	limit?: number;
	offset?: number;
};

async function buildPersonQuery(db: Database, opts: queryOpts = {}) {
	let query = db.selectFrom('person')
	.$if(opts.settings !== undefined && opts.settings !== false, (qb) => 
		qb.select(selectSettings({
			table: 'person',
			settings: opts.settings ?? false
		}))
	)
	if(opts.excludeBanned)
		query = query.where(isNotBanned);
	if(opts.excludeUnconfirmedEmail)
		query = query.where(hasConfirmedEmail);
	if(opts.hasJudged)
		query = query.where(hasJudged);
	if(opts.limit !== undefined)
		query = query.limit(opts.limit ?? null);
	if(opts.offset !== undefined)
		query = query.offset(opts.offset ?? 0);
	if(opts.hasValidParadigm) {
		query = query.where(await validParadigmCondition(db));
	}
	return query;
}


function isNotBanned(eb: ExpressionBuilder<DBSchema, 'person'>) {
    return eb.not(
        eb.exists(
            eb
                .selectFrom('person_setting')
                .select('person')
                .whereRef('person_setting.person', '=', 'person.id')
                .where('tag', '=', 'banned')
        )
    );
}
function hasConfirmedEmail(eb: ExpressionBuilder<DBSchema, 'person'>) {
	return eb.not(
		eb.exists(
			eb
				.selectFrom('person_setting')
				.select('person')
				.whereRef('person_setting.person', '=', 'person.id')
				.where('tag', '=', 'email_unconfirmed')
		)
	);
}
function hasJudged(eb: ExpressionBuilder<DBSchema, 'person'>) {
	return eb.exists(
		eb
			.selectFrom('judge')
			.select('id')
			.whereRef('judge.person', '=', 'person.id')
	);
}
async function validParadigmCondition(db: Database) {
    const [reviewCutoff, reviewStart] = await Promise.all([
        db
            .selectFrom('tabroom_setting')
            .select('value_date')
            .where('tag', '=', 'paradigm_review_cutoff')
            .executeTakeFirst(),

        db
            .selectFrom('tabroom_setting')
            .select('value_date')
            .where('tag', '=', 'paradigm_review_start')
            .executeTakeFirst(),
    ]);

    const cutoffDate = reviewCutoff?.value_date
        ? new Date(reviewCutoff.value_date)
        : null;

    const reviewStartDate = reviewStart?.value_date
        ? new Date(reviewStart.value_date)
        : null;

    const useReviewStart =
        cutoffDate !== null &&
        reviewStartDate !== null &&
        cutoffDate < new Date();

    return (eb: ExpressionBuilder<DBSchema, 'person'>) =>
        eb.exists(
            eb.selectFrom('person_setting')
                .select('person')
                .whereRef('person_setting.person', '=', 'person.id')
                .where('tag', '=', 'paradigm')
                .$if(useReviewStart, (qb) =>
                    qb.where('timestamp', '>', reviewStartDate!)
                ),
        );
}

export async function getPerson(db: Database, id: number, opts: queryOpts = {}) {
	return await (await buildPersonQuery(db, opts))
		.where('person.id', '=', id)
		.selectAll('person')
		.executeTakeFirst();
}

export async function personSearch(db: Database, term: string, opts: queryOpts = {},) {
	const sanitize = (term: string) => {
		if (!term) return '';
		return term.replace(/[^a-zA-Z0-9\-\s]/g, '').trim();
	};

	const cleanTerm = sanitize(term);
	const words = cleanTerm.split(/\s+/).filter((w) => w.length > 0);

	let query = await buildPersonQuery(db, opts);
	if (words.length) {
		query = query.where((eb) =>
			eb.and(
				words.map((word) =>
					eb.or([
						eb('person.first', 'like', `${word}%`),
						eb('person.last', 'like', `${word}%`),
					]),
				),
			),
		);
	}

	return await query.selectAll('person').execute();
}

export async function getPersonByUsername(db: Database, username: string, opts: queryOpts = {}) {
	return (await buildPersonQuery(db, opts))
		.where('person.email', '=', username)
		.selectAll('person')
		.executeTakeFirst();
}

type CreatePersonData = Insertable<Person> & {
	settings?: Settings;
};
export async function updatePerson(db: Database, personId: number, data: Partial<CreatePersonData>) {
	const { settings, ...personData } = data;

	return await db.transaction().execute(async (trx) => {
		if (Object.keys(personData).length > 0) {
			await trx
				.updateTable('person')
				.set(personData)
				.where('id', '=', personId)
				.executeTakeFirstOrThrow();
		}

		if (settings) {
			await saveSettings({
				db: trx,
				table: 'person',
				settings,
				ownerId: personId,
			});
		}

		return personId;
	});
}
export async function createPerson(db: Database, data: CreatePersonData) {
	const { settings, ...personData } = data;

	return await db.transaction().execute(async (trx) => {
		const person = await trx
			.insertInto('person')
			.values(personData)
			.returningAll()
			.executeTakeFirstOrThrow();

		if (settings) {
			await saveSettings({
				db: trx,
				table: 'person',
				settings,
				ownerId: person.id,
			});
		}

		return person;
	});
}

export default {
	getPerson,
	personSearch,
	getPersonByUsername,
	updatePerson,
	createPerson
};
