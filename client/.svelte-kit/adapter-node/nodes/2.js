

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/2.6995aa10.js","_app/immutable/chunks/index.13108eec.js","_app/immutable/chunks/pocketbase.36d0cda3.js","_app/immutable/chunks/index.889e570a.js","_app/immutable/chunks/HoverDropdown.f8215f3d.js"];
export const stylesheets = [];
export const fonts = [];
