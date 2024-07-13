import{i as q,a5 as k,X as B,af as R}from"./index-Cqd5pjsu.js";function v(s,{delay:u=0,duration:c=400,easing:i=q}={}){const y=+getComputedStyle(s).opacity;return{delay:u,duration:c,easing:i,css:r=>`opacity: ${r*y}`}}function O({fallback:s,...u}){const c=new Map,i=new Map;function y(f,e,g){const{delay:o=0,duration:t=n=>Math.sqrt(n)*30,easing:l=R}=k(k({},u),g),a=f.getBoundingClientRect(),d=e.getBoundingClientRect(),h=a.left-d.left,p=a.top-d.top,x=a.width/d.width,C=a.height/d.height,M=Math.sqrt(h*h+p*p),$=getComputedStyle(e),_=$.transform==="none"?"":$.transform,m=+$.opacity;return{delay:o,duration:B(t)?t(M):t,easing:l,css:(n,w)=>`
				opacity: ${n*m};
				transform-origin: top left;
				transform: ${_} translate(${w*h}px,${w*p}px) scale(${n+(1-n)*x}, ${n+(1-n)*C});
			`}}function r(f,e,g){return(o,t)=>(f.set(t.key,o),()=>{if(e.has(t.key)){const l=e.get(t.key);return e.delete(t.key),y(l,o,t)}return f.delete(t.key),s&&s(o,t,g)})}return[r(i,c,!1),r(c,i,!0)]}export{O as c,v as f};
