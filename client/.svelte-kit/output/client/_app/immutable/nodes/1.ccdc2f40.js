import{S as C,i as H,d as q,s as O,P,Q as R,v as z,p as E,y as g,c as A,q as b,r as w,z as $,l as d,f as B,x as S,g as u,H as x,A as y,K as j}from"../chunks/index.13108eec.js";import{p as _}from"../chunks/stores.14178e32.js";const k="node_modules/@sveltejs/kit/src/runtime/components/error.svelte";function f(r){var h;let e,i=r[0].status+"",o,l,n,c=((h=r[0].error)==null?void 0:h.message)+"",s;const v={c:function(){e=E("h1"),o=g(i),l=A(),n=E("p"),s=g(c),this.h()},l:function(t){e=b(t,"H1",{});var a=w(e);o=$(a,i),a.forEach(d),l=B(t),n=b(t,"P",{});var m=w(n);s=$(m,c),m.forEach(d),this.h()},h:function(){S(e,k,4,0,57),S(n,k,5,0,81)},m:function(t,a){u(t,e,a),x(e,o),u(t,l,a),u(t,n,a),x(n,s)},p:function(t,[a]){var m;a&1&&i!==(i=t[0].status+"")&&y(o,i),a&1&&c!==(c=((m=t[0].error)==null?void 0:m.message)+"")&&y(s,c)},i:j,o:j,d:function(t){t&&d(e),t&&d(l),t&&d(n)}};return q("SvelteRegisterBlock",{block:v,id:f.name,type:"component",source:"",ctx:r}),v}function D(r,e,i){let o;P(_,"page"),R(r,_,s=>i(0,o=s));let{$$slots:l={},$$scope:n}=e;z("Error",l,[]);const c=[];return Object.keys(e).forEach(s=>{!~c.indexOf(s)&&s.slice(0,2)!=="$$"&&s!=="slot"&&console.warn(`<Error> was created with unknown prop '${s}'`)}),r.$capture_state=()=>({page:_,$page:o}),[o]}class Q extends C{constructor(e){super(e),H(this,e,D,f,O,{}),q("SvelteRegisterComponent",{component:this,tagName:"Error",options:e,id:f.name})}}export{Q as component};
