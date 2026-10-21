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
  const session = new WalletSession({ lookupName: async () => null }), emitted = [];
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

test('ENS identity updates discard stale results on account changes and disconnect', async () => {
  const { WalletSession } = await import('../js/wallet.js');
  const pending = [], handlers = new Map();
  const session = new WalletSession({ lookupName: address => new Promise(resolve => pending.push({ address, resolve })) });
  const raw = {
    request: async ({ method }) => method === 'eth_chainId' ? '0x2105' : ['0x' + '1'.repeat(40)],
    on: (name, handler) => handlers.set(name, handler),
    removeListener: name => handlers.delete(name),
  };
  await session.connect(raw);
  assert.equal(session.snapshot().ensStatus, 'loading');
  handlers.get('accountsChanged')(['0x' + '2'.repeat(40)]);
  pending[0].resolve('previous.eth');
  await Promise.resolve();
  assert.equal(session.snapshot().ensName, null);
  pending[1].resolve('current.eth');
  await Promise.resolve();
  assert.equal(session.snapshot().ensName, 'current.eth');
  assert.equal(session.snapshot().ensStatus, 'resolved');
  handlers.get('accountsChanged')(['0x' + '3'.repeat(40)]);
  assert.equal(session.snapshot().ensName, null);
  session.forget();
  pending[2].resolve('disconnected.eth');
  await Promise.resolve();
  assert.equal(session.snapshot().ensName, null);
  assert.equal(session.snapshot().connected, false);
});

test('ENS outages retain address and emit an explicit unavailable state', async () => {
  const { WalletSession } = await import('../js/wallet.js');
  const session = new WalletSession({ lookupName: async () => { throw new Error('Synthetic ENS outage'); } });
  const original = console.warn, warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    await session.connect({ request: async ({ method }) => method === 'eth_chainId' ? '0x2105' : ['0x' + '1'.repeat(40)] });
    await Promise.resolve();
    assert.equal(session.snapshot().connected, true);
    assert.equal(session.snapshot().ensStatus, 'unavailable');
    assert.equal(session.snapshot().ensName, null);
    assert.equal(warnings.length, 1);
  } finally { console.warn = original; }
});
