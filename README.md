# InnovLabs — Pipelines Canvas

A minimal, reusable **data-pipeline canvas** for the InnovLabs AI platform — an
AI-powered Electronic Lab Notebook (ELN) and scientific discovery tool. The
canvas lets researchers visually build simple pipeline graphs (e.g.
`Dataset → Process → AI Analysis → Chart → Export`) that can later be embedded
inside an ELN section.

> **Status:** front-end UI prototype. It is intentionally **not** wired to a
> backend. Code comments marked `// [INTEGRATION]` indicate where InnovLabs
> services (backend save API, Dagster execution, Data Hub datasets) would
> later plug in.

---

## Overview

`PipelinesCanvas` is a single, self-contained React component built with
[react-konva](https://konvajs.org/docs/react/). It renders an interactive
canvas where each node represents a step in a data pipeline. Nodes can be
added, named, dragged, connected, selected, and deleted. The component is
designed to be copied/imported into the real InnovLabs app and dropped into a
notebook page.

## Purpose

Scientific data work is often spread across disconnected tools and manual
hand-offs. This canvas demonstrates a clean, low-clutter way to compose and
visualize a pipeline graph directly inside the ELN — fewer clicks, clearer
flow, and an obvious place to later attach datasets, execution, and outputs.

## Technologies Used

| Layer      | Technology                                                              |
| ---------- | ----------------------------------------------------------------------- |
| UI library | [React 18](https://react.dev)                                           |
| Build tool | [Vite 5](https://vitejs.dev)                                            |
| Canvas     | [Konva](https://konvajs.org) + [react-konva](https://konvajs.org/docs/react/) |
| Styling    | Inline styles only (no CSS framework)                                   |
| Language   | JavaScript (JSX) — no TypeScript                                        |

## Features

- 🟦 **Draggable nodes** — small rounded blocks that show only their name.
- 🔗 **Live connector arrows** — recompute automatically as nodes are dragged.
- 🧰 **Minimal toolbar** — Add Node · Connect Mode · Clear · Zoom In · Zoom Out
  · Reset View.
- 🔌 **Connect Mode** — click a source node, then a target node, to wire them.
- 🎯 **Selection** — click a node to select it (teal border + soft teal fill).
- 🪟 **Inspector** — shows the selected node's name (editable / rename), X/Y
  position, connected nodes, and a Delete action.
- 📊 **Summary row** — node count, connection count, selected node, and current
  mode (Edit / Connect).
- 🧭 **Canvas UX** — large dotted-grid workspace, scroll-to-zoom, drag-to-pan.
- 🌱 **Seeded default graph:** `Dataset → Process → AI Analysis → Chart → Export`.

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
    ├── App.jsx              # preview-only wrapper (renders the canvas)
    ├── index.css            # global reset
    └── components/
        └── PipelinesCanvas.jsx   # the standalone canvas component
```

> `App.jsx` exists only to preview the component during local development.
> The component itself has no dependency on it.

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

## Reusing the Component

```jsx
import PipelinesCanvas from "./components/PipelinesCanvas";

function NotebookPipelinesSection() {
  return <PipelinesCanvas />;
}
```

## Future Improvements

- **Backend save API** — serialize `{ nodes, edges }` and persist per notebook.
- **Dagster execution** — trigger runs for a pipeline graph and map nodes to
  ops/assets.
- **Data Hub integration** — back dataset nodes with real dataset references.
- **Chart Gallery output** — link chart nodes to generated visualizations.
- **Edge editing** — delete/redirect connectors interactively.
- **Auto-layout** — tidy/auto-arrange a graph left-to-right.

## License

Prototype — internal InnovLabs use. Add a license before any public release.
