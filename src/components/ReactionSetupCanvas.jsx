/**
 * ReactionSetupCanvas.jsx
 * -----------------------------------------------------------------------------
 * InnovLabs AI — pictorial chemical reaction / laboratory SETUP DESIGNER.
 *
 * A SINGLE standalone, reusable React component built on Fabric.js. A simplified
 * BioRender / ChemDraw-style editor for visually composing lab apparatus setups
 * (glassware, heating, supports, instruments, biology, chemicals, safety,
 * industrial, diagram symbols) with arrows and editable text labels — meant to
 * be dropped into the InnovLabs ELN later.
 *
 * This is NOT a workflow/pipeline node graph and NOT a dashboard.
 *
 * Layout:
 *     Top toolbar  →  Left categorized palette  →  Center canvas  →  Right inspector
 *
 * ── Assets ──────────────────────────────────────────────────────────────────
 * Lab images live in `src/assets/labassets/<pack>/<name>.jpeg` and are loaded
 * automatically with Vite's import.meta.glob — so dropping new files into a
 * pack folder makes them appear in the palette with NO code changes.
 *
 * Pack folder → palette category mapping is defined in CATEGORY_NAMES below.
 *
 * Future integration points are marked with `// [INTEGRATION]`.
 *
 * Requirements:
 *     npm install fabric
 *
 * Usage:
 *     import ReactionSetupCanvas from "./components/ReactionSetupCanvas";
 *     <ReactionSetupCanvas />
 * -----------------------------------------------------------------------------
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Canvas,
  FabricImage,
  Textbox,
  Line,
  Triangle,
  Group,
  Point,
  util,
} from "fabric";

/* ============================================================================
 * ASSET DISCOVERY
 * Eagerly import every image under src/assets/labassets/<pack>/*. Vite returns
 * a map of { absolutePath: url }. We parse the pack folder + filename from each
 * path to build the categorized palette.
 * ==========================================================================*/
const ASSET_MODULES = import.meta.glob("../assets/labassets/**/*.{jpeg,jpg,png}", {
  eager: true,
  query: "?url",
  import: "default",
});

// Pack folder name → friendly category label (+ display order).
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

