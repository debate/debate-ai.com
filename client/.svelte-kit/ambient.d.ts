
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * Environment variables [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env`. Like [`$env/dynamic/private`](https://kit.svelte.dev/docs/modules#$env-dynamic-private), this module cannot be imported into client-side code. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://kit.svelte.dev/docs/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://kit.svelte.dev/docs/configuration#env) (if configured).
 * 
 * _Unlike_ [`$env/dynamic/private`](https://kit.svelte.dev/docs/modules#$env-dynamic-private), the values exported from this module are statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * ```ts
 * import { API_KEY } from '$env/static/private';
 * ```
 * 
 * Note that all environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * 
 * ```
 * MY_FEATURE_FLAG=""
 * ```
 * 
 * You can override `.env` values from the command line like so:
 * 
 * ```bash
 * MY_FEATURE_FLAG="enabled" npm run dev
 * ```
 */
declare module '$env/static/private' {
	export const npm_package_devDependencies_autoprefixer: string;
	export const npm_package_dependencies__sveltejs_adapter_node: string;
	export const npm_package_scripts_check_watch: string;
	export const npm_package_devDependencies_eslint: string;
	export const INIT_CWD: string;
	export const PATH: string;
	export const npm_package_devDependencies_prettier: string;
	export const OMF_CONFIG: string;
	export const PNPM_HOME: string;
	export const npm_lifecycle_script: string;
	export const SSH_CLIENT: string;
	export const npm_config_registry: string;
	export const BUN_INSTALL: string;
	export const LANG: string;
	export const npm_execpath: string;
	export const NVM_BIN: string;
	export const npm_package_json: string;
	export const SHELL: string;
	export const SSH_CONNECTION: string;
	export const npm_package_dependencies_pocketbase: string;
	export const npm_package_devDependencies_prettier_plugin_svelte: string;
	export const npm_package_private: string;
	export const LOGNAME: string;
	export const STARSHIP_SHELL: string;
	export const npm_package_devDependencies__sveltejs_adapter_auto: string;
	export const npm_command: string;
	export const XDG_SESSION_ID: string;
	export const npm_package_name: string;
	export const XDG_SESSION_TYPE: string;
	export const MOTD_SHOWN: string;
	export const NVM_DIR: string;
	export const npm_package_devDependencies_svelte: string;
	export const npm_node_execpath: string;
	export const npm_package_scripts_check: string;
	export const npm_package_devDependencies_typescript: string;
	export const npm_package_scripts_lint: string;
	export const npm_package_type: string;
	export const TERM: string;
	export const npm_config_node_gyp: string;
	export const npm_package_devDependencies__typescript_eslint_eslint_plugin: string;
	export const npm_package_scripts_dev: string;
	export const XDG_DATA_DIRS: string;
	export const npm_config_local_prefix: string;
	export const npm_package_devDependencies__sveltejs_kit: string;
	export const npm_package_devDependencies_svelte_check: string;
	export const ip: string;
	export const npm_package_devDependencies_tslib: string;
	export const PWD: string;
	export const npm_package_scripts_format: string;
	export const XDG_SESSION_CLASS: string;
	export const npm_lifecycle_event: string;
	export const npm_package_devDependencies_postcss: string;
	export const npm_package_devDependencies_eslint_plugin_svelte3: string;
	export const HOME: string;
	export const PNPM_SCRIPT_SRC_DIR: string;
	export const npm_package_dependencies_vite: string;
	export const USER: string;
	export const npm_package_devDependencies_eslint_config_prettier: string;
	export const npm_config_user_agent: string;
	export const SHLVL: string;
	export const NVM_INC: string;
	export const STARSHIP_SESSION_KEY: string;
	export const npm_package_devDependencies_tailwindcss: string;
	export const npm_package_scripts_preview: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const OMF_PATH: string;
	export const npm_package_scripts_build: string;
	export const SSH_TTY: string;
	export const XDG_RUNTIME_DIR: string;
	export const npm_package_devDependencies__typescript_eslint_parser: string;
	export const npm_package_version: string;
	export const NODE_PATH: string;
	export const NODE: string;
}

/**
 * Similar to [`$env/static/private`](https://kit.svelte.dev/docs/modules#$env-static-private), except that it only includes environment variables that begin with [`config.kit.env.publicPrefix`](https://kit.svelte.dev/docs/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Values are replaced statically at build time.
 * 
 * ```ts
 * import { PUBLIC_BASE_URL } from '$env/static/public';
 * ```
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to runtime environment variables, as defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/master/packages/adapter-node) (or running [`vite preview`](https://kit.svelte.dev/docs/cli)), this is equivalent to `process.env`. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://kit.svelte.dev/docs/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://kit.svelte.dev/docs/configuration#env) (if configured).
 * 
 * This module cannot be imported into client-side code.
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * console.log(env.DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 * 
 * > In `dev`, `$env/dynamic` always includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 */
declare module '$env/dynamic/private' {
	export const env: {
		npm_package_devDependencies_autoprefixer: string;
		npm_package_dependencies__sveltejs_adapter_node: string;
		npm_package_scripts_check_watch: string;
		npm_package_devDependencies_eslint: string;
		INIT_CWD: string;
		PATH: string;
		npm_package_devDependencies_prettier: string;
		OMF_CONFIG: string;
		PNPM_HOME: string;
		npm_lifecycle_script: string;
		SSH_CLIENT: string;
		npm_config_registry: string;
		BUN_INSTALL: string;
		LANG: string;
		npm_execpath: string;
		NVM_BIN: string;
		npm_package_json: string;
		SHELL: string;
		SSH_CONNECTION: string;
		npm_package_dependencies_pocketbase: string;
		npm_package_devDependencies_prettier_plugin_svelte: string;
		npm_package_private: string;
		LOGNAME: string;
		STARSHIP_SHELL: string;
		npm_package_devDependencies__sveltejs_adapter_auto: string;
		npm_command: string;
		XDG_SESSION_ID: string;
		npm_package_name: string;
		XDG_SESSION_TYPE: string;
		MOTD_SHOWN: string;
		NVM_DIR: string;
		npm_package_devDependencies_svelte: string;
		npm_node_execpath: string;
		npm_package_scripts_check: string;
		npm_package_devDependencies_typescript: string;
		npm_package_scripts_lint: string;
		npm_package_type: string;
		TERM: string;
		npm_config_node_gyp: string;
		npm_package_devDependencies__typescript_eslint_eslint_plugin: string;
		npm_package_scripts_dev: string;
		XDG_DATA_DIRS: string;
		npm_config_local_prefix: string;
		npm_package_devDependencies__sveltejs_kit: string;
		npm_package_devDependencies_svelte_check: string;
		ip: string;
		npm_package_devDependencies_tslib: string;
		PWD: string;
		npm_package_scripts_format: string;
		XDG_SESSION_CLASS: string;
		npm_lifecycle_event: string;
		npm_package_devDependencies_postcss: string;
		npm_package_devDependencies_eslint_plugin_svelte3: string;
		HOME: string;
		PNPM_SCRIPT_SRC_DIR: string;
		npm_package_dependencies_vite: string;
		USER: string;
		npm_package_devDependencies_eslint_config_prettier: string;
		npm_config_user_agent: string;
		SHLVL: string;
		NVM_INC: string;
		STARSHIP_SESSION_KEY: string;
		npm_package_devDependencies_tailwindcss: string;
		npm_package_scripts_preview: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		OMF_PATH: string;
		npm_package_scripts_build: string;
		SSH_TTY: string;
		XDG_RUNTIME_DIR: string;
		npm_package_devDependencies__typescript_eslint_parser: string;
		npm_package_version: string;
		NODE_PATH: string;
		NODE: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * Similar to [`$env/dynamic/private`](https://kit.svelte.dev/docs/modules#$env-dynamic-private), but only includes variables that begin with [`config.kit.env.publicPrefix`](https://kit.svelte.dev/docs/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Note that public dynamic environment variables must all be sent from the server to the client, causing larger network requests — when possible, use `$env/static/public` instead.
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.PUBLIC_DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
