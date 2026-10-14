// @ts-nocheck
import { db } from '../../data/database.js';
import { sql } from 'kysely';
import config from '../../config.js';

import type { Request, Response } from '../../_shims/express.js';
export async function getPublishedAds(req: Request, res: Response) {
	const currentAds = await db.selectFrom('ad')
	.select(['id', 'filename', 'url', 'background'])
	.where('ad.start', '<', new Date())
	.where('ad.end', '>', new Date())
	.where('ad.approved', '=', 1)
	.orderBy('ad.sort_order')
	.orderBy(sql`RAND()`)
	.execute();

	return res.status(200).json(currentAds.map(ad => ({
		url: ad.url,
		imgSrc: `${config.aws.s3_url}/ads/${ad.id}/${ad.filename}`,
		background: ad.background,
	})));
};
