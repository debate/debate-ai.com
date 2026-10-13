// @ts-nocheck
// Turns a round's settings and tiebreak types into the rules for its ballot:
// what the judge scores, how, and whether the beta can render it at all.
// No DB access: the caller loads the settings (ballot.mhtml stage 1, ballot_save.mhtml).
// Rules are added one at a time, each with tests.

import type { BallotScoring, DebateBallotContext } from '../../../../types/index.js';
import type { Selectable } from 'kysely';
import type { Ballot, Category, Entry, Event, Judge, Panel, Round, Score, Timeslot, Topic, Tourn } from '../../data/schema.js';
import type entryRepo from '../../repos/entryRepo.js';
import type panelRepo from '../../repos/panelRepo.js';
import type { Settings } from '../../repos/utils/index.js';
import type { Counted } from '../results/tiebreakTypes.js';
import { convert } from 'html-to-text';
import config from '../../config.js';
import logger from '../../helpers/logger.js';

// Site-wide tabroom_setting tags the rules read. The caller loads all of
// them in one query and passes value_text for each.
export const SITE_SETTING_TAGS = [
	'nsda_district_ballot_header',
	'bias_statement',
] as const;

export type SiteSettings = Partial<Record<typeof SITE_SETTING_TAGS[number], string | null>>;

// Rows as the repos return them, with selectSettings' settings. Each picks
// only the columns the rules read.
export type BallotRulesInput = {
	tourn: Pick<Selectable<Tourn>, 'id' | 'start' | 'end'> & { settings?: Settings | null };
	judge: Pick<Selectable<Judge>, 'id'>;
	category: Pick<Selectable<Category>, 'id'> & { settings?: Settings | null };
	event: Pick<Selectable<Event>, 'type'> & { settings?: Settings | null };
	round: Pick<Selectable<Round>, 'type' | 'name' | 'label' | 'flighted' | 'start_time' | 'protocol'> & { settings?: Settings | null };
	timeslot: Pick<Selectable<Timeslot>, 'start'>;
	panel: Pick<Selectable<Panel>, 'id' | 'flight'> & { settings?: Settings | null };
	// This judge's ballot rows on the panel, one per entry, and their scores
	ballots: Pick<Selectable<Ballot>, 'id' | 'entry' | 'side' | 'audit' | 'chair' | 'judge_started'>[];
	scores: Pick<Selectable<Score>, 'ballot' | 'student' | 'tag' | 'value' | 'content'>[];
	// The entries on those ballots with their settings, and their students
	entries: (Pick<Selectable<Entry>, 'id' | 'code'> & { settings?: Settings | null })[];
	students: Awaited<ReturnType<typeof entryRepo.getEntryStudents>>;
	// Pairs of an entry on this panel and another entry it's doubled with
	doubled: Awaited<ReturnType<typeof panelRepo.getDoubledEntries>>;
	// The topic the event's topic setting points to, if any
	topic: Pick<Selectable<Topic>, 'topic_text'> | null;
	site: SiteSettings;
	// What the round's tiebreak protocol counts, which decides what the judge scores
	tbTypes: Counted;
	// Every judge on the panel, this one included
	panelJudges: Awaited<ReturnType<typeof panelRepo.getPanelJudges>>;
	// The entry due to be Aff from the entries' earlier meetings (services/rounds/dueAff)
	dueAff: number | null;
};

export type BallotRules = {
	status: DebateBallotContext['status'];
	chair: boolean;
	chairLabel: string | null;
	topic: DebateBallotContext['topic'];
	rules: string[];
	ballotHeader: string | null;
	roundLabel: string | null;
	flight: number | null;
	roundNotes: string | null;
	roundStart: Date;
	decisionDeadline: Date | null;
	onlineMode: DebateBallotContext['onlineMode'];
	// As in the context, but feedback.editableUntil is a Date like the other times
	scoring: Omit<BallotScoring, 'feedback'> & {
		feedback?: Omit<NonNullable<BallotScoring['feedback']>, 'editableUntil'> & { editableUntil: Date | null };
	};
	Entries: DebateBallotContext['Entries'];
	otherJudges: DebateBallotContext['otherJudges'];
	timers: DebateBallotContext['timers'];
	pointScale: DebateBallotContext['pointScale'];
	speechTimes: DebateBallotContext['speechTimes'];
	ballotTopics: string | null;
	docShare: string | null;
	logo: string | null;
	debate: DebateBallotContext['debate'];
	// Why the beta can't render this ballot. Empty means supported.
	unsupported: string[];
};

