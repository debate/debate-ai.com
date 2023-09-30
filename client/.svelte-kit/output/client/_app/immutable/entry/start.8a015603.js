import{o as we,t as _e}from"../chunks/index.13108eec.js";import{S as Ke,a as We,I as q,g as Me,f as He,b as ye,c as le,s as ee,i as ve,d as H,e as B,P as Ve,h as tt}from"../chunks/singletons.32b3f4f7.js";function nt(t,r){return t==="/"||r==="ignore"?t:r==="never"?t.endsWith("/")?t.slice(0,-1):t:r==="always"&&!t.endsWith("/")?t+"/":t}function at(t){return t.split("%25").map(decodeURI).join("%25")}function rt(t){for(const r in t)t[r]=decodeURIComponent(t[r]);return t}const ot=["href","pathname","search","searchParams","toString","toJSON"];function it(t,r){const o=new URL(t);for(const i of ot)Object.defineProperty(o,i,{get(){return r(),t[i]},enumerable:!0,configurable:!0});return st(o),o}function st(t){Object.defineProperty(t,"hash",{get(){throw new Error("Cannot access event.url.hash. Consider using `$page.url.hash` inside a component instead")}})}const ct="/__data.json";function lt(t){return t.replace(/\/$/,"")+ct}function ft(...t){let r=5381;for(const o of t)if(typeof o=="string"){let i=o.length;for(;i;)r=r*33^o.charCodeAt(--i)}else if(ArrayBuffer.isView(o)){const i=new Uint8Array(o.buffer,o.byteOffset,o.byteLength);let d=i.length;for(;d;)r=r*33^i[--d]}else throw new TypeError("value must be a string or TypedArray");return(r>>>0).toString(36)}let Re=0;const fe=window.fetch;function ut(){Re+=1}function dt(){Re-=1}{let t=!1;(async()=>{t=new Error().stack.includes("check_stack_trace")})(),window.fetch=(o,i)=>{const d=o instanceof Request?o.url:o.toString(),u=new Error().stack.split(`
`),v=u.findIndex(h=>h.includes("load@")||h.includes("at load")),l=u.slice(0,v+2).join(`
`);return(t?l.includes("src/runtime/client/client.js"):Re)&&console.warn(`Loading ${d} using \`window.fetch\`. For best results, use the \`fetch\` that is passed to your \`load\` function: https://kit.svelte.dev/docs/load#making-fetch-requests`),(o instanceof Request?o.method:(i==null?void 0:i.method)||"GET")!=="GET"&&ne.delete(Ae(o)),fe(o,i)}}const ne=new Map;function pt(t,r){const o=Ae(t,r),i=document.querySelector(o);if(i!=null&&i.textContent){const{body:d,...u}=JSON.parse(i.textContent),v=i.getAttribute("data-ttl");return v&&ne.set(o,{body:d,init:u,ttl:1e3*Number(v)}),Promise.resolve(new Response(d,u))}return fe(t,r)}function ht(t,r,o){if(ne.size>0){const i=Ae(t,o),d=ne.get(i);if(d){if(performance.now()<d.ttl&&["default","force-cache","only-if-cached",void 0].includes(o==null?void 0:o.cache))return new Response(d.body,d.init);ne.delete(i)}}return fe(r,o)}function Ae(t,r){let i=`script[data-sveltekit-fetched][data-url=${JSON.stringify(t instanceof Request?t.url:t)}]`;if(r!=null&&r.headers||r!=null&&r.body){const d=[];r.headers&&d.push([...new Headers(r.headers)].join(",")),r.body&&(typeof r.body=="string"||ArrayBuffer.isView(r.body))&&d.push(r.body),i+=`[data-hash="${ft(...d)}"]`}return i}const gt=/^(\[)?(\.\.\.)?(\w+)(?:=(\w+))?(\])?$/;function mt(t){const r=[];return{pattern:t==="/"?/^\/$/:new RegExp(`^${_t(t).map(i=>{const d=/^\[\.\.\.(\w+)(?:=(\w+))?\]$/.exec(i);if(d)return r.push({name:d[1],matcher:d[2],optional:!1,rest:!0,chained:!0}),"(?:/(.*))?";const u=/^\[\[(\w+)(?:=(\w+))?\]\]$/.exec(i);if(u)return r.push({name:u[1],matcher:u[2],optional:!0,rest:!1,chained:!0}),"(?:/([^/]+))?";if(!i)return;const v=i.split(/\[(.+?)\](?!\])/);return"/"+v.map((g,m)=>{if(m%2){if(g.startsWith("x+"))return be(String.fromCharCode(parseInt(g.slice(2),16)));if(g.startsWith("u+"))return be(String.fromCharCode(...g.slice(2).split("-").map(O=>parseInt(O,16))));const h=gt.exec(g);if(!h)throw new Error(`Invalid param: ${g}. Params and matcher names can only have underscores and alphanumeric characters.`);const[,j,x,S,T]=h;return r.push({name:S,matcher:T,optional:!!j,rest:!!x,chained:x?m===1&&v[0]==="":!1}),x?"(.*?)":j?"([^/]*)?":"([^/]+?)"}return be(g)}).join("")}).join("")}/?$`),params:r}}function wt(t){return!/^\([^)]+\)$/.test(t)}function _t(t){return t.slice(1).split("/").filter(wt)}function yt(t,r,o){const i={},d=t.slice(1),u=d.filter(l=>l!==void 0);let v=0;for(let l=0;l<r.length;l+=1){const g=r[l];let m=d[l-v];if(g.chained&&g.rest&&v&&(m=d.slice(l-v,l+1).filter(h=>h).join("/"),v=0),m===void 0){g.rest&&(i[g.name]="");continue}if(!g.matcher||o[g.matcher](m)){i[g.name]=m;const h=r[l+1],j=d[l+1];h&&!h.rest&&h.optional&&j&&g.chained&&(v=0),!h&&!j&&Object.keys(i).length===u.length&&(v=0);continue}if(g.optional&&g.chained){v++;continue}return}if(!v)return i}function be(t){return t.normalize().replace(/[[\]]/g,"\\$&").replace(/%/g,"%25").replace(/\//g,"%2[Ff]").replace(/\?/g,"%3[Ff]").replace(/#/g,"%23").replace(/[.*+?^${}()|\\]/g,"\\$&")}function vt({nodes:t,server_loads:r,dictionary:o,matchers:i}){const d=new Set(r);return Object.entries(o).map(([l,[g,m,h]])=>{const{pattern:j,params:x}=mt(l),S={id:l,exec:T=>{const O=j.exec(T);if(O)return yt(O,x,i)},errors:[1,...h||[]].map(T=>t[T]),layouts:[0,...m||[]].map(v),leaf:u(g)};return S.errors.length=S.layouts.length=Math.max(S.errors.length,S.layouts.length),S});function u(l){const g=l<0;return g&&(l=~l),[g,t[l]]}function v(l){return l===void 0?l:[d.has(l),t[l]]}}function Ye(t){try{return JSON.parse(sessionStorage[t])}catch{}}function Ge(t,r){const o=JSON.stringify(r);try{sessionStorage[t]=o}catch{}}const bt=-1,Et=-2,kt=-3,St=-4,Rt=-5,At=-6;function $t(t,r){if(typeof t=="number")return d(t,!0);if(!Array.isArray(t)||t.length===0)throw new Error("Invalid input");const o=t,i=Array(o.length);function d(u,v=!1){if(u===bt)return;if(u===kt)return NaN;if(u===St)return 1/0;if(u===Rt)return-1/0;if(u===At)return-0;if(v)throw new Error("Invalid input");if(u in i)return i[u];const l=o[u];if(!l||typeof l!="object")i[u]=l;else if(Array.isArray(l))if(typeof l[0]=="string"){const g=l[0],m=r==null?void 0:r[g];if(m)return i[u]=m(d(l[1]));switch(g){case"Date":i[u]=new Date(l[1]);break;case"Set":const h=new Set;i[u]=h;for(let S=1;S<l.length;S+=1)h.add(d(l[S]));break;case"Map":const j=new Map;i[u]=j;for(let S=1;S<l.length;S+=2)j.set(d(l[S]),d(l[S+1]));break;case"RegExp":i[u]=new RegExp(l[1],l[2]);break;case"Object":i[u]=Object(l[1]);break;case"BigInt":i[u]=BigInt(l[1]);break;case"null":const x=Object.create(null);i[u]=x;for(let S=1;S<l.length;S+=2)x[l[S]]=d(l[S+1]);break;default:throw new Error(`Unknown type ${g}`)}}else{const g=new Array(l.length);i[u]=g;for(let m=0;m<l.length;m+=1){const h=l[m];h!==Et&&(g[m]=d(h))}}else{const g={};i[u]=g;for(const m in l){const h=l[m];g[m]=d(h)}}return i[u]}return d(0)}function It(t){return t.filter(r=>r!=null)}function Pt(t){function r(o,i){if(o)for(const d in o){if(d[0]==="_"||t.has(d))continue;const u=[...t.values()],v=Lt(d,i==null?void 0:i.slice(i.lastIndexOf(".")))??`valid exports are ${u.join(", ")}, or anything with a '_' prefix`;throw new Error(`Invalid export '${d}'${i?` in ${i}`:""} (${v})`)}}return r}function Lt(t,r=".js"){const o=[];if($e.has(t)&&o.push(`+layout${r}`),Xe.has(t)&&o.push(`+page${r}`),Ze.has(t)&&o.push(`+layout.server${r}`),Ot.has(t)&&o.push(`+page.server${r}`),jt.has(t)&&o.push(`+server${r}`),o.length>0)return`'${t}' is a valid export in ${o.slice(0,-1).join(", ")}${o.length>1?" or ":""}${o.at(-1)}`}const $e=new Set(["load","prerender","csr","ssr","trailingSlash","config"]),Xe=new Set([...$e,"entries"]),Ze=new Set([...$e]),Ot=new Set([...Ze,"actions","entries"]),jt=new Set(["GET","POST","PATCH","PUT","DELETE","OPTIONS","HEAD","fallback","prerender","trailingSlash","config","entries"]),xt=Pt(Xe);async function Tt(t){var r;for(const o in t)if(typeof((r=t[o])==null?void 0:r.then)=="function")return Object.fromEntries(await Promise.all(Object.entries(t).map(async([i,d])=>[i,await d])));return t}class te{constructor(r,o){this.status=r,typeof o=="string"?this.body={message:o}:o?this.body=o:this.body={message:`Error: ${r}`}}toString(){return JSON.stringify(this.body)}}class ze{constructor(r,o){this.status=r,this.location=o}}function Ut(t,r){const o=/^(moz-icon|view-source|jar):/.exec(r);o&&console.warn(`${t}: Calling \`depends('${r}')\` will throw an error in Firefox because \`${o[1]}\` is a special URI scheme`)}const Ee="x-sveltekit-invalidated",Nt="x-sveltekit-trailing-slash",J=Ye(Ke)??{},Q=Ye(We)??{};function ke(t){J[t]=ee()}function Ct(t,r){var De;const o=vt(t),i=t.nodes[0],d=t.nodes[1];i(),d();const u=document.documentElement,v=[],l=[];let g=null;const m={before_navigate:[],on_navigate:[],after_navigate:[]};let h={branch:[],error:null,url:null},j=!1,x=!1,S=!0,T=!1,O=!1,V=!1,G=!1,F,C=(De=history.state)==null?void 0:De[q];C||(C=Date.now(),history.replaceState({...history.state,[q]:C},"",location.href));const ue=J[C];ue&&(history.scrollRestoration="manual",scrollTo(ue.x,ue.y));let M,ae,W;async function Ie(){if(W=W||Promise.resolve(),await W,!W)return;W=null;const e=new URL(location.href),c=X(e,!0);g=null;const n=ae={},s=c&&await he(c);if(n===ae&&s){if(s.type==="redirect")return re(new URL(s.location,e).href,{},[e.pathname],n);s.props.page!==void 0&&(M=s.props.page),F.$set(s.props)}}function Pe(e){l.some(c=>c==null?void 0:c.snapshot)&&(Q[e]=l.map(c=>{var n;return(n=c==null?void 0:c.snapshot)==null?void 0:n.capture()}))}function Le(e){var c;(c=Q[e])==null||c.forEach((n,s)=>{var a,f;(f=(a=l[s])==null?void 0:a.snapshot)==null||f.restore(n)})}function Oe(){ke(C),Ge(Ke,J),Pe(C),Ge(We,Q)}async function re(e,{noScroll:c=!1,replaceState:n=!1,keepFocus:s=!1,state:a={},invalidateAll:f=!1},p,b){return typeof e=="string"&&(e=new URL(e,Me(document))),ce({url:e,scroll:c?ee():null,keepfocus:s,redirect_chain:p,details:{state:a,replaceState:n},nav_token:b,accepted:()=>{f&&(G=!0)},blocked:()=>{},type:"goto"})}async function je(e){return g={id:e.id,promise:he(e).then(c=>(c.type==="loaded"&&c.state.error&&(g=null),c))},g.promise}async function oe(...e){const n=o.filter(s=>e.some(a=>s.exec(a))).map(s=>Promise.all([...s.layouts,s.leaf].map(a=>a==null?void 0:a[1]())));await Promise.all(n)}function xe(e){var s;if(e.state.error&&document.querySelector("vite-error-overlay"))return;h=e.state;const c=document.querySelector("style[data-sveltekit]");c&&c.remove(),M=e.props.page,F=new t.root({target:r,props:{...e.props,stores:H,components:l},hydrate:!0}),Le(C);const n={from:null,to:{params:h.params,route:{id:((s=h.route)==null?void 0:s.id)??null},url:new URL(location.href)},willUnload:!1,type:"enter",complete:Promise.resolve()};m.after_navigate.forEach(a=>a(n)),x=!0}async function Y({url:e,params:c,branch:n,status:s,error:a,route:f,form:p}){let b="never";for(const w of n)(w==null?void 0:w.slash)!==void 0&&(b=w.slash);e.pathname=nt(e.pathname,b),e.search=e.search;const E={type:"loaded",state:{url:e,params:c,branch:n,error:a,route:f},props:{constructors:It(n).map(w=>w.node.component)}};p!==void 0&&(E.props.form=p);let y={},I=!M,A=0;for(let w=0;w<Math.max(n.length,h.branch.length);w+=1){const _=n[w],L=h.branch[w];(_==null?void 0:_.data)!==(L==null?void 0:L.data)&&(I=!0),_&&(y={...y,..._.data},I&&(E.props[`data_${A}`]=y),A+=1)}return(!h.url||e.href!==h.url.href||h.error!==a||p!==void 0&&p!==M.form||I)&&(E.props.page={error:a,params:c,route:{id:(f==null?void 0:f.id)??null},status:s,url:new URL(e),form:p??null,data:I?y:M.data}),E}async function de({loader:e,parent:c,url:n,params:s,route:a,server_data_node:f}){var y,I,A;let p=null;const b={dependencies:new Set,params:new Set,parent:!1,route:!1,url:!1},E=await e();if(xt(E.universal),(y=E.universal)!=null&&y.load){let P=function(..._){for(const L of _){Ut(a.id,L);const{href:U}=new URL(L,n);b.dependencies.add(U)}};const w={route:new Proxy(a,{get:(_,L)=>(b.route=!0,_[L])}),params:new Proxy(s,{get:(_,L)=>(b.params.add(L),_[L])}),data:(f==null?void 0:f.data)??null,url:it(n,()=>{b.url=!0}),async fetch(_,L){let U;_ instanceof Request?(U=_.url,L={body:_.method==="GET"||_.method==="HEAD"?void 0:await _.blob(),cache:_.cache,credentials:_.credentials,headers:_.headers,integrity:_.integrity,keepalive:_.keepalive,method:_.method,mode:_.mode,redirect:_.redirect,referrer:_.referrer,referrerPolicy:_.referrerPolicy,signal:_.signal,...L}):U=_;const D=new URL(U,n);return P(D.href),D.origin===n.origin&&(U=D.href.slice(n.origin.length)),x?ht(U,D.href,L):pt(U,L)},setHeaders:()=>{},depends:P,parent(){return b.parent=!0,c()}};try{if(ut(),p=await E.universal.load.call(null,w)??null,p!=null&&Object.getPrototypeOf(p)!==Object.prototype)throw new Error(`a load function related to route '${a.id}' returned ${typeof p!="object"?`a ${typeof p}`:p instanceof Response?"a Response object":Array.isArray(p)?"an array":"a non-plain object"}, but must return a plain object at the top level (i.e. \`return {...}\`)`)}finally{dt()}p=p?await Tt(p):null}return{node:E,loader:e,server:f,universal:(I=E.universal)!=null&&I.load?{type:"data",data:p,uses:b}:null,data:p??(f==null?void 0:f.data)??null,slash:((A=E.universal)==null?void 0:A.trailingSlash)??(f==null?void 0:f.slash)}}function Te(e,c,n,s,a){if(G)return!0;if(!s)return!1;if(s.parent&&e||s.route&&c||s.url&&n)return!0;for(const f of s.params)if(a[f]!==h.params[f])return!0;for(const f of s.dependencies)if(v.some(p=>p(new URL(f))))return!0;return!1}function pe(e,c){return(e==null?void 0:e.type)==="data"?e:(e==null?void 0:e.type)==="skip"?c??null:null}async function he({id:e,invalidating:c,url:n,params:s,route:a}){if((g==null?void 0:g.id)===e)return g.promise;const{errors:f,layouts:p,leaf:b}=a,E=[...p,b];f.forEach(k=>k==null?void 0:k().catch(()=>{})),E.forEach(k=>k==null?void 0:k[1]().catch(()=>{}));let y=null;const I=h.url?e!==h.url.pathname+h.url.search:!1,A=h.route?a.id!==h.route.id:!1;let P=!1;const w=E.map((k,$)=>{var z;const R=h.branch[$],N=!!(k!=null&&k[0])&&((R==null?void 0:R.loader)!==k[1]||Te(P,A,I,(z=R.server)==null?void 0:z.uses,s));return N&&(P=!0),N});if(w.some(Boolean)){try{y=await Be(n,w)}catch(k){return ie({status:k instanceof te?k.status:500,error:await Z(k,{url:n,params:s,route:{id:a.id}}),url:n,route:a})}if(y.type==="redirect")return y}const _=y==null?void 0:y.nodes;let L=!1;const U=E.map(async(k,$)=>{var ge;if(!k)return;const R=h.branch[$],N=_==null?void 0:_[$];if((!N||N.type==="skip")&&k[1]===(R==null?void 0:R.loader)&&!Te(L,A,I,(ge=R.universal)==null?void 0:ge.uses,s))return R;if(L=!0,(N==null?void 0:N.type)==="error")throw N;return de({loader:k[1],url:n,params:s,route:a,parent:async()=>{var Fe;const qe={};for(let me=0;me<$;me+=1)Object.assign(qe,(Fe=await U[me])==null?void 0:Fe.data);return qe},server_data_node:pe(N===void 0&&k[0]?{type:"skip"}:N??null,k[0]?R==null?void 0:R.server:void 0)})});for(const k of U)k.catch(()=>{});const D=[];for(let k=0;k<E.length;k+=1)if(E[k])try{D.push(await U[k])}catch($){if($ instanceof ze)return{type:"redirect",location:$.location};let R=500,N;if(_!=null&&_.includes($))R=$.status??R,N=$.error;else if($ instanceof te)R=$.status,N=$.body;else{if(await H.updated.check())return await K(n);N=await Z($,{params:s,url:n,route:{id:a.id}})}const z=await Ue(k,D,f);return z?await Y({url:n,params:s,branch:D.slice(0,z.idx).concat(z.node),status:R,error:N,route:a}):await Ce(n,{id:a.id},N,R)}else D.push(void 0);return await Y({url:n,params:s,branch:D,status:200,error:null,route:a,form:c?void 0:null})}async function Ue(e,c,n){for(;e--;)if(n[e]){let s=e;for(;!c[s];)s-=1;try{return{idx:s+1,node:{node:await n[e](),loader:n[e],data:{},server:null,universal:null}}}catch{continue}}}async function ie({status:e,error:c,url:n,route:s}){const a={};let f=null;if(t.server_loads[0]===0)try{const y=await Be(n,[!0]);if(y.type!=="data"||y.nodes[0]&&y.nodes[0].type!=="data")throw 0;f=y.nodes[0]??null}catch{(n.origin!==location.origin||n.pathname!==location.pathname||j)&&await K(n)}const b=await de({loader:i,url:n,params:a,route:s,parent:()=>Promise.resolve({}),server_data_node:pe(f)}),E={node:await d(),loader:d,universal:null,server:null,data:null};return await Y({url:n,params:a,branch:[b,E],status:e,error:c,route:null})}function X(e,c){if(ve(e,B))return;const n=se(e);for(const s of o){const a=s.exec(n);if(a)return{id:e.pathname+e.search,invalidating:c,route:s,params:rt(a),url:e}}}function se(e){return at(e.pathname.slice(B.length)||"/")}function Ne({url:e,type:c,intent:n,delta:s}){let a=!1;const f=Je(h,n,e,c);s!==void 0&&(f.navigation.delta=s);const p={...f.navigation,cancel:()=>{a=!0,f.reject(new Error("navigation was cancelled"))}};return O||m.before_navigate.forEach(b=>b(p)),a?null:f}async function ce({url:e,scroll:c,keepfocus:n,redirect_chain:s,details:a,type:f,delta:p,nav_token:b={},accepted:E,blocked:y}){var U,D,k;const I=X(e,!1),A=Ne({url:e,type:f,delta:p,intent:I});if(!A){y();return}const P=C;E(),O=!0,x&&H.navigating.set(A.navigation),ae=b;let w=I&&await he(I);if(!w){if(ve(e,B))return await K(e);w=await Ce(e,{id:null},await Z(new Error(`Not found: ${e.pathname}`),{url:e,params:{},route:{id:null}}),404)}if(e=(I==null?void 0:I.url)||e,ae!==b)return A.reject(new Error("navigation was aborted")),!1;if(w.type==="redirect")if(s.length>10||s.includes(e.pathname))w=await ie({status:500,error:await Z(new Error("Redirect loop"),{url:e,params:{},route:{id:null}}),url:e,route:{id:null}});else return re(new URL(w.location,e).href,{},[...s,e.pathname],b),!1;else((U=w.props.page)==null?void 0:U.status)>=400&&await H.updated.check()&&await K(e);if(v.length=0,G=!1,T=!0,ke(P),Pe(P),(D=w.props.page)!=null&&D.url&&w.props.page.url.pathname!==e.pathname&&(e.pathname=(k=w.props.page)==null?void 0:k.url.pathname),a){const $=a.replaceState?0:1;if(a.state[q]=C+=$,history[a.replaceState?"replaceState":"pushState"](a.state,"",e),!a.replaceState){let R=C+1;for(;Q[R]||J[R];)delete Q[R],delete J[R],R+=1}}if(g=null,x){h=w.state,w.props.page&&(w.props.page.url=e);const $=(await Promise.all(m.on_navigate.map(R=>R(A.navigation)))).filter(R=>typeof R=="function");if($.length>0){let R=function(){m.after_navigate=m.after_navigate.filter(N=>!$.includes(N))};$.push(R),m.after_navigate.push(...$)}F.$set(w.props)}else xe(w);const{activeElement:_}=document;if(await _e(),S){const $=e.hash&&document.getElementById(decodeURIComponent(e.hash.slice(1)));c?scrollTo(c.x,c.y):$?$.scrollIntoView():scrollTo(0,0)}const L=document.activeElement!==_&&document.activeElement!==document.body;!n&&!L&&Se(),S=!0,w.props.page&&(M=w.props.page),O=!1,f==="popstate"&&Le(C),A.fulfil(void 0),m.after_navigate.forEach($=>$(A.navigation)),H.navigating.set(null),T=!1}async function Ce(e,c,n,s){if(e.origin===location.origin&&e.pathname===location.pathname&&!j)return await ie({status:s,error:n,url:e,route:c});if(s!==404){console.error("An error occurred while loading the page. This will cause a full page reload. (This message will only appear during development.)");debugger}return await K(e)}function K(e){return location.href=e.href,new Promise(()=>{})}function et(){let e;u.addEventListener("mousemove",f=>{const p=f.target;clearTimeout(e),e=setTimeout(()=>{s(p,2)},20)});function c(f){s(f.composedPath()[0],1)}u.addEventListener("mousedown",c),u.addEventListener("touchstart",c,{passive:!0});const n=new IntersectionObserver(f=>{for(const p of f)p.isIntersecting&&(oe(se(new URL(p.target.href))),n.unobserve(p.target))},{threshold:0});function s(f,p){const b=He(f,u);if(!b)return;const{url:E,external:y,download:I}=ye(b,B);if(y||I)return;const A=le(b);if(!A.reload)if(p<=A.preload_data){const P=X(E,!1);P&&je(P).then(w=>{w.type==="loaded"&&w.state.error&&console.warn(`Preloading data for ${P.url.pathname} failed with the following error: ${w.state.error.message}
If this error is transient, you can ignore it. Otherwise, consider disabling preloading for this route. This route was preloaded due to a data-sveltekit-preload-data attribute. See https://kit.svelte.dev/docs/link-options for more info`)})}else p<=A.preload_code&&oe(se(E))}function a(){n.disconnect();for(const f of u.querySelectorAll("a")){const{url:p,external:b,download:E}=ye(f,B);if(b||E)continue;const y=le(f);y.reload||(y.preload_code===Ve.viewport&&n.observe(f),y.preload_code===Ve.eager&&oe(se(p)))}}m.after_navigate.push(a),a()}function Z(e,c){return e instanceof te?e.body:(console.warn("The next HMR update will cause the page to reload"),t.hooks.handleError({error:e,event:c})??{message:c.route.id!=null?"Internal Error":"Not Found"})}return{after_navigate:e=>{we(()=>(m.after_navigate.push(e),()=>{const c=m.after_navigate.indexOf(e);m.after_navigate.splice(c,1)}))},before_navigate:e=>{we(()=>(m.before_navigate.push(e),()=>{const c=m.before_navigate.indexOf(e);m.before_navigate.splice(c,1)}))},on_navigate:e=>{we(()=>(m.on_navigate.push(e),()=>{const c=m.on_navigate.indexOf(e);m.on_navigate.splice(c,1)}))},disable_scroll_handling:()=>{if(x&&!T)throw new Error("Can only disable scroll handling during navigation");(T||!x)&&(S=!1)},goto:(e,c={})=>re(e,c,[]),invalidate:e=>{if(typeof e=="function")v.push(e);else{const{href:c}=new URL(e,location.href);v.push(n=>n.href===c)}return Ie()},invalidate_all:()=>(G=!0,Ie()),preload_data:async e=>{const c=new URL(e,Me(document)),n=X(c,!1);if(!n)throw new Error(`Attempted to preload a URL that does not belong to this app: ${c}`);await je(n)},preload_code:oe,apply_action:async e=>{if(e.type==="error"){const c=new URL(location.href),{branch:n,route:s}=h;if(!s)return;const a=await Ue(h.branch.length,n,s.errors);if(a){const f=await Y({url:c,params:h.params,branch:n.slice(0,a.idx).concat(a.node),status:e.status??500,error:e.error,route:s});h=f.state,F.$set(f.props),_e().then(Se)}}else e.type==="redirect"?re(e.location,{invalidateAll:!0},[]):(F.$set({form:null,page:{...M,form:e.data,status:e.status}}),await _e(),F.$set({form:e.data}),e.type==="success"&&Se())},_start_router:()=>{var c;history.scrollRestoration="manual",addEventListener("beforeunload",n=>{let s=!1;if(Oe(),!O){const a=Je(h,void 0,null,"leave"),f={...a.navigation,cancel:()=>{s=!0,a.reject(new Error("navigation was cancelled"))}};m.before_navigate.forEach(p=>p(f))}s?(n.preventDefault(),n.returnValue=""):history.scrollRestoration="auto"}),addEventListener("visibilitychange",()=>{document.visibilityState==="hidden"&&Oe()}),(c=navigator.connection)!=null&&c.saveData||et(),u.addEventListener("click",n=>{var P;if(n.button||n.which!==1||n.metaKey||n.ctrlKey||n.shiftKey||n.altKey||n.defaultPrevented)return;const s=He(n.composedPath()[0],u);if(!s)return;const{url:a,external:f,target:p,download:b}=ye(s,B);if(!a)return;if(p==="_parent"||p==="_top"){if(window.parent!==window)return}else if(p&&p!=="_self")return;const E=le(s);if(!(s instanceof SVGAElement)&&a.protocol!==location.protocol&&!(a.protocol==="https:"||a.protocol==="http:")||b)return;if(f||E.reload){Ne({url:a,type:"link"})?O=!0:n.preventDefault();return}const[I,A]=a.href.split("#");if(A!==void 0&&I===location.href.split("#")[0]){if(h.url.hash===a.hash){n.preventDefault(),(P=s.ownerDocument.getElementById(A))==null||P.scrollIntoView();return}if(V=!0,ke(C),e(a),!E.replace_state)return;V=!1,n.preventDefault()}ce({url:a,scroll:E.noscroll?ee():null,keepfocus:E.keep_focus??!1,redirect_chain:[],details:{state:{},replaceState:E.replace_state??a.href===location.href},accepted:()=>n.preventDefault(),blocked:()=>n.preventDefault(),type:"link"})}),u.addEventListener("submit",n=>{if(n.defaultPrevented)return;const s=HTMLFormElement.prototype.cloneNode.call(n.target),a=n.submitter;if(((a==null?void 0:a.formMethod)||s.method)!=="get")return;const p=new URL((a==null?void 0:a.hasAttribute("formaction"))&&(a==null?void 0:a.formAction)||s.action);if(ve(p,B))return;const b=n.target,{keep_focus:E,noscroll:y,reload:I,replace_state:A}=le(b);if(I)return;n.preventDefault(),n.stopPropagation();const P=new FormData(b),w=a==null?void 0:a.getAttribute("name");w&&P.append(w,(a==null?void 0:a.getAttribute("value"))??""),p.search=new URLSearchParams(P).toString(),ce({url:p,scroll:y?ee():null,keepfocus:E??!1,redirect_chain:[],details:{state:{},replaceState:A??p.href===location.href},nav_token:{},accepted:()=>{},blocked:()=>{},type:"form"})}),addEventListener("popstate",async n=>{var s;if((s=n.state)!=null&&s[q]){if(n.state[q]===C)return;const a=J[n.state[q]];if(h.url.href.split("#")[0]===location.href.split("#")[0]){J[C]=ee(),C=n.state[q],scrollTo(a.x,a.y);return}const f=n.state[q]-C;await ce({url:new URL(location.href),scroll:a,keepfocus:!1,redirect_chain:[],details:null,accepted:()=>{C=n.state[q]},blocked:()=>{history.go(-f)},type:"popstate",delta:f})}else if(!V){const a=new URL(location.href);e(a)}}),addEventListener("hashchange",()=>{V&&(V=!1,history.replaceState({...history.state,[q]:++C},"",location.href))});for(const n of document.querySelectorAll("link"))n.rel==="icon"&&(n.href=n.href);addEventListener("pageshow",n=>{n.persisted&&H.navigating.set(null)});function e(n){h.url=n,H.page.set({...M,url:n}),H.page.notify()}},_hydrate:async({status:e=200,error:c,node_ids:n,params:s,route:a,data:f,form:p})=>{j=!0;const b=new URL(location.href);({params:s={},route:a={id:null}}=X(b,!1)||{});let E;try{const y=n.map(async(P,w)=>{const _=f[w];return _!=null&&_.uses&&(_.uses=Qe(_.uses)),de({loader:t.nodes[P],url:b,params:s,route:a,parent:async()=>{const L={};for(let U=0;U<w;U+=1)Object.assign(L,(await y[U]).data);return L},server_data_node:pe(_)})}),I=await Promise.all(y),A=o.find(({id:P})=>P===a.id);if(A){const P=A.layouts;for(let w=0;w<P.length;w++)P[w]||I.splice(w,0,void 0)}E=await Y({url:b,params:s,branch:I,status:e,error:c,form:p,route:A??null})}catch(y){if(y instanceof ze){await K(new URL(y.location,location.href));return}E=await ie({status:y instanceof te?y.status:500,error:await Z(y,{url:b,params:s,route:a}),url:b,route:a})}xe(E)}}}async function Be(t,r){const o=new URL(t);if(o.pathname=lt(t.pathname),t.pathname.endsWith("/")&&o.searchParams.append(Nt,"1"),t.searchParams.has(Ee))throw new Error(`Cannot used reserved query parameter "${Ee}"`);o.searchParams.append(Ee,r.map(d=>d?"1":"0").join(""));const i=await fe(o.href);if(!i.ok)throw new te(i.status,await i.json());return new Promise(async d=>{var h;const u=new Map,v=i.body.getReader(),l=new TextDecoder;function g(j){return $t(j,{Promise:x=>new Promise((S,T)=>{u.set(x,{fulfil:S,reject:T})})})}let m="";for(;;){const{done:j,value:x}=await v.read();if(j&&!m)break;for(m+=!x&&m?`
`:l.decode(x);;){const S=m.indexOf(`
`);if(S===-1)break;const T=JSON.parse(m.slice(0,S));if(m=m.slice(S+1),T.type==="redirect")return d(T);if(T.type==="data")(h=T.nodes)==null||h.forEach(O=>{(O==null?void 0:O.type)==="data"&&(O.uses=Qe(O.uses),O.data=g(O.data))}),d(T);else if(T.type==="chunk"){const{id:O,data:V,error:G}=T,F=u.get(O);u.delete(O),G?F.reject(g(G)):F.fulfil(g(V))}}}})}function Qe(t){return{dependencies:new Set((t==null?void 0:t.dependencies)??[]),params:new Set((t==null?void 0:t.params)??[]),parent:!!(t!=null&&t.parent),route:!!(t!=null&&t.route),url:!!(t!=null&&t.url)}}function Se(){const t=document.querySelector("[autofocus]");if(t)t.focus();else{const r=document.body,o=r.getAttribute("tabindex");r.tabIndex=-1,r.focus({preventScroll:!0,focusVisible:!1}),o!==null?r.setAttribute("tabindex",o):r.removeAttribute("tabindex");const i=getSelection();if(i&&i.type!=="None"){const d=[];for(let u=0;u<i.rangeCount;u+=1)d.push(i.getRangeAt(u));setTimeout(()=>{if(i.rangeCount===d.length){for(let u=0;u<i.rangeCount;u+=1){const v=d[u],l=i.getRangeAt(u);if(v.commonAncestorContainer!==l.commonAncestorContainer||v.startContainer!==l.startContainer||v.endContainer!==l.endContainer||v.startOffset!==l.startOffset||v.endOffset!==l.endOffset)return}i.removeAllRanges()}})}}}function Je(t,r,o,i){var g,m;let d,u;const v=new Promise((h,j)=>{d=h,u=j});return v.catch(()=>{}),{navigation:{from:{params:t.params,route:{id:((g=t.route)==null?void 0:g.id)??null},url:t.url},to:o&&{params:(r==null?void 0:r.params)??null,route:{id:((m=r==null?void 0:r.route)==null?void 0:m.id)??null},url:o},willUnload:!r,type:i,complete:v},fulfil:d,reject:u}}{const t=console.warn;console.warn=function(...o){o.length===1&&/<(Layout|Page|Error)(_[\w$]+)?> was created (with unknown|without expected) prop '(data|form)'/.test(o[0])||t(...o)}}async function Ft(t,r,o){r===document.body&&console.warn(`Placing %sveltekit.body% directly inside <body> is not recommended, as your app may break for users who have certain browser extensions installed.

Consider wrapping it in an element:

<div style="display: contents">
  %sveltekit.body%
</div>`);const i=Ct(t,r);tt({client:i}),o?await i._hydrate(o):i.goto(location.href,{replaceState:!0}),i._start_router()}export{Ft as start};
