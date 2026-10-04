import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WASM binary and must not be bundled by the server compiler.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
