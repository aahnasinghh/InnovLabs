/**
 * ReactionSetupCanvas.jsx
 * -----------------------------------------------------------------------------
 * InnovLabs AI — pictorial CHEMICAL REACTION SETUP DESIGNER.
 *
 * A SINGLE standalone, reusable React component built on Fabric.js. A simplified
 * BioRender/ChemDraw-style editor for ASSEMBLING real lab apparatus into
 * reaction setups (reflux, distillation, filtration, titration, heating) — not
 * a flowchart, not a pipeline, not a dashboard.
 *
 *   • Apparatus images carry invisible connection ANCHORS (neck, bottom, port…).
 *   • Dragging a piece near a compatible anchor magnetically SNAPS it into the
 *     correct chemistry position; releasing commits a connection.
 *   • Connected pieces form an assembly cluster that moves together (parent-
 *     child), while individual resize / rotate / detach stay available.
 *   • TEMPLATES one-click generate clean setups (Reflux is the showcase, modeled
 *     on a classic reflux/distillation diagram: ring stand + clamps + condenser
 *     + round-bottom flask + tubing + water labels/arrows + hotplate).
 *
 * Layout:
 *     Toolbar  →  Left sidebar (Templates + categorized palette)  →  Canvas  →  Inspector
 *
 * Assets load from src/assets/labassets/<pack>/<name>.jpeg via import.meta.glob
 * (drop a file into a pack folder and it appears — no code changes).
 *
 * Future integration points are marked with `// [INTEGRATION]`.
 *
 * Requirements:  npm install fabric
 * Usage:         import ReactionSetupCanvas from "./components/ReactionSetupCanvas";
 *                <ReactionSetupCanvas />
 * -----------------------------------------------------------------------------
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, FabricImage, Textbox, Line, Triangle, Group, Circle, Rect, Ellipse, Polygon, Path, Point, util } from "fabric";

/* ============================================================================
 * IMAGE CLEANUP — trim whitespace + key near-white to transparent.
 * Photographic JPEGs ship with white margins; this tightly crops them and
 * makes the background transparent so palette drag/drop pieces look clean and
 * so connection anchors map to the real apparatus shape (not the image frame).
 * Same-origin (Vite) assets => no canvas taint. Cached per source URL.
 * ==========================================================================*/
const _trimCache = new Map();
function trimImage(url) {
  if (_trimCache.has(url)) return _trimCache.get(url);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth,
        h = img.naturalHeight;
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      let data;
      try {
        data = ctx.getImageData(0, 0, w, h);
      } catch (e) {
        return resolve(url); // tainted — fall back to original
      }
      const px = data.data;
      const THR = 236; // >= this on all channels counts as background white
      let minX = w,
        minY = h,
        maxX = 0,
        maxY = 0,
        found = false;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (px[i] >= THR && px[i + 1] >= THR && px[i + 2] >= THR) {
            px[i + 3] = 0; // make background transparent
          } else {
            found = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      ctx.putImageData(data, 0, 0);
      if (!found) return resolve(cv.toDataURL());
      const pad = 2;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(w - 1, maxX + pad);
      maxY = Math.min(h - 1, maxY + pad);
      const cw = maxX - minX + 1,
        ch = maxY - minY + 1;
      const out = document.createElement("canvas");
      out.width = cw;
      out.height = ch;
      out.getContext("2d").drawImage(cv, minX, minY, cw, ch, 0, 0, cw, ch);
      resolve(out.toDataURL());
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
  _trimCache.set(url, p);
  return p;
}

/* ============================================================================
 * ASSET DISCOVERY
 * ==========================================================================*/
const ASSET_MODULES = import.meta.glob("../assets/labassets/**/*.{jpeg,jpg,png}", {
  eager: true,
  query: "?url",
  import: "default",
});
const CATEGORY_NAMES = {
  pack1_glassware: "Glassware",
  pack2_heating_reaction: "Heating",
  pack3_supports_hardware: "Supports",
  pack4_analytical_instruments: "Instruments",
  pack5_biological_lifescience: "Biology",
  pack6_chemicals_containers: "Chemicals",
  pack7_safety_environment: "Safety",
  pack8_industrial_process: "Industrial",
  pack9_diagram_symbols: "Symbols",
};
const prettify = (file) => {
  const b = file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return b.charAt(0).toUpperCase() + b.slice(1);
};
const typeKeyOf = (file) => file.replace(/\.[^.]+$/, "").toLowerCase();

function buildCategories() {
  const byFolder = new Map();
  for (const [path, url] of Object.entries(ASSET_MODULES)) {
    const after = path.split("/labassets/")[1];
    if (!after) continue;
    const parts = after.split("/");
    const folder = parts.length > 1 ? parts[0] : "misc";
    const file = parts[parts.length - 1];
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push({ uid: `${folder}/${file}`, label: prettify(file), typeKey: typeKeyOf(file), src: url, folder });
  }
  const orderOf = (f) => {
    const m = f.match(/^pack(\d+)/);
    return m ? parseInt(m[1], 10) : 999;
  };
  return Array.from(byFolder.entries())
    .map(([folder, items]) => ({
      id: folder,
      name: CATEGORY_NAMES[folder] || prettify(folder.replace(/^pack\d+_?/, "")),
      order: orderOf(folder),
      items: items.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.order - b.order);
}
function buildItemIndex(categories) {
  const idx = new Map();
  categories.forEach((c) => c.items.forEach((it) => idx.set(it.uid, it)));
  return idx;
}

/* ============================================================================
 * ANCHORS / SOCKETS + COMPATIBILITY
 * ==========================================================================*/
const ANCHORS = {
  flask: [
    { id: "neck", role: "neck", nx: 0.5, ny: 0.05 },
    { id: "bottom", role: "bottom", nx: 0.5, ny: 0.95 },
  ],
  condenser: [
    { id: "top", role: "top", nx: 0.5, ny: 0.04 },
    { id: "bottom", role: "bottom", nx: 0.5, ny: 0.96 },
    { id: "portIn", role: "port", nx: 0.82, ny: 0.34 },
    { id: "portOut", role: "port", nx: 0.82, ny: 0.66 },
  ],
  heater: [{ id: "top", role: "top", nx: 0.5, ny: 0.08 }],
  tubing: [
    { id: "start", role: "start", nx: 0.05, ny: 0.5 },
    { id: "end", role: "end", nx: 0.95, ny: 0.5 },
  ],
  clamp: [
    { id: "mount", role: "mount", nx: 0.5, ny: 0.5 },
    { id: "jaw", role: "neck", nx: 0.12, ny: 0.5 },
  ],
  stand: [
    { id: "m1", role: "mount", nx: 0.5, ny: 0.28 },
    { id: "m2", role: "mount", nx: 0.5, ny: 0.52 },
    { id: "m3", role: "mount", nx: 0.5, ny: 0.76 },
  ],
  funnel: [
    { id: "top", role: "top", nx: 0.5, ny: 0.05 },
    { id: "bottom", role: "bottom", nx: 0.5, ny: 0.95 },
  ],
  openTop: [{ id: "top", role: "top", nx: 0.5, ny: 0.08 }],
  default: [
    { id: "top", role: "top", nx: 0.5, ny: 0.05 },
    { id: "bottom", role: "bottom", nx: 0.5, ny: 0.95 },
  ],
};
function anchorsFor(k) {
  if (/condenser|column|reflux/.test(k)) return ANCHORS.condenser;
  if (/flask|roundbottom|erlenmeyer|volumetric|reactor|vessel/.test(k)) return ANCHORS.flask;
  if (/burner|hotplate|mantle|heatingblock|oilbath|waterbath|icebath|stirplate|magneticstirrer|tripod/.test(k)) return ANCHORS.heater;
  if (/tubing|hose|tube|pipe/.test(k)) return ANCHORS.tubing;
  if (/clamp|bosshead/.test(k)) return ANCHORS.clamp;
  if (/stand|labjack|supportrod|retort/.test(k)) return ANCHORS.stand;
  if (/funnel/.test(k)) return ANCHORS.funnel;
  if (/beaker|bottle|vial|cylinder|container|crucible|dish|watchglass|testtube|cryovial|burette/.test(k)) return ANCHORS.openTop;
  return ANCHORS.default;
}
const COMPAT_PAIRS = [
  // glass joints (flask neck ↔ condenser bottom, condenser top ↔ delivery, funnel ↔ flask)
  ["joint", "joint"],
  ["neck", "joint"],
  ["neck", "bottom"],
  ["neck", "top"],
  ["top", "bottom"],
  ["top", "joint"],
  // heating alignment (flask/beaker base ↔ hotplate/burner/bath top)
  ["base", "heat"],
  ["bottom", "heat"],
  ["base", "top"],
  // water tubing (condenser ports ↔ tubing endpoints, tube chaining)
  ["port", "tube"],
  ["port", "start"],
  ["port", "end"],
  ["tube", "tube"],
  // supports (stand clamp arm ↔ apparatus grip, boss/mount)
  ["arm", "grip"],
  ["mount", "mount"],
  ["mount", "grip"],
];
const canConnect = (a, b) => COMPAT_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));

/* ============================================================================
 * ASSEMBLY MATH
 * ==========================================================================*/
const SNAP_DIST = 36;
const byId = (canvas, id) => canvas.getObjects().find((o) => o.meta && o.meta.id === id);

function anchorsWorld(obj) {
  const anchors = obj.meta && obj.meta.anchors;
  if (!anchors) return [];
  const m = obj.calcTransformMatrix();
  const w = obj.width;
  const h = obj.height;
  return anchors.map((a) => ({ id: a.id, role: a.role, p: util.transformPoint(new Point((a.nx - 0.5) * w, (a.ny - 0.5) * h), m) }));
}
function getCluster(connections, id) {
  const adj = new Map();
  const link = (x, y) => {
    if (!adj.has(x)) adj.set(x, new Set());
    adj.get(x).add(y);
  };
  connections.forEach((c) => {
    link(c.a.id, c.b.id);
    link(c.b.id, c.a.id);
  });
  const seen = new Set([id]);
  const st = [id];
  while (st.length) {
    const x = st.pop();
    (adj.get(x) || []).forEach((n) => !seen.has(n) && (seen.add(n), st.push(n)));
  }
  return seen;
}
function findSnap(canvas, connections, o) {
  if (!o.meta || !o.meta.anchors) return null;
  const cluster = getCluster(connections, o.meta.id);
  const mine = anchorsWorld(o);
  if (!mine.length) return null;
  let best = null;
  canvas.getObjects().forEach((other) => {
    if (!other.meta || !other.meta.id || !other.meta.anchors || cluster.has(other.meta.id)) return;
    const theirs = anchorsWorld(other);
    mine.forEach((a) =>
      theirs.forEach((b) => {
        if (!canConnect(a.role, b.role)) return;
        const d = Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y);
        if (d < SNAP_DIST && (!best || d < best.d))
          best = { d, dx: b.p.x - a.p.x, dy: b.p.y - a.p.y, point: b.p, conn: { a: { id: o.meta.id, anchor: a.id }, b: { id: other.meta.id, anchor: b.id } } };
      })
    );
  });
  return best;
}

