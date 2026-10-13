import sanitizeHtml from 'sanitize-html';

export const addZero = (i) => {
	if (i < 10) {
		i = `0${i}`;
	}
	return i;
};

// one of the things I miss from Perl tbh
export const ucfirst = (lowered) => {
	return String(lowered).charAt(0).toUpperCase() + String(lowered).slice(1);
};

export const lcfirst = (lowered) => {
	return String(lowered).charAt(0).toLowerCase() + String(lowered).slice(1);
};

export const eventType = (rawType) => {
	if (rawType === 'mock_trial') return 'Mock Trial';
	if (rawType === 'wsdc') return 'World Schools';
	if (rawType === 'wudc') return 'British Parliamentary';
	return ucfirst(rawType);
};

export const publishLevel = (keyLevel) => {
	if (keyLevel == 1) return 'full';
	if (keyLevel == 2) return 'noJudges';
	if (keyLevel == 3) return 'entryList';
	if (keyLevel == 4) return 'thisPageIntentionallyLeftBlank';
	if (keyLevel == 5) return 'prelimChambers';
};

export const snakeToCamel = (snaked) => {
	if (!snaked || !snaked.toLowerCase) return;
	return snaked.toLowerCase()
		.replace(/([-_][a-z])/g, (group) => {
			return group.toUpperCase().replace('-', '').replace('_', '');
		});
};

export const dbToObject = (object, tag, options = {}) => {
	let newObject = {};
	const oldObject = { ...object };

	Object.keys(oldObject).forEach( (key) => {
		if (key.includes(tag)) {
			const newTag = snakeToCamel(lcfirst(key.replace(tag, '')));
			newObject[newTag] = oldObject[key];
			delete oldObject[key];
		}
	});

	if (!options.keepNulls) newObject = stripNulls(newObject);
	if (options.justTag) return newObject;

	oldObject[ucfirst(tag)] = newObject;
	return oldObject;
};

export const stripNulls = (target, exclude = []) => {
	const returnObject = { ...target };
	Object.keys(returnObject).forEach( (key) => {
		if (
			!exclude.includes[key]
			&& !returnObject[key] || returnObject[key] === 'null'
		) {
			delete returnObject[key];
		}
	});
	return returnObject;
};

export function profanityCheck(text) {
	const naughtyWords = [
		'fuck',
		'f u c k',
		'fucker',
		'fuckee',
		'phuck',
		'p h u c k',
		'motherfucker',
		'motherphucker',
		'asshole',
		'shit',
		'bullshit',
		'faggot',
		'fag',
		'dyke',
		'kike',
		'pussy',
		'pussies',
		'goatse',
		'crip',
		'tard',
		'retard',
		'cunt',
		'cuntbag',
	];
	const found = [];
	naughtyWords.forEach((word) => {
		if (text.toLowerCase().includes(word)) {
			found.push(word);
		}
	});
	return found;
}
// The tags and attributes classic's rich text editor allows (funclib/save_editor.mas)
const EDITOR_HTML = {
	a: ['href', 'target'],
	b: [],
	caption: [],
	h2: [],
	h3: [],
	h4: [],
	h5: [],
	h6: [],
	center: [],
	em: [],
	i: [],
	img: ['alt', 'border', 'height', 'width', 'src', 'style'],
	li: [],
	ol: [],
	p: ['style'],
	span: ['style'],
	strong: [],
	s: [],
	sub: [],
	sup: [],
	table: ['style', 'border', 'cellspacing', 'cellpadding', 'align'],
	tbody: [],
	td: [],
	tr: [],
	br: [],
	u: [],
	ul: [],
};

// save_editor.mas's restrictive rules, used for paradigms: no links, images, headings or spans
const RESTRICTIVE_EDITOR_HTML = {
	b: [],
	caption: [],
	center: [],
	em: [],
	i: [],
	li: [],
	ol: [],
	p: ['style'],
	strong: [],
	s: [],
	sub: [],
	sup: [],
	table: ['style', 'border', 'cellspacing', 'cellpadding', 'align'],
	tbody: [],
	td: [],
	tr: [],
	br: [],
	u: [],
	ul: [],
};

/**
 * sanitizes an html string. modify this function to change defaults everywhere.
 * Defaults to classic's editor rules: other tags are dropped but their text is kept, and
 * links can only be http, https or relative. restrictive uses classic's paradigm rules
 * @param {string} input
 * @param {{ restrictive?: boolean } & import('sanitize-html').IOptions} [opts]
 * @returns {string}
 */
export function sanitizeHTML(input, { restrictive = false, ...opts } = {}) {
	const allowed = restrictive ? RESTRICTIVE_EDITOR_HTML : EDITOR_HTML;

	return sanitizeHtml(input, {
		allowedTags: Object.keys(allowed),
		allowedAttributes: allowed,
		allowedSchemes: ['http', 'https'],
		...opts,
	});
}
export default addZero;
