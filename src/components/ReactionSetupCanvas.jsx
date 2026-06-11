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
import { Canvas, Textbox, Line, Triangle, Group, Circle, Rect, Ellipse, Polygon, Path, Point, util } from "fabric";

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
// Which snap roles may connect. Roles model real chemistry joints/supports.
const COMPAT_PAIRS = [
  // ground-glass joints: flask neck ↔ condenser/funnel/adapter, condenser top ↔ delivery
  ["joint", "joint"],
  ["neck", "joint"],
  ["neck", "bottom"],
  ["neck", "top"],
  ["top", "bottom"],
  ["top", "joint"],
  // heating alignment: flask/beaker/bath base ↔ hotplate/burner/mantle/jack top
  ["base", "heat"],
  ["bottom", "heat"],
  ["base", "top"],
  // water/process tubing: condenser ports ↔ tubing/pipe ends, tube/pipe chaining
  ["port", "tube"],
  ["port", "start"],
  ["port", "end"],
  ["tube", "tube"],
  // supports: stand clamp arm ↔ apparatus grip, boss/mount
  ["arm", "grip"],
  ["mount", "mount"],
  ["mount", "grip"],
  ["arm", "mount"],
  // probes/thermometers insert into openings; pipettes near openings
  ["insert", "joint"],
  ["insert", "top"],
  ["insert", "neck"],
  ["tip", "top"],
  ["tip", "joint"],
  // test tubes / vials into racks
  ["pin", "slot"],
];
const canConnect = (a, b) => COMPAT_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));

/* ----------------------------------------------------------------------------
 * Anchor presets (normalized 0..1; `dir` = local outward unit vector used for
 * auto-rotation of linear connectors). `null` anchors = free annotation object.
 * --------------------------------------------------------------------------*/
