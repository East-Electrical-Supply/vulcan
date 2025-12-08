import puppeteer from "npm:puppeteer";
import { logger } from "./logger.ts";

export async function renderPDF(
  html: string,
  filename?: string,
  storageDir?: string,
  requestId?: string,
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
      "--disable-blink-features=LayoutNGPrinting",
    ],
    headless: "shell",
  });
  const page = await browser.newPage();
  await page.goto(`file://${tmpFilename}`);
  const pdf = await page.pdf({
    format: "A4",
    scale: 1.0,
    margin: {
      top: "5mm",
      bottom: "5mm",
      left: "0mm",
      right: "0mm",
    },
    printBackground: true,
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
