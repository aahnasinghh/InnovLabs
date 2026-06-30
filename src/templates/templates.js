/**
 * templates.js
 * -----------------------------------------------------------------------------
 * 30 common wet organic lab experiment setups for the InnovLabs template
 * gallery. Each entry is pure data + a `build(api)` function that composes the
 * setup from the editable apparatus factory (labKit.makeApi). Because every
 * piece is placed as its own selectable object, the loaded setup is fully
 * editable: click any flask / beaker / arrow / label to tweak it afterwards.
 *
 * `build(api)` knows nothing about Fabric or React — it only calls the api, so
 * the SAME function renders both the live canvas and the gallery thumbnail.
 *
 * Categories + temperature/time ranges mirror common bench practice (inspired
 * by, not copied from, the reference gallery).
 * -----------------------------------------------------------------------------
 */

const ACCENT = {
  teal: "#0d9488",
  violet: "#7c3aed",
  blue: "#2563eb",
  amber: "#d97706",
  rose: "#e11d48",
  slate: "#475569",
  cyan: "#0891b2",
  green: "#16a34a",
};

/* Small composition helper: title + temp/time caption above a setup. */
function header(api, name, temp, time, cx = 320, topY = 120) {
  api.title(name, cx, topY);
  api.label(`${temp}   ·   ${time}`, cx, topY + 24, { fontSize: 13, fill: "#64748b" });
}

