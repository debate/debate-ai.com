// @ts-nocheck
import type { z } from 'zod';
import { HomepageAdSchema } from '../../../../../types/index.js';

export const HomepageAdExample = [
	{
		url: 'https://example.com',
		imgSrc: 'https://example.com/ad.jpg',
		background: '#FFFFFF',
	},
] satisfies Array<z.output<typeof HomepageAdSchema>>;