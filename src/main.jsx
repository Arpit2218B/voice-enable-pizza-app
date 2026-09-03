import React from "react";
import ReactDOM from "react-dom/client";
import { initializeWebMCPPolyfill } from "@mcp-b/webmcp-polyfill";
import App from "./App";
import "./index.css";

initializeWebMCPPolyfill();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
