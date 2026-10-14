// @ts-nocheck
import { NotImplemented, BadRequest, NotFound } from '../../helpers/problem.js';
import siteRepo from '../../repos/siteRepo.js';
import roomRepo from '../../repos/roomRepo.js';

import type { Request, Response } from '../../_shims/express.js';
import { db } from '../../data/database.js';

//tourns/:tournId/sites/:siteId
async function getSite(req: Request, res: Response) {
	if (!Number(req.params.siteId)) return BadRequest(req,res,'siteId is required');
	const site = await siteRepo.getSite(db,Number(req.params.siteId), { tourn: Number(req.params.tournId) });
	if (!site) {
		return NotFound(req,res,`No site found for tournId:${req.params.tournId} with id ${req.params.siteId}`);
	}
	return res.json(site);
}
//tourns/:tournId/sites
async function getSites(req: Request, res: Response) {
	if (!req.params.tournId) return BadRequest(req,res,'tournId is required');
	const sites = await siteRepo.getSites(db,{ tourn: Number(req.params.tournId) });
	if (!sites) return NotFound(req,res,'No sites found for tournId ' + req.params.tournId);
	return res.json(sites);

}
//tourns/:tournId/sites
async function createSite(req: Request, res: Response) {
	return NotImplemented(req,res,'this feature is not implemented yet');
}

//tourns/:tournId/sites/:siteId
async function updateSite(req: Request, res: Response) {
	return NotImplemented(req,res,'this feature is not implemented yet');
}
//tourns/:tournId/sites/:siteId
async function deleteSite(req: Request, res: Response) {
	return NotImplemented(req,res,'this feature is not implemented yet');
}

//tourns/:tournId/sites/:siteId/rooms/:roomId
async function getRoom(req: Request, res: Response) {
	if (!req.params.roomId) return BadRequest(req,res,'roomId is required');
	if (!req.params.siteId) return BadRequest(req,res,'siteId is required');
	if (!req.params.tournId) return BadRequest(req,res,'tournId is required');
	const room = await roomRepo.getRoom(db,Number(req.params.roomId),{
		site: Number(req.params.siteId),
		tourn: Number(req.params.tournId),
	});

	if (!room) {
		return NotFound(req,res,`No room found for tournId:${req.params.tournId} siteId:${req.params.siteId} with id ${req.params.roomId}`);
	}
	return res.json(room);
}

//tourns/:tournId/sites/:siteId/rooms
async function getRooms(req: Request, res: Response) {
	if (!req.params.siteId) return BadRequest(req,res,'siteId is required');
	if (!req.params.tournId) return BadRequest(req,res,'tournId is required');
	const rooms = await roomRepo.getRooms(db,{ site: Number(req.params.siteId), tourn: Number(req.params.tournId) });
	if (!rooms) {
		return NotFound(req,res,`No rooms found for tournId:${req.params.tournId} siteId:${req.params.siteId}`);
	}
	return res.json(rooms);
}

async function createRoom(req: Request, res: Response) {
	return NotImplemented(req,res,'this feature is not implemented yet');
}

async function updateRoom(req: Request, res: Response) {
	return NotImplemented(req,res,'this feature is not implemented yet');
}

async function deleteRoom(req: Request, res: Response) {
	return NotImplemented(req,res,'this feature is not implemented yet');
}

export default {
	getSite,
	getSites,
	createSite,
	updateSite,
	deleteSite,
	getRoom,
	getRooms,
	createRoom,
	updateRoom,
	deleteRoom,
};