/**
 * ELNWorkflowCanvas.jsx
 * -----------------------------------------------------------------------------
 * InnovLabs AI — ELN Workflow Canvas (UI prototype)
 *
 * A canvas-based, drag-and-drop workflow builder for visually composing
 * Electronic Lab Notebook (ELN) / research process flows, data pipelines,
 * and AI analysis chains. Inspired by Konva examples, Chemflow.ai, and
 * Dagster-style pipeline graphs.
 *
 * This is a self-contained, front-end-only prototype. It is NOT wired to a
 * backend. Throughout the file you'll find comments marked:
 *
 *     // [BACKEND] ...
 *
 * highlighting where this canvas would later connect to InnovLabs APIs,
 * dashboard data, or persistence layers.
 *
 * Requirements:
 *     npm install konva react-konva
 *
 * Usage:
 *     import ELNWorkflowCanvas from "./ELNWorkflowCanvas";
 *     <ELNWorkflowCanvas />
 *
 * No TypeScript. No external CSS files. Styling is done with inline styles
 * (for the HTML chrome) and Konva props (for the canvas).
 * -----------------------------------------------------------------------------
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Group,
  Rect,
  Text,
  Line,
  Circle,
} from "react-konva";

/* ============================================================================
 * THEME — InnovLabs-like palette
 * teal / cyan accents · white cards · light gray background · dark text
 * ==========================================================================*/
const THEME = {
  bg: "#f1f5f9", // light gray app background
  canvasBg: "#f8fafc", // slightly lighter canvas surface
  card: "#ffffff", // white cards
  cardBorder: "#e2e8f0",
  cardBorderActive: "#06b6d4", // cyan accent for selected node
  text: "#0f172a", // dark text
  textMuted: "#64748b", // muted subtitle text
  accent: "#0d9488", // teal
  accentLight: "#ccfbf1", // teal tint
  cyan: "#06b6d4",
  cyanDark: "#0e7490",
  connector: "#94a3b8", // connector line gray
  shadow: "rgba(15, 23, 42, 0.12)",
};

// Status badge color map. Mirrors the lifecycle of a typical ELN step.
const STATUS_STYLES = {
  Draft: { bg: "#f1f5f9", fg: "#475569" },
  Ready: { bg: "#ccfbf1", fg: "#0f766e" },
  Running: { bg: "#cffafe", fg: "#0e7490" },
  Complete: { bg: "#dcfce7", fg: "#166534" },
};

const STATUS_CYCLE = ["Draft", "Ready", "Running", "Complete"];

/* ============================================================================
 * NODE TYPE CATALOG
 * Each "type" defines the look + default copy for nodes added to the canvas.
 * [BACKEND] In production, this catalog could be served from an InnovLabs
 * "workflow step registry" endpoint so admins can define custom step types.
 * ==========================================================================*/
