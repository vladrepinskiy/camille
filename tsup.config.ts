import { copyFileSync } from "fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli/cli.tsx",
  },
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: true,
  splitting: true,
  external: ["better-sqlite3"],
  onSuccess: async () => {
    // Copy schema.sql to dist after build (chunks end up in dist/ directly)
    const srcSchema = "src/db/schema.sql";
    const destSchema = "dist/schema.sql";

    try {
      copyFileSync(srcSchema, destSchema);
      console.log("Copied schema.sql to dist/");
    } catch (err) {
      console.warn("Could not copy schema.sql:", err);
    }
  },
});
