// @ts-nocheck
import webpageRepo from '../../repos/webpageRepo.js';
import { db } from '../../data/database.js';
import type { Request, Response } from '../../_shims/express.js';

/** Get a list of the public, sitewide pages
 */
export async function getPublicPages(req: Request, res: Response){
	const slug = typeof req.params.slug === 'string' ? req.params.slug : undefined;
	const pages = await webpageRepo.getWebpages(db, {
		sitewide: true,
		slug,
	});

	if (slug) {
		if (!pages.length) {
			return res.status(404).json({ message: 'Page with not found' });
		}
		return res.json(pages);
	}

	res.json(pages);
}