const NODE_TYPES = {
  protocol: {
    label: "Protocol Design",
    subtitle: "Define experiment steps",
    icon: "🧪",
    accent: "#0d9488",
    description:
      "Author and version the experimental protocol. Capture steps, parameters, and safety notes in a reusable template.",
    action: "Reduce manual entry by using saved templates.",
  },
  data: {
    label: "Data Capture",
    subtitle: "Record instrument output",
    icon: "📥",
    accent: "#0891b2",
    description:
      "Ingest readings, files, and instrument exports tied to each protocol run for a complete audit trail.",
    action: "Auto-connect uploaded datasets to analysis workflows.",
  },
  materials: {
    label: "Materials & Reagents",
    subtitle: "Track inventory & lots",
    icon: "⚗️",
    accent: "#7c3aed",
    description:
      "Link reagents, lot numbers, and quantities consumed so every result is traceable to its inputs.",
    action: "Flag low-stock reagents before a run begins.",
  },
  sample: {
    label: "Sample Tracking",
    subtitle: "Chain of custody",
    icon: "🧬",
    accent: "#db2777",
    description:
      "Follow samples through prep, storage, and analysis with barcodes and location history.",
    action: "Scan-to-update sample location with one click.",
  },
  analysis: {
    label: "AI Analysis",
    subtitle: "Model-assisted insights",
    icon: "🤖",
    accent: "#06b6d4",
    description:
      "Run AI models over captured data to surface trends, anomalies, and suggested next experiments.",
    action: "Auto-connect uploaded datasets to analysis workflows.",
  },
  chart: {
    label: "Chart Generation",
    subtitle: "Visualize results",
    icon: "📊",
    accent: "#2563eb",
    description:
      "Turn completed analyses into publication-ready charts without manual spreadsheet wrangling.",
    action: "Generate charts directly from completed analysis.",
  },
  review: {
    label: "Review & Sign",
    subtitle: "Approve & witness",
    icon: "✍️",
    accent: "#ca8a04",
    description:
      "Route results for review, e-signature, and witnessing to meet compliance requirements.",
    action: "Notify reviewers automatically when a step completes.",
  },
  report: {
    label: "Report Export",
    subtitle: "Share & archive",
    icon: "📄",
    accent: "#475569",
    description:
      "Compile the full workflow into a shareable, archive-ready report or dashboard entry.",
    action: "Export to PDF and push a summary to the InnovLabs dashboard.",
  },
};

/* ============================================================================
 * NODE GEOMETRY
 * ==========================================================================*/
const NODE_W = 200;
const NODE_H = 96;

// Anchor points on a node used to attach connectors.
const rightAnchor = (n) => ({ x: n.x + NODE_W, y: n.y + NODE_H / 2 });
const leftAnchor = (n) => ({ x: n.x, y: n.y + NODE_H / 2 });

/* ============================================================================
 * DEFAULT WORKFLOW
 * A left-to-right starter flow so the canvas is useful immediately:
 *   Protocol Design → Data Capture → AI Analysis → Chart Generation → Report Export
 * [BACKEND] This seed would instead be hydrated from a saved workflow document
 * (e.g. GET /api/workflows/:id) belonging to the current notebook/experiment.
 * ==========================================================================*/
const START_X = 60;
const START_Y = 220;
const GAP_X = 260;

function makeDefaultNodes() {
  const seed = [
    { type: "protocol", status: "Complete" },
    { type: "data", status: "Complete" },
    { type: "analysis", status: "Running" },
    { type: "chart", status: "Ready" },
    { type: "report", status: "Draft" },
  ];
  return seed.map((s, i) => ({
    id: `node-${i + 1}`,
    type: s.type,
    status: s.status,
    x: START_X + i * GAP_X,
    y: START_Y,
  }));
}

// Connect each default node to the next one in sequence.
function makeDefaultEdges(nodes) {
  const edges = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ id: `edge-${i}`, from: nodes[i].id, to: nodes[i + 1].id });
  }
  return edges;
}

let idCounter = 100; // simple client-side id generator for new nodes
const nextId = () => `node-${idCounter++}`;

/* ============================================================================
 * WorkflowNode — a single Konva card
 * Rendered entirely with Konva primitives (no HTML) so it lives on the canvas
 * and can be dragged, zoomed, and panned with the stage.
 * ==========================================================================*/
