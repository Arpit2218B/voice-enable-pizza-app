import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@webmcp/voice-agent/style.css": path.resolve(
        __dirname,
        "packages/webmcp-voice-agent/src/VoiceAgent.css"
      ),
      "@webmcp/voice-agent": path.resolve(__dirname, "packages/webmcp-voice-agent/src/index.js"),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
  },
});
