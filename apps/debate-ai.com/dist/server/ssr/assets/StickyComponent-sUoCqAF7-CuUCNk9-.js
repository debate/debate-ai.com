import { r as reactExports, j as jsxRuntimeExports } from "../index.js";
import { o, l as b, v as mg, M as Mo, a5 as xh, a6 as Tf, a7 as Dy, V, Q as Qp, F as a, a8 as L$1, I as n, J as Iy, a0 as Mt } from "./template-DGSplFaZ.js";
import { m } from "./LexicalNestedComposer.prod-BnnZCIxu.js";
import "../__vite_rsc_assets_manifest.js";
import "node:async_hooks";
const C = { ...Dy, paragraph: "StickyEditorTheme__paragraph" };
function E(e, t) {
  const o2 = e.style, r = t.rootElementRect, n2 = null !== r ? r.left : 0, l = null !== r ? r.top : 0;
  o2.top = l + t.y + "px", o2.left = n2 + t.x + "px";
}
function L({ x: g, y: L2, nodeKey: b$1, color: R, caption: k }) {
  const [N] = o(), D = reactExports.useRef(null), P = reactExports.useRef({ isDragging: false, offsetX: 0, offsetY: 0, rootElementRect: null, x: 0, y: 0 }), { isCollabActive: w } = b();
  reactExports.useEffect(() => {
    const e = P.current;
    e.x = g, e.y = L2;
    const t = D.current;
    null !== t && E(t, e);
  }, [g, L2]), reactExports.useLayoutEffect(() => {
    const e = P.current, t = new ResizeObserver((t2) => {
      for (let o3 = 0; o3 < t2.length; o3++) {
        const r2 = t2[o3], { target: n2 } = r2;
        e.rootElementRect = n2.getBoundingClientRect();
        const l = D.current;
        null !== l && E(l, e);
      }
    }), o2 = N.registerRootListener((e2, o3) => {
      null !== o3 && t.unobserve(o3), null !== e2 && t.observe(e2);
    }), r = () => {
      const t2 = N.getRootElement(), o3 = D.current;
      null !== t2 && null !== o3 && (e.rootElementRect = t2.getBoundingClientRect(), E(o3, e));
    };
    return window.addEventListener("resize", r), () => {
      window.removeEventListener("resize", r), o2();
    };
  }, [N]), reactExports.useEffect(() => {
    const e = D.current;
    null !== e && setTimeout(() => {
      e.style.setProperty("transition", "top 0.3s ease 0s, left 0.3s ease 0s");
    }, 500);
  }, []);
  const B = (e) => {
    const t = D.current, o2 = P.current, r = o2.rootElementRect, n2 = Mt(t);
    null !== t && o2.isDragging && null !== r && (o2.x = e.pageX / n2 - o2.offsetX - r.left, o2.y = e.pageY / n2 - o2.offsetY - r.top, E(t, o2));
  }, X = (e) => {
    const t = D.current, o2 = P.current;
    null !== t && (o2.isDragging = false, t.classList.remove("dragging"), N.update(() => {
      const e2 = Mo(b$1);
      xh(e2) && e2.setPosition(o2.x, o2.y);
    })), document.removeEventListener("pointermove", B), document.removeEventListener("pointerup", X);
  }, { historyState: _ } = mg();
  return jsxRuntimeExports.jsx("div", { ref: D, className: "sticky-note-container", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `sticky-note ${R}`, onPointerDown: (e) => {
    const t = D.current;
    if (null == t || 2 === e.button || e.target !== t.firstChild) return;
    const o2 = t, r = P.current;
    if (null !== o2) {
      const { top: t2, left: n2 } = o2.getBoundingClientRect(), l = Mt(o2);
      r.offsetX = e.clientX / l - n2, r.offsetY = e.clientY / l - t2, r.isDragging = true, o2.classList.add("dragging"), document.addEventListener("pointermove", B), document.addEventListener("pointerup", X), e.preventDefault();
    }
  }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => {
      N.update(() => {
        const e = Mo(b$1);
        xh(e) && e.remove();
      });
    }, className: "delete", "aria-label": "Delete sticky note", title: "Delete", children: "X" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => {
      N.update(() => {
        const e = Mo(b$1);
        xh(e) && e.toggleColor();
      });
    }, className: "color", "aria-label": "Change sticky note color", title: "Color", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Tf, { name: "paint-bucket" }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(m, { initialEditor: k, initialTheme: C, children: [
      w ? /* @__PURE__ */ jsxRuntimeExports.jsx(V, { id: k.getKey(), providerFactory: Qp, shouldBootstrap: true }) : /* @__PURE__ */ jsxRuntimeExports.jsx(a, { externalHistoryState: _ }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(L$1, { contentEditable: /* @__PURE__ */ jsxRuntimeExports.jsx(Iy, { placeholder: "What's up?", placeholderClassName: "StickyNode__placeholder", className: "StickyNode__contentEditable" }), ErrorBoundary: n })
    ] })
  ] }) });
}
export {
  L as default
};
