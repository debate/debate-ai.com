

import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {

		// const email = data.get('email');
		// const password = data.get('password');

		return json({request});

}

/** @type {import('./$types').RequestHandler} */
export function GET({ url }) {
	const min = Number(url.searchParams.get('min') ?? '0');
	const max = Number(url.searchParams.get('max') ?? '1');

	const d = max - min;

	
	const random = min + Math.random() * d;

	return json({random});
}

