import { r as reactExports, j as jsxRuntimeExports, g } from "../index.js";
import { o, d as u, w as wx, S as Sx, e as bx, k as kx, f as ox, h as hx, i as ux, A as Aa, W as Wa, Y as Ya, G as Ga, M as Mo, j as Wg } from "./template-DGSplFaZ.js";
import "../__vite_rsc_assets_manifest.js";
import "node:async_hooks";
const S = 6048e5, N = /* @__PURE__ */ Symbol.for("constructDateFrom");
function C(e, t) {
  return "function" == typeof e ? e(t) : e && "object" == typeof e && N in e ? e[N](t) : e instanceof Date ? new e.constructor(t) : new Date(t);
}
function T(e, t) {
  return C(t || e, e);
}
function x(e, t, n) {
  const o2 = T(e, n?.in);
  return isNaN(t) ? C(e, NaN) : t ? (o2.setDate(o2.getDate() + t), o2) : o2;
}
function Y(e, t, n) {
  const o2 = T(e, n?.in);
  if (isNaN(t)) return C(e, NaN);
  if (!t) return o2;
  const r = o2.getDate(), a = C(e, o2.getTime());
  a.setMonth(o2.getMonth() + t + 1, 0);
  return r >= a.getDate() ? a : (o2.setFullYear(a.getFullYear(), a.getMonth(), r), o2);
}
let E = {};
function L() {
  return E;
}
function P(e, t) {
  const n = L(), o2 = t?.weekStartsOn ?? t?.locale?.options?.weekStartsOn ?? n.weekStartsOn ?? n.locale?.options?.weekStartsOn ?? 0, r = T(e, t?.in), a = r.getDay(), i = (a < o2 ? 7 : 0) + a - o2;
  return r.setDate(r.getDate() - i), r.setHours(0, 0, 0, 0), r;
}
function F(e, t) {
  return P(e, { ...t, weekStartsOn: 1 });
}
function I(e, t) {
  const n = T(e, t?.in), o2 = n.getFullYear(), r = C(n, 0);
  r.setFullYear(o2 + 1, 0, 4), r.setHours(0, 0, 0, 0);
  const a = F(r), i = C(n, 0);
  i.setFullYear(o2, 0, 4), i.setHours(0, 0, 0, 0);
  const s = F(i);
  return n.getTime() >= a.getTime() ? o2 + 1 : n.getTime() >= s.getTime() ? o2 : o2 - 1;
}
function B(e) {
  const t = T(e), n = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds()));
  return n.setUTCFullYear(t.getFullYear()), +e - +n;
}
function _(e, ...t) {
  const n = C.bind(null, t.find((e2) => "object" == typeof e2));
  return t.map(n);
}
function Z(e, t) {
  const n = T(e, t?.in);
  return n.setHours(0, 0, 0, 0), n;
}
function H(e, t, n) {
  const [o2, r] = _(0, e, t), a = Z(o2), i = Z(r), s = +a - B(a), d = +i - B(i);
  return Math.round((s - d) / 864e5);
}
function A(e) {
  return e instanceof Date || "object" == typeof e && "[object Date]" === Object.prototype.toString.call(e);
}
function q(e, t, n) {
  const [o2, r] = _(0, e, t);
  return 12 * (o2.getFullYear() - r.getFullYear()) + (o2.getMonth() - r.getMonth());
}
function j(e, t) {
  const [n, o2] = _(0, t.start, t.end);
  return { start: n, end: o2 };
}
function z(e, t) {
  const n = T(e, t?.in);
  return n.setFullYear(n.getFullYear(), 0, 1), n.setHours(0, 0, 0, 0), n;
}
function $(e, t) {
  const n = L(), o2 = t?.weekStartsOn ?? t?.locale?.options?.weekStartsOn ?? n.weekStartsOn ?? n.locale?.options?.weekStartsOn ?? 0, r = T(e, t?.in), a = r.getDay(), i = 6 + (a < o2 ? -7 : 0) - (a - o2);
  return r.setDate(r.getDate() + i), r.setHours(23, 59, 59, 999), r;
}
const U = { lessThanXSeconds: { one: "less than a second", other: "less than {{count}} seconds" }, xSeconds: { one: "1 second", other: "{{count}} seconds" }, halfAMinute: "half a minute", lessThanXMinutes: { one: "less than a minute", other: "less than {{count}} minutes" }, xMinutes: { one: "1 minute", other: "{{count}} minutes" }, aboutXHours: { one: "about 1 hour", other: "about {{count}} hours" }, xHours: { one: "1 hour", other: "{{count}} hours" }, xDays: { one: "1 day", other: "{{count}} days" }, aboutXWeeks: { one: "about 1 week", other: "about {{count}} weeks" }, xWeeks: { one: "1 week", other: "{{count}} weeks" }, aboutXMonths: { one: "about 1 month", other: "about {{count}} months" }, xMonths: { one: "1 month", other: "{{count}} months" }, aboutXYears: { one: "about 1 year", other: "about {{count}} years" }, xYears: { one: "1 year", other: "{{count}} years" }, overXYears: { one: "over 1 year", other: "over {{count}} years" }, almostXYears: { one: "almost 1 year", other: "almost {{count}} years" } };
function G(e) {
  return (t = {}) => {
    const n = t.width ? String(t.width) : e.defaultWidth;
    return e.formats[n] || e.formats[e.defaultWidth];
  };
}
const Q = { date: G({ formats: { full: "EEEE, MMMM do, y", long: "MMMM do, y", medium: "MMM d, y", short: "MM/dd/yyyy" }, defaultWidth: "full" }), time: G({ formats: { full: "h:mm:ss a zzzz", long: "h:mm:ss a z", medium: "h:mm:ss a", short: "h:mm a" }, defaultWidth: "full" }), dateTime: G({ formats: { full: "{{date}} 'at' {{time}}", long: "{{date}} 'at' {{time}}", medium: "{{date}}, {{time}}", short: "{{date}}, {{time}}" }, defaultWidth: "full" }) }, R = { lastWeek: "'last' eeee 'at' p", yesterday: "'yesterday at' p", today: "'today at' p", tomorrow: "'tomorrow at' p", nextWeek: "eeee 'at' p", other: "P" };
function X(e) {
  return (t, n) => {
    let o2;
    if ("formatting" === (n?.context ? String(n.context) : "standalone") && e.formattingValues) {
      const t2 = e.defaultFormattingWidth || e.defaultWidth, r = n?.width ? String(n.width) : t2;
      o2 = e.formattingValues[r] || e.formattingValues[t2];
    } else {
      const t2 = e.defaultWidth, r = n?.width ? String(n.width) : e.defaultWidth;
      o2 = e.values[r] || e.values[t2];
    }
    return o2[e.argumentCallback ? e.argumentCallback(t) : t];
  };
}
function K(e) {
  return (t, n = {}) => {
    const o2 = n.width, r = o2 && e.matchPatterns[o2] || e.matchPatterns[e.defaultMatchWidth], a = t.match(r);
    if (!a) return null;
    const i = a[0], s = o2 && e.parsePatterns[o2] || e.parsePatterns[e.defaultParseWidth], d = Array.isArray(s) ? (function(e2, t2) {
      for (let n2 = 0; n2 < e2.length; n2++) if (t2(e2[n2])) return n2;
      return;
    })(s, (e2) => e2.test(i)) : (function(e2, t2) {
      for (const n2 in e2) if (Object.prototype.hasOwnProperty.call(e2, n2) && t2(e2[n2])) return n2;
      return;
    })(s, (e2) => e2.test(i));
    let l;
    l = e.valueCallback ? e.valueCallback(d) : d, l = n.valueCallback ? n.valueCallback(l) : l;
    return { value: l, rest: t.slice(i.length) };
  };
}
var J;
const V = { code: "en-US", formatDistance: (e, t, n) => {
  let o2;
  const r = U[e];
  return o2 = "string" == typeof r ? r : 1 === t ? r.one : r.other.replace("{{count}}", t.toString()), n?.addSuffix ? n.comparison && n.comparison > 0 ? "in " + o2 : o2 + " ago" : o2;
}, formatLong: Q, formatRelative: (e, t, n, o2) => R[e], localize: { ordinalNumber: (e, t) => {
  const n = Number(e), o2 = n % 100;
  if (o2 > 20 || o2 < 10) switch (o2 % 10) {
    case 1:
      return n + "st";
    case 2:
      return n + "nd";
    case 3:
      return n + "rd";
  }
  return n + "th";
}, era: X({ values: { narrow: ["B", "A"], abbreviated: ["BC", "AD"], wide: ["Before Christ", "Anno Domini"] }, defaultWidth: "wide" }), quarter: X({ values: { narrow: ["1", "2", "3", "4"], abbreviated: ["Q1", "Q2", "Q3", "Q4"], wide: ["1st quarter", "2nd quarter", "3rd quarter", "4th quarter"] }, defaultWidth: "wide", argumentCallback: (e) => e - 1 }), month: X({ values: { narrow: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"], abbreviated: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], wide: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] }, defaultWidth: "wide" }), day: X({ values: { narrow: ["S", "M", "T", "W", "T", "F", "S"], short: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"], abbreviated: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], wide: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] }, defaultWidth: "wide" }), dayPeriod: X({ values: { narrow: { am: "a", pm: "p", midnight: "mi", noon: "n", morning: "morning", afternoon: "afternoon", evening: "evening", night: "night" }, abbreviated: { am: "AM", pm: "PM", midnight: "midnight", noon: "noon", morning: "morning", afternoon: "afternoon", evening: "evening", night: "night" }, wide: { am: "a.m.", pm: "p.m.", midnight: "midnight", noon: "noon", morning: "morning", afternoon: "afternoon", evening: "evening", night: "night" } }, defaultWidth: "wide", formattingValues: { narrow: { am: "a", pm: "p", midnight: "mi", noon: "n", morning: "in the morning", afternoon: "in the afternoon", evening: "in the evening", night: "at night" }, abbreviated: { am: "AM", pm: "PM", midnight: "midnight", noon: "noon", morning: "in the morning", afternoon: "in the afternoon", evening: "in the evening", night: "at night" }, wide: { am: "a.m.", pm: "p.m.", midnight: "midnight", noon: "noon", morning: "in the morning", afternoon: "in the afternoon", evening: "in the evening", night: "at night" } }, defaultFormattingWidth: "wide" }) }, match: { ordinalNumber: (J = { matchPattern: /^(\d+)(th|st|nd|rd)?/i, parsePattern: /\d+/i, valueCallback: (e) => parseInt(e, 10) }, (e, t = {}) => {
  const n = e.match(J.matchPattern);
  if (!n) return null;
  const o2 = n[0], r = e.match(J.parsePattern);
  if (!r) return null;
  let a = J.valueCallback ? J.valueCallback(r[0]) : r[0];
  return a = t.valueCallback ? t.valueCallback(a) : a, { value: a, rest: e.slice(o2.length) };
}), era: K({ matchPatterns: { narrow: /^(b|a)/i, abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i, wide: /^(before christ|before common era|anno domini|common era)/i }, defaultMatchWidth: "wide", parsePatterns: { any: [/^b/i, /^(a|c)/i] }, defaultParseWidth: "any" }), quarter: K({ matchPatterns: { narrow: /^[1234]/i, abbreviated: /^q[1234]/i, wide: /^[1234](th|st|nd|rd)? quarter/i }, defaultMatchWidth: "wide", parsePatterns: { any: [/1/i, /2/i, /3/i, /4/i] }, defaultParseWidth: "any", valueCallback: (e) => e + 1 }), month: K({ matchPatterns: { narrow: /^[jfmasond]/i, abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i }, defaultMatchWidth: "wide", parsePatterns: { narrow: [/^j/i, /^f/i, /^m/i, /^a/i, /^m/i, /^j/i, /^j/i, /^a/i, /^s/i, /^o/i, /^n/i, /^d/i], any: [/^ja/i, /^f/i, /^mar/i, /^ap/i, /^may/i, /^jun/i, /^jul/i, /^au/i, /^s/i, /^o/i, /^n/i, /^d/i] }, defaultParseWidth: "any" }), day: K({ matchPatterns: { narrow: /^[smtwf]/i, short: /^(su|mo|tu|we|th|fr|sa)/i, abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i, wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i }, defaultMatchWidth: "wide", parsePatterns: { narrow: [/^s/i, /^m/i, /^t/i, /^w/i, /^t/i, /^f/i, /^s/i], any: [/^su/i, /^m/i, /^tu/i, /^w/i, /^th/i, /^f/i, /^sa/i] }, defaultParseWidth: "any" }), dayPeriod: K({ matchPatterns: { narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i, any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i }, defaultMatchWidth: "any", parsePatterns: { any: { am: /^a/i, pm: /^p/i, midnight: /^mi/i, noon: /^no/i, morning: /morning/i, afternoon: /afternoon/i, evening: /evening/i, night: /night/i } }, defaultParseWidth: "any" }) }, options: { weekStartsOn: 0, firstWeekContainsDate: 1 } };
function ee(e, t) {
  const n = T(e, t?.in), o2 = +F(n) - +(function(e2, t2) {
    const n2 = I(e2, t2), o3 = C(e2, 0);
    return o3.setFullYear(n2, 0, 4), o3.setHours(0, 0, 0, 0), F(o3);
  })(n);
  return Math.round(o2 / S) + 1;
}
function te(e, t) {
  const n = T(e, t?.in), o2 = n.getFullYear(), r = L(), a = t?.firstWeekContainsDate ?? t?.locale?.options?.firstWeekContainsDate ?? r.firstWeekContainsDate ?? r.locale?.options?.firstWeekContainsDate ?? 1, i = C(t?.in || e, 0);
  i.setFullYear(o2 + 1, 0, a), i.setHours(0, 0, 0, 0);
  const s = P(i, t), d = C(t?.in || e, 0);
  d.setFullYear(o2, 0, a), d.setHours(0, 0, 0, 0);
  const l = P(d, t);
  return +n >= +s ? o2 + 1 : +n >= +l ? o2 : o2 - 1;
}
function ne(e, t) {
  const n = T(e, t?.in), o2 = +P(n, t) - +(function(e2, t2) {
    const n2 = L(), o3 = t2?.firstWeekContainsDate ?? t2?.locale?.options?.firstWeekContainsDate ?? n2.firstWeekContainsDate ?? n2.locale?.options?.firstWeekContainsDate ?? 1, r = te(e2, t2), a = C(t2?.in || e2, 0);
    return a.setFullYear(r, 0, o3), a.setHours(0, 0, 0, 0), P(a, t2);
  })(n, t);
  return Math.round(o2 / S) + 1;
}
function oe(e, t) {
  return (e < 0 ? "-" : "") + Math.abs(e).toString().padStart(t, "0");
}
const re = { y(e, t) {
  const n = e.getFullYear(), o2 = n > 0 ? n : 1 - n;
  return oe("yy" === t ? o2 % 100 : o2, t.length);
}, M(e, t) {
  const n = e.getMonth();
  return "M" === t ? String(n + 1) : oe(n + 1, 2);
}, d: (e, t) => oe(e.getDate(), t.length), a(e, t) {
  const n = e.getHours() / 12 >= 1 ? "pm" : "am";
  switch (t) {
    case "a":
    case "aa":
      return n.toUpperCase();
    case "aaa":
      return n;
    case "aaaaa":
      return n[0];
    default:
      return "am" === n ? "a.m." : "p.m.";
  }
}, h: (e, t) => oe(e.getHours() % 12 || 12, t.length), H: (e, t) => oe(e.getHours(), t.length), m: (e, t) => oe(e.getMinutes(), t.length), s: (e, t) => oe(e.getSeconds(), t.length), S(e, t) {
  const n = t.length, o2 = e.getMilliseconds();
  return oe(Math.trunc(o2 * Math.pow(10, n - 3)), t.length);
} }, ae = "midnight", ie = "noon", se = "morning", de = "afternoon", le = "evening", ce = "night", ue = { G: function(e, t, n) {
  const o2 = e.getFullYear() > 0 ? 1 : 0;
  switch (t) {
    case "G":
    case "GG":
    case "GGG":
      return n.era(o2, { width: "abbreviated" });
    case "GGGGG":
      return n.era(o2, { width: "narrow" });
    default:
      return n.era(o2, { width: "wide" });
  }
}, y: function(e, t, n) {
  if ("yo" === t) {
    const t2 = e.getFullYear(), o2 = t2 > 0 ? t2 : 1 - t2;
    return n.ordinalNumber(o2, { unit: "year" });
  }
  return re.y(e, t);
}, Y: function(e, t, n, o2) {
  const r = te(e, o2), a = r > 0 ? r : 1 - r;
  if ("YY" === t) {
    return oe(a % 100, 2);
  }
  return "Yo" === t ? n.ordinalNumber(a, { unit: "year" }) : oe(a, t.length);
}, R: function(e, t) {
  return oe(I(e), t.length);
}, u: function(e, t) {
  return oe(e.getFullYear(), t.length);
}, Q: function(e, t, n) {
  const o2 = Math.ceil((e.getMonth() + 1) / 3);
  switch (t) {
    case "Q":
      return String(o2);
    case "QQ":
      return oe(o2, 2);
    case "Qo":
      return n.ordinalNumber(o2, { unit: "quarter" });
    case "QQQ":
      return n.quarter(o2, { width: "abbreviated", context: "formatting" });
    case "QQQQQ":
      return n.quarter(o2, { width: "narrow", context: "formatting" });
    default:
      return n.quarter(o2, { width: "wide", context: "formatting" });
  }
}, q: function(e, t, n) {
  const o2 = Math.ceil((e.getMonth() + 1) / 3);
  switch (t) {
    case "q":
      return String(o2);
    case "qq":
      return oe(o2, 2);
    case "qo":
      return n.ordinalNumber(o2, { unit: "quarter" });
    case "qqq":
      return n.quarter(o2, { width: "abbreviated", context: "standalone" });
    case "qqqqq":
      return n.quarter(o2, { width: "narrow", context: "standalone" });
    default:
      return n.quarter(o2, { width: "wide", context: "standalone" });
  }
}, M: function(e, t, n) {
  const o2 = e.getMonth();
  switch (t) {
    case "M":
    case "MM":
      return re.M(e, t);
    case "Mo":
      return n.ordinalNumber(o2 + 1, { unit: "month" });
    case "MMM":
      return n.month(o2, { width: "abbreviated", context: "formatting" });
    case "MMMMM":
      return n.month(o2, { width: "narrow", context: "formatting" });
    default:
      return n.month(o2, { width: "wide", context: "formatting" });
  }
}, L: function(e, t, n) {
  const o2 = e.getMonth();
  switch (t) {
    case "L":
      return String(o2 + 1);
    case "LL":
      return oe(o2 + 1, 2);
    case "Lo":
      return n.ordinalNumber(o2 + 1, { unit: "month" });
    case "LLL":
      return n.month(o2, { width: "abbreviated", context: "standalone" });
    case "LLLLL":
      return n.month(o2, { width: "narrow", context: "standalone" });
    default:
      return n.month(o2, { width: "wide", context: "standalone" });
  }
}, w: function(e, t, n, o2) {
  const r = ne(e, o2);
  return "wo" === t ? n.ordinalNumber(r, { unit: "week" }) : oe(r, t.length);
}, I: function(e, t, n) {
  const o2 = ee(e);
  return "Io" === t ? n.ordinalNumber(o2, { unit: "week" }) : oe(o2, t.length);
}, d: function(e, t, n) {
  return "do" === t ? n.ordinalNumber(e.getDate(), { unit: "date" }) : re.d(e, t);
}, D: function(e, t, n) {
  const o2 = (function(e2, t2) {
    const n2 = T(e2, t2?.in);
    return H(n2, z(n2)) + 1;
  })(e);
  return "Do" === t ? n.ordinalNumber(o2, { unit: "dayOfYear" }) : oe(o2, t.length);
}, E: function(e, t, n) {
  const o2 = e.getDay();
  switch (t) {
    case "E":
    case "EE":
    case "EEE":
      return n.day(o2, { width: "abbreviated", context: "formatting" });
    case "EEEEE":
      return n.day(o2, { width: "narrow", context: "formatting" });
    case "EEEEEE":
      return n.day(o2, { width: "short", context: "formatting" });
    default:
      return n.day(o2, { width: "wide", context: "formatting" });
  }
}, e: function(e, t, n, o2) {
  const r = e.getDay(), a = (r - o2.weekStartsOn + 8) % 7 || 7;
  switch (t) {
    case "e":
      return String(a);
    case "ee":
      return oe(a, 2);
    case "eo":
      return n.ordinalNumber(a, { unit: "day" });
    case "eee":
      return n.day(r, { width: "abbreviated", context: "formatting" });
    case "eeeee":
      return n.day(r, { width: "narrow", context: "formatting" });
    case "eeeeee":
      return n.day(r, { width: "short", context: "formatting" });
    default:
      return n.day(r, { width: "wide", context: "formatting" });
  }
}, c: function(e, t, n, o2) {
  const r = e.getDay(), a = (r - o2.weekStartsOn + 8) % 7 || 7;
  switch (t) {
    case "c":
      return String(a);
    case "cc":
      return oe(a, t.length);
    case "co":
      return n.ordinalNumber(a, { unit: "day" });
    case "ccc":
      return n.day(r, { width: "abbreviated", context: "standalone" });
    case "ccccc":
      return n.day(r, { width: "narrow", context: "standalone" });
    case "cccccc":
      return n.day(r, { width: "short", context: "standalone" });
    default:
      return n.day(r, { width: "wide", context: "standalone" });
  }
}, i: function(e, t, n) {
  const o2 = e.getDay(), r = 0 === o2 ? 7 : o2;
  switch (t) {
    case "i":
      return String(r);
    case "ii":
      return oe(r, t.length);
    case "io":
      return n.ordinalNumber(r, { unit: "day" });
    case "iii":
      return n.day(o2, { width: "abbreviated", context: "formatting" });
    case "iiiii":
      return n.day(o2, { width: "narrow", context: "formatting" });
    case "iiiiii":
      return n.day(o2, { width: "short", context: "formatting" });
    default:
      return n.day(o2, { width: "wide", context: "formatting" });
  }
}, a: function(e, t, n) {
  const o2 = e.getHours() / 12 >= 1 ? "pm" : "am";
  switch (t) {
    case "a":
    case "aa":
      return n.dayPeriod(o2, { width: "abbreviated", context: "formatting" });
    case "aaa":
      return n.dayPeriod(o2, { width: "abbreviated", context: "formatting" }).toLowerCase();
    case "aaaaa":
      return n.dayPeriod(o2, { width: "narrow", context: "formatting" });
    default:
      return n.dayPeriod(o2, { width: "wide", context: "formatting" });
  }
}, b: function(e, t, n) {
  const o2 = e.getHours();
  let r;
  switch (r = 12 === o2 ? ie : 0 === o2 ? ae : o2 / 12 >= 1 ? "pm" : "am", t) {
    case "b":
    case "bb":
      return n.dayPeriod(r, { width: "abbreviated", context: "formatting" });
    case "bbb":
      return n.dayPeriod(r, { width: "abbreviated", context: "formatting" }).toLowerCase();
    case "bbbbb":
      return n.dayPeriod(r, { width: "narrow", context: "formatting" });
    default:
      return n.dayPeriod(r, { width: "wide", context: "formatting" });
  }
}, B: function(e, t, n) {
  const o2 = e.getHours();
  let r;
  switch (r = o2 >= 17 ? le : o2 >= 12 ? de : o2 >= 4 ? se : ce, t) {
    case "B":
    case "BB":
    case "BBB":
      return n.dayPeriod(r, { width: "abbreviated", context: "formatting" });
    case "BBBBB":
      return n.dayPeriod(r, { width: "narrow", context: "formatting" });
    default:
      return n.dayPeriod(r, { width: "wide", context: "formatting" });
  }
}, h: function(e, t, n) {
  if ("ho" === t) {
    let t2 = e.getHours() % 12;
    return 0 === t2 && (t2 = 12), n.ordinalNumber(t2, { unit: "hour" });
  }
  return re.h(e, t);
}, H: function(e, t, n) {
  return "Ho" === t ? n.ordinalNumber(e.getHours(), { unit: "hour" }) : re.H(e, t);
}, K: function(e, t, n) {
  const o2 = e.getHours() % 12;
  return "Ko" === t ? n.ordinalNumber(o2, { unit: "hour" }) : oe(o2, t.length);
}, k: function(e, t, n) {
  let o2 = e.getHours();
  return 0 === o2 && (o2 = 24), "ko" === t ? n.ordinalNumber(o2, { unit: "hour" }) : oe(o2, t.length);
}, m: function(e, t, n) {
  return "mo" === t ? n.ordinalNumber(e.getMinutes(), { unit: "minute" }) : re.m(e, t);
}, s: function(e, t, n) {
  return "so" === t ? n.ordinalNumber(e.getSeconds(), { unit: "second" }) : re.s(e, t);
}, S: function(e, t) {
  return re.S(e, t);
}, X: function(e, t, n) {
  const o2 = e.getTimezoneOffset();
  if (0 === o2) return "Z";
  switch (t) {
    case "X":
      return he(o2);
    case "XXXX":
    case "XX":
      return me(o2);
    default:
      return me(o2, ":");
  }
}, x: function(e, t, n) {
  const o2 = e.getTimezoneOffset();
  switch (t) {
    case "x":
      return he(o2);
    case "xxxx":
    case "xx":
      return me(o2);
    default:
      return me(o2, ":");
  }
}, O: function(e, t, n) {
  const o2 = e.getTimezoneOffset();
  switch (t) {
    case "O":
    case "OO":
    case "OOO":
      return "GMT" + fe(o2, ":");
    default:
      return "GMT" + me(o2, ":");
  }
}, z: function(e, t, n) {
  const o2 = e.getTimezoneOffset();
  switch (t) {
    case "z":
    case "zz":
    case "zzz":
      return "GMT" + fe(o2, ":");
    default:
      return "GMT" + me(o2, ":");
  }
}, t: function(e, t, n) {
  return oe(Math.trunc(+e / 1e3), t.length);
}, T: function(e, t, n) {
  return oe(+e, t.length);
} };
function fe(e, t = "") {
  const n = e > 0 ? "-" : "+", o2 = Math.abs(e), r = Math.trunc(o2 / 60), a = o2 % 60;
  return 0 === a ? n + String(r) : n + String(r) + t + oe(a, 2);
}
function he(e, t) {
  if (e % 60 == 0) {
    return (e > 0 ? "-" : "+") + oe(Math.abs(e) / 60, 2);
  }
  return me(e, t);
}
function me(e, t = "") {
  const n = e > 0 ? "-" : "+", o2 = Math.abs(e);
  return n + oe(Math.trunc(o2 / 60), 2) + t + oe(o2 % 60, 2);
}
const ye = (e, t) => {
  switch (e) {
    case "P":
      return t.date({ width: "short" });
    case "PP":
      return t.date({ width: "medium" });
    case "PPP":
      return t.date({ width: "long" });
    default:
      return t.date({ width: "full" });
  }
}, pe = (e, t) => {
  switch (e) {
    case "p":
      return t.time({ width: "short" });
    case "pp":
      return t.time({ width: "medium" });
    case "ppp":
      return t.time({ width: "long" });
    default:
      return t.time({ width: "full" });
  }
}, ge = { p: pe, P: (e, t) => {
  const n = e.match(/(P+)(p+)?/) || [], o2 = n[1], r = n[2];
  if (!r) return ye(e, t);
  let a;
  switch (o2) {
    case "P":
      a = t.dateTime({ width: "short" });
      break;
    case "PP":
      a = t.dateTime({ width: "medium" });
      break;
    case "PPP":
      a = t.dateTime({ width: "long" });
      break;
    default:
      a = t.dateTime({ width: "full" });
  }
  return a.replace("{{date}}", ye(o2, t)).replace("{{time}}", pe(r, t));
} }, be = /^D+$/, we = /^Y+$/, ve = ["D", "DD", "YY", "YYYY"];
const Me = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g, De = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g, ke = /^'([^]*?)'?$/, Oe = /''/g, We = /[a-zA-Z]/;
function Se(e, t, n) {
  const o2 = L(), r = n?.locale ?? o2.locale ?? V, a = n?.firstWeekContainsDate ?? n?.locale?.options?.firstWeekContainsDate ?? o2.firstWeekContainsDate ?? o2.locale?.options?.firstWeekContainsDate ?? 1, i = n?.weekStartsOn ?? n?.locale?.options?.weekStartsOn ?? o2.weekStartsOn ?? o2.locale?.options?.weekStartsOn ?? 0, s = T(e, n?.in);
  if (!(function(e2) {
    return !(!A(e2) && "number" != typeof e2 || isNaN(+T(e2)));
  })(s)) throw new RangeError("Invalid time value");
  let d = t.match(De).map((e2) => {
    const t2 = e2[0];
    if ("p" === t2 || "P" === t2) {
      return (0, ge[t2])(e2, r.formatLong);
    }
    return e2;
  }).join("").match(Me).map((e2) => {
    if ("''" === e2) return { isToken: false, value: "'" };
    const t2 = e2[0];
    if ("'" === t2) return { isToken: false, value: Ne(e2) };
    if (ue[t2]) return { isToken: true, value: e2 };
    if (t2.match(We)) throw new RangeError("Format string contains an unescaped latin alphabet character `" + t2 + "`");
    return { isToken: false, value: e2 };
  });
  r.localize.preprocessor && (d = r.localize.preprocessor(s, d));
  const l = { firstWeekContainsDate: a, weekStartsOn: i, locale: r };
  return d.map((o3) => {
    if (!o3.isToken) return o3.value;
    const a2 = o3.value;
    (!n?.useAdditionalWeekYearTokens && (function(e2) {
      return we.test(e2);
    })(a2) || !n?.useAdditionalDayOfYearTokens && (function(e2) {
      return be.test(e2);
    })(a2)) && (function(e2, t2, n2) {
      const o4 = (function(e3, t3, n3) {
        const o5 = "Y" === e3[0] ? "years" : "days of the month";
        return `Use \`${e3.toLowerCase()}\` instead of \`${e3}\` (in \`${t3}\`) for formatting ${o5} to the input \`${n3}\`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md`;
      })(e2, t2, n2);
      if (console.warn(o4), ve.includes(e2)) throw new RangeError(o4);
    })(a2, t, String(e));
    return (0, ue[a2[0]])(s, a2, r.localize, l);
  }).join("");
}
function Ne(e) {
  const t = e.match(ke);
  return t ? t[1].replace(Oe, "'") : e;
}
function Ce(e, t, n) {
  const o2 = T(e, n?.in), r = o2.getFullYear(), a = o2.getDate(), i = C(e, 0);
  i.setFullYear(r, t, 15), i.setHours(0, 0, 0, 0);
  const s = (function(e2, t2) {
    const n2 = T(e2, t2?.in), o3 = n2.getFullYear(), r2 = n2.getMonth(), a2 = C(n2, 0);
    return a2.setFullYear(o3, r2 + 1, 0), a2.setHours(0, 0, 0, 0), a2.getDate();
  })(i);
  return o2.setMonth(t, Math.min(a, s)), o2;
}
function Te(e, t, n) {
  const o2 = T(e, n?.in);
  return o2.setHours(t), o2;
}
function xe(e, t, n) {
  const o2 = T(e, n?.in);
  return o2.setMinutes(t), o2;
}
const Ye = {}, Ee = {};
function Le(e, t) {
  try {
    const n = (Ye[e] ||= new Intl.DateTimeFormat("en-US", { timeZone: e, timeZoneName: "longOffset" }).format)(t).split("GMT")[1];
    return n in Ee ? Ee[n] : Fe(n, n.split(":"));
  } catch {
    if (e in Ee) return Ee[e];
    const t2 = e?.match(Pe);
    return t2 ? Fe(e, t2.slice(1)) : NaN;
  }
}
const Pe = /([+-]\d\d):?(\d\d)?/;
function Fe(e, t) {
  const n = +(t[0] || 0), o2 = +(t[1] || 0), r = +(t[2] || 0) / 60;
  return Ee[e] = 60 * n + o2 > 0 ? 60 * n + o2 + r : 60 * n - o2 - r;
}
class TZDateMini extends Date {
  constructor(...e) {
    super(), e.length > 1 && "string" == typeof e[e.length - 1] && (this.timeZone = e.pop()), this.internal = /* @__PURE__ */ new Date(), isNaN(Le(this.timeZone, this)) ? this.setTime(NaN) : e.length ? "number" == typeof e[0] && (1 === e.length || 2 === e.length && "number" != typeof e[1]) ? this.setTime(e[0]) : "string" == typeof e[0] ? this.setTime(+new Date(e[0])) : e[0] instanceof Date ? this.setTime(+e[0]) : (this.setTime(+new Date(...e)), _e(this, e)) : this.setTime(Date.now());
  }
  static tz(e, ...t) {
    return t.length ? new TZDateMini(...t, e) : new TZDateMini(Date.now(), e);
  }
  withTimeZone(e) {
    return new TZDateMini(+this, e);
  }
  getTimezoneOffset() {
    const e = -Le(this.timeZone, this);
    return e > 0 ? Math.floor(e) : Math.ceil(e);
  }
  setTime(e) {
    return Date.prototype.setTime.apply(this, arguments), Be(this), +this;
  }
  [/* @__PURE__ */ Symbol.for("constructDateFrom")](e) {
    return new TZDateMini(+new Date(e), this.timeZone);
  }
}
const Ie = /^(get|set)(?!UTC)/;
function Be(e) {
  e.internal.setTime(+e), e.internal.setUTCSeconds(e.internal.getUTCSeconds() - Math.round(60 * -Le(e.timeZone, e)));
}
function _e(e, t) {
  const n = Array.isArray(t) ? (function(e2) {
    return Date.UTC(e2[0], e2.length > 1 ? e2[1] : 0, e2.length > 2 ? e2[2] : 1, ...e2.slice(3));
  })(t) : +e.internal, o2 = Le(e.timeZone, e), r = o2 > 0 ? Math.floor(o2) : Math.ceil(o2), a = /* @__PURE__ */ new Date(+e);
  a.setUTCHours(a.getUTCHours() - 1);
  const i = -/* @__PURE__ */ (/* @__PURE__ */ new Date(+e)).getTimezoneOffset(), s = -/* @__PURE__ */ (/* @__PURE__ */ new Date(+a)).getTimezoneOffset();
  let d = i;
  if (i - s && i !== r) {
    if (Date.prototype.getHours.apply(e) !== (Array.isArray(t) ? t[3] || 0 : e.internal.getUTCHours())) {
      const t2 = /* @__PURE__ */ new Date(+e), n2 = i - r;
      n2 && t2.setUTCMinutes(t2.getUTCMinutes() + n2);
      const o3 = Le(e.timeZone, t2);
      (o3 > 0 ? Math.floor(o3) : Math.ceil(o3)) === r && (d = s);
    }
  }
  const l = d - r;
  l && Date.prototype.setUTCMinutes.call(e, Date.prototype.getUTCMinutes.call(e) + l);
  const c = /* @__PURE__ */ new Date(+e);
  c.setUTCSeconds(0);
  const u2 = i > 0 ? c.getSeconds() : (c.getSeconds() - 60) % 60, f = Math.round(-60 * Le(e.timeZone, e)) % 60;
  (f || u2) && Date.prototype.setUTCSeconds.call(e, Date.prototype.getUTCSeconds.call(e) + f + u2);
  const h = Le(e.timeZone, e), m = h > 0 ? Math.floor(h) : Math.ceil(h), y = m !== r, p = -/* @__PURE__ */ (/* @__PURE__ */ new Date(+e)).getTimezoneOffset() - m - l, g2 = m - r, b = n - 60 * m * 1e3, w = g2 > 0 && Ze(e) - n === 60 * g2 * 1e3 && Ze(e, b) !== n;
  if (y && p && !w) {
    Date.prototype.setUTCMinutes.call(e, Date.prototype.getUTCMinutes.call(e) + p);
    const t2 = Le(e.timeZone, e), n2 = m - (t2 > 0 ? Math.floor(t2) : Math.ceil(t2));
    n2 && p < 0 && Date.prototype.setUTCMinutes.call(e, Date.prototype.getUTCMinutes.call(e) + n2);
  }
  Be(e);
  const v = (t ? n : n + 1e3 * f) - +e.internal;
  v && Math.abs(v) < 18e5 && (Date.prototype.setTime.call(e, +e + v), Be(e));
}
function Ze(e, t) {
  const n = new Date(t ?? +e);
  return n.setUTCSeconds(n.getUTCSeconds() - Math.round(60 * -Le(e.timeZone, n))), +n;
}
Object.getOwnPropertyNames(Date.prototype).forEach((e) => {
  if (!Ie.test(e)) return;
  const t = e.replace(Ie, "$1UTC");
  TZDateMini.prototype[t] && (e.startsWith("get") ? TZDateMini.prototype[e] = function() {
    return this.internal[t]();
  } : (TZDateMini.prototype[e] = function() {
    var e2;
    return Date.prototype[t].apply(this.internal, arguments), e2 = this, Date.prototype.setFullYear.call(e2, e2.internal.getUTCFullYear(), e2.internal.getUTCMonth(), e2.internal.getUTCDate()), Date.prototype.setHours.call(e2, e2.internal.getUTCHours(), e2.internal.getUTCMinutes(), e2.internal.getUTCSeconds(), e2.internal.getUTCMilliseconds()), _e(e2), +this;
  }, TZDateMini.prototype[t] = function() {
    return Date.prototype[t].apply(this, arguments), Be(this), +this;
  }));
});
class TZDate extends TZDateMini {
  static tz(e, ...t) {
    return t.length ? new TZDate(...t, e) : new TZDate(Date.now(), e);
  }
  toISOString() {
    const [e, t, n] = this.tzComponents(), o2 = `${e}${t}:${n}`;
    return this.internal.toISOString().slice(0, -1) + o2;
  }
  toString() {
    return `${this.toDateString()} ${this.toTimeString()}`;
  }
  toDateString() {
    const [e, t, n, o2] = this.internal.toUTCString().split(" ");
    return `${e?.slice(0, -1)} ${n} ${t} ${o2}`;
  }
  toTimeString() {
    const e = this.internal.toUTCString().split(" ")[4], [t, n, o2] = this.tzComponents();
    return `${e} GMT${t}${n}${o2} (${(function(e2, t2, n2 = "long") {
      return new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: e2, timeZoneName: n2 }).format(t2).split(/\s/g).slice(2).join(" ");
    })(this.timeZone, this)})`;
  }
  toLocaleString(e, t) {
    return Date.prototype.toLocaleString.call(this, e, { ...t, timeZone: t?.timeZone || this.timeZone });
  }
  toLocaleDateString(e, t) {
    return Date.prototype.toLocaleDateString.call(this, e, { ...t, timeZone: t?.timeZone || this.timeZone });
  }
  toLocaleTimeString(e, t) {
    return Date.prototype.toLocaleTimeString.call(this, e, { ...t, timeZone: t?.timeZone || this.timeZone });
  }
  tzComponents() {
    const e = this.getTimezoneOffset();
    return [e > 0 ? "-" : "+", String(Math.floor(Math.abs(e) / 60)).padStart(2, "0"), String(Math.abs(e) % 60).padStart(2, "0")];
  }
  withTimeZone(e) {
    return new TZDate(+this, e);
  }
  [/* @__PURE__ */ Symbol.for("constructDateFrom")](e) {
    return new TZDate(+new Date(e), this.timeZone);
  }
}
function He(e, t) {
  const n = t.startOfMonth(e), o2 = n.getDay();
  return 1 === o2 ? n : 0 === o2 ? t.addDays(n, -6) : t.addDays(n, -1 * (o2 - 1));
}
const Ae = { ...V, labels: { labelDayButton: (e, t, n, o2) => {
  let r;
  r = o2 && "function" == typeof o2.format ? o2.format.bind(o2) : (e2, t2) => Se(e2, t2, { locale: V, ...n });
  let a = r(e, "PPPP");
  return t.today && (a = `Today, ${a}`), t.selected && (a = `${a}, selected`), a;
}, labelMonthDropdown: "Choose the Month", labelNext: "Go to the Next Month", labelPrevious: "Go to the Previous Month", labelWeekNumber: (e) => `Week ${e}`, labelYearDropdown: "Choose the Year", labelGrid: (e, t, n) => {
  let o2;
  return o2 = n && "function" == typeof n.format ? n.format.bind(n) : (e2, n2) => Se(e2, n2, { locale: V, ...t }), o2(e, "LLLL yyyy");
}, labelGridcell: (e, t, n, o2) => {
  let r;
  r = o2 && "function" == typeof o2.format ? o2.format.bind(o2) : (e2, t2) => Se(e2, t2, { locale: V, ...n });
  let a = r(e, "PPPP");
  return t?.today && (a = `Today, ${a}`), a;
}, labelNav: "Navigation bar", labelWeekNumberHeader: "Week Number", labelWeekday: (e, t, n) => {
  let o2;
  return o2 = n && "function" == typeof n.format ? n.format.bind(n) : (e2, n2) => Se(e2, n2, { locale: V, ...t }), o2(e, "cccc");
} } };
class DateLib {
  constructor(e, t) {
    this.Date = Date, this.today = () => this.overrides?.today ? this.overrides.today() : this.options.timeZone ? TZDate.tz(this.options.timeZone) : new this.Date(), this.newDate = (e2, t2, n) => this.overrides?.newDate ? this.overrides.newDate(e2, t2, n) : this.options.timeZone ? new TZDate(e2, t2, n, this.options.timeZone) : new Date(e2, t2, n), this.addDays = (e2, t2) => this.overrides?.addDays ? this.overrides.addDays(e2, t2) : x(e2, t2), this.addMonths = (e2, t2) => this.overrides?.addMonths ? this.overrides.addMonths(e2, t2) : Y(e2, t2), this.addWeeks = (e2, t2) => this.overrides?.addWeeks ? this.overrides.addWeeks(e2, t2) : (function(e3, t3, n) {
      return x(e3, 7 * t3, n);
    })(e2, t2), this.addYears = (e2, t2) => this.overrides?.addYears ? this.overrides.addYears(e2, t2) : (function(e3, t3, n) {
      return Y(e3, 12 * t3, n);
    })(e2, t2), this.differenceInCalendarDays = (e2, t2) => this.overrides?.differenceInCalendarDays ? this.overrides.differenceInCalendarDays(e2, t2) : H(e2, t2), this.differenceInCalendarMonths = (e2, t2) => this.overrides?.differenceInCalendarMonths ? this.overrides.differenceInCalendarMonths(e2, t2) : q(e2, t2), this.eachMonthOfInterval = (e2) => this.overrides?.eachMonthOfInterval ? this.overrides.eachMonthOfInterval(e2) : (function(e3) {
      const { start: t2, end: n } = j(0, e3);
      let o2 = +t2 > +n;
      const r = o2 ? +t2 : +n, a = o2 ? n : t2;
      a.setHours(0, 0, 0, 0), a.setDate(1);
      const i = [];
      for (; +a <= r; ) i.push(C(t2, a)), a.setMonth(a.getMonth() + 1);
      return o2 ? i.reverse() : i;
    })(e2), this.eachYearOfInterval = (e2) => {
      const t2 = this.overrides?.eachYearOfInterval ? this.overrides.eachYearOfInterval(e2) : (function(e3) {
        const { start: t3, end: n2 } = j(0, e3);
        let o3 = +t3 > +n2;
        const r = o3 ? +t3 : +n2, a = o3 ? n2 : t3;
        a.setHours(0, 0, 0, 0), a.setMonth(0, 1);
        const i = [];
        for (; +a <= r; ) i.push(C(t3, a)), a.setFullYear(a.getFullYear() + 1);
        return o3 ? i.reverse() : i;
      })(e2), n = new Set(t2.map((e3) => this.getYear(e3)));
      if (n.size === t2.length) return t2;
      const o2 = [];
      return n.forEach((e3) => {
        o2.push(new Date(e3, 0, 1));
      }), o2;
    }, this.endOfBroadcastWeek = (e2) => this.overrides?.endOfBroadcastWeek ? this.overrides.endOfBroadcastWeek(e2) : (function(e3, t2) {
      const n = He(e3, t2), o2 = (function(e4, t3) {
        const n2 = t3.startOfMonth(e4), o3 = n2.getDay() > 0 ? n2.getDay() : 7, r = t3.addDays(e4, 1 - o3), a = t3.addDays(r, 34);
        return t3.getMonth(e4) === t3.getMonth(a) ? 5 : 4;
      })(e3, t2);
      return t2.addDays(n, 7 * o2 - 1);
    })(e2, this), this.endOfISOWeek = (e2) => this.overrides?.endOfISOWeek ? this.overrides.endOfISOWeek(e2) : (function(e3, t2) {
      return $(e3, { ...t2, weekStartsOn: 1 });
    })(e2), this.endOfMonth = (e2) => this.overrides?.endOfMonth ? this.overrides.endOfMonth(e2) : (function(e3, t2) {
      const n = T(e3, t2?.in), o2 = n.getMonth();
      return n.setFullYear(n.getFullYear(), o2 + 1, 0), n.setHours(23, 59, 59, 999), n;
    })(e2), this.endOfWeek = (e2, t2) => this.overrides?.endOfWeek ? this.overrides.endOfWeek(e2, t2) : $(e2, this.options), this.endOfYear = (e2) => this.overrides?.endOfYear ? this.overrides.endOfYear(e2) : (function(e3, t2) {
      const n = T(e3, t2?.in), o2 = n.getFullYear();
      return n.setFullYear(o2 + 1, 0, 0), n.setHours(23, 59, 59, 999), n;
    })(e2), this.format = (e2, t2, n) => {
      const o2 = this.overrides?.format ? this.overrides.format(e2, t2, this.options) : Se(e2, t2, this.options);
      return this.options.numerals && "latn" !== this.options.numerals ? this.replaceDigits(o2) : o2;
    }, this.getISOWeek = (e2) => this.overrides?.getISOWeek ? this.overrides.getISOWeek(e2) : ee(e2), this.getMonth = (e2, t2) => this.overrides?.getMonth ? this.overrides.getMonth(e2, this.options) : (function(e3, t3) {
      return T(e3, t3?.in).getMonth();
    })(e2, this.options), this.getYear = (e2, t2) => this.overrides?.getYear ? this.overrides.getYear(e2, this.options) : (function(e3, t3) {
      return T(e3, t3?.in).getFullYear();
    })(e2, this.options), this.getWeek = (e2, t2) => this.overrides?.getWeek ? this.overrides.getWeek(e2, this.options) : ne(e2, this.options), this.isAfter = (e2, t2) => this.overrides?.isAfter ? this.overrides.isAfter(e2, t2) : (function(e3, t3) {
      return +T(e3) > +T(t3);
    })(e2, t2), this.isBefore = (e2, t2) => this.overrides?.isBefore ? this.overrides.isBefore(e2, t2) : (function(e3, t3) {
      return +T(e3) < +T(t3);
    })(e2, t2), this.isDate = (e2) => this.overrides?.isDate ? this.overrides.isDate(e2) : A(e2), this.isSameDay = (e2, t2) => this.overrides?.isSameDay ? this.overrides.isSameDay(e2, t2) : (function(e3, t3) {
      const [n, o2] = _(0, e3, t3);
      return +Z(n) === +Z(o2);
    })(e2, t2), this.isSameMonth = (e2, t2) => this.overrides?.isSameMonth ? this.overrides.isSameMonth(e2, t2) : (function(e3, t3) {
      const [n, o2] = _(0, e3, t3);
      return n.getFullYear() === o2.getFullYear() && n.getMonth() === o2.getMonth();
    })(e2, t2), this.isSameYear = (e2, t2) => this.overrides?.isSameYear ? this.overrides.isSameYear(e2, t2) : (function(e3, t3) {
      const [n, o2] = _(0, e3, t3);
      return n.getFullYear() === o2.getFullYear();
    })(e2, t2), this.max = (e2) => this.overrides?.max ? this.overrides.max(e2) : (function(e3, t2) {
      let n, o2 = t2?.in;
      return e3.forEach((e4) => {
        o2 || "object" != typeof e4 || (o2 = C.bind(null, e4));
        const t3 = T(e4, o2);
        (!n || n < t3 || isNaN(+t3)) && (n = t3);
      }), C(o2, n || NaN);
    })(e2), this.min = (e2) => this.overrides?.min ? this.overrides.min(e2) : (function(e3, t2) {
      let n, o2 = t2?.in;
      return e3.forEach((e4) => {
        o2 || "object" != typeof e4 || (o2 = C.bind(null, e4));
        const t3 = T(e4, o2);
        (!n || n > t3 || isNaN(+t3)) && (n = t3);
      }), C(o2, n || NaN);
    })(e2), this.setMonth = (e2, t2) => this.overrides?.setMonth ? this.overrides.setMonth(e2, t2) : Ce(e2, t2), this.setYear = (e2, t2) => this.overrides?.setYear ? this.overrides.setYear(e2, t2) : (function(e3, t3, n) {
      const o2 = T(e3, n?.in);
      return isNaN(+o2) ? C(e3, NaN) : (o2.setFullYear(t3), o2);
    })(e2, t2), this.startOfBroadcastWeek = (e2, t2) => this.overrides?.startOfBroadcastWeek ? this.overrides.startOfBroadcastWeek(e2, this) : He(e2, this), this.startOfDay = (e2) => this.overrides?.startOfDay ? this.overrides.startOfDay(e2) : Z(e2), this.startOfISOWeek = (e2) => this.overrides?.startOfISOWeek ? this.overrides.startOfISOWeek(e2) : F(e2), this.startOfMonth = (e2) => this.overrides?.startOfMonth ? this.overrides.startOfMonth(e2) : (function(e3, t2) {
      const n = T(e3, t2?.in);
      return n.setDate(1), n.setHours(0, 0, 0, 0), n;
    })(e2), this.startOfWeek = (e2, t2) => this.overrides?.startOfWeek ? this.overrides.startOfWeek(e2, this.options) : P(e2, this.options), this.startOfYear = (e2) => this.overrides?.startOfYear ? this.overrides.startOfYear(e2) : z(e2), this.options = { locale: Ae, ...e }, this.overrides = t;
  }
  getDigitMap() {
    const { numerals: e = "latn" } = this.options, t = new Intl.NumberFormat("en-US", { numberingSystem: e }), n = {};
    for (let o2 = 0; o2 < 10; o2++) n[o2.toString()] = t.format(o2);
    return n;
  }
  replaceDigits(e) {
    const t = this.getDigitMap();
    return e.replace(/\d/g, (e2) => t[e2] || e2);
  }
  formatNumber(e) {
    return this.replaceDigits(e.toString());
  }
  getMonthYearOrder() {
    const e = this.options.locale?.code;
    return e && DateLib.yearFirstLocales.has(e) ? "year-first" : "month-first";
  }
  formatMonthYear(e) {
    const { locale: t, timeZone: n, numerals: o2 } = this.options, r = t?.code;
    if (r && DateLib.yearFirstLocales.has(r)) try {
      const t2 = new Intl.DateTimeFormat(r, { month: "long", year: "numeric", timeZone: n, numberingSystem: o2 });
      return t2.format(e);
    } catch {
    }
    const a = "year-first" === this.getMonthYearOrder() ? "y LLLL" : "LLLL y";
    return this.format(e, a);
  }
}
DateLib.yearFirstLocales = /* @__PURE__ */ new Set(["eu", "hu", "ja", "ja-Hira", "ja-JP", "ko", "ko-KR", "lt", "lt-LT", "lv", "lv-LV", "mn", "mn-MN", "zh", "zh-CN", "zh-HK", "zh-TW"]);
const qe = new DateLib();
class CalendarDay {
  constructor(e, t, n = qe) {
    this.date = e, this.displayMonth = t, this.outside = Boolean(t && !n.isSameMonth(e, t)), this.dateLib = n, this.isoDate = n.format(e, "yyyy-MM-dd"), this.displayMonthId = n.format(t, "yyyy-MM"), this.dateMonthId = n.format(e, "yyyy-MM");
  }
  isEqualTo(e) {
    return this.dateLib.isSameDay(e.date, this.date) && this.dateLib.isSameMonth(e.displayMonth, this.displayMonth);
  }
}
class CalendarMonth {
  constructor(e, t) {
    this.date = e, this.weeks = t;
  }
}
class CalendarWeek {
  constructor(e, t) {
    this.days = t, this.weekNumber = e;
  }
}
var je, ze, $e, Ue, Ge, Qe, Re, Xe;
(ze = je || (je = {})).Root = "root", ze.Chevron = "chevron", ze.Day = "day", ze.DayButton = "day_button", ze.CaptionLabel = "caption_label", ze.Dropdowns = "dropdowns", ze.Dropdown = "dropdown", ze.DropdownRoot = "dropdown_root", ze.Footer = "footer", ze.MonthGrid = "month_grid", ze.MonthCaption = "month_caption", ze.MonthsDropdown = "months_dropdown", ze.Month = "month", ze.Months = "months", ze.Nav = "nav", ze.NextMonthButton = "button_next", ze.PreviousMonthButton = "button_previous", ze.Week = "week", ze.Weeks = "weeks", ze.Weekday = "weekday", ze.Weekdays = "weekdays", ze.WeekNumber = "week_number", ze.WeekNumberHeader = "week_number_header", ze.YearsDropdown = "years_dropdown", (Ue = $e || ($e = {})).disabled = "disabled", Ue.hidden = "hidden", Ue.outside = "outside", Ue.focused = "focused", Ue.today = "today", (Qe = Ge || (Ge = {})).range_end = "range_end", Qe.range_middle = "range_middle", Qe.range_start = "range_start", Qe.selected = "selected", (Xe = Re || (Re = {})).weeks_before_enter = "weeks_before_enter", Xe.weeks_before_exit = "weeks_before_exit", Xe.weeks_after_enter = "weeks_after_enter", Xe.weeks_after_exit = "weeks_after_exit", Xe.caption_after_enter = "caption_after_enter", Xe.caption_after_exit = "caption_after_exit", Xe.caption_before_enter = "caption_before_enter", Xe.caption_before_exit = "caption_before_exit";
const Ke = reactExports.createContext(void 0);
function Je() {
  const e = reactExports.useContext(Ke);
  if (void 0 === e) throw new Error("useDayPicker() must be used within a custom component.");
  return e;
}
const Ve = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({ __proto__: null, Button: function(e) {
  return g.createElement("button", { ...e });
}, CaptionLabel: function(e) {
  return g.createElement("span", { ...e });
}, Chevron: function(e) {
  const { size: t = 24, orientation: n = "left", className: o2 } = e;
  return g.createElement("svg", { className: o2, width: t, height: t, viewBox: "0 0 24 24" }, "up" === n && g.createElement("polygon", { points: "6.77 17 12.5 11.43 18.24 17 20 15.28 12.5 8 5 15.28" }), "down" === n && g.createElement("polygon", { points: "6.77 8 12.5 13.57 18.24 8 20 9.72 12.5 17 5 9.72" }), "left" === n && g.createElement("polygon", { points: "16 18.112 9.81111111 12 16 5.87733333 14.0888889 4 6 12 14.0888889 20" }), "right" === n && g.createElement("polygon", { points: "8 18.112 14.18888889 12 8 5.87733333 9.91111111 4 18 12 9.91111111 20" }));
}, Day: function(e) {
  const { day: t, modifiers: n, ...o2 } = e;
  return g.createElement("td", { ...o2 });
}, DayButton: function(e) {
  const { day: t, modifiers: n, ...o2 } = e, r = g.useRef(null);
  return g.useEffect(() => {
    n.focused && r.current?.focus();
  }, [n.focused]), g.createElement("button", { ref: r, ...o2 });
}, Dropdown: function(e) {
  const { options: t, className: n, components: o2, classNames: r, ...a } = e, i = [r[je.Dropdown], n].join(" "), s = t?.find(({ value: e2 }) => e2 === a.value);
  return g.createElement("span", { "data-disabled": a.disabled, className: r[je.DropdownRoot] }, g.createElement(o2.Select, { className: i, ...a }, t?.map(({ value: e2, label: t2, disabled: n2 }) => g.createElement(o2.Option, { key: e2, value: e2, disabled: n2 }, t2))), g.createElement("span", { className: r[je.CaptionLabel], "aria-hidden": true }, s?.label, g.createElement(o2.Chevron, { orientation: "down", size: 18, className: r[je.Chevron] })));
}, DropdownNav: function(e) {
  return g.createElement("div", { ...e });
}, Footer: function(e) {
  return g.createElement("div", { ...e });
}, Month: function(e) {
  const { calendarMonth: t, displayIndex: n, ...o2 } = e;
  return g.createElement("div", { ...o2 }, e.children);
}, MonthCaption: function(e) {
  const { calendarMonth: t, displayIndex: n, ...o2 } = e;
  return g.createElement("div", { ...o2 });
}, MonthGrid: function(e) {
  return g.createElement("table", { ...e });
}, Months: function(e) {
  return g.createElement("div", { ...e });
}, MonthsDropdown: function(e) {
  const { components: t } = Je();
  return g.createElement(t.Dropdown, { ...e });
}, Nav: function(e) {
  const { onPreviousClick: t, onNextClick: n, previousMonth: o2, nextMonth: r, ...a } = e, { components: i, classNames: s, labels: { labelPrevious: d, labelNext: l } } = Je(), c = reactExports.useCallback((e2) => {
    r && n?.(e2);
  }, [r, n]), u2 = reactExports.useCallback((e2) => {
    o2 && t?.(e2);
  }, [o2, t]);
  return g.createElement("nav", { ...a }, g.createElement(i.PreviousMonthButton, { type: "button", className: s[je.PreviousMonthButton], tabIndex: o2 ? void 0 : -1, "aria-disabled": !o2 || void 0, "aria-label": d(o2), onClick: u2 }, g.createElement(i.Chevron, { disabled: !o2 || void 0, className: s[je.Chevron], orientation: "left" })), g.createElement(i.NextMonthButton, { type: "button", className: s[je.NextMonthButton], tabIndex: r ? void 0 : -1, "aria-disabled": !r || void 0, "aria-label": l(r), onClick: c }, g.createElement(i.Chevron, { disabled: !r || void 0, orientation: "right", className: s[je.Chevron] })));
}, NextMonthButton: function(e) {
  const { components: t } = Je();
  return g.createElement(t.Button, { ...e });
}, Option: function(e) {
  return g.createElement("option", { ...e });
}, PreviousMonthButton: function(e) {
  const { components: t } = Je();
  return g.createElement(t.Button, { ...e });
}, Root: function(e) {
  const { rootRef: t, ...n } = e;
  return g.createElement("div", { ...n, ref: t });
}, Select: function(e) {
  return g.createElement("select", { ...e });
}, Week: function(e) {
  const { week: t, ...n } = e;
  return g.createElement("tr", { ...n });
}, WeekNumber: function(e) {
  const { week: t, ...n } = e;
  return g.createElement("th", { ...n });
}, WeekNumberHeader: function(e) {
  return g.createElement("th", { ...e });
}, Weekday: function(e) {
  return g.createElement("th", { ...e });
}, Weekdays: function(e) {
  return g.createElement("thead", { "aria-hidden": true }, g.createElement("tr", { ...e }));
}, Weeks: function(e) {
  return g.createElement("tbody", { ...e });
}, YearsDropdown: function(e) {
  const { components: t } = Je();
  return g.createElement(t.Dropdown, { ...e });
} }, Symbol.toStringTag, { value: "Module" }));
function et(e, t, n = false, o2 = qe) {
  let { from: r, to: a } = e;
  const { differenceInCalendarDays: i, isSameDay: s } = o2;
  if (r && a) {
    i(a, r) < 0 && ([r, a] = [a, r]);
    return i(t, r) >= (n ? 1 : 0) && i(a, t) >= (n ? 1 : 0);
  }
  return !n && a ? s(a, t) : !(n || !r) && s(r, t);
}
function tt(e) {
  return Boolean(e && "object" == typeof e && "before" in e && "after" in e);
}
function nt(e) {
  return Boolean(e && "object" == typeof e && "from" in e);
}
function ot(e) {
  return Boolean(e && "object" == typeof e && "after" in e);
}
function rt(e) {
  return Boolean(e && "object" == typeof e && "before" in e);
}
function at(e) {
  return Boolean(e && "object" == typeof e && "dayOfWeek" in e);
}
function it(e, t) {
  return Array.isArray(e) && e.every(t.isDate);
}
function st(e, t, n = qe) {
  const o2 = Array.isArray(t) ? t : [t], { isSameDay: r, differenceInCalendarDays: a, isAfter: i } = n;
  return o2.some((t2) => {
    if ("boolean" == typeof t2) return t2;
    if (n.isDate(t2)) return r(e, t2);
    if (it(t2, n)) return t2.some((t3) => r(e, t3));
    if (nt(t2)) return et(t2, e, false, n);
    if (at(t2)) return Array.isArray(t2.dayOfWeek) ? t2.dayOfWeek.includes(e.getDay()) : t2.dayOfWeek === e.getDay();
    if (tt(t2)) {
      const n2 = a(t2.before, e) > 0, o3 = a(t2.after, e) < 0;
      return i(t2.before, t2.after) ? o3 && n2 : n2 || o3;
    }
    return ot(t2) ? a(e, t2.after) > 0 : rt(t2) ? a(t2.before, e) > 0 : "function" == typeof t2 && t2(e);
  });
}
function dt() {
  const e = {};
  for (const t in je) e[je[t]] = `rdp-${je[t]}`;
  for (const t in $e) e[$e[t]] = `rdp-${$e[t]}`;
  for (const t in Ge) e[Ge[t]] = `rdp-${Ge[t]}`;
  for (const t in Re) e[Re[t]] = `rdp-${Re[t]}`;
  return e;
}
function lt(e, t, n) {
  return (n ?? new DateLib(t)).formatMonthYear(e);
}
const ct = lt;
function ut(e, t = qe) {
  return t.format(e, "yyyy");
}
const ft = ut, ht = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({ __proto__: null, formatCaption: lt, formatDay: function(e, t, n) {
  return (n ?? new DateLib(t)).format(e, "d");
}, formatMonthCaption: ct, formatMonthDropdown: function(e, t = qe) {
  return t.format(e, "LLLL");
}, formatWeekNumber: function(e, t = qe) {
  return e < 10 ? t.formatNumber(`0${e.toLocaleString()}`) : t.formatNumber(`${e.toLocaleString()}`);
}, formatWeekNumberHeader: function() {
  return "";
}, formatWeekdayName: function(e, t, n) {
  return (n ?? new DateLib(t)).format(e, "cccccc");
}, formatYearCaption: ft, formatYearDropdown: ut }, Symbol.toStringTag, { value: "Module" }));
function mt(e, t, n, o2) {
  let r = (o2 ?? new DateLib(n)).format(e, "PPPP");
  return t.today && (r = `Today, ${r}`), t.selected && (r = `${r}, selected`), r;
}
const yt = mt;
function pt(e, t, n) {
  return (n ?? new DateLib(t)).formatMonthYear(e);
}
const gt = pt;
function bt(e, t, n, o2) {
  let r = (o2 ?? new DateLib(n)).format(e, "PPPP");
  return t?.today && (r = `Today, ${r}`), r;
}
function wt(e) {
  return "Choose the Month";
}
function vt() {
  return "";
}
function Mt(e, t) {
  return "Go to the Next Month";
}
function Dt(e) {
  return "Go to the Previous Month";
}
function kt(e, t, n) {
  return (n ?? new DateLib(t)).format(e, "cccc");
}
function Ot(e, t) {
  return `Week ${e}`;
}
function Wt(e) {
  return "Week Number";
}
function St(e) {
  return "Choose the Year";
}
const Nt = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({ __proto__: null, labelCaption: gt, labelDay: yt, labelDayButton: mt, labelGrid: pt, labelGridcell: bt, labelMonthDropdown: wt, labelNav: vt, labelNext: Mt, labelPrevious: Dt, labelWeekNumber: Ot, labelWeekNumberHeader: Wt, labelWeekday: kt, labelYearDropdown: St }, Symbol.toStringTag, { value: "Module" })), Ct = (e, t, n) => t || (n ? "function" == typeof n ? n : (...e2) => n : e);
function Tt(e, t) {
  const n = t.locale?.labels ?? {};
  return { ...Nt, ...e ?? {}, labelDayButton: Ct(mt, e?.labelDayButton, n.labelDayButton), labelMonthDropdown: Ct(wt, e?.labelMonthDropdown, n.labelMonthDropdown), labelNext: Ct(Mt, e?.labelNext, n.labelNext), labelPrevious: Ct(Dt, e?.labelPrevious, n.labelPrevious), labelWeekNumber: Ct(Ot, e?.labelWeekNumber, n.labelWeekNumber), labelYearDropdown: Ct(St, e?.labelYearDropdown, n.labelYearDropdown), labelGrid: Ct(pt, e?.labelGrid, n.labelGrid), labelGridcell: Ct(bt, e?.labelGridcell, n.labelGridcell), labelNav: Ct(vt, e?.labelNav, n.labelNav), labelWeekNumberHeader: Ct(Wt, e?.labelWeekNumberHeader, n.labelWeekNumberHeader), labelWeekday: Ct(kt, e?.labelWeekday, n.labelWeekday) };
}
function xt(e, t, n, o2, r) {
  const { startOfMonth: a, startOfYear: i, endOfYear: s, eachMonthOfInterval: d, getMonth: l } = r;
  return d({ start: i(e), end: s(e) }).map((e2) => {
    const i2 = o2.formatMonthDropdown(e2, r);
    return { value: l(e2), label: i2, disabled: t && e2 < a(t) || n && e2 > a(n) || false };
  });
}
function Yt(e, t, n, o2, r = false) {
  if (!e) return;
  if (!t) return;
  const { startOfYear: a, endOfYear: i, eachYearOfInterval: s, getYear: d } = o2, l = s({ start: a(e), end: i(t) });
  return r && l.reverse(), l.map((e2) => {
    const t2 = n.formatYearDropdown(e2, o2);
    return { value: d(e2), label: t2, disabled: false };
  });
}
const Et = (e) => e instanceof HTMLElement ? e : null, Lt = (e) => [...e.querySelectorAll("[data-animated-month]") ?? []], Pt = (e) => Et(e.querySelector("[data-animated-caption]")), Ft = (e) => Et(e.querySelector("[data-animated-weeks]"));
function It(e, t, { classNames: n, months: o2, focused: r, dateLib: a }) {
  const i = reactExports.useRef(null), s = reactExports.useRef(o2), d = reactExports.useRef(false);
  reactExports.useLayoutEffect(() => {
    const l = s.current;
    if (s.current = o2, !(t && e.current && e.current instanceof HTMLElement && 0 !== o2.length && 0 !== l.length && o2.length === l.length)) return;
    const c = a.isSameMonth(o2[0].date, l[0].date), u2 = a.isAfter(o2[0].date, l[0].date), f = u2 ? n[Re.caption_after_enter] : n[Re.caption_before_enter], h = u2 ? n[Re.weeks_after_enter] : n[Re.weeks_before_enter], m = i.current, y = e.current.cloneNode(true);
    if (y instanceof HTMLElement) {
      Lt(y).forEach((e2) => {
        if (!(e2 instanceof HTMLElement)) return;
        const t2 = Et(e2.querySelector("[data-animated-month]"));
        t2 && e2.contains(t2) && e2.removeChild(t2);
        const n2 = Pt(e2);
        n2 && n2.classList.remove(f);
        const o3 = Ft(e2);
        o3 && o3.classList.remove(h);
      }), i.current = y;
    } else i.current = null;
    if (d.current || c || r) return;
    const p = m instanceof HTMLElement ? Lt(m) : [], g2 = Lt(e.current);
    if (g2?.every((e2) => e2 instanceof HTMLElement) && p && p.every((e2) => e2 instanceof HTMLElement)) {
      d.current = true, e.current.style.isolation = "isolate";
      const t2 = (b = e.current, Et(b.querySelector("[data-animated-nav]")));
      t2 && (t2.style.zIndex = "1"), g2.forEach((o3, r2) => {
        const a2 = p[r2];
        if (!a2) return;
        o3.style.position = "relative", o3.style.overflow = "hidden";
        const i2 = Pt(o3);
        i2 && i2.classList.add(f);
        const s2 = Ft(o3);
        s2 && s2.classList.add(h);
        const l2 = () => {
          d.current = false, e.current && (e.current.style.isolation = ""), t2 && (t2.style.zIndex = ""), i2 && i2.classList.remove(f), s2 && s2.classList.remove(h), o3.style.position = "", o3.style.overflow = "", o3.contains(a2) && o3.removeChild(a2);
        };
        a2.style.pointerEvents = "none", a2.style.position = "absolute", a2.style.overflow = "hidden", a2.setAttribute("aria-hidden", "true");
        const c2 = ((e2) => Et(e2.querySelector("[data-animated-weekdays]")))(a2);
        c2 && (c2.style.opacity = "0");
        const m2 = Pt(a2);
        m2 && (m2.classList.add(u2 ? n[Re.caption_before_exit] : n[Re.caption_after_exit]), m2.addEventListener("animationend", l2));
        const y2 = Ft(a2);
        y2 && y2.classList.add(u2 ? n[Re.weeks_before_exit] : n[Re.weeks_after_exit]), o3.insertBefore(a2, o3.firstChild);
      });
    }
    var b;
  });
}
function Bt(e, t, n, o2) {
  const { month: r, defaultMonth: a, today: i = o2.today(), numberOfMonths: s = 1 } = e;
  let d = r || a || i;
  const { differenceInCalendarMonths: l, addMonths: c, startOfMonth: u2 } = o2;
  if (n && l(n, d) < s - 1) {
    d = c(n, -1 * (s - 1));
  }
  return t && l(d, t) < 0 && (d = t), u2(d);
}
function _t(e, t) {
  const [n, o2] = reactExports.useState(e);
  return [void 0 === t ? n : t, o2];
}
function Zt(e, t) {
  const [n, o2] = (function(e2, t2) {
    let { startMonth: n2, endMonth: o3 } = e2;
    const { startOfYear: r2, startOfDay: a2, startOfMonth: i2, endOfMonth: s2, addYears: d2, endOfYear: l2, newDate: c2, today: u3 } = t2, { fromYear: f2, toYear: h2, fromMonth: m2, toMonth: y2 } = e2;
    !n2 && m2 && (n2 = m2), !n2 && f2 && (n2 = t2.newDate(f2, 0, 1)), !o3 && y2 && (o3 = y2), !o3 && h2 && (o3 = c2(h2, 11, 31));
    const p2 = "dropdown" === e2.captionLayout || "dropdown-years" === e2.captionLayout;
    return n2 ? n2 = i2(n2) : f2 ? n2 = c2(f2, 0, 1) : !n2 && p2 && (n2 = r2(d2(e2.today ?? u3(), -100))), o3 ? o3 = s2(o3) : h2 ? o3 = c2(h2, 11, 31) : !o3 && p2 && (o3 = l2(e2.today ?? u3())), [n2 ? a2(n2) : n2, o3 ? a2(o3) : o3];
  })(e, t), { startOfMonth: r, endOfMonth: a } = t, i = Bt(e, n, o2, t), [s, d] = _t(i, e.month ? i : void 0);
  reactExports.useEffect(() => {
    const r2 = Bt(e, n, o2, t);
    d(r2);
  }, [e.timeZone]);
  const { months: l, weeks: c, days: u2, previousMonth: f, nextMonth: h } = reactExports.useMemo(() => {
    const r2 = (function(e2, t2, n2, o3) {
      const { numberOfMonths: r3 = 1 } = n2, a2 = [];
      for (let i3 = 0; i3 < r3; i3++) {
        const n3 = o3.addMonths(e2, i3);
        if (t2 && n3 > t2) break;
        a2.push(n3);
      }
      return a2;
    })(s, o2, { numberOfMonths: e.numberOfMonths }, t), i2 = (function(e2, t2, n2, o3) {
      const r3 = e2[0], a2 = e2[e2.length - 1], { ISOWeek: i3, fixedWeeks: s2, broadcastCalendar: d3 } = n2 ?? {}, { addDays: l3, differenceInCalendarDays: c3, differenceInCalendarMonths: u4, endOfBroadcastWeek: f3, endOfISOWeek: h2, endOfMonth: m2, endOfWeek: y2, isAfter: p2, startOfBroadcastWeek: g2, startOfISOWeek: b, startOfWeek: w } = o3, v = d3 ? g2(r3, o3) : i3 ? b(r3) : w(r3), M = d3 ? f3(a2) : i3 ? h2(m2(a2)) : y2(m2(a2)), D = t2 && (d3 ? f3(t2) : i3 ? h2(t2) : y2(t2)), k = c3(D && p2(M, D) ? D : M, v), O = u4(a2, r3) + 1, W = [];
      for (let N2 = 0; N2 <= k; N2++) {
        const e3 = l3(v, N2);
        W.push(e3);
      }
      const S2 = (d3 ? 35 : 42) * O;
      if (s2 && W.length < S2) {
        const e3 = S2 - W.length;
        for (let t3 = 0; t3 < e3; t3++) {
          const e4 = l3(W[W.length - 1], 1);
          W.push(e4);
        }
      }
      return W;
    })(r2, e.endMonth ? a(e.endMonth) : void 0, { ISOWeek: e.ISOWeek, fixedWeeks: e.fixedWeeks, broadcastCalendar: e.broadcastCalendar }, t), d2 = (function(e2, t2, n2, o3) {
      const { addDays: r3, endOfBroadcastWeek: a2, endOfISOWeek: i3, endOfMonth: s2, endOfWeek: d3, getISOWeek: l3, getWeek: c3, startOfBroadcastWeek: u4, startOfISOWeek: f3, startOfWeek: h2 } = o3, m2 = e2.reduce((e3, m3) => {
        const y2 = n2.broadcastCalendar ? u4(m3, o3) : n2.ISOWeek ? f3(m3) : h2(m3), p2 = n2.broadcastCalendar ? a2(m3) : n2.ISOWeek ? i3(s2(m3)) : d3(s2(m3)), g2 = t2.filter((e4) => e4 >= y2 && e4 <= p2), b = n2.broadcastCalendar ? 35 : 42;
        if (n2.fixedWeeks && g2.length < b) {
          const e4 = t2.filter((e5) => {
            const t3 = b - g2.length;
            return e5 > p2 && e5 <= r3(p2, t3);
          });
          g2.push(...e4);
        }
        const w = g2.reduce((e4, t3) => {
          const r4 = n2.ISOWeek ? l3(t3) : c3(t3), a3 = e4.find((e5) => e5.weekNumber === r4), i4 = new CalendarDay(t3, m3, o3);
          return a3 ? a3.days.push(i4) : e4.push(new CalendarWeek(r4, [i4])), e4;
        }, []), v = new CalendarMonth(m3, w);
        return e3.push(v), e3;
      }, []);
      return n2.reverseMonths ? m2.reverse() : m2;
    })(r2, i2, { broadcastCalendar: e.broadcastCalendar, fixedWeeks: e.fixedWeeks, ISOWeek: e.ISOWeek, reverseMonths: e.reverseMonths }, t), l2 = (function(e2) {
      return e2.reduce((e3, t2) => e3.concat(t2.weeks.slice()), [].slice());
    })(d2), c2 = (function(e2) {
      const t2 = [];
      return e2.reduce((e3, n2) => {
        const o3 = n2.weeks.reduce((e4, t3) => e4.concat(t3.days.slice()), t2.slice());
        return e3.concat(o3.slice());
      }, t2.slice());
    })(d2), u3 = (function(e2, t2, n2, o3) {
      if (n2.disableNavigation) return;
      const { pagedNavigation: r3, numberOfMonths: a2 } = n2, { startOfMonth: i3, addMonths: s2, differenceInCalendarMonths: d3 } = o3, l3 = r3 ? a2 ?? 1 : 1, c3 = i3(e2);
      return t2 && d3(c3, t2) <= 0 ? void 0 : s2(c3, -l3);
    })(s, n, e, t), f2 = (function(e2, t2, n2, o3) {
      if (n2.disableNavigation) return;
      const { pagedNavigation: r3, numberOfMonths: a2 = 1 } = n2, { startOfMonth: i3, addMonths: s2, differenceInCalendarMonths: d3 } = o3, l3 = r3 ? a2 : 1, c3 = i3(e2);
      return t2 && d3(t2, e2) < a2 ? void 0 : s2(c3, l3);
    })(s, o2, e, t);
    return { months: d2, weeks: l2, days: c2, previousMonth: u3, nextMonth: f2 };
  }, [t, s.getTime(), o2?.getTime(), n?.getTime(), e.disableNavigation, e.broadcastCalendar, e.endMonth?.getTime(), e.fixedWeeks, e.ISOWeek, e.numberOfMonths, e.pagedNavigation, e.reverseMonths]), { disableNavigation: m, onMonthChange: y } = e, p = (e2) => {
    if (m) return;
    let t2 = r(e2);
    n && t2 < r(n) && (t2 = r(n)), o2 && t2 > r(o2) && (t2 = r(o2)), d(t2), y?.(t2);
  };
  return { months: l, weeks: c, days: u2, navStart: n, navEnd: o2, previousMonth: f, nextMonth: h, goToMonth: p, goToDay: (e2) => {
    ((e3) => c.some((t2) => t2.days.some((t3) => t3.isEqualTo(e3))))(e2) || p(e2.date);
  } };
}
var Ht, At;
function qt(e) {
  return !e[$e.disabled] && !e[$e.hidden] && !e[$e.outside];
}
function jt(e, t, n, o2, r, a, i, s = 0) {
  if (s > 365) return;
  const d = (function(e2, t2, n2, o3, r2, a2, i2) {
    const { ISOWeek: s2, broadcastCalendar: d2 } = a2, { addDays: l2, addMonths: c2, addWeeks: u3, addYears: f, endOfBroadcastWeek: h, endOfISOWeek: m, endOfWeek: y, max: p, min: g2, startOfBroadcastWeek: b, startOfISOWeek: w, startOfWeek: v } = i2;
    let M = { day: l2, week: u3, month: c2, year: f, startOfWeek: (e3) => d2 ? b(e3, i2) : s2 ? w(e3) : v(e3), endOfWeek: (e3) => d2 ? h(e3) : s2 ? m(e3) : y(e3) }[e2](n2, "after" === t2 ? 1 : -1);
    return "before" === t2 && o3 ? M = p([o3, M]) : "after" === t2 && r2 && (M = g2([r2, M])), M;
  })(e, t, n.date, o2, r, a, i), l = Boolean(a.disabled && st(d, a.disabled, i)), c = Boolean(a.hidden && st(d, a.hidden, i)), u2 = new CalendarDay(d, d, i);
  return l || c ? jt(e, t, u2, o2, r, a, i, s + 1) : u2;
}
function zt(e, t, n, o2, r) {
  const { autoFocus: a } = e, [i, s] = reactExports.useState(), d = (function(e2, t2, n2, o3) {
    let r2, a2 = -1;
    for (const i2 of e2) {
      const e3 = t2(i2);
      qt(e3) && (e3[$e.focused] && a2 < Ht.FocusedModifier ? (r2 = i2, a2 = Ht.FocusedModifier) : o3?.isEqualTo(i2) && a2 < Ht.LastFocused ? (r2 = i2, a2 = Ht.LastFocused) : n2(i2.date) && a2 < Ht.Selected ? (r2 = i2, a2 = Ht.Selected) : e3[$e.today] && a2 < Ht.Today && (r2 = i2, a2 = Ht.Today));
    }
    return r2 || (r2 = e2.find((e3) => qt(t2(e3)))), r2;
  })(t.days, n, o2 || (() => false), i), [l, c] = reactExports.useState(a ? d : void 0);
  return { isFocusTarget: (e2) => Boolean(d?.isEqualTo(e2)), setFocused: c, focused: l, blur: () => {
    s(l), c(void 0);
  }, moveFocus: (n2, o3) => {
    if (!l) return;
    const a2 = jt(n2, o3, l, t.navStart, t.navEnd, e, r);
    if (a2) {
      if (e.disableNavigation) {
        if (!t.days.some((e2) => e2.isEqualTo(a2))) return;
      }
      t.goToDay(a2), c(a2);
    }
  } };
}
function $t(e, t, n = qe) {
  return et(e, t.from, false, n) || et(e, t.to, false, n) || et(t, e.from, false, n) || et(t, e.to, false, n);
}
function Ut(e, t, n = qe) {
  const o2 = Array.isArray(t) ? t : [t];
  if (o2.filter((e2) => "function" != typeof e2).some((t2) => {
    if ("boolean" == typeof t2) return t2;
    if (n.isDate(t2)) return et(e, t2, false, n);
    if (it(t2, n)) return t2.some((t3) => et(e, t3, false, n));
    if (nt(t2)) return !(!t2.from || !t2.to) && $t(e, { from: t2.from, to: t2.to }, n);
    if (at(t2)) return (function(e2, t3, n2 = qe) {
      const o3 = Array.isArray(t3) ? t3 : [t3];
      let r2 = e2.from;
      const a = n2.differenceInCalendarDays(e2.to, e2.from), i = Math.min(a, 6);
      for (let s = 0; s <= i; s++) {
        if (o3.includes(r2.getDay())) return true;
        r2 = n2.addDays(r2, 1);
      }
      return false;
    })(e, t2.dayOfWeek, n);
    if (tt(t2)) {
      return n.isAfter(t2.before, t2.after) ? $t(e, { from: n.addDays(t2.after, 1), to: n.addDays(t2.before, -1) }, n) : st(e.from, t2, n) || st(e.to, t2, n);
    }
    return !(!ot(t2) && !rt(t2)) && (st(e.from, t2, n) || st(e.to, t2, n));
  })) return true;
  const r = o2.filter((e2) => "function" == typeof e2);
  if (r.length) {
    let t2 = e.from;
    const o3 = n.differenceInCalendarDays(e.to, e.from);
    for (let e2 = 0; e2 <= o3; e2++) {
      if (r.some((e3) => e3(t2))) return true;
      t2 = n.addDays(t2, 1);
    }
  }
  return false;
}
function Gt(e, t) {
  const { disabled: n, excludeDisabled: o2, resetOnSelect: r, selected: a, required: i, onSelect: s } = e, [d, l] = _t(a, s ? a : void 0), c = s ? a : d;
  return { selected: c, select: (a2, d2, u2) => {
    const { min: f, max: h } = e;
    let m;
    if (a2) {
      const e2 = c?.from, n2 = c?.to, o3 = !!e2 && !!n2, s2 = !!e2 && !!n2 && t.isSameDay(e2, n2) && t.isSameDay(a2, e2);
      m = !r || !o3 && c?.from ? (function(e3, t2, n3 = 0, o4 = 0, r2 = false, a3 = qe) {
        const { from: i2, to: s3 } = t2 || {}, { isSameDay: d3, isAfter: l2, isBefore: c2 } = a3;
        let u3;
        if (i2 || s3) {
          if (i2 && !s3) u3 = d3(i2, e3) ? 0 === n3 ? { from: i2, to: e3 } : r2 ? { from: i2, to: void 0 } : void 0 : c2(e3, i2) ? { from: e3, to: i2 } : { from: i2, to: e3 };
          else if (i2 && s3) if (d3(i2, e3) && d3(s3, e3)) u3 = r2 ? { from: i2, to: s3 } : void 0;
          else if (d3(i2, e3)) u3 = { from: i2, to: n3 > 0 ? void 0 : e3 };
          else if (d3(s3, e3)) u3 = { from: e3, to: n3 > 0 ? void 0 : e3 };
          else if (c2(e3, i2)) u3 = { from: e3, to: s3 };
          else if (l2(e3, i2)) u3 = { from: i2, to: e3 };
          else {
            if (!l2(e3, s3)) throw new Error("Invalid range");
            u3 = { from: i2, to: e3 };
          }
        } else u3 = { from: e3, to: n3 > 0 ? void 0 : e3 };
        if (u3?.from && u3?.to) {
          const t3 = a3.differenceInCalendarDays(u3.to, u3.from);
          (o4 > 0 && t3 > o4 || n3 > 1 && t3 < n3) && (u3 = { from: e3, to: void 0 });
        }
        return u3;
      })(a2, c, f, h, i, t) : !i && s2 ? void 0 : { from: a2, to: void 0 };
    }
    return o2 && n && m?.from && m.to && Ut({ from: m.from, to: m.to }, n, t) && (m.from = a2, m.to = void 0), s || l(m), s?.(m, a2, d2, u2), m;
  }, isSelected: (e2) => c && et(c, e2, false, t) };
}
function Qt(e, t) {
  const n = (function(e2, t2) {
    const { selected: n2, required: o3, onSelect: r2 } = e2, [a, i] = _t(n2, r2 ? n2 : void 0), s = r2 ? n2 : a, { isSameDay: d } = t2;
    return { selected: s, select: (e3, t3, n3) => {
      let a2 = e3;
      return !o3 && s && s && d(e3, s) && (a2 = void 0), r2 || i(a2), r2?.(a2, e3, t3, n3), a2;
    }, isSelected: (e3) => !!s && d(s, e3) };
  })(e, t), o2 = (function(e2, t2) {
    const { selected: n2, required: o3, onSelect: r2 } = e2, [a, i] = _t(n2, r2 ? n2 : void 0), s = r2 ? n2 : a, { isSameDay: d } = t2, l = (e3) => s?.some((t3) => d(t3, e3)) ?? false, { min: c, max: u2 } = e2;
    return { selected: s, select: (e3, t3, n3) => {
      let a2 = [...s ?? []];
      if (l(e3)) {
        if (s?.length === c) return;
        if (o3 && 1 === s?.length) return;
        a2 = s?.filter((t4) => !d(t4, e3));
      } else a2 = s?.length === u2 ? [e3] : [...a2, e3];
      return r2 || i(a2), r2?.(a2, e3, t3, n3), a2;
    }, isSelected: l };
  })(e, t), r = Gt(e, t);
  switch (e.mode) {
    case "single":
      return n;
    case "multiple":
      return o2;
    case "range":
      return r;
    default:
      return;
  }
}
function Rt(e, t) {
  return e instanceof TZDate && e.timeZone === t ? e : new TZDate(e, t);
}
function Xt(e, t, n) {
  return Rt(e, t);
}
function Kt(e, t, n) {
  return "boolean" == typeof e || "function" == typeof e ? e : e instanceof Date ? Xt(e, t) : Array.isArray(e) ? e.map((e2) => e2 instanceof Date ? Xt(e2, t) : e2) : nt(e) ? { ...e, from: e.from ? Rt(e.from, t) : e.from, to: e.to ? Rt(e.to, t) : e.to } : tt(e) ? { before: Xt(e.before, t), after: Xt(e.after, t) } : ot(e) ? { after: Xt(e.after, t) } : rt(e) ? { before: Xt(e.before, t) } : e;
}
function Jt(e, t, n) {
  return e ? Array.isArray(e) ? e.map((e2) => Kt(e2, t)) : Kt(e, t) : e;
}
function Vt(e) {
  let t = e;
  const n = t.timeZone;
  if (n && (t = { ...e, timeZone: n }, t.today && (t.today = Rt(t.today, n)), t.month && (t.month = Rt(t.month, n)), t.defaultMonth && (t.defaultMonth = Rt(t.defaultMonth, n)), t.startMonth && (t.startMonth = Rt(t.startMonth, n)), t.endMonth && (t.endMonth = Rt(t.endMonth, n)), "single" === t.mode && t.selected ? t.selected = Rt(t.selected, n) : "multiple" === t.mode && t.selected ? t.selected = t.selected?.map((e2) => Rt(e2, n)) : "range" === t.mode && t.selected && (t.selected = { from: t.selected.from ? Rt(t.selected.from, n) : t.selected.from, to: t.selected.to ? Rt(t.selected.to, n) : t.selected.to }), void 0 !== t.disabled && (t.disabled = Jt(t.disabled, n)), void 0 !== t.hidden && (t.hidden = Jt(t.hidden, n)), t.modifiers)) {
    const e2 = {};
    Object.keys(t.modifiers).forEach((o3) => {
      e2[o3] = Jt(t.modifiers?.[o3], n);
    }), t.modifiers = e2;
  }
  const { components: o2, formatters: r, labels: a, dateLib: i, locale: s, classNames: d } = reactExports.useMemo(() => {
    const e2 = { ...Ae, ...t.locale }, n2 = t.broadcastCalendar ? 1 : t.weekStartsOn, o3 = t.noonSafe && t.timeZone ? (function(e3, t2 = {}) {
      const { weekStartsOn: n3, locale: o4 } = t2, r3 = n3 ?? o4?.options?.weekStartsOn ?? 0, a3 = (t3) => {
        const n4 = "number" == typeof t3 || "string" == typeof t3 ? new Date(t3) : t3;
        return new TZDate(n4.getFullYear(), n4.getMonth(), n4.getDate(), 12, 0, 0, e3);
      }, i3 = (e4) => {
        const t3 = a3(e4);
        return new Date(t3.getFullYear(), t3.getMonth(), t3.getDate(), 0, 0, 0, 0);
      };
      return { today: () => a3(TZDate.tz(e3)), newDate: (t3, n4, o5) => new TZDate(t3, n4, o5, 12, 0, 0, e3), startOfDay: (e4) => a3(e4), startOfWeek: (e4, t3) => {
        const n4 = a3(e4), o5 = t3?.weekStartsOn ?? r3, i4 = (n4.getDay() - o5 + 7) % 7;
        return n4.setDate(n4.getDate() - i4), n4;
      }, startOfISOWeek: (e4) => {
        const t3 = a3(e4), n4 = (t3.getDay() - 1 + 7) % 7;
        return t3.setDate(t3.getDate() - n4), t3;
      }, startOfMonth: (e4) => {
        const t3 = a3(e4);
        return t3.setDate(1), t3;
      }, startOfYear: (e4) => {
        const t3 = a3(e4);
        return t3.setMonth(0, 1), t3;
      }, endOfWeek: (e4, t3) => {
        const n4 = a3(e4), o5 = (((t3?.weekStartsOn ?? r3) + 6) % 7 - n4.getDay() + 7) % 7;
        return n4.setDate(n4.getDate() + o5), n4;
      }, endOfISOWeek: (e4) => {
        const t3 = a3(e4), n4 = (7 - t3.getDay()) % 7;
        return t3.setDate(t3.getDate() + n4), t3;
      }, endOfMonth: (e4) => {
        const t3 = a3(e4);
        return t3.setMonth(t3.getMonth() + 1, 0), t3;
      }, endOfYear: (e4) => {
        const t3 = a3(e4);
        return t3.setMonth(11, 31), t3;
      }, eachMonthOfInterval: (t3) => {
        const n4 = a3(t3.start), o5 = a3(t3.end), r4 = [], i4 = new TZDate(n4.getFullYear(), n4.getMonth(), 1, 12, 0, 0, e3), s3 = 12 * o5.getFullYear() + o5.getMonth();
        for (; 12 * i4.getFullYear() + i4.getMonth() <= s3; ) r4.push(new TZDate(i4, e3)), i4.setMonth(i4.getMonth() + 1, 1);
        return r4;
      }, addDays: (e4, t3) => {
        const n4 = a3(e4);
        return n4.setDate(n4.getDate() + t3), n4;
      }, addWeeks: (e4, t3) => {
        const n4 = a3(e4);
        return n4.setDate(n4.getDate() + 7 * t3), n4;
      }, addMonths: (e4, t3) => {
        const n4 = a3(e4);
        return n4.setMonth(n4.getMonth() + t3), n4;
      }, addYears: (e4, t3) => {
        const n4 = a3(e4);
        return n4.setFullYear(n4.getFullYear() + t3), n4;
      }, eachYearOfInterval: (t3) => {
        const n4 = a3(t3.start), o5 = a3(t3.end), r4 = [], i4 = new TZDate(n4.getFullYear(), 0, 1, 12, 0, 0, e3);
        for (; i4.getFullYear() <= o5.getFullYear(); ) r4.push(new TZDate(i4, e3)), i4.setFullYear(i4.getFullYear() + 1, 0, 1);
        return r4;
      }, getWeek: (e4, t3) => ne(i3(e4), { weekStartsOn: t3?.weekStartsOn ?? r3, firstWeekContainsDate: t3?.firstWeekContainsDate ?? o4?.options?.firstWeekContainsDate ?? 1 }), getISOWeek: (e4) => ee(i3(e4)), differenceInCalendarDays: (e4, t3) => H(i3(e4), i3(t3)), differenceInCalendarMonths: (e4, t3) => q(i3(e4), i3(t3)) };
    })(t.timeZone, { weekStartsOn: n2, locale: e2 }) : void 0, r2 = t.dateLib && o3 ? { ...o3, ...t.dateLib } : t.dateLib ?? o3, a2 = new DateLib({ locale: e2, weekStartsOn: n2, firstWeekContainsDate: t.firstWeekContainsDate, useAdditionalWeekYearTokens: t.useAdditionalWeekYearTokens, useAdditionalDayOfYearTokens: t.useAdditionalDayOfYearTokens, timeZone: t.timeZone, numerals: t.numerals }, r2);
    return { dateLib: a2, components: (s2 = t.components, { ...Ve, ...s2 }), formatters: (i2 = t.formatters, i2?.formatMonthCaption && !i2.formatCaption && (i2.formatCaption = i2.formatMonthCaption), i2?.formatYearCaption && !i2.formatYearDropdown && (i2.formatYearDropdown = i2.formatYearCaption), { ...ht, ...i2 }), labels: Tt(t.labels, a2.options), locale: e2, classNames: { ...dt(), ...t.classNames } };
    var i2, s2;
  }, [t.locale, t.broadcastCalendar, t.weekStartsOn, t.firstWeekContainsDate, t.useAdditionalWeekYearTokens, t.useAdditionalDayOfYearTokens, t.timeZone, t.numerals, t.dateLib, t.noonSafe, t.components, t.formatters, t.labels, t.classNames]);
  t.today || (t = { ...t, today: i.today() });
  const { captionLayout: l, mode: c, navLayout: u2, numberOfMonths: f = 1, onDayBlur: h, onDayClick: m, onDayFocus: y, onDayKeyDown: p, onDayMouseEnter: b, onDayMouseLeave: w, onNextClick: D, onPrevClick: k, showWeekNumber: O, styles: S2 } = t, { formatCaption: N2, formatDay: C2, formatMonthDropdown: T2, formatWeekNumber: x2, formatWeekNumberHeader: Y2, formatWeekdayName: E2, formatYearDropdown: L2 } = r, P2 = Zt(t, i), { days: F2, months: I2, navStart: B2, navEnd: _2, previousMonth: Z2, nextMonth: A2, goToMonth: j2 } = P2, z2 = (function(e2, t2, n2, o3, r2) {
    const { disabled: a2, hidden: i2, modifiers: s2, showOutsideDays: d2, broadcastCalendar: l2, today: c2 = r2.today() } = t2, { isSameDay: u3, isSameMonth: f2, startOfMonth: h2, isBefore: m2, endOfMonth: y2, isAfter: p2 } = r2, g2 = n2 && h2(n2), b2 = o3 && y2(o3), w2 = { [$e.focused]: [], [$e.outside]: [], [$e.disabled]: [], [$e.hidden]: [], [$e.today]: [] }, v = {};
    for (const M of e2) {
      const { date: e3, displayMonth: t3 } = M, n3 = Boolean(t3 && !f2(e3, t3)), o4 = Boolean(g2 && m2(e3, g2)), h3 = Boolean(b2 && p2(e3, b2)), y3 = Boolean(a2 && st(e3, a2, r2)), D2 = Boolean(i2 && st(e3, i2, r2)) || o4 || h3 || !l2 && !d2 && n3 || l2 && false === d2 && n3, k2 = u3(e3, c2);
      n3 && w2.outside.push(M), y3 && w2.disabled.push(M), D2 && w2.hidden.push(M), k2 && w2.today.push(M), s2 && Object.keys(s2).forEach((t4) => {
        const n4 = s2?.[t4];
        n4 && st(e3, n4, r2) && (v[t4] ? v[t4].push(M) : v[t4] = [M]);
      });
    }
    return (e3) => {
      const t3 = { [$e.focused]: false, [$e.disabled]: false, [$e.hidden]: false, [$e.outside]: false, [$e.today]: false }, n3 = {};
      for (const o4 in w2) {
        const n4 = w2[o4];
        t3[o4] = n4.some((t4) => t4 === e3);
      }
      for (const o4 in v) n3[o4] = v[o4].some((t4) => t4 === e3);
      return { ...t3, ...n3 };
    };
  })(F2, t, B2, _2, i), { isSelected: $2, select: U2, selected: G2 } = Qt(t, i) ?? {}, { blur: Q2, focused: R2, isFocusTarget: X2, moveFocus: K2, setFocused: J2 } = zt(t, P2, z2, $2 ?? (() => false), i), { labelDayButton: V2, labelGridcell: te2, labelGrid: oe2, labelMonthDropdown: re2, labelNav: ae2, labelPrevious: ie2, labelNext: se2, labelWeekday: de2, labelWeekNumber: le2, labelWeekNumberHeader: ce2, labelYearDropdown: ue2 } = a, fe2 = reactExports.useMemo(() => (function(e2, t2, n2, o3) {
    const r2 = o3 ?? e2.today(), a2 = n2 ? e2.startOfBroadcastWeek(r2, e2) : t2 ? e2.startOfISOWeek(r2) : e2.startOfWeek(r2), i2 = [];
    for (let s2 = 0; s2 < 7; s2++) {
      const t3 = e2.addDays(a2, s2);
      i2.push(t3);
    }
    return i2;
  })(i, t.ISOWeek, t.broadcastCalendar, t.today), [i, t.ISOWeek, t.broadcastCalendar, t.today]), he2 = void 0 !== c || void 0 !== m, me2 = reactExports.useCallback(() => {
    Z2 && (j2(Z2), k?.(Z2));
  }, [Z2, j2, k]), ye2 = reactExports.useCallback(() => {
    A2 && (j2(A2), D?.(A2));
  }, [j2, A2, D]), pe2 = reactExports.useCallback((e2, t2) => (n2) => {
    n2.preventDefault(), n2.stopPropagation(), J2(e2), t2.disabled || (U2?.(e2.date, t2, n2), m?.(e2.date, t2, n2));
  }, [U2, m, J2]), ge2 = reactExports.useCallback((e2, t2) => (n2) => {
    J2(e2), y?.(e2.date, t2, n2);
  }, [y, J2]), be2 = reactExports.useCallback((e2, t2) => (n2) => {
    Q2(), h?.(e2.date, t2, n2);
  }, [Q2, h]), we2 = reactExports.useCallback((e2, n2) => (o3) => {
    const r2 = { ArrowLeft: [o3.shiftKey ? "month" : "day", "rtl" === t.dir ? "after" : "before"], ArrowRight: [o3.shiftKey ? "month" : "day", "rtl" === t.dir ? "before" : "after"], ArrowDown: [o3.shiftKey ? "year" : "week", "after"], ArrowUp: [o3.shiftKey ? "year" : "week", "before"], PageUp: [o3.shiftKey ? "year" : "month", "before"], PageDown: [o3.shiftKey ? "year" : "month", "after"], Home: ["startOfWeek", "before"], End: ["endOfWeek", "after"] };
    if (r2[o3.key]) {
      o3.preventDefault(), o3.stopPropagation();
      const [e3, t2] = r2[o3.key];
      K2(e3, t2);
    }
    p?.(e2.date, n2, o3);
  }, [K2, p, t.dir]), ve2 = reactExports.useCallback((e2, t2) => (n2) => {
    b?.(e2.date, t2, n2);
  }, [b]), Me2 = reactExports.useCallback((e2, t2) => (n2) => {
    w?.(e2.date, t2, n2);
  }, [w]), De2 = reactExports.useCallback((e2) => (t2) => {
    const n2 = Number(t2.target.value), o3 = i.setMonth(i.startOfMonth(e2), n2);
    j2(o3);
  }, [i, j2]), ke2 = reactExports.useCallback((e2) => (t2) => {
    const n2 = Number(t2.target.value), o3 = i.setYear(i.startOfMonth(e2), n2);
    j2(o3);
  }, [i, j2]), { className: Oe2, style: We2 } = reactExports.useMemo(() => ({ className: [d[je.Root], t.className].filter(Boolean).join(" "), style: { ...S2?.[je.Root], ...t.style } }), [d, t.className, t.style, S2]), Se2 = (function(e2) {
    const t2 = { "data-mode": e2.mode ?? void 0, "data-required": "required" in e2 ? e2.required : void 0, "data-multiple-months": e2.numberOfMonths && e2.numberOfMonths > 1 || void 0, "data-week-numbers": e2.showWeekNumber || void 0, "data-broadcast-calendar": e2.broadcastCalendar || void 0, "data-nav-layout": e2.navLayout || void 0 };
    return Object.entries(e2).forEach(([e3, n2]) => {
      e3.startsWith("data-") && (t2[e3] = n2);
    }), t2;
  })(t), Ne2 = reactExports.useRef(null);
  It(Ne2, Boolean(t.animate), { classNames: d, months: I2, focused: R2, dateLib: i });
  const Ce2 = { dayPickerProps: t, selected: G2, select: U2, isSelected: $2, months: I2, nextMonth: A2, previousMonth: Z2, goToMonth: j2, getModifiers: z2, components: o2, classNames: d, styles: S2, labels: a, formatters: r };
  return g.createElement(Ke.Provider, { value: Ce2 }, g.createElement(o2.Root, { rootRef: t.animate ? Ne2 : void 0, className: Oe2, style: We2, dir: t.dir, id: t.id, lang: t.lang ?? s.code, nonce: t.nonce, title: t.title, role: t.role, "aria-label": t["aria-label"], "aria-labelledby": t["aria-labelledby"], ...Se2 }, g.createElement(o2.Months, { className: d[je.Months], style: S2?.[je.Months] }, !t.hideNavigation && !u2 && g.createElement(o2.Nav, { "data-animated-nav": t.animate ? "true" : void 0, className: d[je.Nav], style: S2?.[je.Nav], "aria-label": ae2(), onPreviousClick: me2, onNextClick: ye2, previousMonth: Z2, nextMonth: A2 }), I2.map((e2, n2) => g.createElement(o2.Month, { "data-animated-month": t.animate ? "true" : void 0, className: d[je.Month], style: S2?.[je.Month], key: n2, displayIndex: n2, calendarMonth: e2 }, "around" === u2 && !t.hideNavigation && 0 === n2 && g.createElement(o2.PreviousMonthButton, { type: "button", className: d[je.PreviousMonthButton], tabIndex: Z2 ? void 0 : -1, "aria-disabled": !Z2 || void 0, "aria-label": ie2(Z2), onClick: me2, "data-animated-button": t.animate ? "true" : void 0 }, g.createElement(o2.Chevron, { disabled: !Z2 || void 0, className: d[je.Chevron], orientation: "rtl" === t.dir ? "right" : "left" })), g.createElement(o2.MonthCaption, { "data-animated-caption": t.animate ? "true" : void 0, className: d[je.MonthCaption], style: S2?.[je.MonthCaption], calendarMonth: e2, displayIndex: n2 }, l?.startsWith("dropdown") ? g.createElement(o2.DropdownNav, { className: d[je.Dropdowns], style: S2?.[je.Dropdowns] }, (() => {
    const n3 = "dropdown" === l || "dropdown-months" === l ? g.createElement(o2.MonthsDropdown, { key: "month", className: d[je.MonthsDropdown], "aria-label": re2(), classNames: d, components: o2, disabled: Boolean(t.disableNavigation), onChange: De2(e2.date), options: xt(e2.date, B2, _2, r, i), style: S2?.[je.Dropdown], value: i.getMonth(e2.date) }) : g.createElement("span", { key: "month" }, T2(e2.date, i)), a2 = "dropdown" === l || "dropdown-years" === l ? g.createElement(o2.YearsDropdown, { key: "year", className: d[je.YearsDropdown], "aria-label": ue2(i.options), classNames: d, components: o2, disabled: Boolean(t.disableNavigation), onChange: ke2(e2.date), options: Yt(B2, _2, r, i, Boolean(t.reverseYears)), style: S2?.[je.Dropdown], value: i.getYear(e2.date) }) : g.createElement("span", { key: "year" }, L2(e2.date, i));
    return "year-first" === i.getMonthYearOrder() ? [a2, n3] : [n3, a2];
  })(), g.createElement("span", { role: "status", "aria-live": "polite", style: { border: 0, clip: "rect(0 0 0 0)", height: "1px", margin: "-1px", overflow: "hidden", padding: 0, position: "absolute", width: "1px", whiteSpace: "nowrap", wordWrap: "normal" } }, N2(e2.date, i.options, i))) : g.createElement(o2.CaptionLabel, { className: d[je.CaptionLabel], role: "status", "aria-live": "polite" }, N2(e2.date, i.options, i))), "around" === u2 && !t.hideNavigation && n2 === f - 1 && g.createElement(o2.NextMonthButton, { type: "button", className: d[je.NextMonthButton], tabIndex: A2 ? void 0 : -1, "aria-disabled": !A2 || void 0, "aria-label": se2(A2), onClick: ye2, "data-animated-button": t.animate ? "true" : void 0 }, g.createElement(o2.Chevron, { disabled: !A2 || void 0, className: d[je.Chevron], orientation: "rtl" === t.dir ? "left" : "right" })), n2 === f - 1 && "after" === u2 && !t.hideNavigation && g.createElement(o2.Nav, { "data-animated-nav": t.animate ? "true" : void 0, className: d[je.Nav], style: S2?.[je.Nav], "aria-label": ae2(), onPreviousClick: me2, onNextClick: ye2, previousMonth: Z2, nextMonth: A2 }), g.createElement(o2.MonthGrid, { role: "grid", "aria-multiselectable": "multiple" === c || "range" === c, "aria-label": oe2(e2.date, i.options, i) || void 0, className: d[je.MonthGrid], style: S2?.[je.MonthGrid] }, !t.hideWeekdays && g.createElement(o2.Weekdays, { "data-animated-weekdays": t.animate ? "true" : void 0, className: d[je.Weekdays], style: S2?.[je.Weekdays] }, O && g.createElement(o2.WeekNumberHeader, { "aria-label": ce2(i.options), className: d[je.WeekNumberHeader], style: S2?.[je.WeekNumberHeader], scope: "col" }, Y2()), fe2.map((e3) => g.createElement(o2.Weekday, { "aria-label": de2(e3, i.options, i), className: d[je.Weekday], key: String(e3), style: S2?.[je.Weekday], scope: "col" }, E2(e3, i.options, i)))), g.createElement(o2.Weeks, { "data-animated-weeks": t.animate ? "true" : void 0, className: d[je.Weeks], style: S2?.[je.Weeks] }, e2.weeks.map((e3) => g.createElement(o2.Week, { className: d[je.Week], key: e3.weekNumber, style: S2?.[je.Week], week: e3 }, O && g.createElement(o2.WeekNumber, { week: e3, style: S2?.[je.WeekNumber], "aria-label": le2(e3.weekNumber, { locale: s }), className: d[je.WeekNumber], scope: "row", role: "rowheader" }, x2(e3.weekNumber, i)), e3.days.map((e4) => {
    const { date: n3 } = e4, r2 = z2(e4);
    if (r2[$e.focused] = !r2.hidden && Boolean(R2?.isEqualTo(e4)), r2[Ge.selected] = $2?.(n3) || r2.selected, nt(G2)) {
      const { from: e5, to: t2 } = G2;
      r2[Ge.range_start] = Boolean(e5 && t2 && i.isSameDay(n3, e5)), r2[Ge.range_end] = Boolean(e5 && t2 && i.isSameDay(n3, t2)), r2[Ge.range_middle] = et(G2, n3, true, i);
    }
    const a2 = (function(e5, t2 = {}, n4 = {}) {
      let o3 = { ...t2?.[je.Day] };
      return Object.entries(e5).filter(([, e6]) => true === e6).forEach(([e6]) => {
        o3 = { ...o3, ...n4?.[e6] };
      }), o3;
    })(r2, S2, t.modifiersStyles), s2 = (function(e5, t2, n4 = {}) {
      return Object.entries(e5).filter(([, e6]) => true === e6).reduce((e6, [o3]) => (n4[o3] ? e6.push(n4[o3]) : t2[$e[o3]] ? e6.push(t2[$e[o3]]) : t2[Ge[o3]] && e6.push(t2[Ge[o3]]), e6), [t2[je.Day]]);
    })(r2, d, t.modifiersClassNames), l2 = he2 || r2.hidden ? void 0 : te2(n3, r2, i.options, i);
    return g.createElement(o2.Day, { key: `${e4.isoDate}_${e4.displayMonthId}`, day: e4, modifiers: r2, className: s2.join(" "), style: a2, role: "gridcell", "aria-selected": r2.selected || void 0, "aria-label": l2, "data-day": e4.isoDate, "data-month": e4.outside ? e4.dateMonthId : void 0, "data-selected": r2.selected || void 0, "data-disabled": r2.disabled || void 0, "data-hidden": r2.hidden || void 0, "data-outside": e4.outside || void 0, "data-focused": r2.focused || void 0, "data-today": r2.today || void 0 }, !r2.hidden && he2 ? g.createElement(o2.DayButton, { className: d[je.DayButton], style: S2?.[je.DayButton], type: "button", day: e4, modifiers: r2, disabled: !r2.focused && r2.disabled || void 0, "aria-disabled": r2.focused && r2.disabled || void 0, tabIndex: X2(e4) ? 0 : -1, "aria-label": V2(n3, r2, i.options, i), onClick: pe2(e4, r2), onBlur: be2(e4, r2), onFocus: ge2(e4, r2), onKeyDown: we2(e4, r2), onMouseEnter: ve2(e4, r2), onMouseLeave: Me2(e4, r2) }, C2(n3, i.options, i)) : !r2.hidden && C2(e4.date, i.options, i));
  })))))))), t.footer && g.createElement(o2.Footer, { className: d[je.Footer], style: S2?.[je.Footer], role: "status", "aria-live": "polite" }, t.footer)));
}
(At = Ht || (Ht = {}))[At.Today = 0] = "Today", At[At.Selected = 1] = "Selected", At[At.LastFocused = 2] = "LastFocused", At[At.FocusedModifier = 3] = "FocusedModifier";
const en = Intl.DateTimeFormat().resolvedOptions().timeZone;
function tn({ dateTime: g2, nodeKey: b }) {
  const [w] = o(), [v, D] = reactExports.useState(false), W = reactExports.useRef(null), [S2, N2] = reactExports.useState(g2), [C2, T2] = reactExports.useState(() => {
    if (void 0 === g2) return false;
    const e = g2?.getHours(), t = g2?.getMinutes();
    return 0 !== e || 0 !== t;
  }), [x2, Y2] = reactExports.useState(() => {
    if (void 0 === g2) return "00:00";
    const e = g2?.getHours(), t = g2?.getMinutes();
    return 0 !== e || 0 !== t ? `${e?.toString().padStart(2, "0")}:${t?.toString().padStart(2, "0")}` : "00:00";
  }), [E2] = u(b), { refs: F2, floatingStyles: I2, context: B2 } = wx({ elements: { reference: W.current }, middleware: [Wa(5), Ya({ fallbackPlacements: ["top-start"] }), Ga({ padding: 10 })], onOpenChange: D, open: v, placement: "bottom-start", strategy: "fixed", whileElementsMounted: Aa }), _2 = Sx(B2, { role: "dialog" }), Z2 = bx(B2), { getFloatingProps: H2 } = kx([_2, Z2]);
  reactExports.useEffect(() => {
    const e = W.current;
    function t(e2) {
      e2.preventDefault(), D(true);
    }
    return e && e.addEventListener("click", t), () => {
      e && e.removeEventListener("click", t);
    };
  }, [F2, w]);
  const A2 = (e, t) => {
    w.update(() => {
      const t2 = Mo(b);
      Wg(t2) && e(t2);
    }, { onUpdate: t });
  };
  return jsxRuntimeExports.jsxs("div", { className: "dateTimePill " + (E2 ? "selected" : ""), ref: W, style: { cursor: "pointer", width: "fit-content" }, children: [g2?.toDateString() + (C2 ? " " + x2 : "") || "Invalid Date", v && /* @__PURE__ */ jsxRuntimeExports.jsx(ox, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(hx, { lockScroll: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(ux, { context: B2, initialFocus: -1, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dateTimePicker", ref: F2.setFloating, style: I2, ...H2(), children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Vt, { captionLayout: "dropdown", navLayout: "after", fixedWeeks: false, showOutsideDays: false, mode: "single", selected: S2, required: true, onSelect: (e) => {
      A2((t) => {
        if (!x2 || !e) return void N2(e);
        const [n, o2] = x2.split(":").map((e2) => parseInt(e2, 10)), r = new Date(e.getFullYear(), e.getMonth(), e.getDate(), n, o2);
        t.setDateTime(r), N2(r);
      });
    }, startMonth: new Date(1925, 0), endMonth: new Date(2042, 7) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("form", { style: { marginBlockEnd: "1em" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "300px" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", id: "option1", name: "option1", value: "value1", checked: C2, onChange: (e) => {
        A2((t) => {
          if (e.target.checked) T2(true);
          else {
            if (S2) {
              const e2 = Te(xe(S2, 0), 0);
              t.setDateTime(e2);
            }
            T2(false), Y2("00:00");
          }
        });
      } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "time", value: x2, onChange: (e) => {
        A2((t) => {
          const n = e.target.value;
          if (!S2) return void Y2(n);
          const [o2, r] = n.split(":").map((e2) => parseInt(e2, 10)), a = Te(xe(S2, r), o2);
          N2(a), t.setDateTime(a), Y2(n);
        });
      }, disabled: !C2 }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [" ", en] })
    ] }) })
  ] }) }) }) })] });
}
export {
  tn as default
};