// Prettify a one-word filename into a readable label.
function prettify(file) {
  const base = file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// Build categories from the glob result.
function buildCategories() {
  const byFolder = new Map();
  for (const [path, url] of Object.entries(ASSET_MODULES)) {
    const after = path.split("/labassets/")[1];
    if (!after) continue;
    const parts = after.split("/");
    const folder = parts.length > 1 ? parts[0] : "misc";
    const file = parts[parts.length - 1];
    const uid = `${folder}/${file}`;
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push({ uid, label: prettify(file), src: url, folder });
  }

  const orderOf = (folder) => {
    const m = folder.match(/^pack(\d+)/);
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

// Flat lookup uid → item (used by drag-and-drop).
function buildItemIndex(categories) {
  const idx = new Map();
  categories.forEach((c) => c.items.forEach((it) => idx.set(it.uid, it)));
  return idx;
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
  shadow: "0 1px 2px rgba(15,23,42,0.06)",
};

// Quick-insert text labels common to reaction setups.
const QUICK_LABELS = ["Water In", "Water Out", "Catalyst", "Heat", "Reagent A", "Solvent", "Product"];

const DND_MIME = "application/x-apparatus";
const TARGET_W = 120;

/* ============================================================================
 * COMPONENT
 * ==========================================================================*/
export default function ReactionSetupCanvas() {
  const categories = useMemo(buildCategories, []);
  const itemIndex = useMemo(() => buildItemIndex(categories), [categories]);

  const canvasElRef = useRef(null);
  const wrapRef = useRef(null);
  const fcRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [sel, setSel] = useState(null);

  // palette UI state
  const [query, setQuery] = useState("");
  const [openCats, setOpenCats] = useState(() => ({ [categories[0]?.id]: true }));

  /* -------------------------------------------------- init Fabric canvas */
  useEffect(() => {
    const el = canvasElRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap) return;

    const canvas = new Canvas(el, {
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
      selection: true,
    });
    canvas.setDimensions({ width: wrap.offsetWidth, height: wrap.offsetHeight });
    fcRef.current = canvas;
    setReady(true);

    const readActive = () => {
      const o = canvas.getActiveObject();
      if (!o) return setSel(null);
      setSel({
        type: labelForObject(o),
        x: Math.round(o.left ?? 0),
        y: Math.round(o.top ?? 0),
        w: Math.round(o.getScaledWidth?.() ?? o.width ?? 0),
        h: Math.round(o.getScaledHeight?.() ?? o.height ?? 0),
        angle: Math.round(o.angle ?? 0),
      });
    };
    canvas.on("selection:created", readActive);
    canvas.on("selection:updated", readActive);
    canvas.on("selection:cleared", () => setSel(null));
    canvas.on("object:moving", readActive);
    canvas.on("object:scaling", readActive);
    canvas.on("object:rotating", readActive);
    canvas.on("object:modified", readActive);

    canvas.on("mouse:wheel", (opt) => {
      let z = canvas.getZoom() * 0.999 ** opt.e.deltaY;
      z = Math.min(4, Math.max(0.2, z));
      canvas.zoomToPoint(new Point(opt.e.offsetX, opt.e.offsetY), z);
      setZoom(z);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    let panning = false;
    let lastX = 0;
    let lastY = 0;
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
    });

    const onKey = (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && !isEditingText(canvas)) {
        deleteActive(canvas);
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

  /* -------------------------------------------------- helpers */
  const sceneCenter = () => {
    const c = fcRef.current;
    const inv = util.invertTransform(c.viewportTransform);
    return util.transformPoint(new Point(c.getWidth() / 2, c.getHeight() / 2), inv);
  };

  const addApparatus = (item, sceneX, sceneY) => {
    const c = fcRef.current;
    if (!c) return;
    // [INTEGRATION] item.uid could be bound to a Data Hub reagents/inventory record.
    FabricImage.fromURL(item.src, { crossOrigin: "anonymous" }).then((img) => {
      img.scaleToWidth(TARGET_W);
      img.set({
        left: sceneX,
        top: sceneY,
        originX: "center",
        originY: "center",
        cornerColor: T.teal,
        cornerStyle: "circle",
        borderColor: T.teal,
        transparentCorners: false,
        cornerSize: 10,
        padding: 4,
      });
      img.meta = { kind: "apparatus", label: item.label };
      c.add(img);
      c.setActiveObject(img);
      c.requestRenderAll();
    });
  };

  const addApparatusCenter = (item) => {
    const p = sceneCenter();
    addApparatus(item, p.x, p.y);
  };

  const addText = (text = "Double-click to edit") => {
    const c = fcRef.current;
    if (!c) return;
    const p = sceneCenter();
    const tb = new Textbox(text, {
      left: p.x,
      top: p.y,
      originX: "center",
      originY: "center",
      fontSize: 22,
      fontFamily: "Inter, Arial, sans-serif",
      fill: T.ink,
      fontWeight: "600",
      editable: true,
      cornerColor: T.teal,
      borderColor: T.teal,
      transparentCorners: false,
      cornerSize: 10,
    });
    tb.meta = { kind: "text", label: "Text Label" };
    c.add(tb);
    c.setActiveObject(tb);
    c.requestRenderAll();
  };

  const addArrow = () => {
    const c = fcRef.current;
    if (!c) return;
    const p = sceneCenter();
    const len = 140;
    const line = new Line([0, 0, len, 0], { stroke: T.ink, strokeWidth: 3, originX: "center", originY: "center" });
    const head = new Triangle({
      width: 16,
      height: 18,
      fill: T.ink,
      left: len / 2,
      top: 0,
      angle: 90,
      originX: "center",
      originY: "center",
    });
    const arrow = new Group([line, head], {
      left: p.x,
      top: p.y,
      originX: "center",
      originY: "center",
      cornerColor: T.teal,
      borderColor: T.teal,
      transparentCorners: false,
      cornerSize: 10,
    });
    arrow.meta = { kind: "arrow", label: "Arrow" };
    c.add(arrow);
    c.setActiveObject(arrow);
    c.requestRenderAll();
  };

  /* -------------------------------------------------- toolbar / inspector actions */
  const withCanvas = (fn) => () => {
    const c = fcRef.current;
    if (c) fn(c);
  };

  const deleteSelected = withCanvas((c) => {
    deleteActive(c);
    setSel(null);
  });

  const duplicateSelected = withCanvas((c) => {
    const ao = c.getActiveObject();
    if (!ao) return;
    ao.clone(["meta"]).then((cloned) => {
      c.discardActiveObject();
      cloned.set({ left: (ao.left ?? 0) + 24, top: (ao.top ?? 0) + 24 });
      cloned.meta = ao.meta;
      if (cloned.type === "activeselection") {
        cloned.canvas = c;
        cloned.forEachObject((o) => c.add(o));
      } else {
        c.add(cloned);
      }
      c.setActiveObject(cloned);
      c.requestRenderAll();
    });
  });

  const bringForward = withCanvas((c) => {
    const ao = c.getActiveObject();
    if (ao) {
      c.bringObjectForward(ao);
      c.requestRenderAll();
    }
  });

  const sendBackward = withCanvas((c) => {
    const ao = c.getActiveObject();
    if (ao) {
      c.sendObjectBackwards(ao);
      c.requestRenderAll();
    }
  });

  const applyZoom = (z) => {
    const c = fcRef.current;
    if (!c) return;
    const nz = Math.min(4, Math.max(0.2, z));
    c.zoomToPoint(new Point(c.getWidth() / 2, c.getHeight() / 2), nz);
    setZoom(nz);
  };
  const zoomIn = () => applyZoom(zoom * 1.15);
  const zoomOut = () => applyZoom(zoom / 1.15);

  const resetView = withCanvas((c) => {
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    c.setZoom(1);
    setZoom(1);
    c.requestRenderAll();
  });

  const clearCanvas = withCanvas((c) => {
    c.getObjects().slice().forEach((o) => c.remove(o));
    c.discardActiveObject();
    c.requestRenderAll();
    setSel(null);
  });

  // [INTEGRATION] "Export into notebook section": attach this PNG to the current
  // ELN entry, or serialize the scene via canvas.toJSON() to "Save setup to ELN".
  const exportPNG = withCanvas((c) => {
    const prevVpt = c.viewportTransform.slice();
    const prevZoom = c.getZoom();
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    const dataURL = c.toDataURL({ format: "png", multiplier: 2 });
    c.setViewportTransform(prevVpt);
    c.setZoom(prevZoom);
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = "reaction-setup.png";
    a.click();
  });

  /* -------------------------------------------------- palette drag & drop */
  const onPaletteDragStart = (e, uid) => {
    e.dataTransfer.setData(DND_MIME, uid);
    e.dataTransfer.effectAllowed = "copy";
  };
  const onCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onCanvasDrop = (e) => {
    e.preventDefault();
    const uid = e.dataTransfer.getData(DND_MIME);
    const item = itemIndex.get(uid);
    const c = fcRef.current;
    if (!item || !c || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const inv = util.invertTransform(c.viewportTransform);
    const scene = util.transformPoint(new Point(e.clientX - rect.left, e.clientY - rect.top), inv);
    addApparatus(item, scene.x, scene.y);
  };

  /* -------------------------------------------------- palette filtering */
  const q = query.trim().toLowerCase();
  const visibleCategories = categories
    .map((c) => ({
      ...c,
      items: q ? c.items.filter((it) => it.label.toLowerCase().includes(q)) : c.items,
    }))
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
          <Btn onClick={() => addText()} disabled={!ready}>Add Text</Btn>
          <Btn onClick={addArrow} disabled={!ready}>Add Arrow</Btn>
        </div>
        <div style={styles.tbDivider} />
        <div style={styles.tbGroup}>
          <Btn onClick={duplicateSelected} disabled={!sel}>Duplicate</Btn>
          <Btn onClick={deleteSelected} disabled={!sel} variant="danger">Delete</Btn>
          <Btn onClick={bringForward} disabled={!sel}>Bring Forward</Btn>
          <Btn onClick={sendBackward} disabled={!sel}>Send Backward</Btn>
        </div>
        <div style={styles.tbDivider} />
        <div style={styles.tbGroup}>
          <Btn onClick={zoomOut} disabled={!ready}>−</Btn>
          <span style={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
          <Btn onClick={zoomIn} disabled={!ready}>+</Btn>
          <Btn onClick={resetView} disabled={!ready}>Reset View</Btn>
        </div>
        <div style={styles.tbDivider} />
        <div style={styles.tbGroup}>
          <Btn onClick={clearCanvas} disabled={!ready} variant="ghost">Clear</Btn>
          <Btn onClick={exportPNG} disabled={!ready} variant="primary">Export PNG</Btn>
        </div>
      </div>

      {/* --------------------------------------------- body */}
      <div style={styles.body}>
        {/* left categorized palette */}
        <aside style={styles.palette}>
          <div style={styles.sideLabel}>Apparatus · {totalAssets}</div>
          <input
            style={styles.search}
            placeholder="Search apparatus…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {visibleCategories.length === 0 && (
            <div style={styles.noResults}>No apparatus matches “{query}”.</div>
          )}

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
              <button key={t} style={styles.chip} onClick={() => addText(t)} disabled={!ready}>
                {t}
              </button>
            ))}
          </div>
        </aside>

        {/* center canvas */}
        <div ref={wrapRef} style={styles.canvasWrap} onDragOver={onCanvasDragOver} onDrop={onCanvasDrop}>
          <canvas ref={canvasElRef} />
          <div style={styles.canvasHint}>Scroll to zoom · Alt-drag to pan · double-click text to edit</div>
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
            [INTEGRATION] ELN hooks (intentionally omitted for this prototype):
              - Save setup to ELN:         canvas.toJSON() → PUT /api/setups/:id
              - Load saved reaction setup:  canvas.loadFromJSON(savedJSON)
              - Attach reagents inventory:  bind object.meta to Data Hub records
              - Export into notebook:       attach exported PNG/JSON to an entry
          */}
        </aside>
      </div>
    </section>
  );
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

function deleteActive(canvas) {
  canvas.getActiveObjects().forEach((o) => canvas.remove(o));
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
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...styles.tbBtn, ...variants[variant], opacity: disabled ? 0.45 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      {children}
    </button>
  );
}

