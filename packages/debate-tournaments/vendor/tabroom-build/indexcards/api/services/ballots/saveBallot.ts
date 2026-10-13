// @ts-nocheck
// Saves what a judge enters on a ballot: the scores (ballot_save.mhtml), which the judge
// confirms in a separate step so saved ballots stay unaudited, and the feedback drafts
// (comment_save.mhtml).

import type { BallotError, BallotFeedback, DebateBallotReview, DebateBallotSubmission } from '../../../../types/index.js';
import type { Selectable } from 'kysely';
import type { Database } from '../../data/database.js';
import type { Ballot, Score } from '../../data/schema.js';
import { sanitizeHTML } from '../../helpers/text.js';
import ballotRepo from '../../repos/ballotRepo.js';
import changeLogRepo from '../../repos/changeLogRepo.js';
import panelRepo from '../../repos/panelRepo.js';
import scoreRepo from '../../repos/scoreRepo.js';
import { ballotRules } from './ballotRules.js';
import type { loadBallotInputs } from './loadBallotInputs.js';
import { countWords, entryPoints, validateBallot } from './validateBallot.js';

export type BallotInputs = NonNullable<Awaited<ReturnType<typeof loadBallotInputs>>>;

export type SaveBallotResult =
	// The beta can't handle this ballot. The judge enters it in classic
	| { result: 'unsupported', reasons: string[] }
	// The judge has no unconfirmed ballots on the panel
	| { result: 'confirmed' }
	// The judge's ballot rows changed since the inputs were loaded, e.g. confirmed in another tab
	| { result: 'changed' }
	| { result: 'invalid', errors: BallotError[] }
	// A dry run passed validation. Nothing was written
	| { result: 'valid', review: DebateBallotReview }
	| { result: 'saved', review: DebateBallotReview };

type BallotRow = Pick<Selectable<Ballot>, 'id' | 'entry' | 'audit'>;

/**
 * Saves the judge's submission, or with dryRun only validates it. Scores are replaced as a
 * whole, so resubmitting before confirming rewrites them. */
