import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';
import commonjs from 'vite-plugin-commonjs'
const config: UserConfig = {
	plugins: [
		sveltekit()
	],  legacy: { buildSsrCjsExternalHeuristics: true },
	ssr: { noExternal: ['@framework7-svelte/**'] }

};

export default config;
