// Optional smoke check: PLAYWRIGHT_MODULE may point to an existing Playwright installation.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { ethers } from '../scripts/supporter-protocol.mjs';
import { BASE_SUPPORTER, SUPPORTER_ESCROW_ABI } from '../js/supporter-purchase.js';
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
async function checkAnkhMenus(page) {
  const url = page.url();
  for (const [menu, item] of [['Admin menu', 'Admin'], ['Profile menu', 'My Profile']]) {
    const trigger = page.getByRole('button', { name: menu, exact: true });
    await trigger.click();
    await page.getByRole('button', { name: item, exact: true }).click();
    assert.equal(page.url(), url);
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.getByRole('button', { name: item, exact: true }).isVisible(), true);
    const box = await page.getByRole('button', { name: item, exact: true }).boundingBox();
    const viewport = page.viewportSize();
    assert.ok(box.x >= 0 && box.x + box.width <= viewport.width);
    assert.ok(box.y >= 0 && box.y + box.height <= viewport.height);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: item, exact: true }).isVisible(), false);
    await trigger.click();
    await page.locator('main').click({ position: { x: 8, y: 8 } });
    assert.equal(await page.getByRole('button', { name: item, exact: true }).isVisible(), false);
  }
}
async function checkWalletOrbit(page) {
  const measurements = await page.locator('wallet-connect .account-orbit').evaluate(rotor => {
    const animation = rotor.getAnimations()[0];
    animation?.pause();
    const results = [];
    for (const time of [0, 4500, 9000, 13500]) {
      if (animation) animation.currentTime = time;
      const box = rotor.getBoundingClientRect(), size = rotor.offsetWidth;
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const icons = [...rotor.querySelectorAll('.account-logos img')].map(img => {
        const rect = img.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      });
      const text = rotor.querySelector('text'), matrix = text.getScreenCTM();
      const glyphs = [...text.textContent].flatMap((char, index) => {
        if (char.trim() === '') return [];
        const rect = text.getExtentOfChar(index);
        return [new DOMPoint(rect.x + rect.width / 2, rect.y + rect.height / 2).matrixTransform(matrix)];
      });
      results.push({
        radii: icons.map(icon => Math.hypot(icon.x - center.x, icon.y - center.y) / size),
        clearance: Math.min(...icons.flatMap(icon => glyphs.map(glyph => Math.hypot(icon.x - glyph.x, icon.y - glyph.y) / size))),
      });
    }
    animation?.play();
    return results;
  });
  for (const measurement of measurements) {
    for (const radius of measurement.radii) assert.ok(Math.abs(radius - .4) < .005, `Logo radius ${radius} must match the text ring`);
    assert.ok(measurement.clearance > .09, `Text/logo clearance ${measurement.clearance} must preserve the reserved arc`);
  }
}
try {
  const desktop = await pageFor({ viewport: { width: 1440, height: 900 } });
  await desktop.goto(base);
  await desktop.getByRole('button', { name: 'Connect wallet', exact: true }).waitFor();
  assert.equal(await desktop.getByRole('button', { name: 'Connect wallet', exact: true }).isDisabled(), true);
  assert.equal(await desktop.getByRole('link', { name: 'Open MetaMask' }).getAttribute('href'), `https://metamask.app.link/dapp/${new URL(base).host}/`);
  const animation = () => desktop.evaluate(() => getComputedStyle(document.querySelector('decent-header').shadowRoot.querySelector('.dh-background'), '::after').animationName);
  assert.equal(await animation(), 'dh-drift');
  await shot(desktop, 'desktop');
  await checkAnkhMenus(desktop);
  await desktop.getByRole('button', { name: 'DecentHead', exact: true }).click();
  await desktop.getByRole('heading', { name: 'About DecentHead' }).waitFor();
  await shot(desktop, 'about');
  await desktop.getByRole('button', { name: 'Close', exact: true }).click();
  await desktop.getByRole('button', { name: 'Open IPFS controls' }).click();
  await desktop.getByText('Storage provider', { exact: true }).waitFor();
  assert.equal(await desktop.getByLabel('Own Pinata JWT').isVisible(), false);
  await shot(desktop, 'ipfs-overview');
  await desktop.getByText('Storage provider', { exact: true }).click();
  assert.equal(await desktop.locator('#provider option').count(), 2);
  assert.equal(await desktop.locator('#provider').inputValue(), 'pinata');
  await shot(desktop, 'ipfs-providers');
  await desktop.getByLabel('Provider', { exact: true }).selectOption('local');
  assert.equal(await desktop.getByLabel('Own Pinata JWT').isVisible(), false);
  await desktop.getByLabel('Provider', { exact: true }).selectOption('pinata');
  assert.equal(await desktop.getByLabel('Own Pinata JWT').isVisible(), true);
  await desktop.getByRole('button', { name: 'Close', exact: true }).click();
  await desktop.getByRole('button', { name: 'Open IPFS controls' }).click();
  await desktop.keyboard.press('Escape');
  assert.equal(await desktop.getByRole('dialog').count(), 0);
  await desktop.getByRole('button', { name: 'DecentHead', exact: true }).click();
  await desktop.mouse.click(8, 8);
  assert.equal(await desktop.getByRole('dialog').count(), 0);
  await desktop.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await animation(), 'none');
  assert.equal(await desktop.evaluate(() => window.DecentHead.getWallet().snapshot().connected), false);
  const mobile = await pageFor({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
  await mobile.goto(base);
  await mobile.getByRole('link', { name: 'Open MetaMask' }).waitFor();
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await shot(mobile, 'mobile-no-wallet');
  await checkAnkhMenus(mobile);
  await mobile.getByRole('button', { name: 'Open IPFS controls' }).click();
  await mobile.getByText('Storage provider', { exact: true }).waitFor();
  const modalBounds = await mobile.getByRole('dialog').boundingBox();
  assert.ok(modalBounds.width <= 390 && modalBounds.height <= 844);
  await shot(mobile, 'mobile-ipfs');
  await mobile.getByRole('button', { name: 'Close', exact: true }).click();
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
  await injected.evaluate(() => { window.DecentHead.getWallet().lookupName = async address => address.startsWith('0x111') ? 'thejollylama.eth' : null; });
  await injected.getByRole('combobox', { name: 'Choose wallet' }).waitFor();
  assert.deepEqual(await injected.evaluate(() => window.mockMethods), []);
  assert.equal(await injected.getByRole('combobox', { name: 'Choose wallet' }).inputValue(), '0');
  assert.equal(await injected.locator('wallet-connect option').first().textContent(), 'MetaMask');
  await injected.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await injected.getByRole('button', { name: 'Disconnect wallet' }).waitFor();
  await injected.getByText('thejollylama.eth · Base', { exact: true }).waitFor();
  assert.equal(await injected.locator('wallet-connect .account-logos img').count(), 4);
  await checkWalletOrbit(injected);
  await checkAnkhMenus(injected);
  assert.equal(await injected.locator('wallet-connect .spark.chain:visible').count(), 4);
  assert.equal(await injected.evaluate(() => window.mockMethods.filter(method => method === 'eth_requestAccounts').length), 1);
  assert.equal(await injected.evaluate(() => window.DecentHead.getWallet().snapshot().chainId), '0x2105');
  await shot(injected, 'wallet-connected');
  await injected.setViewportSize({ width: 390, height: 844 });
  await checkWalletOrbit(injected);
  await shot(injected, 'mobile-wallet-connected');
  await injected.setViewportSize({ width: 1280, height: 720 });
  await injected.evaluate(() => window.mockWallet.emit('accountsChanged', ['0x2222222222222222222222222222222222222222']));
  assert.equal(await injected.evaluate(() => window.DecentHead.getWallet().snapshot().address), '0x2222222222222222222222222222222222222222');
  await injected.getByText('0x2222…2222 · Base', { exact: true }).waitFor();
  await injected.evaluate(() => window.mockWallet.emit('chainChanged', '0xa'));
  assert.equal(await injected.evaluate(() => window.DecentHead.getWallet().snapshot().chainId), '0xa');
  assert.match(await injected.locator('wallet-connect .spark.chain').first().getAttribute('src'), /optimism\.svg$/);
  await injected.evaluate(() => window.mockWallet.emit('chainChanged', '0x7a69'));
  assert.equal(await injected.locator('wallet-connect .spark.chain:visible').count(), 0);
  await injected.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await injected.locator('wallet-connect .account-orbit').evaluate(el => getComputedStyle(el).animationName), 'none');
  await injected.waitForFunction(() => document.querySelector('decent-header').shadowRoot.querySelector('wallet-connect').shadowRoot.querySelector('.account-logos img').currentSrc.endsWith('Ens_Eth_Breathe-still.png'));
  await injected.getByRole('button', { name: 'Disconnect wallet' }).click();
  assert.equal(await injected.evaluate(() => window.DecentHead.getWallet().snapshot().connected), false);
  assert.equal(await injected.locator('wallet-connect .spark.chain:visible').count(), 0);
  await injected.getByRole('button', { name: 'Connect wallet', exact: true }).waitFor();
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
  await data.getByText('Storage provider', { exact: true }).click();
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
  await data.getByText('Restore a backup', { exact: true }).click();
  await data.getByLabel('Backup CID', { exact: true }).fill(cid);
  await data.getByRole('button', { name: 'Restore backup' }).click();
  await data.getByText('Host restore completed.', { exact: true }).waitFor();
  assert.deepEqual(await data.evaluate(() => window.restored), { publicSynthetic: 'restored only' });
  await data.getByText('Community pinning', { exact: true }).click();
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
  const purchase = await pageFor();
  const escrowABI = new ethers.Interface(SUPPORTER_ESCROW_ABI);
  let active = true;
  await purchase.route('https://mainnet.base.org/**', async route => {
    const body = route.request().postDataJSON();
    const answer = rpc => {
      if (rpc.method === 'eth_chainId') return { id: rpc.id, jsonrpc: '2.0', result: '0x2105' };
      assert.equal(rpc.method, 'eth_call');
      const call = escrowABI.parseTransaction({ data: rpc.params[0].data });
      const result = call.name === 'getListing'
        ? [[BASE_SUPPORTER.nft, 7n, 0n, BASE_SUPPORTER.usdc, 10000000n, 1000n, active, 'Supporter']]
        : call.name === 'getNFTBalance' ? [1000n] : [false];
      return { id: rpc.id, jsonrpc: '2.0', result: escrowABI.encodeFunctionResult(call.name, result) };
    };
    await route.fulfill({ json: Array.isArray(body) ? body.map(answer) : answer(body) });
  });
  const purchaseURL = `${base}/supporter/buy.html?chainId=8453&escrow=${BASE_SUPPORTER.escrow}&listingId=3`;
  await purchase.goto(purchaseURL);
  await purchase.getByRole('button', { name: 'Review purchase' }).waitFor();
  assert.equal(await purchase.evaluate(() => window.DecentHead.getWallet().snapshot().connected), false);
  await purchase.getByRole('button', { name: 'Review purchase' }).click();
  await purchase.getByRole('button', { name: 'Buy from escrow' }).waitFor();
  await shot(purchase, 'supporter-purchase');
  active = false;
  await purchase.goto(purchaseURL);
  await purchase.getByRole('alert').waitFor();
  assert.match(await purchase.getByRole('alert').textContent(), /^Purchase unavailable:/);
  assert.equal(await purchase.getByRole('button', { name: 'Review purchase' }).isVisible(), false);
  assert.deepEqual(errors, [], 'No console errors / unhandled exceptions');
  assert.deepEqual(failed, [], 'No failed requests');
  console.log('PASS: desktop/mobile, provider choices, About, animation/reduced-motion, EIP-6963/ethers lifecycle, explicit backup/restore, opt-in pins, unchanged host adapter; no console errors or failed requests.');
  if (shots) console.log(`Screenshots: ${shots}`);
} finally { await browser.close(); }