// Settings are strings from the DB. Matches perl truthiness, where '0' and '' are false
export const isOn = (value: Settings[string] | undefined): boolean => {
	if (value === undefined || value === null || value === false) return false;
	if (typeof value === 'string') return value !== '' && value !== '0';
	if (typeof value === 'number') return value !== 0;
	return true;
};


export function ballotRules(input: BallotRulesInput): BallotRules {
	// Scores the beta ballot can't take yet. A protocol counting any of them sends the ballot to classic
	const UNSUPPORTED_TB_TYPES: (keyof Counted)[] = [
		'rank',
		'entryWinloss',
		'entryRank',
		'bestPO',
		'refute',
		'tv',
	];

	// Tourn settings that send every ballot to a different classic page
	const UNSUPPORTED_TOURN_SETTINGS = [
		'legion',
		'mock_trial_registration',
	];

	// Event settings that change the debate ballot in ways the beta doesn't handle yet
	const UNSUPPORTED_EVENT_SETTINGS = [
		'ballot_rubric',
		'roles_rubric',
		'speakers_rubric',
		'chair_scores',
		'chair_winloss',
		'chair_only_outstanding',
		'big_questions',
		'wsdc_categories',
		'max_style_points',
		'max_content_points',
		'max_strategy_points',
		'max_poi_points',
		'lower_rules',
		'dumb_signature_line',
		'team_total_line',
		// Online coin flips: flip status, polling for flipped sides
		'flip_online',
		// The judge picks sides every round, and speaker order
		'no_side_constraints',
		// Performance video links on each entry
		'show_async_links',
		// Prep breakout room links, which need online_room.mas ported
		'online_prep',
		// One score per entry, which the submission doesn't take yet
		'team_points',
	];

	// Category settings that add entry columns the beta doesn't show yet
	const UNSUPPORTED_CATEGORY_SETTINGS = [
		'ballot_school_codes',
		'ballot_region_codes',
	];

	// Panel settings that change the ballot in ways the beta doesn't handle yet
	const UNSUPPORTED_PANEL_SETTINGS = [
		// Performance video links on each entry
		'show_async',
	];

	const UNSUPPORTED_ONLINE_MODES = [
		// Join links come from online_room.mas, which isn't ported yet
		'nsda_campus',
		'nsda_campus_observers',
		'public_jitsi',
		'public_jitsi_observers',
		// Performance video links on each entry
		'async',
	];

	const { tourn, category, event, round, panel, tbTypes } = input;
	const unsupported: string[] = [];

	// use_normal_rooms puts an online event's round in physical rooms, which classic treats as sync
	const onlineMode = isOn(round.settings?.use_normal_rooms)
		? 'sync'
		: isOn(event.settings?.online_mode) ? String(event.settings?.online_mode) as BallotRules['onlineMode'] : null;

	if (event.type !== 'debate') {
		unsupported.push(`event type ${event.type}`);
	}

	// Classic refuses the ballot: "That tournament does not have tiebreakers set"
	if (!round.protocol) {
		unsupported.push('no protocol');
	}

	for (const type of UNSUPPORTED_TB_TYPES) {
		if (tbTypes[type]) unsupported.push(`tiebreak type ${type}`);
	}

	for (const tag of UNSUPPORTED_TOURN_SETTINGS) {
		if (isOn(tourn.settings?.[tag])) unsupported.push(`tourn setting ${tag}`);
	}

	for (const tag of UNSUPPORTED_EVENT_SETTINGS) {
		if (isOn(event.settings?.[tag])) unsupported.push(`event setting ${tag}`);
	}

	for (const tag of UNSUPPORTED_CATEGORY_SETTINGS) {
		if (isOn(category.settings?.[tag])) unsupported.push(`category setting ${tag}`);
	}

	for (const tag of UNSUPPORTED_PANEL_SETTINGS) {
		if (isOn(panel.settings?.[tag])) unsupported.push(`panel setting ${tag}`);
	}

	if (onlineMode && UNSUPPORTED_ONLINE_MODES.includes(onlineMode)) {
		unsupported.push(`online mode ${onlineMode}`);
	}

	const lock = sideLock(input);

	// The judge picks sides, which needs side swaps and the side disagreement check from ballot_save.mhtml
	if (lock === 'pick') {
		unsupported.push('side choice');
	}

	// Pairing puts the due Aff entry on side 1, so a mismatch means tab moved the sides by hand
	const dueAffBallot = input.ballots.find(ballot => ballot.entry === input.dueAff);
	if (lock === 'history' && dueAffBallot && dueAffBallot.side !== 1) {
		logger.warn('Due Aff entry is not on side 1', { panel: panel.id, entry: input.dueAff, side: dueAffBallot.side });
	}

	return {
		status: ballotStatus(input),
		chair: isChair(input),
		chairLabel: chairLabel(input),
		topic: ballotTopic(input),
		rules: rulesText(input),
		ballotHeader: ballotHeader(input),
		roundLabel: roundLabel(input),
		flight: (round.flighted ?? 0) > 1 ? Number(panel.flight) || null : null,
		roundNotes: isOn(round.settings?.notes) ? String(round.settings?.notes) : null,
		roundStart: roundStart(input),
		decisionDeadline: decisionDeadline(input),
		onlineMode,
		scoring: {
			winloss: winlossScoring(input),
			points: pointsScoring(input),
			ranks: ranksScoring(input),
			feedback: feedbackScoring(input),
		},
		Entries: ballotEntries(input),
		otherJudges: otherJudges(input),
		timers: ballotTimers(input),
		pointScale: settingLines(event.settings?.point_scale).map(([points, description]) => ({ points, description })),
		speechTimes: settingLines(event.settings?.speech_times).map(([speech, time]) => speech === null
			? { speech: time, time: null }
			: { speech, time }),
		ballotTopics: isOn(round.settings?.ballot_topics) ? String(round.settings?.ballot_topics) : null,
		docShare: isOn(panel.settings?.share) ? `https://share.tabroom.com/${panel.settings?.share}` : null,
		logo: isOn(tourn.settings?.logo) ? `${config.aws.s3_url}/${tourn.id}/${tourn.settings?.logo}` : null,
		debate: {
			affLabel: isOn(event.settings?.aff_label) ? String(event.settings?.aff_label) : 'Aff',
			negLabel: isOn(event.settings?.neg_label) ? String(event.settings?.neg_label) : 'Neg',
			sides: lock === 'pick' ? 'pick' : 'locked',
			winner: savedWinner(input),
		},
		unsupported,
	};
}

