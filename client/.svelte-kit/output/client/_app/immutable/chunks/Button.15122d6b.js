import{S as y,i as C,s as E,d as m,v as P,p as _,q as p,r as S,l as f,u as d,x as w,g,Q as j,T as R,N as h,y as q,z as N,A as O,P as T}from"./index.bc524795.js";const k="src/lib/Button.svelte";function v(t){let e;const s={c:function(){e=q(t[1])},l:function(c){e=N(c,t[1])},m:function(c,o){g(c,e,o)},p:function(c,o){o&2&&O(e,c[1])},d:function(c){c&&f(e)}};return m("SvelteRegisterBlock",{block:s,id:v.name,type:"else",source:"(9:4) {:else}",ctx:t}),s}function B(t){let e,s;const l={c:function(){e=_("img"),this.h()},l:function(o){e=p(o,"IMG",{class:!0,src:!0,alt:!0}),this.h()},h:function(){d(e,"class","w-6 animate-spin mx-auto"),T(e.src,s="/spinner.svg")||d(e,"src",s),d(e,"alt","loading spinner"),w(e,k,7,8,204)},m:function(o,i){g(o,e,i)},p:h,d:function(o){o&&f(e)}};return m("SvelteRegisterBlock",{block:l,id:B.name,type:"if",source:"(7:4) {#if loading}",ctx:t}),l}function b(t){let e,s,l;function c(a,n){return a[2]?B:v}let o=c(t),i=o(t);const r={c:function(){e=_("button"),i.c(),this.h()},l:function(n){e=p(n,"BUTTON",{class:!0});var u=S(e);i.l(u),u.forEach(f),this.h()},h:function(){d(e,"class","bg-[#378E8B] p-3 rounded-[4px] font-semibold mt-5 mb-3"),w(e,k,5,0,87)},m:function(n,u){g(n,e,u),i.m(e,null),s||(l=j(e,"click",function(){R(t[0])&&t[0].apply(this,arguments)},!1,!1,!1,!1),s=!0)},p:function(n,[u]){t=n,o===(o=c(t))&&i?i.p(t,u):(i.d(1),i=o(t),i&&(i.c(),i.m(e,null)))},i:h,o:h,d:function(n){n&&f(e),i.d(),s=!1,l()}};return m("SvelteRegisterBlock",{block:r,id:b.name,type:"component",source:"",ctx:t}),r}function x(t,e,s){let{$$slots:l={},$$scope:c}=e;P("Button",l,[]);let{onClick:o}=e,{label:i}=e,{loading:r}=e;t.$$.on_mount.push(function(){o===void 0&&!("onClick"in e||t.$$.bound[t.$$.props.onClick])&&console.warn("<Button> was created without expected prop 'onClick'"),i===void 0&&!("label"in e||t.$$.bound[t.$$.props.label])&&console.warn("<Button> was created without expected prop 'label'"),r===void 0&&!("loading"in e||t.$$.bound[t.$$.props.loading])&&console.warn("<Button> was created without expected prop 'loading'")});const a=["onClick","label","loading"];return Object.keys(e).forEach(n=>{!~a.indexOf(n)&&n.slice(0,2)!=="$$"&&n!=="slot"&&console.warn(`<Button> was created with unknown prop '${n}'`)}),t.$$set=n=>{"onClick"in n&&s(0,o=n.onClick),"label"in n&&s(1,i=n.label),"loading"in n&&s(2,r=n.loading)},t.$capture_state=()=>({onClick:o,label:i,loading:r}),t.$inject_state=n=>{"onClick"in n&&s(0,o=n.onClick),"label"in n&&s(1,i=n.label),"loading"in n&&s(2,r=n.loading)},e&&"$$inject"in e&&t.$inject_state(e.$$inject),[o,i,r]}class A extends y{constructor(e){super(e),C(this,e,x,b,E,{onClick:0,label:1,loading:2}),m("SvelteRegisterComponent",{component:this,tagName:"Button",options:e,id:b.name})}get onClick(){throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'")}set onClick(e){throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'")}get label(){throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'")}set label(e){throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'")}get loading(){throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'")}set loading(e){throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'")}}export{A as B};
