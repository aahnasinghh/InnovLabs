/**
 * PipelinesCanvas.jsx
 * -----------------------------------------------------------------------------
 * InnovLabs AI — minimal, reusable pipeline canvas for the ELN.
 *
 * A SINGLE standalone React component (React + react-konva only). It is a small
 * data-pipeline builder meant to be copied/imported into the InnovLabs app
 * later and embedded inside an ELN section.
 *
 * Layout:
 *     Toolbar  →  Konva canvas (draggable nodes + arrows)  →  Inspector  →  Summary
 *
 * Deliberately minimal: no backend logic, no Run/Save, no status badges, no
 * cards. Just nodes you can add, name, drag, connect, select, and delete.
 *
 * Future integration points are marked with `// [INTEGRATION]` comments.
 *
 * Requirements:
 *     npm install konva react-konva
 *
 * Usage:
 *     import PipelinesCanvas from "./components/PipelinesCanvas";
 *     <PipelinesCanvas />
 * -----------------------------------------------------------------------------
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Group, Rect, Text, Line } from "react-konva";

/* ============================================================================
 * THEME — clean white/gray; teal accent reserved for selection + primary btn
 * ==========================================================================*/
const T = {
  bg: "#ffffff",
  panel: "#f8fafc",
  border: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  teal: "#0d9488",
  tealSoft: "#ccfbf1",
  node: "#ffffff",
  nodeText: "#334155",
  connector: "#94a3b8",
  grid: "#e2e8f0",
  shadow: "0 1px 2px rgba(15,23,42,0.06)",
};

/* ============================================================================
 * NODE GEOMETRY
 * ==========================================================================*/
const NODE_W = 132;
const NODE_H = 46;
const center = (n) => ({ x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 });

// Point on a node's border along the direction toward (tx, ty), so arrows
// touch a node's edge rather than its center.
function borderPoint(node, tx, ty) {
  const c = center(node);
  const dx = tx - c.x;
  const dy = ty - c.y;
  const hw = NODE_W / 2;
  const hh = NODE_H / 2;
  if (dx === 0 && dy === 0) return c;
  const tX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const tY = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(tX, tY);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

/* ============================================================================
 * DEFAULT GRAPH: Dataset → Process → AI Analysis → Chart → Export
 * [INTEGRATION] This seed could instead be hydrated from a saved pipeline
 * document owned by the current ELN notebook (e.g. GET /api/pipelines/:id).
 * ==========================================================================*/
const START_X = 60;
const START_Y = 70;
const GAP_X = 170;

let _id = 0;
const makeId = (p = "n") => `${p}-${++_id}`;

function makeDefault() {
  const labels = ["Dataset", "Process", "AI Analysis", "Chart", "Export"];
  const nodes = labels.map((name, i) => ({
    id: makeId(),
    name,
    x: START_X + i * GAP_X,
    y: START_Y + (i % 2 === 0 ? 0 : 70), // gentle zig-zag so it reads as a graph
  }));
  const edges = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ id: makeId("e"), from: nodes[i].id, to: nodes[i + 1].id });
  }
  return { nodes, edges };
}

/* ============================================================================
 * KONVA NODE — small rounded rectangle showing only its name.
 * ==========================================================================*/
function Node({ node, selected, pending, onSelect, onDragMove }) {
  return (
    <Group
      x={node.x}
      y={node.y}
      draggable
      onClick={() => onSelect(node.id)}
      onTap={() => onSelect(node.id)}
      onDragMove={(e) => onDragMove(node.id, e.target.x(), e.target.y())}
      onMouseEnter={(e) => {
        const s = e.target.getStage();
        if (s) s.container().style.cursor = "pointer";
      }}
      onMouseLeave={(e) => {
        const s = e.target.getStage();
        if (s) s.container().style.cursor = "default";
      }}
    >
      <Rect
        width={NODE_W}
        height={NODE_H}
        cornerRadius={10}
        fill={selected ? T.tealSoft : T.node}
        stroke={selected || pending ? T.teal : T.border}
        strokeWidth={selected || pending ? 2 : 1}
        shadowColor="rgba(15,23,42,0.16)"
        shadowBlur={selected ? 12 : 6}
        shadowOffsetY={2}
        shadowOpacity={1}
      />
      <Text
        width={NODE_W}
        height={NODE_H}
        text={node.name}
        fontSize={13}
        fontStyle="600"
        fill={selected ? T.teal : T.nodeText}
        align="center"
        verticalAlign="middle"
      />
    </Group>
  );
}

