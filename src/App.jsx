import React from "react";
import ELNWorkflowCanvas from "./components/ELNWorkflowCanvas.jsx";

/**
 * App shell.
 *
 * The canvas is designed to fill the full viewport, so we render it directly.
 * [BACKEND] In the full InnovLabs platform this would live inside the
 * authenticated dashboard layout (nav, experiment context, user session),
 * and the active workflow id would be passed down as a prop.
 */
export default function App() {
  return <ELNWorkflowCanvas />;
}