/**
 * Returns the entries on the judge's ballot in side order, skipping ballot rows with no entry.
 * Students are in speaking order: for debate entries with more than two students, by the
 * entry's positions setting (1S, 2S, then 2A or 2N depending on the side, unset first), else by
 * last name. Pronouns are hidden when the tourn sets limit_info. With team points, the saved
 * score is on the entry, since classic writes the entry total onto each student's row. */
export function ballotEntries(input: Pick<BallotRulesInput, 'tourn' | 'event' | 'ballots' | 'scores' | 'entries' | 'students' | 'doubled' | 'tbTypes'>): BallotRules['Entries'] {
	const { tourn, event, ballots, scores, entries, students, doubled } = input;
	const team = pointsScoring(input)?.team ?? false;
	const hidePronouns = isOn(tourn.settings?.limit_info);

	const position = (code: string | undefined, side: number): number => {
		if (code === '1S') return 1;
		if (code === '2S') return 2;
		if (code === '2A') return side === 1 ? 2 : 1;
		if (code === '2N') return side === 1 ? 1 : 2;
		return 0;
	};

	const byLastName = (a: string | null, b: string | null) => {
		const [x, y] = [a ?? '', b ?? ''];
		return x < y ? -1 : x > y ? 1 : 0;
	};

	return ballots
		.filter(ballot => entries.some(entry => entry.id === ballot.entry))
		.sort((a, b) => a.side - b.side)
		.map(ballot => {
			const entry = entries.find(entry => entry.id === ballot.entry)!;
			const points = scores.filter(score => score.ballot === ballot.id && score.tag === 'point');
			const positions = (entry.settings?.positions ?? {}) as Record<string, string>;

			const entryStudents = students.filter(student => student.entry === entry.id);
			const ordered = event.type === 'debate' && entryStudents.length > 2;

			return {
				ballot: ballot.id,
				entry: entry.id,
				code: entry.code,
				side: ballot.side,
				// Saved from a textarea through save_editor.mas, which can leave tags and entities
				notes: isOn(entry.settings?.ballot_notes) ? plainText(String(entry.settings?.ballot_notes)).trim() || null : null,
				doubled: new Set(doubled.filter(pair => pair.entry === entry.id).map(pair => pair.other)).size,
				comments: scores.find(score => score.ballot === ballot.id && score.tag === 'comments')?.content ?? null,
				points: team ? points[0]?.value ?? null : null,
				Students: [...entryStudents]
					.sort((a, b) => (ordered ? position(positions[a.id], ballot.side) - position(positions[b.id], ballot.side) : 0)
						|| byLastName(a.last, b.last))
					.map(student => ({
						id: student.id,
						first: student.first,
						middle: student.middle,
						last: student.last,
						pronoun: !hidePronouns && isOn(student.pronoun) ? student.pronoun : null,
						points: team ? null : points.find(score => score.student === student.id)?.value ?? null,
					})),
			};
		});
}