export async function saveBallot(
	db: Database,
	inputs: BallotInputs,
	submission: DebateBallotSubmission,
	opts: { person: number, dryRun?: boolean },
): Promise<SaveBallotResult> {
	const rules = ballotRules(inputs);
	if (rules.unsupported.length > 0) return { result: 'unsupported', reasons: rules.unsupported };

	const { open, empty, inactive } = sortBallots(inputs);
	if (open.length === 0) return { result: 'confirmed' };

	// Classic skips ballots for dropped entries, so the judge doesn't score them
	const openIds = new Set(open.map(ballot => ballot.id));
	const Entries = rules.Entries.filter(entry => openIds.has(entry.ballot));

	// The feedback sent replaces the autosaved drafts, so word minimums check only what was
	// sent. An open ballot left out of the entries has no comments
	const comments = new Map(submission.feedback.Entries.map(entry => [entry.ballot, entry.comments]));
	const feedback: Required<BallotFeedback> = {
		rfd: submission.feedback.rfd,
		Entries: Entries.map(entry => ({ ballot: entry.ballot, comments: comments.get(entry.ballot) ?? null })),
	};
	const scoring = rules.scoring.feedback
		? { ...rules.scoring, feedback: { ...rules.scoring.feedback, rfd: cleanText(feedback.rfd) } }
		: rules.scoring;
	const withFeedback = Entries.map(entry => ({ ...entry, comments: cleanText(comments.get(entry.ballot)) }));

	const errors = [
		...validateBallot({ scoring, Entries: withFeedback }, submission),
		...feedbackErrors(Entries.map(entry => entry.ballot), submission.feedback),
	];
	if (errors.length > 0) return { result: 'invalid', errors };

	const winner = rules.scoring.winloss ? submission.winner : null;
	const points = new Map(submission.points.map(({ student, points }) => [student, points]));
	const sideLabel = (side: number) => side === 2 ? rules.debate.negLabel : rules.debate.affLabel;
	const winningEntry = Entries.find(entry => entry.ballot === winner);

	const review: DebateBallotReview = {
		eventType: 'debate',
		saved: !opts.dryRun,
		winner,
		lowPointWin: Boolean(rules.scoring.points && winningEntry && Entries.some(entry =>
			entryPoints(winningEntry, submission) < entryPoints(entry, submission))),
		Entries: Entries.map(entry => ({
			ballot: entry.ballot,
			entry: entry.entry,
			code: entry.code,
			sideLabel: sideLabel(entry.side),
			Students: entry.Students.map(student => ({
				id: student.id,
				first: student.first,
				last: student.last,
				points: rules.scoring.points ? points.get(student.id) ?? null : null,
			})),
		})),
	};

	if (opts.dryRun) return { result: 'valid', review };

	return await db.transaction().execute(async (trx) => {
		// Locks the judge's rows on the panel, so a double submit waits instead of writing twice
		const current = await ballotRepo.getBallots(trx, { judge: inputs.judge.id, panel: inputs.panel.id, forUpdate: true });
		if (ballotsKey(current) !== ballotsKey(inputs.ballots)) return { result: 'changed' } as const;

		// Classic cleanup: rows with no entry go, and dropped entries' ballots are closed
		await ballotRepo.deleteBallots(trx, empty.map(ballot => ballot.id));
		await ballotRepo.updateBallots(trx, inactive.map(ballot => ballot.id), { audit: 1 });

		// Every score the judge gives is replaced, on all their ballots on the panel
		await scoreRepo.deleteScores(trx, { ballots: current.map(ballot => ballot.id), tags: ['rank', 'point', 'winloss'] });

		await scoreRepo.createScores(trx, [
			...(rules.scoring.winloss
				? Entries.map(entry => ({ ballot: entry.ballot, tag: 'winloss', value: entry.ballot === winner ? 1 : 0 }))
				: []),
			...(rules.scoring.points
				? Entries.flatMap(entry => entry.Students.map(student => ({
					ballot: entry.ballot,
					student: student.id,
					tag: 'point',
					value: points.get(student.id) ?? 0,
				})))
				: []),
		]);

		if (winningEntry) {
			await changeLogRepo.createChangeLog(trx, {
				panel: inputs.panel.id,
				judge: inputs.judge.id,
				person: opts.person,
				tag: 'judge',
				description: `${inputs.judge.last} voted for ${winningEntry.code} on the ${sideLabel(winningEntry.side)}`,
			});
		}

		const emptyIds = new Set(empty.map(ballot => ballot.id));
		await writeFeedback(trx, inputs.panel.id, current.map(ballot => ballot.id).filter(id => !emptyIds.has(id)), feedback);

		return { result: 'saved', review } as const;
	});
}

/**
 * Splits the judge's unconfirmed ballots the way classic does: rows with no entry, rows for
 * entries that are inactive or missing, and the open ballots the judge scores. */
function sortBallots(inputs: BallotInputs) {
	const active = new Set(inputs.entries.filter(entry => entry.active).map(entry => entry.id));
	const unaudited = inputs.ballots.filter(ballot => !ballot.audit);

	return {
		open: unaudited.filter(ballot => ballot.entry && active.has(ballot.entry)),
		empty: unaudited.filter(ballot => !ballot.entry || ballot.entry <= 0),
		inactive: unaudited.filter(ballot => ballot.entry && ballot.entry > 0 && !active.has(ballot.entry)),
	};
}

// Identifies a set of ballot rows by what the save depends on
function ballotsKey(ballots: BallotRow[]) {
	return ballots.map(ballot => `${ballot.id}:${ballot.entry}:${ballot.audit}`).sort().join(',');
}

// ---- Feedback ----
// The RFD goes on every one of the judge's ballots on the panel, and comments on one entry's.
// The ballot page autosaves drafts here so the judge doesn't lose work, and saveBallot
// replaces them with the final text sent with the scores. Feedback stays editable after the
// ballot is confirmed, until the tournament ends.

export type SaveBallotFeedbackResult =
	// The tournament is over, so feedback can't change
	| { result: 'closed' }
	| { result: 'invalid', errors: BallotError[] }
	| { result: 'saved', feedback: Required<BallotFeedback> };

type TextScore = Pick<Selectable<Score>, 'id' | 'ballot' | 'tag' | 'content'>;

