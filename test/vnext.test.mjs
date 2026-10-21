import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeConfig, defaults } from '../js/config.js';
import { chainParams, discoverProvider, switchChain } from '../js/wallet-logic.js';
import { buildSupporterMetadata } from '../scripts/supporter-metadata.mjs';
import { IPFSSession } from '../js/ipfs.js';
import { safeURL, escapeHTML } from '../js/ui.js';

test('config merges nested defaults and replaces lists without mutating inputs', () => {
  const value = mergeConfig(defaults, { theme: { accent: 'red' }, providers: { local: { apiUrl: 'http://localhost:5001' } }, links: [{ label: 'Host' }] });
  assert.equal(value.providers.pinata.uploadUrl, defaults.providers.pinata.uploadUrl);
  assert.equal(value.providers.local.apiUrl, 'http://localhost:5001');
  assert.equal(defaults.providers.local.apiUrl, 'http://127.0.0.1:5001');
  assert.equal(value.links.length, 1);
  assert.equal(mergeConfig(defaults, { supporterDnft: null }).supporterDnft, null);
  assert.equal(mergeConfig(defaults, JSON.parse('{"__proto__":{"polluted":true}}')).polluted, undefined);
  assert.equal({}.polluted, undefined);
});
test('chain params normalize decimal and hexadecimal IDs', () => {
  const value = chainParams(defaults.chain);
  assert.deepEqual(value.switchParams, [{ chainId: '0x2105' }]);
  assert.equal(value.addParams[0].chainName, 'Base');
  assert.equal(chainParams({ ...defaults.chain, chainId: '0xa' }).switchParams[0].chainId, '0xa');
  assert.throws(() => chainParams({ chainId: 0 }));
});
test('EIP-6963 reducer validates announcements, deduplicates and prefers MetaMask', () => {
  const provider = { request() {} }, other = { request() {} };
  const a = { info: { uuid: 'a', name: 'Other', rdns: 'other' }, provider };
  const b = { info: { uuid: 'b', name: 'MetaMask', rdns: 'io.metamask' }, provider: other };
  const state = discoverProvider(discoverProvider([], a), b);
  assert.equal(state[0].info.name, 'MetaMask');
  assert.equal(discoverProvider(state, a), state);
  assert.equal(discoverProvider(state, { ...a, info: { ...a.info, uuid: 'c' } }), state);
  assert.equal(discoverProvider(state, { info: {}, provider: {} }), state);
});
test('unknown chain adds then switches; rejected switch never adds a chain', async () => {
  const methods = []; let current = '0x1';
  const provider = { async request({ method, params }) {
    methods.push(method);
    if (method === 'eth_chainId') return current;
    if (method === 'wallet_switchEthereumChain') {
      if (!methods.includes('wallet_addEthereumChain')) throw Object.assign(new Error('Unknown chain'), { code: 4902 });
      current = params[0].chainId;
    }
  } };
  await switchChain(provider, defaults.chain);
  assert.deepEqual(methods, ['eth_chainId', 'wallet_switchEthereumChain', 'wallet_addEthereumChain', 'wallet_switchEthereumChain', 'eth_chainId']);
  let adds = 0;
  await assert.rejects(() => switchChain({ request: async ({ method }) => {
    if (method === 'eth_chainId') return '0x1';
    if (method === 'wallet_addEthereumChain') adds++;
    throw Object.assign(new Error('Rejected'), { code: 4001 });
  } }, defaults.chain), /Rejected/);
  assert.equal(adds, 0);
});
test('metadata includes every S11 value with deterministic defaults', () => {
  const value = buildSupporterMetadata({ repo: 'TheJollyLaMa/DecentHead', version: 'v2.0.0', commit: 'a'.repeat(40), codeArchiveCid: 'bafyexample' });
  assert.equal(value.name, 'DecentHead v2.0.0 Supporter DNFT');
  assert.deepEqual(value.properties, { repo:'TheJollyLaMa/DecentHead', version:'v2.0.0', commit:'a'.repeat(40), code_archive_cid:'bafyexample', license:'Apache-2.0 + NOTICE', supply:1000, price:'10 USDC', chain:'Base', royalty_bps:1000 });
  assert.equal(value.attributes.length, 9);
  assert.match(value.image, /img\/IPFS_Logo.png$/);
  assert.throws(() => buildSupporterMetadata({ repo: 'invalid' }));
});
test('IPFS rejects unconsented pins, invalid CIDs and missing credentials before network access', async () => {
  const session = new IPFSSession();
  await assert.rejects(() => session.pin('invalid'), /opt-in/);
  await assert.rejects(() => session.restore('https://malicious.example/'), /valid CID/);
  await assert.rejects(() => session.upload({ selected: true }), /Enter your Pinata/);
});

test('optional art and unsafe URLs never produce fetchable placeholder or script links', () => {
  for (const value of [null, undefined, '', 'javascript:alert(1)', 'data:text/html,bad']) assert.equal(safeURL(value), '');
  assert.equal(safeURL('https://example.org/icon.png'), 'https://example.org/icon.png');
  assert.equal(escapeHTML('<script>'), '&lt;script&gt;');
});
