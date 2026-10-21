// Optional smoke check: PLAYWRIGHT_MODULE may point to an existing Playwright installation.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8765';
const shots = process.env.SCREENSHOT_DIR;
if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [], failed = [];
async function pageFor(options = {}) {
  const page = await browser.newPage(options);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => failed.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
  return page;
}
async function shot(page, name) { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); }
try {
  const desktop = await pageFor({ viewport: { width: 1440, height: 900 } });
  await desktop.goto(base);
  await desktop.getByRole('button', { name: 'Connect wallet', exact: true }).waitFor();
  assert.equal(await desktop.getByRole('button', { name: 'Connect wallet', exact: true }).isDisabled(), true);
  assert.match(await desktop.getByRole('link', { name: 'Open MetaMask' }).getAttribute('href'), /^https:\/\/metamask.app.link\/dapp\/127.0.0.1:8765\//);
  const animation = () => desktop.evaluate(() => getComputedStyle(document.querySelector('decent-header').shadowRoot.querySelector('.dh-background'), '::after').animationName);
  assert.equal(await animation(), 'dh-drift');
  await shot(desktop, 'desktop');
  await desktop.getByRole('button', { name: 'DecentHead', exact: true }).click();
  await desktop.getByRole('heading', { name: 'About DecentHead' }).waitFor();
  await shot(desktop, 'about');
  await desktop.getByRole('button', { name: 'Close', exact: true }).click();
  await desktop.getByRole('button', { name: 'Open IPFS controls' }).click();
  await desktop.getByRole('heading', { name: 'Storage provider' }).waitFor();
  assert.equal(await desktop.locator('#provider option').count(), 2);
  assert.equal(await desktop.locator('#provider').inputValue(), 'pinata');
  await shot(desktop, 'ipfs-providers');
  await desktop.getByRole('button', { name: 'Close', exact: true }).click();
  await desktop.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await animation(), 'none');
  assert.equal(await desktop.evaluate(() => window.DecentHead.getWallet().snapshot().connected), false);
  const mobile = await pageFor({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
  await mobile.goto(base);
  await mobile.getByRole('link', { name: 'Open MetaMask' }).waitFor();
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await shot(mobile, 'mobile-no-wallet');
  const injected = await pageFor();
  await injected.addInitScript(() => {
    window.mockMethods = [];
    const handlers = new Map();
    const raw = { isMetaMask: true, chainId: '0x1',
      async request({ method, params }) {
        window.mockMethods.push(method);
        if (method === 'eth_chainId') return this.chainId;
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return ['0x1111111111111111111111111111111111111111'];
        if (method === 'wallet_switchEthereumChain') { this.chainId = params[0].chainId; return; }
        throw new Error(`Unexpected wallet request: ${method}`);
      },
      on(event, callback) { handlers.set(event, callback); },
      removeListener(event) { handlers.delete(event); },
      emit(event, detail) { handlers.get(event)?.(detail); },
    };
    window.mockWallet = raw;
    window.addEventListener('eip6963:requestProvider', () => {
      for (const [uuid, name, rdns, provider] of [['other', 'Other wallet', 'example.wallet', { request: () => {} }], ['metamask', 'MetaMask', 'io.metamask', raw]]) {
        window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { uuid, name, rdns }, provider } }));
      }
    });
  });
  await injected.goto(base);
  await injected.getByRole('combobox', { name: 'Choose wallet' }).waitFor();
  assert.deepEqual(await injected.evaluate(() => window.mockMethods), []);
  assert.equal(await injected.getByRole('combobox', { name: 'Choose wallet' }).inputValue(), '0');
  assert.equal(await injected.locator('wallet-connect option').first().textContent(), 'MetaMask');
  await injected.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await injected.getByRole('button', { name: 'Forget wallet' }).waitFor();
  assert.equal(await injected.evaluate(() => window.mockMethods.filter(method => method === 'eth_requestAccounts').length), 1);
  assert.equal(await injected.evaluate(() => window.DecentHead.getWallet().snapshot().chainId), '0x2105');
  await shot(injected, 'wallet-connected');
  await injected.evaluate(() => window.mockWallet.emit('accountsChanged', ['0x2222222222222222222222222222222222222222']));
  assert.equal(await injected.evaluate(() => window.DecentHead.getWallet().snapshot().address), '0x2222222222222222222222222222222222222222');
  await injected.evaluate(() => window.mockWallet.emit('chainChanged', '0xa'));
  assert.equal(await injected.evaluate(() => window.DecentHead.getWallet().snapshot().chainId), '0xa');
  await injected.getByRole('button', { name: 'Forget wallet' }).click();
  assert.equal(await injected.evaluate(() => window.DecentHead.getWallet().snapshot().connected), false);
  const data = await pageFor();
  const cid = 'Qm' + 'a'.repeat(44);
  const uploads = [];
  await data.route('**/decent.config.js', route => route.fulfill({ contentType: 'text/javascript', body: `window.DECENT_CONFIG={data:{export:async()=>({publicSynthetic:'selected only'}),import:async data=>{window.restored=data}}};` }));
  await data.route('https://api.pinata.cloud/**', async route => {
    uploads.push({ url: route.request().url(), body: route.request().postData(), headers: route.request().headers() });
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ IpfsHash: cid }) });
  });
  await data.route(`https://ipfs.io/ipfs/${cid}`, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ publicSynthetic: 'restored only' }) }));
  data.on('dialog', dialog => dialog.accept());
  await data.goto(base);
  await data.evaluate(() => localStorage.setItem('privateUnrelated', 'must-not-upload'));
  await data.getByRole('button', { name: 'Open IPFS controls' }).click();
  await data.getByLabel('Own Pinata JWT').fill('synthetic-not-a-real-token');
  await data.getByRole('button', { name: 'Use provider' }).click();
  assert.equal(uploads.length, 0);
  await data.getByRole('button', { name: 'Open app backups controls' }).click();
  await data.getByRole('button', { name: 'Upload backup' }).click();
  await data.getByText(`Backup CID: ${cid}`, { exact: true }).waitFor();
  assert.equal(uploads.length, 1);
  assert.match(uploads[0].body, /selected only/);
  assert.doesNotMatch(uploads[0].body, /must-not-upload|privateUnrelated/);
  assert.equal(uploads[0].headers.authorization, 'Bearer synthetic-not-a-real-token');
  await data.getByLabel('Backup CID', { exact: true }).fill(cid);
  await data.getByRole('button', { name: 'Restore backup' }).click();
  await data.getByText('Host restore completed.', { exact: true }).waitFor();
  assert.deepEqual(await data.evaluate(() => window.restored), { publicSynthetic: 'restored only' });
  await data.getByLabel('Public content CID').fill(cid);
  await data.getByRole('button', { name: 'Request community pin' }).click();
  await data.getByText('Community pinning requires explicit opt-in').waitFor();
  assert.equal(uploads.length, 1);
  await data.getByRole('checkbox').check();
  await data.getByRole('button', { name: 'Request community pin' }).click();
  await data.getByText('Pin request accepted; not proof of retention or reward eligibility.').waitFor();
  assert.equal(uploads.length, 2);
  assert.equal(await data.getByRole('checkbox').isChecked(), false);
  const fixture = await pageFor();
  await fixture.goto(`${base}/test/ipfs-host.html`);
  assert.equal(await fixture.evaluate(() => window.ipfsFixture.reads), 0);
  await fixture.locator('#backup-host').getByRole('button', { name: 'Open IPFS controls' }).click();
  await fixture.getByRole('button', { name: 'Open app backups controls' }).click();
  await fixture.getByRole('dialog', { name: 'Synthetic host panel' }).waitFor();
  assert.deepEqual(await fixture.evaluate(() => window.ipfsFixture.opens), ['backup']);
  assert.deepEqual(errors, [], 'No console errors / unhandled exceptions');
  assert.deepEqual(failed, [], 'No failed requests');
  console.log('PASS: desktop/mobile, provider choices, About, animation/reduced-motion, EIP-6963/ethers lifecycle, explicit backup/restore, opt-in pins, unchanged host adapter; no console errors or failed requests.');
  if (shots) console.log(`Screenshots: ${shots}`);
} finally { await browser.close(); }
