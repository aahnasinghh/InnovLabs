import React from "react";
import ReactionSetupCanvas from "./components/ReactionSetupCanvas.jsx";

/**
 * Tiny preview shell — for local testing only.
 *
 * Renders the standalone <ReactionSetupCanvas /> in a full-height page so you
 * can try it with `npm run dev`. The component has no dependency on this file;
 * to use it in the real InnovLabs ELN, just:
 *     import ReactionSetupCanvas from "./components/ReactionSetupCanvas";
 *     <ReactionSetupCanvas />
 */
export default function App() {
  return (
    <div style={{ height: "100vh", width: "100%", padding: 16, boxSizing: "border-box", background: "#e2e8f0" }}>
      <ReactionSetupCanvas />
    </div>
  );
}
