import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { CREATOR, ethers } from './supporter-protocol.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { RELEASE_DATE: releaseDate, ENS_RPC_URL: rpcUrl } = process.env;
const version = process.argv[2];
if (!version || !releaseDate || !Number.isFinite(Date.parse(releaseDate)) || new Date(releaseDate).toISOString() !== releaseDate) throw new Error('Version and explicit canonical UTC RELEASE_DATE required');
if (!rpcUrl || new URL(rpcUrl).protocol !== 'https:') throw new Error('Public HTTPS mainnet ENS_RPC_URL required');
const provider = new ethers.JsonRpcProvider(rpcUrl);
let creatorAddress, ensBlock;
try {
  if ((await provider.getNetwork()).chainId !== 1n) throw new Error('ENS resolution requires Ethereum mainnet');
  creatorAddress = await provider.resolveName(CREATOR);
  if (!creatorAddress || creatorAddress === ethers.ZeroAddress) throw new Error('Creator ENS is unresolved; no fallback');
  ensBlock = await provider.getBlockNumber();
} finally { provider.destroy(); }
const base = (process.env.BASE_URL || 'http://127.0.0.1:8790').replace(/\/$/, '');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 });
  const params = new URLSearchParams({ version, releaseDate, creatorAddress });
  await page.goto(`${base}/supporter/card.html?${params}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await page.getByRole('button', { name: 'Disconnect wallet', exact: true }).waitFor();
  await page.waitForFunction(() => window.DecentHead.getWallet().snapshot().ensStatus !== 'loading');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'supporter-front.png' });
  copyFileSync('supporter-front.png', 'img/supporter-dnft.png');
  await page.locator('body').evaluate(body => body.classList.add('back'));
  await page.screenshot({ path: 'supporter-back.png' });
} finally { await browser.close(); }
const front = readFileSync('supporter-front.png').toString('base64');
const back = readFileSync('supporter-back.png').toString('base64');
const presentation = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Supporter DNFT front/back</title><style>
body{margin:0;background:#060b14;color:white;display:grid;place-items:center;min-height:100vh;font-family:system-ui;perspective:1600px}
button{background:none;border:0;color:inherit;cursor:grab}.card{display:block;width:min(80vw,75vh);aspect-ratio:1;position:relative;transform-style:preserve-3d;transition:transform .5s}
img{width:100%;position:absolute;inset:0;backface-visibility:hidden;border-radius:4%}img+img{transform:rotateY(180deg)}@media(prefers-reduced-motion:reduce){.card{transition:none}}</style>
<button aria-label="Rotate supporter card"><span class="card"><img alt="Front: actual release header" src="data:image/png;base64,${front}"><img alt="Back: release provenance" src="data:image/png;base64,${back}"></span><p>Click, tap, or press Enter to rotate front/back</p></button>
<script>let angle=0;document.querySelector('button').onclick=()=>{angle+=180;document.querySelector('.card').style.transform='rotateY('+angle+'deg)'};</script></html>`;
writeFileSync('supporter-presentation.html', presentation);
writeFileSync('supporter-artwork.json', JSON.stringify({ version, releaseDate, creator: CREATOR, creatorAddress, ensChainId: 1, ensObservedBlock: ensBlock, priceUSDC: '10000000' }, null, 2) + '\n');
console.log('Rendered front/back, self-contained presentation and resolved creator provenance.');