const A = {
  neckBase: [{ id: "neck", role: "neck", nx: 0.5, ny: 0.05 }, { id: "base", role: "base", nx: 0.5, ny: 0.95 }],
  mouthBase: [{ id: "mouth", role: "joint", nx: 0.5, ny: 0.06 }, { id: "base", role: "base", nx: 0.5, ny: 0.96 }],
  openBase: [{ id: "top", role: "top", nx: 0.5, ny: 0.06 }, { id: "base", role: "base", nx: 0.5, ny: 0.96 }],
  condenser: [
    { id: "top", role: "joint", nx: 0.5, ny: 0.04 },
    { id: "bottom", role: "joint", nx: 0.5, ny: 0.96 },
    { id: "portOut", role: "port", nx: 0.84, ny: 0.32, dir: { x: 1, y: 0 } },
    { id: "portIn", role: "port", nx: 0.84, ny: 0.64, dir: { x: 1, y: 0 } },
    { id: "grip", role: "grip", nx: 0.16, ny: 0.5 },
  ],
  reactor: [
    { id: "top", role: "joint", nx: 0.5, ny: 0.05 },
    { id: "base", role: "base", nx: 0.5, ny: 0.95 },
    { id: "portL", role: "tube", nx: 0.08, ny: 0.4, dir: { x: -1, y: 0 } },
    { id: "portR", role: "tube", nx: 0.92, ny: 0.4, dir: { x: 1, y: 0 } },
  ],
  funnel: [{ id: "top", role: "top", nx: 0.5, ny: 0.05 }, { id: "stem", role: "joint", nx: 0.5, ny: 0.95 }],
  burette: [{ id: "grip", role: "grip", nx: 0.5, ny: 0.16 }, { id: "tip", role: "tube", nx: 0.5, ny: 0.97, dir: { x: 0, y: 1 } }],
  baseOnly: [{ id: "base", role: "base", nx: 0.5, ny: 0.95 }],
  smallTube: [{ id: "pin", role: "pin", nx: 0.5, ny: 0.08 }, { id: "base", role: "base", nx: 0.5, ny: 0.96 }],
  rack: [{ id: "slot", role: "slot", nx: 0.5, ny: 0.18 }, { id: "base", role: "base", nx: 0.5, ny: 0.95 }],
  heaterTop: [{ id: "top", role: "heat", nx: 0.5, ny: 0.08 }],
  bath: [{ id: "top", role: "heat", nx: 0.5, ny: 0.12 }, { id: "base", role: "base", nx: 0.5, ny: 0.95 }],
  mantle: [{ id: "top", role: "heat", nx: 0.5, ny: 0.3 }],
  jack: [{ id: "top", role: "heat", nx: 0.5, ny: 0.14 }, { id: "base", role: "base", nx: 0.5, ny: 0.95 }],
  stand: [
    { id: "m1", role: "arm", nx: 0.5, ny: 0.28 },
    { id: "m2", role: "arm", nx: 0.5, ny: 0.52 },
    { id: "m3", role: "arm", nx: 0.5, ny: 0.76 },
  ],
  clamp: [{ id: "mount", role: "mount", nx: 0.5, ny: 0.5 }, { id: "grip", role: "grip", nx: 0.12, ny: 0.5 }],
  ring: [{ id: "mount", role: "mount", nx: 0.85, ny: 0.5 }, { id: "hold", role: "top", nx: 0.4, ny: 0.5 }],
  tubingH: [{ id: "a", role: "tube", nx: 0.04, ny: 0.5, dir: { x: -1, y: 0 } }, { id: "b", role: "tube", nx: 0.96, ny: 0.5, dir: { x: 1, y: 0 } }],
  pipeV: [{ id: "a", role: "tube", nx: 0.5, ny: 0.04, dir: { x: 0, y: -1 } }, { id: "b", role: "tube", nx: 0.5, ny: 0.96, dir: { x: 0, y: 1 } }],
  inline: [{ id: "a", role: "tube", nx: 0.04, ny: 0.5, dir: { x: -1, y: 0 } }, { id: "b", role: "tube", nx: 0.96, ny: 0.5, dir: { x: 1, y: 0 } }],
  tank: [
    { id: "top", role: "tube", nx: 0.5, ny: 0.05, dir: { x: 0, y: -1 } },
    { id: "out", role: "tube", nx: 0.5, ny: 0.95, dir: { x: 0, y: 1 } },
    { id: "side", role: "tube", nx: 0.95, ny: 0.6, dir: { x: 1, y: 0 } },
  ],
  probe: [{ id: "tip", role: "insert", nx: 0.5, ny: 0.96 }],
  pipette: [{ id: "tip", role: "tip", nx: 0.5, ny: 0.97 }],
};

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
  return anchors.map((a) => {
    const lx = (a.nx - 0.5) * w;
    const ly = (a.ny - 0.5) * h;
    const p = util.transformPoint(new Point(lx, ly), m);
    let dir = null;
    if (a.dir) {
      const p2 = util.transformPoint(new Point(lx + a.dir.x * 10, ly + a.dir.y * 10), m);
      const vx = p2.x - p.x,
        vy = p2.y - p.y;
      const len = Math.hypot(vx, vy) || 1;
      dir = { x: vx / len, y: vy / len };
    }
    return { id: a.id, role: a.role, p, dir };
  });
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
function findSnap(canvas, connections, o, allowRotate) {
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
        if (d < SNAP_DIST && (!best || d < best.d)) {
          // auto-rotation: align a linear connector so its port faces into the target
          let rotateDeg = null;
          if (allowRotate && a.dir && b.dir) {
            const want = Math.atan2(-b.dir.y, -b.dir.x); // opposite of target's outward dir
            const have = Math.atan2(a.dir.y, a.dir.x);
            rotateDeg = ((want - have) * 180) / Math.PI;
          }
          best = {
            d,
            dx: b.p.x - a.p.x,
            dy: b.p.y - a.p.y,
            point: b.p,
            myAnchor: a.id,
            rotateDeg,
            conn: { a: { id: o.meta.id, anchor: a.id }, b: { id: other.meta.id, anchor: b.id } },
          };
        }
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
      // auto-rotation only for a free (unconnected) single piece, e.g. tubing/pipes
      const cluster = getCluster(connectionsRef.current, o.meta.id);
      const allowRotate = cluster.size === 1;
      const snap = findSnap(canvas, connectionsRef.current, o, allowRotate);
      if (snap) {
        if (snap.rotateDeg != null && Math.abs(snap.rotateDeg) > 0.5) {
          o.angle = (o.angle || 0) + snap.rotateDeg;
          o.setCoords();
          // re-align the snapping anchor after rotation
          const myW = anchorsWorld(o).find((x) => x.id === snap.myAnchor);
          if (myW) {
            o.left += snap.point.x - myW.p.x;
            o.top += snap.point.y - myW.p.y;
          }
        } else {
          o.left += snap.dx;
          o.top += snap.dy;
          dx += snap.dx;
          dy += snap.dy;
        }
        pendingRef.current = snap.conn;
        indicator.set({ left: snap.point.x, top: snap.point.y, visible: true });
        canvas.bringObjectToFront(indicator);
      } else {
        pendingRef.current = null;
        indicator.set({ visible: false });
      }
      cluster.forEach((id) => {
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

  // Nudge a freshly placed object off any apparatus it overlaps (clean spacing).
  const avoidOverlap = (obj) => {
    const c = fcRef.current;
    if (!c || !obj) return;
    const others = c.getObjects().filter((x) => x !== obj && x !== indicatorRef.current && x.meta);
    const hit = () => {
      const r = obj.getBoundingRect();
      return others.some((x) => {
        const o = x.getBoundingRect();
        return !(r.left > o.left + o.width || r.left + r.width < o.left || r.top > o.top + o.height || r.top + r.height < o.top);
      });
    };
    let tries = 0;
    while (hit() && tries < 40) {
      obj.left += 26;
      obj.top += 20;
      obj.setCoords();
      tries++;
    }
  };

  // Create a clean Fabric VECTOR apparatus object for any palette item. Every
  // category renders as vector geometry (never a JPEG sticker) with chemistry-
  // aware anchors from its family. Safety/symbol families are free annotations.
  const placeVectorType = (typeKey, label, { x, y } = {}) => {
    const c = fcRef.current;
    if (!c) return null;
    const built = buildVector(typeKey, label);
    const g = new Group(built.parts, { left: x ?? 0, top: y ?? 0, originX: "center", originY: "center", ...SEL, subTargetCheck: false });
    g.meta = { kind: built.annotation ? "annotation" : "apparatus", label, typeKey, id: newObjId(), anchors: built.anchors, annotation: built.annotation };
    c.add(g);
    return g;
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
      avoidOverlap(g);
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
    const g = placeVectorType(item.typeKey, item.label, { x: scene.x, y: scene.y });
    if (g) {
      c.setActiveObject(g);
      c.requestRenderAll();
    }
  };
  const addApparatusCenter = (item) => {
    const c = fcRef.current;
    if (!c) return;
    const p = sceneCenter();
    const g = placeVectorType(item.typeKey, item.label, { x: p.x, y: p.y });
    if (g) {
      avoidOverlap(g);
      c.setActiveObject(g);
      c.requestRenderAll();
    }
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
 * UNIVERSAL VECTOR LIBRARY — every palette item (all categories) becomes a
 * clean Fabric vector object with chemistry-aware anchors. Drawings live in a
 * [0..W]×[0..H] local box (pinned by bbox()). Anchors are normalized fractions;
 * `dir` enables auto-rotation of linear connectors.
 * ==========================================================================*/
const VC = { red: "#ef4444", orange: "#f59e0b", blue: "#3b82f6", steel: "#94a3b8", body: "#e5e7eb", dark: "#334155", cool: "#38bdf8" };
const vText = (parts, cx, cy, txt, o = {}) =>
  parts.push(new Textbox(String(txt), { left: cx, top: cy, originX: "center", originY: "center", fontSize: o.size || 12, fill: o.fill || T.ink, fontFamily: "Inter, Arial, sans-serif", fontWeight: "600", width: o.width || 130, textAlign: "center", editable: false, selectable: false, evented: false }));

/* --- glassware extras --- */
function vVolumetric(parts, cx, topY, botY, w) {
  const neckBot = topY + (botY - topY) * 0.5,
    r = w / 2;
  parts.push(rRect(cx, (topY + neckBot) / 2, 13, neckBot - topY, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: GLASS.line }));
  parts.push(rCircle(cx, botY - r, r, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: GLASS.line }));
  parts.push(rLine([cx - 7, topY + 10, cx + 7, topY + 10], { stroke: GLASS.stroke, strokeWidth: 1 }));
  parts.push(rPath(`M ${cx - r * 0.9} ${botY - r} A ${r} ${r} 0 0 1 ${cx + r * 0.9} ${botY - r} Z`, { fill: LIQ, stroke: "transparent" }));
}
function vCylinder(parts, cx, topY, botY, w) {
  const h = botY - topY;
  parts.push(rRect(cx, (topY + botY) / 2, w, h, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: GLASS.line, rx: 3 }));
  parts.push(rEllipse(cx, topY, w / 2, 5, { fill: "rgba(255,255,255,0)", stroke: GLASS.stroke, strokeWidth: 1 }));
  parts.push(rRect(cx, botY - 5, w + 10, 12, { fill: "#cbd5e1", stroke: GLASS.stroke, strokeWidth: 1, rx: 3 }));
  parts.push(rRect(cx, topY + h * 0.42, w - 6, h * 0.5, { fill: LIQ }));
  for (let i = 1; i < 5; i++) parts.push(rLine([cx + w / 2 - 9, topY + (h * i) / 5, cx + w / 2 - 2, topY + (h * i) / 5], { stroke: GLASS.stroke, strokeWidth: 0.7 }));
}
function vTestTube(parts, cx, topY, botY, w) {
  const r = w / 2;
  parts.push(rPath(`M ${cx - r} ${topY} L ${cx - r} ${botY - r} A ${r} ${r} 0 0 0 ${cx + r} ${botY - r} L ${cx + r} ${topY}`, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: GLASS.line }));
  parts.push(rRect(cx, topY, w + 4, 6, { fill: "#e2e8f0", stroke: GLASS.stroke, strokeWidth: 1 }));
  parts.push(rPath(`M ${cx - r * 0.82} ${botY - r * 1.7} L ${cx - r * 0.82} ${botY - r} A ${r * 0.82} ${r * 0.82} 0 0 0 ${cx + r * 0.82} ${botY - r} L ${cx + r * 0.82} ${botY - r * 1.7} Z`, { fill: LIQ, stroke: "transparent" }));
}
function vDish(parts, cx, cy, w) {
  parts.push(rRect(cx, cy, w, 14, { fill: GLASS.fill, stroke: "transparent" }));
  parts.push(rEllipse(cx, cy + 7, w / 2, 7, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: GLASS.line }));
  parts.push(rEllipse(cx, cy - 7, w / 2, 7, { fill: "rgba(255,255,255,0)", stroke: GLASS.stroke, strokeWidth: GLASS.line }));
  parts.push(rLine([cx - w / 2, cy - 7, cx - w / 2, cy + 7], { stroke: GLASS.stroke, strokeWidth: GLASS.line }));
  parts.push(rLine([cx + w / 2, cy - 7, cx + w / 2, cy + 7], { stroke: GLASS.stroke, strokeWidth: GLASS.line }));
}
function vPlate(parts, cx, cy, w, h) {
  parts.push(rRect(cx, cy, w, h, { fill: "#eef2f7", stroke: GLASS.stroke, strokeWidth: GLASS.line, rx: 5 }));
  const cols = 6,
    rows = 4;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) parts.push(rCircle(cx - w / 2 + (w / (cols + 1)) * (i + 1), cy - h / 2 + (h / (rows + 1)) * (j + 1), 4, { fill: "#fff", stroke: VC.steel, strokeWidth: 0.8 }));
}
function vSlide(parts, cx, cy, w, h) {
  parts.push(rRect(cx, cy, w, h, { fill: "rgba(186,230,253,0.25)", stroke: GLASS.stroke, strokeWidth: GLASS.line, rx: 2 }));
  parts.push(rRect(cx - w / 2 + w * 0.14, cy, w * 0.24, h, { fill: "#e2e8f0", stroke: "transparent" }));
}
function vPowder(parts, cx, cy, w) {
  parts.push(rPath(`M ${cx - w / 2} ${cy + 14} Q ${cx} ${cy - 18} ${cx + w / 2} ${cy + 14} Z`, { fill: "#cbb89b", stroke: "#a98e6a", strokeWidth: 1 }));
}
function vPipette(parts, cx, topY, botY) {
  parts.push(rRect(cx, (topY + botY) / 2 - 18, 9, botY - topY - 40, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: GLASS.line }));
  parts.push(rEllipse(cx, topY + 16, 11, 20, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: GLASS.line }));
  parts.push(rPath(`M ${cx - 4.5} ${botY - 24} L ${cx} ${botY} L ${cx + 4.5} ${botY - 24} Z`, { fill: GLASS.fill, stroke: GLASS.stroke, strokeWidth: GLASS.line }));
}
function vThermometer(parts, cx, topY, botY) {
  parts.push(rRect(cx, (topY + botY) / 2, 8, botY - topY - 8, { fill: "#fff", stroke: GLASS.stroke, strokeWidth: GLASS.line, rx: 4 }));
  parts.push(rRect(cx, botY - 20, 4, 30, { fill: VC.red }));
  parts.push(rCircle(cx, botY - 4, 7, { fill: VC.red, stroke: "#b91c1c", strokeWidth: 1 }));
  for (let i = 1; i < 7; i++) parts.push(rLine([cx + 4, topY + ((botY - topY) * i) / 8, cx + 8, topY + ((botY - topY) * i) / 8], { stroke: GLASS.stroke, strokeWidth: 0.7 }));
}
function vBottle(parts, cx, topY, botY, w) {
  const shoulder = topY + 26;
  parts.push(rRect(cx, topY + 6, 16, 14, { fill: "#cbd5e1", stroke: GLASS.stroke, strokeWidth: 1 }));
  parts.push(rPath(`M ${cx - 8} ${shoulder - 8} L ${cx - w / 2} ${shoulder + 6} L ${cx - w / 2} ${botY} L ${cx + w / 2} ${botY} L ${cx + w / 2} ${shoulder + 6} L ${cx + 8} ${shoulder - 8} Z`, { fill: "rgba(186,230,253,0.22)", stroke: GLASS.stroke, strokeWidth: GLASS.line }));
  parts.push(rRect(cx, (shoulder + botY) / 2 + 6, w - 22, (botY - shoulder) * 0.5, { fill: "#fff", stroke: VC.steel, strokeWidth: 1, rx: 2 }));
}
function vDroplet(parts, cx, cy, w) {
  const r = w / 2;
  parts.push(rPath(`M ${cx} ${cy - r * 1.3} C ${cx + r} ${cy - r * 0.2} ${cx + r} ${cy + r} ${cx} ${cy + r} C ${cx - r} ${cy + r} ${cx - r} ${cy - r * 0.2} ${cx} ${cy - r * 1.3} Z`, { fill: "rgba(56,189,248,0.55)", stroke: "#0ea5e9", strokeWidth: 1.2 }));
}