/**
 * Returns the feedback block: the saved reason for decision, the word minimums the ballot needs
 * before it can be submitted (rfd_plz, comments_plz), and when feedback stops being editable:
 * the end of the tourn, even after the ballot is confirmed. Classic saves the same reason for
 * decision on each of the judge's ballots, so any one of them has it. Undefined for Congress,
 * and for mock trial unless the event sets mock_trial_feedback (ballot.mhtml). */
export function feedbackScoring({ tourn, event, scores }: Pick<BallotRulesInput, 'tourn' | 'event' | 'scores'>): BallotRules['scoring']['feedback'] {
	const words = (value: Settings[string] | undefined) => {
		const number = Math.floor(Number(value));
		return isOn(value) && Number.isFinite(number) && number > 0 ? number : null;
	};

	// Congress never takes feedback on the ballot, and mock trial only with mock_trial_feedback
	if (event.type === 'congress') return undefined;
	if (event.type === 'mock_trial' && !isOn(event.settings?.mock_trial_feedback)) return undefined;

	return {
		rfd: scores.find(score => score.tag === 'rfd' && score.content)?.content ?? null,
		minWords: {
			rfd: words(event.settings?.rfd_plz),
			comments: words(event.settings?.comments_plz),
		},
		editableUntil: tourn.end,
	};
}

/**
 * Returns the other judges on the panel, chairs first then by last name, when the round has
 * more than one judge (num_judges). */
export function otherJudges({ round, judge, panelJudges }: Pick<BallotRulesInput, 'round' | 'judge' | 'panelJudges'>): BallotRules['otherJudges'] {
	if (!(Number(round.settings?.num_judges) > 1)) return [];

	return panelJudges
		.filter(other => other.id !== judge.id)
		.sort((a, b) => Number(b.chair) - Number(a.chair) || ((a.last ?? '') < (b.last ?? '') ? -1 : (a.last ?? '') > (b.last ?? '') ? 1 : 0))
		.map(other => ({
			first: other.first,
			middle: other.middle,
			last: other.last,
			chair: Boolean(other.chair),
			pronoun: isOn(other.pronoun) ? other.pronoun : null,
		}));
}

