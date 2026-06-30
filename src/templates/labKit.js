/**
 * labKit.js
 * -----------------------------------------------------------------------------
 * Editable apparatus + prop factory for the InnovLabs template gallery.
 *
 * Everything here is a clean Fabric.js VECTOR drawing (never a bitmap). Unlike
 * the preset rigs in ReactionSetupCanvas (which group a whole setup into ONE
 * object), the gallery builds each logical piece as its OWN selectable Fabric
 * Group so the user can click any component and edit it:
 *
 *   • liquid fill level  — driven by a clipPath on a FIXED liquid shape, so the
 *     vessel never re-layouts when the level changes (robust inside groups).
 *   • liquid / body / stroke colors — child shapes are tagged with `role`
 *     ("liquid" | "glass" | "outline") so the inspector recolors precisely.
 *   • size / scale, rotation, opacity, temperature, time, notes — via meta.
 *
 * The same builders render the template thumbnails on an offscreen StaticCanvas
 * (renderThumbnail), so a card's preview is exactly what loads onto the canvas.
 *
 * This module is self-contained (its own constants + id counter) and does not
 * import from ReactionSetupCanvas, keeping the existing smart-apparatus / manual
 * builder / snapping systems completely untouched.
 * -----------------------------------------------------------------------------
 */
import { StaticCanvas, Textbox, Group, Circle, Rect, Ellipse, Polygon, Path, Line } from "fabric";

/* ----------------------------------------------------------- style + helpers */
const COL = {
  glass: "#475569",
  glassFill: "rgba(186,230,253,0.22)",
  shine: "rgba(255,255,255,0.55)",
  liquid: "rgba(129,140,248,0.55)",
  liquidShine: "rgba(199,210,254,0.4)",
  metalL: "#d1d5db",
  metalM: "#9ca3af",
  metalD: "#374151",
  metalE: "#6b7280",
  water: "rgba(56,189,248,0.4)",
  waterDeep: "rgba(14,165,233,0.18)",
  shadow: "rgba(15,23,42,0.1)",
  ink: "#0f172a",
  muted: "#64748b",
  red: "#ef4444",
  clamp: "#2563eb",
  clampDark: "#1e40af",
};

const SEL = { cornerColor: "#0d9488", cornerStyle: "circle", borderColor: "#0d9488", transparentCorners: false, cornerSize: 10, padding: 2 };

let _tid = 0;
export const nid = () => `t${++_tid}`;

const R = (x, y, w, h, o = {}) => new Rect({ left: x, top: y, width: w, height: h, originX: "center", originY: "center", ...o });
const C = (x, y, r, o = {}) => new Circle({ left: x, top: y, radius: r, originX: "center", originY: "center", ...o });
const E = (x, y, rx, ry, o = {}) => new Ellipse({ left: x, top: y, rx, ry, originX: "center", originY: "center", ...o });
const PG = (pts, o = {}) => new Polygon(pts, { ...o });
const PT = (d, o = {}) => new Path(d, { ...o });
const LN = (pts, o = {}) => new Line(pts, { ...o });
const TX = (s, x, y, o = {}) =>
  new Textbox(s, { left: x, top: y, originX: "center", originY: "center", fontFamily: "Inter, Arial, sans-serif", fontSize: 12, fill: COL.ink, textAlign: "center", ...o });

const shadow = (x, y, rx, ry = 5) => E(x, y, rx, ry, { fill: COL.shadow, stroke: "transparent" });

