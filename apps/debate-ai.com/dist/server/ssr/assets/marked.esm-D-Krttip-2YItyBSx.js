function e() {
  return { async: false, breaks: false, extensions: null, gfm: true, hooks: null, pedantic: false, renderer: null, silent: false, tokenizer: null, walkTokens: null };
}
var t = { async: false, breaks: false, extensions: null, gfm: true, hooks: null, pedantic: false, renderer: null, silent: false, tokenizer: null, walkTokens: null };
function n(e2) {
  t = e2;
}
var r = { exec: () => null };
function s(e2, t2 = "") {
  let n2 = "string" == typeof e2 ? e2 : e2.source, r2 = { replace: (e3, t3) => {
    let s2 = "string" == typeof t3 ? t3 : t3.source;
    return s2 = s2.replace(i.caret, "$1"), n2 = n2.replace(e3, s2), r2;
  }, getRegex: () => new RegExp(n2, t2) };
  return r2;
}
var l = (() => {
  try {
    return !!new RegExp("(?<=1)(?<!1)");
  } catch {
    return false;
  }
})(), i = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (e2) => new RegExp(`^( {0,3}${e2})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: (e2) => new RegExp(`^ {0,${Math.min(3, e2 - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`), hrRegex: (e2) => new RegExp(`^ {0,${Math.min(3, e2 - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`), fencesBeginRegex: (e2) => new RegExp(`^ {0,${Math.min(3, e2 - 1)}}(?:\`\`\`|~~~)`), headingBeginRegex: (e2) => new RegExp(`^ {0,${Math.min(3, e2 - 1)}}#`), htmlBeginRegex: (e2) => new RegExp(`^ {0,${Math.min(3, e2 - 1)}}<(?:[a-z].*>|!--)`, "i"), blockquoteBeginRegex: (e2) => new RegExp(`^ {0,${Math.min(3, e2 - 1)}}>`) }, a = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/, o = / {0,3}(?:[*+-]|\d{1,9}[.)])/, c = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/, h = s(c).replace(/bull/g, o).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex(), p = s(c).replace(/bull/g, o).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(), g = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/, k = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/, d = s(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", k).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(), f = s(/^(bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, o).getRegex(), x = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul", b = /<!--(?:-?>|[\s\S]*?(?:-->|$))/, w = s("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", b).replace("tag", x).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(), m = s(g).replace("hr", a).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", x).getRegex(), y = { blockquote: s(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", m).getRegex(), code: /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/, def: d, fences: /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/, heading: /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/, hr: a, html: w, lheading: h, list: f, newline: /^(?:[ \t]*(?:\n|$))+/, paragraph: m, table: r, text: /^[^\n]+/ }, $ = s("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", a).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", x).getRegex(), R = { ...y, lheading: p, table: $, paragraph: s(g).replace("hr", a).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", $).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", x).getRegex() }, S = { ...y, html: s(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", b).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: r, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: s(g).replace("hr", a).replace("heading", " *#{1,6} *[^\n]").replace("lheading", h).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() }, T = /^( {2,}|\\)\n(?!\s*$)/, z = /[\p{P}\p{S}]/u, A = /[\s\p{P}\p{S}]/u, _ = /[^\s\p{P}\p{S}]/u, P = s(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, A).getRegex(), I = /(?!~)[\p{P}\p{S}]/u, L = s(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", l ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex(), B = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/, C = s(B, "u").replace(/punct/g, z).getRegex(), q = s(B, "u").replace(/punct/g, I).getRegex(), E = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)", v = s(E, "gu").replace(/notPunctSpace/g, _).replace(/punctSpace/g, A).replace(/punct/g, z).getRegex(), Z = s(E, "gu").replace(/notPunctSpace/g, /(?:[^\s\p{P}\p{S}]|~)/u).replace(/punctSpace/g, /(?!~)[\s\p{P}\p{S}]/u).replace(/punct/g, I).getRegex(), D = s("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, _).replace(/punctSpace/g, A).replace(/punct/g, z).getRegex(), M = s(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, z).getRegex(), Q = s("^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)", "gu").replace(/notPunctSpace/g, _).replace(/punctSpace/g, A).replace(/punct/g, z).getRegex(), H = s(/\\(punct)/, "gu").replace(/punct/g, z).getRegex(), N = s(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(), O = s(b).replace("(?:-->|$)", "-->").getRegex(), j = s("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", O).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(), G = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/, X = s(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label", G).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(), W = s(/^!?\[(label)\]\[(ref)\]/).replace("label", G).replace("ref", k).getRegex(), F = s(/^!?\[(ref)\](?:\[\])?/).replace("ref", k).getRegex(), U = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/, J = { _backpedal: r, anyPunctuation: H, autolink: N, blockSkip: L, br: T, code: /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/, del: r, delLDelim: r, delRDelim: r, emStrongLDelim: C, emStrongRDelimAst: v, emStrongRDelimUnd: D, escape: /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/, link: X, nolink: F, punctuation: P, reflink: W, reflinkSearch: s("reflink|nolink(?!\\()", "g").replace("reflink", W).replace("nolink", F).getRegex(), tag: j, text: /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/, url: r }, K = { ...J, link: s(/^!?\[(label)\]\((.*?)\)/).replace("label", G).getRegex(), reflink: s(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", G).getRegex() }, V = { ...J, emStrongRDelimAst: Z, emStrongLDelim: q, delLDelim: M, delRDelim: Q, url: s(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", U).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: s(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", U).getRegex() }, Y = { ...V, br: s(T).replace("{2,}", "*").getRegex(), text: s(V.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() }, ee = { normal: y, gfm: R, pedantic: S }, te = { normal: J, gfm: V, breaks: Y, pedantic: K }, ne = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }, re = (e2) => ne[e2];
function se(e2, t2) {
  if (t2) {
    if (i.escapeTest.test(e2)) return e2.replace(i.escapeReplace, re);
  } else if (i.escapeTestNoEncode.test(e2)) return e2.replace(i.escapeReplaceNoEncode, re);
  return e2;
}
function le(e2) {
  try {
    e2 = encodeURI(e2).replace(i.percentDecode, "%");
  } catch {
    return null;
  }
  return e2;
}
function ie(e2, t2) {
  let n2 = e2.replace(i.findPipe, (e3, t3, n3) => {
    let r3 = false, s2 = t3;
    for (; --s2 >= 0 && "\\" === n3[s2]; ) r3 = !r3;
    return r3 ? "|" : " |";
  }).split(i.splitPipe), r2 = 0;
  if (n2[0].trim() || n2.shift(), n2.length > 0 && !n2.at(-1)?.trim() && n2.pop(), t2) if (n2.length > t2) n2.splice(t2);
  else for (; n2.length < t2; ) n2.push("");
  for (; r2 < n2.length; r2++) n2[r2] = n2[r2].trim().replace(i.slashPipe, "|");
  return n2;
}
function ae(e2, t2, n2) {
  let r2 = e2.length;
  if (0 === r2) return "";
  let s2 = 0;
  for (; s2 < r2; ) {
    if (e2.charAt(r2 - s2 - 1) !== t2) break;
    s2++;
  }
  return e2.slice(0, r2 - s2);
}
function oe(e2, t2 = 0) {
  let n2 = t2, r2 = "";
  for (let s2 of e2) if ("	" === s2) {
    let e3 = 4 - n2 % 4;
    r2 += " ".repeat(e3), n2 += e3;
  } else r2 += s2, n2++;
  return r2;
}
function ce(e2, t2, n2, r2, s2) {
  let l2 = t2.href, i2 = t2.title || null, a2 = e2[1].replace(s2.other.outputLinkReplace, "$1");
  r2.state.inLink = true;
  let o2 = { type: "!" === e2[0].charAt(0) ? "image" : "link", raw: n2, href: l2, title: i2, text: a2, tokens: r2.inlineTokens(a2) };
  return r2.state.inLink = false, o2;
}
var he = class {
  options;
  rules;
  lexer;
  constructor(e2) {
    this.options = e2 || t;
  }
  space(e2) {
    let t2 = this.rules.block.newline.exec(e2);
    if (t2 && t2[0].length > 0) return { type: "space", raw: t2[0] };
  }
  code(e2) {
    let t2 = this.rules.block.code.exec(e2);
    if (t2) {
      let e3 = t2[0].replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: t2[0], codeBlockStyle: "indented", text: this.options.pedantic ? e3 : ae(e3, "\n") };
    }
  }
  fences(e2) {
    let t2 = this.rules.block.fences.exec(e2);
    if (t2) {
      let e3 = t2[0], n2 = (function(e4, t3, n3) {
        let r2 = e4.match(n3.other.indentCodeCompensation);
        if (null === r2) return t3;
        let s2 = r2[1];
        return t3.split("\n").map((e5) => {
          let t4 = e5.match(n3.other.beginningSpace);
          if (null === t4) return e5;
          let [r3] = t4;
          return r3.length >= s2.length ? e5.slice(s2.length) : e5;
        }).join("\n");
      })(e3, t2[3] || "", this.rules);
      return { type: "code", raw: e3, lang: t2[2] ? t2[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t2[2], text: n2 };
    }
  }
  heading(e2) {
    let t2 = this.rules.block.heading.exec(e2);
    if (t2) {
      let e3 = t2[2].trim();
      if (this.rules.other.endingHash.test(e3)) {
        let t3 = ae(e3, "#");
        (this.options.pedantic || !t3 || this.rules.other.endingSpaceChar.test(t3)) && (e3 = t3.trim());
      }
      return { type: "heading", raw: t2[0], depth: t2[1].length, text: e3, tokens: this.lexer.inline(e3) };
    }
  }
  hr(e2) {
    let t2 = this.rules.block.hr.exec(e2);
    if (t2) return { type: "hr", raw: ae(t2[0], "\n") };
  }
  blockquote(e2) {
    let t2 = this.rules.block.blockquote.exec(e2);
    if (t2) {
      let e3 = ae(t2[0], "\n").split("\n"), n2 = "", r2 = "", s2 = [];
      for (; e3.length > 0; ) {
        let t3, l2 = false, i2 = [];
        for (t3 = 0; t3 < e3.length; t3++) if (this.rules.other.blockquoteStart.test(e3[t3])) i2.push(e3[t3]), l2 = true;
        else {
          if (l2) break;
          i2.push(e3[t3]);
        }
        e3 = e3.slice(t3);
        let a2 = i2.join("\n"), o2 = a2.replace(this.rules.other.blockquoteSetextReplace, "\n    $1").replace(this.rules.other.blockquoteSetextReplace2, "");
        n2 = n2 ? `${n2}
${a2}` : a2, r2 = r2 ? `${r2}
${o2}` : o2;
        let c2 = this.lexer.state.top;
        if (this.lexer.state.top = true, this.lexer.blockTokens(o2, s2, true), this.lexer.state.top = c2, 0 === e3.length) break;
        let h2 = s2.at(-1);
        if ("code" === h2?.type) break;
        if ("blockquote" === h2?.type) {
          let t4 = h2, l3 = t4.raw + "\n" + e3.join("\n"), i3 = this.blockquote(l3);
          s2[s2.length - 1] = i3, n2 = n2.substring(0, n2.length - t4.raw.length) + i3.raw, r2 = r2.substring(0, r2.length - t4.text.length) + i3.text;
          break;
        }
        if ("list" === h2?.type) {
          let t4 = h2, l3 = t4.raw + "\n" + e3.join("\n"), i3 = this.list(l3);
          s2[s2.length - 1] = i3, n2 = n2.substring(0, n2.length - h2.raw.length) + i3.raw, r2 = r2.substring(0, r2.length - t4.raw.length) + i3.raw, e3 = l3.substring(s2.at(-1).raw.length).split("\n");
          continue;
        }
      }
      return { type: "blockquote", raw: n2, tokens: s2, text: r2 };
    }
  }
  list(e2) {
    let t2 = this.rules.block.list.exec(e2);
    if (t2) {
      let n2 = t2[1].trim(), r2 = n2.length > 1, s2 = { type: "list", raw: "", ordered: r2, start: r2 ? +n2.slice(0, -1) : "", loose: false, items: [] };
      n2 = r2 ? `\\d{1,9}\\${n2.slice(-1)}` : `\\${n2}`, this.options.pedantic && (n2 = r2 ? n2 : "[*+-]");
      let l2 = this.rules.other.listItemRegex(n2), i2 = false;
      for (; e2; ) {
        let n3 = false, r3 = "", a3 = "";
        if (!(t2 = l2.exec(e2)) || this.rules.block.hr.test(e2)) break;
        r3 = t2[0], e2 = e2.substring(r3.length);
        let o2 = oe(t2[2].split("\n", 1)[0], t2[1].length), c2 = e2.split("\n", 1)[0], h2 = !o2.trim(), p2 = 0;
        if (this.options.pedantic ? (p2 = 2, a3 = o2.trimStart()) : h2 ? p2 = t2[1].length + 1 : (p2 = o2.search(this.rules.other.nonSpaceChar), p2 = p2 > 4 ? 1 : p2, a3 = o2.slice(p2), p2 += t2[1].length), h2 && this.rules.other.blankLine.test(c2) && (r3 += c2 + "\n", e2 = e2.substring(c2.length + 1), n3 = true), !n3) {
          let t3 = this.rules.other.nextBulletRegex(p2), n4 = this.rules.other.hrRegex(p2), s3 = this.rules.other.fencesBeginRegex(p2), l3 = this.rules.other.headingBeginRegex(p2), i3 = this.rules.other.htmlBeginRegex(p2), g2 = this.rules.other.blockquoteBeginRegex(p2);
          for (; e2; ) {
            let k2, d2 = e2.split("\n", 1)[0];
            if (c2 = d2, this.options.pedantic ? (c2 = c2.replace(this.rules.other.listReplaceNesting, "  "), k2 = c2) : k2 = c2.replace(this.rules.other.tabCharGlobal, "    "), s3.test(c2) || l3.test(c2) || i3.test(c2) || g2.test(c2) || t3.test(c2) || n4.test(c2)) break;
            if (k2.search(this.rules.other.nonSpaceChar) >= p2 || !c2.trim()) a3 += "\n" + k2.slice(p2);
            else {
              if (h2 || o2.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || s3.test(o2) || l3.test(o2) || n4.test(o2)) break;
              a3 += "\n" + c2;
            }
            h2 = !c2.trim(), r3 += d2 + "\n", e2 = e2.substring(d2.length + 1), o2 = k2.slice(p2);
          }
        }
        s2.loose || (i2 ? s2.loose = true : this.rules.other.doubleBlankLine.test(r3) && (i2 = true)), s2.items.push({ type: "list_item", raw: r3, task: !!this.options.gfm && this.rules.other.listIsTask.test(a3), loose: false, text: a3, tokens: [] }), s2.raw += r3;
      }
      let a2 = s2.items.at(-1);
      if (!a2) return;
      a2.raw = a2.raw.trimEnd(), a2.text = a2.text.trimEnd(), s2.raw = s2.raw.trimEnd();
      for (let e3 of s2.items) {
        if (this.lexer.state.top = false, e3.tokens = this.lexer.blockTokens(e3.text, []), e3.task) {
          if (e3.text = e3.text.replace(this.rules.other.listReplaceTask, ""), "text" === e3.tokens[0]?.type || "paragraph" === e3.tokens[0]?.type) {
            e3.tokens[0].raw = e3.tokens[0].raw.replace(this.rules.other.listReplaceTask, ""), e3.tokens[0].text = e3.tokens[0].text.replace(this.rules.other.listReplaceTask, "");
            for (let e4 = this.lexer.inlineQueue.length - 1; e4 >= 0; e4--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[e4].src)) {
              this.lexer.inlineQueue[e4].src = this.lexer.inlineQueue[e4].src.replace(this.rules.other.listReplaceTask, "");
              break;
            }
          }
          let t3 = this.rules.other.listTaskCheckbox.exec(e3.raw);
          if (t3) {
            let n3 = { type: "checkbox", raw: t3[0] + " ", checked: "[ ]" !== t3[0] };
            e3.checked = n3.checked, s2.loose ? e3.tokens[0] && ["paragraph", "text"].includes(e3.tokens[0].type) && "tokens" in e3.tokens[0] && e3.tokens[0].tokens ? (e3.tokens[0].raw = n3.raw + e3.tokens[0].raw, e3.tokens[0].text = n3.raw + e3.tokens[0].text, e3.tokens[0].tokens.unshift(n3)) : e3.tokens.unshift({ type: "paragraph", raw: n3.raw, text: n3.raw, tokens: [n3] }) : e3.tokens.unshift(n3);
          }
        }
        if (!s2.loose) {
          let t3 = e3.tokens.filter((e4) => "space" === e4.type), n3 = t3.length > 0 && t3.some((e4) => this.rules.other.anyLine.test(e4.raw));
          s2.loose = n3;
        }
      }
      if (s2.loose) for (let e3 of s2.items) {
        e3.loose = true;
        for (let t3 of e3.tokens) "text" === t3.type && (t3.type = "paragraph");
      }
      return s2;
    }
  }
  html(e2) {
    let t2 = this.rules.block.html.exec(e2);
    if (t2) return { type: "html", block: true, raw: t2[0], pre: "pre" === t2[1] || "script" === t2[1] || "style" === t2[1], text: t2[0] };
  }
  def(e2) {
    let t2 = this.rules.block.def.exec(e2);
    if (t2) {
      let e3 = t2[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "), n2 = t2[2] ? t2[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", r2 = t2[3] ? t2[3].substring(1, t2[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t2[3];
      return { type: "def", tag: e3, raw: t2[0], href: n2, title: r2 };
    }
  }
  table(e2) {
    let t2 = this.rules.block.table.exec(e2);
    if (!t2 || !this.rules.other.tableDelimiter.test(t2[2])) return;
    let n2 = ie(t2[1]), r2 = t2[2].replace(this.rules.other.tableAlignChars, "").split("|"), s2 = t2[3]?.trim() ? t2[3].replace(this.rules.other.tableRowBlankLine, "").split("\n") : [], l2 = { type: "table", raw: t2[0], header: [], align: [], rows: [] };
    if (n2.length === r2.length) {
      for (let e3 of r2) this.rules.other.tableAlignRight.test(e3) ? l2.align.push("right") : this.rules.other.tableAlignCenter.test(e3) ? l2.align.push("center") : this.rules.other.tableAlignLeft.test(e3) ? l2.align.push("left") : l2.align.push(null);
      for (let e3 = 0; e3 < n2.length; e3++) l2.header.push({ text: n2[e3], tokens: this.lexer.inline(n2[e3]), header: true, align: l2.align[e3] });
      for (let e3 of s2) l2.rows.push(ie(e3, l2.header.length).map((e4, t3) => ({ text: e4, tokens: this.lexer.inline(e4), header: false, align: l2.align[t3] })));
      return l2;
    }
  }
  lheading(e2) {
    let t2 = this.rules.block.lheading.exec(e2);
    if (t2) {
      let e3 = t2[1].trim();
      return { type: "heading", raw: t2[0], depth: "=" === t2[2].charAt(0) ? 1 : 2, text: e3, tokens: this.lexer.inline(e3) };
    }
  }
  paragraph(e2) {
    let t2 = this.rules.block.paragraph.exec(e2);
    if (t2) {
      let e3 = "\n" === t2[1].charAt(t2[1].length - 1) ? t2[1].slice(0, -1) : t2[1];
      return { type: "paragraph", raw: t2[0], text: e3, tokens: this.lexer.inline(e3) };
    }
  }
  text(e2) {
    let t2 = this.rules.block.text.exec(e2);
    if (t2) return { type: "text", raw: t2[0], text: t2[0], tokens: this.lexer.inline(t2[0]) };
  }
  escape(e2) {
    let t2 = this.rules.inline.escape.exec(e2);
    if (t2) return { type: "escape", raw: t2[0], text: t2[1] };
  }
  tag(e2) {
    let t2 = this.rules.inline.tag.exec(e2);
    if (t2) return !this.lexer.state.inLink && this.rules.other.startATag.test(t2[0]) ? this.lexer.state.inLink = true : this.lexer.state.inLink && this.rules.other.endATag.test(t2[0]) && (this.lexer.state.inLink = false), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(t2[0]) ? this.lexer.state.inRawBlock = true : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(t2[0]) && (this.lexer.state.inRawBlock = false), { type: "html", raw: t2[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: false, text: t2[0] };
  }
  link(e2) {
    let t2 = this.rules.inline.link.exec(e2);
    if (t2) {
      let e3 = t2[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(e3)) {
        if (!this.rules.other.endAngleBracket.test(e3)) return;
        let t3 = ae(e3.slice(0, -1), "\\");
        if ((e3.length - t3.length) % 2 == 0) return;
      } else {
        let e4 = (function(e5, t3) {
          if (-1 === e5.indexOf(t3[1])) return -1;
          let n3 = 0;
          for (let r3 = 0; r3 < e5.length; r3++) if ("\\" === e5[r3]) r3++;
          else if (e5[r3] === t3[0]) n3++;
          else if (e5[r3] === t3[1] && (n3--, n3 < 0)) return r3;
          return n3 > 0 ? -2 : -1;
        })(t2[2], "()");
        if (-2 === e4) return;
        if (e4 > -1) {
          let n3 = (0 === t2[0].indexOf("!") ? 5 : 4) + t2[1].length + e4;
          t2[2] = t2[2].substring(0, e4), t2[0] = t2[0].substring(0, n3).trim(), t2[3] = "";
        }
      }
      let n2 = t2[2], r2 = "";
      if (this.options.pedantic) {
        let e4 = this.rules.other.pedanticHrefTitle.exec(n2);
        e4 && (n2 = e4[1], r2 = e4[3]);
      } else r2 = t2[3] ? t2[3].slice(1, -1) : "";
      return n2 = n2.trim(), this.rules.other.startAngleBracket.test(n2) && (n2 = this.options.pedantic && !this.rules.other.endAngleBracket.test(e3) ? n2.slice(1) : n2.slice(1, -1)), ce(t2, { href: n2 && n2.replace(this.rules.inline.anyPunctuation, "$1"), title: r2 && r2.replace(this.rules.inline.anyPunctuation, "$1") }, t2[0], this.lexer, this.rules);
    }
  }
  reflink(e2, t2) {
    let n2;
    if ((n2 = this.rules.inline.reflink.exec(e2)) || (n2 = this.rules.inline.nolink.exec(e2))) {
      let e3 = t2[(n2[2] || n2[1]).replace(this.rules.other.multipleSpaceGlobal, " ").toLowerCase()];
      if (!e3) {
        let e4 = n2[0].charAt(0);
        return { type: "text", raw: e4, text: e4 };
      }
      return ce(n2, e3, n2[0], this.lexer, this.rules);
    }
  }
  emStrong(e2, t2, n2 = "") {
    let r2 = this.rules.inline.emStrongLDelim.exec(e2);
    if (r2 && (r2[1] || r2[2] || r2[3] || r2[4]) && (!r2[4] || !n2.match(this.rules.other.unicodeAlphaNumeric)) && (!r2[1] && !r2[3] || !n2 || this.rules.inline.punctuation.exec(n2))) {
      let n3, s2, l2 = [...r2[0]].length - 1, i2 = l2, a2 = 0, o2 = "*" === r2[0][0] ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (o2.lastIndex = 0, t2 = t2.slice(-1 * e2.length + l2); null !== (r2 = o2.exec(t2)); ) {
        if (n3 = r2[1] || r2[2] || r2[3] || r2[4] || r2[5] || r2[6], !n3) continue;
        if (s2 = [...n3].length, r2[3] || r2[4]) {
          i2 += s2;
          continue;
        }
        if ((r2[5] || r2[6]) && l2 % 3 && !((l2 + s2) % 3)) {
          a2 += s2;
          continue;
        }
        if (i2 -= s2, i2 > 0) continue;
        s2 = Math.min(s2, s2 + i2 + a2);
        let t3 = [...r2[0]][0].length, o3 = e2.slice(0, l2 + r2.index + t3 + s2);
        if (Math.min(l2, s2) % 2) {
          let e3 = o3.slice(1, -1);
          return { type: "em", raw: o3, text: e3, tokens: this.lexer.inlineTokens(e3) };
        }
        let c2 = o3.slice(2, -2);
        return { type: "strong", raw: o3, text: c2, tokens: this.lexer.inlineTokens(c2) };
      }
    }
  }
  codespan(e2) {
    let t2 = this.rules.inline.code.exec(e2);
    if (t2) {
      let e3 = t2[2].replace(this.rules.other.newLineCharGlobal, " "), n2 = this.rules.other.nonSpaceChar.test(e3), r2 = this.rules.other.startingSpaceChar.test(e3) && this.rules.other.endingSpaceChar.test(e3);
      return n2 && r2 && (e3 = e3.substring(1, e3.length - 1)), { type: "codespan", raw: t2[0], text: e3 };
    }
  }
  br(e2) {
    let t2 = this.rules.inline.br.exec(e2);
    if (t2) return { type: "br", raw: t2[0] };
  }
  del(e2, t2, n2 = "") {
    let r2 = this.rules.inline.delLDelim.exec(e2);
    if (r2 && (!r2[1] || !n2 || this.rules.inline.punctuation.exec(n2))) {
      let n3, s2, l2 = [...r2[0]].length - 1, i2 = l2, a2 = this.rules.inline.delRDelim;
      for (a2.lastIndex = 0, t2 = t2.slice(-1 * e2.length + l2); null !== (r2 = a2.exec(t2)); ) {
        if (n3 = r2[1] || r2[2] || r2[3] || r2[4] || r2[5] || r2[6], !n3 || (s2 = [...n3].length, s2 !== l2)) continue;
        if (r2[3] || r2[4]) {
          i2 += s2;
          continue;
        }
        if (i2 -= s2, i2 > 0) continue;
        s2 = Math.min(s2, s2 + i2);
        let t3 = [...r2[0]][0].length, a3 = e2.slice(0, l2 + r2.index + t3 + s2), o2 = a3.slice(l2, -l2);
        return { type: "del", raw: a3, text: o2, tokens: this.lexer.inlineTokens(o2) };
      }
    }
  }
  autolink(e2) {
    let t2 = this.rules.inline.autolink.exec(e2);
    if (t2) {
      let e3, n2;
      return "@" === t2[2] ? (e3 = t2[1], n2 = "mailto:" + e3) : (e3 = t2[1], n2 = e3), { type: "link", raw: t2[0], text: e3, href: n2, tokens: [{ type: "text", raw: e3, text: e3 }] };
    }
  }
  url(e2) {
    let t2;
    if (t2 = this.rules.inline.url.exec(e2)) {
      let e3, n2;
      if ("@" === t2[2]) e3 = t2[0], n2 = "mailto:" + e3;
      else {
        let r2;
        do {
          r2 = t2[0], t2[0] = this.rules.inline._backpedal.exec(t2[0])?.[0] ?? "";
        } while (r2 !== t2[0]);
        e3 = t2[0], n2 = "www." === t2[1] ? "http://" + t2[0] : t2[0];
      }
      return { type: "link", raw: t2[0], text: e3, href: n2, tokens: [{ type: "text", raw: e3, text: e3 }] };
    }
  }
  inlineText(e2) {
    let t2 = this.rules.inline.text.exec(e2);
    if (t2) {
      let e3 = this.lexer.state.inRawBlock;
      return { type: "text", raw: t2[0], text: t2[0], escaped: e3 };
    }
  }
}, pe = class u {
  tokens;
  options;
  state;
  inlineQueue;
  tokenizer;
  constructor(e2) {
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = e2 || t, this.options.tokenizer = this.options.tokenizer || new he(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: false, inRawBlock: false, top: true };
    let n2 = { other: i, block: ee.normal, inline: te.normal };
    this.options.pedantic ? (n2.block = ee.pedantic, n2.inline = te.pedantic) : this.options.gfm && (n2.block = ee.gfm, this.options.breaks ? n2.inline = te.breaks : n2.inline = te.gfm), this.tokenizer.rules = n2;
  }
  static get rules() {
    return { block: ee, inline: te };
  }
  static lex(e2, t2) {
    return new u(t2).lex(e2);
  }
  static lexInline(e2, t2) {
    return new u(t2).inlineTokens(e2);
  }
  lex(e2) {
    e2 = e2.replace(i.carriageReturn, "\n"), this.blockTokens(e2, this.tokens);
    for (let t2 = 0; t2 < this.inlineQueue.length; t2++) {
      let e3 = this.inlineQueue[t2];
      this.inlineTokens(e3.src, e3.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(e2, t2 = [], n2 = false) {
    for (this.tokenizer.lexer = this, this.options.pedantic && (e2 = e2.replace(i.tabCharGlobal, "    ").replace(i.spaceLine, "")); e2; ) {
      let r2;
      if (this.options.extensions?.block?.some((n3) => !!(r2 = n3.call({ lexer: this }, e2, t2)) && (e2 = e2.substring(r2.raw.length), t2.push(r2), true))) continue;
      if (r2 = this.tokenizer.space(e2)) {
        e2 = e2.substring(r2.raw.length);
        let n3 = t2.at(-1);
        1 === r2.raw.length && void 0 !== n3 ? n3.raw += "\n" : t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.code(e2)) {
        e2 = e2.substring(r2.raw.length);
        let n3 = t2.at(-1);
        "paragraph" === n3?.type || "text" === n3?.type ? (n3.raw += (n3.raw.endsWith("\n") ? "" : "\n") + r2.raw, n3.text += "\n" + r2.text, this.inlineQueue.at(-1).src = n3.text) : t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.fences(e2)) {
        e2 = e2.substring(r2.raw.length), t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.heading(e2)) {
        e2 = e2.substring(r2.raw.length), t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.hr(e2)) {
        e2 = e2.substring(r2.raw.length), t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.blockquote(e2)) {
        e2 = e2.substring(r2.raw.length), t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.list(e2)) {
        e2 = e2.substring(r2.raw.length), t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.html(e2)) {
        e2 = e2.substring(r2.raw.length), t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.def(e2)) {
        e2 = e2.substring(r2.raw.length);
        let n3 = t2.at(-1);
        "paragraph" === n3?.type || "text" === n3?.type ? (n3.raw += (n3.raw.endsWith("\n") ? "" : "\n") + r2.raw, n3.text += "\n" + r2.raw, this.inlineQueue.at(-1).src = n3.text) : this.tokens.links[r2.tag] || (this.tokens.links[r2.tag] = { href: r2.href, title: r2.title }, t2.push(r2));
        continue;
      }
      if (r2 = this.tokenizer.table(e2)) {
        e2 = e2.substring(r2.raw.length), t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.lheading(e2)) {
        e2 = e2.substring(r2.raw.length), t2.push(r2);
        continue;
      }
      let s2 = e2;
      if (this.options.extensions?.startBlock) {
        let t3, n3 = 1 / 0, r3 = e2.slice(1);
        this.options.extensions.startBlock.forEach((e3) => {
          t3 = e3.call({ lexer: this }, r3), "number" == typeof t3 && t3 >= 0 && (n3 = Math.min(n3, t3));
        }), n3 < 1 / 0 && n3 >= 0 && (s2 = e2.substring(0, n3 + 1));
      }
      if (this.state.top && (r2 = this.tokenizer.paragraph(s2))) {
        let l2 = t2.at(-1);
        n2 && "paragraph" === l2?.type ? (l2.raw += (l2.raw.endsWith("\n") ? "" : "\n") + r2.raw, l2.text += "\n" + r2.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = l2.text) : t2.push(r2), n2 = s2.length !== e2.length, e2 = e2.substring(r2.raw.length);
        continue;
      }
      if (r2 = this.tokenizer.text(e2)) {
        e2 = e2.substring(r2.raw.length);
        let n3 = t2.at(-1);
        "text" === n3?.type ? (n3.raw += (n3.raw.endsWith("\n") ? "" : "\n") + r2.raw, n3.text += "\n" + r2.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = n3.text) : t2.push(r2);
        continue;
      }
      if (e2) {
        let t3 = "Infinite loop on byte: " + e2.charCodeAt(0);
        if (this.options.silent) {
          console.error(t3);
          break;
        }
        throw new Error(t3);
      }
    }
    return this.state.top = true, t2;
  }
  inline(e2, t2 = []) {
    return this.inlineQueue.push({ src: e2, tokens: t2 }), t2;
  }
  inlineTokens(e2, t2 = []) {
    this.tokenizer.lexer = this;
    let n2, r2 = e2, s2 = null;
    if (this.tokens.links) {
      let e3 = Object.keys(this.tokens.links);
      if (e3.length > 0) for (; null !== (s2 = this.tokenizer.rules.inline.reflinkSearch.exec(r2)); ) e3.includes(s2[0].slice(s2[0].lastIndexOf("[") + 1, -1)) && (r2 = r2.slice(0, s2.index) + "[" + "a".repeat(s2[0].length - 2) + "]" + r2.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex));
    }
    for (; null !== (s2 = this.tokenizer.rules.inline.anyPunctuation.exec(r2)); ) r2 = r2.slice(0, s2.index) + "++" + r2.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    for (; null !== (s2 = this.tokenizer.rules.inline.blockSkip.exec(r2)); ) n2 = s2[2] ? s2[2].length : 0, r2 = r2.slice(0, s2.index + n2) + "[" + "a".repeat(s2[0].length - n2 - 2) + "]" + r2.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    r2 = this.options.hooks?.emStrongMask?.call({ lexer: this }, r2) ?? r2;
    let l2 = false, i2 = "";
    for (; e2; ) {
      let n3;
      if (l2 || (i2 = ""), l2 = false, this.options.extensions?.inline?.some((r3) => !!(n3 = r3.call({ lexer: this }, e2, t2)) && (e2 = e2.substring(n3.raw.length), t2.push(n3), true))) continue;
      if (n3 = this.tokenizer.escape(e2)) {
        e2 = e2.substring(n3.raw.length), t2.push(n3);
        continue;
      }
      if (n3 = this.tokenizer.tag(e2)) {
        e2 = e2.substring(n3.raw.length), t2.push(n3);
        continue;
      }
      if (n3 = this.tokenizer.link(e2)) {
        e2 = e2.substring(n3.raw.length), t2.push(n3);
        continue;
      }
      if (n3 = this.tokenizer.reflink(e2, this.tokens.links)) {
        e2 = e2.substring(n3.raw.length);
        let r3 = t2.at(-1);
        "text" === n3.type && "text" === r3?.type ? (r3.raw += n3.raw, r3.text += n3.text) : t2.push(n3);
        continue;
      }
      if (n3 = this.tokenizer.emStrong(e2, r2, i2)) {
        e2 = e2.substring(n3.raw.length), t2.push(n3);
        continue;
      }
      if (n3 = this.tokenizer.codespan(e2)) {
        e2 = e2.substring(n3.raw.length), t2.push(n3);
        continue;
      }
      if (n3 = this.tokenizer.br(e2)) {
        e2 = e2.substring(n3.raw.length), t2.push(n3);
        continue;
      }
      if (n3 = this.tokenizer.del(e2, r2, i2)) {
        e2 = e2.substring(n3.raw.length), t2.push(n3);
        continue;
      }
      if (n3 = this.tokenizer.autolink(e2)) {
        e2 = e2.substring(n3.raw.length), t2.push(n3);
        continue;
      }
      if (!this.state.inLink && (n3 = this.tokenizer.url(e2))) {
        e2 = e2.substring(n3.raw.length), t2.push(n3);
        continue;
      }
      let s3 = e2;
      if (this.options.extensions?.startInline) {
        let t3, n4 = 1 / 0, r3 = e2.slice(1);
        this.options.extensions.startInline.forEach((e3) => {
          t3 = e3.call({ lexer: this }, r3), "number" == typeof t3 && t3 >= 0 && (n4 = Math.min(n4, t3));
        }), n4 < 1 / 0 && n4 >= 0 && (s3 = e2.substring(0, n4 + 1));
      }
      if (n3 = this.tokenizer.inlineText(s3)) {
        e2 = e2.substring(n3.raw.length), "_" !== n3.raw.slice(-1) && (i2 = n3.raw.slice(-1)), l2 = true;
        let r3 = t2.at(-1);
        "text" === r3?.type ? (r3.raw += n3.raw, r3.text += n3.text) : t2.push(n3);
        continue;
      }
      if (e2) {
        let t3 = "Infinite loop on byte: " + e2.charCodeAt(0);
        if (this.options.silent) {
          console.error(t3);
          break;
        }
        throw new Error(t3);
      }
    }
    return t2;
  }
}, ue = class {
  options;
  parser;
  constructor(e2) {
    this.options = e2 || t;
  }
  space(e2) {
    return "";
  }
  code({ text: e2, lang: t2, escaped: n2 }) {
    let r2 = (t2 || "").match(i.notSpaceStart)?.[0], s2 = e2.replace(i.endingNewline, "") + "\n";
    return r2 ? '<pre><code class="language-' + se(r2) + '">' + (n2 ? s2 : se(s2, true)) + "</code></pre>\n" : "<pre><code>" + (n2 ? s2 : se(s2, true)) + "</code></pre>\n";
  }
  blockquote({ tokens: e2 }) {
    return `<blockquote>
${this.parser.parse(e2)}</blockquote>
`;
  }
  html({ text: e2 }) {
    return e2;
  }
  def(e2) {
    return "";
  }
  heading({ tokens: e2, depth: t2 }) {
    return `<h${t2}>${this.parser.parseInline(e2)}</h${t2}>
`;
  }
  hr(e2) {
    return "<hr>\n";
  }
  list(e2) {
    let t2 = e2.ordered, n2 = e2.start, r2 = "";
    for (let l2 = 0; l2 < e2.items.length; l2++) {
      let t3 = e2.items[l2];
      r2 += this.listitem(t3);
    }
    let s2 = t2 ? "ol" : "ul";
    return "<" + s2 + (t2 && 1 !== n2 ? ' start="' + n2 + '"' : "") + ">\n" + r2 + "</" + s2 + ">\n";
  }
  listitem(e2) {
    return `<li>${this.parser.parse(e2.tokens)}</li>
`;
  }
  checkbox({ checked: e2 }) {
    return "<input " + (e2 ? 'checked="" ' : "") + 'disabled="" type="checkbox"> ';
  }
  paragraph({ tokens: e2 }) {
    return `<p>${this.parser.parseInline(e2)}</p>
`;
  }
  table(e2) {
    let t2 = "", n2 = "";
    for (let s2 = 0; s2 < e2.header.length; s2++) n2 += this.tablecell(e2.header[s2]);
    t2 += this.tablerow({ text: n2 });
    let r2 = "";
    for (let s2 = 0; s2 < e2.rows.length; s2++) {
      let t3 = e2.rows[s2];
      n2 = "";
      for (let e3 = 0; e3 < t3.length; e3++) n2 += this.tablecell(t3[e3]);
      r2 += this.tablerow({ text: n2 });
    }
    return r2 && (r2 = `<tbody>${r2}</tbody>`), "<table>\n<thead>\n" + t2 + "</thead>\n" + r2 + "</table>\n";
  }
  tablerow({ text: e2 }) {
    return `<tr>
${e2}</tr>
`;
  }
  tablecell(e2) {
    let t2 = this.parser.parseInline(e2.tokens), n2 = e2.header ? "th" : "td";
    return (e2.align ? `<${n2} align="${e2.align}">` : `<${n2}>`) + t2 + `</${n2}>
`;
  }
  strong({ tokens: e2 }) {
    return `<strong>${this.parser.parseInline(e2)}</strong>`;
  }
  em({ tokens: e2 }) {
    return `<em>${this.parser.parseInline(e2)}</em>`;
  }
  codespan({ text: e2 }) {
    return `<code>${se(e2, true)}</code>`;
  }
  br(e2) {
    return "<br>";
  }
  del({ tokens: e2 }) {
    return `<del>${this.parser.parseInline(e2)}</del>`;
  }
  link({ href: e2, title: t2, tokens: n2 }) {
    let r2 = this.parser.parseInline(n2), s2 = le(e2);
    if (null === s2) return r2;
    let l2 = '<a href="' + (e2 = s2) + '"';
    return t2 && (l2 += ' title="' + se(t2) + '"'), l2 += ">" + r2 + "</a>", l2;
  }
  image({ href: e2, title: t2, text: n2, tokens: r2 }) {
    r2 && (n2 = this.parser.parseInline(r2, this.parser.textRenderer));
    let s2 = le(e2);
    if (null === s2) return se(n2);
    let l2 = `<img src="${e2 = s2}" alt="${se(n2)}"`;
    return t2 && (l2 += ` title="${se(t2)}"`), l2 += ">", l2;
  }
  text(e2) {
    return "tokens" in e2 && e2.tokens ? this.parser.parseInline(e2.tokens) : "escaped" in e2 && e2.escaped ? e2.text : se(e2.text);
  }
}, ge = class {
  strong({ text: e2 }) {
    return e2;
  }
  em({ text: e2 }) {
    return e2;
  }
  codespan({ text: e2 }) {
    return e2;
  }
  del({ text: e2 }) {
    return e2;
  }
  html({ text: e2 }) {
    return e2;
  }
  text({ text: e2 }) {
    return e2;
  }
  link({ text: e2 }) {
    return "" + e2;
  }
  image({ text: e2 }) {
    return "" + e2;
  }
  br() {
    return "";
  }
  checkbox({ raw: e2 }) {
    return e2;
  }
}, ke = class u2 {
  options;
  renderer;
  textRenderer;
  constructor(e2) {
    this.options = e2 || t, this.options.renderer = this.options.renderer || new ue(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new ge();
  }
  static parse(e2, t2) {
    return new u2(t2).parse(e2);
  }
  static parseInline(e2, t2) {
    return new u2(t2).parseInline(e2);
  }
  parse(e2) {
    this.renderer.parser = this;
    let t2 = "";
    for (let n2 = 0; n2 < e2.length; n2++) {
      let r2 = e2[n2];
      if (this.options.extensions?.renderers?.[r2.type]) {
        let e3 = r2, n3 = this.options.extensions.renderers[e3.type].call({ parser: this }, e3);
        if (false !== n3 || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "def", "paragraph", "text"].includes(e3.type)) {
          t2 += n3 || "";
          continue;
        }
      }
      let s2 = r2;
      switch (s2.type) {
        case "space":
          t2 += this.renderer.space(s2);
          break;
        case "hr":
          t2 += this.renderer.hr(s2);
          break;
        case "heading":
          t2 += this.renderer.heading(s2);
          break;
        case "code":
          t2 += this.renderer.code(s2);
          break;
        case "table":
          t2 += this.renderer.table(s2);
          break;
        case "blockquote":
          t2 += this.renderer.blockquote(s2);
          break;
        case "list":
          t2 += this.renderer.list(s2);
          break;
        case "checkbox":
          t2 += this.renderer.checkbox(s2);
          break;
        case "html":
          t2 += this.renderer.html(s2);
          break;
        case "def":
          t2 += this.renderer.def(s2);
          break;
        case "paragraph":
          t2 += this.renderer.paragraph(s2);
          break;
        case "text":
          t2 += this.renderer.text(s2);
          break;
        default: {
          let e3 = 'Token with "' + s2.type + '" type was not found.';
          if (this.options.silent) return console.error(e3), "";
          throw new Error(e3);
        }
      }
    }
    return t2;
  }
  parseInline(e2, t2 = this.renderer) {
    this.renderer.parser = this;
    let n2 = "";
    for (let r2 = 0; r2 < e2.length; r2++) {
      let s2 = e2[r2];
      if (this.options.extensions?.renderers?.[s2.type]) {
        let e3 = this.options.extensions.renderers[s2.type].call({ parser: this }, s2);
        if (false !== e3 || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(s2.type)) {
          n2 += e3 || "";
          continue;
        }
      }
      let l2 = s2;
      switch (l2.type) {
        case "escape":
        case "text":
          n2 += t2.text(l2);
          break;
        case "html":
          n2 += t2.html(l2);
          break;
        case "link":
          n2 += t2.link(l2);
          break;
        case "image":
          n2 += t2.image(l2);
          break;
        case "checkbox":
          n2 += t2.checkbox(l2);
          break;
        case "strong":
          n2 += t2.strong(l2);
          break;
        case "em":
          n2 += t2.em(l2);
          break;
        case "codespan":
          n2 += t2.codespan(l2);
          break;
        case "br":
          n2 += t2.br(l2);
          break;
        case "del":
          n2 += t2.del(l2);
          break;
        default: {
          let e3 = 'Token with "' + l2.type + '" type was not found.';
          if (this.options.silent) return console.error(e3), "";
          throw new Error(e3);
        }
      }
    }
    return n2;
  }
}, de = class {
  options;
  block;
  constructor(e2) {
    this.options = e2 || t;
  }
  static passThroughHooks = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens", "emStrongMask"]);
  static passThroughHooksRespectAsync = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens"]);
  preprocess(e2) {
    return e2;
  }
  postprocess(e2) {
    return e2;
  }
  processAllTokens(e2) {
    return e2;
  }
  emStrongMask(e2) {
    return e2;
  }
  provideLexer(e2 = this.block) {
    return e2 ? pe.lex : pe.lexInline;
  }
  provideParser(e2 = this.block) {
    return e2 ? ke.parse : ke.parseInline;
  }
}, fe = class {
  defaults = { async: false, breaks: false, extensions: null, gfm: true, hooks: null, pedantic: false, renderer: null, silent: false, tokenizer: null, walkTokens: null };
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = ke;
  Renderer = ue;
  TextRenderer = ge;
  Lexer = pe;
  Tokenizer = he;
  Hooks = de;
  constructor(...e2) {
    this.use(...e2);
  }
  walkTokens(e2, t2) {
    let n2 = [];
    for (let r2 of e2) switch (n2 = n2.concat(t2.call(this, r2)), r2.type) {
      case "table": {
        let e3 = r2;
        for (let r3 of e3.header) n2 = n2.concat(this.walkTokens(r3.tokens, t2));
        for (let r3 of e3.rows) for (let e4 of r3) n2 = n2.concat(this.walkTokens(e4.tokens, t2));
        break;
      }
      case "list": {
        let e3 = r2;
        n2 = n2.concat(this.walkTokens(e3.items, t2));
        break;
      }
      default: {
        let e3 = r2;
        this.defaults.extensions?.childTokens?.[e3.type] ? this.defaults.extensions.childTokens[e3.type].forEach((r3) => {
          let s2 = e3[r3].flat(1 / 0);
          n2 = n2.concat(this.walkTokens(s2, t2));
        }) : e3.tokens && (n2 = n2.concat(this.walkTokens(e3.tokens, t2)));
      }
    }
    return n2;
  }
  use(...e2) {
    let t2 = this.defaults.extensions || { renderers: {}, childTokens: {} };
    return e2.forEach((e3) => {
      let n2 = { ...e3 };
      if (n2.async = this.defaults.async || n2.async || false, e3.extensions && (e3.extensions.forEach((e4) => {
        if (!e4.name) throw new Error("extension name required");
        if ("renderer" in e4) {
          let n3 = t2.renderers[e4.name];
          t2.renderers[e4.name] = n3 ? function(...t3) {
            let r2 = e4.renderer.apply(this, t3);
            return false === r2 && (r2 = n3.apply(this, t3)), r2;
          } : e4.renderer;
        }
        if ("tokenizer" in e4) {
          if (!e4.level || "block" !== e4.level && "inline" !== e4.level) throw new Error("extension level must be 'block' or 'inline'");
          let n3 = t2[e4.level];
          n3 ? n3.unshift(e4.tokenizer) : t2[e4.level] = [e4.tokenizer], e4.start && ("block" === e4.level ? t2.startBlock ? t2.startBlock.push(e4.start) : t2.startBlock = [e4.start] : "inline" === e4.level && (t2.startInline ? t2.startInline.push(e4.start) : t2.startInline = [e4.start]));
        }
        "childTokens" in e4 && e4.childTokens && (t2.childTokens[e4.name] = e4.childTokens);
      }), n2.extensions = t2), e3.renderer) {
        let t3 = this.defaults.renderer || new ue(this.defaults);
        for (let n3 in e3.renderer) {
          if (!(n3 in t3)) throw new Error(`renderer '${n3}' does not exist`);
          if (["options", "parser"].includes(n3)) continue;
          let r2 = n3, s2 = e3.renderer[r2], l2 = t3[r2];
          t3[r2] = (...e4) => {
            let n4 = s2.apply(t3, e4);
            return false === n4 && (n4 = l2.apply(t3, e4)), n4 || "";
          };
        }
        n2.renderer = t3;
      }
      if (e3.tokenizer) {
        let t3 = this.defaults.tokenizer || new he(this.defaults);
        for (let n3 in e3.tokenizer) {
          if (!(n3 in t3)) throw new Error(`tokenizer '${n3}' does not exist`);
          if (["options", "rules", "lexer"].includes(n3)) continue;
          let r2 = n3, s2 = e3.tokenizer[r2], l2 = t3[r2];
          t3[r2] = (...e4) => {
            let n4 = s2.apply(t3, e4);
            return false === n4 && (n4 = l2.apply(t3, e4)), n4;
          };
        }
        n2.tokenizer = t3;
      }
      if (e3.hooks) {
        let t3 = this.defaults.hooks || new de();
        for (let n3 in e3.hooks) {
          if (!(n3 in t3)) throw new Error(`hook '${n3}' does not exist`);
          if (["options", "block"].includes(n3)) continue;
          let r2 = n3, s2 = e3.hooks[r2], l2 = t3[r2];
          de.passThroughHooks.has(n3) ? t3[r2] = (e4) => {
            if (this.defaults.async && de.passThroughHooksRespectAsync.has(n3)) return (async () => {
              let n4 = await s2.call(t3, e4);
              return l2.call(t3, n4);
            })();
            let r3 = s2.call(t3, e4);
            return l2.call(t3, r3);
          } : t3[r2] = (...e4) => {
            if (this.defaults.async) return (async () => {
              let n5 = await s2.apply(t3, e4);
              return false === n5 && (n5 = await l2.apply(t3, e4)), n5;
            })();
            let n4 = s2.apply(t3, e4);
            return false === n4 && (n4 = l2.apply(t3, e4)), n4;
          };
        }
        n2.hooks = t3;
      }
      if (e3.walkTokens) {
        let t3 = this.defaults.walkTokens, r2 = e3.walkTokens;
        n2.walkTokens = function(e4) {
          let n3 = [];
          return n3.push(r2.call(this, e4)), t3 && (n3 = n3.concat(t3.call(this, e4))), n3;
        };
      }
      this.defaults = { ...this.defaults, ...n2 };
    }), this;
  }
  setOptions(e2) {
    return this.defaults = { ...this.defaults, ...e2 }, this;
  }
  lexer(e2, t2) {
    return pe.lex(e2, t2 ?? this.defaults);
  }
  parser(e2, t2) {
    return ke.parse(e2, t2 ?? this.defaults);
  }
  parseMarkdown(e2) {
    return (t2, n2) => {
      let r2 = { ...n2 }, s2 = { ...this.defaults, ...r2 }, l2 = this.onError(!!s2.silent, !!s2.async);
      if (true === this.defaults.async && false === r2.async) return l2(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof t2 > "u" || null === t2) return l2(new Error("marked(): input parameter is undefined or null"));
      if ("string" != typeof t2) return l2(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(t2) + ", string expected"));
      if (s2.hooks && (s2.hooks.options = s2, s2.hooks.block = e2), s2.async) return (async () => {
        let n3 = s2.hooks ? await s2.hooks.preprocess(t2) : t2, r3 = await (s2.hooks ? await s2.hooks.provideLexer(e2) : e2 ? pe.lex : pe.lexInline)(n3, s2), l3 = s2.hooks ? await s2.hooks.processAllTokens(r3) : r3;
        s2.walkTokens && await Promise.all(this.walkTokens(l3, s2.walkTokens));
        let i2 = await (s2.hooks ? await s2.hooks.provideParser(e2) : e2 ? ke.parse : ke.parseInline)(l3, s2);
        return s2.hooks ? await s2.hooks.postprocess(i2) : i2;
      })().catch(l2);
      try {
        s2.hooks && (t2 = s2.hooks.preprocess(t2));
        let n3 = (s2.hooks ? s2.hooks.provideLexer(e2) : e2 ? pe.lex : pe.lexInline)(t2, s2);
        s2.hooks && (n3 = s2.hooks.processAllTokens(n3)), s2.walkTokens && this.walkTokens(n3, s2.walkTokens);
        let r3 = (s2.hooks ? s2.hooks.provideParser(e2) : e2 ? ke.parse : ke.parseInline)(n3, s2);
        return s2.hooks && (r3 = s2.hooks.postprocess(r3)), r3;
      } catch (i2) {
        return l2(i2);
      }
    };
  }
  onError(e2, t2) {
    return (n2) => {
      if (n2.message += "\nPlease report this to https://github.com/markedjs/marked.", e2) {
        let e3 = "<p>An error occurred:</p><pre>" + se(n2.message + "", true) + "</pre>";
        return t2 ? Promise.resolve(e3) : e3;
      }
      if (t2) return Promise.reject(n2);
      throw n2;
    };
  }
}, xe = new fe();
function be(e2, t2) {
  return xe.parse(e2, t2);
}
be.options = be.setOptions = function(e2) {
  return xe.setOptions(e2), be.defaults = xe.defaults, n(be.defaults), be;
}, be.getDefaults = e, be.defaults = t, be.use = function(...e2) {
  return xe.use(...e2), be.defaults = xe.defaults, n(be.defaults), be;
}, be.walkTokens = function(e2, t2) {
  return xe.walkTokens(e2, t2);
}, be.parseInline = xe.parseInline, be.Parser = ke, be.parser = ke.parse, be.Renderer = ue, be.TextRenderer = ge, be.Lexer = pe, be.lexer = pe.lex, be.Tokenizer = he, be.Hooks = de, be.parse = be, be.options, be.setOptions, be.use, be.walkTokens, be.parseInline, ke.parse, pe.lex;
export {
  de as Hooks,
  pe as Lexer,
  fe as Marked,
  ke as Parser,
  ue as Renderer,
  ge as TextRenderer,
  he as Tokenizer,
  t as defaults,
  e as getDefaults,
  be as marked
};
