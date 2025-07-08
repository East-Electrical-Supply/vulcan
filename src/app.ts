import { renderPDF } from "./puppeteer.ts";
import { Buffer } from "node:buffer";
import express, { Request, Response } from "express";
import denoConfig from "../deno.json" with { type: "json" };
import { logger } from "./logger.ts";

/**
 * The port the HTTP server will listen to
 */
const PORT = Number(Deno.env.get("PORT") ?? "5739");

/**
 * Directory for storing PDFs when download=false
 */
const STORAGE_DIR = Deno.env.get("STORAGE_DIR") || "/tmp/vulcan-pdfs";

/**
 * Base URL for serving stored PDFs
 */
const STORAGE_BASE_URL = Deno.env.get("STORAGE_BASE_URL") ||
  `http://localhost:${PORT}/files`;

const app = express();

interface PDFRouteOptions {
  download?: boolean; // if true (default), serve as download; if false, store and return link
}

interface PDFRequest {
  html: string; // base64 encoded HTML
  options?: PDFRouteOptions;
}

app.use(express.json({ limit: '5mb' }));

// Ensure storage directory exists
try {
  await Deno.mkdir(STORAGE_DIR, { recursive: true });
  logger.info("Storage directory ready", { storageDir: STORAGE_DIR });
} catch (error) {
  if (!(error instanceof Deno.errors.AlreadyExists)) {
    logger.error("Failed to create storage directory", { storageDir: STORAGE_DIR }, error instanceof Error ? error : new Error(String(error)));
    Deno.exit(1);
  }
}

const Router = express.Router();

// Health check endpoint
Router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "vulcan-pdf-service",
    version: denoConfig.version
  });
});

// Serve stored PDF files
Router.get("/files/:filename", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const reqLogger = logger.createRequestLogger(requestId);
  const filename = req.params.filename;
  
  // Validate filename to prevent path traversal
  if (!filename || 
      filename.includes('..') || 
      filename.includes('/') || 
      filename.includes('\\') ||
      !filename.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.pdf$/)) {
    reqLogger.warn("Invalid filename rejected", { filename, operation: "serve_file" });
    return res.status(400).json({ error: "Invalid filename" });
  }

  const filepath = `${STORAGE_DIR}/${filename}`;
  
  // Additional security: ensure resolved path is within storage directory
  try {
    const resolvedPath = await Deno.realPath(filepath);
    const resolvedStorageDir = await Deno.realPath(STORAGE_DIR);
    if (!resolvedPath.startsWith(resolvedStorageDir)) {
      reqLogger.warn("Path traversal attempt blocked", { filename, resolvedPath, operation: "serve_file" });
      return res.status(403).json({ error: "Access denied" });
    }
  } catch (error) {
    // File doesn't exist or path resolution failed
    reqLogger.warn("Path resolution failed", { filename, filepath }, error instanceof Error ? error : new Error(String(error)));
    return res.status(404).json({ error: "File not found" });
  }

  reqLogger.info("Serving PDF file", { filename, operation: "serve_file" });

  try {
    const file = await Deno.readFile(filepath);
    res.contentType("application/pdf");
    res.send(Buffer.from(file));
    reqLogger.info("PDF file served successfully", { filename, fileSize: file.length });
  } catch (error) {
    reqLogger.warn("PDF file not found", { filename, filepath }, error instanceof Error ? error : new Error(String(error)));
    res.status(404).json({ error: "File not found" });
  }
});

Router.post("/pdf", async (req: Request, res: Response) => {
  const requestId = crypto.randomUUID();
  const reqLogger = logger.createRequestLogger(requestId);
  const startTime = Date.now();

  reqLogger.info("PDF generation request started", { operation: "generate_pdf" });

  if (!req.body?.html) {
    reqLogger.warn("Missing HTML content in request");
    return res.status(400).json({ error: "HTML content is required" });
  }
  const { html: encodedHtml, options } = req.body as PDFRequest;

  // Decode base64 HTML
  let html: string;
  try {
    html = atob(encodedHtml);
    reqLogger.debug("HTML decoded successfully", { htmlLength: html.length });
  } catch (error) {
    let message = "Error decoding HTML."
    if (error instanceof Error) message = error.message;
    reqLogger.error("Failed to decode base64 HTML", { encodedLength: encodedHtml?.length }, error instanceof Error ? error : new Error(message));
    return res.status(400).json({ error: "Invalid base64 encoded HTML" });
  }

  const filename = `${crypto.randomUUID()}.pdf`;
  const shouldDownload = options?.download ?? true;

  reqLogger.info("Starting PDF rendering", { filename, downloadMode: shouldDownload });

  try {
    const pdf = await renderPDF(
      html,
      filename,
      shouldDownload ? undefined : STORAGE_DIR,
      requestId
    );

    const duration = Date.now() - startTime;

    if (shouldDownload) {
      // Serve as download
      res.contentType("application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      res.send(Buffer.from(pdf));
      reqLogger.info("PDF served as download", { filename, pdfSize: pdf.length, duration });
    } else {
      // Return download link
      const downloadUrl = `${STORAGE_BASE_URL}/${filename}`;
      res.json({
        success: true,
        filename,
        downloadUrl,
        message: "PDF generated and stored successfully",
      });
      reqLogger.info("PDF generated and stored", { filename, downloadUrl, duration });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    reqLogger.error("PDF generation failed", { filename, duration }, error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

app.use(Router);

export { app, STORAGE_DIR, STORAGE_BASE_URL };