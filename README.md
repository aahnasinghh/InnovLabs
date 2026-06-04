# InnovLabs — ELN Workflow Canvas

A visual, drag-and-drop **workflow canvas** for the InnovLabs AI platform — an
AI-powered Electronic Lab Notebook (ELN) and scientific discovery tool. This
canvas lets researchers compose experiment, data, AI-analysis, and reporting
pipelines visually, similar in spirit to Dagster-style data graphs and tools
like Chemflow.

> **Status:** front-end UI prototype. It is intentionally **not** wired to a
> backend yet. Code comments marked `// [BACKEND]` indicate where InnovLabs
> APIs, dashboard data, and persistence would later plug in.

![ELN Workflow Canvas](./public/favicon.svg)

---

## Overview

The ELN Workflow Canvas provides an interactive, node-based editor where each
node represents a step in a research workflow (protocol design, data capture,
AI analysis, charting, reporting, and more). Nodes can be dragged, connected,
inspected, and assigned a lifecycle status. A right-side inspector surfaces
contextual details and **suggested UX actions** for each step.

## Purpose

Scientific workflows are often spread across spreadsheets, disconnected tools,
and manual hand-offs. This canvas demonstrates how InnovLabs can deliver:

- **Less clutter** — one visual surface for the whole experiment lifecycle.
- **Fewer clicks** — templates, auto-connected datasets, and one-click status.
- **Clearer workflows** — explicit left-to-right flow with live connectors.
- **Better data/chart organization** — analysis flows directly into charts and
  exportable reports.

## Technologies Used

| Layer        | Technology                          |
| ------------ | ----------------------------------- |
| UI library   | [React 18](https://react.dev)       |
| Build tool   | [Vite 5](https://vitejs.dev)        |
| Canvas       | [Konva](https://konvajs.org) + [react-konva](https://konvajs.org/docs/react/) |
| Styling      | Inline styles + a small global CSS reset (no CSS framework) |
| Language     | JavaScript (JSX) — no TypeScript    |

## Features

- 🧩 **Drag-and-drop nodes** for 8 ELN step types:
  Protocol Design, Data Capture, Materials & Reagents, Sample Tracking,
  AI Analysis, Chart Generation, Review & Sign, Report Export.
- 🎴 **Clean node cards** with title, subtitle, emoji icon, color-coded accent,
  and a status badge (`Draft` · `Ready` · `Running` · `Complete`).
- 🔗 **Live connectors** — arrows recompute automatically as nodes are dragged.
- 🧰 **Left toolbar** to add nodes (Protocol / Data / Analysis / Chart and more)
  and clear the canvas. New nodes auto-link into the flow.
- 🔍 **Zoom & pan** — Zoom In / Zoom Out / Reset View controls plus
  zoom-to-pointer on mouse wheel and click-drag panning.
- 🪟 **Right inspector** — shows the selected node's title, type, status,
  description, and a suggested UX action. Click the status to cycle it.
- 📊 **Workflow summary** — live counts of steps, connections, and statuses.
- 🌱 **Seeded default flow:**
  `Protocol Design → Data Capture → AI Analysis → Chart Generation → Report Export`.

## Project Structure

```
InnovLabs/
├── index.html               # Vite HTML entry
├── package.json
├── vite.config.js
├── .gitignore
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx             # React entry point
    ├── App.jsx              # App shell
    ├── index.css            # Global reset
    └── components/
        └── ELNWorkflowCanvas.jsx   # The canvas (self-contained)
```

## Run Locally

**Prerequisites:** [Node.js](https://nodejs.org) 18+ (includes `npm`).

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server (opens http://localhost:5173)
npm run dev
```

Other scripts:

```bash
npm run build     # production build into dist/
npm run preview   # preview the production build locally
```

## Future Improvements

- **Backend integration** — persist workflows via InnovLabs APIs
  (load/save workflow documents, PATCH step status, trigger AI runs).
- **Edge editing** — draw/delete connectors interactively instead of
  auto-linking.
- **Custom node config** — per-node parameters, attachments, and validation.
- **Real-time collaboration** — multi-user editing and presence.
- **Templates & library** — reusable protocol/workflow templates.
- **Auth & dashboard** — embed inside the authenticated InnovLabs dashboard
  with experiment context.
- **Export** — generate PDF / shareable reports from a completed workflow.

## License

Prototype — internal InnovLabs use. Add a license before any public release.
