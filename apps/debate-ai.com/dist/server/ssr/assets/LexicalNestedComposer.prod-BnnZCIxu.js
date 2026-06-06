import { a9 as r, aa as t, ab as co, ac as to, ad as ct, ae as l } from "./template-DGSplFaZ.js";
import { r as reactExports, j as jsxRuntimeExports } from "../index.js";
function m({ initialEditor: m2, children: h, initialNodes: u, initialTheme: g, skipCollabChecks: x, skipEditableListener: _ }) {
  const v = reactExports.useRef(false), E = reactExports.useContext(r);
  null == E && (function(e, ...t2) {
    const o = new URL("https://lexical.dev/docs/error"), r2 = new URLSearchParams();
    r2.append("code", e);
    for (const e2 of t2) r2.append("v", e2);
    throw o.search = r2.toString(), Error(`Minified Lexical error #${e}; visit ${o.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  })(9);
  const [k, { getTheme: b }] = E, w = reactExports.useMemo(() => {
    const e = g || b() || void 0, t$1 = t(E, e);
    void 0 !== e && (m2._config.theme = e), m2._parentEditor = m2._parentEditor || k;
    const s = m2._createEditorArgs, a = s && s.namespace;
    if (u) {
      a || (m2._config.namespace = k._config.namespace);
      for (let e2 of u) {
        let t2 = null, o = null;
        if ("function" != typeof e2) {
          const r2 = e2;
          e2 = r2.replace, t2 = r2.with, o = r2.withKlass || null;
        }
        const s2 = co(m2, e2.getType());
        m2._nodes.set(e2.getType(), { exportDOM: s2 ? s2.exportDOM : void 0, klass: e2, replace: t2, replaceWithKlass: o, sharedNodeState: ct(e2), transforms: to(e2) });
      }
    } else if (s && s.nodes) a || (m2._config.namespace = k._config.namespace);
    else {
      const e2 = m2._nodes = new Map(k._nodes);
      a || (m2._config.namespace = k._config.namespace);
      for (const [t2, o] of e2) m2._nodes.set(t2, { exportDOM: o.exportDOM, klass: o.klass, replace: o.replace, replaceWithKlass: o.replaceWithKlass, sharedNodeState: ct(o.klass), transforms: to(o.klass) });
    }
    return [m2, t$1];
  }, []), C = reactExports.useContext(l), { isCollabActive: L, yjsDocMap: M } = C ?? {}, y = x || v.current || M && M.has(m2.getKey());
  return reactExports.useEffect(() => {
    y && (v.current = true);
  }, [y]), reactExports.useEffect(() => {
    if (!_) {
      const e = (e2) => m2.setEditable(e2);
      return e(k.isEditable()), k.registerEditableListener(e);
    }
  }, [m2, k, _]), jsxRuntimeExports.jsx(r.Provider, { value: w, children: !L || y ? h : null });
}
export {
  m
};