export function hexToRgba(hex, a = 1) {
  if (!hex) return `rgba(129,140,248,${a})`;
  if (hex.startsWith("rgb")) return hex;
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ----------------------------------------------------------- size catalogs */
const SIZES = {
  vessel5: { default: "250 mL", options: ["50 mL", "100 mL", "250 mL", "500 mL", "1000 mL"], scales: { "50 mL": 0.62, "100 mL": 0.76, "250 mL": 1, "500 mL": 1.2, "1000 mL": 1.42 } },
  erlen: { default: "250 mL", options: ["100 mL", "250 mL", "500 mL"], scales: { "100 mL": 0.8, "250 mL": 1, "500 mL": 1.22 } },
  cyl: { default: "100 mL", options: ["10 mL", "25 mL", "50 mL", "100 mL", "250 mL"], scales: { "10 mL": 0.6, "25 mL": 0.72, "50 mL": 0.85, "100 mL": 1, "250 mL": 1.25 } },
  burette: { default: "50 mL", options: ["10 mL", "25 mL", "50 mL"], scales: { "10 mL": 0.72, "25 mL": 0.86, "50 mL": 1 } },
};

/* ============================================================================
 * VESSEL DRAWERS — each returns { parts, liquidH, sizeCat, level, label }.
 * Coordinates are centered on (0,0). The liquid shape is tagged role:"liquid"
 * and kept at FULL interior size; a clipPath added by buildApparatus reveals
 * only the bottom `level` fraction.
 * ==========================================================================*/
function dBeaker() {
  const w = 104, top = -56, bot = 56;
  return {
    label: "Beaker",
    sizeCat: SIZES.vessel5,
    liquidH: 102,
    parts: [
      shadow(0, bot + 6, 46),
      R(0, 0, w, bot - top, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.8, rx: 3, role: "glass" }),
      R(0, 1, w - 12, 102, { fill: COL.liquid, role: "liquid" }),
      R(0, 0, w, bot - top, { fill: "transparent", stroke: COL.glass, strokeWidth: 1.8, rx: 3, role: "outline" }),
      LN([-w / 2 + 4, top + 8, -w / 2 + 4, bot - 6], { stroke: COL.shine, strokeWidth: 1.2 }),
      LN([-w / 2, top, -w / 2 - 9, top + 7], { stroke: COL.glass, strokeWidth: 1.8 }),
      LN([-30, -14, 30, -14], { stroke: "#6366f1", strokeWidth: 1.2 }),
    ],
  };
}
function dRoundFlask() {
  const r = 44;
  return {
    label: "Round-bottom Flask",
    sizeCat: SIZES.vessel5,
    liquidH: 2 * (r - 2),
    parts: [
      shadow(0, 30 + r + 4, r * 0.85),
      R(0, -55, 20, 52, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.8, role: "glass" }),
      C(0, 30, r, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.8, role: "glass" }),
      C(0, 30, r - 2, { fill: COL.liquid, role: "liquid" }),
      R(0, -55, 20, 52, { fill: "transparent", stroke: COL.glass, strokeWidth: 1.8, role: "outline" }),
      C(0, 30, r, { fill: "transparent", stroke: COL.glass, strokeWidth: 1.8, role: "outline" }),
      PT(`M ${-r * 0.6} ${18} Q ${-r * 0.2} ${4} ${r * 0.2} ${10}`, { fill: "", stroke: COL.shine, strokeWidth: 2 }),
    ],
  };
}
function dErlenmeyer() {
  const body = [
    { x: -12, y: -40 },
    { x: 12, y: -40 },
    { x: 54, y: 60 },
    { x: -54, y: 60 },
  ];
  return {
    label: "Erlenmeyer Flask",
    sizeCat: SIZES.erlen,
    liquidH: 100,
    parts: [
      shadow(0, 66, 50),
      R(0, -53, 18, 26, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.8, role: "glass" }),
      PG(body, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.8, role: "glass" }),
      PG(body.map((p) => ({ ...p })), { fill: COL.liquid, role: "liquid" }),
      PG(body.map((p) => ({ ...p })), { fill: "transparent", stroke: COL.glass, strokeWidth: 1.8, role: "outline" }),
      R(0, -53, 18, 26, { fill: "transparent", stroke: COL.glass, strokeWidth: 1.8, role: "outline" }),
    ],
  };
}
function dCylinder() {
  return {
    label: "Graduated Cylinder",
    sizeCat: SIZES.cyl,
    liquidH: 140,
    parts: [
      shadow(0, 88, 30),
      E(0, 84, 30, 7, { fill: COL.metalL, stroke: COL.metalE, strokeWidth: 1 }),
      R(0, 0, 40, 150, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.6, rx: 2, role: "glass" }),
      R(0, 2, 32, 140, { fill: COL.liquid, role: "liquid" }),
      R(0, 0, 40, 150, { fill: "transparent", stroke: COL.glass, strokeWidth: 1.6, rx: 2, role: "outline" }),
      ...[-50, -20, 10, 40].map((y) => LN([6, y, 16, y], { stroke: COL.glass, strokeWidth: 0.8 })),
    ],
  };
}
function dVial() {
  return {
    label: "Vial",
    liquidH: 58,
    parts: [
      shadow(0, 46, 16),
      R(0, -40, 28, 16, { fill: COL.metalM, stroke: COL.metalE, strokeWidth: 1, rx: 2 }),
      R(0, 8, 30, 70, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.6, rx: 3, role: "glass" }),
      R(0, 12, 24, 58, { fill: COL.liquid, role: "liquid" }),
      R(0, 8, 30, 70, { fill: "transparent", stroke: COL.glass, strokeWidth: 1.6, rx: 3, role: "outline" }),
    ],
  };
}
function dBottle() {
  return {
    label: "Reagent Bottle",
    liquidH: 78,
    parts: [
      shadow(0, 64, 34),
      R(0, -52, 20, 12, { fill: COL.metalD, rx: 2 }),
      R(0, -42, 16, 14, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.4, role: "glass" }),
      PG([{ x: -8, y: -34 }, { x: 8, y: -34 }, { x: 32, y: -14 }, { x: -32, y: -14 }], { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.4, role: "glass" }),
      R(0, 18, 64, 86, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.6, rx: 6, role: "glass" }),
      R(0, 21, 56, 78, { fill: COL.liquid, role: "liquid" }),
      R(0, 18, 64, 86, { fill: "transparent", stroke: COL.glass, strokeWidth: 1.6, rx: 6, role: "outline" }),
      R(0, 20, 40, 26, { fill: "rgba(255,255,255,0.6)", stroke: "#cbd5e1", strokeWidth: 1, rx: 3 }),
    ],
  };
}
function dTestTube() {
  return {
    label: "Test Tube",
    liquidH: 106,
    parts: [
      R(0, -60, 34, 6, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.4 }),
      R(0, 0, 30, 124, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.6, rx: 14, role: "glass" }),
      R(0, 6, 24, 106, { fill: COL.liquid, role: "liquid" }),
      R(0, 0, 30, 124, { fill: "transparent", stroke: COL.glass, strokeWidth: 1.6, rx: 14, role: "outline" }),
    ],
  };
}
function dSepFunnel() {
  const pear = [
    { x: -16, y: -66 },
    { x: 16, y: -66 },
    { x: 42, y: -28 },
    { x: 34, y: 20 },
    { x: 0, y: 48 },
    { x: -34, y: 20 },
    { x: -42, y: -28 },
  ];
  return {
    label: "Separatory Funnel",
    liquidH: 114,
    parts: [
      R(0, -74, 30, 14, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.6, role: "glass" }),
      PG(pear, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.8, role: "glass" }),
      PG(pear.map((p) => ({ ...p })), { fill: COL.liquid, role: "liquid" }),
      PG(pear.map((p) => ({ ...p })), { fill: "transparent", stroke: COL.glass, strokeWidth: 1.8, role: "outline" }),
      C(0, 56, 8, { fill: COL.clamp, stroke: COL.clampDark, strokeWidth: 1 }),
      R(0, 74, 8, 28, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.4, role: "glass" }),
    ],
  };
}
function dColumn() {
  return {
    label: "Chromatography Column",
    liquidH: 160,
    parts: [
      R(0, -98, 44, 20, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.6, rx: 4, role: "glass" }),
      R(0, -5, 36, 188, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.6, rx: 3, role: "glass" }),
      R(0, -5, 30, 160, { fill: COL.liquid, role: "liquid" }),
      R(0, 36, 30, 96, { fill: "rgba(234,179,8,0.28)", stroke: "transparent" }),
      ...[-10, 4, 18, 32, 46, 60].map((y) => LN([-14, y, 14, y + 4], { stroke: "rgba(180,130,40,0.35)", strokeWidth: 1 })),
      R(0, -5, 36, 188, { fill: "transparent", stroke: COL.glass, strokeWidth: 1.6, rx: 3, role: "outline" }),
      C(0, 96, 8, { fill: COL.clamp, stroke: COL.clampDark, strokeWidth: 1 }),
      R(0, 112, 6, 22, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.4, role: "glass" }),
    ],
  };
}
function dFilterFlask() {
  const body = [
    { x: -10, y: -38 },
    { x: 10, y: -38 },
    { x: 50, y: 58 },
    { x: -50, y: 58 },
  ];
  return {
    label: "Filter Flask",
    sizeCat: SIZES.erlen,
    liquidH: 96,
    parts: [
      shadow(0, 64, 48),
      R(0, -50, 16, 24, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.6, role: "glass" }),
      R(44, -22, 34, 12, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.4, rx: 3, role: "glass" }),
      PG(body, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.8, role: "glass" }),
      PG(body.map((p) => ({ ...p })), { fill: COL.liquid, role: "liquid" }),
      PG(body.map((p) => ({ ...p })), { fill: "transparent", stroke: COL.glass, strokeWidth: 1.8, role: "outline" }),
    ],
  };
}