function WorkflowNode({ node, selected, onDragMove, onSelect }) {
  const meta = NODE_TYPES[node.type];
  const statusStyle = STATUS_STYLES[node.status] || STATUS_STYLES.Draft;

  return (
    <Group
      x={node.x}
      y={node.y}
      draggable
      onClick={() => onSelect(node.id)}
      onTap={() => onSelect(node.id)}
      onDragMove={(e) => onDragMove(node.id, e.target.x(), e.target.y())}
      // Subtle pointer cursor feedback on hover.
      onMouseEnter={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "pointer";
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "default";
      }}
    >
      {/* Card background with soft shadow */}
      <Rect
        width={NODE_W}
        height={NODE_H}
        cornerRadius={12}
        fill={THEME.card}
        stroke={selected ? THEME.cardBorderActive : THEME.cardBorder}
        strokeWidth={selected ? 2 : 1}
        shadowColor={THEME.shadow}
        shadowBlur={selected ? 16 : 10}
        shadowOffset={{ x: 0, y: 4 }}
        shadowOpacity={1}
      />

      {/* Left accent stripe — color-codes the node type */}
      <Rect
        width={6}
        height={NODE_H}
        cornerRadius={[12, 0, 0, 12]}
        fill={meta.accent}
      />

      {/* Icon placeholder (emoji) inside a tinted circle */}
      <Circle x={32} y={34} radius={16} fill={THEME.bg} />
      <Text
        x={16}
        y={24}
        width={32}
        align="center"
        text={meta.icon}
        fontSize={18}
      />

      {/* Title */}
      <Text
        x={56}
        y={18}
        width={NODE_W - 68}
        text={meta.label}
        fontStyle="bold"
        fontSize={14}
        fill={THEME.text}
        ellipsis
        wrap="none"
      />

      {/* Subtitle */}
      <Text
        x={56}
        y={38}
        width={NODE_W - 68}
        text={meta.subtitle}
        fontSize={11}
        fill={THEME.textMuted}
        ellipsis
        wrap="none"
      />

      {/* Status badge (bottom-left) */}
      <Group x={16} y={64}>
        <Rect
          width={statusBadgeWidth(node.status)}
          height={20}
          cornerRadius={10}
          fill={statusStyle.bg}
        />
        <Circle x={12} y={10} radius={3} fill={statusStyle.fg} />
        <Text
          x={20}
          y={5}
          text={node.status}
          fontSize={11}
          fontStyle="bold"
          fill={statusStyle.fg}
        />
      </Group>

      {/* Type tag (bottom-right) */}
      <Text
        x={NODE_W - 70}
        y={70}
        width={58}
        align="right"
        text={node.type.toUpperCase()}
        fontSize={9}
        fill={THEME.textMuted}
        letterSpacing={0.5}
      />
    </Group>
  );
}

// Rough width estimate for the pill-shaped status badge.
function statusBadgeWidth(status) {
  return 28 + status.length * 6.5;
}

/* ============================================================================
 * Connector — an elbow/curved arrow between two nodes
 * Recomputed from live node positions, so it follows nodes as they're dragged.
 * ==========================================================================*/
function Connector({ from, to }) {
  const start = rightAnchor(from);
  const end = leftAnchor(to);

  // Horizontal control offset for a smooth bezier-ish elbow.
  const dx = Math.max(40, Math.abs(end.x - start.x) / 2);

  const points = [
    start.x,
    start.y,
    start.x + dx,
    start.y,
    end.x - dx,
    end.y,
    end.x,
    end.y,
  ];

  // Arrowhead geometry at the destination anchor.
  const head = 7;
  const arrow = [
    end.x - head,
    end.y - head,
    end.x,
    end.y,
    end.x - head,
    end.y + head,
  ];

  return (
    <Group listening={false}>
      <Line
        points={points}
        stroke={THEME.connector}
        strokeWidth={2}
        bezier
        lineCap="round"
      />
      <Line points={arrow} stroke={THEME.connector} strokeWidth={2} lineCap="round" lineJoin="round" />
    </Group>
  );
}

/* ============================================================================
 * Small reusable HTML button used in the toolbars / header.
 * ==========================================================================*/
function ToolButton({ children, onClick, variant = "default", title }) {
  const base = {
    width: "100%",
    border: "1px solid " + THEME.cardBorder,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
    transition: "all 120ms ease",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };
  const variants = {
    default: { background: "#ffffff", color: THEME.text },
    primary: {
      background: THEME.accent,
      color: "#ffffff",
      border: "1px solid " + THEME.accent,
    },
    danger: { background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" },
  };
  return (
    <button
      title={title}
      onClick={onClick}
      style={{ ...base, ...variants[variant] }}
      onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.97)")}
      onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
    >
      {children}
    </button>
  );
}

/* ============================================================================
 * MAIN COMPONENT
 * ==========================================================================*/
