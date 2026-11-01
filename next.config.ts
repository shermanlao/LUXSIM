import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  turbopack: {
    root,
    resolveAlias: {
      "@luxsim/photometry": "./packages/photometry/src/index.ts",
      "@luxsim/solver": "./packages/solver/src/index.ts",
      "@luxsim/project-io": "./packages/project-io/src/index.ts",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@luxsim/photometry": path.resolve(root, "packages/photometry/src/index.ts"),
      "@luxsim/solver": path.resolve(root, "packages/solver/src/index.ts"),
      "@luxsim/project-io": path.resolve(root, "packages/project-io/src/index.ts"),
    };
    return config;
  },
};

export default nextConfig;
