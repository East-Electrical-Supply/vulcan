import puppeteer, { PaperFormat } from "npm:puppeteer";
import { logger } from "./logger.ts";

/**
 * Page margins for the generated PDF. Values are CSS length strings
 * (e.g. "10mm", "0.5in", "20px").
 */
export interface PDFMargin {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

/**
 * Options that control how the PDF is rendered. These map onto Puppeteer's
 * `page.pdf()` options, with defaults chosen to match Vulcan's prior behaviour.
 */
export interface PDFRenderOptions {
  /** Paper format, e.g. "A4", "Letter", "Legal". Default: "A4". */
  format?: string;
  /** Render in landscape orientation. Default: false. */
  landscape?: boolean;
  /** Scale of the webpage rendering. Between 0.1 and 2. Default: 1.0. */
  scale?: number;
  /** Page margins. Default: 5mm top/bottom, 0mm left/right. */
  margin?: PDFMargin;
  /** Print background graphics. Default: true. */
  printBackground?: boolean;
  /** Paper ranges to print, e.g. "1-5, 8". Default: all pages. */
  pageRanges?: string;
  /** Give any CSS `@page` size declared in the HTML priority over `format`. */
  preferCSSPageSize?: boolean;
  /**
   * Render using `screen` CSS media instead of `print`. Useful when the HTML
   * has no dedicated print styles and should look like the browser view.
   */
  emulateScreenMedia?: boolean;
}

const DEFAULT_RENDER_OPTIONS: Required<
  Pick<PDFRenderOptions, "format" | "scale" | "margin" | "printBackground">
> = {
  format: "A4",
  scale: 1.0,
  margin: { top: "5mm", bottom: "5mm", left: "0mm", right: "0mm" },
  printBackground: true,
};

export async function renderPDF(
  html: string,
  filename?: string,
  storageDir?: string,
  requestId?: string,
  options?: PDFRenderOptions,
) {
  const reqLogger = requestId ? logger.createRequestLogger(requestId) : logger;
  const startTime = Date.now();
  if (!html) {
    reqLogger.error("Cannot render empty PDF", { operation: "render_pdf" });
    Deno.exit(-1);
  }
  const tmpFilename = `/tmp/${crypto.randomUUID()}.html`;
  reqLogger.debug("Writing temporary HTML file", {
    tmpFilename,
    htmlLength: html.length,
  });

  try {
    await Deno.writeTextFile(tmpFilename, html);
  } catch (err) {
    reqLogger.error(
      "Error writing temporary file",
      { tmpFilename },
      err instanceof Error ? err : new Error(String(err)),
    );
    Deno.exit(-1);
  }
  reqLogger.info("Starting PDF generation", {
    operation: "render_pdf",
    tmpFilename,
  });

  const browser = await puppeteer.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--allow-file-access-from-files",
      "--enable-local-file-accesses",
      "--ignore-certificate-errors",
      "--disable-web-security",
    ],
    headless: "shell",
  });
  const page = await browser.newPage();

  // Wait for all network resources (remote stylesheets, images, fonts) to
  // settle so nothing renders half-loaded or with fallback fonts.
  await page.goto(`file://${tmpFilename}`, { waitUntil: "networkidle0" });

  if (options?.emulateScreenMedia) {
    await page.emulateMediaType("screen");
  }

  // Ensure web fonts are fully loaded before printing.
  await page.evaluate("document.fonts.ready");

  const pdf = await page.pdf({
    format: (options?.format ?? DEFAULT_RENDER_OPTIONS.format) as PaperFormat,
    landscape: options?.landscape ?? false,
    scale: options?.scale ?? DEFAULT_RENDER_OPTIONS.scale,
    margin: options?.margin ?? DEFAULT_RENDER_OPTIONS.margin,
    printBackground: options?.printBackground ??
      DEFAULT_RENDER_OPTIONS.printBackground,
    pageRanges: options?.pageRanges,
    preferCSSPageSize: options?.preferCSSPageSize ?? false,
  });
  await browser.close();

  const renderDuration = Date.now() - startTime;
  reqLogger.info("PDF generation completed", {
    pdfSize: pdf.length,
    duration: renderDuration,
  });
  // Clean up temporary HTML file
  try {
    await Deno.remove(tmpFilename);
    reqLogger.debug("Temporary HTML file cleaned up", { tmpFilename });
  } catch (err) {
    reqLogger.warn(
      "Failed to remove temporary file",
      { tmpFilename },
      err instanceof Error ? err : new Error(String(err)),
    );
  }
  // If storageDir is provided, save the PDF to storage
  if (storageDir && filename) {
    const pdfPath = `${storageDir}/${filename}`;
    reqLogger.info("Saving PDF to storage", { pdfPath, filename });
    try {
      await Deno.writeFile(pdfPath, pdf);
      reqLogger.info("PDF saved to storage successfully", {
        pdfPath,
        pdfSize: pdf.length,
      });
    } catch (err) {
      reqLogger.error(
        "Error saving PDF to storage",
        { pdfPath },
        err instanceof Error ? err : new Error(String(err)),
      );
      throw err;
    }
  }
  return pdf;
}
