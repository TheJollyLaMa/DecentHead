import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  const path = resolve(root, `.${new URL(request.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(request.url, 'http://localhost').pathname}`);
  if (!path.startsWith(`${resolve(root)}${sep}`)) { response.writeHead(403).end(); return; }
  try {
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' }).end(body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Resource unavailable');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const probes = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let authenticated = false;
  await page.route('https://api.pinata.cloud/**', async route => {
    const request = route.request();
    assert.equal(request.url(), 'https://api.pinata.cloud/data/testAuthentication');
    assert.equal(request.method(), 'GET');
    assert.equal(request.postData(), null);
    assert.equal(request.headers().authorization, 'Bearer synthetic-browser-credential');
    probes.push('pinata');
    await route.fulfill({ status: authenticated ? 200 : 401, json: authenticated
      ? { message: 'Congratulations! You are communicating with the Pinata API!' } : { error: 'Unauthorized' } });
  });
  await page.route('http://127.0.0.1:5001/**', async route => {
    assert.equal(route.request().url(), 'http://127.0.0.1:5001/api/v0/version');
    assert.equal(route.request().method(), 'POST');
    assert.equal(route.request().headers().authorization, undefined);
    assert.equal(route.request().postData(), null);
    probes.push('local');
    await route.fulfill({ json: { Version: '0.34.0' } });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.getByRole('button', { name: 'Open IPFS controls', exact: true }).click();
  await page.locator('ipfs-controls #provider-settings').evaluate(element => { element.open = true; });
  assert.deepEqual(probes, []);
  await page.locator('ipfs-controls #jwt').fill('synthetic-browser-credential');
  await page.locator('ipfs-controls #save-provider').click();
  assert.deepEqual(probes, []);
  assert.notEqual(await page.locator('ipfs-status .orb').getAttribute('data-state'), 'ready');
  const message = page.locator('ipfs-controls #provider-message');
  await page.locator('ipfs-controls #verify-provider').click();
  await message.filter({ hasText: 'HTTP 401' }).waitFor();
  assert.equal(await page.evaluate(() => window.DecentHead.getIpfs().snapshot().connection.state), 'error');
  assert.notEqual(await page.locator('ipfs-status .orb').getAttribute('data-state'), 'ready');
  authenticated = true;
  await page.locator('ipfs-controls #verify-provider').click();
  await message.filter({ hasText: 'Pinata authenticated' }).waitFor();
  assert.equal(await page.evaluate(() => window.DecentHead.getIpfs().snapshot().connection.state), 'ready');
  assert.equal(await page.locator('ipfs-status .orb').getAttribute('data-state'), 'ready');
  await page.locator('ipfs-controls #provider').selectOption('local');
  await page.locator('ipfs-controls #save-provider').click();
  assert.equal(await page.evaluate(() => window.DecentHead.getIpfs().snapshot().connection.state), 'unverified');
  assert.notEqual(await page.locator('ipfs-status .orb').getAttribute('data-state'), 'ready');
  await page.locator('ipfs-controls #verify-provider').click();
  await message.filter({ hasText: 'Local Kubo version endpoint responded' }).waitFor();
  assert.deepEqual(probes, ['pinata', 'pinata', 'local']);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log('PASS: provider choice is inert; Pinata401/ready and Kubo ready explicit probes; no upload/pin/body or credential leakage;375px.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
