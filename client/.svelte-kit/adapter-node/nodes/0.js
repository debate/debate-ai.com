

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.89d66d07.js","_app/immutable/chunks/index.13108eec.js","_app/immutable/chunks/pocketbase.36d0cda3.js","_app/immutable/chunks/index.889e570a.js"];
export const stylesheets = ["_app/immutable/assets/0.1515a618.css"];
export const fonts = [];
