import { test } from 'node:test';
import assert from 'node:assert/strict';

test('wallet session is click-only, shares BrowserProvider, handles lifecycle and removes listeners', async () => {
  globalThis.window = new EventTarget();
  globalThis.ethers = { BrowserProvider: class { constructor(raw) { this.raw = raw; } } };
  const { WalletSession } = await import('../js/wallet.js');
  const methods = [], listeners = new Map();
  const raw = {
    isMetaMask: true,
    async request({ method }) {
      methods.push(method);
      if (method === 'eth_chainId') return '0x2105';
      if (method === 'eth_requestAccounts') return ['0x' + '1'.repeat(40)];
      throw new Error('Unexpected request');
    },
    on(event, handler) { listeners.set(event, handler); },
    removeListener(event, handler) { if (listeners.get(event) === handler) listeners.delete(event); },
  };
  window.ethereum = raw;
  const session = new WalletSession(), emitted = [];
  window.addEventListener('decenthead:wallet', event => emitted.push(event.detail));
  assert.deepEqual(methods, []);
  assert.equal(session.available()[0].provider, raw);
  await session.connect();
  assert.equal(session.snapshot().provider.raw, raw);
  assert.equal(session.snapshot().connected, true);
  assert.equal(methods.filter(method => method === 'eth_requestAccounts').length, 1);
  listeners.get('accountsChanged')(['0x' + '2'.repeat(40)]);
  assert.equal(session.snapshot().address, '0x' + '2'.repeat(40));
  listeners.get('chainChanged')('0xa');
  assert.equal(session.snapshot().chainId, '0xa');
  assert.equal(emitted.at(-1).chainId, '0xa');
  listeners.get('disconnect')();
  assert.equal(session.snapshot().connected, false);
  assert.equal(listeners.size, 0);
  await session.connect(raw);
  listeners.get('accountsChanged')([]);
  assert.equal(session.snapshot().address, null);
  assert.equal(listeners.size, 0);
  assert.equal(methods.includes('wallet_requestPermissions'), false);
});
