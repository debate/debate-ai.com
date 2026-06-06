import { r as reactExports, j as jsxRuntimeExports } from "../index.js";
import { o, d as u, q as ec, t as oe, H as Hi, $ as $r, a1 as Eh, l as b, a2 as jh, M as Mo, a3 as bh, O as Or, a4 as ph } from "./template-DGSplFaZ.js";
import "../__vite_rsc_assets_manifest.js";
import "node:async_hooks";
function P({ option: l, index: n, options: i, totalVotes: a, withPollNode: r }) {
  const { name: s } = b(), c = reactExports.useRef(null), d = l.votes, p = -1 !== d.indexOf(s), m = d.length, N = l.text;
  return jsxRuntimeExports.jsxs("div", { className: "PollNode__optionContainer", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: jh("PollNode__optionCheckboxWrapper", p && "PollNode__optionCheckboxChecked"), children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { ref: c, className: "PollNode__optionCheckbox", type: "checkbox", onChange: (e) => {
      r((e2) => {
        e2.toggleVote(l, s);
      });
    }, checked: p }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "PollNode__optionInputWrapper", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "PollNode__optionInputVotes", style: { width: (0 === m ? 0 : m / a * 100) + "%" } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "PollNode__optionInputVotesCount", children: m > 0 && (1 === m ? "1 vote" : `${m} votes`) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "PollNode__optionInput", type: "text", value: N, onChange: (e) => {
        const o2 = e.target, t = o2.value, n2 = o2.selectionStart, i2 = o2.selectionEnd;
        r((e2) => {
          e2.setOptionText(l, t);
        }, () => {
          o2.selectionStart = n2, o2.selectionEnd = i2;
        });
      }, placeholder: `Option ${n + 1}` })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { disabled: i.length < 3, className: jh("PollNode__optionDelete", i.length < 3 && "PollNode__optionDeleteDisabled"), "aria-label": "Remove", onClick: () => {
      r((e) => {
        e.deleteOption(l);
      });
    } })
  ] });
}
function C({ question: t, options: f, nodeKey: C2 }) {
  const [v] = o(), g = reactExports.useMemo(() => (function(e) {
    return e.reduce((e2, o2) => e2 + o2.votes.length, 0);
  })(f), [f]), [b2, k, y] = u(C2), [O, V] = reactExports.useState(null), I = reactExports.useRef(null);
  reactExports.useEffect(() => ec(v.registerUpdateListener(({ editorState: e }) => {
    V(e.read(() => $r()));
  }), v.registerCommand(oe, (e) => {
    const o2 = e;
    return o2.target === I.current && (o2.shiftKey || y(), k(!b2), true);
  }, Hi)), [y, v, b2, C2, k]);
  const L = (e, o2) => {
    v.update(() => {
      const o3 = Mo(C2);
      bh(o3) && e(o3);
    }, { onUpdate: o2 });
  }, S = Or(O) && b2;
  return jsxRuntimeExports.jsx("div", { className: "PollNode__container " + (S ? "focused" : ""), ref: I, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "PollNode__inner", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "PollNode__heading", children: t }),
    f.map((o2, t2) => {
      const l = o2.uid;
      return jsxRuntimeExports.jsx(P, { withPollNode: L, option: o2, index: t2, options: f, totalVotes: g }, l);
    }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "PollNode__footer", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Eh, { onClick: () => {
      L((e) => {
        e.addOption(ph());
      });
    }, small: true, children: "Add Option" }) })
  ] }) });
}
export {
  C as default
};