export default function ELNWorkflowCanvas() {
  // --- Canvas data -----------------------------------------------------------
  const initialNodes = useMemo(() => makeDefaultNodes(), []);
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(() => makeDefaultEdges(initialNodes));
  const [selectedId, setSelectedId] = useState(null);

  // --- Stage size (responsive to the canvas container) -----------------------
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // --- Zoom / pan state ------------------------------------------------------
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  const clampScale = (s) => Math.min(2.5, Math.max(0.4, s));

  const zoomIn = () => setScale((s) => clampScale(s + 0.15));
  const zoomOut = () => setScale((s) => clampScale(s - 0.15));
  const resetView = () => {
    setScale(1);
    setStagePos({ x: 0, y: 0 });
  };

  // Zoom toward the pointer using the mouse wheel.
  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = clampScale(oldScale + direction * 0.08);
    setScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  // --- Node operations -------------------------------------------------------

  // Keep node coordinates in sync while dragging so connectors track live.
  const handleNodeDrag = (id, x, y) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
  };

  const handleSelect = (id) => setSelectedId(id);

  // Add a new node of a given type, auto-placed and (optionally) auto-linked
  // to the most recently added node to keep the flow readable.
  // [BACKEND] Creating a node would POST a new workflow step and return its id.
  const addNode = (type) => {
    setNodes((prev) => {
      const id = nextId();
      const last = prev[prev.length - 1];
      const x = last ? last.x + GAP_X : START_X;
      const y = last ? last.y : START_Y;
      const newNode = { id, type, status: "Draft", x, y };

      // Auto-connect from the previous node for a tidy left-to-right chain.
      if (last) {
        setEdges((e) => [
          ...e,
          { id: `edge-${id}`, from: last.id, to: id },
        ]);
      }
      setSelectedId(id);
      return [...prev, newNode];
    });
  };

  // Clear everything. [BACKEND] Would also clear/replace the persisted doc.
  const clearCanvas = () => {
    setNodes([]);
    setEdges([]);
    setSelectedId(null);
  };

  // Cycle a node's status from the inspector (Draft → Ready → Running → Complete).
  // [BACKEND] Status changes would PATCH the step and could trigger
  // downstream automations (notifications, AI runs, etc.).
  const cycleStatus = (id) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const idx = STATUS_CYCLE.indexOf(n.status);
        const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
        return { ...n, status: next };
      })
    );
  };

  const selectedNode = nodes.find((n) => n.id === selectedId) || null;
  const selectedMeta = selectedNode ? NODE_TYPES[selectedNode.type] : null;

  // Resolve edges to concrete node objects for rendering.
  const resolvedEdges = edges
    .map((edge) => {
      const from = nodes.find((n) => n.id === edge.from);
      const to = nodes.find((n) => n.id === edge.to);
      return from && to ? { ...edge, from, to } : null;
    })
    .filter(Boolean);

  // Deselect when clicking empty canvas.
  const handleStageMouseDown = (e) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  };

  /* ==========================================================================
   * RENDER
   * ========================================================================*/
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100%",
        background: THEME.bg,
        color: THEME.text,
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ---------------------------------------------------------------- HEADER */}
      <header
        style={{
          padding: "14px 24px",
          background: "#ffffff",
          borderBottom: "1px solid " + THEME.cardBorder,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* InnovLabs-style logo mark */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${THEME.cyan}, ${THEME.accent})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 20,
              fontWeight: 800,
            }}
          >
            ⚗
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              ELN Workflow Canvas
            </h1>
            <p style={{ margin: 0, fontSize: 12.5, color: THEME.textMuted }}>
              Design experiment, data, AI analysis, and reporting workflows
              visually.
            </p>
          </div>
        </div>

        {/* Zoom controls live in the header, right-aligned. */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ZoomBadge scale={scale} />
          <IconBtn title="Zoom out" onClick={zoomOut}>
            −
          </IconBtn>
          <IconBtn title="Zoom in" onClick={zoomIn}>
            +
          </IconBtn>
          <IconBtn title="Reset view" onClick={resetView} wide>
            Reset View
          </IconBtn>
        </div>
      </header>

      {/* ----------------------------------------------------------------- BODY */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* ----------------------------------------------- LEFT TOOLBAR */}
        <aside
          style={{
            width: 220,
            background: "#ffffff",
            borderRight: "1px solid " + THEME.cardBorder,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            flexShrink: 0,
            overflowY: "auto",
          }}
        >
          <SectionLabel>Add Steps</SectionLabel>
          <ToolButton variant="primary" onClick={() => addNode("protocol")}>
            🧪 Add Protocol Node
          </ToolButton>
          <ToolButton onClick={() => addNode("data")}>
            📥 Add Data Node
          </ToolButton>
          <ToolButton onClick={() => addNode("analysis")}>
            🤖 Add Analysis Node
          </ToolButton>
          <ToolButton onClick={() => addNode("chart")}>
            📊 Add Chart Node
          </ToolButton>

          <SectionLabel>More Steps</SectionLabel>
          <ToolButton onClick={() => addNode("materials")}>
            ⚗️ Materials &amp; Reagents
          </ToolButton>
          <ToolButton onClick={() => addNode("sample")}>
            🧬 Sample Tracking
          </ToolButton>
          <ToolButton onClick={() => addNode("review")}>
            ✍️ Review &amp; Sign
          </ToolButton>
          <ToolButton onClick={() => addNode("report")}>
            📄 Report Export
          </ToolButton>

          <div style={{ flex: 1 }} />

          <SectionLabel>Canvas</SectionLabel>
          <ToolButton variant="danger" onClick={clearCanvas}>
            🗑 Clear Canvas
          </ToolButton>

          {/* Tiny value-prop footer reinforcing the InnovLabs pitch. */}
          <div
            style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 8,
              background: THEME.accentLight,
              fontSize: 11,
              color: THEME.cyanDark,
              lineHeight: 1.5,
            }}
          >
            Less clutter · fewer clicks · clearer pipelines. Drag nodes to
            reorganize the flow.
          </div>
        </aside>

        {/* ------------------------------------------------- CENTER CANVAS */}
        <main
          ref={containerRef}
          style={{
            flex: 1,
            position: "relative",
            background: THEME.canvasBg,
            // Dotted grid background gives a "pipeline builder" feel.
            backgroundImage: `radial-gradient(${THEME.cardBorder} 1px, transparent 1px)`,
            backgroundSize: "22px 22px",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <Stage
            width={size.width}
            height={size.height}
            scaleX={scale}
            scaleY={scale}
            x={stagePos.x}
            y={stagePos.y}
            draggable
            onWheel={handleWheel}
            onMouseDown={handleStageMouseDown}
            onDragEnd={(e) => {
              // Persist pan offset when the user drags the empty stage.
              if (e.target === e.target.getStage()) {
                setStagePos({ x: e.target.x(), y: e.target.y() });
              }
            }}
          >
            {/* Connectors live below nodes so arrows tuck under the cards. */}
            <Layer>
              {resolvedEdges.map((edge) => (
                <Connector key={edge.id} from={edge.from} to={edge.to} />
              ))}
            </Layer>

            {/* Node cards layer */}
            <Layer>
              {nodes.map((node) => (
                <WorkflowNode
                  key={node.id}
                  node={node}
                  selected={node.id === selectedId}
                  onDragMove={handleNodeDrag}
                  onSelect={handleSelect}
                />
              ))}
            </Layer>
          </Stage>

          {/* Empty-state hint overlay */}
          {nodes.length === 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
                color: THEME.textMuted,
                fontSize: 14,
                textAlign: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🧭</div>
                Canvas is empty — add a step from the left toolbar to start
                building your workflow.
              </div>
            </div>
          )}
        </main>

        {/* ------------------------------------------- RIGHT INSPECTOR */}
        <aside
          style={{
            width: 300,
            background: "#ffffff",
            borderLeft: "1px solid " + THEME.cardBorder,
            padding: 18,
            flexShrink: 0,
            overflowY: "auto",
          }}
        >
          <SectionLabel>Inspector</SectionLabel>

          {!selectedNode && (
            <div
              style={{
                marginTop: 12,
                padding: 16,
                borderRadius: 10,
                border: "1px dashed " + THEME.cardBorder,
                color: THEME.textMuted,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Select a node on the canvas to view its details and suggested UX
              improvements.
            </div>
          )}

          {selectedNode && selectedMeta && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Title + icon */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: THEME.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                  }}
                >
                  {selectedMeta.icon}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>
                    {selectedMeta.label}
                  </div>
                  <div style={{ fontSize: 12, color: THEME.textMuted }}>
                    {selectedMeta.subtitle}
                  </div>
                </div>
              </div>

              <InspectorRow label="Node Type">
                <code
                  style={{
                    background: THEME.bg,
                    padding: "2px 8px",
                    borderRadius: 6,
                    fontSize: 12,
                    color: THEME.cyanDark,
                  }}
                >
                  {selectedNode.type}
                </code>
              </InspectorRow>

              <InspectorRow label="Status">
                <button
                  onClick={() => cycleStatus(selectedNode.id)}
                  title="Click to cycle status"
                  style={{
                    border: "none",
                    cursor: "pointer",
                    borderRadius: 20,
                    padding: "4px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    background: (STATUS_STYLES[selectedNode.status] || {}).bg,
                    color: (STATUS_STYLES[selectedNode.status] || {}).fg,
                  }}
                >
                  ● {selectedNode.status}
                </button>
              </InspectorRow>

              <div>
                <div style={subLabelStyle}>Description</div>
                <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55 }}>
                  {selectedMeta.description}
                </p>
              </div>

              {/* Suggested UX action — the heart of the "better UX" pitch. */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${THEME.accentLight}, #ecfeff)`,
                  border: "1px solid #a5f3fc",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    color: THEME.cyanDark,
                    marginBottom: 4,
                  }}
                >
                  💡 Suggested UX Action
                </div>
                <div style={{ fontSize: 13, color: THEME.text, lineHeight: 1.5 }}>
                  {selectedMeta.action}
                </div>
              </div>

              {/* Node id — handy when wiring to a backend later. */}
              <InspectorRow label="Node ID">
                <span style={{ fontSize: 12, color: THEME.textMuted }}>
                  {selectedNode.id}
                </span>
              </InspectorRow>

              {/*
                [BACKEND] An "Open in dashboard" / "Run step" button could go
                here, calling InnovLabs APIs to launch the AI analysis job,
                fetch live status, or open the underlying notebook entry.
              */}
            </div>
          )}

          {/* Workflow summary stats */}
          <div style={{ marginTop: 24 }}>
            <SectionLabel>Workflow Summary</SectionLabel>
            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <StatCard label="Steps" value={nodes.length} />
              <StatCard label="Connections" value={resolvedEdges.length} />
              <StatCard
                label="Complete"
                value={nodes.filter((n) => n.status === "Complete").length}
              />
              <StatCard
                label="Running"
                value={nodes.filter((n) => n.status === "Running").length}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ============================================================================
 * Small presentational HTML helpers (kept in-file for self-containment)
 * ==========================================================================*/

const subLabelStyle = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  color: THEME.textMuted,
};

function SectionLabel({ children }) {
  return <div style={subLabelStyle}>{children}</div>;
}

function InspectorRow({ label, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <span style={subLabelStyle}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div
      style={{
        background: THEME.bg,
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 800, color: THEME.accent }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: THEME.textMuted }}>{label}</div>
    </div>
  );
}

function IconBtn({ children, onClick, title, wide }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        minWidth: wide ? "auto" : 34,
        height: 34,
        padding: wide ? "0 12px" : 0,
        borderRadius: 8,
        border: "1px solid " + THEME.cardBorder,
        background: "#fff",
        color: THEME.text,
        fontSize: 15,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ZoomBadge({ scale }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: THEME.textMuted,
        minWidth: 44,
        textAlign: "right",
      }}
    >
      {Math.round(scale * 100)}%
    </span>
  );
}