const VESSELS = {
  beaker: dBeaker,
  roundFlask: dRoundFlask,
  erlenmeyer: dErlenmeyer,
  cylinder: dCylinder,
  vial: dVial,
  bottle: dBottle,
  testTube: dTestTube,
  sepFunnel: dSepFunnel,
  column: dColumn,
  filterFlask: dFilterFlask,
};

/* ============================================================================
 * PROP DRAWERS — supporting hardware (no editable liquid). The principal
 * tintable surface is tagged role:"glass" so "Body color" still works.
 * ==========================================================================*/
function pStand(o = {}) {
  const parts = [
    shadow(-20, 192, 80),
    R(-52, 188, 150, 16, { fill: COL.metalM, stroke: COL.metalE, strokeWidth: 1.2, rx: 3, role: "glass" }),
    R(-70, 0, 12, 376, { fill: COL.metalL, stroke: COL.metalE, strokeWidth: 1.2, rx: 4, role: "glass" }),
    R(-66, 0, 4, 376, { fill: COL.shine, stroke: "transparent" }),
  ];
  (o.clamps || [-40]).forEach((y) => {
    parts.push(R(-35, y, 70, 8, { fill: COL.metalM, stroke: COL.metalE, strokeWidth: 1, rx: 3 }));
    parts.push(R(-70, y, 22, 26, { fill: COL.metalD, rx: 3 }));
    parts.push(E(0, y, 18, 7, { fill: COL.clampDark, stroke: COL.clamp, strokeWidth: 1.2 }));
    parts.push(E(0, y, 9, 4, { fill: "#bfdbfe" }));
  });
  if (o.ring) parts.push(E(0, o.ring, 30, 9, { fill: "none", stroke: COL.metalD, strokeWidth: 4 }));
  return { label: "Retort Stand", parts, sizeCat: SIZES_STAND };
}
const SIZES_STAND = { default: "standard", options: ["small", "standard", "tall"], scales: { small: 0.78, standard: 1, tall: 1.22 } };

