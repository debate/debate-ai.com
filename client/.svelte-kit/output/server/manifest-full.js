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
		client: {"start":"_app/immutable/entry/start.27b9407d.js","app":"_app/immutable/entry/app.2858cb00.js","imports":["_app/immutable/entry/start.27b9407d.js","_app/immutable/chunks/index.bc524795.js","_app/immutable/chunks/singletons.94755e63.js","_app/immutable/chunks/index.ae762af0.js","_app/immutable/entry/app.2858cb00.js","_app/immutable/chunks/index.bc524795.js"],"stylesheets":[],"fonts":[]},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js')),
			__memo(() => import('./nodes/8.js')),
			__memo(() => import('./nodes/9.js'))
		],
		routes: [
			{
				id: "/auth",
				pattern: /^\/auth\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/auth/login",
				pattern: /^\/auth\/login\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/auth/register",
				pattern: /^\/auth\/register\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/home",
				pattern: /^\/home\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/user/[userid]",
				pattern: /^\/user\/([^/]+?)\/?$/,
				params: [{"name":"userid","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,4,], errors: [1,,], leaf: 9 },
				endpoint: null
			}
		],
		matchers: async () => {
			
			return {  };
		}
	}
}
})();