/**
 * Returns the timer lengths in minutes, or null when the event sets no_timers. Mock trial has
 * no timers. The speech timer defaults to 5 minutes (10 for speech, 3 for Congress), and each
 * entry gets a prep timer, 4 minutes by default, except in speech and Congress. */
export function ballotTimers({ event }: Pick<BallotRulesInput, 'event'>): BallotRules['timers'] {
	if (isOn(event.settings?.no_timers) || event.type === 'mock_trial') return null;

	const minutes = (value: Settings[string] | undefined, fallback: number) => {
		const number = Number(value);
		return isOn(value) && Number.isFinite(number) && number > 0 ? number : fallback;
	};

	const speech = minutes(event.settings?.default_time, event.type === 'speech' ? 10 : event.type === 'congress' ? 3 : 5);
	const prep = event.type === 'speech' || event.type === 'congress' ? null : minutes(event.settings?.prep_time, 4);

	return { speech, prep };
}

/**
 * Converts text saved through classic's save_editor.mas to plain text: tags removed,
 * entities decoded, and <p>, <br> and line breaks kept as line breaks. */
export function plainText(html: string): string {
	return convert(html.replace(/\r\n|\r|\n/g, '<br>'), {
		wordwrap: false,
		selectors: [
			{ selector: 'p', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
			// Classic's editor cleanup removed links, so only their text showed
			{ selector: 'a', options: { ignoreHref: true } },
		],
	})
		// &nbsp; decodes to a non-breaking space
		.replace(/ /g, ' ');
}

/**
 * Splits an editor setting like point_scale or speech_times into its lines of text, each
 * split on the first "..." into [before, after], or [null, line] when it has none.
 * Classic split on raw line breaks and stripped tags and non-ASCII characters; this breaks
 * lines on <p>, <br> and line breaks, decodes entities, keeps non-ASCII and drops empty lines. */
export function settingLines(html: Settings[string] | undefined): [string | null, string][] {
	if (!isOn(html)) return [];

	return plainText(String(html)).split('\n')
		.map(line => line.trim())
		.filter(line => line !== '')
		.map(line => {
			const [before, ...after] = line.split('...');
			return after.length && before.trim() && after.join('...').trim()
				? [before.trim(), after.join('...').trim()]
				: [null, line];
		});
}

/**
 * Returns the ballot the judge saved as the winner (a winloss score of 1), or null. */
export function savedWinner({ ballots, scores }: Pick<BallotRulesInput, 'ballots' | 'scores'>): number | null {
	const winner = ballots.find(ballot => scores.some(score =>
		score.ballot === ballot.id && score.tag === 'winloss' && Number(score.value) === 1));
	return winner?.id ?? null;
}

/**
 * Returns who decides the debate sides (ballot.mhtml $locked):
 * tab: tab set them, as in prelims and in elims with sidelock_elims.
 * history: the entries met before and one is due Aff, so pairing set them.
 * pick: the judge picks, as in elims where the entries haven't met or were Neg equally often,
 * and always with no_side_constraints or (in elims) no_elim_sidelocks. */
export function sideLock({ event, round, dueAff }: Pick<BallotRulesInput, 'event' | 'round' | 'dueAff'>): 'tab' | 'history' | 'pick' {
	const ELIM_TYPES = ['elim', 'final', 'runoff'];
	const settings = event.settings ?? {};

	if (isOn(settings.no_side_constraints)) return 'pick';
	if (!ELIM_TYPES.includes(round.type ?? '')) return 'tab';
	if (isOn(settings.sidelock_elims)) return 'tab';
	if (isOn(settings.no_elim_sidelocks)) return 'pick';
	return dueAff === null ? 'pick' : 'history';
}

/**
 * Returns where the judge is with this ballot. Confirmed once every one of the judge's
 * ballot rows is audited (ballot.mhtml $audit), which locks its scores for everyone; changes
 * then go through tab. Scored once a winner, points or ranks are
 * saved, and started once the judge has opened it. Comments don't count, since they're
 * saved as drafts before the ballot is submitted. */
export function ballotStatus({ ballots, scores }: Pick<BallotRulesInput, 'ballots' | 'scores'>): BallotRules['status'] {
	const SCORE_TAGS = ['winloss', 'point', 'rank'];

	if (ballots.length > 0 && ballots.every(ballot => ballot.audit)) return 'confirmed';
	if (scores.some(score => score.tag && SCORE_TAGS.includes(score.tag))) return 'scored';
	if (ballots.some(ballot => ballot.judge_started)) return 'started';
	return 'not_started';
}

/** Returns whether the judge chairs the panel: any of their ballot rows is marked chair. */
export function isChair({ ballots }: Pick<BallotRulesInput, 'ballots'>): boolean {
	return ballots.some(ballot => ballot.chair);
}

/**
 * Returns the event's own name for the chair, or null when it has none. The client falls
 * back to Parliamentarian for Congress or Chair Judge, so the words can be translated. */
export function chairLabel({ event }: Pick<BallotRulesInput, 'event'>): string | null {
	return isOn(event.settings?.chair_label) ? String(event.settings?.chair_label) : null;
}

/**
 * Returns the topic shown above the ballot, or null if there is none. In order: the event's
 * topic (with line breaks as <br />), the round's motion once it's published, then the
 * event's resolution. Big Questions has its own resolution and is gated as unsupported. */
export function ballotTopic({ event, round, topic }: Pick<BallotRulesInput, 'event' | 'round' | 'topic'>): BallotRules['topic'] {
	if (topic?.topic_text) {
		return { label: 'Topic', text: topic.topic_text.replace(/\r\n|\n|\r/g, '<br />') };
	}

	if (isOn(round.settings?.motion_publish)) {
		return { label: 'Motion', text: String(round.settings?.motion ?? '') };
	}

	if (isOn(event.settings?.resolution)) {
		return { label: 'Resolution', text: String(event.settings?.resolution) };
	}

	return null;
}

/**
 * Returns tab's ballot instructions in display order: ballot_rules_chair for the chair, then
 * ballot_rules unless the judge is chair and the event sets chair_ballot_only. */
export function rulesText({ ballots, event }: Pick<BallotRulesInput, 'ballots' | 'event'>): string[] {
	const chair = ballots.some(ballot => ballot.chair);
	const settings = event.settings ?? {};
	const rules: string[] = [];

	if (chair && isOn(settings.ballot_rules_chair)) {
		rules.push(String(settings.ballot_rules_chair));
	}

	if (isOn(settings.ballot_rules) && !(chair && isOn(settings.chair_ballot_only))) {
		rules.push(String(settings.ballot_rules));
	}

	return rules;
}

/**
 * Returns the round's label, or null when it has none or the label just repeats its number
 * (Tab::Round realname). The client shows "Round N" or "Session N" when this is null, so
 * the words can be translated. */
export function roundLabel({ round }: Pick<BallotRulesInput, 'round'>): string | null {
	return round.label && round.label !== String(round.name) ? round.label : null;
}

/**
 * Returns the points block when the round's protocol counts points, else undefined.
 * The range defaults to 0-6 for Congress, 0-100 for speech and 0-30 otherwise, like
 * ballot.mhtml, and an unset point_increments means whole points. */
export function pointsScoring({ event, tbTypes }: Pick<BallotRulesInput, 'event' | 'tbTypes'>): BallotScoring['points'] {
	const STEPS: Record<string, number> = {
		whole: 1,
		half: 0.5,
		fourths: 0.25,
		tenths: 0.1,
	};

	if (!tbTypes.point) return undefined;

	const settings = event.settings ?? {};

	// Unset, '0' or not a number all fall back to the default, like classic's `unless`
	const numberOr = (value: Settings[string] | undefined, fallback: number) => {
		const number = Number(value);
		return isOn(value) && Number.isFinite(number) ? number : fallback;
	};

	return {
		min: numberOr(settings.min_points, 0),
		max: numberOr(settings.max_points, event.type === 'congress' ? 6 : event.type === 'speech' ? 100 : 30),
		step: STEPS[String(settings.point_increments)] ?? 1,
		ties: isOn(settings.point_ties),
		team: isOn(settings.team_points),
		ranksAgree: Boolean(tbTypes.rank)
			&& !((event.type === 'speech' || event.type === 'congress') && isOn(settings.allow_lowpoints)),
	};
}

/** Returns the ranks block when the round's protocol counts ranks, else undefined. */
export function ranksScoring({ tbTypes }: Pick<BallotRulesInput, 'tbTypes'>): BallotScoring['ranks'] {
	return tbTypes.rank ? {} : undefined;
}

/**
 * Returns the winloss block when the round's protocol counts wins, else undefined.
 * Low-point wins can only happen when points are scored too. no_lpw forbids them unless
 * allow_lowpoints is set (ballot_save.mhtml); otherwise the judge has to confirm one. */
export function winlossScoring({ event, tbTypes }: Pick<BallotRulesInput, 'event' | 'tbTypes'>): BallotScoring['winloss'] {
	if (!tbTypes.winloss) return undefined;
	if (!tbTypes.point) return { lpw: null };

	const forbid = isOn(event.settings?.no_lpw) && !isOn(event.settings?.allow_lowpoints);
	return { lpw: forbid ? 'forbid' : 'confirm' };
}

/**
 * Returns when this panel's flight starts: the round's start_time, else its timeslot's start,
 * plus flight_offset minutes for each flight after the first. */
export function roundStart({ round, timeslot, panel, event }: Pick<BallotRulesInput, 'round' | 'timeslot' | 'panel' | 'event'>): Date {
	const start = round.start_time ?? timeslot.start;
	if (!start) throw new Error('Round has no start_time and its timeslot has no start');

	const offset = (Number(event.settings?.flight_offset) || 0) * Math.max(Number(panel.flight) - 1, 0);
	return new Date(start.getTime() + offset * 60_000);
}

/**
 * Returns when the judge's decision is due, or null if the event sets no deadline.
 * The deadline is the event's prelim or elim decision deadline in minutes after roundStart. */
export function decisionDeadline(input: Pick<BallotRulesInput, 'round' | 'timeslot' | 'panel' | 'event'>): Date | null {
	const ELIM_TYPES = ['elim', 'final', 'runoff'];
	const { round, event } = input;

	const setting = ELIM_TYPES.includes(round.type ?? '')
		? event.settings?.elim_decision_deadline
		: event.settings?.prelim_decision_deadline;

	const minutes = Number(setting);
	if (!isOn(setting) || !Number.isFinite(minutes)) return null;

	return new Date(roundStart(input).getTime() + minutes * 60_000);
}

/**
 * Returns a string containing the ballot header, or null if there is none or it is blanked out. */
export function ballotHeader({ tourn, site }: Pick<BallotRulesInput, 'tourn' | 'site'>): string | null {
	const NSDA_TOURN_SETTINGS = [
		'nsda_district',
		'nsda_nats',
		'nsda_ms_nats',
		'nsda_billing',
	];
	const DEFAULT_BIAS_START = new Date('2021-08-01T00:00:00Z');

	const settings = tourn.settings ?? {};
	const nsda = NSDA_TOURN_SETTINGS.some(tag => isOn(settings[tag]));
	const useDefault = (tourn.start !== null && tourn.start > DEFAULT_BIAS_START) || isOn(settings.bias_saved);

	const statement = settings.bias_statement
		?? (nsda ? site.nsda_district_ballot_header : null)
		?? (useDefault ? site.bias_statement : null);

	if (statement === undefined || statement === null) return null;

	const html = String(statement);
	return /[\p{L}\p{N}]/u.test(html.replace(/<[^>]*>|&#?\w+;/g, '')) ? html : null;
}
