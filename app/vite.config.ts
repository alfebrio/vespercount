import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Polyfill Buffer, process, dll. yang dibutuhkan Solana SDK di browser
      include: ["buffer", "process", "stream", "util", "crypto"],
      globals: { Buffer: true, process: true, global: true },
    }),
  ],
  define: {
    "process.env": {},
  },
  resolve: {
    alias: {
      stream: "stream-browserify",
    },
  },
  optimizeDeps: {
    include: ["@solana/web3.js", "@coral-xyz/anchor"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    target: "esnext",
    commonjsOptions: { transformMixedEsModules: true },
  },
  server: {
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
});