function pHotplate() {
  return {
    label: "Hotplate Stirrer",
    sizeCat: { default: "standard", options: ["compact", "standard", "large"], scales: { compact: 0.8, standard: 1, large: 1.25 } },
    parts: [
      shadow(0, 26, 96),
      R(0, 8, 180, 38, { fill: "#f3f4f6", stroke: COL.metalE, strokeWidth: 1.2, rx: 8, role: "glass" }),
      R(0, 8, 180, 38, { fill: "transparent", stroke: COL.metalE, strokeWidth: 1.2, rx: 8, role: "outline" }),
      E(-14, -14, 64, 9, { fill: COL.metalL, stroke: COL.metalE, strokeWidth: 1 }),
      R(0, 30, 196, 14, { fill: COL.metalM, stroke: COL.metalE, strokeWidth: 1, rx: 3 }),
      C(-66, 8, 4, { fill: COL.red, stroke: "#b91c1c", strokeWidth: 0.8 }),
      C(70, 8, 11, { fill: "#f9fafb", stroke: COL.metalE, strokeWidth: 1.2 }),
      LN([70, 1, 70, 8], { stroke: COL.metalD, strokeWidth: 2 }),
    ],
  };
}
function pMantle() {
  return {
    label: "Heating Mantle",
    parts: [
      shadow(0, 44, 70),
      PG([{ x: -64, y: -34 }, { x: 64, y: -34 }, { x: 50, y: 44 }, { x: -50, y: 44 }], { fill: "#cbd5e1", stroke: COL.metalE, strokeWidth: 1.4, rx: 6, role: "glass" }),
      E(0, -34, 56, 14, { fill: "#94a3b8", stroke: COL.metalE, strokeWidth: 1.2 }),
      R(0, 48, 150, 12, { fill: COL.metalM, stroke: COL.metalE, strokeWidth: 1, rx: 3 }),
    ],
  };
}
function pCondenser() {
  const top = -92, bot = 92;
  const parts = [
    R(0, 0, 44, bot - top, { fill: COL.water, stroke: COL.glass, strokeWidth: 1.6, rx: 4, role: "glass" }),
    R(0, 0, 14, bot - top + 18, { fill: COL.glassFill, stroke: "#94a3b8", strokeWidth: 1.2, role: "glass" }),
    R(0, top + 6, 22, 16, { fill: "rgba(186,230,253,0.55)", stroke: COL.glass, strokeWidth: 1 }),
    R(0, bot - 6, 20, 14, { fill: "rgba(186,230,253,0.55)", stroke: COL.glass, strokeWidth: 1 }),
    R(0, 0, 44, bot - top, { fill: "transparent", stroke: COL.glass, strokeWidth: 1.6, rx: 4, role: "outline" }),
  ];
  [-50, 36].forEach((y) => {
    parts.push(LN([20, y, 50, y - 8], { stroke: COL.glass, strokeWidth: 7, strokeLineCap: "round" }));
    parts.push(LN([20, y, 50, y - 8], { stroke: "#e0f2fe", strokeWidth: 2.8, strokeLineCap: "round" }));
  });
  return { label: "Condenser", sizeCat: { default: "medium", options: ["short", "medium", "long"], scales: { short: 0.75, medium: 1, long: 1.35 } }, parts };
}
function pBalloon(o = {}) {
  const fill = o.accent || "#fca5a5";
  return {
    label: o.label || "Gas Balloon",
    parts: [
      E(0, -28, 38, 46, { fill, stroke: "#ef4444", strokeWidth: 1.5, role: "glass" }),
      E(-12, -40, 10, 14, { fill: "rgba(255,255,255,0.45)", stroke: "transparent" }),
      PG([{ x: -6, y: 16 }, { x: 6, y: 16 }, { x: 0, y: 26 }], { fill: "#ef4444", stroke: "transparent" }),
      LN([0, 26, 0, 70], { stroke: COL.metalD, strokeWidth: 2 }),
      o.label ? TX(o.label, 0, -28, { fontSize: 13, fontWeight: "700", fill: "#7f1d1d" }) : R(0, -28, 1, 1, { fill: "transparent" }),
    ],
  };
}
function pThermometer() {
  return {
    label: "Thermometer",
    parts: [
      R(0, 0, 8, 150, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.4, rx: 4, role: "glass" }),
      C(0, 70, 7, { fill: COL.red, stroke: "#b91c1c", strokeWidth: 0.8 }),
      R(0, 20, 3, 110, { fill: COL.red }),
      ...[-50, -20, 10, 40].map((y) => LN([4, y, 9, y], { stroke: COL.glass, strokeWidth: 0.8 })),
    ],
  };
}
function pFunnel() {
  return {
    label: "Filter Funnel",
    parts: [
      PG([{ x: -55, y: -40 }, { x: 55, y: -40 }, { x: 6, y: 30 }, { x: -6, y: 30 }], { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.8, role: "glass" }),
      R(0, 52, 9, 44, { fill: COL.glassFill, stroke: COL.glass, strokeWidth: 1.8, role: "glass" }),
      LN([-44, -34, 44, -34], { stroke: "#cbd5e1", strokeWidth: 2 }),
    ],
  };
}
function pBath(o = {}) {
  const fill = o.accent || COL.water;
  return {
    label: o.label || "Water Bath",
    parts: [
      shadow(0, 44, 78),
      R(0, 0, 152, 80, { fill, stroke: "#38bdf8", strokeWidth: 1.6, rx: 6, role: "glass" }),
      R(0, 0, 152, 80, { fill: "transparent", stroke: "#38bdf8", strokeWidth: 1.6, rx: 6, role: "outline" }),
      ...(o.ice
        ? [C(-40, -18, 7, { fill: "rgba(255,255,255,0.8)", stroke: "#bae6fd" }), C(36, -14, 8, { fill: "rgba(255,255,255,0.8)", stroke: "#bae6fd" }), C(2, -22, 6, { fill: "rgba(255,255,255,0.8)", stroke: "#bae6fd" })]
        : [LN([-66, -26, 66, -26], { stroke: "#0ea5e9", strokeWidth: 1.6 })]),
    ],
  };
}
function pRod(o = {}) {
  return {
    label: o.label || "Electrode",
    parts: [
      R(0, 0, o.w || 8, o.h || 110, { fill: o.accent || COL.metalM, stroke: COL.metalE, strokeWidth: 1, rx: 2, role: "glass" }),
      R(0, -(o.h || 110) / 2 + 6, (o.w || 8) + 6, 10, { fill: COL.metalD, rx: 2 }),
    ],
  };
}
function pBox(o = {}) {
  const w = o.w || 150, h = o.h || 100;
  const accent = o.accent || "#0d9488";
  const parts = [
    shadow(0, h / 2 + 6, w * 0.45),
    R(0, 0, w, h, { fill: o.body || "#e5e7eb", stroke: "#94a3b8", strokeWidth: 1.4, rx: 10, role: "glass" }),
    R(0, -h / 2 + 13, w - 14, 18, { fill: accent, rx: 6 }),
    R(0, 0, w, h, { fill: "transparent", stroke: "#94a3b8", strokeWidth: 1.4, rx: 10, role: "outline" }),
  ];
  if (o.screen) parts.push(R(0, 4, w * 0.62, h * 0.38, { fill: "#0f172a", stroke: "#1e293b", strokeWidth: 1, rx: 5 }));
  if (o.screen) parts.push(R(0, 4, w * 0.5, h * 0.22, { fill: "rgba(56,189,248,0.25)", stroke: "transparent", rx: 3 }));
  parts.push(R(-w / 2 + 16, h / 2 - 4, 16, 8, { fill: COL.metalD, rx: 2 }));
  parts.push(R(w / 2 - 16, h / 2 - 4, 16, 8, { fill: COL.metalD, rx: 2 }));
  if (o.label) parts.push(TX(o.label, 0, h / 2 - 16, { fontSize: o.fontSize || 12, fontWeight: "700", fill: COL.ink, width: w - 16 }));
  return { label: o.label || "Instrument", parts };
}