/* ============================================================================
 * KONVA EDGE — arrow between two nodes; recomputed from live positions.
 * ==========================================================================*/
function Edge({ from, to }) {
  const a = center(from);
  const b = center(to);
  const start = borderPoint(from, b.x, b.y);
  const end = borderPoint(to, a.x, a.y);

  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const h = 8;
  const spread = Math.PI / 7;
  const arrow = [
    end.x - h * Math.cos(angle - spread),
    end.y - h * Math.sin(angle - spread),
    end.x,
    end.y,
    end.x - h * Math.cos(angle + spread),
    end.y - h * Math.sin(angle + spread),
  ];

  return (
    <Group listening={false}>
      <Line points={[start.x, start.y, end.x, end.y]} stroke={T.connector} strokeWidth={1.6} lineCap="round" />
      <Line points={arrow} stroke={T.connector} strokeWidth={1.6} lineCap="round" lineJoin="round" />
    </Group>
  );
}

/* ============================================================================
 * MAIN COMPONENT
 * ==========================================================================*/
export default function PipelinesCanvas() {
  const initial = useMemo(() => makeDefault(), []);
  const [nodes, setNodes] = useState(initial.nodes);
  const [edges, setEdges] = useState(initial.edges);
  const [selectedId, setSelectedId] = useState(null);

  // Connect mode: when on, clicking two nodes wires them together.
  const [connectMode, setConnectMode] = useState(false);
  const [pendingFrom, setPendingFrom] = useState(null);

  // ---- canvas sizing (responsive width, fixed height) ----------------------
  const CANVAS_H = 460;
  const wrapRef = useRef(null);
  const [canvasW, setCanvasW] = useState(800);
  useEffect(() => {
    const measure = () => wrapRef.current && setCanvasW(wrapRef.current.offsetWidth);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // ---- zoom / pan -----------------------------------------------------------
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const clamp = (s) => Math.min(2.5, Math.max(0.4, s));
  const zoomIn = () => setScale((s) => clamp(s + 0.15));
  const zoomOut = () => setScale((s) => clamp(s - 0.15));
  const resetView = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  };
  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const old = scale;
    const p = stage.getPointerPosition();
    const to = { x: (p.x - pos.x) / old, y: (p.y - pos.y) / old };
    const ns = clamp(old + (e.evt.deltaY > 0 ? -1 : 1) * 0.08);
    setScale(ns);
    setPos({ x: p.x - to.x * ns, y: p.y - to.y * ns });
  };

  // ---- node selection / connect handling ------------------------------------
  const onSelect = (id) => {
    if (connectMode) {
      if (!pendingFrom) {
        setPendingFrom(id);
      } else if (pendingFrom !== id) {
        addEdge(pendingFrom, id);
        setPendingFrom(null);
      } else {
        setPendingFrom(null); // clicked same node twice → cancel
      }
      return;
    }
    setSelectedId(id);
  };

  const addEdge = (from, to) => {
    setEdges((prev) => {
      const exists = prev.some((e) => e.from === from && e.to === to);
      if (exists) return prev;
      return [...prev, { id: makeId("e"), from, to }];
    });
  };

  const onDragMove = (id, x, y) =>
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));

  // ---- toolbar actions ------------------------------------------------------

  // Add a simple new node.
  // [INTEGRATION] An "Add Node" for a dataset could open the Data Hub dataset
  // picker and create a node bound to the chosen dataset id.
  const addNode = () => {
    setNodes((prev) => {
      const n = {
        id: makeId(),
        name: `Node ${prev.length + 1}`,
        x: 80 + (prev.length * 24) % 200,
        y: 240 + (prev.length * 18) % 120,
      };
      setSelectedId(n.id);
      return [...prev, n];
    });
  };

  const toggleConnect = () => {
    setConnectMode((c) => !c);
    setPendingFrom(null);
  };

  const clear = () => {
    setNodes([]);
    setEdges([]);
    setSelectedId(null);
    setPendingFrom(null);
  };

  // ---- inspector actions ----------------------------------------------------
  const deleteSelected = () => {
    if (!selectedId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedId));
    setEdges((prev) => prev.filter((e) => e.from !== selectedId && e.to !== selectedId));
    setSelectedId(null);
  };

  const renameSelected = (value) =>
    setNodes((prev) => prev.map((n) => (n.id === selectedId ? { ...n, name: value } : n)));

  /*
   * [INTEGRATION] Persistence + execution would hook in around here:
   *   - Backend save API: serialize { nodes, edges } and PUT /api/pipelines/:id.
   *   - Dagster execution: trigger a run for this graph (POST /api/pipelines/:id/run)
   *     and map node ids → Dagster ops/assets.
   *   - Data Hub: resolve dataset-backed nodes to real dataset references.
   * Intentionally omitted for this minimal prototype.
   */

  // ---- derived --------------------------------------------------------------
  const nameOf = (id) => (nodes.find((n) => n.id === id) || {}).name || "—";
  const selected = nodes.find((n) => n.id === selectedId) || null;

  const connectedNames = selected
    ? [
        ...edges.filter((e) => e.from === selected.id).map((e) => `→ ${nameOf(e.to)}`),
        ...edges.filter((e) => e.to === selected.id).map((e) => `← ${nameOf(e.from)}`),
      ]
    : [];

  const resolvedEdges = edges
    .map((e) => {
      const from = nodes.find((n) => n.id === e.from);
      const to = nodes.find((n) => n.id === e.to);
      return from && to ? { ...e, from, to } : null;
    })
    .filter(Boolean);

  const onStageMouseDown = (e) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
      setPendingFrom(null);
    }
  };

  /* ============================================================ render */
  return (
    <section style={styles.section}>
      {/* ------------------------------------------------ toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.group}>
          <Btn variant="primary" onClick={addNode}>
            Add Node
          </Btn>
          <Btn variant={connectMode ? "primary" : "default"} onClick={toggleConnect}>
            Connect Mode
          </Btn>
          <Btn variant="ghost" onClick={clear} disabled={!nodes.length}>
            Clear
          </Btn>
        </div>
        <div style={styles.group}>
          <Btn onClick={zoomOut}>−</Btn>
          <span style={styles.zoomLabel}>{Math.round(scale * 100)}%</span>
          <Btn onClick={zoomIn}>+</Btn>
          <Btn onClick={resetView}>Reset View</Btn>
        </div>
      </div>

      {/* connect-mode hint */}
      {connectMode && (
        <div style={styles.connectHint}>
          Connect mode: click a source node, then a target node to draw an arrow.
          {pendingFrom ? ` Source: ${nameOf(pendingFrom)}` : ""}
        </div>
      )}

      {/* ------------------------------------------------ body: canvas + inspector */}
      <div style={styles.body}>
        <div
          ref={wrapRef}
          style={{
            ...styles.canvas,
            height: CANVAS_H,
            backgroundImage: `radial-gradient(${T.grid} 1.2px, transparent 1.2px)`,
            backgroundSize: "18px 18px",
          }}
        >
          <Stage
            width={canvasW}
            height={CANVAS_H}
            scaleX={scale}
            scaleY={scale}
            x={pos.x}
            y={pos.y}
            draggable
            onWheel={handleWheel}
            onMouseDown={onStageMouseDown}
            onDragEnd={(e) => {
              if (e.target === e.target.getStage()) setPos({ x: e.target.x(), y: e.target.y() });
            }}
          >
            <Layer>
              {resolvedEdges.map((e) => (
                <Edge key={e.id} from={e.from} to={e.to} />
              ))}
            </Layer>
            <Layer>
              {nodes.map((n) => (
                <Node
                  key={n.id}
                  node={n}
                  selected={n.id === selectedId}
                  pending={n.id === pendingFrom}
                  onSelect={onSelect}
                  onDragMove={onDragMove}
                />
              ))}
            </Layer>
          </Stage>

          {nodes.length === 0 && (
            <div style={styles.empty}>No nodes yet. Use “Add Node” to start your pipeline.</div>
          )}
        </div>

        {/* inspector */}
        <aside style={styles.inspector}>
          <div style={styles.inspectorLabel}>Inspector</div>

          {!selected && <div style={styles.inspectorEmpty}>Select a node to view its details.</div>}

          {selected && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={styles.fieldLabel}>Name</div>
                <input
                  style={styles.input}
                  value={selected.name}
                  onChange={(e) => renameSelected(e.target.value)}
                />
              </div>

              <div style={styles.row}>
                <div style={{ flex: 1 }}>
                  <div style={styles.fieldLabel}>X</div>
                  <div style={styles.fieldValue}>{Math.round(selected.x)}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.fieldLabel}>Y</div>
                  <div style={styles.fieldValue}>{Math.round(selected.y)}</div>
                </div>
              </div>

              <div>
                <div style={styles.fieldLabel}>Connected nodes</div>
                {connectedNames.length === 0 ? (
                  <div style={styles.muted}>No connections</div>
                ) : (
                  <ul style={styles.connList}>
                    {connectedNames.map((c, i) => (
                      <li key={i} style={styles.connItem}>
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div style={styles.divider} />

              <button style={{ ...styles.actionBtn, ...styles.danger }} onClick={deleteSelected}>
                Delete Selected
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* ------------------------------------------------ summary */}
      <div style={styles.summary}>
        <Stat label="Nodes" value={nodes.length} />
        <Stat label="Connections" value={edges.length} />
        <Stat label="Selected" value={selected ? selected.name : "None"} />
        <Stat label="Mode" value={connectMode ? "Connect" : "Edit"} />
      </div>
    </section>
  );
}

/* ============================================================================
 * SMALL HTML SUBCOMPONENTS
 * ==========================================================================*/
function Btn({ children, onClick, variant = "default", disabled }) {
  const variants = {
    default: { background: "#fff", color: T.text, border: `1px solid ${T.border}` },
    primary: { background: T.teal, color: "#fff", border: `1px solid ${T.teal}` },
    ghost: { background: "transparent", color: T.muted, border: `1px solid ${T.border}` },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles.btn,
        ...variants[variant],
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

/* ============================================================================
 * STYLES (inline objects — keeps the component fully self-contained)
 * ==========================================================================*/
const styles = {
  section: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    padding: 16,
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: T.text,
    boxShadow: T.shadow,
  },

  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
    marginBottom: 10,
  },
  group: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 },
  btn: {
    padding: "7px 12px",
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 600,
    whiteSpace: "nowrap",
    minWidth: 30,
  },
  zoomLabel: { fontSize: 12, fontWeight: 700, color: T.muted, minWidth: 40, textAlign: "center" },

  connectHint: {
    fontSize: 12,
    color: T.teal,
    background: T.tealSoft,
    border: "1px solid #99f6e4",
    borderRadius: 8,
    padding: "6px 10px",
    marginBottom: 10,
  },

  body: { display: "flex", gap: 12, alignItems: "stretch" },

  canvas: {
    position: "relative",
    flex: 1,
    minWidth: 0,
    background: T.panel,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    overflow: "hidden",
  },
  empty: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: T.muted,
    fontSize: 13,
    pointerEvents: "none",
  },

  inspector: {
    width: 250,
    flexShrink: 0,
    background: T.panel,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: 14,
    overflowY: "auto",
  },
  inspectorLabel: {
    fontSize: 10.5,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: T.muted,
    marginBottom: 12,
  },
  inspectorEmpty: { fontSize: 12.5, color: T.muted, lineHeight: 1.5 },

  fieldLabel: {
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: T.muted,
    marginBottom: 4,
  },
  fieldValue: { fontSize: 13, color: T.text },
  muted: { fontSize: 12.5, color: T.muted },
  row: { display: "flex", gap: 10 },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "7px 9px",
    borderRadius: 8,
    border: `1px solid ${T.border}`,
    fontSize: 13,
    color: T.text,
    outline: "none",
  },

  connList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 },
  connItem: {
    fontSize: 12.5,
    color: T.text,
    background: "#fff",
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    padding: "4px 8px",
  },

  divider: { height: 1, background: T.border },

  actionBtn: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  danger: { background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" },

  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
    marginTop: 12,
  },
  stat: {
    background: T.panel,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "8px 12px",
    textAlign: "center",
    overflow: "hidden",
  },
  statValue: {
    fontSize: 16,
    fontWeight: 800,
    color: T.text,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  statLabel: { fontSize: 11, color: T.muted, marginTop: 2 },
};