function SmallBtn({ children, onClick, variant = "default" }) {
  const variants = {
    default: { background: "#fff", color: T.text, border: `1px solid ${T.border}` },
    danger: { background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" },
  };
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

  toolbar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    padding: "10px 14px",
    background: T.panel,
    borderBottom: `1px solid ${T.border}`,
  },
  brand: { fontSize: 14, fontWeight: 800, marginRight: 6 },
  tbGroup: { display: "flex", alignItems: "center", gap: 6 },
  tbDivider: { width: 1, height: 22, background: T.border, margin: "0 4px" },
  tbBtn: { padding: "6px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", minWidth: 28 },
  zoomLabel: { fontSize: 12, fontWeight: 700, color: T.muted, minWidth: 42, textAlign: "center" },

  body: { display: "flex", flex: 1, minHeight: 0 },

  palette: {
    width: 210,
    flexShrink: 0,
    background: T.panel,
    borderRight: `1px solid ${T.border}`,
    padding: 12,
    overflowY: "auto",
  },
  sideLabel: {
    fontSize: 10.5,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: T.muted,
    marginBottom: 8,
  },
  search: {
    width: "100%",
    boxSizing: "border-box",
    padding: "7px 9px",
    borderRadius: 8,
    border: `1px solid ${T.border}`,
    fontSize: 12.5,
    outline: "none",
    marginBottom: 10,
  },
  noResults: { fontSize: 12, color: T.muted, padding: "6px 0" },

  catBlock: { marginBottom: 8 },
  catHeader: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: T.appBg,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 700,
    color: T.text,
    cursor: "pointer",
  },
  caret: { fontSize: 10, color: T.muted, width: 10 },
  catCount: { marginLeft: "auto", fontSize: 10.5, fontWeight: 700, color: T.muted },

  paletteGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "8px 0 2px" },
  paletteCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    padding: 5,
    background: "#fff",
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    cursor: "grab",
    userSelect: "none",
  },
  paletteThumb: { width: "100%", height: 42, objectFit: "contain", borderRadius: 4, pointerEvents: "none" },
  paletteLabel: { fontSize: 10, fontWeight: 600, color: T.text, textAlign: "center", lineHeight: 1.1, wordBreak: "break-word" },

  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: {
    fontSize: 11,
    fontWeight: 600,
    color: T.teal,
    background: T.tealSoft,
    border: "1px solid #99f6e4",
    borderRadius: 14,
    padding: "4px 9px",
    cursor: "pointer",
  },

  canvasWrap: { position: "relative", flex: 1, minWidth: 0, background: "#ffffff", overflow: "hidden" },
  canvasHint: {
    position: "absolute",
    bottom: 10,
    left: 12,
    fontSize: 11,
    color: T.muted,
    background: "rgba(255,255,255,0.8)",
    padding: "3px 8px",
    borderRadius: 6,
    pointerEvents: "none",
  },

  inspector: {
    width: 240,
    flexShrink: 0,
    background: T.panel,
    borderLeft: `1px solid ${T.border}`,
    padding: 14,
    overflowY: "auto",
  },
  inspectorEmpty: { fontSize: 12.5, color: T.muted, lineHeight: 1.5 },
  row: { display: "flex", gap: 10 },
  fieldLabel: { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: T.muted, marginBottom: 3 },
  fieldValue: { fontSize: 13, color: T.text, background: T.appBg, borderRadius: 6, padding: "5px 8px" },
  divider: { height: 1, background: T.border, margin: "2px 0" },

  smallBtn: { flex: 1, padding: "7px 8px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" },
};
