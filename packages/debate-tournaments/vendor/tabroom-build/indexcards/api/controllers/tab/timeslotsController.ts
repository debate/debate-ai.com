// @ts-nocheck
import timeslotRepo from '../../repos/timeslotRepo.js';
import { NotFound, BadRequest } from '../../helpers/problem.js';
import { db } from '../../data/database.js';

import type { Request, Response } from '../../_shims/express.js';
//tourns/:tournId/timeslots/:timeslotId
async function getTimeslot(req: Request, res: Response) {
	const timeslotId = parseInt(req.params.timeslotId as string);
	const timeslot = await timeslotRepo.getTimeslot(db, timeslotId);
	if (!timeslot) return NotFound(req,res,'Timeslot not found');
	if(timeslot.tourn !== parseInt(req.params.tournId as string)) return NotFound(req,res,'Timeslot not found for this tournament');
	return res.json(timeslot);
}

//tourns/:tournId/timeslots
async function getTimeslots(req: Request, res: Response) {
	const tournId = parseInt(req.params.tournId as string);
	const timeslots = await timeslotRepo.getTimeslots(db, tournId);
	if (!timeslots) return NotFound(req,res,'Timeslots not found');
	return res.json(timeslots);

}

//tourns/:tournId/timeslots
async function createTimeslot(req: Request, res: Response) {
	const timeslotData = req.body;
	if (isNaN(Number(timeslotData?.tourn)) || Number(timeslotData.tourn) !== Number(req.params.tournId)) {
		return BadRequest(req, res, 'Tournament ID in body does not match URL');
	}
	const timeslot = await timeslotRepo.createTimeslot(db, timeslotData);
	return res.status(201).json(timeslot);
}

async function updateTimeslot(req: Request, res: Response) {
	const timeslotId = parseInt(req.params.timeslotId as string);
	const timeslotData = req.body;
	if (!req.params.timeslotId) {
		return BadRequest(req, res, 'Timeslot ID is required');
	}
	if (timeslotData.id && Number(timeslotData.id) !== Number(req.params.timeslotId)) {
		return BadRequest(req, res, 'Timeslot ID in body does not match URL');
	}
	await timeslotRepo.updateTimeslot(db, timeslotId, timeslotData);
	return res.status(204).send();
}

//tourns/:tournId/timeslots/:timeslotId
async function deleteTimeslot(req: Request, res: Response) {
	const timeslotId = parseInt(req.params.timeslotId as string);
	const deleted = await timeslotRepo.deleteTimeslot(db, timeslotId);
	if (!deleted) {
		return NotFound(req,res,'Timeslot not found for deletion');
	}
	return res.status(204).send();

}

export default {
	getTimeslot,
	getTimeslots,
	createTimeslot,
	updateTimeslot,
	deleteTimeslot,
};