/* --- supports extras --- */
function vClampPiece(parts, cx, cy, w) {
  parts.push(rRect(cx + w * 0.34, cy, w * 0.32, 9, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1, rx: 2 }));
  parts.push(rRect(cx + w * 0.16, cy, 14, 18, { fill: METAL.dark, rx: 3 }));
  parts.push(rPath(`M ${cx - w / 2} ${cy - 11} L ${cx + 4} ${cy - 5} L ${cx + 4} ${cy + 5} L ${cx - w / 2} ${cy + 11}`, { fill: "", stroke: METAL.dark, strokeWidth: 5, strokeLineCap: "round" }));
  parts.push(rCircle(cx + w * 0.16, cy, 4, { fill: "#cbd5e1", stroke: METAL.edge, strokeWidth: 1 }));
}
function vBosshead(parts, cx, cy, w) {
  parts.push(rRect(cx, cy, w, w, { fill: METAL.dark, rx: 4 }));
  parts.push(rCircle(cx, cy - w * 0.28, 4, { fill: "#cbd5e1" }));
  parts.push(rCircle(cx, cy + w * 0.28, 4, { fill: "#cbd5e1" }));
}
function vRing(parts, cx, cy, w) {
  parts.push(rRect(cx + w * 0.32, cy, w * 0.36, 8, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1, rx: 2 }));
  parts.push(rEllipse(cx - w * 0.08, cy, w * 0.3, 8, { fill: "", stroke: METAL.dark, strokeWidth: 4 }));
}
function vLabjack(parts, cx, cy, w) {
  parts.push(rRect(cx, cy - 22, w, 9, { fill: METAL.light, stroke: METAL.edge, strokeWidth: 1, rx: 2 }));
  parts.push(rRect(cx, cy + 22, w, 9, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1, rx: 2 }));
  parts.push(rLine([cx - w * 0.35, cy + 18, cx + w * 0.35, cy - 18], { stroke: METAL.edge, strokeWidth: 3 }));
  parts.push(rLine([cx + w * 0.35, cy + 18, cx - w * 0.35, cy - 18], { stroke: METAL.edge, strokeWidth: 3 }));
}
function vTripod(parts, cx, cy, w) {
  parts.push(rEllipse(cx, cy - 26, w * 0.42, 7, { fill: "", stroke: METAL.dark, strokeWidth: 4 }));
  parts.push(rLine([cx - w * 0.32, cy - 24, cx - w * 0.42, cy + 30], { stroke: METAL.edge, strokeWidth: 4 }));
  parts.push(rLine([cx + w * 0.32, cy - 24, cx + w * 0.42, cy + 30], { stroke: METAL.edge, strokeWidth: 4 }));
  parts.push(rLine([cx, cy - 26, cx, cy + 30], { stroke: METAL.edge, strokeWidth: 4 }));
}
function vConnector(parts, cx, cy, w) {
  parts.push(rRect(cx, cy, w * 0.5, 14, { fill: "#cbd5e1", stroke: METAL.edge, strokeWidth: 1, rx: 3 }));
  parts.push(rRect(cx - w * 0.34, cy, w * 0.18, 9, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1 }));
  parts.push(rRect(cx + w * 0.34, cy, w * 0.18, 9, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1 }));
}

