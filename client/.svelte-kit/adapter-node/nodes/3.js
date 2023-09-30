

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/user/_userid_/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/3.37c240be.js","_app/immutable/chunks/index.13108eec.js","_app/immutable/chunks/pocketbase.36d0cda3.js","_app/immutable/chunks/index.889e570a.js","_app/immutable/chunks/stores.14178e32.js","_app/immutable/chunks/singletons.32b3f4f7.js","_app/immutable/chunks/HoverDropdown.f8215f3d.js"];
export const stylesheets = [];
export const fonts = [];
