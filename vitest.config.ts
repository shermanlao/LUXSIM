import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@luxsim/photometry": path.resolve(__dirname, "packages/photometry/src/index.ts"),
      "@luxsim/solver": path.resolve(__dirname, "packages/solver/src/index.ts"),
      "@luxsim/project-io": path.resolve(__dirname, "packages/project-io/src/index.ts"),
    },
  },
});
