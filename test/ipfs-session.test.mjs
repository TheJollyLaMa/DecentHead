import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IPFSSession } from '../js/ipfs.js';

test('shared session uses Pinata credentials only in headers and POSTs to local Kubo without them', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.window = new EventTarget();
  const requests = [], events = [], cid = 'Qm' + 'a'.repeat(44);
  window.addEventListener('decenthead:ipfs', event => events.push(event.detail));
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.includes('/add?')) return new Response(JSON.stringify({ Hash: cid }) + '\n');
    if (url.includes('/cat?') || url.includes('ipfs.io/ipfs/')) return Response.json({ selected: true });
    return Response.json({ IpfsHash: cid });
  };
  try {
    const session = new IPFSSession();
    session.configure({ provider: 'pinata', apiKey: 'synthetic-key', apiSecret: 'synthetic-secret' });
    assert.equal(requests.length, 0);
    assert.equal(await session.upload({ selected: true }), cid);
    assert.equal(requests[0].options.headers.pinata_api_key, 'synthetic-key');
    assert.equal(await requests[0].options.body.get('file').text(), '{"selected":true}');
    assert.deepEqual(await session.restore(cid), { selected: true });
    await session.pin(cid, { consent: true });
    assert.match(requests[2].url, /pinByHash$/);
    assert.deepEqual(JSON.parse(requests[2].options.body), { hashToPin: cid });
    session.configure({ provider: 'local' });
    assert.equal(await session.upload({ selected: true }), cid);
    assert.deepEqual(await session.restore(cid), { selected: true });
    await session.pin(cid, { consent: true });
    for (const { url, options } of requests.slice(3)) {
      assert.match(url, /^http:\/\/127.0.0.1:5001\/api\/v0\//);
      assert.equal(options.method, 'POST');
      assert.equal(options.headers, undefined);
    }
    assert.match(requests[3].url, /add\?pin=true$/);
    assert.match(requests[4].url, /cat\?arg=/);
    assert.match(requests[5].url, /pin\/add\?arg=/);
    assert.doesNotMatch(JSON.stringify(events), /synthetic-key|synthetic-secret|"selected"/);
    globalThis.fetch = async () => new Response('offline', { status: 503 });
    await assert.rejects(() => session.restore(cid), /HTTP 503/);
  } finally { globalThis.fetch = originalFetch; }
});
