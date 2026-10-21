const { test } = require('node:test');
const assert = require('node:assert/strict');

const api = import('../js/ipfs-host.js');
const host = (overrides = {}) => ({
  version: 1,
  label: 'Synthetic host',
  capabilities: { backup: { open() {} } },
  getStatus: async () => ({ backup: { state: 'idle', detail: 'Local only; no upload.' } }),
  ...overrides,
});

test('adapter construction/validation does not request status, open controls or assume credentials', async () => {
  const { validateIPFSHost } = await api;
  const adapter = host({
    getStatus() { throw new Error('Unexpected automatic status request'); },
    capabilities: { backup: { open() { throw new Error('Unexpected automatic action'); } } },
  });
  assert.equal(validateIPFSHost(adapter), adapter);
});

test('capabilities and statuses remain independent with explicit unavailable states', async () => {
  const { readIPFSHostStatus } = await api;
  const status = await readIPFSHostStatus(host({
    capabilities: { backup: { open() {} }, replication: { open() {} }, rewards: { open() {} } },
    getStatus: async () => ({
      backup: { state: 'ready', detail: 'Provider available, not proof of backup.' },
      replication: { state: 'pending', detail: 'Pin request queued, not retained.' },
      rewards: { state: 'unavailable', detail: 'Reward program inactive.' },
    }),
  }));
  assert.equal(status.backup.state, 'ready');
  assert.equal(status.replication.state, 'pending');
  assert.equal(status.rewards.state, 'unavailable');
  const localOnly = await readIPFSHostStatus(host());
  assert.deepEqual(localOnly.replication, { state: 'unavailable', detail: 'Not configured by this app.' });
  assert.deepEqual(localOnly.rewards, localOnly.replication);
});

test('invalid versions, capabilities and success-shaped missing statuses reject explicitly', async () => {
  const { validateIPFSHost, readIPFSHostStatus } = await api;
  for (const value of [
    null, host({ version: 2 }), host({ label: '' }), host({ getStatus: null }),
    host({ capabilities: [] }), host({ capabilities: { uploadEverything: { open() {} } } }),
    host({ capabilities: { backup: {} } }),
  ]) assert.throws(() => validateIPFSHost(value));
  for (const value of [null, [], {}, { backup: { state: 'paid', detail: 'Unverified' } }, { backup: { state: 'ready' } }]) {
    await assert.rejects(() => readIPFSHostStatus(host({ getStatus: async () => value })));
  }
});

test('status failures propagate; no empty success or storage action replaces a failed read', async () => {
  const { readIPFSHostStatus } = await api;
  let opens = 0;
  await assert.rejects(() => readIPFSHostStatus(host({
    getStatus: async () => { throw new Error('Synthetic offline status'); },
    capabilities: { backup: { open() { opens++; } } },
  })), /Synthetic offline status/);
  assert.equal(opens, 0);
});

test('opening one host capability never invokes another or manufactures a storage receipt', async () => {
  const { openIPFSHostControls } = await api;
  const calls = [];
  const adapter = host({
    capabilities: {
      backup: { open: async () => { calls.push('backup'); return { fakeReceipt: true }; } },
      replication: { open: async () => { calls.push('replication'); } },
    },
  });
  assert.equal(await openIPFSHostControls(adapter, 'backup'), undefined);
  assert.deepEqual(calls, ['backup']);
  await assert.rejects(() => openIPFSHostControls(adapter, 'rewards'), /not configured/);
  await assert.rejects(() => openIPFSHostControls(adapter, 'constructor'), /not configured/);
  assert.deepEqual(calls, ['backup']);
});

test('host action errors propagate and different app schemas never enter the header contract', async () => {
  const { openIPFSHostControls } = await api;
  const data = { privateSynthetic: 'Never handed to the header' };
  const a = host({ capabilities: { backup: { open: async () => { assert.equal(data.privateSynthetic, 'Never handed to the header'); } } } });
  const b = host({ label: 'Other app', capabilities: { replication: { open: async () => { throw new Error('Synthetic host panel failed'); } } } });
  await openIPFSHostControls(a, 'backup');
  await assert.rejects(() => openIPFSHostControls(b, 'replication'), /Synthetic host panel failed/);
});
