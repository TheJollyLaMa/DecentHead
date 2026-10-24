import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { presentationHtml, productCardUrl } from '../scripts/render-product-supporter.mjs';
import { buildSupporterMetadata, supporterQuantity } from '../scripts/supporter-metadata.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const inputsOf = yml => [...yml.split('workflow_call:')[1].split('secrets:')[0].matchAll(/^ {6}(\w+):$/gm)].map(m => m[1]);
const withOf = yml => [...yml.split('with:')[1].split('secrets:')[0].matchAll(/^ {6}(\w+):/gm)].map(m => m[1]);

for (const [template, reusable] of [['supporter-release.yml', 'product-supporter-prepare.yml'], ['supporter-announce.yml', 'product-supporter-announce.yml']]) {
  test(`${template} calls ${reusable} with a matching pin and known inputs`, () => {
    const caller = read(`templates/supporter/${template}`), called = read(`.github/workflows/${reusable}`);
    assert.match(caller, new RegExp(`uses: TheJollyLaMa/DecentHead/\\.github/workflows/${reusable.replace('.', '\\.')}@DECENTHEAD_SHA\\n`));
    assert.match(caller, /head_ref: DECENTHEAD_SHA\n/);
    const known = inputsOf(called);
    for (const key of withOf(caller)) assert.ok(known.includes(key), `${key} is an input of ${reusable}`);
    assert.ok(withOf(caller).includes('head_ref'));
    assert.match(caller, /permissions:\n {2}contents: write\n {2}issues: write/);
    assert.match(called, /persist-credentials: false/);
  });
}

test('product card URL carries only validated release identity', () => {
  const url = new URL(productCardUrl('http://127.0.0.1:8790/', {
    repo: 'TheJollyLaMa/BigNuten_Vanilla', name: 'BigNuten', version: 'v0.1.0', releaseDate: '2026-05-01T12:00:00.000Z',
    creatorAddress: `0x${'2'.repeat(40)}`, tagline: 'x'.repeat(300),
  }));
  assert.equal(url.pathname, '/supporter/product-card.html');
  assert.equal(url.searchParams.get('name'), 'BigNuten');
  assert.equal(url.searchParams.get('tagline').length, 160);
  const base = { repo: 'a/b', version: 'v1', releaseDate: '2026-05-01T12:00:00.000Z', creatorAddress: `0x${'1'.repeat(40)}` };
  assert.throws(() => productCardUrl('http://x', { ...base, repo: 'bad' }));
  assert.throws(() => productCardUrl('http://x', { ...base, releaseDate: '2026-05-01' }));
  assert.throws(() => productCardUrl('http://x', { ...base, creatorAddress: 'thejollylama.eth' }));
  assert.throws(() => productCardUrl('http://x', { ...base, version: 'v1 <b>' }));
});

test('presentation strips markup from the title', () => {
  const html = presentationHtml('<script>Big</script>', 'AA==', 'AA==');
  assert.doesNotMatch(html, /<script>Big/);
  assert.match(html, /scriptBig\/script Supporter DNFT/);
});

test('edition supply is explicit across workflow, card URL, metadata and both card faces', () => {
  const identity = { repo: 'A-Decent-Agency/DBuskRadio', version: 'v0.2.0',
    releaseDate: '2026-10-24T20:00:00.000Z', creatorAddress: `0x${'1'.repeat(40)}` };
  for (const quantity of ['100', '1000']) {
    const url = new URL(productCardUrl('http://localhost', { ...identity, quantity }));
    assert.equal(url.searchParams.get('quantity'), quantity);
    const metadata = buildSupporterMetadata({ ...identity, commit: 'a'.repeat(40),
      release: { quantity } });
    assert.equal(metadata.properties.supply, Number(quantity));
    assert.equal(metadata.attributes.find(item => item.trait_type === 'supply').value, Number(quantity));
  }
  assert.equal(supporterQuantity(), '1000');
  for (const bad of ['', '0', '0100', '99', '100.0', '10000', 100, null]) {
    assert.throws(() => supporterQuantity(bad));
    assert.throws(() => productCardUrl('http://localhost', { ...identity, quantity: bad }));
  }
  const card = read('supporter/product-card.html');
  assert.equal((card.match(/class="edition"/g) || []).length, 2);
  assert.match(card, /supporterQuantity\(params\.get\('quantity'\)/);
  assert.doesNotMatch(card, /Edition of 1,000/);
  const workflow = read('.github/workflows/product-supporter-prepare.yml');
  assert.equal((workflow.match(/SUPPORTER_QUANTITY: \$\{\{ inputs\.quantity \}\}/g) || []).length, 2);
  assert.match(read('scripts/prepare-supporter-release.mjs'), /Artwork and requested edition supply differ/);
});

test('product card fills text without HTML injection', () => {
  const card = read('supporter/product-card.html');
  assert.doesNotMatch(card, /innerHTML/);
  assert.match(card, /textContent = value/);
  assert.match(card, /src="product-preview\.png"/);
});
