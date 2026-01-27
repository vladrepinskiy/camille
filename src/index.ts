// Main entry point for the Camille daemon

import { Runtime } from "@/core/runtime";

const runtime = new Runtime();

process.on("SIGINT", () => runtime.shutdown());
process.on("SIGTERM", () => runtime.shutdown());

runtime.start().catch((err) => {
  console.error("Failed to start Camille:", err);
  process.exit(1);
});
