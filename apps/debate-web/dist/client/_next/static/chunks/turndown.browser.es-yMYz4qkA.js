function e(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e}function t(e,t){return Array(t+1).join(e)}function n(e){return e.replace(/^\n*/,``)}function r(e){for(var t=e.length;t>0&&e[t-1]===`
`;)t--;return e.substring(0,t)}function i(e){return r(n(e))}var a=`ADDRESS.ARTICLE.ASIDE.AUDIO.BLOCKQUOTE.BODY.CANVAS.CENTER.DD.DIR.DIV.DL.DT.FIELDSET.FIGCAPTION.FIGURE.FOOTER.FORM.FRAMESET.H1.H2.H3.H4.H5.H6.HEADER.HGROUP.HR.HTML.ISINDEX.LI.MAIN.MENU.NAV.NOFRAMES.NOSCRIPT.OL.OUTPUT.P.PRE.SECTION.TABLE.TBODY.TD.TFOOT.TH.THEAD.TR.UL`.split(`.`);function o(e){return p(e,a)}var s=[`AREA`,`BASE`,`BR`,`COL`,`COMMAND`,`EMBED`,`HR`,`IMG`,`INPUT`,`KEYGEN`,`LINK`,`META`,`PARAM`,`SOURCE`,`TRACK`,`WBR`];function c(e){return p(e,s)}function l(e){return m(e,s)}var u=[`A`,`TABLE`,`THEAD`,`TBODY`,`TFOOT`,`TH`,`TD`,`IFRAME`,`SCRIPT`,`AUDIO`,`VIDEO`];function d(e){return p(e,u)}function f(e){return m(e,u)}function p(e,t){return t.indexOf(e.nodeName)>=0}function m(e,t){return e.getElementsByTagName&&t.some(function(t){return e.getElementsByTagName(t).length})}var h=[[/\\/g,`\\\\`],[/\*/g,`\\*`],[/^-/g,`\\-`],[/^\+ /g,`\\+ `],[/^(=+)/g,`\\$1`],[/^(#{1,6}) /g,`\\$1 `],[/`/g,"\\`"],[/^~~~/g,`\\~~~`],[/\[/g,`\\[`],[/\]/g,`\\]`],[/^>/g,`\\>`],[/_/g,`\\_`],[/^(\d+)\. /g,`$1\\. `]];function g(e){return h.reduce(function(e,t){return e.replace(t[0],t[1])},e)}var _={};_.paragraph={filter:`p`,replacement:function(e){return`

`+e+`

`}},_.lineBreak={filter:`br`,replacement:function(e,t,n){return n.br+`
`}},_.heading={filter:[`h1`,`h2`,`h3`,`h4`,`h5`,`h6`],replacement:function(e,n,r){var i=Number(n.nodeName.charAt(1));if(r.headingStyle===`setext`&&i<3){var a=t(i===1?`=`:`-`,e.length);return`

`+e+`
`+a+`

`}return`

`+t(`#`,i)+` `+e+`

`}},_.blockquote={filter:`blockquote`,replacement:function(e){return e=i(e).replace(/^/gm,`> `),`

`+e+`

`}},_.list={filter:[`ul`,`ol`],replacement:function(e,t){var n=t.parentNode;return n.nodeName===`LI`&&n.lastElementChild===t?`
`+e:`

`+e+`

`}},_.listItem={filter:`li`,replacement:function(e,t,n){var r=n.bulletListMarker+`   `,a=t.parentNode;if(a.nodeName===`OL`){var o=a.getAttribute(`start`),s=Array.prototype.indexOf.call(a.children,t);r=(o?Number(o)+s:s+1)+`.  `}var c=/\n$/.test(e);return e=i(e)+(c?`
`:``),e=e.replace(/\n/gm,`
`+` `.repeat(r.length)),r+e+(t.nextSibling?`
`:``)}},_.indentedCodeBlock={filter:function(e,t){return t.codeBlockStyle===`indented`&&e.nodeName===`PRE`&&e.firstChild&&e.firstChild.nodeName===`CODE`},replacement:function(e,t,n){return`

    `+t.firstChild.textContent.replace(/\n/g,`
    `)+`

`}},_.fencedCodeBlock={filter:function(e,t){return t.codeBlockStyle===`fenced`&&e.nodeName===`PRE`&&e.firstChild&&e.firstChild.nodeName===`CODE`},replacement:function(e,n,r){for(var i=((n.firstChild.getAttribute(`class`)||``).match(/language-(\S+)/)||[null,``])[1],a=n.firstChild.textContent,o=r.fence.charAt(0),s=3,c=RegExp(`^`+o+`{3,}`,`gm`),l;l=c.exec(a);)l[0].length>=s&&(s=l[0].length+1);var u=t(o,s);return`

`+u+i+`
`+a.replace(/\n$/,``)+`
`+u+`

`}},_.horizontalRule={filter:`hr`,replacement:function(e,t,n){return`

`+n.hr+`

`}},_.inlineLink={filter:function(e,t){return t.linkStyle===`inlined`&&e.nodeName===`A`&&e.getAttribute(`href`)},replacement:function(e,t){var n=y(t.getAttribute(`href`)),r=b(v(t.getAttribute(`title`))),i=r?` "`+r+`"`:``;return`[`+e+`](`+n+i+`)`}},_.referenceLink={filter:function(e,t){return t.linkStyle===`referenced`&&e.nodeName===`A`&&e.getAttribute(`href`)},replacement:function(e,t,n){var r=y(t.getAttribute(`href`)),i=v(t.getAttribute(`title`));i&&=` "`+b(i)+`"`;var a,o;switch(n.linkReferenceStyle){case`collapsed`:a=`[`+e+`][]`,o=`[`+e+`]: `+r+i;break;case`shortcut`:a=`[`+e+`]`,o=`[`+e+`]: `+r+i;break;default:var s=this.references.length+1;a=`[`+e+`][`+s+`]`,o=`[`+s+`]: `+r+i}return this.references.push(o),a},references:[],append:function(e){var t=``;return this.references.length&&(t=`

`+this.references.join(`
`)+`

`,this.references=[]),t}},_.emphasis={filter:[`em`,`i`],replacement:function(e,t,n){return e.trim()?n.emDelimiter+e+n.emDelimiter:``}},_.strong={filter:[`strong`,`b`],replacement:function(e,t,n){return e.trim()?n.strongDelimiter+e+n.strongDelimiter:``}},_.code={filter:function(e){var t=e.previousSibling||e.nextSibling,n=e.parentNode.nodeName===`PRE`&&!t;return e.nodeName===`CODE`&&!n},replacement:function(e){if(!e)return``;e=e.replace(/\r?\n|\r/g,` `);for(var t=/^`|^ .*?[^ ].* $|`$/.test(e)?` `:``,n="`",r=e.match(/`+/gm)||[];r.indexOf(n)!==-1;)n+="`";return n+t+e+t+n}},_.image={filter:`img`,replacement:function(e,t){var n=g(v(t.getAttribute(`alt`))),r=y(t.getAttribute(`src`)||``),i=v(t.getAttribute(`title`)),a=i?` "`+b(i)+`"`:``;return r?`![`+n+`](`+r+a+`)`:``}};function v(e){return e?e.replace(/(\n+\s*)+/g,`
`):``}function y(e){var t=e.replace(/([<>()])/g,`\\$1`);return t.indexOf(` `)>=0?`<`+t+`>`:t}function b(e){return e.replace(/"/g,`\\"`)}function x(e){for(var t in this.options=e,this._keep=[],this._remove=[],this.blankRule={replacement:e.blankReplacement},this.keepReplacement=e.keepReplacement,this.defaultRule={replacement:e.defaultReplacement},this.array=[],e.rules)this.array.push(e.rules[t])}x.prototype={add:function(e,t){this.array.unshift(t)},keep:function(e){this._keep.unshift({filter:e,replacement:this.keepReplacement})},remove:function(e){this._remove.unshift({filter:e,replacement:function(){return``}})},forNode:function(e){if(e.isBlank)return this.blankRule;var t;return(t=S(this.array,e,this.options))||(t=S(this._keep,e,this.options))||(t=S(this._remove,e,this.options))?t:this.defaultRule},forEach:function(e){for(var t=0;t<this.array.length;t++)e(this.array[t],t)}};function S(e,t,n){for(var r=0;r<e.length;r++){var i=e[r];if(C(i,t,n))return i}}function C(e,t,n){var r=e.filter;if(typeof r==`string`){if(r===t.nodeName.toLowerCase())return!0}else if(Array.isArray(r)){if(r.indexOf(t.nodeName.toLowerCase())>-1)return!0}else if(typeof r==`function`){if(r.call(e,t,n))return!0}else throw TypeError("`filter` needs to be a string, array, or function")}function w(e){var t=e.element,n=e.isBlock,r=e.isVoid,i=e.isPre||function(e){return e.nodeName===`PRE`};if(t.firstChild&&!i(t)){for(var a=null,o=!1,s=null,c=E(s,t,i);c!==t;){if(c.nodeType===3||c.nodeType===4){var l=c.data.replace(/[ \r\n\t]+/g,` `);if((!a||/ $/.test(a.data))&&!o&&l[0]===` `&&(l=l.substr(1)),!l){c=T(c);continue}c.data=l,a=c}else if(c.nodeType===1)n(c)||c.nodeName===`BR`?(a&&(a.data=a.data.replace(/ $/,``)),a=null,o=!1):r(c)||i(c)?(a=null,o=!0):a&&(o=!1);else{c=T(c);continue}var u=E(s,c,i);s=c,c=u}a&&(a.data=a.data.replace(/ $/,``),a.data||T(a))}}function T(e){var t=e.nextSibling||e.parentNode;return e.parentNode.removeChild(e),t}function E(e,t,n){return e&&e.parentNode===t||n(t)?t.nextSibling||t.parentNode:t.firstChild||t.nextSibling||t.parentNode}var D=window;function O(){var e=D.DOMParser,t=!1;try{new e().parseFromString(``,`text/html`)&&(t=!0)}catch{}return t}function k(){var e=function(){};return A()?e.prototype.parseFromString=function(e){var t=new window.ActiveXObject(`htmlfile`);return t.designMode=`on`,t.open(),t.write(e),t.close(),t}:e.prototype.parseFromString=function(e){var t=document.implementation.createHTMLDocument(``);return t.open(),t.write(e),t.close(),t},e}function A(){var e=!1;try{document.implementation.createHTMLDocument(``).open()}catch{D.ActiveXObject&&(e=!0)}return e}var j=O()?D.DOMParser:k();function M(e,t){var n=typeof e==`string`?P().parseFromString(`<x-turndown id="turndown-root">`+e+`</x-turndown>`,`text/html`).getElementById(`turndown-root`):e.cloneNode(!0);return w({element:n,isBlock:o,isVoid:c,isPre:t.preformattedCode?F:null}),n}var N;function P(){return N||=new j,N}function F(e){return e.nodeName===`PRE`||e.nodeName===`CODE`}function I(e,t){return e.isBlock=o(e),e.isCode=e.nodeName===`CODE`||e.parentNode.isCode,e.isBlank=L(e),e.flankingWhitespace=R(e,t),e}function L(e){return!c(e)&&!d(e)&&/^\s*$/i.test(e.textContent)&&!l(e)&&!f(e)}function R(e,t){if(e.isBlock||t.preformattedCode&&e.isCode)return{leading:``,trailing:``};var n=z(e.textContent);return n.leadingAscii&&B(`left`,e,t)&&(n.leading=n.leadingNonAscii),n.trailingAscii&&B(`right`,e,t)&&(n.trailing=n.trailingNonAscii),{leading:n.leading,trailing:n.trailing}}function z(e){var t=e.match(/^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/);return{leading:t[1],leadingAscii:t[2],leadingNonAscii:t[3],trailing:t[4],trailingNonAscii:t[5],trailingAscii:t[6]}}function B(e,t,n){var r,i,a;return e===`left`?(r=t.previousSibling,i=/ $/):(r=t.nextSibling,i=/^ /),r&&(r.nodeType===3?a=i.test(r.nodeValue):n.preformattedCode&&r.nodeName===`CODE`?a=!1:r.nodeType===1&&!o(r)&&(a=i.test(r.textContent))),a}var V=Array.prototype.reduce;function H(t){if(!(this instanceof H))return new H(t);var n={rules:_,headingStyle:`setext`,hr:`* * *`,bulletListMarker:`*`,codeBlockStyle:`indented`,fence:"```",emDelimiter:`_`,strongDelimiter:`**`,linkStyle:`inlined`,linkReferenceStyle:`full`,br:`  `,preformattedCode:!1,blankReplacement:function(e,t){return t.isBlock?`

`:``},keepReplacement:function(e,t){return t.isBlock?`

`+t.outerHTML+`

`:t.outerHTML},defaultReplacement:function(e,t){return t.isBlock?`

`+e+`

`:e}};this.options=e({},n,t),this.rules=new x(this.options)}H.prototype={turndown:function(e){if(!q(e))throw TypeError(e+` is not a string, or an element/document/fragment node.`);if(e===``)return``;var t=U.call(this,new M(e,this.options));return W.call(this,t)},use:function(e){if(Array.isArray(e))for(var t=0;t<e.length;t++)this.use(e[t]);else if(typeof e==`function`)e(this);else throw TypeError(`plugin must be a Function or an Array of Functions`);return this},addRule:function(e,t){return this.rules.add(e,t),this},keep:function(e){return this.rules.keep(e),this},remove:function(e){return this.rules.remove(e),this},escape:function(e){return g(e)}};function U(e){var t=this;return V.call(e.childNodes,function(e,n){n=new I(n,t.options);var r=``;return n.nodeType===3?r=n.isCode?n.nodeValue:t.escape(n.nodeValue):n.nodeType===1&&(r=G.call(t,n)),K(e,r)},``)}function W(e){var t=this;return this.rules.forEach(function(n){typeof n.append==`function`&&(e=K(e,n.append(t.options)))}),e.replace(/^[\t\r\n]+/,``).replace(/[\t\r\n\s]+$/,``)}function G(e){var t=this.rules.forNode(e),n=U.call(this,e),r=e.flankingWhitespace;return(r.leading||r.trailing)&&(n=n.trim()),r.leading+t.replacement(n,e,this.options)+r.trailing}function K(e,t){var i=r(e),a=n(t),o=Math.max(e.length-i.length,t.length-a.length);return i+`

`.substring(0,o)+a}function q(e){return e!=null&&(typeof e==`string`||e.nodeType&&(e.nodeType===1||e.nodeType===9||e.nodeType===11))}export{H as default};