const PROPS = {
  stand: pStand,
  hotplate: pHotplate,
  mantle: pMantle,
  condenser: pCondenser,
  balloon: pBalloon,
  thermometer: pThermometer,
  funnel: pFunnel,
  bath: pBath,
  rod: pRod,
  box: pBox,
};

/* ============================================================================
 * BUILDERS — wrap drawer parts into a selectable, editable Fabric Group.
 * ==========================================================================*/
function metaFor(kind, spec, opts, isProp) {
  const hasLiquid = !!spec.liquidH && !isProp;
  return {
    kind: "apparatus",
    typeKey: kind,
    baseLabel: opts.label || spec.label || kind,
    label: opts.label || spec.label || kind,
    size: spec.sizeCat ? opts.size || spec.sizeCat.default : null,
    sizeCat: spec.sizeCat || null,
    anchors: null,
    id: null,
    temp: opts.temp || "",
    time: opts.time || "",
    notes: opts.notes || "",
    editable: {
      liquid: hasLiquid,
      liquidH: hasLiquid ? spec.liquidH : 0,
      liquidLevel: hasLiquid ? opts.level ?? spec.level ?? 0.55 : 0,
      liquidColor: opts.liquidColor || "#818cf8",
      glassColor: opts.glassColor || "#bae6fd",
      strokeColor: opts.strokeColor || "#475569",
    },
  };
}