/* The 30 setups. Each scene is centered roughly around x = 320. */
const ITEMS = [
  /* ---------------------------------------------------- Reaction types */
  {
    no: 1,
    name: "Simple Stirred Reaction",
    category: "Reaction",
    temp: "25 °C",
    time: "1–24 h",
    build: (api) => {
      header(api, "Simple Stirred Reaction", "25 °C", "1–24 h");
      api.prop("hotplate", 320, 380);
      api.app("beaker", 320, 312, { level: 0.5, temp: "25 °C", time: "1–24 h", label: "Reaction Beaker" });
      api.label("magnetic stir bar", 320, 352, { fontSize: 11 });
    },
  },
  {
    no: 2,
    name: "Reflux Reaction",
    category: "Reaction",
    temp: "80 °C",
    time: "2–24 h",
    build: (api) => {
      header(api, "Reflux Reaction", "80 °C", "2–24 h");
      api.prop("stand", 150, 250, { clamps: [110, -20] });
      api.prop("hotplate", 330, 412);
      api.prop("bath", 330, 360, { accent: "rgba(56,189,248,0.4)" });
      api.app("roundFlask", 330, 338, { level: 0.5, temp: "80 °C", time: "2–24 h", label: "Reaction Flask" });
      api.prop("condenser", 330, 200);
      api.arrow(420, 232, 60, 0, { color: "#38bdf8", label: "Water out" });
      api.label("water out", 470, 232, { fontSize: 11 });
      api.arrow(420, 300, 60, 180, { color: "#38bdf8", label: "Water in" });
      api.label("water in", 470, 300, { fontSize: 11 });
    },
  },
  {
    no: 3,
    name: "Cryogenic Reaction",
    category: "Reaction",
    temp: "−78 to 0 °C",
    time: "1–12 h",
    build: (api) => {
      header(api, "Cryogenic Reaction", "−78 to 0 °C", "1–12 h");
      api.prop("stand", 150, 250, { clamps: [120] });
      api.prop("bath", 330, 370, { accent: "#e0f2fe", ice: true, label: "Dry ice / acetone" });
      api.app("roundFlask", 330, 320, { level: 0.4, liquidColor: "#93c5fd", temp: "−78 °C", time: "1–12 h", label: "Reaction Flask" });
      api.prop("thermometer", 268, 300);
      api.label("low-temp bath", 330, 420, { fontSize: 11 });
    },
  },
  {
    no: 4,
    name: "Nitrogen Atmosphere Reaction",
    category: "Reaction",
    temp: "25–120 °C",
    time: "1–24 h",
    build: (api) => {
      header(api, "Nitrogen Atmosphere Reaction", "25–120 °C", "1–24 h");
      api.prop("stand", 160, 250, { clamps: [120] });
      api.prop("hotplate", 330, 412);
      api.app("roundFlask", 330, 338, { level: 0.45, temp: "25–120 °C", time: "1–24 h", label: "Reaction Flask" });
      api.prop("balloon", 330, 175, { label: "N₂", accent: "#bfdbfe" });
      api.pipe(330, 222, 330, 285);
    },
  },
  {
    no: 5,
    name: "Schlenk Line Reaction",
    category: "Reaction",
    temp: "25–120 °C",
    time: "1–24 h",
    build: (api) => {
      header(api, "Schlenk Line Reaction", "25–120 °C", "1–24 h", 330, 110);
      api.box("Schlenk Manifold  (vacuum / N₂)", 330, 200, { w: 330, h: 64, accent: ACCENT.slate });
      api.prop("hotplate", 250, 420);
      api.app("roundFlask", 250, 348, { level: 0.45, temp: "25–120 °C", time: "1–24 h", label: "Schlenk Flask" });
      api.app("roundFlask", 430, 360, { level: 0.3, label: "Schlenk Flask" });
      api.pipe(250, 232, 250, 300);
      api.pipe(430, 232, 430, 312);
      api.prop("balloon", 430, 270, { label: "N₂", accent: "#bfdbfe" });
    },
  },
  {
    no: 6,
    name: "High Pressure Reaction",
    category: "Reaction",
    temp: "Up to 100 bar",
    time: "1–24 h",
    build: (api) => {
      header(api, "High Pressure Reaction", "Up to 100 bar", "1–24 h");
      api.box("Autoclave / Pressure Reactor", 320, 340, { w: 210, h: 150, accent: ACCENT.slate, screen: true });
      api.box("0–100 bar", 470, 250, { w: 96, h: 64, accent: ACCENT.rose });
      api.pipe(415, 280, 365, 300);
      api.prop("hotplate", 320, 440);
    },
  },
  {
    no: 7,
    name: "Microwave Assisted Reaction",
    category: "Reaction",
    temp: "80–180 °C",
    time: "5–60 min",
    build: (api) => {
      header(api, "Microwave Assisted Reaction", "80–180 °C", "5–60 min");
      api.box("Microwave Reactor", 320, 350, { w: 220, h: 150, accent: ACCENT.amber, screen: true });
      api.app("vial", 320, 232, { level: 0.5, temp: "80–180 °C", time: "5–60 min", label: "Sealed Vial" });
    },
  },
  {
    no: 8,
    name: "Photochemistry Reaction",
    category: "Reaction",
    temp: "25–40 °C",
    time: "0.5–24 h",
    build: (api) => {
      header(api, "Photochemistry Reaction", "25–40 °C", "0.5–24 h");
      api.box("UV Light Source", 320, 185, { w: 190, h: 56, accent: ACCENT.violet });
      [-40, 0, 40].forEach((dx) => api.arrow(320 + dx, 255, 44, 90, { color: "#a78bfa" }));
      api.prop("hotplate", 320, 412);
      api.app("roundFlask", 320, 338, { level: 0.5, liquidColor: "#c4b5fd", temp: "25–40 °C", time: "0.5–24 h", label: "Photoreactor Flask" });
    },
  },
  {
    no: 9,
    name: "Flow Chemistry Setup",
    category: "Reaction",
    temp: "25–120 °C",
    time: "Continuous",
    build: (api) => {
      header(api, "Flow Chemistry Setup", "25–120 °C", "Continuous", 330, 110);
      api.box("Pump A", 130, 250, { w: 96, h: 70, accent: ACCENT.blue });
      api.box("Pump B", 130, 350, { w: 96, h: 70, accent: ACCENT.cyan });
      api.box("Heated Reactor Coil", 330, 300, { w: 150, h: 150, accent: ACCENT.amber, screen: true });
      api.arrow(205, 262, 70, 0, { color: ACCENT.slate });
      api.arrow(205, 338, 70, 0, { color: ACCENT.slate });
      api.arrow(420, 300, 70, 0, { color: ACCENT.slate });
      api.app("vial", 530, 320, { level: 0.5, label: "Collection", temp: "25–120 °C", time: "Continuous" });
    },
  },
  {
    no: 10,
    name: "Electrochemistry Cell Setup",
    category: "Reaction",
    temp: "RT–80 °C",
    time: "1–24 h",
    build: (api) => {
      header(api, "Electrochemistry Cell Setup", "RT–80 °C", "1–24 h");
      api.app("beaker", 300, 340, { level: 0.6, liquidColor: "#67e8f9", temp: "RT–80 °C", time: "1–24 h", label: "Electrolysis Cell" });
      api.prop("rod", 278, 300, { label: "Cathode", accent: "#9ca3af" });
      api.prop("rod", 322, 300, { label: "Anode", accent: "#374151" });
      api.box("Potentiostat", 480, 300, { w: 150, h: 96, accent: ACCENT.green, screen: true });
      api.arrow(405, 285, 60, 180, { color: ACCENT.slate });
    },
  },
  {
    no: 11,
    name: "Sonochemistry Reaction",
    category: "Reaction",
    temp: "20–60 °C",
    time: "0.5–6 h",
    build: (api) => {
      header(api, "Sonochemistry Reaction", "20–60 °C", "0.5–6 h");
      api.box("Ultrasonic Bath", 320, 380, { w: 220, h: 96, accent: ACCENT.cyan });
      api.app("roundFlask", 320, 312, { level: 0.5, temp: "20–60 °C", time: "0.5–6 h", label: "Reaction Flask" });
      api.label("∿ ∿ ∿  ultrasound  ∿ ∿ ∿", 320, 348, { fontSize: 11, fill: "#0891b2" });
    },
  },
  {
    no: 12,
    name: "UV / Ozone Oxidation",
    category: "Reaction",
    temp: "20–60 °C",
    time: "0.5–6 h",
    build: (api) => {
      header(api, "UV / Ozone Oxidation", "20–60 °C", "0.5–6 h", 330, 110);
      api.box("Ozone Generator", 150, 330, { w: 150, h: 90, accent: ACCENT.blue, screen: true });
      api.app("beaker", 380, 348, { level: 0.55, liquidColor: "#a5b4fc", temp: "20–60 °C", time: "0.5–6 h", label: "Oxidation Vessel" });
      api.box("UV", 380, 210, { w: 110, h: 46, accent: ACCENT.violet });
      api.arrow(232, 322, 90, 0, { color: ACCENT.slate, label: "O₃" });
      api.label("O₃", 300, 308, { fontSize: 11 });
    },
  },

  /* ---------------------------------------------------- Separation */
  {
    no: 13,
    name: "Distillation (Atmospheric)",
    category: "Separation",
    temp: "80–200 °C",
    time: "1–12 h",
    build: (api) => {
      header(api, "Distillation (Atmospheric)", "80–200 °C", "1–12 h", 330, 100);
      api.prop("stand", 130, 250, { clamps: [120] });
      api.prop("hotplate", 250, 430);
      api.app("roundFlask", 250, 356, { level: 0.5, temp: "80–200 °C", time: "1–12 h", label: "Distillation Flask" });
      api.prop("thermometer", 250, 250);
      const cond = api.prop("condenser", 380, 300);
      cond.rotate(52);
      api.app("erlenmeyer", 470, 372, { level: 0.25, label: "Receiving Flask" });
      api.label("distillate", 470, 430, { fontSize: 11 });
    },
  },
  {
    no: 14,
    name: "Fractional Distillation",
    category: "Separation",
    temp: "80–200 °C",
    time: "1–12 h",
    build: (api) => {
      header(api, "Fractional Distillation", "80–200 °C", "1–12 h", 330, 90);
      api.prop("stand", 120, 250, { clamps: [120] });
      api.prop("hotplate", 250, 440);
      api.app("roundFlask", 250, 366, { level: 0.5, temp: "80–200 °C", time: "1–12 h", label: "Pot Flask" });
      api.app("column", 250, 230, { level: 0.15, label: "Fractionating Column" });
      api.prop("thermometer", 250, 150);
      const cond = api.prop("condenser", 380, 250);
      cond.rotate(52);
      api.app("erlenmeyer", 470, 322, { level: 0.2, label: "Receiving Flask" });
    },
  },
  {
    no: 15,
    name: "Vacuum Distillation (Short Path)",
    category: "Separation",
    temp: "40–150 °C",
    time: "1–8 h",
    build: (api) => {
      header(api, "Vacuum Distillation (Short Path)", "40–150 °C", "1–8 h", 330, 100);
      api.prop("hotplate", 220, 430);
      api.app("roundFlask", 220, 356, { level: 0.5, temp: "40–150 °C", time: "1–8 h", label: "Boiling Flask" });
      const cond = api.prop("condenser", 340, 300);
      cond.rotate(58);
      api.app("roundFlask", 440, 360, { level: 0.2, label: "Receiver" });
      api.box("Vacuum Pump", 530, 300, { w: 120, h: 80, accent: ACCENT.slate, screen: true });
      api.arrow(470, 300, 40, 0, { color: ACCENT.slate, label: "to vacuum" });
    },
  },
  {
    no: 16,
    name: "Liquid–Liquid Extraction",
    category: "Separation",
    temp: "25 °C",
    time: "0.5–2 h",
    build: (api) => {
      header(api, "Liquid–Liquid Extraction", "25 °C", "0.5–2 h");
      api.prop("stand", 180, 250, { clamps: [70], ring: 90 });
      api.app("sepFunnel", 330, 290, { level: 0.65, liquidColor: "#fbbf24", temp: "25 °C", time: "0.5–2 h", label: "Separatory Funnel" });
      api.app("beaker", 330, 412, { level: 0.4, liquidColor: "#a5b4fc", label: "Collection Beaker" });
      api.label("two immiscible layers", 430, 290, { fontSize: 11 });
    },
  },
  {
    no: 17,
    name: "Solid–Liquid Extraction (Soxhlet)",
    category: "Separation",
    temp: "25–40 °C",
    time: "1–12 h",
    build: (api) => {
      header(api, "Solid–Liquid Extraction", "25–40 °C", "1–12 h", 330, 90);
      api.prop("stand", 150, 250, { clamps: [60, 160] });
      api.prop("condenser", 330, 175);
      api.app("column", 330, 300, { level: 0.3, label: "Soxhlet Body" });
      api.app("roundFlask", 330, 412, { level: 0.5, temp: "25–40 °C", time: "1–12 h", label: "Solvent Flask" });
      api.prop("hotplate", 330, 470);
    },
  },

  /* ---------------------------------------------------- Purification */
  {
    no: 18,
    name: "Column Chromatography",
    category: "Purification",
    temp: "25 °C",
    time: "1–12 h",
    build: (api) => {
      header(api, "Column Chromatography", "25 °C", "1–12 h");
      api.prop("stand", 180, 250, { clamps: [60, 170] });
      api.app("column", 330, 300, { level: 0.4, liquidColor: "#86efac", temp: "25 °C", time: "1–12 h", label: "Silica Column" });
      api.app("beaker", 330, 432, { level: 0.3, label: "Fraction" });
    },
  },
  {
    no: 19,
    name: "Flash Column Chromatography",
    category: "Purification",
    temp: "25 °C",
    time: "1–6 h",
    build: (api) => {
      header(api, "Flash Column Chromatography", "25 °C", "1–6 h");
      api.prop("stand", 180, 250, { clamps: [60, 170] });
      api.app("column", 330, 305, { level: 0.4, liquidColor: "#86efac", temp: "25 °C", time: "1–6 h", label: "Flash Column" });
      api.prop("balloon", 330, 175, { label: "N₂", accent: "#bfdbfe" });
      api.pipe(330, 205, 330, 218);
      api.app("beaker", 330, 437, { level: 0.3, label: "Fraction" });
    },
  },
  {
    no: 20,
    name: "Preparative HPLC",
    category: "Purification",
    temp: "25 °C",
    time: "1–8 h",
    build: (api) => {
      header(api, "Preparative HPLC", "25 °C", "1–8 h", 330, 100);
      api.box("Preparative HPLC System", 330, 280, { w: 250, h: 150, accent: ACCENT.teal, screen: true });
      api.app("bottle", 150, 300, { level: 0.6, liquidColor: "#93c5fd", label: "Mobile Phase A" });
      api.arrow(205, 300, 60, 0, { color: ACCENT.slate });
      [430, 480, 530].forEach((x) => api.app("testTube", x, 420, { level: 0.4, label: "Fraction" }));
      api.label("fraction collector", 480, 470, { fontSize: 11 });
      api.arrow(330, 372, 50, 90, { color: ACCENT.slate });
    },
  },
  {
    no: 21,
    name: "Crystallization (Cooling)",
    category: "Purification",
    temp: "0–25 °C",
    time: "1–72 h",
    build: (api) => {
      header(api, "Crystallization (Cooling)", "0–25 °C", "1–72 h");
      api.prop("bath", 320, 380, { accent: "#e0f2fe", ice: true, label: "Ice bath" });
      api.app("beaker", 320, 312, { level: 0.5, liquidColor: "#a5b4fc", temp: "0–25 °C", time: "1–72 h", label: "Crystallizing Solution" });
      api.label("slow cooling → crystals", 320, 352, { fontSize: 11 });
    },
  },
  {
    no: 22,
    name: "Recrystallization",
    category: "Purification",
    temp: "60–90 °C",
    time: "1–6 h",
    build: (api) => {
      header(api, "Recrystallization", "60–90 °C", "1–6 h");
      api.prop("hotplate", 320, 412);
      api.app("erlenmeyer", 320, 332, { level: 0.5, liquidColor: "#fcd34d", temp: "60–90 °C", time: "1–6 h", label: "Hot Solution" });
      api.label("dissolve hot · cool slow", 320, 392, { fontSize: 11 });
    },
  },
  {
    no: 23,
    name: "Vacuum Filtration",
    category: "Purification",
    temp: "25 °C",
    time: "0.5–2 h",
    build: (api) => {
      header(api, "Vacuum Filtration", "25 °C", "0.5–2 h", 320, 110);
      api.prop("funnel", 320, 268);
      api.app("filterFlask", 320, 372, { level: 0.3, temp: "25 °C", time: "0.5–2 h", label: "Filter Flask" });
      api.box("Vacuum Pump", 500, 360, { w: 120, h: 80, accent: ACCENT.slate, screen: true });
      api.pipe(360, 348, 440, 352);
      api.label("Büchner funnel", 410, 250, { fontSize: 11 });
    },
  },
  {
    no: 24,
    name: "Drying (Vacuum Oven)",
    category: "Purification",
    temp: "40–80 °C",
    time: "2–24 h",
    build: (api) => {
      header(api, "Drying (Vacuum Oven)", "40–80 °C", "2–24 h");
      api.box("Vacuum Drying Oven", 320, 330, { w: 220, h: 150, accent: ACCENT.amber, screen: true });
      api.app("vial", 290, 360, { level: 0.3, label: "Sample" });
      api.app("vial", 350, 360, { level: 0.25, label: "Sample" });
      api.arrow(440, 300, 50, 0, { color: ACCENT.slate, label: "to vacuum" });
    },
  },

  /* ---------------------------------------------------- Technique / Workup */
  {
    no: 25,
    name: "Inert Transfer (Cannula)",
    category: "Technique",
    temp: "25 °C",
    time: "As needed",
    build: (api) => {
      header(api, "Inert Transfer (Cannula)", "25 °C", "As needed", 330, 110);
      api.app("roundFlask", 220, 340, { level: 0.5, temp: "25 °C", time: "As needed", label: "Source Flask" });
      api.app("roundFlask", 440, 340, { level: 0.2, label: "Receiving Flask" });
      api.prop("balloon", 220, 200, { label: "N₂", accent: "#bfdbfe" });
      api.prop("balloon", 440, 200, { label: "N₂", accent: "#bfdbfe" });
      api.pipe(220, 250, 440, 250);
      api.label("cannula", 330, 232, { fontSize: 11 });
    },
  },
  {
    no: 26,
    name: "Quenching Reaction",
    category: "Workup",
    temp: "0–25 °C",
    time: "0.25–2 h",
    build: (api) => {
      header(api, "Quenching Reaction", "0–25 °C", "0.25–2 h");
      api.prop("stand", 170, 250, { clamps: [70] });
      api.app("sepFunnel", 330, 250, { level: 0.5, liquidColor: "#93c5fd", label: "Quench (dropping funnel)" });
      api.prop("bath", 330, 412, { accent: "#e0f2fe", ice: true, label: "Ice bath" });
      api.app("roundFlask", 330, 352, { level: 0.45, temp: "0–25 °C", time: "0.25–2 h", label: "Reaction Flask" });
      api.arrow(330, 312, 34, 90, { color: ACCENT.blue });
    },
  },
  {
    no: 27,
    name: "pH Adjustment",
    category: "Workup",
    temp: "25 °C",
    time: "0.25–3 h",
    build: (api) => {
      header(api, "pH Adjustment", "25 °C", "0.25–3 h");
      api.prop("hotplate", 300, 412);
      api.app("beaker", 300, 338, { level: 0.6, liquidColor: "#fca5a5", temp: "25 °C", time: "0.25–3 h", label: "Solution" });
      api.prop("rod", 300, 305, { label: "pH probe", accent: "#9ca3af", h: 120 });
      api.box("pH Meter", 480, 300, { w: 140, h: 90, accent: ACCENT.green, screen: true });
      api.arrow(405, 290, 60, 180, { color: ACCENT.slate });
    },
  },
  {
    no: 28,
    name: "Concentration (Rotary Evaporation)",
    category: "Workup",
    temp: "30–80 °C",
    time: "0.5–6 h",
    build: (api) => {
      header(api, "Concentration (Rotary Evaporation)", "30–80 °C", "0.5–6 h", 330, 90);
      api.box("Rotary Evaporator Drive", 440, 230, { w: 150, h: 70, accent: ACCENT.teal });
      api.prop("bath", 300, 430, { accent: "rgba(56,189,248,0.4)", label: "Water bath" });
      const flask = api.app("roundFlask", 280, 358, { level: 0.5, temp: "30–80 °C", time: "0.5–6 h", label: "Evaporation Flask" });
      flask.rotate(-22);
      const cond = api.prop("condenser", 390, 300);
      cond.rotate(38);
      api.app("roundFlask", 470, 360, { level: 0.2, label: "Receiving Flask" });
    },
  },

  /* ---------------------------------------------------- General */
  {
    no: 29,
    name: "Lyophilization (Freeze Drying)",
    category: "General",
    temp: "−50 to 25 °C",
    time: "6–48 h",
    build: (api) => {
      header(api, "Lyophilization (Freeze Drying)", "−50 to 25 °C", "6–48 h", 330, 110);
      api.box("Freeze Dryer", 320, 350, { w: 230, h: 150, accent: ACCENT.cyan, screen: true });
      api.app("roundFlask", 320, 235, { level: 0.35, liquidColor: "#bae6fd", temp: "−50 °C", time: "6–48 h", label: "Frozen Sample Flask" });
      api.arrow(450, 320, 50, 0, { color: ACCENT.slate, label: "to vacuum" });
    },
  },
  {
    no: 30,
    name: "Storage & Sample Prep",
    category: "General",
    temp: "2–8 °C",
    time: "As needed",
    build: (api) => {
      header(api, "Storage & Sample Prep", "2–8 °C", "As needed");
      api.box("Sample Storage  2–8 °C", 320, 300, { w: 200, h: 170, accent: ACCENT.blue, screen: true });
      [270, 320, 370].forEach((x) => api.app("vial", x, 400, { level: 0.45, label: "Sample Vial", temp: "2–8 °C", time: "As needed" }));
      api.label("labeled vials", 320, 450, { fontSize: 11 });
    },
  },
];

/* Attach a stable id to each template (used for thumbnail cache + keys). */
ITEMS.forEach((t) => {
  t.id = `tpl-${t.no}`;
});

export const TEMPLATES = ITEMS;

/* Grouped by category (in display order) for the gallery. */
const CATEGORY_ORDER = ["Reaction", "Separation", "Purification", "Technique", "Workup", "General"];
export const TEMPLATE_GROUPS = CATEGORY_ORDER.map((category) => ({
  category,
  items: ITEMS.filter((t) => t.category === category),
})).filter((g) => g.items.length);