/* ============================================================================
 * THEME
 * ==========================================================================*/
const T = {
  appBg: "#eef2f6",
  panel: "#ffffff",
  border: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  teal: "#0d9488",
  tealSoft: "#ccfbf1",
  ink: "#0f172a",
  arrow: "#7c6fe0",
  shadow: "0 1px 2px rgba(15,23,42,0.06)",
};
const QUICK_LABELS = ["Water In", "Water Out", "Catalyst", "Heat", "Reagent A", "Solvent", "Product"];
const DND_MIME = "application/x-apparatus";
const DND_SMART = "application/x-smart";
const SEL = { cornerColor: T.teal, cornerStyle: "circle", borderColor: T.teal, transparentCorners: false, cornerSize: 10, padding: 2 };

let _oid = 0;
const newObjId = () => `o${++_oid}`;

/* ============================================================================
 * COMPONENT
 * ==========================================================================*/
export default function ReactionSetupCanvas() {
  const categories = useMemo(buildCategories, []);
  const itemIndex = useMemo(() => buildItemIndex(categories), [categories]);

  const canvasElRef = useRef(null);
  const wrapRef = useRef(null);
  const fcRef = useRef(null);
  const connectionsRef = useRef([]);
  const pendingRef = useRef(null);
  const indicatorRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [sel, setSel] = useState(null);
  const [query, setQuery] = useState("");
  const [openCats, setOpenCats] = useState(() => ({ [categories[0]?.id]: true }));

  /* -------------------------------------------------- init Fabric canvas */
  useEffect(() => {
    const el = canvasElRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap) return;

    const canvas = new Canvas(el, { backgroundColor: "#ffffff", preserveObjectStacking: true, selection: true });
    canvas.setDimensions({ width: wrap.offsetWidth, height: wrap.offsetHeight });
    fcRef.current = canvas;

    const indicator = new Circle({
      radius: 6,
      fill: "rgba(37,99,235,0.9)",
      stroke: "#fff",
      strokeWidth: 2,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
      visible: false,
      excludeFromExport: true,
    });
    canvas.add(indicator);
    indicatorRef.current = indicator;
    setReady(true);

    const readActive = () => {
      const o = canvas.getActiveObject();
      if (!o) return setSel(null);
      const id = o.meta && o.meta.id;
      const conns = id ? connectionsRef.current.filter((e) => e.a.id === id || e.b.id === id).length : 0;
      setSel({
        type: labelForObject(o),
        x: Math.round(o.left ?? 0),
        y: Math.round(o.top ?? 0),
        w: Math.round(o.getScaledWidth?.() ?? o.width ?? 0),
        h: Math.round(o.getScaledHeight?.() ?? o.height ?? 0),
        angle: Math.round(o.angle ?? 0),
        id,
        conns,
        connectable: !!(o.meta && o.meta.anchors),
      });
    };
    canvas.on("selection:created", readActive);
    canvas.on("selection:updated", readActive);
    canvas.on("selection:cleared", () => setSel(null));
    canvas.on("object:scaling", readActive);
    canvas.on("object:rotating", readActive);
    canvas.on("object:modified", readActive);

    canvas.on("mouse:down", (opt) => {
      if (opt.e.altKey) return;
      const t = opt.target;
      if (t && t.meta && t.meta.id) t._dragPrev = { left: t.left, top: t.top };
    });

    canvas.on("object:moving", (opt) => {
      const o = opt.target;
      if (!o || !o.meta || !o.meta.id) return;
      const prev = o._dragPrev || { left: o.left, top: o.top };
      let dx = o.left - prev.left;
      let dy = o.top - prev.top;
      o.setCoords();
      const snap = findSnap(canvas, connectionsRef.current, o);
      if (snap) {
        o.left += snap.dx;
        o.top += snap.dy;
        dx += snap.dx;
        dy += snap.dy;
        pendingRef.current = snap.conn;
        indicator.set({ left: snap.point.x, top: snap.point.y, visible: true });
        canvas.bringObjectToFront(indicator);
      } else {
        pendingRef.current = null;
        indicator.set({ visible: false });
      }
      getCluster(connectionsRef.current, o.meta.id).forEach((id) => {
        if (id === o.meta.id) return;
        const obj = byId(canvas, id);
        if (obj) {
          obj.left += dx;
          obj.top += dy;
          obj.setCoords();
        }
      });
      o._dragPrev = { left: o.left, top: o.top };
      o.setCoords();
      canvas.requestRenderAll();
      readActive();
    });

    let panning = false,
      lastX = 0,
      lastY = 0;
    canvas.on("mouse:down", (opt) => {
      if (opt.e.altKey) {
        panning = true;
        canvas.selection = false;
        lastX = opt.e.clientX;
        lastY = opt.e.clientY;
        canvas.setCursor("grabbing");
      }
    });
    canvas.on("mouse:move", (opt) => {
      if (!panning) return;
      const vpt = canvas.viewportTransform;
      vpt[4] += opt.e.clientX - lastX;
      vpt[5] += opt.e.clientY - lastY;
      lastX = opt.e.clientX;
      lastY = opt.e.clientY;
      canvas.requestRenderAll();
    });
    canvas.on("mouse:up", () => {
      panning = false;
      canvas.selection = true;
      if (pendingRef.current) {
        const c = pendingRef.current;
        const dup = connectionsRef.current.some(
          (e) =>
            (e.a.id === c.a.id && e.a.anchor === c.a.anchor && e.b.id === c.b.id && e.b.anchor === c.b.anchor) ||
            (e.a.id === c.b.id && e.a.anchor === c.b.anchor && e.b.id === c.a.id && e.b.anchor === c.a.anchor)
        );
        if (!dup) connectionsRef.current.push(c);
        pendingRef.current = null;
      }
      indicator.set({ visible: false });
      canvas.requestRenderAll();
      readActive();
    });

    canvas.on("mouse:wheel", (opt) => {
      let z = canvas.getZoom() * 0.999 ** opt.e.deltaY;
      z = Math.min(4, Math.max(0.2, z));
      canvas.zoomToPoint(new Point(opt.e.offsetX, opt.e.offsetY), z);
      setZoom(z);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    const onKey = (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && !isEditingText(canvas)) {
        removeActive(canvas, connectionsRef);
        setSel(null);
      }
    };
    window.addEventListener("keydown", onKey);

    const ro = new ResizeObserver(() => {
      canvas.setDimensions({ width: wrap.offsetWidth, height: wrap.offsetHeight });
      canvas.requestRenderAll();
    });
    ro.observe(wrap);

    return () => {
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
      canvas.dispose();
      fcRef.current = null;
    };
  }, []);

  /* -------------------------------------------------- low-level builders */
  const sceneCenter = () => {
    const c = fcRef.current;
    const inv = util.invertTransform(c.viewportTransform);
    return util.transformPoint(new Point(c.getWidth() / 2, c.getHeight() / 2), inv);
  };

  // Place an apparatus image (trimmed + transparent bg); returns the object.
  const placeImage = (item, { w, h, x, y, angle } = {}) => {
    const c = fcRef.current;
    return trimImage(item.src)
      .then((src) => FabricImage.fromURL(src, { crossOrigin: "anonymous" }))
      .then((img) => {
        if (w) img.scaleToWidth(w);
        else if (h) img.scaleToHeight(h);
        img.set({ left: x ?? 0, top: y ?? 0, angle: angle || 0, originX: "center", originY: "center", ...SEL });
        img.meta = { kind: "apparatus", label: item.label, typeKey: item.typeKey, id: newObjId(), anchors: anchorsFor(item.typeKey) };
        c.add(img);
        return img;
      });
  };

  // Place a single SMART vector apparatus piece with precise anchors.
  const placeSmart = (piece, { x, y } = {}) => {
    const c = fcRef.current;
    if (!c) return null;
    const built = piece.make();
    const g = new Group(built.parts, { left: x, top: y, originX: "center", originY: "center", ...SEL, subTargetCheck: false });
    g.meta = { kind: "apparatus", label: piece.label, typeKey: built.typeKey, id: newObjId(), anchors: built.anchors };
    c.add(g);
    return g;
  };
  const addSmartCenter = (piece) => {
    const c = fcRef.current;
    if (!c) return;
    const p = sceneCenter();
    const g = placeSmart(piece, { x: p.x, y: p.y });
    if (g) {
      c.setActiveObject(g);
      c.requestRenderAll();
    }
  };

  const addTextAt = (text, x, y, opts = {}) => {
    const c = fcRef.current;
    const tb = new Textbox(text, {
      left: x,
      top: y,
      originX: "center",
      originY: "center",
      fontSize: opts.fontSize || 20,
      fontFamily: "Inter, Arial, sans-serif",
      fill: opts.fill || T.ink,
      fontWeight: "600",
      editable: true,
      ...SEL,
    });
    tb.meta = { kind: "text", label: "Text Label", id: newObjId() };
    c.add(tb);
    return tb;
  };

  const addArrowAt = (x, y, len = 80, angleDeg = 0, color = T.ink) => {
    const c = fcRef.current;
    const line = new Line([0, 0, len, 0], { stroke: color, strokeWidth: 4, originX: "center", originY: "center" });
    const head = new Triangle({ width: 16, height: 18, fill: color, left: len / 2, top: 0, angle: 90, originX: "center", originY: "center" });
    const arrow = new Group([line, head], { left: x, top: y, angle: angleDeg, originX: "center", originY: "center", ...SEL });
    arrow.meta = { kind: "arrow", label: "Arrow", id: newObjId() };
    c.add(arrow);
    return arrow;
  };

  const addConn = (A, anchorA, B, anchorB) => {
    if (!A || !B) return;
    connectionsRef.current.push({ a: { id: A.meta.id, anchor: anchorA }, b: { id: B.meta.id, anchor: anchorB } });
  };

  const clearAll = () => {
    const c = fcRef.current;
    c.getObjects().filter((o) => o !== indicatorRef.current).forEach((o) => c.remove(o));
    connectionsRef.current = [];
    c.discardActiveObject();
    c.requestRenderAll();
    setSel(null);
  };

  const getAsset = (re) => {
    for (const cat of categories) for (const it of cat.items) if (re.test(it.typeKey)) return it;
    return null;
  };

  const fitToContent = () => {
    const c = fcRef.current;
    const objs = c.getObjects().filter((o) => o !== indicatorRef.current && o.meta);
    if (!objs.length) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    objs.forEach((o) => {
      const r = o.getBoundingRect();
      minX = Math.min(minX, r.left);
      minY = Math.min(minY, r.top);
      maxX = Math.max(maxX, r.left + r.width);
      maxY = Math.max(maxY, r.top + r.height);
    });
    const pad = 60;
    const cw = c.getWidth(),
      ch = c.getHeight();
    const z = Math.min(4, Math.max(0.2, Math.min(cw / (maxX - minX + pad * 2), ch / (maxY - minY + pad * 2))));
    c.setZoom(z);
    c.viewportTransform[4] = -minX * z + (cw - (maxX - minX) * z) / 2;
    c.viewportTransform[5] = -minY * z + (ch - (maxY - minY) * z) / 2;
    c.setViewportTransform(c.viewportTransform);
    setZoom(z);
    c.requestRenderAll();
  };

  /* -------------------------------------------------- toolbar actions */
  const addText = () => {
    const c = fcRef.current;
    if (!c) return;
    const p = sceneCenter();
    const tb = addTextAt("Double-click to edit", p.x, p.y);
    c.setActiveObject(tb);
    c.requestRenderAll();
  };
  const addArrow = () => {
    const c = fcRef.current;
    if (!c) return;
    const p = sceneCenter();
    const a = addArrowAt(p.x, p.y, 120, 0, T.ink);
    c.setActiveObject(a);
    c.requestRenderAll();
  };
  const exportPNG = () => {
    const c = fcRef.current;
    if (!c) return;
    const prevVpt = c.viewportTransform.slice();
    const prevZoom = c.getZoom();
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    const url = c.toDataURL({ format: "png", multiplier: 2 });
    c.setViewportTransform(prevVpt);
    c.setZoom(prevZoom);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reaction-setup.png";
    a.click();
  };

  /* -------------------------------------------------- inspector actions */
  const withSel = (fn) => () => {
    const c = fcRef.current;
    const ao = c && c.getActiveObject();
    if (ao) fn(c, ao);
  };
  const deleteSelected = () => {
    const c = fcRef.current;
    if (!c) return;
    removeActive(c, connectionsRef);
    setSel(null);
  };
  const duplicateSelected = withSel((c, ao) => {
    ao.clone(["meta"]).then((cl) => {
      c.discardActiveObject();
      cl.set({ left: (ao.left ?? 0) + 28, top: (ao.top ?? 0) + 28 });
      cl.meta = { ...ao.meta, id: newObjId() };
      if (cl.type === "activeselection") {
        cl.canvas = c;
        cl.forEachObject((o) => c.add(o));
      } else c.add(cl);
      c.setActiveObject(cl);
      c.requestRenderAll();
    });
  });
  const detachSelected = withSel((c, ao) => {
    const id = ao.meta && ao.meta.id;
    if (!id) return;
    connectionsRef.current = connectionsRef.current.filter((e) => e.a.id !== id && e.b.id !== id);
    setSel((s) => (s ? { ...s, conns: 0 } : s));
  });
  const bringForward = withSel((c, ao) => {
    c.bringObjectForward(ao);
    c.requestRenderAll();
  });
  const sendBackward = withSel((c, ao) => {
    c.sendObjectBackwards(ao);
    c.requestRenderAll();
  });

  const applyZoom = (z) => {
    const c = fcRef.current;
    if (!c) return;
    const nz = Math.min(4, Math.max(0.2, z));
    c.zoomToPoint(new Point(c.getWidth() / 2, c.getHeight() / 2), nz);
    setZoom(nz);
  };
  const resetView = () => {
    const c = fcRef.current;
    if (!c) return;
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    c.setZoom(1);
    setZoom(1);
    c.requestRenderAll();
  };

  /* -------------------------------------------------- palette drag/drop */
  const onPaletteDragStart = (e, uid) => {
    e.dataTransfer.setData(DND_MIME, uid);
    e.dataTransfer.effectAllowed = "copy";
  };
  const onSmartDragStart = (e, id) => {
    e.dataTransfer.setData(DND_SMART, id);
    e.dataTransfer.effectAllowed = "copy";
  };
  const onCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onCanvasDrop = (e) => {
    e.preventDefault();
    const c = fcRef.current;
    if (!c || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const inv = util.invertTransform(c.viewportTransform);
    const scene = util.transformPoint(new Point(e.clientX - rect.left, e.clientY - rect.top), inv);

    const smartId = e.dataTransfer.getData(DND_SMART);
    if (smartId) {
      const piece = SMART_PIECES.find((p) => p.id === smartId);
      if (piece) {
        const g = placeSmart(piece, { x: scene.x, y: scene.y });
        if (g) {
          c.setActiveObject(g);
          c.requestRenderAll();
        }
      }
      return;
    }

    const uid = e.dataTransfer.getData(DND_MIME);
    const item = itemIndex.get(uid);
    if (!item) return;
    placeImage(item, { w: 120, x: scene.x, y: scene.y }).then((img) => {
      c.setActiveObject(img);
      c.requestRenderAll();
    });
  };
  const addApparatusCenter = (item) => {
    const c = fcRef.current;
    if (!c) return;
    const p = sceneCenter();
    placeImage(item, { w: 120, x: p.x, y: p.y }).then((img) => {
      c.setActiveObject(img);
      c.requestRenderAll();
    });
  };

  /* ==========================================================================
   * TEMPLATES — one-click clean setups. Reflux is the showcase.
   * Each builder places real apparatus images, wires connections so the core
   * glassware chain moves as one assembly, and adds labels/arrows.
   * [INTEGRATION] Templates could be authored/saved server-side and loaded here.
   * ========================================================================*/
  const runTemplate = (fn) => async () => {
    if (!fcRef.current || busy) return;
    setBusy(true);
    try {
      clearAll();
      await fn();
      fitToContent();
    } catch (err) {
      console.error("[Templates] build failed:", err);
    } finally {
      setBusy(false);
    }
  };

  // Templates are drawn with clean Fabric VECTOR primitives (not photos) so the
  // result looks professional and reads like a real reaction diagram. The whole
  // apparatus is grouped into one object that moves/scales/rotates together;
  // labels + arrows are added as separate editable objects beside it.
  const addRig = (parts, label) => {
    const c = fcRef.current;
    const rig = new Group(parts, { ...SEL, subTargetCheck: false });
    rig.meta = { kind: "apparatus", label, id: newObjId() };
    c.add(rig);
    return rig;
  };

  function buildReflux() {
    const colX = 540;
    const standX = 250;
    const benchTop = 600;
    const parts = [];

    vBench(parts, 168, 720, benchTop);
    vStand(parts, standX, 118, benchTop, [
      { x: colX, y: 180 },
      { x: colX, y: 300 },
      { x: colX, y: 392 },
    ]);
    vHotplate(parts, colX, 556);
    vBath(parts, colX, 500, 152, 86);
    vRoundFlask(parts, colX, 486, 52, 392);
    const c = vCondenser(parts, colX, 170, 392);
    vBentTube(parts, colX, 168);
    vClamps(parts, [
      { x: colX, y: 180 },
      { x: colX, y: 300 },
      { x: colX, y: 392 },
    ]);

    addRig(parts, "Reflux setup");

    // water in/out arrows + labels beside the condenser side ports
    fcRef.current.add(blockArrow(colX + 150, c.outY, 78, 0, T.arrow));
    addTextAt("Water out", colX + 258, c.outY, { fill: T.ink, fontSize: 22 });
    fcRef.current.add(blockArrow(colX + 150, c.inY, 78, 180, T.arrow));
    addTextAt("Water in", colX + 258, c.inY, { fill: T.ink, fontSize: 22 });
  }

  function buildDistillation() {
    const flaskX = 360;
    const benchTop = 600;
    const parts = [];

    vBench(parts, 168, 760, benchTop);
    vStand(parts, 250, 150, benchTop, [
      { x: flaskX, y: 360 },
      { x: 560, y: 250 },
    ]);
    vHotplate(parts, flaskX, 556);
    vBath(parts, flaskX, 500, 150, 86);
    vRoundFlask(parts, flaskX, 486, 50, 360);
    // still head: short vertical neck + angled condenser going down-right
    parts.push(rRect(flaskX, 340, 18, 60, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: GLASS.line }));
    parts.push(new Rect({ left: 470, top: 320, width: 150, height: 30, angle: 32, originX: "center", originY: "center", fill: WATER, stroke: GLASS.stroke, strokeWidth: GLASS.line, rx: 4 }));
    parts.push(rEllipse(flaskX, 312, 11, 14, { fill: "rgba(186,230,253,0.5)", stroke: GLASS.stroke, strokeWidth: 1 })); // thermometer adapter
    parts.push(rLine([flaskX, 300, flaskX, 250], { stroke: "#94a3b8", strokeWidth: 3 })); // thermometer
    parts.push(rCircle(flaskX, 250, 4, { fill: "#ef4444" }));
    vClamps(parts, [{ x: flaskX, y: 360 }, { x: 560, y: 250 }]);
    // receiving flask (erlenmeyer) at the cool end
    vErlenmeyer(parts, 600, 470, 90, 90);

    addRig(parts, "Distillation setup");
    addTextAt("Thermometer", flaskX, 222, { fill: T.muted, fontSize: 15 });
    addTextAt("Distillate", 600, 540, { fill: T.muted, fontSize: 15 });
  }

  function buildFiltration() {
    const cx = 470;
    const benchTop = 600;
    const parts = [];

    vBench(parts, 200, 740, benchTop);
    vStand(parts, 280, 150, benchTop, [{ x: cx, y: 300 }]);
    vErlenmeyer(parts, cx, 470, 120, 130);
    vFunnel(parts, cx, 300, 120);
    // ring clamp holding the funnel
    parts.push(rEllipse(cx, 320, 30, 9, { fill: "none", stroke: METAL.dark, strokeWidth: 4 }));
    parts.push(rRect((280 + cx) / 2, 320, cx - 280, 8, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1, rx: 3 }));

    addRig(parts, "Filtration setup");
    addTextAt("Filter paper", cx + 95, 318, { fill: T.muted, fontSize: 14 });
    addTextAt("Filtrate", cx + 95, 470, { fill: T.muted, fontSize: 14 });
  }

  function buildTitration() {
    const cx = 470;
    const benchTop = 600;
    const parts = [];

    vBench(parts, 200, 740, benchTop);
    vStand(parts, 280, 150, benchTop, [{ x: cx, y: 250 }]);
    vBurette(parts, cx, 200, 220);
    vErlenmeyer(parts, cx, 520, 110, 110);
    vClamps(parts, [{ x: cx, y: 250 }]);

    addRig(parts, "Titration setup");
    addTextAt("Burette (titrant)", cx + 70, 220, { fill: T.muted, fontSize: 14 });
    addTextAt("Analyte", cx + 70, 520, { fill: T.muted, fontSize: 14 });
  }

  function buildHeating() {
    const cx = 480;
    const benchTop = 600;
    const parts = [];

    vBench(parts, 220, 740, benchTop);
    vHotplate(parts, cx, 556);
    vBeaker(parts, cx, 486, 130, 120);

    addRig(parts, "Heating setup");
    fcRef.current.add(blockArrow(cx, 632, 64, 270, T.arrow));
    addTextAt("Heat", cx + 70, 632, { fill: T.ink, fontSize: 20 });
  }

  const TEMPLATES = [
    { id: "reflux", name: "Reflux Setup", build: buildReflux },
    { id: "distillation", name: "Distillation Setup", build: buildDistillation },
    { id: "filtration", name: "Filtration Setup", build: buildFiltration },
    { id: "titration", name: "Titration Setup", build: buildTitration },
    { id: "heating", name: "Heating Setup", build: buildHeating },
  ];

  /* -------------------------------------------------- palette filtering */
  const q = query.trim().toLowerCase();
  const visibleCategories = categories
    .map((c) => ({ ...c, items: q ? c.items.filter((it) => it.label.toLowerCase().includes(q)) : c.items }))
    .filter((c) => c.items.length > 0);
  const isOpen = (id) => (q ? true : !!openCats[id]);
  const toggleCat = (id) => setOpenCats((s) => ({ ...s, [id]: !s[id] }));
  const totalAssets = categories.reduce((n, c) => n + c.items.length, 0);

  /* ============================================================ render */
  return (
    <section style={styles.app}>
      {/* --------------------------------------------- top toolbar */}
      <div style={styles.toolbar}>
        <span style={styles.brand}>⚗ Reaction Setup Designer</span>
        <div style={styles.tbGroup}>
          <Btn onClick={addText} disabled={!ready}>Add Text</Btn>
          <Btn onClick={addArrow} disabled={!ready}>Add Arrow</Btn>
          <Btn onClick={clearAll} disabled={!ready} variant="ghost">Clear</Btn>
          <Btn onClick={exportPNG} disabled={!ready} variant="primary">Export PNG</Btn>
        </div>
        {busy && <span style={styles.busy}>Building…</span>}
      </div>

      {/* --------------------------------------------- body */}
      <div style={styles.body}>
        {/* left sidebar */}
        <aside style={styles.palette}>
          <div style={styles.sideLabel}>Templates</div>
          <div style={styles.templateList}>
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                style={{ ...styles.templateBtn, ...(tpl.id === "reflux" ? styles.templateBtnPrimary : {}) }}
                onClick={runTemplate(tpl.build)}
                disabled={!ready || busy}
              >
                {tpl.name}
              </button>
            ))}
          </div>

          <div style={{ ...styles.sideLabel, marginTop: 14 }}>Smart Apparatus</div>
          <div style={styles.smartHint}>Snap together like LEGO</div>
          <div style={styles.smartGrid}>
            {SMART_PIECES.map((p) => (
              <div
                key={p.id}
                draggable
                onDragStart={(e) => onSmartDragStart(e, p.id)}
                onClick={() => addSmartCenter(p)}
                title={`Add ${p.label}`}
                style={styles.smartCard}
              >
                <span style={styles.smartIcon}>{p.icon}</span>
                <span style={styles.smartLabel}>{p.label}</span>
              </div>
            ))}
          </div>

          <div style={{ ...styles.sideLabel, marginTop: 14 }}>Apparatus · {totalAssets}</div>
          <input style={styles.search} placeholder="Search apparatus…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {visibleCategories.length === 0 && <div style={styles.noResults}>No apparatus matches “{query}”.</div>}
          {visibleCategories.map((cat) => {
            const open = isOpen(cat.id);
            return (
              <div key={cat.id} style={styles.catBlock}>
                <button style={styles.catHeader} onClick={() => toggleCat(cat.id)}>
                  <span style={styles.caret}>{open ? "▾" : "▸"}</span>
                  <span>{cat.name}</span>
                  <span style={styles.catCount}>{cat.items.length}</span>
                </button>
                {open && (
                  <div style={styles.paletteGrid}>
                    {cat.items.map((item) => (
                      <div
                        key={item.uid}
                        draggable
                        onDragStart={(e) => onPaletteDragStart(e, item.uid)}
                        onClick={() => addApparatusCenter(item)}
                        title={`Add ${item.label}`}
                        style={styles.paletteCard}
                      >
                        <img src={item.src} alt={item.label} draggable={false} style={styles.paletteThumb} />
                        <span style={styles.paletteLabel}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ ...styles.sideLabel, marginTop: 14 }}>Quick Labels</div>
          <div style={styles.chips}>
            {QUICK_LABELS.map((t) => (
              <button
                key={t}
                style={styles.chip}
                disabled={!ready}
                onClick={() => {
                  const c = fcRef.current;
                  const p = sceneCenter();
                  const tb = addTextAt(t, p.x, p.y);
                  c.setActiveObject(tb);
                  c.requestRenderAll();
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </aside>

        {/* center canvas */}
        <div ref={wrapRef} style={styles.canvasWrap} onDragOver={onCanvasDragOver} onDrop={onCanvasDrop}>
          <canvas ref={canvasElRef} />
          {/* floating zoom controls */}
          <div style={styles.zoomBar}>
            <IconBtn onClick={() => applyZoom(zoom / 1.15)}>−</IconBtn>
            <span style={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
            <IconBtn onClick={() => applyZoom(zoom * 1.15)}>+</IconBtn>
            <IconBtn onClick={fitToContent} wide>Fit</IconBtn>
            <IconBtn onClick={resetView} wide>Reset</IconBtn>
          </div>
          <div style={styles.canvasHint}>Drag Smart Apparatus together to snap & assemble · Alt-drag to pan · scroll to zoom</div>
        </div>

        {/* right inspector */}
        <aside style={styles.inspector}>
          <div style={styles.sideLabel}>Inspector</div>
          {!sel && <div style={styles.inspectorEmpty}>Select an object to view and edit its properties.</div>}
          {sel && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Type" value={sel.type} />
              <div style={styles.row}>
                <Field label="X" value={sel.x} half />
                <Field label="Y" value={sel.y} half />
              </div>
              <div style={styles.row}>
                <Field label="Width" value={sel.w} half />
                <Field label="Height" value={sel.h} half />
              </div>
              <Field label="Rotation" value={`${sel.angle}°`} />
              {sel.connectable && <Field label="Connections" value={sel.conns} />}
              {sel.connectable && sel.conns > 0 && <SmallBtn onClick={detachSelected}>Detach connections</SmallBtn>}
              <div style={styles.divider} />
              <div style={styles.fieldLabel}>Layer</div>
              <div style={styles.row}>
                <SmallBtn onClick={bringForward}>Bring Forward</SmallBtn>
                <SmallBtn onClick={sendBackward}>Send Backward</SmallBtn>
              </div>
              <div style={styles.divider} />
              <div style={styles.row}>
                <SmallBtn onClick={duplicateSelected}>Duplicate</SmallBtn>
                <SmallBtn onClick={deleteSelected} variant="danger">Delete</SmallBtn>
              </div>
            </div>
          )}
          {/*
            [INTEGRATION] ELN hooks (omitted for this prototype):
              - Save setup to ELN:        canvas.toJSON() + connections → PUT /api/setups/:id
              - Load saved reaction setup: canvas.loadFromJSON(savedJSON) + rebuild connections
              - Attach reagents inventory: bind object.meta to Data Hub records
              - Export into notebook:      attach exported PNG/JSON to an entry
          */}
        </aside>
      </div>
    </section>
  );
}

/* ============================================================================
 * VECTOR APPARATUS — clean Fabric primitives used to draw template setups.
 * All coordinates are absolute scene coordinates; pieces are pushed into a
 * `parts` array and grouped into one assembly by the caller.
 * ==========================================================================*/
const GLASS = { stroke: "#64748b", line: 1.6, fill: "rgba(186,230,253,0.16)" };
const METAL = { light: "#c2c8cf", mid: "#9aa1a9", dark: "#3f4753", edge: "#6b7280" };
const WOOD = { top: "#cf954f", body: "#b8763e", edge: "#8a5a2b" };
const LIQ = "rgba(167,180,252,0.6)";
const WATER = "rgba(96,165,250,0.28)";
const CLAMP = "#3b82f6";

const rRect = (cx, cy, w, h, o = {}) => new Rect({ left: cx, top: cy, width: w, height: h, originX: "center", originY: "center", ...o });
const rLine = (pts, o = {}) => new Line(pts, { ...o });
const rCircle = (cx, cy, r, o = {}) => new Circle({ left: cx, top: cy, radius: r, originX: "center", originY: "center", ...o });
const rEllipse = (cx, cy, rx, ry, o = {}) => new Ellipse({ left: cx, top: cy, rx, ry, originX: "center", originY: "center", ...o });
const rPath = (d, o = {}) => new Path(d, { ...o });

function vBench(parts, x0, x1, topY) {
  const w = x1 - x0,
    cx = (x0 + x1) / 2;
  parts.push(rRect(cx, topY + 14, w, 26, { fill: WOOD.body, stroke: WOOD.edge, strokeWidth: 1.5, rx: 3 }));
  parts.push(rRect(cx, topY + 3, w, 7, { fill: WOOD.top, rx: 2 }));
  parts.push(rRect(x0 + 44, topY + 58, 22, 70, { fill: WOOD.body, stroke: WOOD.edge, strokeWidth: 1.5 }));
  parts.push(rRect(x1 - 44, topY + 58, 22, 70, { fill: WOOD.body, stroke: WOOD.edge, strokeWidth: 1.5 }));
}
function vStand(parts, x, topY, baseY, arms) {
  parts.push(rRect(x + 18, baseY - 8, 150, 16, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1.2, rx: 3 }));
  parts.push(rRect(x, (topY + baseY) / 2, 12, baseY - topY, { fill: METAL.light, stroke: METAL.edge, strokeWidth: 1.2, rx: 4 }));
  (arms || []).forEach((a) => {
    parts.push(rRect((x + a.x) / 2, a.y, Math.abs(a.x - x), 9, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1, rx: 3 }));
    parts.push(rRect(x, a.y, 22, 26, { fill: METAL.dark, rx: 3 }));
  });
}
function vClamps(parts, positions) {
  (positions || []).forEach((p) => {
    parts.push(rEllipse(p.x, p.y, 21, 9, { fill: CLAMP, stroke: "#1d4ed8", strokeWidth: 1 }));
    parts.push(rEllipse(p.x, p.y, 9, 4, { fill: "#bfdbfe" }));
  });
}
function vRoundFlask(parts, cx, cy, r, neckTopY) {
  parts.push(rRect(cx, (neckTopY + (cy - r + 8)) / 2, 20, cy - r + 8 - neckTopY, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: GLASS.line }));
  parts.push(rCircle(cx, cy, r, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: GLASS.line }));
  const d = 8,
    hw = Math.sqrt(Math.max(0, r * r - d * d));
  parts.push(rPath(`M ${cx - hw} ${cy - d} A ${r} ${r} 0 0 1 ${cx + hw} ${cy - d} Z`, { fill: LIQ, stroke: "transparent" }));
  parts.push(rLine([cx - hw, cy - d, cx + hw, cy - d], { stroke: "#818cf8", strokeWidth: 1.4 }));
  parts.push(rEllipse(cx, cy + r * 0.55, 13, 4.5, { fill: "#cbd5e1", stroke: "#94a3b8", strokeWidth: 0.8 }));
}
function vCondenser(parts, cx, topY, botY) {
  const w = 36;
  parts.push(rRect(cx, (topY + botY) / 2, w, botY - topY, { fill: WATER, stroke: GLASS.stroke, strokeWidth: GLASS.line, rx: 3 }));
  parts.push(rRect(cx, (topY + botY) / 2, 12, botY - topY + 18, { fill: GLASS.fill, stroke: "#94a3b8", strokeWidth: 1 }));
  parts.push(rRect(cx, topY + 6, 22, 16, { fill: "rgba(186,230,253,0.5)", stroke: GLASS.stroke, strokeWidth: 1 }));
  parts.push(rRect(cx, botY - 6, 20, 14, { fill: "rgba(186,230,253,0.5)", stroke: GLASS.stroke, strokeWidth: 1 }));
  const outY = topY + (botY - topY) * 0.3,
    inY = topY + (botY - topY) * 0.66;
  [outY, inY].forEach((py) => {
    parts.push(rLine([cx + w / 2 - 2, py, cx + w / 2 + 28, py - 7], { stroke: GLASS.stroke, strokeWidth: 6, strokeLineCap: "round" }));
    parts.push(rLine([cx + w / 2 - 2, py, cx + w / 2 + 28, py - 7], { stroke: "#e0f2fe", strokeWidth: 2.4, strokeLineCap: "round" }));
  });
  return { outY, inY, w };
}
function vBentTube(parts, cx, topY) {
  const d = `M ${cx} ${topY} L ${cx} ${topY - 26} Q ${cx} ${topY - 48} ${cx + 26} ${topY - 52} L ${cx + 96} ${topY - 56}`;
  parts.push(rPath(d, { fill: "", stroke: GLASS.stroke, strokeWidth: 11, strokeLineCap: "round" }));
  parts.push(rPath(d, { fill: "", stroke: "#f1f5f9", strokeWidth: 4.5, strokeLineCap: "round" }));
  parts.push(new Ellipse({ left: cx + 100, top: topY - 56, rx: 8, ry: 13, angle: 78, originX: "center", originY: "center", fill: "rgba(186,230,253,0.5)", stroke: GLASS.stroke, strokeWidth: 1 }));
}
function vBath(parts, cx, cy, w, h) {
  parts.push(rRect(cx, cy, w, h, { fill: WATER, stroke: "#93c5fd", strokeWidth: 1.4, rx: 4 }));
  parts.push(rLine([cx - w / 2 + 6, cy - h / 2 + 12, cx + w / 2 - 6, cy - h / 2 + 12], { stroke: "#60a5fa", strokeWidth: 1.4 }));
}
function vHotplate(parts, cx, cy) {
  parts.push(rRect(cx, cy, 180, 38, { fill: "#e5e7eb", stroke: METAL.edge, strokeWidth: 1.2, rx: 8 }));
  parts.push(rEllipse(cx - 14, cy - 20, 66, 9, { fill: "#d1d5db", stroke: METAL.edge, strokeWidth: 1 }));
  parts.push(rRect(cx, cy + 24, 196, 14, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1, rx: 3 }));
  parts.push(rCircle(cx - 66, cy, 3.5, { fill: "#ef4444" }));
  parts.push(rCircle(cx + 70, cy, 10, { fill: "#f3f4f6", stroke: METAL.edge, strokeWidth: 1.2 }));
}
function vBeaker(parts, cx, cy, w, h) {
  parts.push(rRect(cx, cy, w, h, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: GLASS.line, rx: 3 }));
  parts.push(rLine([cx - w / 2, cy - h / 2, cx - w / 2 - 9, cy - h / 2 + 7], { stroke: GLASS.stroke, strokeWidth: GLASS.line }));
  parts.push(rRect(cx, cy + h * 0.16, w - 6, h * 0.62, { fill: LIQ }));
  parts.push(rLine([cx - w / 2 + 3, cy - h * 0.15, cx + w / 2 - 3, cy - h * 0.15], { stroke: "#818cf8", strokeWidth: 1.2 }));
}
function vErlenmeyer(parts, cx, cy, w, h) {
  const t = h / 2;
  const pts = [
    { x: cx - 7, y: cy - t },
    { x: cx + 7, y: cy - t },
    { x: cx + 7, y: cy - t + 16 },
    { x: cx + w / 2, y: cy + t },
    { x: cx - w / 2, y: cy + t },
    { x: cx - 7, y: cy - t + 16 },
  ];
  parts.push(new Polygon(pts, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: GLASS.line }));
  const lp = [
    { x: cx - w * 0.32, y: cy + t * 0.25 },
    { x: cx + w * 0.32, y: cy + t * 0.25 },
    { x: cx + w / 2 - 3, y: cy + t - 2 },
    { x: cx - w / 2 + 3, y: cy + t - 2 },
  ];
  parts.push(new Polygon(lp, { fill: LIQ, stroke: "transparent" }));
}
function vFunnel(parts, cx, topY, w) {
  const pts = [
    { x: cx - w / 2, y: topY },
    { x: cx + w / 2, y: topY },
    { x: cx + 5, y: topY + w * 0.62 },
    { x: cx - 5, y: topY + w * 0.62 },
  ];
  parts.push(new Polygon(pts, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: GLASS.line }));
  parts.push(rRect(cx, topY + w * 0.62 + 20, 9, 40, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: GLASS.line }));
}
function vBurette(parts, cx, topY, h) {
  parts.push(rRect(cx, topY + h / 2, 13, h, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: GLASS.line, rx: 2 }));
  parts.push(rRect(cx, topY + h * 0.34, 9, h * 0.6, { fill: LIQ }));
  parts.push(rRect(cx, topY + h - 4, 20, 11, { fill: "#cbd5e1", stroke: GLASS.stroke, strokeWidth: 1, rx: 2 }));
  parts.push(rRect(cx, topY + h + 12, 4, 20, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: 1 }));
  for (let i = 1; i < 6; i++) parts.push(rLine([cx + 7, topY + (h * i) / 6, cx + 13, topY + (h * i) / 6], { stroke: GLASS.stroke, strokeWidth: 0.8 }));
}
function blockArrow(cx, cy, len, dirDeg, color) {
  const sh = 9,
    hh = 17,
    hl = 22;
  const pts = [
    { x: -len / 2, y: -sh },
    { x: len / 2 - hl, y: -sh },
    { x: len / 2 - hl, y: -hh },
    { x: len / 2, y: 0 },
    { x: len / 2 - hl, y: hh },
    { x: len / 2 - hl, y: sh },
    { x: -len / 2, y: sh },
  ];
  const poly = new Polygon(pts, { left: cx, top: cy, angle: dirDeg, fill: color, originX: "center", originY: "center", ...SEL });
  poly.meta = { kind: "arrow", label: "Arrow", id: newObjId() };
  return poly;
}

