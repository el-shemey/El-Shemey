import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: [
      "lib/**/*.test.ts",
      "lib/domain/**/*.test.ts",
      "lib/server/**/*.test.ts",
      "features/**/*.test.ts",
    ],
    setupFiles: ["vitest.setup.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "server-only": path.resolve(__dirname, "vitest.server-only-stub.ts"),
    },
  },
});
