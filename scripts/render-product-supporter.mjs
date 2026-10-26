// Renders a Supporter DNFT card for any Decent dapp: the front frames a screenshot of the product's own
// tagged site, the back is provenance. Run from the product checkout (cwd), served at PRODUCT_URL,
// with this DecentHead checkout served at BASE_URL.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CREATOR, ethers } from './supporter-protocol.mjs';
import { supporterQuantity, supporterPrice } from './supporter-metadata.mjs';

export function productCardUrl(base, { repo, name, version, releaseDate, creatorAddress, tagline, quantity, priceUSDC }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw new Error('owner/repo required');
  if (!version || !/^[\w./-]{1,64}$/.test(version)) throw new Error('Release version required');
  if (!Number.isFinite(Date.parse(releaseDate)) || new Date(releaseDate).toISOString() !== releaseDate) throw new Error('Canonical UTC releaseDate required');
  if (!ethers.isAddress(creatorAddress || '')) throw new Error('Resolved creator address required');
  const params = new URLSearchParams({ repo, version, releaseDate, creatorAddress, quantity: supporterQuantity(quantity), priceUSDC: supporterPrice(priceUSDC), name: String(name || repo.split('/')[1]).slice(0, 40), tagline: String(tagline || '').slice(0, 160) });
  return `${base.replace(/\/$/, '')}/supporter/product-card.html?${params}`;
}

export function presentationHtml(title, front, back) {
  const safe = String(title).replace(/[<>&"]/g, '');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${safe} Supporter DNFT front/back</title><style>
body{margin:0;background:#060b14;color:white;display:grid;place-items:center;min-height:100vh;font-family:system-ui;perspective:1600px}
button{background:none;border:0;color:inherit;cursor:grab}.card{display:block;width:min(80vw,75vh);aspect-ratio:1;position:relative;transform-style:preserve-3d;transition:transform .5s}
img{width:100%;position:absolute;inset:0;backface-visibility:hidden;border-radius:4%}img+img{transform:rotateY(180deg)}@media(prefers-reduced-motion:reduce){.card{transition:none}}</style>
<button aria-label="Rotate supporter card"><span class="card"><img alt="Front: tagged release site" src="data:image/png;base64,${front}"><img alt="Back: release provenance" src="data:image/png;base64,${back}"></span><p>Click, tap, or press Enter to rotate front/back</p></button>
<script>let angle=0;document.querySelector('button').onclick=()=>{angle+=180;document.querySelector('.card').style.transform='rotateY('+angle+'deg)'};</script></html>`;
}

async function main() {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const { RELEASE_DATE: releaseDate, ENS_RPC_URL: rpcUrl, GITHUB_REPOSITORY: repo, PRODUCT_NAME: name, TAGLINE: tagline } = process.env;
  const version = process.argv[2];
  const quantity = supporterQuantity(process.env.SUPPORTER_QUANTITY);
  const priceUSDC = supporterPrice(process.env.SUPPORTER_PRICE_USDC);
  if (!rpcUrl || new URL(rpcUrl).protocol !== 'https:') throw new Error('Public HTTPS mainnet ENS_RPC_URL required');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  let creatorAddress, ensBlock;
  try {
    if ((await provider.getNetwork()).chainId !== 1n) throw new Error('ENS resolution requires Ethereum mainnet');
    creatorAddress = await provider.resolveName(CREATOR);
    if (!creatorAddress || creatorAddress === ethers.ZeroAddress) throw new Error('Creator ENS is unresolved; no fallback');
    ensBlock = await provider.getBlockNumber();
  } finally { provider.destroy(); }
  const cardUrl = productCardUrl(process.env.BASE_URL || 'http://127.0.0.1:8790', { repo, name, version, releaseDate, creatorAddress, tagline, quantity, priceUSDC });
  const browser = await chromium.launch();
  try {
    const site = await browser.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
    const errors = [];
    site.on('pageerror', error => errors.push(error.message));
    await site.emulateMedia({ reducedMotion: 'reduce' });
    // Live dapps keep sockets and animations open, so wait for load plus a settle period rather than network idle.
    await site.goto(process.env.PRODUCT_URL || 'http://127.0.0.1:8791/', { waitUntil: 'load', timeout: 60000 });
    await site.waitForTimeout(Number(process.env.SETTLE_MS || 5000));
    await site.screenshot({ path: 'supporter-preview.png' });
    if (errors.length) console.warn(`Product page reported ${errors.length} script error(s) while rendering; review supporter-preview.png before minting.`);
    copyFileSync('supporter-preview.png', fileURLToPath(new URL('../supporter/product-preview.png', import.meta.url)));
    const page = await browser.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 });
    await page.goto(cardUrl, { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('title').textContent && document.getElementById('preview').complete);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: 'supporter-front.png' });
    await page.locator('body').evaluate(body => body.classList.add('back'));
    await page.screenshot({ path: 'supporter-back.png' });
  } finally { await browser.close(); }
  const front = readFileSync('supporter-front.png').toString('base64'), back = readFileSync('supporter-back.png').toString('base64');
  writeFileSync('supporter-presentation.html', presentationHtml(name || repo.split('/')[1], front, back));
  writeFileSync('supporter-artwork.json', JSON.stringify({ version, releaseDate, creator: CREATOR, creatorAddress, ensChainId: 1, ensObservedBlock: ensBlock, priceUSDC, quantity }, null, 2) + '\n');
  console.log(`Rendered ${repo} ${version}: tagged-site front, provenance back, presentation and creator provenance.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
