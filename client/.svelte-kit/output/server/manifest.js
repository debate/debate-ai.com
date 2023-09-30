export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["confetti.svg","report.svg","hide.svg","globe.svg","trash-can-red.svg","heart.svg","backdrop.png","friends-color.svg","sign-out.svg","followed.svg","follow.svg","help.svg","backdrop2.png","message.svg","send.svg","verified.svg","globe-color.svg","comment.svg","placeholder-logo.svg","chevron.svg","show.svg","favicon.png","profile.svg","friends.svg","close.svg","gear.svg","edit.svg","trash-can.svg","bell.svg","spinner.svg","dots.svg","chevron-right.svg","heart-full.svg"]),
	mimeTypes: {".svg":"image/svg+xml",".png":"image/png"},
	_: {
		client: {"start":"_app/immutable/entry/start.8a015603.js","app":"_app/immutable/entry/app.eaa7f129.js","imports":["_app/immutable/entry/start.8a015603.js","_app/immutable/chunks/index.13108eec.js","_app/immutable/chunks/singletons.32b3f4f7.js","_app/immutable/chunks/index.889e570a.js","_app/immutable/entry/app.eaa7f129.js","_app/immutable/chunks/index.13108eec.js"],"stylesheets":[],"fonts":[]},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js'))
		],
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/user/callback",
				pattern: /^\/user\/callback\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/user/callback/_server.js'))
			},
			{
				id: "/user/[userid]",
				pattern: /^\/user\/([^/]+?)\/?$/,
				params: [{"name":"userid","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			}
		],
		matchers: async () => {
			
			return {  };
		}
	}
}
})();
