import express, { Request, Response } from "express";
import openapiSpec from "../openapi.json" with { type: "json" };

/**
 * Router serving the OpenAPI specification and an interactive
 * Swagger UI documentation page.
 *
 * - GET `/docs`             -> Swagger UI HTML page
 * - GET `/docs/openapi.json` -> Raw OpenAPI 3.1 specification
 */
const docsRouter = express.Router();

// Serve the raw OpenAPI specification
docsRouter.get("/docs/openapi.json", (_req: Request, res: Response) => {
  res.json(openapiSpec);
});

// Swagger UI page, loaded from the jsDelivr CDN so no extra deps are bundled.
const SWAGGER_UI_VERSION = "5.17.14";
const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${openapiSpec.info.title} — API Docs</title>
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css"
    />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.onload = () => {
        // Resolve the spec URL from the current path so it works whether or
        // not the page was requested with a trailing slash, and behind any
        // base path / reverse proxy.
        const base = window.location.pathname.replace(/\\/$/, "");
        window.ui = SwaggerUIBundle({
          url: base + "/openapi.json",
          dom_id: "#swagger-ui",
          deepLinking: true,
        });
      };
    </script>
  </body>
</html>`;

docsRouter.get("/docs", (_req: Request, res: Response) => {
  res.type("html").send(swaggerHtml);
});

export { docsRouter };