function applyLevelToLiquid(liq, Hc, L) {
  if (!liq || !Hc) return;
  const clipH = Math.max(0.001, Hc * L);
  if (liq.clipPath) liq.clipPath.set({ height: clipH, top: Hc / 2 - clipH / 2 });
  liq.dirty = true;
}

export function buildApparatus(kind, opts = {}) {
  const spec = (VESSELS[kind] || dBeaker)(opts);
  const g = new Group(spec.parts, { originX: "center", originY: "center", subTargetCheck: false, ...SEL });
  g.meta = metaFor(kind, spec, opts, false);
  const liq = g.getObjects().find((o) => o.role === "liquid");
  if (liq && spec.liquidH) {
    liq.clipPath = new Rect({ left: 0, top: 0, width: 5000, height: spec.liquidH, originX: "center", originY: "center" });
    if (opts.liquidColor) liq.set("fill", hexToRgba(opts.liquidColor, 0.5));
    applyLevelToLiquid(liq, spec.liquidH, g.meta.editable.liquidLevel);
  }
  return g;
}

export function buildProp(kind, opts = {}) {
  const spec = (PROPS[kind] || pBox)(opts);
  const g = new Group(spec.parts, { originX: "center", originY: "center", subTargetCheck: false, ...SEL });
  g.meta = metaFor(kind, spec, opts, true);
  return g;
}