function vTube(parts, x1, y1, x2, y2) {
  const d = `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1 - 26}, ${(x1 + x2) / 2} ${y2 + 26}, ${x2} ${y2}`;
  parts.push(rPath(d, { fill: "", stroke: GLASS.stroke, strokeWidth: 11, strokeLineCap: "round" }));
  parts.push(rPath(d, { fill: "", stroke: "#e2e8f0", strokeWidth: 4.5, strokeLineCap: "round" }));
}

/* ============================================================================
 * SMART APPARATUS — single draggable vector pieces with precise, shape-based
 * anchors. Each make() returns parts drawn inside a [0..W]×[0..H] box (pinned
 * by a transparent bbox rect so anchor fractions stay exact) plus anchor specs.
 * These snap together like LEGO via the assembly engine, producing setups that
 * resemble the preset templates.
 * ==========================================================================*/
const bbox = (W, H) => new Rect({ left: W / 2, top: H / 2, width: W, height: H, originX: "center", originY: "center", fill: "rgba(0,0,0,0)", stroke: "transparent", strokeWidth: 0, selectable: false, evented: false });

const SMART_PIECES = [
  {
    id: "stand",
    label: "Retort Stand",
    icon: "⊥",
    make() {
      const W = 210,
        H = 400;
      const parts = [bbox(W, H)];
      const arms = [{ x: 188, y: 80 }, { x: 188, y: 190 }, { x: 188, y: 300 }];
      vStand(parts, 30, 12, H - 10, arms);
      vClamps(parts, arms);
      return { parts, typeKey: "retortstand", anchors: arms.map((a, i) => ({ id: `arm${i + 1}`, role: "arm", nx: a.x / W, ny: a.y / H })) };
    },
  },
  {
    id: "flask",
    label: "Round Flask",
    icon: "🜂",
    make() {
      const W = 120,
        H = 180;
      const parts = [bbox(W, H)];
      vRoundFlask(parts, 60, 120, 50, 28);
      return {
        parts,
        typeKey: "roundbottom",
        anchors: [
          { id: "neck", role: "neck", nx: 0.5, ny: 26 / H },
          { id: "base", role: "base", nx: 0.5, ny: 170 / H },
        ],
      };
    },
  },
  {
    id: "condenser",
    label: "Condenser",
    icon: "║",
    make() {
      const W = 130,
        H = 230;
      const parts = [bbox(W, H)];
      const cx = 65;
      const c = vCondenser(parts, cx, 20, 210);
      return {
        parts,
        typeKey: "condenser",
        anchors: [
          { id: "top", role: "joint", nx: 0.5, ny: 16 / H },
          { id: "bottom", role: "joint", nx: 0.5, ny: 216 / H },
          { id: "portOut", role: "port", nx: (cx + c.w / 2 + 26) / W, ny: (c.outY - 7) / H },
          { id: "portIn", role: "port", nx: (cx + c.w / 2 + 26) / W, ny: (c.inY - 7) / H },
          { id: "grip", role: "grip", nx: (cx - c.w / 2) / W, ny: 0.5 },
        ],
      };
    },
  },
  {
    id: "hotplate",
    label: "Hotplate / Stirrer",
    icon: "▭",
    make() {
      const W = 200,
        H = 72;
      const parts = [bbox(W, H)];
      vHotplate(parts, 100, 36);
      return { parts, typeKey: "hotplate", anchors: [{ id: "top", role: "heat", nx: 0.5, ny: 8 / H }] };
    },
  },
  {
    id: "bath",
    label: "Water Bath",
    icon: "≈",
    make() {
      const W = 160,
        H = 92;
      const parts = [bbox(W, H)];
      vBath(parts, 80, 48, 150, 84);
      return {
        parts,
        typeKey: "waterbath",
        anchors: [
          { id: "top", role: "heat", nx: 0.5, ny: 8 / H },
          { id: "base", role: "base", nx: 0.5, ny: 88 / H },
        ],
      };
    },
  },
  {
    id: "tubing",
    label: "Tubing",
    icon: "∼",
    make() {
      const W = 150,
        H = 64;
      const parts = [bbox(W, H)];
      vTube(parts, 10, 32, 140, 32);
      return {
        parts,
        typeKey: "tubing",
        anchors: [
          { id: "a", role: "tube", nx: 10 / W, ny: 0.5 },
          { id: "b", role: "tube", nx: 140 / W, ny: 0.5 },
        ],
      };
    },
  },
  {
    id: "beaker",
    label: "Beaker",
    icon: "⊔",
    make() {
      const W = 120,
        H = 120;
      const parts = [bbox(W, H)];
      vBeaker(parts, 60, 62, 110, 108);
      return {
        parts,
        typeKey: "beaker",
        anchors: [
          { id: "top", role: "top", nx: 0.5, ny: 8 / H },
          { id: "base", role: "base", nx: 0.5, ny: 116 / H },
        ],
      };
    },
  },
  {
    id: "erlenmeyer",
    label: "Erlenmeyer",
    icon: "△",
    make() {
      const W = 120,
        H = 132;
      const parts = [bbox(W, H)];
      vErlenmeyer(parts, 60, 68, 108, 120);
      return {
        parts,
        typeKey: "erlenmeyer",
        anchors: [
          { id: "mouth", role: "joint", nx: 0.5, ny: 10 / H },
          { id: "base", role: "base", nx: 0.5, ny: 128 / H },
        ],
      };
    },
  },
  {
    id: "funnel",
    label: "Filter Funnel",
    icon: "▽",
    make() {
      const W = 120,
        H = 150;
      const parts = [bbox(W, H)];
      vFunnel(parts, 60, 10, 110);
      return {
        parts,
        typeKey: "funnel",
        anchors: [
          { id: "top", role: "top", nx: 0.5, ny: 12 / H },
          { id: "stem", role: "joint", nx: 0.5, ny: 138 / H },
        ],
      };
    },
  },
  {
    id: "burette",
    label: "Burette",
    icon: "│",
    make() {
      const W = 46,
        H = 244;
      const parts = [bbox(W, H)];
      vBurette(parts, 23, 10, 200);
      return {
        parts,
        typeKey: "burette",
        anchors: [
          { id: "grip", role: "grip", nx: 0.5, ny: 44 / H },
          { id: "tip", role: "tube", nx: 0.5, ny: 234 / H },
        ],
      };
    },
  },
];

