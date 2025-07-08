import denoConfig from "../deno.json" with { type: "json" };

// Check for version flag
if (Deno.args.includes("-v") || Deno.args.includes("--version")) {
  console.log(denoConfig.version);
  Deno.exit(0);
}

import { app, STORAGE_BASE_URL, STORAGE_DIR, initializeStorage } from "./app.ts";
import { logger } from "./logger.ts";

/**
 * The URL on which the API will be hosted
 */
const BASE_URL = Deno.env.get("BASE_URL") || "api.example.com/v1";

/**
 * The port the HTTP server will listen to
 */
const PORT = Number(Deno.env.get("PORT") ?? "5739");

// Initialize storage directory
await initializeStorage();

app.listen(PORT, () => {
  logger.info("Vulcan PDF service started", {
    baseUrl: BASE_URL,
    port: PORT,
    storageDir: STORAGE_DIR,
    storageBaseUrl: STORAGE_BASE_URL,
    version: denoConfig.version,
  });
});
