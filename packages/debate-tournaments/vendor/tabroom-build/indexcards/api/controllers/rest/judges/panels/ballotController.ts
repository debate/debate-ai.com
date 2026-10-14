// @ts-nocheck
import { Conflict, NotFound, UnprocessableEntity } from '../../../../helpers/problem.js';
import type { Response } from '../../../../_shims/express.js';
import type { BallotContext, BallotFeedback, BallotSubmission } from '../../../../../../types/index.js';
import type { ValidatedRequest } from '../../../../middleware/validation.js';
import { getPerson } from '../../../../middleware/auth/authorization.js';
import { db } from '../../../../data/database.js';
import { ballotRules, ballotStatus } from '../../../../services/ballots/ballotRules.js';
import { loadBallotInputs } from '../../../../services/ballots/loadBallotInputs.js';
import { saveBallot, saveBallotFeedback } from '../../../../services/ballots/saveBallot.js';
import ballotRepo from '../../../../repos/ballotRepo.js';
import judgeRepo from '../../../../repos/judgeRepo.js';
import scoreRepo from '../../../../repos/scoreRepo.js';

// Returns the BallotContext: everything needed to render this judge's ballot
// for this panel.
export async function getBallotContext(req: ValidatedRequest, res: Response) {
	const judgeId = Number(req.params.judgeId);
	const panelId = Number(req.params.panelId);

	const inputs = await loadBallotInputs(db, judgeId, panelId);
	if (!inputs) return NotFound(req, res, `Panel ${panelId} not found`);

	const rules = ballotRules(inputs);
	const { tourn, event, round, room, judge } = inputs;

	// Ballots the beta can't render yet go to the classic ballot
	const context: BallotContext = rules.unsupported.length > 0
		? {
			eventType: 'other',
			judge: judgeId,
			panel: panelId,
			tourn: tourn.id,
			supported: false,
		}
		: {
			eventType: 'debate',
			status: rules.status,
			chair: rules.chair,
			chairLabel: rules.chairLabel,
			topic: rules.topic,
			rules: rules.rules,
			// classic falls back to UTC
			tz: tourn.tz ?? 'UTC',
			Tourn: { id: tourn.id },
			Event: { abbr: event.abbr },
			Round: { id: round.id, name: round.name, label: rules.roundLabel, notes: rules.roundNotes },
			flight: rules.flight,
			// Most rooms store an empty url, which classic treats as none
			Room: room ? { name: room.name, url: room.url || null } : null,
			Judge: { code: judge.code, first: judge.first, middle: judge.middle, last: judge.last },
			ballotHeader: rules.ballotHeader,
			roundStart: rules.roundStart.toISOString(),
			decisionDeadline: rules.decisionDeadline?.toISOString() ?? null,
			onlineMode: rules.onlineMode,
			scoring: {
				...rules.scoring,
				feedback: rules.scoring.feedback && {
					...rules.scoring.feedback,
					editableUntil: rules.scoring.feedback.editableUntil?.toISOString() ?? null,
				},
			},
			Entries: rules.Entries,
			otherJudges: rules.otherJudges,
			timers: rules.timers,
			pointScale: rules.pointScale,
			speechTimes: rules.speechTimes,
			ballotTopics: rules.ballotTopics,
			docShare: rules.docShare,
			logo: rules.logo,
			debate: rules.debate,
		};

	return res.status(200).json(context);
}

// Validates the judge's submission and saves its scores, or only validates with ?dryRun=true.
// Returns the saved ballot for the judge to review before confirming.
export async function submitBallot(req: ValidatedRequest, res: Response) {
	const person = getPerson(req);
	const judgeId = Number(req.params.judgeId);
	const panelId = Number(req.params.panelId);
	const submission: BallotSubmission = req.body;

	const inputs = await loadBallotInputs(db, judgeId, panelId);
	if (!inputs) return NotFound(req, res, `Panel ${panelId} not found`);

	const saved = await saveBallot(db, inputs, submission, { person: person.id, dryRun: req.query.dryRun });

	switch (saved.result) {
		case 'unsupported':
			return Conflict(req, res, 'This ballot can only be entered on classic Tabroom', { reasons: saved.reasons });
		case 'confirmed':
			return Conflict(req, res, 'This ballot has already been confirmed. Contact the tab room to change it');
		case 'changed':
			return Conflict(req, res, 'This ballot changed while you were entering it. Reload and try again');
		case 'invalid':
			return UnprocessableEntity(req, res, 'The ballot has errors', saved.errors);
		case 'valid':
		case 'saved':
			return res.status(200).json(saved.review);
	}
}

// Marks the ballot as opened by the judge. The page calls it when the ballot loads
export async function startBallot(req: ValidatedRequest, res: Response) {
	const person = getPerson(req);
	const judgeId = Number(req.params.judgeId);
	const panelId = Number(req.params.panelId);

	const judge = await judgeRepo.getJudge(req.db, judgeId);
	if (!judge) return NotFound(req, res, `Judge ${judgeId} not found`);

	// Someone entering it for the judge, like tab staff or a site admin, doesn't count (classic's "notme")
	if (judge.person === person.id) {
		await ballotRepo.markBallotsStarted(req.db, { judge: judgeId, panel: panelId, person: person.id });
	}

	const ballots = await ballotRepo.getBallots(req.db, { judge: judgeId, panel: panelId });
	const scores = await scoreRepo.getScores(req.db, { ballots: ballots.map(ballot => ballot.id) });

	return res.status(200).json({ status: ballotStatus({ ballots, scores }) });
}

// Polled while the ballot is open, so the page notices a ballot confirmed elsewhere.
// Reads only the judge's ballot rows and scores, not the full ballot inputs
export async function getBallotStatus(req: ValidatedRequest, res: Response) {
	const judgeId = Number(req.params.judgeId);
	const panelId = Number(req.params.panelId);

	const ballots = await ballotRepo.getBallots(db, { judge: judgeId, panel: panelId });
	const scores = await scoreRepo.getScores(db, { ballots: ballots.map(ballot => ballot.id) });

	return res.status(200).json({ status: ballotStatus({ ballots, scores }) });
}

// Saves the RFD and per-entry comments as drafts. Returns them as saved
export async function saveFeedback(req: ValidatedRequest, res: Response) {
	const judgeId = Number(req.params.judgeId);
	const panelId = Number(req.params.panelId);
	const body: BallotFeedback = req.body;

	const saved = await saveBallotFeedback(db, { judge: judgeId, panel: panelId }, body);

	switch (saved.result) {
		case 'closed':
			return Conflict(req, res, 'The tournament is over, so feedback can no longer change');
		case 'invalid':
			return UnprocessableEntity(req, res, 'The feedback has errors', saved.errors);
		case 'saved':
			return res.status(200).json(saved.feedback);
	}
}
