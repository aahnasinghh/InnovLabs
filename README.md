# InnovLabs — Reaction Setup Canvas

A single, reusable **chemical reaction setup designer** for the InnovLabs AI
platform — an AI-powered Electronic Lab Notebook (ELN) and scientific discovery
tool. It is a simplified, BioRender/ChemDraw-style editor for visually
**assembling laboratory apparatus** into real reaction diagrams (reflux,
distillation, filtration, titration, heating), built entirely on
[Fabric.js](http://fabricjs.com/).

> **Status:** front-end UI prototype. It is intentionally **not** wired to a
> backend. Code comments marked `// [INTEGRATION]` indicate where InnovLabs
> services (save setup to ELN, reagents inventory, notebook export, load saved
> setups) would later plug in.

---

## Overview

`ReactionSetupCanvas` is a single, self-contained React component. Instead of
placing floating images, every apparatus is rendered as clean **Fabric.js vector
geometry** carrying chemistry-aware **connection anchors**. Pieces snap together
like LEGO into meaningful setups, and connected apparatus move as one assembly.

Layout: **Toolbar → Left sidebar (Templates + Smart Apparatus + categorized
palette) → Canvas → Inspector**.

## Key Features

- 🧲 **Smart apparatus assembly** — anchors model real joints (flask neck ↔
  condenser bottom, vessel base ↔ hotplate top, tubing/pipe ports, stand clamp
  arms, thermometer inserts). Compatible anchors magnetically snap with a live
  preview; connected pieces move together and can be detached.
- 🔄 **Auto-rotation** — linear connectors (tubing, pipes) rotate to align
  end-to-end when snapped to a port.
- 🧩 **Vector apparatus for every category** — Glassware, Heating, Supports,
  Instruments, Biology, Chemicals, Safety, Industrial, and Symbols all render as
  clean vectors (safety gear and symbols are free annotations).
- 🧪 **Preset templates** — one-click Reflux, Distillation, Filtration,
  Titration, and Heating setups (Reflux is the most polished).
- 🛠️ **Toolbar** — Add Text · Add Arrow · Clear · Export PNG.
- 🧭 **Canvas UX** — scroll-to-zoom, Alt-drag to pan, drag/resize/rotate, plus
  floating Zoom / Fit / Reset controls.
- 🔎 **Searchable palette** with collapsible categories; click or drag any item
  onto the canvas.
- 🪟 **Inspector** — type, position, size, rotation, layer controls, connection
  count, detach, duplicate, and delete for the selected object.

## Technologies Used

| Layer      | Technology                                      |
| ---------- | ----------------------------------------------- |
| UI library | [React 18](https://react.dev)                   |
| Build tool | [Vite 5](https://vitejs.dev)                    |
| Canvas     | [Fabric.js 7](http://fabricjs.com/)             |
| Styling    | Inline styles only (no CSS framework)           |
| Language   | JavaScript (JSX) — no TypeScript                |

## Project Structure

```
InnovLabs/
├── index.html                 # Vite HTML entry
├── package.json
├── vite.config.js
├── .gitignore
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx               # React entry point
    ├── App.jsx                # preview-only wrapper (renders the canvas)
    ├── index.css              # global reset
    ├── assets/
    │   └── labassets/         # JPEG palette thumbnails (pack1…pack9)
    └── components/
        └── ReactionSetupCanvas.jsx   # the standalone designer component
```

> The JPEGs in `src/assets/labassets/` are used only as **palette thumbnails**.
> Objects drawn on the canvas are always Fabric.js vectors, never the JPEGs.
> `App.jsx` exists only to preview the component during local development.

## Run Locally

**Prerequisites:** [Node.js](https://nodejs.org) 18+ (includes `npm`).

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

Other scripts:

```bash
npm run build     # production build into dist/
npm run preview   # preview the production build locally
```

## Reusing the Component

```jsx
import ReactionSetupCanvas from "./components/ReactionSetupCanvas";

function NotebookReactionSection() {
  return <ReactionSetupCanvas />;
}
```

## Future Improvements

- **Save setup to ELN** — serialize the canvas (objects + connections) and
  persist per notebook entry.
- **Load saved setups** — rehydrate a setup and rebuild its connection graph.
- **Reagents inventory** — bind apparatus to Data Hub records.
- **Notebook export** — attach the exported PNG/JSON to an ELN entry.
- **More templates** — Soxhlet, vacuum filtration, fractional distillation.

## License

Prototype — internal InnovLabs use. Add a license before any public release.
