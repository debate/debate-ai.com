// @ts-nocheck
import { schoolYearDateRange } from '../helpers/dateTime.js';
import type { Database } from '../data/database.js';
import { selectSettings } from './utils/settings.js';
import type { Insertable, Updateable } from 'kysely';
import type { Student } from '../data/schema.js';

type queryOpts = {
	limit?: number;
	offset?: number;
	person?: number;
	person_request?: number;
	settings?: boolean | string[]
}
function buildStudentQuery(db: Database, opts: queryOpts = {}) {
	let query = db.selectFrom('student')
	.$if(opts.settings !== undefined && opts.settings !== false, (qb) => 
		qb.select(selectSettings({
			table: 'student',
			settings: opts.settings ?? false
		}))
	)
	if(opts.limit) query = query.limit(opts.limit);
	if(opts.offset) query = query.offset(opts.offset);
	if(opts.person) query = query.where('student.person', '=', opts.person);
	if(opts.person_request) query = query.where('student.person_request', '=', opts.person_request);

	return query;
}

async function getStudent(db: Database, id: number, opts: queryOpts = {}) {
	return await buildStudentQuery(db, opts)
	.selectAll('student')
	.where('student.id', '=', id)
	.executeTakeFirst();
}
async function getStudents(db: Database, opts: queryOpts = {}) {
	return await buildStudentQuery(db, opts)
	.selectAll('student')
	.execute();
}

async function createStudent(db: Database, data: Insertable<Student>) {
	return await db.insertInto('student')
	.values(data)
	.returningAll()
	.executeTakeFirstOrThrow();
}
async function updateStudent(db: Database, id: number, data: Updateable<Student>){
	if(Object.keys(data).length === 0) {
		throw new Error('No data provided for update');
	}
	return await db.updateTable('student')
	.set(data)
	.where('student.id', '=', id)
	.execute();
}
/**
  * Search for students that are not linked to a tabroom account.
  */
async function unlinkedSearch(db: Database, { first, last }: { first: string; last: string }, opts: { schoolYear?: number; limit?: number; offset?: number } = {}) {
	if(!first || !last) {
		throw new Error('unlinkedSearch requires first and last parameters');
	}
	const schoolYear = opts.schoolYear ?? schoolYearDateRange().start.getFullYear();

	return await buildStudentQuery(db)
	.leftJoin('chapter', 'student.chapter', 'chapter.id')
	.leftJoin('entry_student', 'entry_student.student', 'student.id')
	.leftJoin('entry', 'entry_student.entry', 'entry.id')
	.leftJoin('event', 'entry.event', 'event.id')
	.leftJoin('tourn', 'event.tourn', 'tourn.id')
	.select((eb) => [
		'student.id',
		'student.first',
		'student.middle',
		'student.last',
		'student.grad_year',
		'chapter.id as chapter_id',
		'chapter.name as chapter_name',
		'chapter.state as chapter_state',
		'chapter.level as chapter_level',
		eb.fn.count('tourn.id').distinct().as('tourn_count')
	])
	.where('student.first', 'like', `${first}%`)
	.where('student.last', 'like', `${last}%`)
	.where('student.grad_year', '>', schoolYear)
	.where((eb) => eb.or([
		eb('student.person', '=', 0),
		eb('student.person', '=', null)
	]))
	.where((eb) => eb.or([
		eb('student.person_request', '=', 0),
		eb('student.person_request', '=', null)
	]))
	.groupBy('student.id')
	.execute();
}

export default {
	getStudent,
	createStudent,
	updateStudent,
	getStudents,
	unlinkedSearch,
};
