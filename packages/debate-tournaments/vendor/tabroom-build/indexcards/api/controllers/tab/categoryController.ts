// @ts-nocheck
import { NotImplemented, NotFound, BadRequest } from '../../helpers/problem.js';
import categoryRepo from '../../repos/categoryRepo.js';
import { db } from '../../data/database.js';

import type { Request, Response } from '../../_shims/express.js';
export async function getCategory(req: Request, res: Response) {
	const categoryId = Number(req.params.categoryId);
	if (!categoryId) return BadRequest(req,res,'Category ID is required');
	const category = await categoryRepo.getCategory(db,categoryId,{settings: true});
	if (category?.tourn != Number(req.params.tournId))
		return NotFound(req,res,'Category not found');
	res.json(category);
}
export async function getCategories(req: Request, res: Response) {
	const tournId = Number(req.params.tournId);
	if (!tournId) return BadRequest(req,res,'Tournament ID is required');
	const categories = await categoryRepo.getCategories(db, { tourn: tournId });

	res.json(categories);
}
export function createCategory(req: Request, res: Response) {
	throw NotImplemented(req,res,'function not implemented');
}

export async function deleteCategory(req: Request, res: Response) {
	if (!req.params.tournId) return BadRequest(req,res,'Tournament ID is required');
	if (!req.params.categoryId) return BadRequest(req,res,'Category ID is required');

	const category = await categoryRepo.getCategory(db,Number(req.params.categoryId));
	if (!category) return NotFound(req,res,'Category not found');
	if(category.tourn != Number(req.params.tournId)) return BadRequest(req,res,'Category does not belong to this tournament');
	await categoryRepo.deleteCategory(db, Number(req.params.categoryId));

	res.status(204).send();
}

export function updateCategory(req: Request, res: Response) {
	throw NotImplemented(req,res,'function not implemented');
}

export default {
	getCategory,
	getCategories,
	createCategory,
	deleteCategory,
	updateCategory,
};