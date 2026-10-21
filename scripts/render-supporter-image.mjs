// Renders supporter/card.html (the live head, connected to a placeholder demo wallet) to img/supporter-dnft.png.
// Usage: serve the repo root (python3 -m http.server 8790), then
//   BASE_URL=http://127.0.0.1:8790 node scripts/render-supporter-image.mjs [version]
// PLAYWRIGHT_MODULE may point to an existing Playwright installation.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.BASE_URL || 'http://127.0.0.1:8790').replace(/\/$/, '');
const version = process.argv[2] || '';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto(`${base}/supporter/card.html${version ? `?version=${encodeURIComponent(version)}` : ''}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await page.getByRole('button', { name: 'Forget wallet' }).waitFor();
  await page.getByRole('button', { name: 'Forget wallet' }).evaluate(button => { button.hidden = true; });
  await page.waitForTimeout(2500); // let orbits, wires, and fonts settle
  await page.screenshot({ path: process.env.OUT || 'img/supporter-dnft.png' });
  console.log(`Wrote ${process.env.OUT || 'img/supporter-dnft.png'}`);
} finally { await browser.close(); }
