import puppeteer from "npm:puppeteer";
export async function renderPDF(
  html: string,
  filename?: string,
  storageDir?: string,
) {
  if (!html) {
    console.error(`Cannot render empty PDF. Exiting.`);
    Deno.exit(-1);
  }
  const tmpFilename = `/tmp/${crypto.randomUUID()}.html`;
  try {
    await Deno.writeTextFile(tmpFilename, html);
  } catch (err) {
    console.error(`Error writing temporary file.`);
    Deno.exit(-1);
  }
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
    headless: 'shell'
  });
  const page = await browser.newPage();
  await page.goto(`file://${tmpFilename}`);
  const pdf = await page.pdf({
    margin: {
      top: "10mm",
      bottom: "10mm",
      left: "10mm",
      right: "10mm",
    },
    printBackground: true,
  });
  await browser.close();
  // Clean up temporary HTML file
  try {
    await Deno.remove(tmpFilename);
  } catch (err) {
    console.warn(`Failed to remove temporary file: ${tmpFilename}`);
  }
  // If storageDir is provided, save the PDF to storage
  if (storageDir && filename) {
    const pdfPath = `${storageDir}/${filename}`;
    try {
      await Deno.writeFile(pdfPath, pdf);
      console.log(`PDF saved to: ${pdfPath}`);
    } catch (err) {
      console.error(`Error saving PDF to storage: ${err}`);
      throw err;
    }
  }
  return pdf;
}