export function buildText(str, opts = {}) {
  const t = new Textbox(str, {
    originX: "center",
    originY: "center",
    fontFamily: opts.serif ? "Georgia, 'Times New Roman', serif" : "Inter, Arial, sans-serif",
    fontSize: opts.fontSize || 16,
    fontWeight: opts.fontWeight || "600",
    fill: opts.fill || COL.ink,
    textAlign: "center",
    editable: true,
    ...SEL,
  });
  t.meta = { kind: "text", label: "Text Label", id: null };
  return t;
}

export function buildArrow(len = 110, angleDeg = 0, color = "#7c6fe0") {
  const sh = 9, hh = 17, hl = 22;
  const pts = [
    { x: -len / 2, y: -sh },
    { x: len / 2 - hl, y: -sh },
    { x: len / 2 - hl, y: -hh },
    { x: len / 2, y: 0 },
    { x: len / 2 - hl, y: hh },
    { x: len / 2 - hl, y: sh },
    { x: -len / 2, y: sh },
  ];
  const poly = new Polygon(pts, { angle: angleDeg, fill: color, originX: "center", originY: "center", ...SEL });
  poly.meta = { kind: "arrow", label: "Arrow", id: null, arrowColor: color };
  return poly;
}

export function buildPipe(x1, y1, x2, y2) {
  const d = `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1 - 26}, ${(x1 + x2) / 2} ${y2 + 26}, ${x2} ${y2}`;
  const parts = [
    PT(d, { fill: "", stroke: "rgba(15,23,42,0.1)", strokeWidth: 13, strokeLineCap: "round" }),
    PT(d, { fill: "", stroke: COL.glass, strokeWidth: 10, strokeLineCap: "round", role: "glass" }),
    PT(d, { fill: "", stroke: "#f8fafc", strokeWidth: 4, strokeLineCap: "round" }),
  ];
  const g = new Group(parts, { originX: "center", originY: "center", subTargetCheck: false, ...SEL });
  g.meta = { kind: "apparatus", typeKey: "tubing", baseLabel: "Tubing", label: "Tubing", size: null, sizeCat: null, anchors: null, id: null, temp: "", time: "", notes: "", editable: { liquid: false, liquidH: 0, glassColor: "#bae6fd", strokeColor: "#475569" } };
  return g;
}

/* ============================================================================
 * INSPECTOR HELPERS — operate on a selected editable group.
 * ==========================================================================*/
const childrenWithRole = (o, role) => (o.getObjects ? o.getObjects().filter((c) => c.role === role) : []);
export const hasGlass = (o) => childrenWithRole(o, "glass").length > 0;
export const hasOutline = (o) => childrenWithRole(o, "outline").length > 0;

export function setLiquidLevel(o, L) {
  if (!o.meta?.editable?.liquid) return;
  const liq = childrenWithRole(o, "liquid")[0];
  applyLevelToLiquid(liq, o.meta.editable.liquidH, L);
  o.meta.editable.liquidLevel = L;
  o.dirty = true;
}
export function setLiquidColor(o, hex) {
  childrenWithRole(o, "liquid").forEach((c) => c.set("fill", hexToRgba(hex, 0.5)));
  if (o.meta?.editable) o.meta.editable.liquidColor = hex;
  o.dirty = true;
}
export function setGlassColor(o, hex) {
  childrenWithRole(o, "glass").forEach((c) => c.set("fill", hexToRgba(hex, 0.22)));
  if (o.meta?.editable) o.meta.editable.glassColor = hex;
  o.dirty = true;
}
export function setStrokeColor(o, hex) {
  [...childrenWithRole(o, "glass"), ...childrenWithRole(o, "outline")].forEach((c) => c.set("stroke", hex));
  if (o.meta?.editable) o.meta.editable.strokeColor = hex;
  o.dirty = true;
}
export function setArrowColor(o, hex) {
  if (o.getObjects) {
    o.getObjects().forEach((c) => {
      if (c.type === "line") c.set("stroke", hex);
      else if (c.fill && c.fill !== "transparent") c.set("fill", hex);
    });
  } else {
    o.set("fill", hex);
  }
  if (o.meta) o.meta.arrowColor = hex;
  o.dirty = true;
}
export function arrowColorOf(o) {
  if (o.meta?.arrowColor) return o.meta.arrowColor;
  if (typeof o.fill === "string" && o.fill.startsWith("#")) return o.fill;
  return "#7c6fe0";
}