/* --- heating extras --- */
function vBlock(parts, cx, cy, w, h) {
  parts.push(rRect(cx, cy, w, h, { fill: "#cbd5e1", stroke: METAL.edge, strokeWidth: 1.2, rx: 6 }));
  for (let i = 0; i < 4; i++) parts.push(rCircle(cx - w / 2 + (w / 5) * (i + 1), cy - h * 0.1, 6, { fill: "#64748b" }));
  parts.push(rRect(cx, cy + h / 2 + 6, w + 8, 10, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1, rx: 3 }));
}
function vMantle(parts, cx, cy, w) {
  parts.push(rPath(`M ${cx - w / 2} ${cy - 16} A ${w / 2} ${w / 2} 0 0 0 ${cx + w / 2} ${cy - 16} L ${cx + w * 0.4} ${cy + 22} L ${cx - w * 0.4} ${cy + 22} Z`, { fill: "#9aa1a9", stroke: METAL.edge, strokeWidth: 1.2 }));
  parts.push(rRect(cx, cy + 26, w + 6, 10, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1, rx: 3 }));
}
function vBurner(parts, cx, topY, botY) {
  parts.push(rPath(`M ${cx} ${topY} C ${cx - 14} ${topY + 24} ${cx - 10} ${topY + 40} ${cx} ${topY + 46} C ${cx + 10} ${topY + 40} ${cx + 14} ${topY + 24} ${cx} ${topY} Z`, { fill: VC.orange, stroke: "#ea580c", strokeWidth: 1 }));
  parts.push(rPath(`M ${cx} ${topY + 14} C ${cx - 6} ${topY + 28} ${cx - 4} ${topY + 38} ${cx} ${topY + 44} C ${cx + 4} ${topY + 38} ${cx + 6} ${topY + 28} ${cx} ${topY + 14} Z`, { fill: VC.blue, stroke: "transparent" }));
  parts.push(rRect(cx, (topY + botY) / 2 + 24, 16, botY - topY - 60, { fill: "#9aa1a9", stroke: METAL.edge, strokeWidth: 1 }));
  parts.push(rRect(cx, botY - 6, 60, 12, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1, rx: 3 }));
}

/* --- instruments --- */
function vInstrument(parts, cx, cy, w, h, label) {
  parts.push(rRect(cx, cy, w, h, { fill: "#f1f5f9", stroke: METAL.edge, strokeWidth: 1.3, rx: 8 }));
  parts.push(rRect(cx, cy - h * 0.22, w * 0.62, h * 0.34, { fill: "#1e293b", stroke: "transparent", rx: 4 }));
  parts.push(rCircle(cx + w * 0.32, cy + h * 0.28, 5, { fill: VC.steel }));
  parts.push(rRect(cx - w * 0.5 + 8, cy + h / 2 + 5, 14, 10, { fill: METAL.mid }));
  parts.push(rRect(cx + w * 0.5 - 8, cy + h / 2 + 5, 14, 10, { fill: METAL.mid }));
  if (label) vText(parts, cx, cy + h * 0.28, label, { size: 11, fill: "#475569", width: w - 14 });
}
function vMicroscope(parts, cx, cy, w) {
  parts.push(rEllipse(cx, cy + w * 0.36, w * 0.36, 8, { fill: "#9aa1a9", stroke: METAL.edge, strokeWidth: 1 }));
  parts.push(rRect(cx - 6, cy, 12, w * 0.5, { fill: "#334155", angle: 0 }));
  parts.push(rRect(cx + 8, cy - w * 0.2, 12, w * 0.36, { fill: "#475569", rx: 4 }));
  parts.push(rRect(cx + 8, cy + w * 0.12, 10, 18, { fill: "#1e293b" }));
  parts.push(rRect(cx, cy + w * 0.22, w * 0.5, 8, { fill: "#cbd5e1", stroke: METAL.edge, strokeWidth: 1 }));
}
function vGauge(parts, cx, cy, r) {
  parts.push(rCircle(cx, cy, r, { fill: "#fff", stroke: METAL.edge, strokeWidth: 2 }));
  parts.push(rLine([cx, cy, cx + r * 0.5, cy - r * 0.5], { stroke: VC.red, strokeWidth: 2.5 }));
  parts.push(rCircle(cx, cy, 3, { fill: VC.dark }));
  parts.push(rRect(cx, cy + r + 8, 12, 16, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1 }));
}

