import { r as reactExports, j as jsxRuntimeExports } from "../index.js";
import { n as ne$1, d as u, l as b, o, m as a, $ as $r, O as Or, z as zo, p as wr, q as ec, R as Re, H as Hi, r as re$1, s as Ae, E as Ee, t as oe$1, v as mg, x as cg, y as f_, B as i_, P as Pb, C as a$1, D as o_, V, Q as Qp, F as a$2, L, I as n, J as Iy, K as jN, M as Mo, N as Qg, Z as Zh, T as Ge, X as Xg, U as qi, _ as Io, a0 as Mt } from "./template-DGSplFaZ.js";
import { m } from "./LexicalNestedComposer.prod-BnnZCIxu.js";
import "../__vite_rsc_assets_manifest.js";
import "node:async_hooks";
function F(e, t, r) {
  return Math.min(Math.max(e, t), r);
}
const q = 1, J = 8, Q = 2, U = 4;
function Z({ onResizeStart: r, onResizeEnd: i, buttonRef: n2, imageRef: o2, maxWidth: a2, editor: s, showCaption: l, setShowCaption: c, captionsEnabled: d }) {
  const u2 = reactExports.useRef(null), m2 = reactExports.useRef({ priority: "", value: "default" }), g = reactExports.useRef({ currentHeight: 0, currentWidth: 0, direction: 0, isResizing: false, ratio: 0, startHeight: 0, startWidth: 0, startX: 0, startY: 0 }), p = s.getRootElement(), f = a2 || (null !== p ? p.getBoundingClientRect().width - 20 : 100), w = null !== p ? p.getBoundingClientRect().height - 20 : 100, x = (e, t) => {
    if (!s.isEditable()) return;
    const i2 = o2.current, n3 = u2.current;
    if (null !== i2 && null !== n3) {
      e.preventDefault();
      const { width: o3, height: a3 } = i2.getBoundingClientRect(), s2 = Mt(i2), l2 = g.current;
      l2.startWidth = o3, l2.startHeight = a3, l2.ratio = o3 / a3, l2.currentWidth = o3, l2.currentHeight = a3, l2.startX = e.clientX / s2, l2.startY = e.clientY / s2, l2.isResizing = true, l2.direction = t, ((e2) => {
        const t2 = e2 === q || e2 === U ? "ew" : e2 === J || e2 === Q ? "ns" : e2 & J && e2 & U || e2 & Q && e2 & q ? "nwse" : "nesw";
        null !== p && p.style.setProperty("cursor", `${t2}-resize`, "important"), null !== document.body && (document.body.style.setProperty("cursor", `${t2}-resize`, "important"), m2.current.value = document.body.style.getPropertyValue("-webkit-user-select"), m2.current.priority = document.body.style.getPropertyPriority("-webkit-user-select"), document.body.style.setProperty("-webkit-user-select", "none", "important"));
      })(t), r(), n3.classList.add("image-control-wrapper--resizing"), i2.style.height = `${a3}px`, i2.style.width = `${o3}px`, document.addEventListener("pointermove", y), document.addEventListener("pointerup", v);
    }
  }, y = (e) => {
    const t = o2.current, r2 = g.current, i2 = r2.direction & (q | U), n3 = r2.direction & (Q | J);
    if (null !== t && r2.isResizing) {
      const o3 = Mt(t);
      if (i2 && n3) {
        let i3 = Math.floor(r2.startX - e.clientX / o3);
        i3 = r2.direction & q ? -i3 : i3;
        const n4 = F(r2.startWidth + i3, 100, f), a3 = n4 / r2.ratio;
        t.style.width = `${n4}px`, t.style.height = `${a3}px`, r2.currentHeight = a3, r2.currentWidth = n4;
      } else if (n3) {
        let i3 = Math.floor(r2.startY - e.clientY / o3);
        i3 = r2.direction & Q ? -i3 : i3;
        const n4 = F(r2.startHeight + i3, 100, w);
        t.style.height = `${n4}px`, r2.currentHeight = n4;
      } else {
        let i3 = Math.floor(r2.startX - e.clientX / o3);
        i3 = r2.direction & q ? -i3 : i3;
        const n4 = F(r2.startWidth + i3, 100, f);
        t.style.width = `${n4}px`, r2.currentWidth = n4;
      }
    }
  }, v = () => {
    const e = o2.current, t = g.current, r2 = u2.current;
    if (null !== e && null !== r2 && t.isResizing) {
      const e2 = t.currentWidth, n3 = t.currentHeight;
      t.startWidth = 0, t.startHeight = 0, t.ratio = 0, t.startX = 0, t.startY = 0, t.currentWidth = 0, t.currentHeight = 0, t.isResizing = false, r2.classList.remove("image-control-wrapper--resizing"), null !== p && p.style.setProperty("cursor", "text"), null !== document.body && (document.body.style.setProperty("cursor", "default"), document.body.style.setProperty("-webkit-user-select", m2.current.value, m2.current.priority)), i(e2, n3), document.removeEventListener("pointermove", y), document.removeEventListener("pointerup", v);
    }
  };
  return jsxRuntimeExports.jsxs("div", { ref: u2, children: [
    !l && d && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "image-caption-button", ref: n2, onClick: () => {
      c(!l);
    }, children: "Add Caption" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "image-resizer image-resizer-n", onPointerDown: (e) => {
      x(e, J);
    } }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "image-resizer image-resizer-ne", onPointerDown: (e) => {
      x(e, J | q);
    } }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "image-resizer image-resizer-e", onPointerDown: (e) => {
      x(e, q);
    } }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "image-resizer image-resizer-se", onPointerDown: (e) => {
      x(e, Q | q);
    } }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "image-resizer image-resizer-s", onPointerDown: (e) => {
      x(e, Q);
    } }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "image-resizer image-resizer-sw", onPointerDown: (e) => {
      x(e, Q | U);
    } }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "image-resizer image-resizer-w", onPointerDown: (e) => {
      x(e, U);
    } }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "image-resizer image-resizer-nw", onPointerDown: (e) => {
      x(e, J | U);
    } })
  ] });
}
const ee = /* @__PURE__ */ new Map(), te = ne$1("RIGHT_CLICK_IMAGE_COMMAND");
function re({ setShowCaption: e }) {
  const [t] = o();
  return reactExports.useEffect(() => t.registerCommand(Ge, () => (Xg() && e(false), false), qi)), null;
}
function ie({ altText: e, className: r, imageRef: i, src: n2, width: o2, height: a2, maxWidth: s, onError: l }) {
  const c = (function(e2) {
    return e2.toLowerCase().endsWith(".svg");
  })(n2), d = (function(e2) {
    let t = ee.get(e2);
    if (t && "error" in t && "boolean" == typeof t.error) return t;
    if (!t) throw t = new Promise((t2) => {
      const r2 = new Image();
      r2.src = e2, r2.onload = () => t2({ error: false, height: r2.naturalHeight, width: r2.naturalWidth }), r2.onerror = () => t2({ error: true });
    }).then((t2) => (ee.set(e2, t2), t2)), ee.set(e2, t), t;
    throw t;
  })(n2);
  if (reactExports.useEffect(() => {
    d.error && l();
  }, [d.error, l]), d.error)
    return jsxRuntimeExports.jsx(ne, {});
  const u2 = d, m2 = (() => {
    if (!c) return { height: a2, maxWidth: s, width: o2 };
    let e2 = u2.width, t = u2.height;
    if (e2 > s) {
      const r2 = s / e2;
      e2 = s, t = Math.round(t * r2);
    }
    if (t > 500) {
      const r2 = 500 / t;
      t = 500, e2 = Math.round(e2 * r2);
    }
    return { height: t, maxWidth: s, width: e2 };
  })();
  return jsxRuntimeExports.jsx("img", { className: r || void 0, src: n2, alt: e, ref: i, style: m2, onError: l, draggable: "false" });
}
function ne() {
  return jsxRuntimeExports.jsx("img", { src: Zh, style: { height: 200, opacity: 0.2, width: 200 }, draggable: "false", alt: "Broken image" });
}
function oe() {
}
function ae({ src: h, altText: N, nodeKey: P, width: W, height: O, maxWidth: V$1, resizable: F2, showCaption: q2, caption: J2, captionsEnabled: Q2 }) {
  const U2 = reactExports.useRef(null), ee2 = reactExports.useRef(null), [ae2, se, le] = u(P), [ce, de] = reactExports.useState(false), { isCollabActive: ue } = b(), [me] = o(), he = reactExports.useRef(null), [ge, pe] = reactExports.useState(false), fe = a(), we = reactExports.useMemo(() => ae2 && me.getEditorState().read(() => {
    const e = $r();
    return Or(e) && e.has(P);
  }), [me, ae2, P]), xe = reactExports.useCallback((e) => {
    const t = $r(), r = ee2.current;
    if (Or(t) && t.has(P) && 1 === t.getNodes().length) {
      if (q2) return zo(null), e.preventDefault(), J2.focus(), true;
      if (null !== r && r !== document.activeElement) return e.preventDefault(), r.focus(), true;
    }
    return false;
  }, [J2, P, q2]), ye = reactExports.useCallback((e) => (he.current === J2 || ee2.current === e.target) && (zo(null), me.update(() => {
    se(true);
    const e2 = me.getRootElement();
    null !== e2 && e2.focus();
  }), true), [J2, me, se]), ve = reactExports.useCallback((e) => {
    const t = e;
    return !!ce || t.target === U2.current && (t.shiftKey ? se(!ae2) : (le(), se(true)), true);
  }, [ce, ae2, se, le]), be = reactExports.useCallback((e) => {
    me.getEditorState().read(() => {
      const t = $r();
      "IMG" === e.target.tagName && wr(t) && 1 === t.getNodes().length && me.dispatchCommand(te, e);
    });
  }, [me]);
  reactExports.useEffect(() => ec(me.registerCommand(re$1, (e, t) => (he.current = t, false), Hi), me.registerCommand(Re, (e) => e.target === U2.current && (e.preventDefault(), true), Hi)), [me]), reactExports.useEffect(() => {
    let e = oe;
    return ec(me.registerCommand(oe$1, ve, Hi), me.registerCommand(te, ve, Hi), me.registerCommand(Ee, xe, Hi), me.registerCommand(Ae, ye, Hi), me.registerRootListener((t) => {
      e(), e = oe, t && (t.addEventListener("contextmenu", be), e = () => t.removeEventListener("contextmenu", be));
    }), () => e());
  }, [me, xe, ye, ve, be]);
  const Ce = (e) => {
    me.update(() => {
      const t = Mo(P);
      Qg(t) && (t.setShowCaption(e), e && t.__caption.update(() => {
        $r() || Io().selectEnd();
      }));
    });
  }, { historyState: ze } = mg(), { settings: { showNestedEditorTreeView: Ee$1 } } = cg(), Ne = (ae2 || ce) && fe;
  return jsxRuntimeExports.jsx(reactExports.Suspense, { fallback: null, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { draggable: we && !ce, children: ge ? /* @__PURE__ */ jsxRuntimeExports.jsx(ne, {}) : /* @__PURE__ */ jsxRuntimeExports.jsx(ie, { className: Ne ? "focused " + (we ? "draggable" : "") : null, src: h, altText: N, imageRef: U2, width: W, height: O, maxWidth: V$1, onError: () => pe(true) }) }),
    q2 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "image-caption-container", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(m, { initialEditor: J2, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(re, { setShowCaption: Ce }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(f_, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx(i_, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Pb, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx(a$1, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx(o_, {}),
      ue ? /* @__PURE__ */ jsxRuntimeExports.jsx(V, { id: J2.getKey(), providerFactory: Qp, shouldBootstrap: true }) : /* @__PURE__ */ jsxRuntimeExports.jsx(a$2, { externalHistoryState: ze }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(L, { contentEditable: /* @__PURE__ */ jsxRuntimeExports.jsx(Iy, { placeholder: "Enter a caption...", placeholderClassName: "ImageNode__placeholder", className: "ImageNode__contentEditable" }), ErrorBoundary: n }),
      true === Ee$1 ? /* @__PURE__ */ jsxRuntimeExports.jsx(jN, {}) : null
    ] }) }),
    F2 && we && Ne && /* @__PURE__ */ jsxRuntimeExports.jsx(Z, { showCaption: q2, setShowCaption: Ce, editor: me, buttonRef: ee2, imageRef: U2, maxWidth: V$1, onResizeStart: () => {
      de(true);
    }, onResizeEnd: (e, t) => {
      setTimeout(() => {
        de(false);
      }, 200), me.update(() => {
        const r = Mo(P);
        Qg(r) && r.setWidthAndHeight(e, t);
      });
    }, captionsEnabled: !ge && Q2 })
  ] }) });
}
export {
  te as RIGHT_CLICK_IMAGE_COMMAND,
  ae as default
};
