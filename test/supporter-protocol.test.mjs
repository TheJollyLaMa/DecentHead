import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers, nftABI, USDC, APPROVED_NFT, APPROVED_ESCROW, pendingReleases, validateManifest, validateEvidence, verifySnapshot, buildDiscordPayload, deliverDiscordRelease, alreadySent, assertDeliveryNotPending, pendingMarkerName, markerName } from '../scripts/supporter-protocol.mjs';
import { buildSupporterMetadata } from '../scripts/supporter-metadata.mjs';
import { registeredEvidence } from '../scripts/supporter-protocol.mjs';

const nft = APPROVED_NFT;
const escrow = APPROVED_ESCROW;
const creator = '0x3333333333333333333333333333333333333333';
const tx = '0x' + 'a'.repeat(64);
const iface = new ethers.Interface(nftABI);
function fixture(batch = false) {
  const manifest = {
    schema: 1, repo: 'TheJollyLaMa/DecentHead', version: 'v2.0.0', releaseDate: '2026-10-21T20:00:00.000Z',
    creator: 'thejollylama.eth', creatorAddress: creator, chainId: 8453, quantity: '1000', priceUSDC: '10000000',
    metadataURI: 'ipfs://bafyfixturemetadata', front: 'ipfs://bafyfixturefront', back: 'ipfs://bafyfixtureback', animation: 'ipfs://bafyfixturehtml',
  };
  const evidence = { chainId: 8453, rpcUrl: 'https://mainnet.base.org', mintTxHash: tx, nftContract: nft, escrow, tokenId: '7', listingId: '3', confirmations: 12, purchaseUrl: `https://example.org/shop?chainId=8453&escrow=${escrow}&listingId=3` };
  const event = iface.encodeEventLog(iface.getEvent(batch ? 'TransferBatch' : 'TransferSingle'),
    batch ? [creator, ethers.ZeroAddress, creator, [8, 7], [2, 1000]] : [creator, ethers.ZeroAddress, creator, 7, 1000]);
  const snapshot = {
    chainId: 8453, blockNumber: 111, receipt: { status: 1, hash: tx, blockNumber: 100, logs: [{ address: nft, ...event }] },
    metadataURI: manifest.metadataURI, listing: { nftContract: nft, tokenId: 7n, priceETH: 0n, priceToken: USDC, priceAmount: 10000000n, available: 998n, active: true },
    paused: false, escrowBalance: 998n,
  };
  return { manifest, evidence, snapshot };
}
test('single and batch ERC1155 mint evidence verifies Base $10 USDC stocked listing', () => {
  for (const batch of [false, true]) {
    const { manifest, evidence, snapshot } = fixture(batch);
    assert.equal(verifySnapshot(manifest, evidence, snapshot).available, '998');
  }
});
test('registered evidence accepts unchanged Studio exports and strict release envelopes', () => {
  const { manifest, evidence, snapshot } = fixture();
  const envelope = { schema: 1, repo: manifest.repo, version: manifest.version, metadataURI: manifest.metadataURI, mint: evidence };
  assert.deepEqual(registeredEvidence(manifest, evidence), evidence);
  assert.deepEqual(registeredEvidence(manifest, envelope), evidence);
  for (const patch of [{ repo: 'Other/Project' }, { version: 'different' }, { metadataURI: 'ipfs://wrong' }])
    assert.throws(() => registeredEvidence(manifest, { ...envelope, ...patch }), /release mismatch/);
  assert.throws(() => registeredEvidence(manifest, {}));
  assert.throws(() => verifySnapshot(manifest, registeredEvidence(manifest, evidence),
    { ...snapshot, metadataURI: 'ipfs://another-release' }), /metadata URI/);
});
const invalid = {
  'missing receipt': s => { s.receipt = null; },
  'failed receipt': s => { s.receipt.status = 0; },
  'wrong transaction': s => { s.receipt.hash = '0x' + 'b'.repeat(64); },
  'malformed logs': s => { s.receipt.logs = null; },
  'malformed encoded mint': s => { s.receipt.logs[0].data = '0x01'; },
  'wrong mint contract': s => { s.receipt.logs[0].address = escrow; },
  'wrong mint token': s => { const event = iface.encodeEventLog(iface.getEvent('TransferSingle'), [creator, ethers.ZeroAddress, creator, 8, 1000]); Object.assign(s.receipt.logs[0], event); },
  'not a mint': s => { const event = iface.encodeEventLog(iface.getEvent('TransferSingle'), [creator, creator, escrow, 7, 1000]); Object.assign(s.receipt.logs[0], event); },
  'wrong quantity': s => { const event = iface.encodeEventLog(iface.getEvent('TransferSingle'), [creator, ethers.ZeroAddress, creator, 7, 1]); Object.assign(s.receipt.logs[0], event); },
  'too few confirmations': s => { s.blockNumber = 110; },
  'wrong chain': s => { s.chainId = 1; },
  'metadata mismatch': s => { s.metadataURI = 'ipfs://different'; },
  'listing token mismatch': s => { s.listing.tokenId = 8n; },
  'missing listing': s => { s.listing = null; },
  'inactive listing': s => { s.listing.active = false; },
  'empty listing': s => { s.listing.available = 0n; },
  'paused escrow': s => { s.paused = true; },
  'wrong payment asset': s => { s.listing.priceToken = creator; },
  'wrong price': s => { s.listing.priceAmount = 1n; },
  'ETH listing': s => { s.listing.priceETH = 1n; },
  'insufficient escrow balance': s => { s.escrowBalance = 1n; },
};
for (const [name, mutate] of Object.entries(invalid)) test(`rejects ${name}`, () => {
  const { manifest, evidence, snapshot } = fixture();
  mutate(snapshot);
  assert.throws(() => verifySnapshot(manifest, evidence, snapshot));
});
test('manifest rejects unresolved identity, unfrozen date, wrong price and missing assets', () => {
  for (const patch of [{ creatorAddress: ethers.ZeroAddress }, { creator: 'placeholder.eth' }, { releaseDate: 'today' }, { priceUSDC: '1' }, { front: '' }, { metadataURI: '' }]) {
    assert.throws(() => validateManifest({ ...fixture().manifest, ...patch }));
  }
});
test('evidence rejects under-confirmation and unbound purchase URL', () => {
  for (const patch of [{ nftContract: creator }, { escrow: creator }, { confirmations: 1 }, { purchaseUrl: 'https://example.org' }, { rpcUrl: 'http://localhost' }, { rpcUrl: 'https://user:secret@example.org' }, { rpcUrl: 'https://example.org?apiKey=secret' }, { tokenId: '-1' }]) {
    assert.throws(() => validateEvidence({ ...fixture().evidence, ...patch }));
  }
});
test('scheduled discovery selects only published prepared releases with evidence and no marker', () => {
  const asset = name => ({ name });
  const ready = { tag_name: 'v2', draft: false, assets: ['supporter-release.json', 'supporter-evidence.json'].map(asset) };
  assert.deepEqual(pendingReleases([
    ready,
    { ...ready, tag_name: 'draft', draft: true },
    { ...ready, tag_name: 'already-sent', assets: [...ready.assets, asset(markerName())] },
    { ...ready, tag_name: 'awaiting-evidence', assets: [asset('supporter-release.json')] },
    { ...ready, tag_name: 'unprepared', assets: [asset('supporter-evidence.json')] },
  ]), ['v2']);
  assert.throws(() => pendingReleases(null), /inventory/);
});
test('Discord payload suppresses mentions, carries front image, purchase route and disclaimers', () => {
  const { manifest, evidence, snapshot } = fixture();
  manifest.version = '@everyone <@123>';
  const payload = buildDiscordPayload(manifest, verifySnapshot(manifest, evidence, snapshot));
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
  assert.equal(payload.username, 'Decent DNFT Bot');
  assert.ok(!payload.content.includes('@'));
  assert.match(payload.content, /no financial return guaranteed/);
  assert.match(payload.content, /Royalties are not universal/);
  assert.equal(payload.embeds[0].url, evidence.purchaseUrl);
  assert.equal(payload.embeds[0].image.url, 'https://gateway.pinata.cloud/ipfs/bafyfixturefront');
  assert.match(payload.content, /dated artifact of Decent history/);
  assert.throws(() => buildDiscordPayload(manifest, {}), /Verification required/);
});
test('persisted marker dedupes repo/version and rejects corrupt or mismatched marker', () => {
  const m = fixture().manifest;
  assert.equal(markerName(), 'supporter-discord-sent.json');
  assert.equal(alreadySent(null, m), false);
  assert.equal(alreadySent({ repo: m.repo, version: m.version, sentAt: m.releaseDate, messageId: '123456' }, m), true);
  assert.throws(() => alreadySent({ repo: m.repo, version: 'different', sentAt: m.releaseDate }, m), /reconciliation/);
  assert.throws(() => alreadySent({}, m), /reconciliation/);
});
test('a persisted pre-send claim blocks delivery retries after a crash or ambiguous webhook timeout', () => {
  assert.doesNotThrow(() => assertDeliveryNotPending([]));
  assert.throws(() => assertDeliveryNotPending([{ name: pendingMarkerName() }]), /Prior Discord delivery is unresolved/);
});
test('Discord delivery persists its claim before sending, then saves the acknowledged message ID', async () => {
  const { manifest, evidence, snapshot } = fixture();
  const calls = [];
  await deliverDiscordRelease({
    manifest, verified: verifySnapshot(manifest, evidence, snapshot), assets: [],
    webhook: 'https://discord.com/api/webhooks/123/test-only',
    saveAsset: async (name, value) => { calls.push({ name, value }); },
    fetcher: async (url, options) => {
      assert.equal(calls[0].name, pendingMarkerName());
      assert.equal(url, 'https://discord.com/api/webhooks/123/test-only?wait=true');
      assert.deepEqual(JSON.parse(options.body).allowed_mentions.parse, []);
      return { ok: true, json: async () => ({ id: '456' }) };
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].name, markerName());
  assert.equal(calls[1].value.messageId, '456');
});
test('ambiguous delivery leaves a durable claim, hides credentials and prevents a second request', async () => {
  const { manifest, evidence, snapshot } = fixture();
  const assets = [];
  let requests = 0;
  const options = {
    manifest, verified: verifySnapshot(manifest, evidence, snapshot), assets,
    webhook: 'https://discord.com/api/webhooks/123/test-only',
    saveAsset: async name => { assets.push({ name }); },
    fetcher: async () => { requests++; throw new Error('secret webhook credential'); },
  };
  await assert.rejects(deliverDiscordRelease(options), { message: 'Discord delivery unconfirmed after network failure; reconcile before retry' });
  await assert.rejects(deliverDiscordRelease(options), /Prior Discord delivery is unresolved/);
  assert.equal(requests, 1);
  assert.deepEqual(assets, [{ name: pendingMarkerName() }]);
});
test('a failed pre-send claim makes no Discord request', async () => {
  const { manifest, evidence, snapshot } = fixture();
  await assert.rejects(deliverDiscordRelease({
    manifest, verified: verifySnapshot(manifest, evidence, snapshot), assets: [],
    webhook: 'https://discord.com/api/webhooks/123/test-only',
    saveAsset: async () => { throw new Error('release upload failed'); },
    fetcher: async () => { assert.fail('must not send before the durable claim'); },
  }), /release upload failed/);
});
test('release metadata uses front image, back property, animation and date without claiming mint', () => {
  const release = fixture().manifest;
  const metadata = buildSupporterMetadata({ repo: release.repo, version: release.version, commit: 'a'.repeat(40), codeArchiveCid: 'bafyfixturearchive', image: release.front, release });
  assert.equal(metadata.image, release.front);
  assert.equal(metadata.animation_url, release.animation);
  assert.equal(metadata.properties.back_image, release.back);
  assert.equal(metadata.properties.creator_address, creator);
  assert.equal(metadata.properties.release_date, release.releaseDate);
  assert.equal(metadata.properties.minted_date, undefined);
  assert.deepEqual(metadata.properties.product, {
    version: release.version,
    repo_url: `https://github.com/${release.repo}`,
    commit: `https://github.com/${release.repo}/commit/${'a'.repeat(40)}`,
    artifact_cid: 'ipfs://bafyfixturearchive',
  });
  assert.equal(metadata.properties.version, release.version);
  assert.equal(metadata.properties.code_archive_cid, 'bafyfixturearchive');
  assert.ok(metadata.attributes.every(attribute => attribute.value === null || typeof attribute.value !== 'object'));
});
