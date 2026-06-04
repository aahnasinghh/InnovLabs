import React from "react";
import PipelinesCanvas from "./components/PipelinesCanvas.jsx";

/**
 * App shell — PREVIEW ONLY.
 *
 * Renders the standalone <PipelinesCanvas /> during local development so you
 * can see it in the browser (npm run dev). The component itself has no
 * dependency on this file — to use it in the real InnovLabs app, just:
 *     import PipelinesCanvas from "./components/PipelinesCanvas";
 *     <PipelinesCanvas />
 */
export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#f1f5f9",
        padding: "32px 16px",
        boxSizing: "border-box",
      }}
    >
      <PipelinesCanvas />
    </div>
  );
}