/* ============================================================================
 * Plain helpers (module scope)
 * ==========================================================================*/
function labelForObject(o) {
  if (o.meta && o.meta.label) return o.meta.label;
  if (o.type === "activeselection") return "Multiple objects";
  const map = { textbox: "Text Label", image: "Apparatus", group: "Arrow", line: "Line" };
  return map[o.type] || o.type;
}
function removeActive(canvas, connectionsRef) {
  const objs = canvas.getActiveObjects();
  const ids = objs.map((o) => o.meta && o.meta.id).filter(Boolean);
  objs.forEach((o) => canvas.remove(o));
  if (ids.length) connectionsRef.current = connectionsRef.current.filter((e) => !ids.includes(e.a.id) && !ids.includes(e.b.id));
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}
function isEditingText(canvas) {
  const a = canvas.getActiveObject();
  return !!(a && a.isEditing);
}

/* ============================================================================
 * Tiny presentational subcomponents
 * ==========================================================================*/
function Btn({ children, onClick, variant = "default", disabled }) {
  const variants = {
    default: { background: "#fff", color: T.text, border: `1px solid ${T.border}` },
    primary: { background: T.teal, color: "#fff", border: `1px solid ${T.teal}` },
    ghost: { background: "transparent", color: T.muted, border: `1px solid ${T.border}` },
    danger: { background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...styles.tbBtn, ...variants[variant], opacity: disabled ? 0.45 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
      {children}
    </button>
  );
}
function IconBtn({ children, onClick, wide }) {
  return (
    <button onClick={onClick} style={{ ...styles.iconBtn, minWidth: wide ? "auto" : 26, padding: wide ? "0 8px" : 0 }}>
      {children}
    </button>
  );
}
function SmallBtn({ children, onClick, variant = "default" }) {
  const variants = { default: { background: "#fff", color: T.text, border: `1px solid ${T.border}` }, danger: { background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" } };
  return (
    <button onClick={onClick} style={{ ...styles.smallBtn, ...variants[variant] }}>
      {children}
    </button>
  );
}
function Field({ label, value, half }) {
  return (
    <div style={{ flex: half ? 1 : "none" }}>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldValue}>{value}</div>
    </div>
  );
}

/* ============================================================================
 * STYLES (inline — self-contained)
 * ==========================================================================*/
const styles = {
  app: {
    boxSizing: "border-box",
    width: "100%",
    height: "100%",
    minHeight: 600,
    display: "flex",
    flexDirection: "column",
    background: T.appBg,
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    overflow: "hidden",
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: T.text,
    boxShadow: T.shadow,
  },
  toolbar: { display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: T.panel, borderBottom: `1px solid ${T.border}` },
  brand: { fontSize: 14, fontWeight: 800, marginRight: 10 },
  tbGroup: { display: "flex", alignItems: "center", gap: 6 },
  tbBtn: { padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" },
  busy: { marginLeft: 10, fontSize: 12, fontWeight: 600, color: T.teal },

  body: { display: "flex", flex: 1, minHeight: 0 },

  palette: { width: 214, flexShrink: 0, background: T.panel, borderRight: `1px solid ${T.border}`, padding: 12, overflowY: "auto" },
  sideLabel: { fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, color: T.muted, marginBottom: 8 },

  templateList: { display: "flex", flexDirection: "column", gap: 6 },
  templateBtn: { textAlign: "left", padding: "8px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: "#fff", color: T.text, border: `1px solid ${T.border}`, cursor: "pointer" },
  templateBtnPrimary: { background: T.tealSoft, borderColor: "#99f6e4", color: T.teal },

  smartHint: { fontSize: 10.5, color: T.muted, marginTop: -4, marginBottom: 6 },
  smartGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  smartCard: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 4px", background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, cursor: "grab", userSelect: "none" },
  smartIcon: { fontSize: 18, lineHeight: 1, color: T.teal },
  smartLabel: { fontSize: 10, fontWeight: 600, color: T.text, textAlign: "center", lineHeight: 1.1 },

  search: { width: "100%", boxSizing: "border-box", padding: "7px 9px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12.5, outline: "none", marginBottom: 10 },
  noResults: { fontSize: 12, color: T.muted, padding: "6px 0" },
  catBlock: { marginBottom: 8 },
  catHeader: { width: "100%", display: "flex", alignItems: "center", gap: 6, background: T.appBg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 9px", fontSize: 12, fontWeight: 700, color: T.text, cursor: "pointer" },
  caret: { fontSize: 10, color: T.muted, width: 10 },
  catCount: { marginLeft: "auto", fontSize: 10.5, fontWeight: 700, color: T.muted },
  paletteGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "8px 0 2px" },
  paletteCard: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: 5, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, cursor: "grab", userSelect: "none" },
  paletteThumb: { width: "100%", height: 42, objectFit: "contain", borderRadius: 4, pointerEvents: "none" },
  paletteLabel: { fontSize: 10, fontWeight: 600, color: T.text, textAlign: "center", lineHeight: 1.1, wordBreak: "break-word" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { fontSize: 11, fontWeight: 600, color: T.teal, background: T.tealSoft, border: "1px solid #99f6e4", borderRadius: 14, padding: "4px 9px", cursor: "pointer" },

  canvasWrap: { position: "relative", flex: 1, minWidth: 0, background: "#ffffff", overflow: "hidden" },
  zoomBar: { position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 4, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 10, padding: 4, boxShadow: T.shadow },
  zoomLabel: { fontSize: 11.5, fontWeight: 700, color: T.muted, minWidth: 38, textAlign: "center" },
  iconBtn: { height: 26, borderRadius: 7, border: `1px solid ${T.border}`, background: "#fff", color: T.text, fontSize: 13, fontWeight: 700, cursor: "pointer" },
  canvasHint: { position: "absolute", bottom: 10, left: 12, fontSize: 11, color: T.muted, background: "rgba(255,255,255,0.8)", padding: "3px 8px", borderRadius: 6, pointerEvents: "none" },

  inspector: { width: 240, flexShrink: 0, background: T.panel, borderLeft: `1px solid ${T.border}`, padding: 14, overflowY: "auto" },
  inspectorEmpty: { fontSize: 12.5, color: T.muted, lineHeight: 1.5 },
  row: { display: "flex", gap: 10 },
  fieldLabel: { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: T.muted, marginBottom: 3 },
  fieldValue: { fontSize: 13, color: T.text, background: T.appBg, borderRadius: 6, padding: "5px 8px" },
  divider: { height: 1, background: T.border, margin: "2px 0" },
  smallBtn: { flex: 1, padding: "7px 8px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" },
};
