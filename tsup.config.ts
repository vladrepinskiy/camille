import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
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
    // Copy schema.sql to dist after build
    const srcSchema = "src/db/schema.sql";
    const destDir = "dist/db";
    const destSchema = join(destDir, "schema.sql");

    try {
      mkdirSync(destDir, { recursive: true });
      copyFileSync(srcSchema, destSchema);
      console.log("Copied schema.sql to dist/db/");
    } catch (err) {
      console.warn("Could not copy schema.sql:", err);
    }
  },
});