/* --- industrial --- */
function vPipeV(parts, cx, topY, botY, w) {
  parts.push(rRect(cx, (topY + botY) / 2, w, botY - topY, { fill: "#b7c0cb", stroke: METAL.edge, strokeWidth: 1.2 }));
  parts.push(rRect(cx, topY + 4, w + 10, 8, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1 }));
  parts.push(rRect(cx, botY - 4, w + 10, 8, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1 }));
}
function vPipeH(parts, cx, cy, w, h) {
  parts.push(rRect(cx, cy, w, h, { fill: "#b7c0cb", stroke: METAL.edge, strokeWidth: 1.2 }));
  parts.push(rRect(cx - w / 2 + 4, cy, 8, h + 10, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1 }));
  parts.push(rRect(cx + w / 2 - 4, cy, 8, h + 10, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1 }));
}
function vValve(parts, cx, cy, w) {
  parts.push(rRect(cx, cy + 6, w, 16, { fill: "#b7c0cb", stroke: METAL.edge, strokeWidth: 1.2 }));
  parts.push(rPath(`M ${cx - 16} ${cy + 6} L ${cx + 16} ${cy + 6} L ${cx + 8} ${cy - 8} L ${cx - 8} ${cy - 8} Z`, { fill: "#64748b", stroke: METAL.edge, strokeWidth: 1 }));
  parts.push(rRect(cx, cy - 16, 6, 16, { fill: METAL.edge }));
  parts.push(rRect(cx, cy - 18, 26, 6, { fill: VC.red, rx: 3 }));
}
function vPump(parts, cx, cy, r) {
  parts.push(rCircle(cx, cy, r, { fill: "#cbd5e1", stroke: METAL.edge, strokeWidth: 1.5 }));
  parts.push(rPath(`M ${cx} ${cy} L ${cx + r * 0.7} ${cy - r * 0.5} A ${r * 0.85} ${r * 0.85} 0 0 1 ${cx + r * 0.2} ${cy + r * 0.8} Z`, { fill: "#94a3b8", stroke: METAL.edge, strokeWidth: 1 }));
  parts.push(rRect(cx, cy + r + 6, r * 1.6, 10, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1, rx: 2 }));
}
function vMixer(parts, cx, cy, w, h) {
  parts.push(rRect(cx, cy, w, h, { fill: "rgba(186,230,253,0.2)", stroke: METAL.edge, strokeWidth: 1.2, rx: 6 }));
  parts.push(rLine([cx, cy - h / 2 - 12, cx, cy + h * 0.2], { stroke: METAL.dark, strokeWidth: 3 }));
  parts.push(rRect(cx, cy + h * 0.2, w * 0.5, 6, { fill: METAL.dark }));
  parts.push(rRect(cx, cy - h / 2 - 16, 22, 12, { fill: "#475569", rx: 3 }));
}
function vExchanger(parts, cx, cy, w, h) {
  parts.push(rRect(cx, cy, w, h, { fill: "#cbd5e1", stroke: METAL.edge, strokeWidth: 1.3, rx: h / 2 }));
  parts.push(rLine([cx - w / 2 + 8, cy, cx + w / 2 - 8, cy], { stroke: METAL.edge, strokeWidth: 1, strokeDashArray: [5, 4] }));
  parts.push(rRect(cx - w / 2 + 4, cy, 8, h + 8, { fill: METAL.mid }));
  parts.push(rRect(cx + w / 2 - 4, cy, 8, h + 8, { fill: METAL.mid }));
}
function vTank(parts, cx, topY, botY, w) {
  const r = w / 2;
  parts.push(rPath(`M ${cx - r} ${topY + 16} A ${r} ${r} 0 0 1 ${cx + r} ${topY + 16} L ${cx + r} ${botY - 16} A ${r} ${r} 0 0 1 ${cx - r} ${botY - 16} Z`, { fill: "#cbd5e1", stroke: METAL.edge, strokeWidth: 1.4 }));
  parts.push(rEllipse(cx, topY + 16, r, 9, { fill: "#e2e8f0", stroke: METAL.edge, strokeWidth: 1 }));
  parts.push(rRect(cx, topY + 4, 12, 12, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1 }));
  parts.push(rRect(cx, botY - 4, 10, 12, { fill: METAL.mid, stroke: METAL.edge, strokeWidth: 1 }));
}
function vReactor(parts, cx, topY, botY, w) {
  const r = w / 2;
  parts.push(rRect(cx, (topY + botY) / 2, w, botY - topY - r, { fill: "rgba(186,230,253,0.18)", stroke: METAL.edge, strokeWidth: 1.4, rx: 6 }));
  parts.push(rPath(`M ${cx - r} ${botY - r - 6} A ${r} ${r} 0 0 0 ${cx + r} ${botY - r - 6} Z`, { fill: "rgba(186,230,253,0.18)", stroke: METAL.edge, strokeWidth: 1.4 }));
  parts.push(rRect(cx, topY + 8, 16, 16, { fill: "#475569", rx: 3 }));
  parts.push(rLine([cx, topY + 16, cx, botY - r], { stroke: METAL.dark, strokeWidth: 2.5 }));
}

/* --- symbols --- */
function vArrowShape(parts, cx, cy, len, color) {
  const sh = 8,
    hh = 16,
    hl = 20;
  const pts = [
    { x: cx - len / 2, y: cy - sh },
    { x: cx + len / 2 - hl, y: cy - sh },
    { x: cx + len / 2 - hl, y: cy - hh },
    { x: cx + len / 2, y: cy },
    { x: cx + len / 2 - hl, y: cy + hh },
    { x: cx + len / 2 - hl, y: cy + sh },
    { x: cx - len / 2, y: cy + sh },
  ];
  parts.push(new Polygon(pts, { fill: color || T.arrow }));
}
function vReactionArrow(parts, cx, cy, len) {
  parts.push(rLine([cx - len / 2, cy, cx + len / 2, cy], { stroke: T.ink, strokeWidth: 2.4 }));
  parts.push(rPath(`M ${cx + len / 2} ${cy} L ${cx + len / 2 - 12} ${cy - 6}`, { stroke: T.ink, strokeWidth: 2.4, fill: "" }));
  parts.push(rPath(`M ${cx - len / 2} ${cy + 8} L ${cx + len / 2 - 6} ${cy + 8}`, { stroke: T.ink, strokeWidth: 2.4, fill: "" }));
  parts.push(rPath(`M ${cx - len / 2} ${cy + 8} L ${cx - len / 2 + 12} ${cy + 14}`, { stroke: T.ink, strokeWidth: 2.4, fill: "" }));
}
function vCurvedArrow(parts, cx, cy, w) {
  parts.push(rPath(`M ${cx - w / 2} ${cy + 20} Q ${cx} ${cy - 30} ${cx + w / 2} ${cy + 10}`, { fill: "", stroke: T.arrow, strokeWidth: 3 }));
  parts.push(new Polygon([{ x: cx + w / 2, y: cy + 10 }, { x: cx + w / 2 - 14, y: cy + 4 }, { x: cx + w / 2 - 6, y: cy + 20 }], { fill: T.arrow }));
}
function vPlus(parts, cx, cy, w) {
  parts.push(rRect(cx, cy, w, 8, { fill: T.ink, rx: 2 }));
  parts.push(rRect(cx, cy, 8, w, { fill: T.ink, rx: 2 }));
}
function vDashed(parts, cx, cy, w) {
  parts.push(rLine([cx - w / 2, cy, cx + w / 2, cy], { stroke: T.muted, strokeWidth: 3, strokeDashArray: [8, 6] }));
}
function vHeatIcon(parts, cx, cy, w) {
  parts.push(rPath(`M ${cx} ${cy - w * 0.6} C ${cx + w * 0.5} ${cy} ${cx + w * 0.2} ${cy + w * 0.4} ${cx} ${cy + w * 0.5} C ${cx - w * 0.3} ${cy + w * 0.3} ${cx - w * 0.4} ${cy - w * 0.1} ${cx} ${cy - w * 0.6} Z`, { fill: VC.orange, stroke: "#ea580c", strokeWidth: 1 }));
}
function vCoolIcon(parts, cx, cy, w) {
  const r = w / 2;
  for (let i = 0; i < 3; i++) {
    const ang = (Math.PI / 3) * i;
    const ox = Math.cos(ang) * r,
      oy = Math.sin(ang) * r;
    parts.push(rLine([cx - ox, cy - oy, cx + ox, cy + oy], { stroke: VC.cool, strokeWidth: 2.4 }));
  }
  parts.push(rCircle(cx, cy, 3, { fill: VC.cool }));
}
function vCatalystIcon(parts, cx, cy, w) {
  const r = w / 2;
  const pts = [];
  for (let i = 0; i < 6; i++) pts.push({ x: cx + r * Math.cos((Math.PI / 3) * i - Math.PI / 6), y: cy + r * Math.sin((Math.PI / 3) * i - Math.PI / 6) });
  parts.push(new Polygon(pts, { fill: "rgba(13,148,136,0.15)", stroke: T.teal, strokeWidth: 2 }));
  vText(parts, cx, cy, "cat", { size: 12, fill: T.teal, width: w });
}

