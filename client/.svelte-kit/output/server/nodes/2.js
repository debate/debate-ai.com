

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/auth/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/2.889ea19f.js","_app/immutable/chunks/index.bc524795.js"];
export const stylesheets = ["_app/immutable/assets/2.a158a771.css","_app/immutable/assets/app.d8abaefd.css"];
export const fonts = [];