/* ============================================================================
 * SCENE API — used by templates to place pieces (live canvas or thumbnail).
 * ==========================================================================*/
export function makeApi(canvas, { connections = [] } = {}) {
  const place = (g, x, y) => {
    g.set({ left: x, top: y });
    g.meta.id = nid();
    canvas.add(g);
    return g;
  };
  return {
    canvas,
    app: (kind, x, y, opts = {}) => place(buildApparatus(kind, opts), x, y),
    prop: (kind, x, y, opts = {}) => place(buildProp(kind, opts), x, y),
    box: (label, x, y, opts = {}) => place(buildProp("box", { label, ...opts }), x, y),
    pipe: (x1, y1, x2, y2) => {
      const g = buildPipe(x1, y1, x2, y2);
      g.meta.id = nid();
      g.set({ originX: "center", originY: "center" });
      canvas.add(g);
      return g;
    },
    text: (str, x, y, opts = {}) => {
      const t = buildText(str, opts);
      t.set({ left: x, top: y });
      t.meta.id = nid();
      canvas.add(t);
      return t;
    },
    label: (str, x, y, opts = {}) => {
      const t = buildText(str, { fontSize: opts.fontSize || 13, fill: opts.fill || COL.muted, fontWeight: "600", ...opts });
      t.set({ left: x, top: y });
      t.meta.id = nid();
      canvas.add(t);
      return t;
    },
    title: (str, x, y) => {
      const t = buildText(str, { fontSize: 17, fill: COL.ink, fontWeight: "700", serif: true });
      t.set({ left: x, top: y });
      t.meta.id = nid();
      canvas.add(t);
      return t;
    },
    arrow: (x, y, len, ang, opts = {}) => {
      const a = buildArrow(len, ang, opts.color || "#7c6fe0");
      a.set({ left: x, top: y });
      a.meta.id = nid();
      if (opts.label) a.meta.baseLabel = a.meta.label = opts.label;
      canvas.add(a);
      return a;
    },
    connect: (A, aa, B, bb) => {
      if (A && B) connections.push({ a: { id: A.meta.id, anchor: aa }, b: { id: B.meta.id, anchor: bb } });
    },
  };
}

/* ----------------------------------------------------------- thumbnails */
const _thumbCache = new Map();
export function renderThumbnail(template, w = 268, h = 172) {
  if (_thumbCache.has(template.id)) return _thumbCache.get(template.id);
  const el = typeof document !== "undefined" ? document.createElement("canvas") : undefined;
  const sc = new StaticCanvas(el, { width: w, height: h, backgroundColor: "#f8fafc", renderOnAddRemove: false });
  try {
    const api = makeApi(sc, { connections: [] });
    template.build(api);
  } catch (e) {
    console.error("[thumbnail] build failed:", template.id, e);
  }
  const objs = sc.getObjects();
  if (objs.length) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objs.forEach((o) => {
      o.setCoords();
      const r = o.getBoundingRect();
      minX = Math.min(minX, r.left);
      minY = Math.min(minY, r.top);
      maxX = Math.max(maxX, r.left + r.width);
      maxY = Math.max(maxY, r.top + r.height);
    });
    const pad = 18;
    const z = Math.min(1.25, Math.max(0.05, Math.min((w - 2 * pad) / (maxX - minX || 1), (h - 2 * pad) / (maxY - minY || 1))));
    sc.setZoom(z);
    const vpt = sc.viewportTransform;
    vpt[4] = -minX * z + (w - (maxX - minX) * z) / 2;
    vpt[5] = -minY * z + (h - (maxY - minY) * z) / 2;
    sc.setViewportTransform(vpt);
  }
  sc.renderAll();
  let url = "";
  try {
    url = sc.toDataURL({ format: "png", multiplier: 1.6 });
  } catch (e) {
    console.error("[thumbnail] export failed:", template.id, e);
  }
  sc.dispose();
  _thumbCache.set(template.id, url);
  return url;
}
