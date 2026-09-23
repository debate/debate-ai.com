/**
 * debate-tournaments overlay — replaces upstream's `api/helpers/logger.js`.
 *
 * Upstream logs through winston (file + console transports, `os.hostname()`),
 * none of which exist on Workers. Same exports over `console`, which Workers
 * Logs captures.
 */
import { tabroomConfig } from '../../../../../src/config.js';

const LEVELS = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];

const enabled = (level) => LEVELS.indexOf(level) <= LEVELS.indexOf(tabroomConfig.logging.level);

const write = (level, method) => (...args) => {
	if (enabled(level)) console[method]('[tabroom]', ...args);
};

const logger = {
	error: write('error', 'error'),
	warn: write('warn', 'warn'),
	info: write('info', 'info'),
	http: write('http', 'info'),
	verbose: write('verbose', 'debug'),
	debug: write('debug', 'debug'),
	silly: write('silly', 'debug'),
	log: (level, ...args) => write(level, 'log')(...args),
	progress: (msg) => write('info', 'info')(msg),
	progressEnd: (msg) => write('info', 'info')(msg),
	child: () => logger,
};

export function logDB() {}

export const setupRequest = (_req, _res, next) => next();

export default logger;
