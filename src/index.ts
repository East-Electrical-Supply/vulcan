import { app, STORAGE_DIR, STORAGE_BASE_URL } from "./app.ts";
import denoConfig from "../deno.json" with { type: "json" };
import { logger } from "./logger.ts";

// Check for version flag
if (Deno.args.includes("-v") || Deno.args.includes("--version")) {
  console.log(denoConfig.version);
  Deno.exit(0);
}

/**
 * The URL on which the API will be hosted
 */
const BASE_URL = Deno.env.get("BASE_URL") || "api.example.com/v1";

/**
 * The port the HTTP server will listen to
 */
const PORT = Number(Deno.env.get("PORT") ?? "5739");

app.listen(PORT, () => {
  logger.info("Vulcan PDF service started", { 
    baseUrl: BASE_URL, 
    port: PORT, 
    storageDir: STORAGE_DIR,
    storageBaseUrl: STORAGE_BASE_URL,
    version: denoConfig.version
  });
});
