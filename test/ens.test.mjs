import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupWalletName } from '../js/ens.js';

test('ENS displays a reverse name only when its forward record matches the wallet', async () => {
  const address = '0x' + 'a'.repeat(40);
  let name = 'thejollylama.eth', resolved = address;
  globalThis.ethers = {
    FetchRequest: class {},
    JsonRpcProvider: class {
      lookupAddress = async () => name;
      resolveName = async () => resolved;
    },
  };
  assert.equal(await lookupWalletName(address), name);
  resolved = '0x' + 'b'.repeat(40);
  assert.equal(await lookupWalletName(address), null);
  resolved = null;
  assert.equal(await lookupWalletName(address), null);
  name = null;
  assert.equal(await lookupWalletName(address), null);
});