/* --- safety (annotation) --- */
function vGoggles(parts, cx, cy, w) {
  parts.push(rEllipse(cx - w * 0.22, cy, w * 0.2, 14, { fill: "rgba(56,189,248,0.3)", stroke: VC.dark, strokeWidth: 2 }));
  parts.push(rEllipse(cx + w * 0.22, cy, w * 0.2, 14, { fill: "rgba(56,189,248,0.3)", stroke: VC.dark, strokeWidth: 2 }));
  parts.push(rRect(cx, cy, w * 0.1, 6, { fill: VC.dark }));
  parts.push(rLine([cx - w * 0.42, cy, cx - w / 2, cy], { stroke: VC.dark, strokeWidth: 3 }));
  parts.push(rLine([cx + w * 0.42, cy, cx + w / 2, cy], { stroke: VC.dark, strokeWidth: 3 }));
}
function vGloves(parts, cx, cy, w) {
  parts.push(rPath(`M ${cx - w * 0.3} ${cy + 40} L ${cx - w * 0.3} ${cy - 6} L ${cx - w * 0.18} ${cy - 30} L ${cx - w * 0.06} ${cy - 6} L ${cx + w * 0.06} ${cy - 32} L ${cx + w * 0.18} ${cy - 6} L ${cx + w * 0.3} ${cy - 24} L ${cx + w * 0.3} ${cy + 40} Z`, { fill: "rgba(13,148,136,0.18)", stroke: T.teal, strokeWidth: 1.6 }));
}
function vLabcoat(parts, cx, cy, w) {
  parts.push(rPath(`M ${cx - w * 0.4} ${cy + 60} L ${cx - w * 0.34} ${cy - 40} L ${cx - w * 0.12} ${cy - 56} L ${cx} ${cy - 40} L ${cx + w * 0.12} ${cy - 56} L ${cx + w * 0.34} ${cy - 40} L ${cx + w * 0.4} ${cy + 60} Z`, { fill: "#fff", stroke: METAL.edge, strokeWidth: 1.6 }));
  parts.push(rLine([cx, cy - 40, cx, cy + 56], { stroke: METAL.edge, strokeWidth: 1.2 }));
}
function vShield(parts, cx, cy, w) {
  parts.push(rPath(`M ${cx} ${cy - w * 0.6} L ${cx + w * 0.42} ${cy - w * 0.36} L ${cx + w * 0.42} ${cy + w * 0.2} Q ${cx} ${cy + w * 0.7} ${cx - w * 0.42} ${cy + w * 0.2} L ${cx - w * 0.42} ${cy - w * 0.36} Z`, { fill: "rgba(13,148,136,0.16)", stroke: T.teal, strokeWidth: 2 }));
}
function vEyewash(parts, cx, cy, w) {
  parts.push(rRect(cx, cy + 20, 8, 40, { fill: METAL.mid }));
  parts.push(rEllipse(cx, cy, w * 0.4, 12, { fill: "rgba(56,189,248,0.3)", stroke: VC.dark, strokeWidth: 1.5 }));
  parts.push(rLine([cx - 10, cy - 4, cx - 16, cy - 16], { stroke: VC.cool, strokeWidth: 2 }));
  parts.push(rLine([cx + 10, cy - 4, cx + 16, cy - 16], { stroke: VC.cool, strokeWidth: 2 }));
}
function vExtinguisher(parts, cx, cy, w) {
  parts.push(rRect(cx, cy + 6, w * 0.7, 70, { fill: VC.red, stroke: "#b91c1c", strokeWidth: 1.4, rx: 10 }));
  parts.push(rRect(cx, cy - 36, 8, 18, { fill: VC.dark }));
  parts.push(rRect(cx, cy - 44, 22, 8, { fill: VC.dark, rx: 2 }));
  parts.push(rRect(cx, cy + 4, w * 0.5, 16, { fill: "#fff", stroke: "#fecaca", strokeWidth: 1 }));
}
function vFumehood(parts, cx, cy, w) {
  parts.push(rRect(cx, cy, w, w * 0.78, { fill: "#eef2f7", stroke: METAL.edge, strokeWidth: 1.6, rx: 4 }));
  parts.push(rRect(cx, cy - w * 0.1, w - 16, w * 0.34, { fill: "rgba(186,230,253,0.4)", stroke: METAL.edge, strokeWidth: 1 }));
  parts.push(rRect(cx, cy + w * 0.28, w - 16, w * 0.12, { fill: "#cbd5e1", stroke: METAL.edge, strokeWidth: 1 }));
  parts.push(rRect(cx, cy - w * 0.45, w * 0.3, 10, { fill: METAL.mid }));
}

/* ----------------------------------------------------------------------------
 * anchor builder shorthand
 * --------------------------------------------------------------------------*/
const an = (id, role, nx, ny, dir) => (dir ? { id, role, nx, ny, dir } : { id, role, nx, ny });

/* ----------------------------------------------------------------------------
 * FAMILIES: drawing + anchors + size for every apparatus family.
 * --------------------------------------------------------------------------*/
