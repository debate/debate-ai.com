// @ts-nocheck
// Checks a judge's submission against the ballot's rules before anything is saved
// (ballot_save.mhtml validation). Pure: the caller loads the rules with ballotRules.
// Returns every error at once so the judge can fix them together.

import type { BallotError, DebateBallotSubmission } from '../../../../types/index.js';
import { convert } from 'html-to-text';
import type { BallotRules } from './ballotRules.js';

export type ValidateBallotRules = Pick<BallotRules, 'scoring' | 'Entries'>;

/**
 * Counts the words a reader sees in HTML: tags, link targets and images don't count, and
 * any run of whitespace separates words. */
export function countWords(html: string | null): number {
	if (!html) return 0;

	const text = convert(html, {
		wordwrap: false,
		selectors: [
			{ selector: 'a', options: { ignoreHref: true } },
			{ selector: 'img', format: 'skip' },
		],
	});

	return text.split(/\s+/).filter(Boolean).length;
}

/** Returns the reasons the submission can't be saved. Empty means it's valid. */
export function validateBallot(rules: ValidateBallotRules, submission: DebateBallotSubmission): BallotError[] {
	const { winloss, points, feedback } = rules.scoring;
	const errors: BallotError[] = [];

	const winner = winloss ? validateWinner(rules, submission, errors) : undefined;
	const pointsValid = points ? validatePoints(rules, points, submission, errors) : false;

	// Classic only compares entries with the same number of students (ballot_save.mhtml $inequal_teams)
	const studentCounts = new Set(rules.Entries.map(entry => entry.Students.length));
	if (winloss?.lpw && winner && pointsValid && studentCounts.size === 1) {
		validateLowPointWin(rules, submission, winner, winloss.lpw, errors);
	}

	if (feedback?.minWords.rfd) {
		const words = countWords(feedback.rfd);
		if (words < feedback.minWords.rfd) {
			errors.push({
				field: 'rfd',
				message: `This tournament requires a Reason for Decision. Please leave at least ${feedback.minWords.rfd} words. (You left ${words})`,
			});
		}
	}

	// Classic only checked comments_plz on speech ballots. Every event type checks it when set
	if (feedback?.minWords.comments) {
		for (const entry of rules.Entries) {
			const words = countWords(entry.comments);
			if (words < feedback.minWords.comments) {
				errors.push({
					field: 'comments',
					ballot: entry.ballot,
					message: `Please leave at least ${feedback.minWords.comments} words of feedback for ${entry.code}. (You left ${words})`,
				});
			}
		}
	}

	return errors;
}

/** Returns the winning entry, or undefined after adding an error when there isn't a valid one. */
function validateWinner(rules: ValidateBallotRules, submission: DebateBallotSubmission, errors: BallotError[]) {
	if (submission.winner === null) {
		errors.push({
			field: 'winner',
			message: 'You didn\'t choose a winner. There are no ties in debate, though there are sometimes tears. Be strong.',
		});
		return undefined;
	}

	const winner = rules.Entries.find(entry => entry.ballot === submission.winner);
	if (!winner) {
		errors.push({ field: 'winner', message: 'That winner isn\'t on your ballot.' });
	}
	return winner;
}

/** Returns whether every student on the ballot has valid points, adding an error for each problem. */
function validatePoints(
	rules: ValidateBallotRules,
	{ min, max, step, ties }: NonNullable<ValidateBallotRules['scoring']['points']>,
	submission: DebateBallotSubmission,
	errors: BallotError[],
): boolean {
	const students = new Map(rules.Entries.flatMap(entry => entry.Students).map(student => [student.id, student]));
	const name = (id: number) => `${students.get(id)?.first} ${students.get(id)?.last}`;
	const before = errors.length;

	const submitted = new Map<number, number | null>();
	for (const { student, points } of submission.points) {
		if (!students.has(student)) {
			errors.push({ field: 'points', student, message: 'That student isn\'t on your ballot.' });
		} else if (submitted.has(student)) {
			errors.push({ field: 'points', student, message: `Points were entered twice for ${name(student)}.` });
		} else {
			submitted.set(student, points);
		}
	}

	const taken = new Set<number>();
	for (const student of students.keys()) {
		const value = submitted.get(student) ?? null;

		if (value === null) {
			errors.push({ field: 'points', student, message: `Points missing for ${name(student)}.` });
		} else if (value < min || value > max) {
			errors.push({ field: 'points', student, message: `Points ${value} are outside of range ${min} - ${max}.` });
		} else if (!isMultiple(value, step)) {
			errors.push({ field: 'points', student, message: `Points ${value} must be in steps of ${step}.` });
		} else if (!ties && taken.has(value)) {
			errors.push({ field: 'points', student, message: `Tied points forbidden: you have two speakers with points ${value}.` });
		}

		if (value !== null) taken.add(value);
	}

	return errors.length === before;
}

/**
 * Returns an entry's total submitted points, counting blanks as 0. Rounded so float sums of
 * tenths don't show as 55.49999999999999. */
export function entryPoints(entry: ValidateBallotRules['Entries'][number], submission: DebateBallotSubmission): number {
	const points = new Map(submission.points.map(({ student, points }) => [student, points ?? 0]));
	const total = entry.Students.reduce((sum, student) => sum + (points.get(student.id) ?? 0), 0);
	return Math.round(total * 1000) / 1000;
}

function validateLowPointWin(
	rules: ValidateBallotRules,
	submission: DebateBallotSubmission,
	winner: ValidateBallotRules['Entries'][number],
	lpw: 'forbid' | 'confirm',
	errors: BallotError[],
) {
	const winnerPoints = entryPoints(winner, submission);

	for (const entry of rules.Entries) {
		const otherPoints = entryPoints(entry, submission);

		if (lpw === 'forbid' && winnerPoints < otherPoints) {
			errors.push({ field: 'lowPointWin', message: 'Low point wins are not allowed by this tournament. Please fix points.' });
		} else if (lpw === 'confirm' && winnerPoints < otherPoints && !submission.lowPointWin) {
			errors.push({ field: 'lowPointWin', message: `Please mark if the low-point win is intended. (Winner has ${winnerPoints}, loser has ${otherPoints})` });
		} else if (lpw === 'confirm' && winnerPoints > otherPoints && submission.lowPointWin) {
			errors.push({ field: 'lowPointWin', message: `You marked the low-point win box but this isn't a low point win. (Winner has ${winnerPoints}, loser has ${otherPoints})` });
		}
	}
}

// Within float error, so 28.3 counts as a multiple of 0.1
function isMultiple(value: number, step: number): boolean {
	const steps = value / step;
	return Math.abs(steps - Math.round(steps)) < 1e-9;
}
