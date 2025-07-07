import { renderPDF } from "./puppeteer.ts";
import { Buffer } from "node:buffer";
import express, { Request, Response } from "express";

/**
 * The URL on which the API will be hosted
 */
const BASE_URL = Deno.env.get("BASE_URL") || "api.example.com/v1";

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

app.use(express.json());

// Ensure storage directory exists
try {
  await Deno.mkdir(STORAGE_DIR, { recursive: true });
} catch (error) {
  if (!(error instanceof Deno.errors.AlreadyExists)) {
    console.error("Failed to create storage directory:", error);
    Deno.exit(1);
  }
}

const Router = express.Router();

// Serve stored PDF files
Router.get("/files/:filename", async (req: Request, res: Response) => {
  const filename = req.params.filename;
  const filepath = `${STORAGE_DIR}/${filename}`;

  try {
    const file = await Deno.readFile(filepath);
    res.contentType("application/pdf");
    res.send(Buffer.from(file));
  } catch (_error) {
    res.status(404).json({ error: "File not found" });
  }
});

Router.post("/pdf", async (req: Request, res: Response) => {
  if (!req.body?.html) {
    return res.status(400).json({ error: "HTML content is required" });
  }
  const { html: encodedHtml, options } = req.body as PDFRequest;

  // Decode base64 HTML
  let html: string;
  try {
    html = atob(encodedHtml);
    console.log(html);
  } catch (error) {
    let message = "Error decoding HTML."
    if (error instanceof Error) message = error.message;
    console.error(`ERROR-POST/pdf: ${message}`);
    return res.status(400).json({ error: "Invalid base64 encoded HTML" });
  }

  const filename = `${crypto.randomUUID()}.pdf`;
  const shouldDownload = options?.download ?? true;

  try {
    const pdf = await renderPDF(
      html,
      filename,
      shouldDownload ? undefined : STORAGE_DIR,
    );

    if (shouldDownload) {
      // Serve as download
      res.contentType("application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      res.send(Buffer.from(pdf));
    } else {
      // Return download link
      const downloadUrl = `${STORAGE_BASE_URL}/${filename}`;
      res.json({
        success: true,
        filename,
        downloadUrl,
        message: "PDF generated and stored successfully",
      });
    }
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

app.use(Router);

app.listen(PORT, () => {
  console.log(`${BASE_URL}:${PORT}`);
});