const FAMILIES = {
  roundFlask: { W: 120, H: 180, anchors: [an("neck", "neck", 0.5, 0.05), an("base", "base", 0.5, 0.94), an("side", "joint", 0.78, 0.32)], draw: (p) => vRoundFlask(p, 60, 118, 50, 26) },
  erlenmeyer: { W: 120, H: 132, anchors: [an("mouth", "joint", 0.5, 0.06), an("base", "base", 0.5, 0.97)], draw: (p) => vErlenmeyer(p, 60, 68, 108, 120) },
  beaker: { W: 120, H: 120, anchors: [an("top", "top", 0.5, 0.06), an("base", "base", 0.5, 0.96)], draw: (p) => vBeaker(p, 60, 62, 110, 108) },
  condenser: { W: 130, H: 230, anchors: A.condenser, draw: (p) => vCondenser(p, 65, 20, 210) },
  funnel: { W: 120, H: 150, anchors: [an("top", "top", 0.5, 0.05), an("stem", "joint", 0.5, 0.95)], draw: (p) => vFunnel(p, 60, 10, 110) },
  sepFunnel: { W: 120, H: 170, anchors: [an("top", "top", 0.5, 0.04), an("stem", "joint", 0.5, 0.97)], draw: (p) => vFunnel(p, 60, 10, 110) },
  burette: { W: 46, H: 244, anchors: A.burette, draw: (p) => vBurette(p, 23, 10, 200) },
  volumetric: { W: 90, H: 190, anchors: [an("top", "top", 0.5, 0.04), an("base", "base", 0.5, 0.96)], draw: (p) => vVolumetric(p, 45, 8, 184, 70) },
  cylinder: { W: 70, H: 170, anchors: [an("top", "top", 0.5, 0.06), an("base", "base", 0.5, 0.96)], draw: (p) => vCylinder(p, 35, 12, 160, 56) },
  testTube: { W: 40, H: 130, anchors: [an("pin", "pin", 0.5, 0.06), an("base", "base", 0.5, 0.97)], draw: (p) => vTestTube(p, 20, 10, 124, 30) },
  dish: { W: 110, H: 50, anchors: [an("base", "base", 0.5, 0.8)], draw: (p) => vDish(p, 55, 25, 100) },
  plate: { W: 130, H: 84, anchors: [an("base", "base", 0.5, 0.92)], draw: (p) => vPlate(p, 65, 42, 120, 70) },
  slide: { W: 120, H: 40, anchors: [an("base", "base", 0.5, 0.85)], draw: (p) => vSlide(p, 60, 20, 110, 26) },
  powder: { W: 90, H: 44, anchors: [an("base", "base", 0.5, 0.9)], draw: (p) => vPowder(p, 45, 22, 80) },
  pipette: { W: 32, H: 170, anchors: [an("tip", "tip", 0.5, 0.97)], draw: (p) => vPipette(p, 16, 8, 162) },
  thermometer: { W: 28, H: 180, anchors: [an("tip", "insert", 0.5, 0.97)], draw: (p) => vThermometer(p, 14, 8, 172) },
  bottle: { W: 84, H: 124, anchors: [an("base", "base", 0.5, 0.96)], draw: (p) => vBottle(p, 42, 8, 116, 70) },
  droplet: { W: 44, H: 56, annotation: true, draw: (p) => vDroplet(p, 22, 28, 32) },
  stand: {
    W: 210,
    H: 400,
    anchors: A.stand,
    draw: (p) => {
      const arms = [{ x: 188, y: 80 }, { x: 188, y: 190 }, { x: 188, y: 300 }];
      vStand(p, 30, 12, 390, arms);
      vClamps(p, arms);
    },
  },
  labjack: { W: 120, H: 84, anchors: [an("top", "heat", 0.5, 0.14), an("base", "base", 0.5, 0.95)], draw: (p) => vLabjack(p, 60, 42, 110) },
  clamp: { W: 96, H: 54, anchors: [an("mount", "mount", 0.9, 0.5), an("grip", "grip", 0.08, 0.5)], draw: (p) => vClampPiece(p, 48, 27, 90) },
  bosshead: { W: 50, H: 50, anchors: [an("m1", "mount", 0.5, 0.22), an("m2", "mount", 0.5, 0.78)], draw: (p) => vBosshead(p, 25, 25, 40) },
  ring: { W: 120, H: 44, anchors: [an("mount", "mount", 0.9, 0.5), an("hold", "top", 0.38, 0.5)], draw: (p) => vRing(p, 60, 22, 110) },
  connector: { W: 70, H: 34, anchors: [an("a", "tube", 0.05, 0.5, { x: -1, y: 0 }), an("b", "tube", 0.95, 0.5, { x: 1, y: 0 })], draw: (p) => vConnector(p, 35, 17, 64) },
  tubing: { W: 150, H: 64, anchors: A.tubingH, draw: (p) => vTube(p, 10, 32, 140, 32) },
  hotplate: { W: 200, H: 72, anchors: A.heaterTop, draw: (p) => vHotplate(p, 100, 36) },
  bath: { W: 160, H: 92, anchors: A.bath, draw: (p) => vBath(p, 80, 48, 150, 84) },
  block: { W: 120, H: 76, anchors: [an("top", "heat", 0.5, 0.16)], draw: (p) => vBlock(p, 60, 34, 110, 56) },
  mantle: { W: 140, H: 96, anchors: [an("top", "heat", 0.5, 0.34)], draw: (p) => vMantle(p, 70, 52, 130) },
  burner: { W: 80, H: 124, anchors: [an("top", "heat", 0.5, 0.04)], draw: (p) => vBurner(p, 40, 8, 116) },
  tripod: { W: 120, H: 94, anchors: [an("top", "heat", 0.5, 0.12)], draw: (p) => vTripod(p, 60, 50, 110) },
  microscope: { W: 150, H: 150, anchors: [an("base", "base", 0.5, 0.95)], draw: (p) => vMicroscope(p, 75, 60, 140) },
  instrument: { W: 170, H: 120, anchors: [an("base", "base", 0.5, 0.96)], draw: (p, W, H, label) => vInstrument(p, 85, 60, 160, 108, label) },
  gauge: { W: 74, H: 96, anchors: [an("a", "tube", 0.06, 0.4, { x: -1, y: 0 }), an("b", "tube", 0.94, 0.4, { x: 1, y: 0 })], draw: (p) => vGauge(p, 37, 36, 28) },
  pipeV: { W: 42, H: 140, anchors: A.pipeV, draw: (p) => vPipeV(p, 21, 8, 132, 26) },
  pipeH: { W: 160, H: 42, anchors: A.inline, draw: (p) => vPipeH(p, 80, 21, 152, 26) },
  valve: { W: 96, H: 60, anchors: [an("a", "tube", 0.04, 0.66, { x: -1, y: 0 }), an("b", "tube", 0.96, 0.66, { x: 1, y: 0 })], draw: (p) => vValve(p, 48, 32, 86) },
  pump: { W: 96, H: 90, anchors: [an("a", "tube", 0.04, 0.55, { x: -1, y: 0 }), an("b", "tube", 0.96, 0.4, { x: 1, y: 0 })], draw: (p) => vPump(p, 48, 42, 36) },
  mixer: { W: 110, H: 124, anchors: [an("top", "joint", 0.5, 0.04), an("out", "tube", 0.5, 0.96, { x: 0, y: 1 })], draw: (p) => vMixer(p, 55, 62, 90, 100) },
  exchanger: { W: 150, H: 64, anchors: A.inline, draw: (p) => vExchanger(p, 75, 32, 140, 52) },
  tank: { W: 120, H: 160, anchors: A.tank, draw: (p) => vTank(p, 60, 8, 152, 100) },
  reactor: { W: 140, H: 172, anchors: A.reactor, draw: (p) => vReactor(p, 70, 8, 162, 110) },
  arrow: { W: 130, H: 44, annotation: true, draw: (p, W, H) => vArrowShape(p, W / 2, H / 2, 116, T.arrow) },
  reactionArrow: { W: 140, H: 44, annotation: true, draw: (p, W, H) => vReactionArrow(p, W / 2, H / 2, 120) },
  arrowCurved: { W: 120, H: 80, annotation: true, draw: (p, W, H) => vCurvedArrow(p, W / 2, H / 2, 100) },
  plus: { W: 50, H: 50, annotation: true, draw: (p, W, H) => vPlus(p, W / 2, H / 2, 36) },
  dashed: { W: 140, H: 20, annotation: true, draw: (p, W, H) => vDashed(p, W / 2, H / 2, 130) },
  heatIcon: { W: 56, H: 66, annotation: true, draw: (p, W, H) => vHeatIcon(p, W / 2, H / 2, 36) },
  coolIcon: { W: 60, H: 60, annotation: true, draw: (p, W, H) => vCoolIcon(p, W / 2, H / 2, 40) },
  catalystIcon: { W: 64, H: 64, annotation: true, draw: (p, W, H) => vCatalystIcon(p, W / 2, H / 2, 50) },
  goggles: { W: 120, H: 56, annotation: true, draw: (p, W, H) => vGoggles(p, W / 2, H / 2, 110) },
  gloves: { W: 90, H: 110, annotation: true, draw: (p, W, H) => vGloves(p, W / 2, H / 2 + 8, 90) },
  labcoat: { W: 110, H: 140, annotation: true, draw: (p, W, H) => vLabcoat(p, W / 2, H / 2 + 6, 100) },
  shield: { W: 96, H: 116, annotation: true, draw: (p, W, H) => vShield(p, W / 2, H / 2, 86) },
  eyewash: { W: 120, H: 120, annotation: true, draw: (p, W, H) => vEyewash(p, W / 2, H / 2 - 6, 100) },
  extinguisher: { W: 80, H: 140, annotation: true, draw: (p, W, H) => vExtinguisher(p, W / 2, H / 2, 60) },
  fumehood: { W: 180, H: 150, annotation: true, draw: (p, W, H) => vFumehood(p, W / 2, H / 2, 160) },
  box: { W: 120, H: 110, anchors: [an("base", "base", 0.5, 0.95)], draw: (p, W, H, label) => vInstrument(p, 60, 55, 110, 96, label) },
};

