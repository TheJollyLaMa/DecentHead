import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { productCardUrl } from '../scripts/render-product-supporter.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const files = {
    '/supporter/product-card.html': ['text/html', await readFile(new URL('../supporter/product-card.html', import.meta.url))],
    '/scripts/supporter-metadata.mjs': ['text/javascript', await readFile(new URL('../scripts/supporter-metadata.mjs', import.meta.url))],
    '/supporter/product-preview.png': ['image/png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')],
  };
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()), file = files[url.pathname];
    assert.equal(url.origin, 'http://supporter-card.test', 'card does not contact external services');
    assert.ok(file, `expected card resource: ${url.pathname}`);
    await route.fulfill({ contentType: file[0], body: file[1] });
  });
  for (const name of ['DecentCalendar', 'DecentPilgrimages', 'DecentCanopy', 'W'.repeat(40)]) {
    const url = productCardUrl('http://supporter-card.test', {
      repo: 'TheJollyLaMa/DecentPilgrimages', name, version: 'v0.1.1',
      releaseDate: '2026-11-05T12:00:00.000Z',
      creatorAddress: `0x${'1'.repeat(40)}`, quantity: '1000', priceUSDC: '10000000',
    });
    await page.goto(url);
    await page.waitForFunction(() => document.body.dataset.cardReady === 'true');
    assert.equal(await page.locator('#title').innerText(), name);
    for (const back of [false, true]) {
      await page.locator('body').evaluate((body, back) => body.classList.toggle('back', back), back);
      const bounds = await page.locator('.card > *').evaluateAll(elements => elements
        .filter(element => getComputedStyle(element).display !== 'none')
        .map(element => {
          const box = element.getBoundingClientRect();
          return { name: element.id || element.className, left: box.left, right: box.right,
            top: box.top, bottom: box.bottom, width: box.width, scrollWidth: element.scrollWidth };
        }));
      for (const box of bounds) {
        assert.ok(box.left >= 22 && box.right <= 1178, `${name}/${back}: ${box.name} horizontal bounds`);
        assert.ok(box.top >= 22 && box.bottom <= 1178, `${name}/${back}: ${box.name} vertical bounds`);
        assert.ok(box.scrollWidth <= Math.ceil(box.width) + 1, `${name}/${back}: ${box.name} text fits`);
      }
      assert.equal(await page.locator('#title').evaluate(element => getComputedStyle(element).whiteSpace), 'nowrap');
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: front/back card typography fits Calendar, Pilgrimages, Canopy and 40-character names without wrapping, clipping or external requests.');
} finally {
  await browser.close();
}
