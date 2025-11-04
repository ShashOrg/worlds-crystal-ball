import path from "node:path";

import { defineConfig } from "vitest/config";

const projectRoot = path.resolve(__dirname);

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: [],
  },
  css: {
    postcss: {},
  },
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
});