const FAMILY_RULES = [
  [/arrowcurved/, "arrowCurved"],
  [/reactionarrow/, "reactionArrow"],
  [/arrow/, "arrow"],
  [/plussymbol|plus/, "plus"],
  [/dashedline|dashed/, "dashed"],
  [/heaticon/, "heatIcon"],
  [/coolingicon|coolicon/, "coolIcon"],
  [/catalyst/, "catalystIcon"],
  [/droplet/, "droplet"],
  [/goggle/, "goggles"],
  [/glove/, "gloves"],
  [/labcoat|coat/, "labcoat"],
  [/bioshield|shield/, "shield"],
  [/eyewash/, "eyewash"],
  [/fireextinguisher|extinguisher/, "extinguisher"],
  [/fumehood/, "fumehood"],
  [/condenser|distillationcolumn|column|refluxsetup|reflux/, "condenser"],
  [/roundbottom|reactionflask/, "roundFlask"],
  [/industrialreactor|reactorvessel|reactor/, "reactor"],
  [/separatoryfunnel|droppingfunnel/, "sepFunnel"],
  [/funnel/, "funnel"],
  [/burette/, "burette"],
  [/volumetric/, "volumetric"],
  [/graduatedcylinder|measuringcylinder|cylinder/, "cylinder"],
  [/erlenmeyer|conical|cellcultureflask|flask/, "erlenmeyer"],
  [/beaker/, "beaker"],
  [/testtube|centrifugetube|cryovial|vial/, "testTube"],
  [/petri|watchglass|evaporatingdish|crucible|dish/, "dish"],
  [/microplate|cultureplate/, "plate"],
  [/slide/, "slide"],
  [/powderpile|powder/, "powder"],
  [/pipettetips|pipette|dropper/, "pipette"],
  [/washbottle|solventbottle|reagentbottle|acidcontainer|wastecontainer|samplecontainer|solvent|reagent|acid|waste|sample|bottle|container/, "bottle"],
  [/heatingmantle|mantle/, "mantle"],
  [/waterbath|oilbath|icebath|bath/, "bath"],
  [/hotplate|stirplate|magneticstirrer/, "hotplate"],
  [/heatingblock|block/, "block"],
  [/burner|bunsen/, "burner"],
  [/tripod/, "tripod"],
  [/retortstand|ringstand|supportrod|retort|stand/, "stand"],
  [/labjack/, "labjack"],
  [/refluxclamp|clamp|holder/, "clamp"],
  [/bosshead/, "bosshead"],
  [/ironring|ring$/, "ring"],
  [/hoseconnector|connector/, "connector"],
  [/tubing|hose/, "tubing"],
  [/thermometer|thermocouple|probe|sensor|electrode/, "thermometer"],
  [/pressuregauge|gauge|flowmeter/, "gauge"],
  [/microscope/, "microscope"],
  [/phmeter|centrifuge|spectrometer|hplc|gcms|uvvis|chromatograph|pcrmachine|incubator|balance|scale|biosafetycabinet|spectro/, "instrument"],
  [/pipevertical/, "pipeV"],
  [/pipehorizontal|pipe/, "pipeH"],
  [/valve/, "valve"],
  [/pump/, "pump"],
  [/mixer/, "mixer"],
  [/exchanger/, "exchanger"],
  [/tank/, "tank"],
];
function familyFor(typeKey) {
  for (const [re, fam] of FAMILY_RULES) if (re.test(typeKey)) return fam;
  return "box";
}
function buildVector(typeKey, label) {
  const fam = FAMILIES[familyFor(typeKey)] || FAMILIES.box;
  const W = fam.W,
    H = fam.H;
  const parts = [bbox(W, H)];
  fam.draw(parts, W, H, label);
  return { parts, anchors: fam.annotation ? null : fam.anchors, annotation: !!fam.annotation };
}

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