/**
 * Saves the feedback in the body. A field left out stays as it is, and null or empty text
 * deletes it. Any change makes the panel's comments unreviewed again. */
export async function saveBallotFeedback(
	db: Database,
	opts: { judge: number, panel: number, now?: Date },
	body: BallotFeedback,
): Promise<SaveBallotFeedbackResult> {
	const tourn = await panelRepo.getPanelTourn(db, opts.panel);
	if (tourn?.end && (opts.now ?? new Date()) > tourn.end) return { result: 'closed' };

	return await db.transaction().execute(async (trx) => {
		const ballots = await ballotRepo.getBallots(trx, { judge: opts.judge, panel: opts.panel, forUpdate: true });
		const ballotIds = ballots.map(ballot => ballot.id);

		const errors = feedbackErrors(ballotIds, body);
		if (errors.length > 0) return { result: 'invalid', errors } as const;

		await writeFeedback(trx, opts.panel, ballotIds, body);

		const saved = await textScores(trx, ballotIds);
		const text = (ballot: number, tag: string) => saved.find(score => score.ballot === ballot && score.tag === tag)?.content ?? null;

		return {
			result: 'saved',
			feedback: {
				rfd: saved.find(score => score.tag === 'rfd')?.content ?? null,
				Entries: ballotIds.map(ballot => ({ ballot, comments: text(ballot, 'comments') })),
			},
		} as const;
	});
}

/** Returns why the feedback can't be saved: comments for ballots that aren't the judge's, or sent twice. */
function feedbackErrors(ballotIds: number[], body: BallotFeedback): BallotError[] {
	const errors: BallotError[] = [];
	const seen = new Set<number>();

	for (const entry of body.Entries ?? []) {
		if (!ballotIds.includes(entry.ballot)) {
			errors.push({ field: 'comments', ballot: entry.ballot, message: 'That entry isn\'t on your ballot.' });
		} else if (seen.has(entry.ballot)) {
			errors.push({ field: 'comments', ballot: entry.ballot, message: 'Comments were sent twice for that entry.' });
		}
		seen.add(entry.ballot);
	}
	return errors;
}

/**
 * Writes the feedback in the body to the judge's ballots, leaving fields that were left out.
 * Any change makes the panel's comments unreviewed again. */
async function writeFeedback(db: Database, panel: number, ballotIds: number[], body: BallotFeedback) {
	const existing = await textScores(db, ballotIds);
	let changed = false;

	if (body.rfd !== undefined) {
		const rfd = cleanText(body.rfd);
		for (const ballot of ballotIds) {
			if (await saveText(db, existing, ballot, 'rfd', rfd)) changed = true;
		}
	}

	for (const entry of body.Entries ?? []) {
		if (await saveText(db, existing, entry.ballot, 'comments', cleanText(entry.comments))) changed = true;
	}

	// Classic sets comments_reviewed to 0, which deletes the setting
	if (changed) {
		await panelRepo.updatePanel(db, panel, { settings: { comments_reviewed: null } });
	}
}

// Sanitized text, or null when it has no words (empty paragraphs, &nbsp;), which deletes it
function cleanText(html: string | null | undefined): string | null {
	const clean = sanitizeHTML(html ?? '').trim();
	return countWords(clean) > 0 ? clean : null;
}

async function textScores(db: Database, ballots: number[]): Promise<TextScore[]> {
	const scores = await scoreRepo.getScores(db, { ballots });
	return scores.filter(score => score.tag === 'rfd' || score.tag === 'comments');
}

/** Creates, updates or deletes one ballot's text score. Returns whether it changed. */
async function saveText(db: Database, existing: TextScore[], ballot: number, tag: 'rfd' | 'comments', text: string | null) {
	const current = existing.find(score => score.ballot === ballot && score.tag === tag);

	if (text === null) {
		return current ? await scoreRepo.deleteScores(db, { ballots: [ballot], tags: [tag] }) : false;
	}
	if (!current) {
		await scoreRepo.createScores(db, [{ ballot, tag, student: 0, content: text }]);
		return true;
	}
	if (current.content !== text) {
		await scoreRepo.updateScore(db, current.id, { content: text });
		return true;
	}
	return false;
}
